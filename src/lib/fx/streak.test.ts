import { describe, expect, it } from 'vitest';
import { NO_STREAK, STREAK_WINDOW_MS, nextStreak, streakHype } from './streak';

describe('nextStreak', () => {
	it('starts at 1 and grows while reaps stay within the window', () => {
		let streak = nextStreak(NO_STREAK, 1_000);
		expect(streak).toEqual({ count: 1, at: 1_000 });
		streak = nextStreak(streak, 1_000 + STREAK_WINDOW_MS);
		expect(streak.count).toBe(2);
		streak = nextStreak(streak, streak.at + 100);
		expect(streak.count).toBe(3);
	});

	it('restarts after a pause longer than the window', () => {
		const streak = nextStreak({ count: 7, at: 0 }, STREAK_WINDOW_MS + 1);
		expect(streak).toEqual({ count: 1, at: STREAK_WINDOW_MS + 1 });
	});
});

describe('streakHype', () => {
	it('ramps from 0 at the first reap to 1 at the tenth, then holds', () => {
		expect(streakHype(0)).toBe(0);
		expect(streakHype(1)).toBe(0);
		expect(streakHype(5.5)).toBeCloseTo(0.5);
		expect(streakHype(10)).toBe(1);
		expect(streakHype(40)).toBe(1);
	});
});
