# Architecture

## Stack

- **SvelteKit 2** with **Svelte 5**. Components use legacy Svelte 4 syntax: `on:click`, `<slot />`, `export let`, `$:` and `$store` auto-subscriptions. There are no runes.
- **Tailwind CSS v4**, loaded through `@tailwindcss/vite` and `@import 'tailwindcss'` in `src/app.css`. There is no `tailwind.config.js`.
- **TypeScript** everywhere, with strict types for all game state.
- **Vite 6**, **yarn** (`yarn.lock`), and `@sveltejs/adapter-auto`.
- Everything runs client-side. There is no backend and no test suite. Persistence uses `localStorage`.

## File map

```
src/
├── app.html, app.css, app.d.ts     SvelteKit shell, Tailwind entry, ambient types
├── lib/
│   ├── types.ts                    GameState, Cell, CropId, UpgradeId, OfflineReport
│   ├── data/
│   │   ├── balance.ts              Global tunables (worker speed, multipliers, prestige, timings)
│   │   ├── crops.ts                CROPS definitions + CROP_ORDER
│   │   └── upgrades.ts             UPGRADES definitions (cost, growth, max, category) + UPGRADE_ORDER
│   ├── utils/gameUtils.ts          Every formula (one copy each), field helpers, number formatting
│   ├── store.ts                    gameStore: state, simulation step, actions, save/load
│   └── components/
│       └── UpgradeButton.svelte    Generic upgrade row (button + description + effect)
└── routes/
    ├── +layout.svelte              Imports app.css; green full-height <main>
    ├── +page.ts                    ssr = false (state comes from localStorage)
    ├── +page.svelte                Game UI: field grid, sidebar, game loop, autosave
    └── emb/                        Experimental third-party embed page (markspot.app), not part of the game
scripts/
├── balance-sim.ts                  Headless balance sim against the real store (`yarn sim`)
└── run-sim.mjs                     Bundles the sim with esbuild ($lib alias) and runs it
```

## Data flow

```
data/*.ts ──▶ utils/gameUtils.ts (formulas) ──▶ store.ts (state + actions) ──▶ +page.svelte (render + loop)
```

- `data/` holds plain definitions with no logic.
- `gameUtils.ts` holds pure functions of state: `growTime`, `harvestValue`, `valueMultiplier`, `farmerInterval`, `planterInterval`, `upgradeCost`, `isMaxed`, `prestigeGain`, `prestigeThreshold`, `fieldSize`, `resizeField`, `describeEffect`, and the `format*` helpers. **This is the only place formulas live.** The store and the UI both import them.
- `store.ts` is the only code that mutates state.

## `gameStore` API

| Method                              | Purpose                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `subscribe`                         | Svelte store contract                                                                                                               |
| `tick(now?)`                        | Advance the simulation to `now`, in sub-steps of at most `maxStepMs`                                                                |
| `plantCrop(r, c)`                   | Plant the selected seed if the plot is empty                                                                                        |
| `harvestCrop(r, c)`                 | Harvest if the plot is ready (or its timer has passed)                                                                              |
| `buyUpgrade(id)`                    | Generic purchase. Checks max level, `requires`, and cost. Resizes the field for `expandField`                                       |
| `unlockCrop(id)`                    | Pay the unlock cost and select the crop                                                                                             |
| `selectCrop(id)`                    | Change the seed used for planting                                                                                                   |
| `prestige()`                        | Reset the run for legacy seeds (does nothing if the gain is below 1)                                                                |
| `save()` / `load()`                 | Write or read `localStorage`. `load()` simulates offline time and returns an `OfflineReport`                                        |
| `exportSave()` / `importSave(text)` | Base64 save string for moving between browsers. Import validates through `parseSave()` and returns `false` if the string is invalid |
| `onHarvest(listener)`               | Get notified of every harvest (`{ cellId, value, auto }`), for UI feedback. Returns an unsubscribe function                         |
| `hardReset()`                       | Delete the save and start fresh                                                                                                     |

### Conventions in the store

- Actions are `update(state => { ...mutate...; return state; })`. State is **mutated in place**, and returning the same object still notifies subscribers.
- Purchases fail silently when they aren't allowed. The UI disables those buttons anyway.
- All timing uses absolute `Date.now()` timestamps (`plantedAt`, `readyAt`, `lastTick`, `runStartedAt`). Nothing counts ticks. That's what makes catching up after a throttled tab or offline time a plain loop over `step()`.
- `createInitialState(carry)` builds a fresh run. `carry` holds the fields that survive prestige.
- `hydrate()` merges a loaded save onto a fresh state, so new fields get defaults. **Bump `SAVE_VERSION`** only for breaking changes to the state shape; doing so throws away existing saves.

## UI (`src/routes/+page.svelte`)

- Reads `$gameStore` reactively. `now` is `game.lastTick`, so progress bars move with the 100 ms tick.
- `onMount` loads the save (and shows the offline banner), starts the tick, an income sampler that tracks a rolling 10 s average, and autosave. It also saves on `visibilitychange` and `beforeunload`.
- Layout:
  - **Left:** the plot grid, at most `max-w-3xl` wide with square cells.
  - **Right:** a sticky sidebar with money and income/s, then _Seeds_, _Workers_, _Growth & Value_, _Field_, _🌟 Legacy_ (once it's relevant), and _Stats_ (which includes Export / import and Reset save).
- Upgrade sections are generated from `UPGRADE_ORDER` filtered by `category`. A new upgrade appears automatically in the matching section.

## Adding things

**A new upgrade**

1. Add its id to `UpgradeId` in `types.ts` and its default level to `createInitialState()` in `store.ts`.
2. Add its definition to `UPGRADES` and `UPGRADE_ORDER` in `data/upgrades.ts`.
3. Apply its effect inside the relevant formula in `gameUtils.ts`.
4. Add a `case` to `describeEffect()`. TypeScript will complain until you do.
5. Run `yarn sim` and update `docs/game-mechanics.md`.

**A new crop:** add it to `CropId`, `CROPS` and `CROP_ORDER`. The UI and planters pick it up automatically.

Old saves load fine after either change, because `hydrate()` fills in defaults.

## Commands

```sh
yarn            # install
yarn dev        # dev server (Vite)
yarn build      # production build
yarn check      # svelte-check type checking
yarn lint       # prettier --check + eslint
yarn format     # prettier --write
yarn sim        # balance simulation (add "active" for the clicks-only player)
```

Prettier settings: tabs, single quotes, no trailing commas, print width 100.
