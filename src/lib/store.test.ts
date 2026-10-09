import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { BALANCE } from '$lib/data/balance';
import { CROPS } from '$lib/data/crops';
import { gameStore } from '$lib/store';
import { MUTATIONS } from '$lib/data/mutations';
import type { GameState, HarvestEvent } from '$lib/types';
import { upgradeCost } from '$lib/utils/gameUtils';

const SAVE_KEY = 'harvest-idle-save';
const T0 = 1_700_000_000_000;
let storage: Record<string, string>;

/** The store mutates state in place, so tests can set up scenarios directly. */
const state = (): GameState => get(gameStore);

function setNow(ms: number) {
	vi.setSystemTime(ms);
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	setNow(T0);
	storage = {};
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => storage[k] ?? null,
		setItem: (k: string, v: string) => {
			storage[k] = v;
		},
		removeItem: (k: string) => {
			delete storage[k];
		}
	});
	// No mutations unless a test asks for one
	vi.spyOn(Math, 'random').mockReturnValue(0.999);
	gameStore.hardReset();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('manual play', () => {
	it('plants the selected crop and harvests it once grown', () => {
		gameStore.plantCrop(0, 0);
		expect(state().field[0][0]).toMatchObject({ status: 'growing', crop: 'wheat' });

		// Too early: nothing happens
		gameStore.harvestCrop(0, 0);
		expect(state().money).toBe(0);

		// Ready but before any tick: harvest still works
		setNow(T0 + CROPS.wheat.growTime);
		gameStore.harvestCrop(0, 0);
		expect(state().money).toBe(10);
		expect(state().field[0][0].status).toBe('empty');
		expect(state().runEarned).toBe(10);
		expect(state().totalHarvested).toBe(1);
	});

	it('marks crops ready on tick', () => {
		gameStore.plantCrop(1, 2);
		gameStore.tick(T0 + CROPS.wheat.growTime);
		expect(state().field[1][2].status).toBe('ready');
	});
});

describe('workers', () => {
	it('a farmer harvests one plot per interval', () => {
		const s = state();
		s.upgrades.farmer = 1;
		for (let c = 0; c < 3; c++) gameStore.plantCrop(0, c);
		// Crops ready at 3s, farmer has banked one action by 3s
		gameStore.tick(T0 + 3000);
		expect(state().totalHarvested).toBe(1);
		gameStore.tick(T0 + 6000);
		expect(state().totalHarvested).toBe(2);
	});

	it('idle workers bank at most one action each', () => {
		const s = state();
		s.upgrades.farmer = 2;
		// Nothing to harvest for a long time
		gameStore.tick(T0 + 60_000);
		expect(state().farmerProgress).toBe(2);
	});

	it('seed planters fill empty plots with the selected crop', () => {
		const s = state();
		s.upgrades.seedPlanter = 3;
		gameStore.tick(T0 + 3000);
		const planted = state()
			.field.flat()
			.filter((cell) => cell.status === 'growing');
		expect(planted).toHaveLength(3);
		expect(planted.every((cell) => cell.crop === 'wheat')).toBe(true);
	});
});

describe('onHarvest', () => {
	it('reports manual and farmer harvests until unsubscribed', () => {
		const events: unknown[] = [];
		const stop = gameStore.onHarvest((e) => events.push(e));
		gameStore.plantCrop(0, 0);
		gameStore.plantCrop(0, 1);
		setNow(T0 + 3000);
		gameStore.harvestCrop(0, 0);
		state().upgrades.farmer = 1;
		state().farmerProgress = 1;
		gameStore.tick(T0 + 3000);
		expect(events).toEqual([
			{ cellId: '0-0', crop: 'wheat', value: 10, auto: false, mutation: null, discovery: false },
			{ cellId: '0-1', crop: 'wheat', value: 10, auto: true, mutation: null, discovery: false }
		]);

		stop();
		gameStore.plantCrop(0, 0);
		setNow(T0 + 6000);
		gameStore.harvestCrop(0, 0);
		expect(events).toHaveLength(2);
	});
});

describe('mutations', () => {
	it('are rolled at planting and multiply the harvest', () => {
		vi.mocked(Math.random).mockReturnValue(0); // rarest mutation
		gameStore.plantCrop(0, 0);
		expect(state().field[0][0].mutation).toBe('golden');

		const events: HarvestEvent[] = [];
		const stop = gameStore.onHarvest((e) => events.push(e));
		setNow(T0 + CROPS.wheat.growTime);
		gameStore.harvestCrop(0, 0);
		stop();
		expect(state().money).toBe(10 * MUTATIONS.golden.multiplier);
		expect(events[0].mutation).toBe('golden');
		expect(state().field[0][0].mutation).toBeNull();
	});

	it('apply to seed planter plantings too', () => {
		vi.mocked(Math.random).mockReturnValue(0);
		state().upgrades.seedPlanter = 1;
		gameStore.tick(T0 + 3000);
		expect(state().field[0][0]).toMatchObject({ status: 'growing', mutation: 'golden' });
	});

	it('can be Rainbow once Rainbow Seeds is bought', () => {
		vi.mocked(Math.random).mockReturnValue(0);
		state().upgrades.rainbowSeeds = 1;
		gameStore.plantCrop(0, 0);
		expect(state().field[0][0].mutation).toBe('rainbow');
	});

	it('records each crop × mutation pair in the Almanac on its first harvest', () => {
		vi.mocked(Math.random).mockReturnValue(0);
		const events: HarvestEvent[] = [];
		const stop = gameStore.onHarvest((e) => events.push(e));
		gameStore.plantCrop(0, 0);
		gameStore.plantCrop(0, 1);
		setNow(T0 + CROPS.wheat.growTime);
		gameStore.harvestCrop(0, 0);
		gameStore.harvestCrop(0, 1);
		stop();
		expect(events.map((e) => e.discovery)).toEqual([true, false]);
		expect(state().discoveries).toEqual(['wheat:golden']);
		// The first harvest is paid before its own discovery bonus applies
		expect(events[0].value).toBe(100);
		expect(events[1].value).toBe(103);
	});

	it('keeps the Almanac when the farm is sold, but not on a hard reset', () => {
		state().discoveries.push('carrot:giant');
		state().runEarned = 1e9;
		gameStore.prestige();
		expect(state().discoveries).toEqual(['carrot:giant']);
		gameStore.hardReset();
		expect(state().discoveries).toEqual([]);
	});

	it('loads only known Almanac entries, once each', () => {
		const saved = JSON.parse(JSON.stringify(state()));
		saved.discoveries = ['carrot:giant', 'wheat:cursed', 'carrot:giant', 'wheat:golden'];
		storage[SAVE_KEY] = JSON.stringify(saved);
		gameStore.load();
		expect(state().discoveries).toEqual(['carrot:giant', 'wheat:golden']);
	});

	it('loads old cells without a mutation, and drops unknown ones', () => {
		gameStore.plantCrop(0, 0);
		const saved = JSON.parse(JSON.stringify(state()));
		delete saved.field[0][0].mutation;
		saved.field[0][1].mutation = 'cursed';
		storage[SAVE_KEY] = JSON.stringify(saved);
		gameStore.load();
		expect(state().field[0][0]).toMatchObject({ status: 'growing', mutation: null });
		expect(state().field[0][1].mutation).toBeNull();
	});
});

describe('buyUpgrade', () => {
	it('charges the cost and raises the level', () => {
		state().money = 1000;
		gameStore.buyUpgrade('farmer');
		expect(state().upgrades.farmer).toBe(1);
		expect(state().money).toBe(1000 - upgradeCost('farmer', 0));
	});

	it('does nothing when unaffordable', () => {
		state().money = 99;
		gameStore.buyUpgrade('farmer');
		expect(state().upgrades.farmer).toBe(0);
		expect(state().money).toBe(99);
	});

	it('never charges for a maxed upgrade', () => {
		const s = state();
		s.upgrades.sprinkler = 15;
		s.money = 1e12;
		gameStore.buyUpgrade('sprinkler');
		expect(state().upgrades.sprinkler).toBe(15);
		expect(state().money).toBe(1e12);
	});

	it('requires the crop a mutation upgrade waits for', () => {
		state().money = 1e9;
		gameStore.buyUpgrade('luckyClover');
		expect(state().upgrades.luckyClover).toBe(0);
		state().unlockedCrops.push('pumpkin');
		gameStore.buyUpgrade('luckyClover');
		expect(state().upgrades.luckyClover).toBe(1);
	});

	it('requires the prerequisite upgrade', () => {
		state().money = 1e6;
		gameStore.buyUpgrade('farmerTraining');
		expect(state().upgrades.farmerTraining).toBe(0);
		gameStore.buyUpgrade('farmer');
		gameStore.buyUpgrade('farmerTraining');
		expect(state().upgrades.farmerTraining).toBe(1);
	});

	it('expanding the field keeps existing plots', () => {
		state().money = 1e6;
		gameStore.plantCrop(2, 2);
		gameStore.buyUpgrade('expandField');
		expect(state().field).toHaveLength(3);
		expect(state().field[0]).toHaveLength(4);
		expect(state().field[2][2].status).toBe('growing');
	});
});

describe('crops', () => {
	it('unlocking a crop charges, unlocks and selects it', () => {
		state().money = 600;
		gameStore.unlockCrop('carrot');
		expect(state().unlockedCrops).toContain('carrot');
		expect(state().selectedCrop).toBe('carrot');
		expect(state().money).toBe(100);
	});

	it('cannot select a locked crop', () => {
		gameStore.selectCrop('sunflower');
		expect(state().selectedCrop).toBe('wheat');
	});
});

describe('prestige', () => {
	it('does nothing below one seed', () => {
		state().runEarned = BALANCE.prestigeDivisor - 1;
		state().money = 500;
		gameStore.prestige();
		expect(state().money).toBe(500);
	});

	it('resets the run and carries legacy fields over', () => {
		const s = state();
		s.runEarned = BALANCE.prestigeDivisor * 4;
		s.lifetimeEarned = s.runEarned;
		s.totalHarvested = 1234;
		s.legacySeeds = 1;
		s.money = 5000;
		s.upgrades.farmer = 10;
		s.unlockedCrops.push('carrot');

		gameStore.prestige();
		const next = state();
		expect(next.legacySeeds).toBe(3);
		expect(next.prestigeCount).toBe(1);
		expect(next.lifetimeEarned).toBe(BALANCE.prestigeDivisor * 4);
		expect(next.totalHarvested).toBe(1234);
		expect(next.money).toBe(0);
		expect(next.runEarned).toBe(0);
		expect(next.upgrades.farmer).toBe(0);
		expect(next.unlockedCrops).toEqual(['wheat']);
	});
});

describe('save / load', () => {
	it('restores a saved game', () => {
		state().money = 4242;
		gameStore.plantCrop(0, 0);
		gameStore.save();
		const raw = storage[SAVE_KEY];
		gameStore.hardReset();
		storage[SAVE_KEY] = raw;

		gameStore.load();
		expect(state().money).toBe(4242);
		expect(state().field[0][0].status).toBe('growing');
	});

	it('ignores corrupt JSON and other versions', () => {
		state().money = 7;
		storage[SAVE_KEY] = '{not json';
		expect(gameStore.load()).toBeNull();
		storage[SAVE_KEY] = JSON.stringify({ version: 999, money: 1e9 });
		expect(gameStore.load()).toBeNull();
		expect(state().money).toBe(7);
	});

	it('fills in fields missing from older saves', () => {
		const old: Partial<GameState> = { ...state(), upgrades: { farmer: 2 } as never, money: 50 };
		delete old.legacySeeds;
		storage[SAVE_KEY] = JSON.stringify(old);
		gameStore.load();
		expect(state().money).toBe(50);
		expect(state().legacySeeds).toBe(0);
		expect(state().upgrades).toMatchObject({ farmer: 2, sprinkler: 0, expandField: 0 });
	});

	it('simulates offline time, capped at maxOfflineMs', () => {
		const s = state();
		s.upgrades.farmer = 1;
		s.upgrades.seedPlanter = 1;
		gameStore.save();

		setNow(T0 + BALANCE.maxOfflineMs * 2);
		const report = gameStore.load();
		expect(report?.elapsed).toBe(BALANCE.maxOfflineMs * 2);
		// One planter + one farmer at 3s each on wheat: about one harvest every 3s
		const expected = (BALANCE.maxOfflineMs / 3000) * 10;
		expect(report?.earned).toBeGreaterThan(expected * 0.9);
		expect(report?.earned).toBeLessThanOrEqual(expected);
		expect(state().lastTick).toBe(T0 + BALANCE.maxOfflineMs * 2);
	});

	it('rejects saves with the right version but a broken shape', () => {
		storage[SAVE_KEY] = JSON.stringify({ version: 1, money: 'lots', field: [] });
		expect(gameStore.load()).toBeNull();
	});
});

describe('export / import', () => {
	it('round-trips through an exported string', () => {
		state().money = 1234;
		state().legacySeeds = 2;
		gameStore.plantCrop(0, 0);
		const text = gameStore.exportSave();
		expect(text).toMatch(/^[A-Za-z0-9+/=]+$/);

		gameStore.hardReset();
		setNow(T0 + 3600_000);
		expect(
			gameStore.importSave(`  ${text}
`)
		).toBe(true);
		expect(state().money).toBe(1234);
		expect(state().legacySeeds).toBe(2);
		// No offline progress for imports: the clock restarts now
		expect(state().lastTick).toBe(T0 + 3600_000);
	});

	it('rejects garbage and leaves the game untouched', () => {
		state().money = 99;
		for (const bad of ['', 'not base64!!', btoa('{"version":1}'), btoa('[1,2,3]'), btoa('null')]) {
			expect(gameStore.importSave(bad)).toBe(false);
		}
		expect(state().money).toBe(99);
	});
});
