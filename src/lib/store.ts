import { get, writable } from 'svelte/store';
import { BALANCE } from '$lib/data/balance';
import { CROPS } from '$lib/data/crops';
import { MUTATIONS } from '$lib/data/mutations';
import type { Cell, CropId, GameState, HarvestEvent, OfflineReport, UpgradeId } from '$lib/types';
import {
	farmerInterval,
	fieldSize,
	growTime,
	harvestValue,
	isMaxed,
	isUpgradeVisible,
	planterInterval,
	ALL_DISCOVERIES,
	discoveryKey,
	prestigeGain,
	resizeField,
	rollMutation,
	upgradeCost
} from '$lib/utils/gameUtils';

const SAVE_KEY = 'harvest-idle-save';
const SAVE_VERSION = 1;

// Harvest notifications for UI feedback. Not part of the saved state.
const harvestListeners = new Set<(event: HarvestEvent) => void>();

/** Fresh run. `carry` holds the fields that survive a prestige reset. */
function createInitialState(
	carry?: Pick<
		GameState,
		'legacySeeds' | 'prestigeCount' | 'lifetimeEarned' | 'totalHarvested' | 'discoveries'
	>
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
			expandField: 0,
			luckyClover: 0,
			prizeRibbons: 0,
			rainbowSeeds: 0
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
		totalHarvested: carry?.totalHarvested ?? 0,
		discoveries: carry?.discoveries ?? []
	};
}

// ---------- Cell helpers (mutate state in place) ----------

function plantCell(state: GameState, cell: Cell, now: number) {
	cell.status = 'growing';
	cell.crop = state.selectedCrop;
	cell.plantedAt = now;
	cell.readyAt = now + growTime(state.selectedCrop, state.upgrades);
	cell.mutation = rollMutation(state.upgrades, Math.random());
}

function harvestCell(state: GameState, cell: Cell, auto: boolean) {
	if (cell.status !== 'ready' || !cell.crop) return;
	const { mutation } = cell;
	const value = harvestValue(cell.crop, state, mutation);
	state.money += value;
	state.runEarned += value;
	state.lifetimeEarned += value;
	state.totalHarvested++;
	// The first harvest of each crop × mutation pair goes in the Almanac
	const key = mutation && discoveryKey(cell.crop, mutation);
	const discovery = !!key && !state.discoveries.includes(key);
	if (key && discovery) state.discoveries.push(key);
	for (const listener of harvestListeners) {
		listener({ cellId: cell.id, crop: cell.crop, value, auto, mutation, discovery });
	}
	cell.status = 'empty';
	cell.crop = null;
	cell.plantedAt = null;
	cell.readyAt = null;
	cell.mutation = null;
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
			harvestCell(state, ready[i++], true);
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
	// Cells from before mutations (or with an unknown one) are ordinary crops
	for (const cell of state.field.flat()) {
		if (!cell.mutation || !(cell.mutation in MUTATIONS)) cell.mutation = null;
	}
	if (!state.unlockedCrops.includes(state.selectedCrop)) state.selectedCrop = 'wheat';
	// Known entries only, once each, in the order found
	const found = Array.isArray(state.discoveries) ? state.discoveries : [];
	state.discoveries = [...new Set(found)].filter((d) => ALL_DISCOVERIES.includes(d));
	return state;
}

/** Parses and validates a JSON save. Returns null for anything that isn't a usable save. */
function parseSave(raw: string): GameState | null {
	let saved: Partial<GameState>;
	try {
		saved = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof saved !== 'object' || saved === null || saved.version !== SAVE_VERSION) return null;
	const validShape =
		Number.isFinite(saved.money) &&
		Number.isFinite(saved.lastTick) &&
		Array.isArray(saved.field) &&
		Array.isArray(saved.unlockedCrops) &&
		typeof saved.upgrades === 'object' &&
		saved.upgrades !== null;
	return validShape ? hydrate(saved) : null;
}

// UTF-8 safe base64, so exported saves survive copy/paste anywhere
function encodeSave(json: string): string {
	let binary = '';
	for (const byte of new TextEncoder().encode(json)) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function decodeSave(text: string): string {
	const binary = atob(text);
	return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
}

function createGameStore() {
	const store = writable<GameState>(createInitialState());
	const { subscribe, update, set } = store;

	return {
		subscribe,

		/** Calls `listener` on every harvest. Returns an unsubscribe function. */
		onHarvest: (listener: (event: HarvestEvent) => void) => {
			harvestListeners.add(listener);
			return () => {
				harvestListeners.delete(listener);
			};
		},

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
				harvestCell(state, cell, false);
				return state;
			});
		},

		buyUpgrade: (id: UpgradeId) => {
			update((state) => {
				const level = state.upgrades[id];
				if (isMaxed(id, level)) return state;
				if (!isUpgradeVisible(id, state)) return state;
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
					totalHarvested: state.totalHarvested,
					discoveries: state.discoveries
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
			const state = raw ? parseSave(raw) : null;
			if (!state) return null;

			const now = Date.now();
			const elapsed = now - state.lastTick;
			// Anything beyond the offline cap is simply lost
			state.lastTick = Math.max(state.lastTick, now - BALANCE.maxOfflineMs);
			const before = state.runEarned;
			advance(state, now);
			set(state);
			return { elapsed, earned: state.runEarned - before };
		},

		/** Current state as a portable string for copying to another browser. */
		exportSave: (): string => encodeSave(JSON.stringify(get(store))),

		/**
		 * Replaces the game with an exported save. Returns false (leaving the game untouched)
		 * if the text isn't a valid save. Imported saves don't earn offline progress.
		 */
		importSave: (text: string): boolean => {
			let json: string;
			try {
				json = decodeSave(text.trim());
			} catch {
				return false;
			}
			const state = parseSave(json);
			if (!state) return false;
			state.lastTick = Date.now();
			set(state);
			return true;
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
