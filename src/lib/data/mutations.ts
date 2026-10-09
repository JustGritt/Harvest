import type { MutationId } from '$lib/types';

export interface MutationDef {
	id: MutationId;
	name: string;
	/** Harvest value multiplier. */
	multiplier: number;
	/** Chance per planting before upgrades. */
	chance: number;
	/** Colour for labels and the ripe value tag. */
	tint: string;
}

// Rolled once when a crop is planted. Rarer mutations pay more; there are no bad ones.
export const MUTATIONS: Record<MutationId, MutationDef> = {
	bountiful: {
		id: 'bountiful',
		name: 'Bountiful',
		multiplier: 2,
		chance: 0.05,
		tint: '#639a35'
	},
	giant: {
		id: 'giant',
		name: 'Giant',
		multiplier: 4,
		chance: 0.015,
		tint: '#d4531c'
	},
	golden: {
		id: 'golden',
		name: 'Golden',
		multiplier: 10,
		chance: 0.004,
		tint: '#e09b0b'
	}
};

/** Commonest first. Rolls check the rarest first. */
export const MUTATION_ORDER: MutationId[] = ['bountiful', 'giant', 'golden'];
