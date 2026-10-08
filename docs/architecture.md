# Architecture

## Stack

- **SvelteKit 2** with **Svelte 5**. Components use legacy Svelte 4 syntax: `on:click`, `<slot />`, `export let`, `$:` and `$store` auto-subscriptions. There are no runes.
- **Tailwind CSS v4**, loaded through `@tailwindcss/vite` and `@import 'tailwindcss'` in `src/app.css`. There is no `tailwind.config.js`.
- **TypeScript** everywhere, with strict types for all game state.
- **Vite 6**, **yarn** (`yarn.lock`), and `@sveltejs/adapter-auto`.
- Everything runs client-side, with no backend. Persistence uses `localStorage`. Unit tests use **Vitest** (`src/lib/**/*.test.ts`). A single Vite version is pinned through `resolutions` so `vitest/config` types match.

## File map

```
src/
├── app.html, app.css, app.d.ts     SvelteKit shell, Tailwind entry + palette tokens + animations, ambient types
├── lib/
│   ├── types.ts                    GameState, Cell, CropId, UpgradeId, OfflineReport
│   ├── data/
│   │   ├── balance.ts              Global tunables (worker speed, multipliers, prestige, timings)
│   │   ├── crops.ts                CROPS definitions + CROP_ORDER
│   │   └── upgrades.ts             UPGRADES definitions (cost, growth, max, category) + UPGRADE_ORDER
│   ├── utils/gameUtils.ts          Every formula (one copy each), field helpers, number formatting
│   ├── store.ts                    gameStore: state, simulation step, actions, save/load
│   ├── art/                        SVG sprites (svg/<family>/*.svg), sprite sheet, Art.svelte, ids (see docs/art-style.md)
│   ├── fx/
│   │   ├── fx.ts                   Particles (burst, pluck, flyCoins), moneyTarget action, coinCount
│   │   ├── FxLayer.svelte          Fixed overlay the particles are drawn in
│   │   └── replay.ts               Action that replays a one-shot animation when a key changes
│   └── components/
│       ├── BuyButton.svelte        Purchase row for upgrades and crop unlocks (affordability fill, MAX)
│       ├── Dialog.svelte           Modal on native <dialog> (confirmations, welcome back)
│       ├── MoneyDisplay.svelte     Money (counts up) + income/s, bumps when harvest coins land
│       ├── Panel.svelte            Parchment card with a wood header strip
│       └── Plot.svelte             One field plot: soil tile, growth-stage sprite, ready glow, harvest pops
└── routes/
    ├── +layout.svelte              Imports app.css, sets <title>, mounts the sprite sheet and FX layer
    ├── art/                        Dev-only sprite contact sheet (/art)
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
- `onMount` loads the save (and opens the welcome-back dialog), starts the tick, an income sampler that tracks a rolling 10 s average, and autosave. It also saves on `visibilitychange` and `beforeunload`.
- Layout, desktop (`lg` and up):
  - **Left:** the plot grid, at most `max-w-3xl` wide with square cells.
  - A wood header with the title.
  - **Left:** the plot grid inside a fence (`fence-frame.svg` as a 9-slice `border-image`), at most `max-w-3xl` wide with square cells. Until the first harvest, a hint above it explains planting and harvesting.
  - **Right:** a sticky sidebar that scrolls on its own, with money and income/s, then _Seeds_, _Workers_, _Growth & Value_, _Field_, _🌟 Legacy_ (once it's relevant), and _Stats_ (which includes a _Save_ section with Export / import and Reset save).
- Layout, mobile (below `lg`):
  - A sticky header with the title and money on top, and the field at full width. An 8×8 field fits a 375px screen at about 41px per plot. Text labels are hidden below `sm`, leaving icons and progress bars.
  - A fixed bottom tab bar (Seeds / Upgrades / Legacy / Stats). Tapping a tab slides that panel up in a bottom sheet (`max-h-[50vh]`) so the field stays visible. Tapping the tab again, the ✕, or Escape closes it. A gold dot on a tab means something in it is affordable. Bottom bars pad for `env(safe-area-inset-bottom)`.
  - Panels are rendered once. `panelVisibility(tab, sheetTab)` hides them on mobile unless their tab is in the sheet, and `lg:block` always shows them on desktop. `sheetTab` keeps the last tab rendered while the sheet slides closed.
- Upgrade sections are generated from `UPGRADE_ORDER` filtered by `category`. A new upgrade appears automatically in the matching section.
- Selling the farm, resetting and importing confirm through `Dialog` (one `confirming` state), never `confirm()`.

### Visual style

- Cozy farm look with hand-drawn SVG sprites for every icon (`<Art id=…>`, see `docs/art-style.md`), never emoji. Upgrade sprites come from `UPGRADE_ART`, crop sprites from `cropArt(crop, stage)`. Colours are `@theme` tokens in `src/app.css`: `soil` (plots), `leaf` (affordable actions), `parchment` (panels), `wood` (headers, borders, bars), `gold` (money, ready crops, selection, Legacy) and `berry` (danger). Use the tokens, not raw Tailwind hues, so a dark theme only has to redefine them.
- `font-display` (Fredoka, self-hosted through fontsource) for titles and big numbers. Numbers that change use `tabular-nums`.
- Custom utility `bg-meadow` (page background). Plots use the `soil-dry` / `soil-wet` tile sprites and the field sits in `fence-frame` as a 9-slice `border-image`.
- Purchases use `BuyButton`: leaf green when affordable, a gold fill toward the cost when not, a MAX badge when maxed.
- Per-crop colour comes from `CropDef.tint`.

### Interactions

Player actions get juicy feedback; worker actions stay quiet so an automated field doesn't turn into noise.

| Where                  | What happens                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plot                   | Squashes on press, lifts on hover. Seeds drop in, crops pop at each new stage, ripe crops sway with a staggered glint.                                                                 |
| Player plant / harvest | Dirt burst / the crop plucks out and 1–5 coins (`coinCount`) fly to the money counter, which bumps as they land and counts up. Farmer and planter actions only get the small text pop. |
| BuyButton              | Shine and icon pop on every purchase, a shine when it becomes affordable.                                                                                                              |
| Seeds                  | The check pops on select; unlocking bursts sparkles and petals and pops in the new card.                                                                                               |
| Field                  | Plots added by Expand Field grow in, staggered (not on load).                                                                                                                          |
| Tabs, hint             | Tab icon pops when opened; the hint's pointer bobs.                                                                                                                                    |
| Welcome back           | The earned amount counts up; Collect sends coins to the counter.                                                                                                                       |
| Prestige               | A golden sunrise covers the field with a legacy-seed burst; the run resets at peak opacity.                                                                                            |

How it's built:

- **One-shot CSS animations** live in `@theme` (`animate-pop`, `-plant`, `-bump`, `-shine`…) behind `motion-safe:`. To replay one when something changes, use `use:replay={{ key, cls, when? }}` from `src/lib/fx/replay.ts`. It never plays on mount.
- **Particles** go through `src/lib/fx/fx.ts`: `burst(point, { art, count, spread, size, arc? })`, `pluck(rect, art)` and `flyCoins(point, count)` (resolves when the first coin lands). They are sprites animated with the Web Animations API in the fixed `FxLayer`, capped at `MAX_PARTICLES`. Coins fly to the visible element marked with `use:moneyTarget`.
- **Reduced motion:** particles are no-ops, `flyCoins` resolves right away, tweens have zero duration, and all CSS animations are `motion-safe:` only. Every state change stays visible without motion.

## Adding things

**A new upgrade**

1. Add its id to `UpgradeId` in `types.ts` and its default level to `createInitialState()` in `store.ts`.
2. Add its definition to `UPGRADES` and `UPGRADE_ORDER` in `data/upgrades.ts`.
3. Apply its effect inside the relevant formula in `gameUtils.ts`.
4. Add a `case` to `describeEffect()`. TypeScript will complain until you do.
5. Run `yarn sim` and update `docs/game-mechanics.md`.

**A new crop:** add it to `CropId`, `CROPS` and `CROP_ORDER`, and draw its sprout, young and mature sprites (see `docs/art-style.md`). The UI and planters pick it up automatically.

Old saves load fine after either change, because `hydrate()` fills in defaults.

## Commands

```sh
yarn            # install
yarn dev        # dev server (Vite)
yarn build      # production build
yarn check      # svelte-check type checking
yarn lint       # prettier --check + eslint
yarn format     # prettier --write
yarn test       # unit tests (Vitest, src/**/*.test.ts)
yarn sim        # balance simulation (add "active" for the clicks-only player)
```

**CI** (`.github/workflows/ci.yml`) runs `check`, `lint`, `test` and `build` on every push to `main` and on every PR, and posts both `yarn sim` runs to the job summary so balance changes are visible in review.

Prettier settings: tabs, single quotes, no trailing commas, print width 100.
