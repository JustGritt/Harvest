import { describe, expect, it } from 'vitest';
import { BALANCE } from '$lib/data/balance';
import type { UpgradeLevels } from '$lib/types';
import {
	createCell,
	cropRate,
	expectedMutationMultiplier,
	farmerInterval,
	fieldSize,
	formatDuration,
	formatNumber,
	growProgress,
	growStage,
	growTime,
	harvestValue,
	isMaxed,
	mutationMultiplier,
	prestigeGain,
	prestigeThreshold,
	resizeField,
	rollMutation,
	upgradeCost
} from './gameUtils';
import { MUTATIONS } from '$lib/data/mutations';

const levels = (overrides: Partial<UpgradeLevels> = {}): UpgradeLevels => ({
	farmer: 0,
	seedPlanter: 0,
	farmerTraining: 0,
	planterGears: 0,
	sprinkler: 0,
	qualitySeeds: 0,
	fertilizer: 0,
	expandField: 0,
	...overrides
});

describe('upgradeCost / isMaxed', () => {
	it('scales geometrically and floors', () => {
		expect(upgradeCost('farmer', 0)).toBe(100);
		expect(upgradeCost('farmer', 1)).toBe(125);
		expect(upgradeCost('farmer', 2)).toBe(156); // 156.25
	});

	it('respects maxLevel only for capped upgrades', () => {
		expect(isMaxed('sprinkler', 14)).toBe(false);
		expect(isMaxed('sprinkler', 15)).toBe(true);
		expect(isMaxed('farmer', 1000)).toBe(false);
	});
});

describe('growTime', () => {
	it('uses base crop time without sprinklers', () => {
		expect(growTime('wheat', levels())).toBe(3000);
	});

	it('compounds sprinklers', () => {
		expect(growTime('wheat', levels({ sprinkler: 2 }))).toBeCloseTo(3000 * 0.92 ** 2);
	});
});

describe('growProgress / growStage', () => {
	const planted = { ...createCell(0, 0), status: 'growing' as const, crop: 'wheat' as const };

	it('measures elapsed share of the grow time, clamped to 0–1', () => {
		const cell = { ...planted, plantedAt: 1000, readyAt: 3000 };
		expect(growProgress(cell, 2000)).toBe(0.5);
		expect(growProgress(cell, 500)).toBe(0);
		expect(growProgress(cell, 9000)).toBe(1);
	});

	it('is 0 for an empty plot', () => {
		expect(growProgress(createCell(0, 0), 5000)).toBe(0);
	});

	it('goes seed, sprout, young, growing within each stage', () => {
		expect(growStage(0)).toEqual({ stage: 'seed', scale: 1 });
		expect(growStage(0.15)).toEqual({ stage: 'sprout', scale: 0.85 });
		expect(growStage(0.5)).toEqual({ stage: 'young', scale: 0.85 });
		expect(growStage(0.75).scale).toBeCloseTo(0.925);
		expect(growStage(1)).toEqual({ stage: 'young', scale: 1 });
	});
});

describe('harvestValue', () => {
	it('is the base value with no upgrades', () => {
		expect(harvestValue('carrot', { upgrades: levels(), legacySeeds: 0 })).toBe(40);
	});

	it('stacks quality seeds, fertilizer and legacy seeds, rounded to an integer', () => {
		const value = harvestValue('wheat', {
			upgrades: levels({ qualitySeeds: 1, fertilizer: 1 }),
			legacySeeds: 3
		});
		// 10 × 1.2 × 1.1 × 1.3 = 17.16
		expect(value).toBe(17);
		expect(Number.isInteger(value)).toBe(true);
	});
});

describe('mutations', () => {
	const s = { upgrades: levels(), legacySeeds: 0 };
	const { bountiful, giant, golden } = MUTATIONS;

	it('rolls the rarest first, then commoner ones, then nothing', () => {
		expect(rollMutation(0)).toBe('golden');
		expect(rollMutation(golden.chance - 1e-9)).toBe('golden');
		expect(rollMutation(golden.chance)).toBe('giant');
		expect(rollMutation(golden.chance + giant.chance)).toBe('bountiful');
		expect(rollMutation(golden.chance + giant.chance + bountiful.chance)).toBeNull();
		expect(rollMutation(0.999)).toBeNull();
	});

	it('multiplies the harvest value', () => {
		expect(mutationMultiplier(null)).toBe(1);
		expect(harvestValue('carrot', s, 'giant')).toBe(40 * giant.multiplier);
		expect(harvestValue('carrot', s, null)).toBe(40);
	});

	it('has an expected multiplier of 1 + sum(chance × bonus)', () => {
		const expected =
			1 +
			bountiful.chance * (bountiful.multiplier - 1) +
			giant.chance * (giant.multiplier - 1) +
			golden.chance * (golden.multiplier - 1);
		expect(expectedMutationMultiplier()).toBeCloseTo(expected);
	});
});

describe('cropRate', () => {
	it('is harvest value per second of grow time', () => {
		const state = { upgrades: levels(), legacySeeds: 0 };
		expect(cropRate('wheat', state)).toBeCloseTo(10 / 3);
		expect(cropRate('carrot', state)).toBeCloseTo(4);
	});
});

describe('worker intervals', () => {
	it('speeds up with training', () => {
		expect(farmerInterval(levels())).toBe(BALANCE.workerBaseInterval);
		expect(farmerInterval(levels({ farmerTraining: 1 }))).toBeCloseTo(3000 * 0.88);
	});
});

describe('field', () => {
	it('alternates columns and rows from 3×3 to 8×8', () => {
		expect(fieldSize(0)).toEqual({ rows: 3, cols: 3 });
		expect(fieldSize(1)).toEqual({ rows: 3, cols: 4 });
		expect(fieldSize(2)).toEqual({ rows: 4, cols: 4 });
		expect(fieldSize(10)).toEqual({ rows: 8, cols: 8 });
	});

	it('resizeField keeps existing cells and adds empty ones', () => {
		const field = resizeField([], 3, 3);
		field[1][1].status = 'ready';
		const bigger = resizeField(field, 3, 4);
		expect(bigger[1][1]).toBe(field[1][1]);
		expect(bigger[0][3]).toEqual(createCell(0, 3));
		expect(bigger.every((row) => row.length === 4)).toBe(true);
	});
});

describe('prestige', () => {
	it('gives floor(sqrt(earned / divisor)) seeds', () => {
		expect(prestigeGain(BALANCE.prestigeDivisor - 1)).toBe(0);
		expect(prestigeGain(BALANCE.prestigeDivisor)).toBe(1);
		expect(prestigeGain(BALANCE.prestigeDivisor * 4)).toBe(2);
	});

	it('threshold is the inverse of gain', () => {
		for (const seeds of [1, 2, 5, 10]) {
			expect(prestigeGain(prestigeThreshold(seeds))).toBe(seeds);
			expect(prestigeGain(prestigeThreshold(seeds) - 1)).toBe(seeds - 1);
		}
	});
});

describe('formatNumber', () => {
	it.each([
		[0, '0'],
		[999.9, '999'],
		[1000, '1.00K'],
		[12_345, '12.3K'],
		[999_999, '999K'],
		[1_500_000, '1.50M'],
		[2.5e12, '2.50T']
	])('%d → %s', (n, expected) => {
		expect(formatNumber(n)).toBe(expected);
	});

	it('never rounds up into the next tier', () => {
		expect(formatNumber(999_990)).toBe('999K');
	});

	it('handles infinity', () => {
		expect(formatNumber(Infinity)).toBe('∞');
	});
});

describe('formatDuration', () => {
	it('picks the two largest units', () => {
		expect(formatDuration(45_000)).toBe('45s');
		expect(formatDuration(125_000)).toBe('2m 5s');
		expect(formatDuration(2 * 3600_000 + 13 * 60_000)).toBe('2h 13m');
	});
});
