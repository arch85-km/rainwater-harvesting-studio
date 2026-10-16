# Changelog

Each release is archived on Zenodo with its own version DOI. The concept DOI,
[10.5281/zenodo.22801122](https://doi.org/10.5281/zenodo.22801122), always
resolves to the newest version. The full notes for each release are on the
[releases page](https://github.com/arch85-km/rainwater-harvesting-studio/releases).

## Unreleased

- **Changed** — the cube device, the icon and logo, is reserved: neither the
  MIT licence nor CC BY 4.0 grants any right to use it. Stated in the licence
  files, the app's licence panel and `.zenodo.json`.
- **Tests** — the citation suite also reads the summary notes: its byline,
  BibTeX version and DOIs. 390 → 397 assertions.
- **Docs** — `ARCHITECTURE.md`, `CHANGELOG.md` and `DESIGN.md` added, and a
  statement of how the app is developed added to the README, the method
  notes and `.zenodo.json`.

## [1.2.0](https://github.com/arch85-km/rainwater-harvesting-studio/releases/tag/v1.2.0) — 4 October 2026

Version DOI [10.5281/zenodo.23143962](https://doi.org/10.5281/zenodo.23143962).
The model, the yield calculation and the interface are unchanged.

- **Added** — Help credits what the tool is made of, separately from the
  licence: no third-party code; BS EN 16941-1:2024 for the yield formula,
  surface coefficients and store operation (first-flush diversion is the
  tool's own addition); and Open-Meteo, reached only if you fetch in the
  Climate panel.
- **Changed** — the tab icon is carried inside the HTML, so a copy opened
  from disk or another domain shows the same mark.

## [1.1.0](https://github.com/arch85-km/rainwater-harvesting-studio/releases/tag/v1.1.0) — 1 October 2026

Version DOI [10.5281/zenodo.23072220](https://doi.org/10.5281/zenodo.23072220).

- **Changed** — the water balance steps daily by default. Every coverage
  figure moves: the opening model goes from 53% to 89%. A figure quoted from
  1.0.0 should be re-read before it is reused. With *Daily balance* unticked,
  the app says what it is measuring.
- **Fixed** — vault roofs: at semicircular the profile hung the eaves far
  below the building. The arc is now swept by angle, and the rise is capped
  at half the span.
- **Fixed** — a design dry period of zero sized the tank on 18 days. Loaded
  models are range-checked, and a field can no longer show a value the clamp
  rejected.
- **Fixed** — the Explain and report sheets printed two quantities twice
  under four names, headed the fraction kept as "Losses", and used a rainfall
  symbol the formula never mentions.
- **Docs** — checked against BS EN 16941-1:2024 directly: four terms
  corrected, including "water saving efficiency", which the standard does
  not use (Formula (A.5) defines the coverage rate C_r). Table 2's smooth-roof
  row names solar panels, which the surface library now includes.
- **Tests** — 361 → 390 assertions.

## [1.0.0](https://github.com/arch85-km/rainwater-harvesting-studio/releases/tag/v1.0.0) — 16 September 2026

Version DOI [10.5281/zenodo.22801123](https://doi.org/10.5281/zenodo.22801123).
First release.

- A single-file, dependency-free parametric 3D modeller for rainwater
  harvesting yield, store capacity and reliability to BS EN 16941-1:2024.
- The catchment is the roof's horizontal projection. Yield by Formula (1),
  store operation by Annex A.2.2.3, capacity by the dry-period method of
  A.2.1 with the UK National Annex NA.3.
- 28 preset cities with sourced rainfall: 22 from the WMO Climatological
  Standard Normals 1991–2020 and 6 from the WMO World Weather Information
  Service, each recorded in `docs/climate-source.json`.
- Explain sheet, report sheet and CSV export, each with its own provenance
  line.
- Method notes in `docs/method-notes.html`.
- 346 assertions, `npm test`, no dependencies.
