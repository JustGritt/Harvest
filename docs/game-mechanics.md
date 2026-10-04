# Game Mechanics

Harvest is an incremental farming game. The player plants crops on a grid, harvests them for money, and spends the money on workers and upgrades. Selling the farm (prestige) restarts the run in exchange for a permanent income bonus.

**Design intent:** clicking is the main income for the first couple of minutes. After a few worker purchases, automation clearly takes over and the game becomes idle.

Every number lives in `src/lib/data/` (`balance.ts`, `crops.ts`, `upgrades.ts`), and every formula has exactly one copy in `src/lib/utils/gameUtils.ts`. If you change something there, update this file and rerun `yarn sim` (see [Balance simulation](#balance-simulation)).

## The field

- The field starts as a **3 × 3** grid.
- **Expand Field** alternates between adding a column and adding a row: 3×3 → 4×3 → 4×4 → … → **8×8** after 10 levels.
- Each plot cycles through three states:

```
 empty ──plant (click or seed planter)──▶ growing ──(readyAt reached)──▶ ready
   ▲                                                                       │
   └───────────────────── harvest (click or farmer) ◀─────────────────────┘
```

Clicking an empty plot plants the **selected seed**. Clicking a ready plot harvests it; so does clicking a growing plot whose `readyAt` has already passed, without waiting for the next tick. Clicking a plot that is still growing does nothing.

## Crops

| Crop         | Grow time | Base value | Value / plot-second | Unlock cost |
| ------------ | --------: | ---------: | ------------------: | ----------: |
| 🌾 Wheat     |        3s |         10 |                3.33 |        free |
| 🥕 Carrot    |       10s |         40 |                4.00 |         500 |
| 🎃 Pumpkin   |       30s |        150 |                5.00 |       5,000 |
| 🌻 Sunflower |       60s |        360 |                6.00 |     250,000 |

Crops form a ladder. Each slower crop earns a little more per plot-second and much more per harvest. That means it needs far fewer actions (clicks, or worker actions) to produce the same income, which matters most when workers are scarce. The trade-off is waiting: slow crops keep plots occupied for longer.

There is one selected seed for the whole farm. Manual planting and seed planters both use it. Unlocking a crop selects it automatically.

## Formulas

```
growTime     = crop.growTime × 0.92^sprinkler
harvestValue = round(crop.value × (1 + 0.2 × qualitySeeds) × 1.1^fertilizer × (1 + 0.1 × legacySeeds))
workerInterval (ms per action, per worker) = 3000 × 0.88^trainingLevel
upgradeCost  = floor(baseCost × costGrowth^level)
legacySeedsFromSale = floor(sqrt(runEarned / 1,000,000))
```

Money is always a whole number, because each harvest value is rounded.

## Upgrades

| Upgrade            | Base cost | Growth | Max | Effect                                                 |
| ------------------ | --------: | -----: | --: | ------------------------------------------------------ |
| 🧑‍🌾 Farmer          |       100 |  ×1.25 |   — | +1 worker that harvests ready plots                    |
| 🌱 Seed Planter    |        75 |  ×1.25 |   — | +1 worker that plants the selected seed in empty plots |
| 📘 Farmer Training |       200 |   ×1.7 |  15 | Farmer interval ×0.88 (3.0s → 0.44s at max)            |
| ⚙️ Planter Gears   |       150 |   ×1.7 |  15 | Seed planter interval ×0.88                            |
| 💧 Sprinkler       |       150 |   ×1.7 |  15 | Grow time ×0.92 (−71% at max)                          |
| ✨ Quality Seeds   |       100 |   ×1.4 |   — | +20% harvest value (additive)                          |
| 🧪 Fertilizer      |     1,000 |   ×1.6 |   — | ×1.1 harvest value (compounding)                       |
| 🚜 Expand Field    |       250 |   ×2.3 |  10 | +1 column or row                                       |

- Farmer Training appears once you own a farmer; Planter Gears appears once you own a seed planter.
- An upgrade at its max level shows **MAX**, can't be bought, and never charges money.
- A purchase button is disabled while you can't afford it.
- Every upgrade shows its effect as "current → next".

Workers and the multipliers grow at different rates on purpose. Workers get more expensive slowly (×1.25) but stop helping once the field is saturated. The capped upgrades get expensive quickly (×1.7 and ×2.3) and are spread out over the first 20–30 minutes. Quality Seeds and Fertilizer never cap, so there is always something to buy late in a run.

## Automation

Workers are modelled as **rates**, not as individual timers. On every simulation step:

1. Growing plots whose `readyAt` has passed become `ready`.
2. **Farmers:** `farmerProgress += dt × farmers / farmerInterval`. Each whole unit of progress harvests one ready plot.
3. **Seed planters:** `planterProgress` builds up the same way. Each whole unit plants one empty plot.

Plots are scanned row by row from the top left. When there's nothing to do, progress is capped at the worker count, so each worker banks at most one action. Buying a worker doesn't reset anything.

Farmers harvest instantly, so plots never sit in a "harvesting" state.

## Game loop, saving and offline progress

- **One loop.** The page calls `gameStore.tick()` every **100 ms**. `tick` advances the simulation from `lastTick` to now in sub-steps of at most **1 s**, so a throttled background tab catches up correctly.
- **Saving.** The full state goes to `localStorage` under `harvest-idle-save` every 5 s, whenever the tab is hidden, and on unload.
- **Loading.** The save is loaded on mount. Saves are versioned (`version: 1`). A save with a different version or invalid JSON is ignored and the game starts fresh. Fields missing from older saves are filled with defaults.
- **Offline progress.** On load, the time since `lastTick` is simulated in the same 1 s steps, up to **8 hours**. If you were away for at least a minute and earned something, a banner shows the duration and earnings. Because offline steps are 1 s long, very fast crops (well under 1 s) earn a little less offline than they would live.
- **Export / import.** The Stats panel can export the save as a base64 string (copied to the clipboard) and import one, after asking for confirmation. Imports are validated the same way as loads, and an invalid string leaves the game untouched. An imported save earns no offline progress; its clock restarts at the moment of import.

## Prestige (Legacy)

- The **🌟 Legacy** panel appears once you can earn your first seed, which takes 1M money earned in the run.
- **Sell farm** resets money, upgrades, unlocked crops and the field. In return you get `floor(sqrt(runEarned / 1M))` legacy seeds.
- Each legacy seed adds **+10% to all harvest value**, permanently.
- These survive a sale: legacy seeds, number of farms sold, lifetime earnings and total crops harvested.
- The panel shows how much this run needs to earn for the next seed: `(gain + 1)² × 1M`.

**Reset save** in the Stats panel deletes everything, legacy seeds included, after asking for confirmation.

## Balance simulation

`yarn sim [mixed|active]` runs `scripts/balance-sim.ts`. It drives the real store with a fake clock and a simulated player who clicks 4 times per second and greedily buys the cheapest option.

- `mixed` clicks for 2 minutes, then idles.
- `active` clicks the whole time and never buys workers.

Results for the current numbers:

| Time | Mixed (idle after 2m) | Active (clicks only) | Mixed crop | First 🌟         |
| ---: | --------------------: | -------------------: | ---------- | ---------------- |
|   2m |                  56/s |                 54/s | wheat      |                  |
|  10m |                1.5K/s |               2.7K/s | pumpkin    |                  |
|  20m |               13.8K/s |              15.2K/s | sunflower  | mixed: ~12m      |
|  60m |               65.5K/s |              39.3K/s | sunflower  | 11 seeds by 60m  |
| 120m |               91.0K/s |              53.9K/s | sunflower  | 20 seeds by 120m |

An idle player who stops clicking at 2 minutes keeps pace with a perfect nonstop clicker, and pulls ahead after about 20 minutes. The active bot clicks 4 times a second without ever stopping, which no real player does, so a real player who clicks only some of the time falls well below the idle line.

## Known gaps

- After about 30 minutes, every capped upgrade is maxed. From then on, a run only grows through Quality Seeds, Fertilizer and more workers, until you sell the farm.
- Legacy seeds have a single use (an income bonus). There's no prestige shop yet.
- There are no achievements, sound, or offline notifications yet (see the README roadmap).
