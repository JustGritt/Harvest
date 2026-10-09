import { BALANCE } from '$lib/data/balance';
import { CROPS } from '$lib/data/crops';
import { MUTATIONS, MUTATION_ORDER } from '$lib/data/mutations';
import { UPGRADES } from '$lib/data/upgrades';
import type { Cell, CropId, GameState, MutationId, UpgradeId, UpgradeLevels } from '$lib/types';

// ---------- Field ----------

export function createCell(r: number, c: number): Cell {
	return {
		id: `${r}-${c}`,
		status: 'empty',
		crop: null,
		plantedAt: null,
		readyAt: null,
		mutation: null
	};
}

/** Expansions alternate: odd levels add a column, even levels add a row. */
export function fieldSize(expandLevel: number) {
	return {
		rows: BALANCE.baseRows + Math.floor(expandLevel / 2),
		cols: BALANCE.baseCols + Math.ceil(expandLevel / 2)
	};
}

/** Returns a field of the given size, keeping existing cells where they fit. */
export function resizeField(field: Cell[][], rows: number, cols: number): Cell[][] {
	const next: Cell[][] = [];
	for (let r = 0; r < rows; r++) {
		const row: Cell[] = [];
		for (let c = 0; c < cols; c++) {
			row.push(field[r]?.[c] ?? createCell(r, c));
		}
		next.push(row);
	}
	return next;
}

// ---------- Formulas ----------

export function upgradeCost(id: UpgradeId, level: number): number {
	const def = UPGRADES[id];
	return Math.floor(def.baseCost * def.costGrowth ** level);
}

export function isMaxed(id: UpgradeId, level: number): boolean {
	const max = UPGRADES[id].maxLevel;
	return max !== undefined && level >= max;
}

/** Shown (and buyable) once its prerequisite upgrade is owned and its crop unlocked. */
export function isUpgradeVisible(
	id: UpgradeId,
	state: Pick<GameState, 'upgrades' | 'unlockedCrops'>
): boolean {
	const { requires, requiresCrop } = UPGRADES[id];
	return (
		(!requires || state.upgrades[requires] > 0) &&
		(!requiresCrop || state.unlockedCrops.includes(requiresCrop))
	);
}

export function growthMultiplier(upgrades: UpgradeLevels): number {
	return BALANCE.sprinklerFactor ** upgrades.sprinkler;
}

export function growTime(crop: CropId, upgrades: UpgradeLevels): number {
	return CROPS[crop].growTime * growthMultiplier(upgrades);
}

export function valueMultiplier(state: Pick<GameState, 'upgrades' | 'legacySeeds'>): number {
	const { qualitySeeds, fertilizer } = state.upgrades;
	return (
		(1 + qualitySeeds * BALANCE.qualitySeedsBonus) *
		BALANCE.fertilizerFactor ** fertilizer *
		(1 + state.legacySeeds * BALANCE.legacySeedBonus)
	);
}

/** Share of the grow time that has passed, 0–1. */
export function growProgress(cell: Cell, now: number): number {
	if (cell.plantedAt === null || cell.readyAt === null) return 0;
	const total = cell.readyAt - cell.plantedAt;
	if (total <= 0) return 1;
	return Math.min(1, Math.max(0, (now - cell.plantedAt) / total));
}

export type GrowStage = 'seed' | 'sprout' | 'young';

/**
 * How a growing crop is drawn: a seed mound just after planting, then a sprout, then the young
 * crop. Within the sprout and young stages the sprite grows from 85% to full size.
 */
export function growStage(progress: number): { stage: GrowStage; scale: number } {
	const grow = (from: number, to: number) =>
		0.85 + 0.15 * Math.min(1, (progress - from) / (to - from));
	if (progress < 0.15) return { stage: 'seed', scale: 1 };
	if (progress < 0.5) return { stage: 'sprout', scale: grow(0.15, 0.5) };
	return { stage: 'young', scale: grow(0.5, 1) };
}

// ---------- Mutations ----------

/** Chance that one planting gets this mutation (0 while it's locked). */
export function mutationChance(id: MutationId, upgrades: UpgradeLevels): number {
	const { chance, unlockedBy } = MUTATIONS[id];
	if (unlockedBy && upgrades[unlockedBy] < 1) return 0;
	return chance * (1 + upgrades.luckyClover * BALANCE.luckyCloverBonus);
}

/** Value multiplier of a mutation (1 for an ordinary crop). Prize Ribbons grow the extra part. */
export function mutationMultiplier(id: MutationId | null, upgrades: UpgradeLevels): number {
	if (!id) return 1;
	const extra = MUTATIONS[id].multiplier - 1;
	return 1 + extra * (1 + upgrades.prizeRibbons * BALANCE.prizeRibbonBonus);
}

/** The mutation for a planting, given a uniform random `roll` in [0, 1). Rarest is checked first. */
export function rollMutation(upgrades: UpgradeLevels, roll: number): MutationId | null {
	let edge = 0;
	for (const id of [...MUTATION_ORDER].reverse()) {
		edge += mutationChance(id, upgrades);
		if (roll < edge) return id;
	}
	return null;
}

/** Average value multiplier from mutations over many plantings. */
export function expectedMutationMultiplier(upgrades: UpgradeLevels): number {
	return MUTATION_ORDER.reduce(
		(sum, id) => sum + mutationChance(id, upgrades) * (mutationMultiplier(id, upgrades) - 1),
		1
	);
}

export function harvestValue(
	crop: CropId,
	state: Pick<GameState, 'upgrades' | 'legacySeeds'>,
	mutation: MutationId | null = null
) {
	return Math.round(
		CROPS[crop].value * valueMultiplier(state) * mutationMultiplier(mutation, state.upgrades)
	);
}

/** Money per second one plot earns with this crop, ignoring time spent empty. */
export function cropRate(crop: CropId, state: Pick<GameState, 'upgrades' | 'legacySeeds'>) {
	return harvestValue(crop, state) / (growTime(crop, state.upgrades) / 1000);
}

export function farmerInterval(upgrades: UpgradeLevels): number {
	return BALANCE.workerBaseInterval * BALANCE.workerSpeedFactor ** upgrades.farmerTraining;
}

export function planterInterval(upgrades: UpgradeLevels): number {
	return BALANCE.workerBaseInterval * BALANCE.workerSpeedFactor ** upgrades.planterGears;
}

export function prestigeGain(runEarned: number): number {
	return Math.floor(Math.sqrt(runEarned / BALANCE.prestigeDivisor));
}

/** Run earnings needed to reach `seeds` legacy seeds. */
export function prestigeThreshold(seeds: number): number {
	return seeds ** 2 * BALANCE.prestigeDivisor;
}

/** Human-readable "current → next" effect of buying one more level. */
export function describeEffect(id: UpgradeId, state: GameState): string {
	const u = state.upgrades;
	const next = { ...u, [id]: u[id] + 1 };
	const show = (a: string, b: string) => (isMaxed(id, u[id]) ? a : `${a} → ${b}`);
	switch (id) {
		case 'farmer':
			return show(
				`${formatRate(u.farmer, farmerInterval(u))}`,
				`${formatRate(next.farmer, farmerInterval(u))} harvests`
			);
		case 'seedPlanter':
			return show(
				`${formatRate(u.seedPlanter, planterInterval(u))}`,
				`${formatRate(next.seedPlanter, planterInterval(u))} plants`
			);
		case 'farmerTraining':
			return show(formatSeconds(farmerInterval(u)), `${formatSeconds(farmerInterval(next))} each`);
		case 'planterGears':
			return show(
				formatSeconds(planterInterval(u)),
				`${formatSeconds(planterInterval(next))} each`
			);
		case 'sprinkler':
			return show(
				formatPercentFaster(growthMultiplier(u)),
				`${formatPercentFaster(growthMultiplier(next))} grow time`
			);
		case 'qualitySeeds':
			return show(
				`+${Math.round(u.qualitySeeds * BALANCE.qualitySeedsBonus * 100)}%`,
				`+${Math.round(next.qualitySeeds * BALANCE.qualitySeedsBonus * 100)}% value`
			);
		case 'fertilizer':
			return show(
				`×${(BALANCE.fertilizerFactor ** u.fertilizer).toFixed(2)}`,
				`×${(BALANCE.fertilizerFactor ** next.fertilizer).toFixed(2)} value`
			);
		case 'luckyClover':
			return show(
				`×${(1 + u.luckyClover * BALANCE.luckyCloverBonus).toFixed(1)}`,
				`×${(1 + next.luckyClover * BALANCE.luckyCloverBonus).toFixed(1)} mutation chance`
			);
		case 'prizeRibbons':
			return show(
				`×${formatMultiplier(mutationMultiplier('golden', u))}`,
				`×${formatMultiplier(mutationMultiplier('golden', next))} for Golden`
			);
		case 'rainbowSeeds':
			return u.rainbowSeeds > 0
				? `Rainbow ×${formatMultiplier(mutationMultiplier('rainbow', u))}`
				: `Rainbow crops ×${formatMultiplier(mutationMultiplier('rainbow', next))}`;
		case 'expandField': {
			const a = fieldSize(u.expandField);
			const b = fieldSize(next.expandField);
			return show(`${a.cols}×${a.rows}`, `${b.cols}×${b.rows} plots`);
		}
	}
}

// ---------- Formatting ----------

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function formatNumber(n: number): string {
	if (!Number.isFinite(n)) return '∞';
	if (Math.abs(n) < 1000) return Math.floor(n).toString();
	const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(Math.abs(n)) / 3));
	const scaled = n / 1000 ** tier;
	const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
	// Truncate instead of rounding so 999.99K never shows as "1000K"
	const truncated = Math.floor(scaled * 10 ** decimals) / 10 ** decimals;
	return truncated.toFixed(decimals) + SUFFIXES[tier];
}

export function formatSeconds(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

export function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s % 60}s`;
	return `${s}s`;
}

function formatRate(count: number, intervalMs: number): string {
	return `${((count * 1000) / intervalMs).toFixed(2)}/s`;
}

function formatMultiplier(x: number): string {
	return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

function formatPercentFaster(multiplier: number): string {
	return `−${Math.round((1 - multiplier) * 100)}%`;
}
