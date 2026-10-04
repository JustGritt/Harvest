// Headless balance simulation that drives the real game store with a fake clock.
// Run with `yarn sim [mixed|active]`:
//   mixed  - clicks for the first 2 minutes, then idles; buys anything (cheapest first)
//   active - clicks the whole time and never buys workers
// The simulated player clicks 4 times per second, harvesting before planting.

import type { CropId, GameState, UpgradeId } from '$lib/types';

let fakeNow = 1_000_000;
Date.now = () => fakeNow;

// Imported after faking Date.now so the initial state uses the fake clock
const { get } = await import('svelte/store');
const { gameStore } = await import('$lib/store');
const { CROPS, CROP_ORDER } = await import('$lib/data/crops');
const { UPGRADE_ORDER } = await import('$lib/data/upgrades');
const U = await import('$lib/utils/gameUtils');

const mode = process.argv[2] === 'active' ? 'active' : 'mixed';
const WORKER_UPGRADES: UpgradeId[] = ['farmer', 'seedPlanter', 'farmerTraining', 'planterGears'];
const clickUntil = mode === 'active' ? Infinity : 2 * 60_000;
const marks = [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => m * 60_000);
const STEP = 250;
const start = fakeNow;

/** Crop with the best expected income given the current bottleneck. */
function bestCrop(s: GameState, clicking: boolean): CropId {
	const plots = s.field.length * s.field[0].length;
	const workerRate = Math.min(
		(s.upgrades.farmer * 1000) / U.farmerInterval(s.upgrades),
		(s.upgrades.seedPlanter * 1000) / U.planterInterval(s.upgrades)
	);
	// 4 clicks/s = 2 crops/s (plant + harvest)
	const actionRate = clicking ? 2 + workerRate : workerRate;
	let best: CropId = 'wheat';
	let bestIncome = -1;
	for (const id of s.unlockedCrops) {
		const plotRate = (plots * 1000) / U.growTime(id, s.upgrades);
		const income = Math.min(plotRate, actionRate) * U.harvestValue(id, s);
		if (income > bestIncome) {
			bestIncome = income;
			best = id;
		}
	}
	return best;
}

function clickOnce(s: GameState) {
	for (const want of ['ready', 'empty'] as const) {
		for (let r = 0; r < s.field.length; r++) {
			for (let c = 0; c < s.field[r].length; c++) {
				const cell = s.field[r][c];
				const ready =
					cell.status === 'ready' ||
					(cell.status === 'growing' && cell.readyAt !== null && fakeNow >= cell.readyAt);
				if (want === 'ready' && ready) return gameStore.harvestCrop(r, c);
				if (want === 'empty' && cell.status === 'empty') return gameStore.plantCrop(r, c);
			}
		}
	}
}

function buyCheapest() {
	for (let i = 0; i < 20; i++) {
		const s = get(gameStore);
		const options: { cost: number; buy: () => void }[] = UPGRADE_ORDER.filter(
			(id) => !U.isMaxed(id, s.upgrades[id]) && !(mode === 'active' && WORKER_UPGRADES.includes(id))
		).map((id) => ({
			cost: U.upgradeCost(id, s.upgrades[id]),
			buy: () => gameStore.buyUpgrade(id)
		}));
		const nextCrop = CROP_ORDER.find((id) => !s.unlockedCrops.includes(id));
		if (nextCrop) {
			options.push({ cost: CROPS[nextCrop].unlockCost, buy: () => gameStore.unlockCrop(nextCrop) });
		}
		options.sort((a, b) => a.cost - b.cost);
		if (!options[0] || options[0].cost > s.money) return;
		options[0].buy();
	}
}

let lastEarned = 0;
let lastMark = start;
let firstPrestige: number | null = null;

console.log(`mode: ${mode}`);
for (let t = 0; t <= marks[marks.length - 1]; t += STEP) {
	fakeNow = start + t;
	gameStore.tick(fakeNow);
	const clicking = t < clickUntil;
	if (clicking) clickOnce(get(gameStore));
	if (t % 1000 === 0) {
		buyCheapest();
		gameStore.selectCrop(bestCrop(get(gameStore), clicking));
	}

	const s = get(gameStore);
	if (firstPrestige === null && U.prestigeGain(s.runEarned) >= 1) firstPrestige = t;
	if (marks.includes(t)) {
		const rate = (s.runEarned - lastEarned) / ((fakeNow - lastMark) / 1000);
		const u = s.upgrades;
		console.log(
			[
				`${String(t / 60_000).padStart(4)}m`,
				`${U.formatNumber(rate).padStart(7)}/s`,
				`earned ${U.formatNumber(s.runEarned).padStart(7)}`,
				s.selectedCrop.padEnd(9),
				`F${u.farmer}/P${u.seedPlanter} FT${u.farmerTraining}/PG${u.planterGears}`,
				`Sp${u.sprinkler} QS${u.qualitySeeds} Fe${u.fertilizer} Fld${u.expandField}`,
				`🌟${U.prestigeGain(s.runEarned)}`
			].join('  ')
		);
		lastEarned = s.runEarned;
		lastMark = fakeNow;
	}
}
console.log(
	'first legacy seed available at',
	firstPrestige === null ? 'never' : U.formatDuration(firstPrestige)
);
