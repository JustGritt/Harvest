import type { CropId } from '$lib/types';

export interface CropDef {
	id: CropId;
	name: string;
	/** Base grow time in ms. */
	growTime: number;
	/** Base money per harvest. */
	value: number;
	unlockCost: number;
	/** Colour for the grow bar and harvest pops. */
	tint: string;
}

// A ladder: each slower crop earns a bit more per plot-second and far more per harvest,
// so it needs fewer clicks / worker actions for the same income.
export const CROPS: Record<CropId, CropDef> = {
	wheat: {
		id: 'wheat',
		name: 'Wheat',
		growTime: 3000,
		value: 10,
		unlockCost: 0,
		tint: '#d9a441'
	},
	carrot: {
		id: 'carrot',
		name: 'Carrot',
		growTime: 10_000,
		value: 40,
		unlockCost: 500,
		tint: '#f08a24'
	},
	pumpkin: {
		id: 'pumpkin',
		name: 'Pumpkin',
		growTime: 30_000,
		value: 150,
		unlockCost: 50_000,
		tint: '#d4531c'
	},
	sunflower: {
		id: 'sunflower',
		name: 'Sunflower',
		growTime: 60_000,
		value: 360,
		unlockCost: 1_400_000,
		tint: '#ffcc1a'
	}
};

export const CROP_ORDER: CropId[] = ['wheat', 'carrot', 'pumpkin', 'sunflower'];
