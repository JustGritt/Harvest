import type { CropId } from '$lib/types';
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
	// currency
	'coin'
] as const;

export type ArtId = (typeof ART_IDS)[number];

/** Sprite for a crop at a growth stage. Every crop needs sprout, young and mature sprites. */
export function cropArt(crop: CropId, stage: GrowStage | 'mature'): ArtId {
	return stage === 'seed' ? 'seed-mound' : `${crop}-${stage}`;
}
