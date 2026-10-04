# Architecture

## Stack

- **SvelteKit 2** with **Svelte 5**. The components use legacy Svelte 4 syntax (`on:click`, `<slot />`, manual `store.subscribe`), which Svelte 5 still supports.
- **Tailwind CSS v4**, loaded through `@tailwindcss/vite` and `@import 'tailwindcss'` in `src/app.css`. There is no `tailwind.config.js`.
- **TypeScript** for library code. The game page `<script>` blocks are plain JS.
- **Vite 6**, **yarn** (`yarn.lock`), and `@sveltejs/adapter-auto`.
- There is no backend, database, test suite, or persistence. Everything runs client-side in memory.

## File map

```
src/
├── app.html                  SvelteKit HTML shell
├── app.css                   Tailwind entry point
├── app.d.ts                  SvelteKit ambient types (default)
├── lib/
│   ├── store.ts              Game state and every game action (the whole game logic)
│   └── utils/gameUtils.ts    initializeField(), scaleCost()
└── routes/
    ├── +layout.svelte        Imports app.css; green full-height <main>
    ├── +page.svelte          The game: field grid, shop sidebar, stats, tick intervals
    └── emb/                  Experimental page that loads a third-party embed script
        ├── +layout.svelte       (markspot.app). It has nothing to do with the game.
        └── +page.svelte
static/favicon.png
```

## State: `gameStore`

`src/lib/store.ts` exports a single custom store, `gameStore`, built by `createGameStore()` from a Svelte `writable`.

**State shape (main fields):**

| Group        | Fields                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Economy      | `money`, `totalHarvested`, `yieldMultiplier`, `fertilizerLevel`                                |
| Field        | `field` (2D array of cells), `rows`, `cols`                                                    |
| Growth       | `growthSpeedMultiplier`, `sprinklers`                                                          |
| Farmers      | `farmers`, `lastFarmerHarvest`, `farmerHarvestDelay`, `farmerHarvestTime`                      |
| Seed planter | `seedPlanters`, `lastSeedPlanterAction`, `seedPlanterCooldown`                                 |
| Costs        | `sprinklerCost`, `farmerCost`, `seedPlanterCost`, `yieldCost`, `expandFieldCost`, `fertilizerCost`, `farmerCooldownCost`, `seedPlanterCooldownCost` |
| Meta         | `startTime`                                                                                    |

**Cell shape:**

```ts
{
  id: string;                      // "row-col"
  status: 'empty' | 'growing' | 'ready' | 'harvesting';
  plantedAt: number | null;        // ms timestamp
  readyTime: number | null;        // ms timestamp
  harvestStartedAt: number | null; // ms timestamp, only set by farmers
}
```

None of this is typed in code yet. `field: []` is inferred loosely, and cells are plain object literals.

**Public API:** `subscribe`, `plantCrop(r, c)`, `harvestCrop(r, c)`, `updateGrowth()`, `autoHarvestByFarmers()`, `expandField()`, `upgradeYield()`, `buySprinkler()`, `buyFarmer()`, `buySeedPlanter()`, `upgradeFarmerCooldown()`, `upgradeSeedPlanterCooldown()`, `upgradeFertilizer()`.

### Conventions in the store

- Every action is `update(state => { ...mutate...; return state; })`. Cells and the state object are **mutated in place**, and returning the same object is enough for Svelte to notify subscribers.
- Purchase actions follow one pattern: check `money >= cost`, subtract the cost, apply the effect, then set `cost = scaleCost(cost, factor)`. If the player can't afford it, nothing happens and no error is shown.
- Time is always measured with `Date.now()` and compared against stored timestamps. Nothing counts frames or ticks.
- The growth-time formula appears **twice**: in `plantCrop` and in the seed-planter branch of `autoHarvestByFarmers`. The payout formula also appears **twice**: in `harvestCrop` and in the farmer branch. Keep each pair in sync, or move them into helpers.

## UI: `src/routes/+page.svelte`

- Subscribes to `gameStore` by hand and copies the value into a local `game` variable.
- `onMount` starts the three game-loop intervals (100 ms clock, 1 s growth, 2 s automation; see [game-mechanics.md](game-mechanics.md#game-loop-timers)) and clears them on teardown.
- Layout has two parts:
  - **Left:** a CSS grid with `grid-template-columns: repeat(cols, …)`. Each plot is a clickable card that plants when empty and harvests when ready.
  - **Right:** a sticky 16rem-wide sidebar with the money total and these panels: *Automation Upgrades*, *Automation Cooldowns* (shown only once the player owns automation), *Advanced Upgrades*, *Cooldowns* (live timers), and *Game Stats*.
- Progress bars are computed inline from `currentTime` and cell timestamps.

## Adding a new upgrade

1. Add its level/count field and `xxxCost` field to the initial state in `store.ts`.
2. Add a store action that follows the purchase pattern above.
3. Apply the effect where it matters (the growth formula, the payout formula, or the automation in `autoHarvestByFarmers`). Remember that each formula appears twice.
4. Add a button (and stat, if useful) to `+page.svelte`.
5. Document it in [game-mechanics.md](game-mechanics.md#upgrades).

## Commands

```sh
yarn            # install
yarn dev        # dev server (Vite)
yarn build      # production build
yarn preview    # preview the build
yarn check      # svelte-check type checking
yarn lint       # prettier --check + eslint
yarn format     # prettier --write
```

Prettier settings: tabs, single quotes, no trailing commas, print width 100. Most existing source files use 2-space indentation and haven't been formatted with Prettier yet.
