# Harvest

> This is an attempt to create a simple incremental game. You plant crops, harvest them, and try to accumulate as much currency as possible. There is no end goal, just keep playing and see how much you can get before you get bored.

## How to Play

1. **Click an empty plot** to plant your selected seed, and **click a ready plot** (it pulses) to harvest it.
2. Spend your 💰 on **workers**: seed planters plant for you and farmers harvest for you. After a few minutes the farm runs itself.
3. **Unlock slower crops** (🌾 → 🥕 → 🎃 → 🌻). They earn more per plot and far more per harvest.
4. Buy **upgrades** to grow crops faster, raise their value, and expand the field up to 8×8.
5. Once you've earned 1M in a run, **sell the farm** for 🌟 legacy seeds. Each one adds +10% income permanently, then you start over.

The game saves itself in your browser and keeps farming for up to 8 hours while you're away. You can move a save to another browser with **Export / import** in the Stats panel.

## Crops

| Crop         | Grow time | Value |  Unlock |
| ------------ | --------: | ----: | ------: |
| 🌾 Wheat     |        3s |    10 |    free |
| 🥕 Carrot    |       10s |    40 |     500 |
| 🎃 Pumpkin   |       30s |   150 |   5,000 |
| 🌻 Sunflower |       60s |   360 | 250,000 |

## Upgrades

- **🧑‍🌾 Farmer**: harvests ready plots automatically.
- **🌱 Seed Planter**: plants your selected seed in empty plots.
- **📘 Farmer Training / ⚙️ Planter Gears**: make farmers and planters work faster.
- **💧 Sprinkler**: crops grow faster.
- **✨ Quality Seeds**: +20% harvest value per level.
- **🧪 Fertilizer**: ×1.1 harvest value per level (compounding).
- **🚜 Expand Field**: adds a column or row of plots, up to 8×8.

Exact formulas, costs and balance notes are in [docs/game-mechanics.md](docs/game-mechanics.md).

## Development

Built with SvelteKit, Svelte 5, Tailwind CSS v4 and TypeScript.

```sh
yarn            # install dependencies
yarn dev        # start the dev server
yarn build      # production build
yarn check      # type-check
yarn lint       # prettier + eslint
yarn test       # unit tests (Vitest)
yarn sim        # balance simulation (add "active" for a clicks-only player)
```

See [docs/architecture.md](docs/architecture.md) for how the code is organised.

## Features to add

Tracked as [GitHub issues](https://github.com/JustGritt/Harvest/issues) under three milestones.

- [x] Different types of crops
- [x] Save game (with offline progress, export / import)
- [x] Better interface (mobile layout, [#4](https://github.com/JustGritt/Harvest/issues/4))
- [x] More animations (harvest feedback, [#2](https://github.com/JustGritt/Harvest/issues/2))
- [ ] More upgrades: prestige shop ([#8](https://github.com/JustGritt/Harvest/issues/8)), late-game content ([#9](https://github.com/JustGritt/Harvest/issues/9)), bulk buying ([#12](https://github.com/JustGritt/Harvest/issues/12))
- [ ] Enemies that can destroy crops ([#13](https://github.com/JustGritt/Harvest/issues/13))
- [ ] More ways to earn currency ([#15](https://github.com/JustGritt/Harvest/issues/15))
- [ ] Achievements ([#11](https://github.com/JustGritt/Harvest/issues/11))
- [ ] Sound effects and music ([#14](https://github.com/JustGritt/Harvest/issues/14))
