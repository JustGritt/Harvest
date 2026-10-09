export type CropId = 'wheat' | 'carrot' | 'pumpkin' | 'sunflower';

export type UpgradeId =
	| 'farmer'
	| 'seedPlanter'
	| 'farmerTraining'
	| 'planterGears'
	| 'sprinkler'
	| 'qualitySeeds'
	| 'fertilizer'
	| 'expandField'
	| 'luckyClover'
	| 'prizeRibbons'
	| 'rainbowSeeds';

export type UpgradeLevels = Record<UpgradeId, number>;

/** A rare variant rolled at planting that sells for more. */
export type MutationId = 'bountiful' | 'giant' | 'golden' | 'rainbow';

/** An Almanac entry: a crop × mutation pair the player has harvested. */
export type Discovery = `${CropId}:${MutationId}`;

export type CellStatus = 'empty' | 'growing' | 'ready';

export interface Cell {
	id: string;
	status: CellStatus;
	crop: CropId | null;
	plantedAt: number | null;
	readyAt: number | null;
	/** Rolled at planting; null for an ordinary crop (and empty plots). */
	mutation: MutationId | null;
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
	/** Almanac entries found so far, in order. Kept across prestige. */
	discoveries: Discovery[];
}

export interface OfflineReport {
	elapsed: number;
	earned: number;
}

export interface HarvestEvent {
	cellId: string;
	crop: CropId;
	value: number;
	/** True when a farmer harvested the plot rather than the player. */
	auto: boolean;
	mutation: MutationId | null;
	/** True the first time this crop × mutation pair is harvested. */
	discovery: boolean;
}
