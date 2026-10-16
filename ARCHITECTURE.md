# Architecture

How Rainwater Harvesting Studio is put together: what lives where, how a roof
and a climate become a store size, and what the tooling around it does. For
the method clause by clause, read the [method notes](docs/method-notes.html).
The [README](README.md) covers using, embedding, teaching and verifying the
tool in full. This file is the map.

## One file

`index.html` is the application and the deliverable. Nothing builds it: it is
edited directly, and the copy in the repository is the copy uploaded to the
website. It bundles no third-party code, stylesheet or font.

| Part | Size | What it holds |
|---|---|---|
| `<style>` | 35 KB | All styling |
| Markup | 15 KB | The interface |
| `<script>` | 208 KB | The application, about 3,800 lines |
| **Total** | **258 KB** | |

The script's header lists its modules in dependency order. The test suite
extracts the first three of them from this file, so it tests the file that
ships.

## Conventions

- Units are metres, millimetres of rain and litres.
- The catchment is the roof's **horizontal projection**. Pitch changes the
  roof's surface area, not what it collects.
- The release is declared once, as `VERSION` (number, ISO date and long
  label), and the citation once, as `CITATION` (with the concept DOI and this
  release's version DOI). The app reads both; the test suite holds the
  method notes, the README, `CITATION.cff` and `.zenodo.json` to them.

## The modules

| Module | What it does |
|---|---|
| `DATA` | Constants: the eight surfaces of BS EN 16941-1 Table 2 (`MATERIALS`), the eight roof types (`ROOFS`), the climate window, the 28-city rainfall library (`CITIES`, `CLIMATE`) with its provenance (`CLIMATE_SOURCE`), the end uses, and the demo models (`DEMOS`) |
| Model factories | `newBlock`, `newModel`, and `sanitiseModel`, which clamps a loaded model to the ranges the controls offer |
| `GEO` | Parametric geometry: blocks become faces with projected and surface areas |
| `HYD` | Hydrology: wet days, monthly demand, inflow by Formula (1) with first-flush diversion and the filter coefficient, the YAS water balance (`balance`, daily by default, after three warm-up cycles), store sizing, and a drainage check |
| `R3D` | The 3D renderer, on a Canvas 2D: an orbit camera and the painter's algorithm, with no WebGL |
| `CHART` | Inline SVG charts |
| `APP` | The interface: parameter panels, analysis charts, climate helpers, menus, IO, the Explain sheet, the A3 report sheet, the three modes, events, the optional climate fetch, the guided tour and boot |

## From a roof to a store size

1. A model is a set of blocks (footprint, wall height, roof type and
   parameters, surface material), a climate, a demand and a system.
2. `GEO` builds each block's faces and its projected catchment area.
3. `HYD.inflowMonthly` applies Formula (1): rainfall, less first flush on
   each wet day, × projected area × the surface's yield coefficient × the
   filter coefficient, block by block.
4. `HYD.balance` runs the store as yield-after-spillage (Annex A.2.2.3),
   daily or monthly, and reports supplied water, overflow, mains top-up and
   the coverage rate.
5. Store capacity follows the dry-period method of A.2.1, with the BSI UK
   National Annex NA.3.
6. The panels, charts, Explain sheet and report read the same result.

## The rainfall library

The 28 preset cities are sourced. 22 come from the WMO Climatological
Standard Normals 1991–2020 and 6 from the WMO World Weather Information
Service. `docs/climate-source.json` records each city's source, station,
WMO number, elevation, period and rain-day threshold.

`tools/build-climate-wwis.mjs` builds the library, and
`.github/workflows/build-climate.yml` runs it by hand on a runner with
internet, committing to a review branch, never to `main`.
`tools/build-climate.mjs` is the earlier Open-Meteo generator, kept because
the app's live fetch and the rewrite both use it.

## What leaves the browser

One request, and only when the user asks for it: **Fetch** in the Climate
panel calls Open-Meteo's archive API for daily rainfall at a typed latitude
and longitude over 1991–2020. Nothing else is fetched or uploaded.

## What the browser stores

Three `localStorage` keys:

- `rwc3d.autosave.v2`: the current model.
- `rwc3d.theme`: light or dark, once chosen.
- `rwc3d.tour`: set to `off` when the user turns the guided tour off.

## Exports

A PNG of the 3D view at 3× with a title block, key figures and the copyright
line; the A3 report sheet; the A4 Explain sheet; a monthly CSV; and the
model as JSON, which can be reopened.

## The repository

```
index.html                 the application (the deliverable)
docs/method-notes.html     method notes (Elementor HTML widget)
docs/method-notes-summary.html  the method in brief
docs/climate-source.json   provenance of the rainfall library
test/                      the assertion suite, run by test/run.mjs
tools/                     the rainfall library generators
.github/workflows/         the manual workflow that regenerates the library
package.json · CITATION.cff · .zenodo.json · LICENSE · README.md
report-a3.pdf · shot-*.png  a sample report and screenshots
ARCHITECTURE.md · CHANGELOG.md · DESIGN.md
```

## Testing and release

`npm test` (or `node test/run.mjs`) runs 397 assertions with nothing to
install:

| Suite | Assertions | What it checks |
|---|---|---|
| `core.test.js` | 232 | Data, geometry and hydrology, extracted from `index.html` by `extract-core.mjs`: the yield formula, the plan projection, the water balance, sizing, every demo and roof type |
| `generator.test.mjs` | 78 | The rainfall generator's offline parts |
| `citation.test.mjs` | 69 | The release metadata. It holds the version, the date and the DOIs together across the app, `CITATION.cff`, `.zenodo.json`, the README and both method notes pages. |
| `wwis-smoke.test.mjs` | 18 | The WWIS generator end to end, offline |

This repository has no separate release guard: the citation suite does that
job, and the test runner also checks that the README's assertion count is
the number actually run.

Release order: change `VERSION` and `CITATION`, then every other stamp, run
`npm test`, push, and cut the GitHub release (tag `vX.Y.Z`). Then record the
version DOI that Zenodo mints in a separate commit.
