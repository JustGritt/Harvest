import { describe, expect, it } from 'vitest';
import { burstVectors, coinCount } from './fx';

describe('coinCount', () => {
	it('adds a coin per order of magnitude, from 1 to 5', () => {
		expect(coinCount(0)).toBe(1);
		expect(coinCount(10)).toBe(1);
		expect(coinCount(100)).toBe(2);
		expect(coinCount(2_500)).toBe(3);
		expect(coinCount(40_000)).toBe(5);
		expect(coinCount(1e9)).toBe(5);
	});
});

describe('burstVectors', () => {
	const fixed = () => 0.5; // no jitter, 80% of spread

	it('returns one vector per particle at 60–100% of the spread', () => {
		const vectors = burstVectors(6, 50, Math.PI * 2, Math.random);
		expect(vectors).toHaveLength(6);
		for (const v of vectors) {
			const dist = Math.hypot(v.x, v.y);
			expect(dist).toBeGreaterThanOrEqual(30 - 1e-9);
			expect(dist).toBeLessThanOrEqual(50 + 1e-9);
		}
	});

	it('fans an upward arc symmetrically', () => {
		const [left, middle, right] = burstVectors(3, 10, Math.PI / 2, fixed);
		expect(middle.x).toBeCloseTo(0);
		expect(middle.y).toBeCloseTo(-8);
		expect(left.x).toBeCloseTo(-right.x);
		expect(left.y).toBeCloseTo(right.y);
		expect(left.y).toBeLessThan(0);
	});

	it('sends a single particle straight up', () => {
		const [only] = burstVectors(1, 10, Math.PI, fixed);
		expect(only.x).toBeCloseTo(0);
		expect(only.y).toBeCloseTo(-8);
	});
});
