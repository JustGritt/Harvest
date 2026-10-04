export type CropId = 'wheat' | 'carrot' | 'pumpkin' | 'sunflower';

export type UpgradeId =
	| 'farmer'
	| 'seedPlanter'
	| 'farmerTraining'
	| 'planterGears'
	| 'sprinkler'
	| 'qualitySeeds'
	| 'fertilizer'
	| 'expandField';

export type UpgradeLevels = Record<UpgradeId, number>;

export type CellStatus = 'empty' | 'growing' | 'ready';

export interface Cell {
	id: string;
	status: CellStatus;
	crop: CropId | null;
	plantedAt: number | null;
	readyAt: number | null;
}

export interface GameState {
	version: number;
	money: number;
	field: Cell[][];
	upgrades: UpgradeLevels;
	unlockedCrops: CropId[];
	selectedCrop: CropId;
	/** Fractional worker actions banked between ticks (capped at the worker count). */
	farmerProgress: number;
	planterProgress: number;
	/** Timestamp the simulation has been advanced to. */
	lastTick: number;
	runStartedAt: number;
	runEarned: number;
	// Kept across prestige resets
	legacySeeds: number;
	prestigeCount: number;
	lifetimeEarned: number;
	totalHarvested: number;
}

export interface OfflineReport {
	elapsed: number;
	earned: number;
}

export interface HarvestEvent {
	cellId: string;
	value: number;
	/** True when a farmer harvested the plot rather than the player. */
	auto: boolean;
}
