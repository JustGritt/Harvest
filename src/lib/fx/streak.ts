// Harvest streak: player reaps in quick succession build a combo. It's purely cosmetic and
// only scales the feedback (text size, particle counts, the "×N" label).
export const STREAK_WINDOW_MS = 1200;
/** Streak length from which the "×N" combo label shows. */
export const COMBO_LABEL_FROM = 3;

export interface Streak {
	count: number;
	/** Time of the last reap. */
	at: number;
}

export const NO_STREAK: Streak = { count: 0, at: -Infinity };

/** The streak after a reap at `now`: one longer if within the window, otherwise restarted. */
export function nextStreak(prev: Streak, now: number, windowMs = STREAK_WINDOW_MS): Streak {
	return { count: now - prev.at <= windowMs ? prev.count + 1 : 1, at: now };
}

/** How hyped the feedback is, 0 to 1: rises from the 2nd reap in a streak, full at the 10th. */
export function streakHype(count: number): number {
	return Math.min(1, Math.max(0, (count - 1) / 9));
}
