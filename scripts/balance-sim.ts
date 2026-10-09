// Headless balance simulation that drives the real game store with a fake clock.
// Run with `yarn sim [mixed|active] [--timeline]`:
//   mixed  - clicks for the first 2 minutes, then idles; buys anything (cheapest first), but stops
//            adding workers once they keep up with the field (extra ones would sit idle)
//   active - clicks the whole time and never buys workers
// The simulated player clicks 4 times per second, harvesting before planting.
// Math.random is seeded, so mutation rolls (and every result) are the same on each run.

import type { CropId, GameState, UpgradeId } from '$lib/types';

let fakeNow = 1_000_000;
Date.now = () => fakeNow;

// mulberry32: a tiny seeded PRNG
let seed = 42;
Math.random = () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Imported after faking Date.now so the initial state uses the fake clock
const { get } = await import('svelte/store');
const { gameStore } = await import('$lib/store');
const { CROPS, CROP_ORDER } = await import('$lib/data/crops');
const { UPGRADES, UPGRADE_ORDER } = await import('$lib/data/upgrades');
const { MUTATIONS } = await import('$lib/data/mutations');
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

/** Actions per second the field can use: every plot replanted as soon as it's ripe. */
function fieldThroughput(s: GameState): number {
	const plots = s.field.length * s.field[0].length;
	return (plots * 1000) / U.growTime(s.selectedCrop, s.upgrades);
}

/** Worker upgrades that would only add idle capacity right now. */
function saturated(s: GameState): UpgradeId[] {
	const need = fieldThroughput(s) * 1.25;
	const farmers = (s.upgrades.farmer * 1000) / U.farmerInterval(s.upgrades);
	const planters = (s.upgrades.seedPlanter * 1000) / U.planterInterval(s.upgrades);
	return [
		...(farmers >= need ? (['farmer', 'farmerTraining'] as const) : []),
		...(planters >= need ? (['seedPlanter', 'planterGears'] as const) : [])
	];
}

function buyCheapest() {
	for (let i = 0; i < 20; i++) {
		const s = get(gameStore);
		const idle = saturated(s);
		const options: { cost: number; buy: () => void }[] = UPGRADE_ORDER.filter(
			(id) =>
				U.isUpgradeVisible(id, s) &&
				!U.isMaxed(id, s.upgrades[id]) &&
				!idle.includes(id) &&
				!(mode === 'active' && WORKER_UPGRADES.includes(id))
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

// Share of earnings that came from mutated crops, per reporting interval
let mutatedEarned = 0;
gameStore.onHarvest((e) => {
	if (e.mutation) {
		mutatedEarned += e.value;
		note(fakeNow - start, `mutation:${e.mutation}`, `first ${MUTATIONS[e.mutation].name} crop`);
	}
	if (e.discovery)
		note(fakeNow - start, `almanac:${e.crop}:${e.mutation}`, `Almanac: ${e.mutation} ${e.crop}`);
});

// Timeline of firsts: everything a player would notice as new (unlocks, new shop items, first
// purchases, maxed upgrades, mutations, Almanac entries, legacy seeds)
const timeline: { t: number; what: string }[] = [];
const seen = new Set<string>();
function note(t: number, key: string, what: string) {
	if (seen.has(key)) return;
	seen.add(key);
	if (t > 0) timeline.push({ t, what });
}

function noteState(t: number, s: GameState) {
	for (const crop of s.unlockedCrops) note(t, `crop:${crop}`, `unlock ${CROPS[crop].name}`);
	for (const id of UPGRADE_ORDER) {
		const name = UPGRADES[id].name;
		if (U.isUpgradeVisible(id, s)) note(t, `see:${id}`, `${name} appears`);
		if (s.upgrades[id] > 0) note(t, `buy:${id}`, `first ${name}`);
		if (U.isMaxed(id, s.upgrades[id])) note(t, `max:${id}`, `${name} maxed`);
	}
	const seeds = U.prestigeGain(s.runEarned);
	for (const n of [1, 5, 10, 20, 40]) {
		if (seeds >= n) note(t, `seeds:${n}`, `${n} legacy seed${n > 1 ? 's' : ''} for sale`);
	}
}

noteState(0, get(gameStore));

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
	if (t % 1000 === 0) noteState(t, s);
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
				`LC${u.luckyClover} PR${u.prizeRibbons} RS${u.rainbowSeeds}`,
				`🌟${U.prestigeGain(s.runEarned)}`,
				`📖${s.discoveries.length}`,
				`mut ${Math.round((mutatedEarned / Math.max(1, s.runEarned - lastEarned)) * 100)}%`
			].join('  ')
		);
		mutatedEarned = 0;
		lastEarned = s.runEarned;
		lastMark = fakeNow;
	}
}
console.log(
	'first legacy seed available at',
	firstPrestige === null ? 'never' : U.formatDuration(firstPrestige)
);

if (process.argv.includes('--timeline')) {
	console.log('\ntimeline:');
	for (const { t, what } of timeline) console.log(`${U.formatDuration(t).padStart(8)}  ${what}`);
}

// Longest stretch with nothing new, per window
for (const [from, to] of [
	[0, 30],
	[30, 60],
	[60, 120]
]) {
	const times = [from * 60_000, ...timeline.map((e) => e.t), to * 60_000].filter(
		(t) => t >= from * 60_000 && t <= to * 60_000
	);
	let gap = 0;
	let at = 0;
	for (let i = 1; i < times.length; i++) {
		if (times[i] - times[i - 1] > gap) [gap, at] = [times[i] - times[i - 1], times[i - 1]];
	}
	const count = times.length - 2;
	console.log(
		`${from}-${to}m: ${count} new things, longest wait ${U.formatDuration(gap)} (from ${U.formatDuration(at)})`
	);
}
