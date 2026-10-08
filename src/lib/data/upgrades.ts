import type { UpgradeId } from '$lib/types';

export type UpgradeCategory = 'workers' | 'growth' | 'field';

export interface UpgradeDef {
	id: UpgradeId;
	name: string;
	description: string;
	category: UpgradeCategory;
	baseCost: number;
	/** cost = floor(baseCost × costGrowth^level) */
	costGrowth: number;
	maxLevel?: number;
	/** Hidden until at least one level of this upgrade is owned. */
	requires?: UpgradeId;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
	farmer: {
		id: 'farmer',
		name: 'Farmer',
		description: 'Harvests ready plots on their own.',
		category: 'workers',
		baseCost: 100,
		costGrowth: 1.25
	},
	seedPlanter: {
		id: 'seedPlanter',
		name: 'Seed Planter',
		description: 'Plants your selected seed in empty plots.',
		category: 'workers',
		baseCost: 75,
		costGrowth: 1.25
	},
	farmerTraining: {
		id: 'farmerTraining',
		name: 'Farmer Training',
		description: 'Farmers work 12% faster.',
		category: 'workers',
		baseCost: 200,
		costGrowth: 1.7,
		maxLevel: 15,
		requires: 'farmer'
	},
	planterGears: {
		id: 'planterGears',
		name: 'Planter Gears',
		description: 'Seed planters work 12% faster.',
		category: 'workers',
		baseCost: 150,
		costGrowth: 1.7,
		maxLevel: 15,
		requires: 'seedPlanter'
	},
	sprinkler: {
		id: 'sprinkler',
		name: 'Sprinkler',
		description: 'Crops grow 8% faster (compounding).',
		category: 'growth',
		baseCost: 150,
		costGrowth: 1.7,
		maxLevel: 15
	},
	qualitySeeds: {
		id: 'qualitySeeds',
		name: 'Quality Seeds',
		description: '+20% harvest value.',
		category: 'growth',
		baseCost: 100,
		costGrowth: 1.4
	},
	fertilizer: {
		id: 'fertilizer',
		name: 'Fertilizer',
		description: '×1.1 harvest value (compounding).',
		category: 'growth',
		baseCost: 1000,
		costGrowth: 1.6
	},
	expandField: {
		id: 'expandField',
		name: 'Expand Field',
		description: 'Adds a column or row of plots.',
		category: 'field',
		baseCost: 250,
		costGrowth: 2.3,
		maxLevel: 10
	}
};

export const UPGRADE_ORDER: UpgradeId[] = [
	'farmer',
	'seedPlanter',
	'farmerTraining',
	'planterGears',
	'sprinkler',
	'qualitySeeds',
	'fertilizer',
	'expandField'
];
