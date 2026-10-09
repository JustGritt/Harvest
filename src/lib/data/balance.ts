// All tunable numbers that aren't tied to a specific crop or upgrade.
export const BALANCE = {
	baseRows: 3,
	baseCols: 3,

	/** ms between actions for a single farmer / seed planter before upgrades. */
	workerBaseInterval: 3000,
	/** Interval multiplier per Farmer Training / Planter Gears level. */
	workerSpeedFactor: 0.88,

	/** Grow-time multiplier per sprinkler. */
	sprinklerFactor: 0.92,
	/** Additive value bonus per Quality Seeds level. */
	qualitySeedsBonus: 0.2,
	/** Compounding value multiplier per Fertilizer level. */
	fertilizerFactor: 1.1,

	/** Additive mutation chance bonus per Lucky Clover level (×1.2, ×1.4, …). */
	luckyCloverBonus: 0.2,
	/** Additive bonus to each mutation's extra value per Prize Ribbons level. */
	prizeRibbonBonus: 0.25,

	/** Income bonus per legacy seed. */
	legacySeedBonus: 0.1,
	/** Legacy seeds earned on prestige = floor(sqrt(runEarned / prestigeDivisor)). */
	prestigeDivisor: 1_000_000,

	tickMs: 100,
	/** Largest simulation sub-step, so throttled tabs and offline catch-up stay accurate. */
	maxStepMs: 1000,
	maxOfflineMs: 8 * 60 * 60 * 1000,
	saveIntervalMs: 5000
};
