// Every sprite in src/lib/art/svg, by file name. art.test.ts keeps this list and the files in sync.
export const ART_IDS = [
	// crops
	'seed-mound',
	'wheat-sprout',
	'wheat-young',
	'wheat-mature',
	// field
	'soil-dry',
	'soil-wet',
	// workers
	'farmer',
	// currency
	'coin'
] as const;

export type ArtId = (typeof ART_IDS)[number];
