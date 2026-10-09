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

Clicking an empty plot plants the **selected seed**. Clicking a ready plot harvests it; so does clicking a growing plot whose `readyAt` has already passed, without waiting for the next tick. Clicking a plot that is still growing does nothing. Plots act on press, and dragging on from the pressed plot repeats the action on every plot passed over: it harvests ripe plots, or plants empty ones if the drag started on an empty plot. That makes a full field quicker to work by hand than the sim's 4 clicks per second, but it can't beat the field's own throughput (each plot still has to grow).

## Crops

| Crop         | Grow time | Base value | Value / plot-second | Unlock cost |
| ------------ | --------: | ---------: | ------------------: | ----------: |
| 🌾 Wheat     |        3s |         10 |                3.33 |        free |
| 🥕 Carrot    |       10s |         40 |                4.00 |         500 |
| 🎃 Pumpkin   |       30s |        150 |                5.00 |      50,000 |
| 🌻 Sunflower |       60s |        360 |                6.00 |   1,400,000 |

Crops form a ladder. Each slower crop earns a little more per plot-second and much more per harvest. That means it needs far fewer actions (clicks, or worker actions) to produce the same income, which matters most when workers are scarce. The trade-off is waiting: slow crops keep plots occupied for longer.

There is one selected seed for the whole farm. Manual planting and seed planters both use it. Unlocking a crop selects it automatically.

## Formulas

```
growTime     = crop.growTime × 0.92^sprinkler
harvestValue = round(crop.value × (1 + 0.2 × qualitySeeds) × 1.1^fertilizer × (1 + 0.25 × legacySeeds)
                     × (1 + 0.03 × almanacEntries) × mutationMultiplier)
workerInterval (ms per action, per worker) = 3000 × 0.88^trainingLevel
upgradeCost  = floor(baseCost × costGrowth^level)
legacySeedsFromSale = floor(sqrt(runEarned / 30,000,000))
```

Money is always a whole number, because each harvest value is rounded.

## Mutations

Every planting (by hand or by a seed planter) rolls for a mutation, which multiplies that crop's harvest value. The roll is stored on the plot (`Cell.mutation`) and shows while the crop grows. There are no bad mutations.

| Mutation  | Value | Chance per planting |
| --------- | ----: | ------------------: |
| Bountiful |    ×2 |                  5% |
| Giant     |    ×4 |                1.5% |
| Golden    |   ×10 |                0.4% |
| Rainbow   |   ×50 |                0.1% |

Rainbow can only appear after buying **Rainbow Seeds**.

```
mutationChance     = chance × (1 + 0.2 × luckyClover)          (0 while locked)
mutationMultiplier = 1 + (multiplier − 1) × (1 + 0.25 × prizeRibbons)
```

`rollMutation(roll)` checks the rarest first: `roll < golden` is Golden, then `roll < golden + giant` is Giant, and so on. On average mutations add `Σ chance × (mutationMultiplier − 1)` (`expectedMutationMultiplier`): **+16.5%** income with no upgrades, about one harvest in 14 mutated. With Lucky Clover and Prize Ribbons maxed and Rainbow unlocked, mutations make up most of a run's income. Numbers live in `data/mutations.ts`.

## Upgrades

| Upgrade            | Base cost | Growth | Max | Effect                                                 |
| ------------------ | --------: | -----: | --: | ------------------------------------------------------ |
| 🧑‍🌾 Farmer          |       100 |  ×1.25 |   — | +1 worker that harvests ready plots                    |
| 🌱 Seed Planter    |        75 |  ×1.25 |   — | +1 worker that plants the selected seed in empty plots |
| 📘 Farmer Training |       200 |  ×1.95 |  15 | Farmer interval ×0.88 (3.0s → 0.44s at max)            |
| ⚙️ Planter Gears   |       150 |  ×1.95 |  15 | Seed planter interval ×0.88                            |
| 💧 Sprinkler       |       150 |  ×1.85 |  15 | Grow time ×0.92 (−71% at max)                          |
| ✨ Quality Seeds   |       100 |   ×1.5 |   — | +20% harvest value (additive)                          |
| 🧪 Fertilizer      |     1,000 |  ×1.75 |   — | ×1.1 harvest value (compounding)                       |
| 🍀 Lucky Clover    |    15,000 |   ×2.1 |  10 | Mutation chance ×(1 + 0.2 × level) (×3 at max)         |
| 🎀 Prize Ribbons   |   400,000 |     ×2 |  10 | Each mutation's extra value ×(1 + 0.25 × level)        |
| 🌈 Rainbow Seeds   |       20M |      — |   1 | Unlocks the Rainbow mutation                           |
| 🚜 Expand Field    |       250 |   ×2.9 |  10 | +1 column or row                                       |

- Farmer Training appears once you own a farmer; Planter Gears appears once you own a seed planter.
- The Mutations section opens with pumpkin: Lucky Clover appears once pumpkin is unlocked, Prize Ribbons once you own a Lucky Clover, and Rainbow Seeds once sunflower is unlocked (`requires` / `requiresCrop`, checked by `isUpgradeVisible`).
- An upgrade at its max level shows **MAX**, can't be bought, and never charges money.
- A purchase button is disabled while you can't afford it.
- Every upgrade shows its effect as "current → next".

Workers and the multipliers grow at different rates on purpose. Workers get more expensive slowly (×1.25) but stop helping once they can keep up with the field: extra ones just sit idle, so money is better spent on growth and value. The capped upgrades get expensive quickly (×1.85 to ×2.9) and max out between about 15 and 35 minutes. Quality Seeds, Fertilizer and the mutation upgrades keep a run growing after that.

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
- **Export / import.** The Stats panel can export the save as a base64 string (copied to the clipboard) and import one, after a confirmation dialog. Imports are validated the same way as loads, and an invalid string leaves the game untouched. An imported save earns no offline progress; its clock restarts at the moment of import.

## Almanac

The first harvest of each crop × mutation pair (4 × 4 = **16 entries**) is recorded in the Almanac (`GameState.discoveries`), whether the player or a farmer harvests it. Each entry adds **+3%** to all harvest value for good: the Almanac survives selling the farm, and only **Reset save** clears it. The harvest that makes a discovery is paid before its own bonus applies.

A toast announces each new entry. The Almanac panel (with Stats, in the Stats tab on mobile) shows found entries in full and the rest as silhouettes, plus the total bonus. Rainbow entries need Rainbow Seeds, so a full Almanac takes several runs.

## Prestige (Legacy)

- The **🌟 Legacy** panel appears once you can earn your first seed, which takes 30M money earned in the run (about 24 minutes).
- **Sell farm** resets money, upgrades, unlocked crops and the field. In return you get `floor(sqrt(runEarned / 30M))` legacy seeds.
- Each legacy seed adds **+25% to all harvest value**, permanently. Selling at 45–60 minutes gives about 3 seeds (+75%).
- These survive a sale: legacy seeds, number of farms sold, lifetime earnings, total crops harvested and the Almanac.
- The panel shows how much this run needs to earn for the next seed: `(gain + 1)² × 30M`.

**Reset save** in the Stats panel deletes everything, legacy seeds included, after asking for confirmation.

## Balance simulation

`yarn sim [mixed|active] [--timeline]` runs `scripts/balance-sim.ts`. It drives the real store with a fake clock and a simulated player who clicks 4 times per second and greedily buys the cheapest option.

- `mixed` clicks for 2 minutes, then idles. It stops buying workers (and their speed upgrades) once they can do 1.25× what the field needs, as a sensible player would.
- `active` clicks the whole time and never buys workers.

The sim also tracks **firsts**: every crop unlock, new shop item, first purchase, maxed upgrade, first crop of each mutation, Almanac entry and legacy-seed milestone. It prints how many came in each window and the longest wait without one; `--timeline` lists them all.

`Math.random` is seeded in the sim, so mutation rolls and results are identical on every run. The `mut` column is the share of earnings in that interval that came from mutated crops, and 📖 counts Almanac entries.

Results for the current numbers:

| Time | Mixed (idle after 2m) | Active (clicks only) | Mixed crop | First 🌟        |
| ---: | --------------------: | -------------------: | ---------- | --------------- |
|   2m |                  72/s |                131/s | wheat      |                 |
|  10m |                4.9K/s |                765/s | pumpkin    |                 |
|  20m |               29.0K/s |               6.0K/s | sunflower  | mixed: ~24m     |
|  60m |                210K/s |              42.9K/s | sunflower  | 3 seeds by 60m  |
| 120m |                369K/s |               113K/s | sunflower  | 7 seeds by 120m |

Clicking wins the first couple of minutes, then automation takes over: by 10 minutes the idle player earns about 6× a perfect nonstop clicker, which no real player is anyway.

### Progress curve

Targets for a run (mixed sim), and where the current numbers land:

| Target                                            | Now                                                  |
| ------------------------------------------------- | ---------------------------------------------------- |
| Crops unlock every few minutes, then about 20m    | carrot 2m, pumpkin 7m, sunflower 19m                 |
| Something new at least every ~5 minutes for 30m   | 36 firsts in 0–30m, longest wait 5m 13s              |
| Capped upgrades max out spread over the first 35m | Sprinkler 17m, Expand Field 25m, Lucky Clover 34m    |
| Rainbow Seeds is a mid-run goal                   | bought at 44m                                        |
| First legacy seed around 25m                      | 24m                                                  |
| Mutations become the late-game engine             | 25% of income at 10m, 39% at 20m, about 70% from 60m |

After about 45 minutes new things are rare (Prize Ribbons maxes at 1h 46m), which is where selling the farm is meant to take over. More late content is tracked in #9.

## Known gaps

- After about 45 minutes a run only grows through Quality Seeds, Fertilizer and Prize Ribbons levels, until you sell the farm. Seed planters and farmers never need their speed upgrades maxed, so a careful player leaves those alone.
- Legacy seeds have a single use (an income bonus). There's no prestige shop yet.
- There are no achievements, sound, or offline notifications yet (see the README roadmap).
