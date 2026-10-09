import type { CropId, UpgradeId } from '$lib/types';
import type { GrowStage } from '$lib/utils/gameUtils';

// Every sprite in src/lib/art/svg, by file name. art.test.ts keeps this list and the files in sync.
export const ART_IDS = [
	// crops
	'seed-mound',
	'wheat-sprout',
	'wheat-young',
	'wheat-mature',
	'carrot-sprout',
	'carrot-young',
	'carrot-mature',
	'pumpkin-sprout',
	'pumpkin-young',
	'pumpkin-mature',
	'sunflower-sprout',
	'sunflower-young',
	'sunflower-mature',
	// field
	'soil-dry',
	'soil-wet',
	'fence-frame',
	// workers
	'farmer',
	'seed-planter',
	// upgrades
	'farmer-training',
	'planter-gears',
	'sprinkler',
	'quality-seeds',
	'fertilizer',
	'expand-field',
	'lucky-clover',
	'prize-ribbon',
	'rainbow-seeds',
	// currency
	'coin',
	'legacy-seed',
	// ui
	'pouch',
	'stall',
	'ledger',
	'leaf',
	'lock',
	'check',
	'close',
	'sunrise',
	'warning',
	'crate',
	'pointer',
	// fx particles
	'dirt',
	'sparkle',
	'petal'
] as const;

export type ArtId = (typeof ART_IDS)[number];

/** Sprite for a crop at a growth stage. Every crop needs sprout, young and mature sprites. */
export function cropArt(crop: CropId, stage: GrowStage | 'mature'): ArtId {
	return stage === 'seed' ? 'seed-mound' : `${crop}-${stage}`;
}

export const UPGRADE_ART: Record<UpgradeId, ArtId> = {
	farmer: 'farmer',
	seedPlanter: 'seed-planter',
	farmerTraining: 'farmer-training',
	planterGears: 'planter-gears',
	sprinkler: 'sprinkler',
	qualitySeeds: 'quality-seeds',
	fertilizer: 'fertilizer',
	expandField: 'expand-field',
	luckyClover: 'lucky-clover',
	prizeRibbons: 'prize-ribbon',
	rainbowSeeds: 'rainbow-seeds'
};
