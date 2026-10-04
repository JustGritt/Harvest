import { get, writable } from 'svelte/store';
import { BALANCE } from '$lib/data/balance';
import { CROPS } from '$lib/data/crops';
import { UPGRADES } from '$lib/data/upgrades';
import type { Cell, CropId, GameState, OfflineReport, UpgradeId } from '$lib/types';
import {
	farmerInterval,
	fieldSize,
	growTime,
	harvestValue,
	isMaxed,
	planterInterval,
	prestigeGain,
	resizeField,
	upgradeCost
} from '$lib/utils/gameUtils';

const SAVE_KEY = 'harvest-idle-save';
const SAVE_VERSION = 1;

/** Fresh run. `carry` holds the fields that survive a prestige reset. */
function createInitialState(
	carry?: Pick<GameState, 'legacySeeds' | 'prestigeCount' | 'lifetimeEarned' | 'totalHarvested'>
): GameState {
	const now = Date.now();
	const { rows, cols } = fieldSize(0);
	return {
		version: SAVE_VERSION,
		money: 0,
		field: resizeField([], rows, cols),
		upgrades: {
			farmer: 0,
			seedPlanter: 0,
			farmerTraining: 0,
			planterGears: 0,
			sprinkler: 0,
			qualitySeeds: 0,
			fertilizer: 0,
			expandField: 0
		},
		unlockedCrops: ['wheat'],
		selectedCrop: 'wheat',
		farmerProgress: 0,
		planterProgress: 0,
		lastTick: now,
		runStartedAt: now,
		runEarned: 0,
		legacySeeds: carry?.legacySeeds ?? 0,
		prestigeCount: carry?.prestigeCount ?? 0,
		lifetimeEarned: carry?.lifetimeEarned ?? 0,
		totalHarvested: carry?.totalHarvested ?? 0
	};
}

// ---------- Cell helpers (mutate state in place) ----------

function plantCell(state: GameState, cell: Cell, now: number) {
	cell.status = 'growing';
	cell.crop = state.selectedCrop;
	cell.plantedAt = now;
	cell.readyAt = now + growTime(state.selectedCrop, state.upgrades);
}

function harvestCell(state: GameState, cell: Cell) {
	if (cell.status !== 'ready' || !cell.crop) return;
	const value = harvestValue(cell.crop, state);
	state.money += value;
	state.runEarned += value;
	state.lifetimeEarned += value;
	state.totalHarvested++;
	cell.status = 'empty';
	cell.crop = null;
	cell.plantedAt = null;
	cell.readyAt = null;
}

// ---------- Simulation ----------

/** Advances the simulation by one sub-step ending at `now`. */
function step(state: GameState, now: number, dt: number) {
	const ready: Cell[] = [];
	for (const row of state.field) {
		for (const cell of row) {
			if (cell.status === 'growing' && cell.readyAt !== null && now >= cell.readyAt) {
				cell.status = 'ready';
			}
			if (cell.status === 'ready') ready.push(cell);
		}
	}

	// Each worker banks at most one action while there's nothing to do.
	const { farmer: farmers, seedPlanter: planters } = state.upgrades;
	if (farmers > 0) {
		state.farmerProgress = Math.min(
			farmers,
			state.farmerProgress + (dt * farmers) / farmerInterval(state.upgrades)
		);
		let i = 0;
		while (state.farmerProgress >= 1 && i < ready.length) {
			harvestCell(state, ready[i++]);
			state.farmerProgress--;
		}
	}

	if (planters > 0) {
		state.planterProgress = Math.min(
			planters,
			state.planterProgress + (dt * planters) / planterInterval(state.upgrades)
		);
		if (state.planterProgress >= 1) {
			for (const row of state.field) {
				for (const cell of row) {
					if (state.planterProgress < 1) break;
					if (cell.status === 'empty') {
						plantCell(state, cell, now);
						state.planterProgress--;
					}
				}
			}
		}
	}
}

/** Runs the simulation up to `now` in sub-steps of at most `maxStepMs`. */
function advance(state: GameState, now: number) {
	let t = state.lastTick;
	while (t < now) {
		const next = Math.min(now, t + BALANCE.maxStepMs);
		step(state, next, next - t);
		t = next;
	}
	state.lastTick = Math.max(state.lastTick, now);
}

/** Merges a parsed save onto a fresh state so saves from older builds gain new fields. */
function hydrate(saved: Partial<GameState>): GameState {
	const base = createInitialState();
	const state: GameState = {
		...base,
		...saved,
		upgrades: { ...base.upgrades, ...saved.upgrades }
	};
	const { rows, cols } = fieldSize(state.upgrades.expandField);
	state.field = resizeField(state.field ?? [], rows, cols);
	if (!state.unlockedCrops.includes(state.selectedCrop)) state.selectedCrop = 'wheat';
	return state;
}

function createGameStore() {
	const store = writable<GameState>(createInitialState());
	const { subscribe, update, set } = store;

	return {
		subscribe,

		tick: (now = Date.now()) => {
			update((state) => {
				advance(state, now);
				return state;
			});
		},

		plantCrop: (r: number, c: number) => {
			update((state) => {
				const cell = state.field[r]?.[c];
				if (cell?.status === 'empty') plantCell(state, cell, Date.now());
				return state;
			});
		},

		harvestCrop: (r: number, c: number) => {
			update((state) => {
				const cell = state.field[r]?.[c];
				if (!cell) return state;
				// Don't wait for the next tick to notice the crop is ready
				if (cell.status === 'growing' && cell.readyAt !== null && Date.now() >= cell.readyAt) {
					cell.status = 'ready';
				}
				harvestCell(state, cell);
				return state;
			});
		},

		buyUpgrade: (id: UpgradeId) => {
			update((state) => {
				const def = UPGRADES[id];
				const level = state.upgrades[id];
				if (isMaxed(id, level)) return state;
				if (def.requires && state.upgrades[def.requires] < 1) return state;
				const cost = upgradeCost(id, level);
				if (state.money < cost) return state;
				state.money -= cost;
				state.upgrades[id] = level + 1;
				if (id === 'expandField') {
					const { rows, cols } = fieldSize(state.upgrades.expandField);
					state.field = resizeField(state.field, rows, cols);
				}
				return state;
			});
		},

		unlockCrop: (crop: CropId) => {
			update((state) => {
				const cost = CROPS[crop].unlockCost;
				if (state.unlockedCrops.includes(crop) || state.money < cost) return state;
				state.money -= cost;
				state.unlockedCrops.push(crop);
				state.selectedCrop = crop;
				return state;
			});
		},

		selectCrop: (crop: CropId) => {
			update((state) => {
				if (state.unlockedCrops.includes(crop)) state.selectedCrop = crop;
				return state;
			});
		},

		/** Resets the run in exchange for legacy seeds. */
		prestige: () => {
			update((state) => {
				const gain = prestigeGain(state.runEarned);
				if (gain < 1) return state;
				return createInitialState({
					legacySeeds: state.legacySeeds + gain,
					prestigeCount: state.prestigeCount + 1,
					lifetimeEarned: state.lifetimeEarned,
					totalHarvested: state.totalHarvested
				});
			});
		},

		save: () => {
			try {
				localStorage.setItem(SAVE_KEY, JSON.stringify(get(store)));
			} catch {
				// Storage unavailable (private mode, quota): the game still runs, just unsaved
			}
		},

		/** Loads the save and simulates time away. Returns what was earned offline, if anything. */
		load: (): OfflineReport | null => {
			let raw: string | null = null;
			try {
				raw = localStorage.getItem(SAVE_KEY);
			} catch {
				return null;
			}
			if (!raw) return null;

			let saved: Partial<GameState>;
			try {
				saved = JSON.parse(raw);
			} catch {
				return null;
			}
			if (saved.version !== SAVE_VERSION) return null;

			const state = hydrate(saved);
			const now = Date.now();
			const elapsed = now - state.lastTick;
			// Anything beyond the offline cap is simply lost
			state.lastTick = Math.max(state.lastTick, now - BALANCE.maxOfflineMs);
			const before = state.runEarned;
			advance(state, now);
			set(state);
			return { elapsed, earned: state.runEarned - before };
		},

		hardReset: () => {
			try {
				localStorage.removeItem(SAVE_KEY);
			} catch {
				// ignore
			}
			set(createInitialState());
		}
	};
}

export const gameStore = createGameStore();
