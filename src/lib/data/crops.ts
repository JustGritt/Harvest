import type { CropId } from '$lib/types';

export interface CropDef {
	id: CropId;
	name: string;
	icon: string;
	/** Base grow time in ms. */
	growTime: number;
	/** Base money per harvest. */
	value: number;
	unlockCost: number;
}

// A ladder: each slower crop earns a bit more per plot-second and far more per harvest,
// so it needs fewer clicks / worker actions for the same income.
export const CROPS: Record<CropId, CropDef> = {
	wheat: { id: 'wheat', name: 'Wheat', icon: '🌾', growTime: 3000, value: 10, unlockCost: 0 },
	carrot: {
		id: 'carrot',
		name: 'Carrot',
		icon: '🥕',
		growTime: 10_000,
		value: 40,
		unlockCost: 500
	},
	pumpkin: {
		id: 'pumpkin',
		name: 'Pumpkin',
		icon: '🎃',
		growTime: 30_000,
		value: 150,
		unlockCost: 5_000
	},
	sunflower: {
		id: 'sunflower',
		name: 'Sunflower',
		icon: '🌻',
		growTime: 60_000,
		value: 360,
		unlockCost: 250_000
	}
};

export const CROP_ORDER: CropId[] = ['wheat', 'carrot', 'pumpkin', 'sunflower'];
