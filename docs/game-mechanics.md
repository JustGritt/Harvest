# Game Mechanics

Harvest is an incremental farming game. The player plants crops on a grid, harvests them for money, and spends that money on upgrades that automate the loop and increase income. There is no win condition.

All numbers below come from `src/lib/store.ts`, the single source of truth. If you change a value there, update this file.

## The field

- The field starts as a **3 × 3** grid of plots.
- **Expand Field** adds one new **row**. The column count stays at 3.
- Each plot (a "cell") is always in one of four states:

```
 empty ──plant──▶ growing ──(readyTime reached)──▶ ready ──manual click──▶ empty
                                                    │
                                                    └──farmer──▶ harvesting ──(3s)──▶ empty
```

| State        | Shown as | How it's entered                                                   |
| ------------ | -------- | ------------------------------------------------------------------ |
| `empty`      | "Empty"  | Start of game, or after a harvest                                  |
| `growing`    | 🌱 + bar | Player clicks an empty plot, or a seed planter plants it           |
| `ready`      | 🌸       | The growth tick sees that `readyTime` has passed (checked every 1s) |
| `harvesting` | 🚜 + bar | A farmer has claimed the plot. It takes 3s to finish               |

The player harvests by clicking a `ready` plot. Clicking a plot that is `growing` or `harvesting` does nothing.

## Core formulas

**Growth time** (ms):

```
growthTime = 5000 / (growthSpeedMultiplier + sprinklers × 0.5)
```

`growthSpeedMultiplier` starts at 1, and no upgrade changes it yet. A new crop takes 5s to grow. With 2 sprinklers it takes 2.5s.

**Harvest value** (money per crop):

```
value = 10 × yieldMultiplier × (1 + fertilizerLevel × 0.1)
```

Manual harvests and farmer harvests are worth the same amount.

## Upgrades

All costs go up after each purchase: `newCost = floor(cost × factor)`, using `scaleCost()` from `src/lib/utils/gameUtils.ts`.

| Upgrade                      | Base cost | Cost factor | Effect                                                        | Store action                 |
| ---------------------------- | --------: | ----------: | ------------------------------------------------------------- | ---------------------------- |
| Sprinkler                    |       200 |        1.5× | +0.5 to the growth divisor (crops grow faster)                | `buySprinkler`               |
| Farmer                       |       300 |        1.5× | +1 crop harvested automatically per farmer cycle              | `buyFarmer`                  |
| Seed Planter                 |       250 |        1.5× | +1 empty plot planted automatically per planter cycle         | `buySeedPlanter`             |
| Reduce Farmer Cooldown       |       250 |        1.5× | Farmer cycle −1s (minimum 2s, starts at 10s)                  | `upgradeFarmerCooldown`      |
| Reduce Seed Planter Cooldown |       250 |        1.5× | Planter cycle −1s (minimum 2s, starts at 10s)                 | `upgradeSeedPlanterCooldown` |
| Expand Field                 |       500 |        1.2× | Adds one row of 3 plots                                       | `expandField`                |
| Fertilizer                   |       500 |        1.7× | +10% harvest value per level                                  | `upgradeFertilizer`          |
| Yield                        |       100 |        1.5× | +1 `yieldMultiplier` (**no button in the UI yet**)            | `upgradeYield`               |

The two cooldown upgrades only show up once the player owns at least one farmer or seed planter.

## Automation

Automation runs in `autoHarvestByFarmers()`, which the page calls **every 2 seconds**. Each call does three things in order:

1. **Finish harvests.** Any `harvesting` plot that started at least `farmerHarvestTime` (3s) ago becomes `empty` and pays out.
2. **Farmers claim ready plots.** Free farmers are `farmers − plots currently harvesting`. If there is at least one free farmer and `farmerHarvestDelay` has passed since the last farmer cycle, each free farmer claims one `ready` plot. Plots are scanned row by row, top-left first.
3. **Seed planters plant.** If `seedPlanterCooldown` has passed since the last planter cycle, each seed planter plants one `empty` plot, using the same scan order.

Buying a farmer or seed planter resets that unit's cycle timer.

Because the tick runs every 2s, automation timings effectively round up to multiples of 2s. For example, a 3s harvest really finishes after 4s.

## Game loop timers

The page (`src/routes/+page.svelte`) starts three intervals when it mounts:

| Interval | Calls                              | Purpose                                     |
| -------- | ---------------------------------- | ------------------------------------------- |
| 100 ms   | updates the local `currentTime`    | Animates progress bars and countdowns       |
| 1000 ms  | `gameStore.updateGrowth()`         | Moves a plot from `growing` to `ready`      |
| 2000 ms  | `gameStore.autoHarvestByFarmers()` | Runs the automation steps above             |

## Known quirks and gaps

These are in the current prototype. Fix them on purpose, or leave them alone; don't "fix" them by accident.

- **Fractional money.** Fertilizer multiplies by `1.1`, `1.2`, and so on, so money becomes a float and can show floating-point noise (for example `110.00000000000001`). Nothing rounds it.
- **Misleading sprinkler stat.** The "Sprinklers reduction" stat shows `sprinklers × 0.5` seconds. The real effect is `+0.5` to the growth divisor, not a flat number of seconds removed.
- **No UI for the yield upgrade.** `upgradeYield` exists in the store, but no button calls it.
- **`growthSpeedMultiplier` never changes.** It is ready to be used by a future upgrade.
- **"Field size" stat** shows the row count only, not the total number of plots.
- **No persistence.** Refreshing the page resets everything, and the game does not progress while the tab is closed.
- **No offline or background catch-up.** All timing uses `Date.now()` deltas checked on intervals, so a throttled background tab simply ticks less often.
