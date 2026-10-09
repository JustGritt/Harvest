# Art style

Harvest's art is hand-authored SVG in a **cozy sticker** style: chunky, rounded shapes with a dark outline, flat colour, and one highlight and one shade. All sprites are code, live in `src/lib/art/svg/<family>/<name>.svg`, and are checked by `src/lib/art/art.test.ts`.

## Rules

| Rule        | Value                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas      | `viewBox="0 0 48 48"`, nothing within 2px of the edge. Soil tiles are `0 0 32 32`.                                                                                    |
| Ground line | Crops stand on **y = 42**, centred on x = 24, so stages line up and sway from the base.                                                                               |
| Outline     | `#3b271b` (wood-900), 2px, round caps and joins. Inner detail lines are 1.5px or thinner. Thin parts (stalks) are a 4.5px outline stroke under a 2px coloured stroke. |
| Fill        | A base colour, then one highlight (light comes from the top-left) and one shade (bottom-right).                                                                       |
| Never       | Gradients, text, embedded images, baked drop shadows (the UI adds shadows).                                                                                           |
| Shapes      | Rounded, chunky, slightly squat. Silhouettes must read at **24px**.                                                                                                   |
| Tiles       | No outlines. Details stay away from the edges so the tile repeats without seams.                                                                                      |

## Palette

Only the `@theme` token colours in `src/app.css` plus the extra hues in `src/lib/art/palette.ts` (carrot, pumpkin, skin, water, steel, white). The test fails on any other hex. Opacity is allowed for soft accents like cheeks.

| Role                      | Colours                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| Outline                   | wood-900                                                                          |
| Soil, mounds              | soil-200 → soil-700 (freshly turned mounds are soil-400, lighter than wet ground) |
| Leaves, young crops       | leaf-200 → leaf-600                                                               |
| Ripe grain, coins, hats   | gold-100 → gold-700                                                               |
| Accents (bandana, danger) | berry-500                                                                         |

## Using sprites

```svelte
<!-- Decorative, 1em, sits inline with text -->
<Art id="coin" />
<Art id="farmer" size="2.25rem" />

<!-- Carries meaning, so it gets a name -->
<Art id="coin" label="money" />
```

`src/lib/art/sprites.ts` turns every file into a `<symbol id="art-<name>">` in one sprite sheet (mounted once by `Sprites.svelte` in the layout). `Art.svelte` draws it with `<use>`.

## Adding a sprite

1. Draw `src/lib/art/svg/<family>/<name>.svg` following the rules above.
2. Add `<name>` to `ART_IDS` in `src/lib/art/ids.ts`.
3. For a new crop, also draw `<crop>-sprout`, `<crop>-young` and `<crop>-mature`. `cropArt()` in `ids.ts` won't type-check until they're in `ART_IDS`.
4. Run `yarn test` (manifest, canvas and palette checks) and look at it on the dev-only contact sheet at `/art`, at 24 to 96px over parchment, soil and wood.

## Manifest

| Family   | Sprites                                                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| crops    | `seed-mound` (every crop's first stage), then `<crop>-sprout`, `<crop>-young`, `<crop>-mature` for wheat, carrot, pumpkin and sunflower                                                               |
| field    | `soil-dry`, `soil-wet` (32×32 tiles), `fence-frame` (9-slice border: 12-unit bands, posts at corners and mid-edge so they repeat)                                                                     |
| workers  | `farmer`, `seed-planter`                                                                                                                                                                              |
| upgrades | `farmer-training`, `planter-gears`, `sprinkler`, `quality-seeds`, `fertilizer`, `expand-field`, `lucky-clover`, `prize-ribbon`, `rainbow-seeds` (mapped from upgrade ids by `UPGRADE_ART`)            |
| currency | `coin`, `legacy-seed`                                                                                                                                                                                 |
| ui       | `pouch` (Seeds), `stall` (Upgrades), `ledger` (Stats), `leaf` (Growth), `lock`, `check`, `close`, `sunrise` (welcome back), `warning`, `crate` (save / import), `pointer` (first-run hint), `almanac` |
| fx       | `dirt`, `sparkle`, `petal` (particles)                                                                                                                                                                |

All sprites are original work made for this repository and share its license.
