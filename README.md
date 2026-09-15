# Rainwater Harvesting Studio

**[karam.me.uk/applications/rainwater-harvesting-studio](https://karam.me.uk/applications/rainwater-harvesting-studio/)**

**Version 1.0** — 15 September 2026

A parametric 3D modeller that calculates rainwater harvesting yield, store
size and reliability to **BS EN 16941‑1:2024**. Built for teaching architecture
students, and for embedding in a WordPress page.

**One file. No dependencies. No build step.** Open `index.html` in any modern
browser — it works offline.

© Karam Al-Obaidi

---

## Why it exists

Every rainwater harvesting calculator online is a 2D form: type a roof area, get
a number. The two reference tools sit at opposite ends and neither closes the gap
for design teaching:

| Tool | Strength | Gap |
|---|---|---|
| **DROP** (Freeflush) | Continuous simulation on real rainfall series, BS 8515 option appraisal | Purely numeric — no geometry at all |
| **Autodesk InfoDrainage** | Real 3D, sub-catchment tanks with retention/detention, Civil 3D round-trip | 3D is at site/drainage scale; the roof is an abstract catchment number |

Nothing couples a **parametric 3D roof** to the harvesting calculation. That is
what this is for, and it exists to break one specific misconception:

> **Catchment is the plan-projected area, not the sloping roof surface.**

A 30° gable roof has 15% more surface than a flat roof on the same footprint and
collects **exactly the same rainwater**. Change the pitch in the app and watch the
surface area move while the yield does not. A spreadsheet cannot make that
argument; a model you can shape can.

---

## Putting it in WordPress

### Option 1 — iframe (recommended)

Fully isolated from your theme's CSS and JavaScript. Nothing can break your site
styling, and nothing in your theme can break the app.

1. Get a URL for the app. Either:
   - **Upload `index.html` to your site** — through **Media Library → Add New**,
     or by FTP to something like `/wp-content/uploads/rwc/index.html`; or
   - **serve it from the repository** with GitHub Pages (Settings → Pages →
     deploy from branch, root), which gives you
     `https://<you>.github.io/rainwater-harvesting-studio/` and updates itself on
     every push.
2. Copy that URL.
3. Add a **Custom HTML** block to your page and paste this, replacing the `src`:

```html
<div style="position:relative;width:100%;height:82vh;min-height:560px;
            border:1px solid #d7d6d1;border-radius:8px;overflow:hidden">
  <iframe
    src="/wp-content/uploads/rwc/index.html?embed=1"
    title="Rainwater Harvesting Studio"
    loading="lazy"
    style="position:absolute;inset:0;width:100%;height:100%;border:0"
    sandbox="allow-scripts allow-downloads allow-popups allow-same-origin allow-modals">
  </iframe>
</div>
```

> **`allow-downloads` matters.** Without it the browser silently blocks the PNG,
> CSV, JSON and report exports. `allow-modals` is needed for the New-model
> confirmation. `allow-same-origin` lets the app remember work between visits.

On phones, swap `height:82vh` for `height:88vh` if you want more of the screen.

**Pick one host, not both.** An uploaded copy and a Pages copy are two files, and
they go out of step the moment one is fixed and the other is not — with no sign
on either page that they disagree. Serving from Pages and framing that URL keeps
the repository as the single source of truth, which is the same reason the tests
extract from `index.html` rather than holding a copy of it. If you would rather
upload, leave Pages off.

One thing to check rather than assume, if you frame the Pages URL: load the page
once and confirm the app actually appears inside the frame. It is a cross-origin
frame with the `sandbox` attribute above, and that is worth seeing work before a
lecture depends on it.

### Option 2 — paste into a Custom HTML block

Open `index.html` in a text editor, copy everything from `<style>` to the final
`</script>`, and paste it into a Custom HTML block. All CSS is scoped under
`#rwc-app` with `rwc-` prefixed class names, so theme bleed is unlikely — but the
iframe is still the safer choice.

### URL parameters

| Parameter | Effect |
|---|---|
| `?embed=1` | Fills the iframe exactly and trims outer chrome |
| `?model=house` | Opens straight into a demo model — see the IDs below |
| `?theme=dark` | Forces dark; `?theme=light` forces light. Default follows the viewer's OS setting |
| `?mode=analysis` | Opens in Analysis mode; `?mode=present` opens in Presentation |
| `?tour=1` | Forces the guided tour open even for someone who opted out; `?tour=0` suppresses it for that link only |

Combine them: `index.html?embed=1&model=forms&mode=present`

Model IDs: `forms`, `house`, `school`, `warehouse`, `mosque`, `terrace`,
`clim-trop`, `clim-arid`, `clim-temp`, `green`.

Deep-link a lecture slide or a course page straight to the roof-form comparison
with `?model=forms&mode=present`.

---

## Using it

### Model space
Drag to orbit · scroll to zoom · shift-drag or right-drag to pan · pinch on touch.
`F` fits the model, arrow keys rotate, `P` toggles Presentation mode, `Esc` leaves it.
First visit? The guided tour opens automatically — see below.

**Moving blocks.** Click a roof to select its block, then **drag it** to slide it
across the ground. Dragging empty space or an unselected block still orbits, so a
block cannot be moved by accident — the cursor changes over the one that can.
Position snaps to 0.25 m; hold **Alt** for free placement, or use **Shift + arrow
keys** to nudge (they move the way the screen looks, not the way the world is
axed). If a block ends up overlapping another in plan, both are outlined in the
warning colour and the status bar says so — an overlap counts the same area twice
in the catchment. New blocks are always placed clear of the whole model.

### The guided tour

A nine-step tour opens **on every load**, so a student arriving at the page cold
is always oriented: the model space, the roof types and the catchment point,
which of the seven results is the answer, the Explain sheet, the model library,
the three workspaces and the exports.

Every step carries a **"Don't show this on launch"** checkbox — nobody has to
reach the end to turn it off — and the choice is remembered in that browser.
Once dismissed it stays available from **Help → Take the tour**. Arrow keys step
through it, `Esc` closes it, and it never opens in Presentation mode, so it
cannot interrupt a lecture.

### Toolbar
**New · Open · Save** work on `.json` model files. Work is also autosaved to the
browser, so a refresh does not lose it.

**Models** loads any of the ten demo models. They are starting points — every
parameter stays editable once loaded.

### Roof types
Flat (with parapet), gable, hip, shed, butterfly, sawtooth, barrel vault, pyramid.
Each is fully parametric: width, depth, wall height, pitch or rise, overhang, bay
count, ridge length. Add as many blocks as you like for L-shaped and multi-block
massing; each block keeps its own roof type, material and downpipe count.

Blocks must not overlap in plan, roof overhangs included — an overlap counts the
same area twice in the catchment. The app detects it, names the two blocks, and
flags them in the model tree and the status bar.

### Render styles
Shaded · Hidden line · Wire · X-ray · **Catchment** (roofs coloured by yield
coefficient) · **Flow** — arrows tiled across every collecting surface, pointing
down the fall to the gutters. Vertical surfaces such as sawtooth glazing carry no
arrows because they collect nothing, which is the point: swing the model round to
the collecting side and the whole roof fills with arrows.

### Modes
- **Design** — the full editing workspace.
- **Analysis** — charts, the monthly table, the roof breakdown and variant comparison.
- **Presentation** — chrome hidden, large 3D, oversized readouts. `←`/`→` step
  through your own model and then the whole demo library, one slide at a time.
  Your working model is restored when you leave.

### Exports
| Export | What you get |
|---|---|
| **Image (PNG)** | The 3D view at 3× resolution with a title block, key figures and the copyright line |
| **Report sheet** | One **A3 landscape** page: 3D view, roof schedule, method, three charts, monthly table. Print or Save as PDF |
| **Explain sheet** | The calculation walked step by step with your numbers — see below. Prints **A4 portrait** across 2–3 pages |
| **Monthly CSV** | Month-by-month rainfall, inflow, demand, supplied, store, spill and mains top-up, for Excel |
| **Model JSON** | The full parametric model, re-openable |

---

## Which number is the answer?

Seven figures on screen, and students reasonably ask which one they are meant to
hand in. The app is explicit about it:

| Figure | Role | What it is |
|---|---|---|
| Catchment, rainfall, e × η | **Input** | What you are working from |
| Annual yield | **Harvest** | What the roof delivers to the tank, `A · e · h · η` |
| Non-potable demand | **Need** | What the building wants |
| **Storage capacity** | **Deliverable** | **The answer.** The figure that goes on the drawing and into the specification |
| Coverage rate C_r | **Justification** | Why that store size and not half or twice it. Supplied ÷ demanded, Formula (A.5) |
| Mains displaced | **Benefit** | The same water, counted as what you no longer buy |
| Overflow | **Diagnostic** | What spilled, and therefore what is limiting the design |

**Peak flow in litres/second is not a rainwater-harvesting result at all.** It
answers a different question — how fast water leaves the roof in one heavy storm —
and it sizes gutters and downpipes to BS EN 12056-3. It has no bearing on the tank.

### The Explain sheet

Press **Explain** in the toolbar, or click any of the seven result tiles, and the
app opens a printable sheet that walks the whole calculation with *your* model's
numbers — catchment → rainfall → losses → yield → demand → store → demand met, one
card per step in plain English — then:

- **"So which number is the answer?"** — the store capacity, stated as the
  deliverable, with the other six figures placed in their roles.
- **Sizing the store — three answers** — the basic approach of A.2.1, the
  coverage-curve knee, and whatever you set, side by side.
- **What is limiting this design** — a diagnosis generated from your numbers:
  *yield-limited* (even an unlimited tank could not meet the demand, so a bigger
  tank cannot help), *storage-limited* (naming the knee capacity and the percentage
  it would reach), or *demand-limited* (the roof collects far more than the
  building can use), with the single biggest lever called out.

Clicking a tile opens the sheet at that step.

---

## Method

### Yield — BS EN 16941‑1:2024, clause 6.1.2, Formula (1)

```
Y = Σ ( A_i · e_i · h · η )          litres
```

- `A_i` — the **horizontal projection of the collection area**, m², which is the
  standard's own wording. Plan area including the eaves overhang; never the
  sloping surface. This is why pitch changes the roof and not the harvest.
- `e_i` — surface yield coefficient of that surface (Table 2)
- `h` — rainfall depth for the time step, mm (1 mm on 1 m² = 1 litre)
- `η` — hydraulic treatment efficiency coefficient, **0.90** by default. The
  standard's note to 6.1.2 says 0.9 *can be used* where the manufacturer states
  nothing and there is no additional treatment. It is a fallback, not a minimum
  the standard requires.

Surface yield coefficients, transcribed from BS EN 16941‑1:2024 Table 2 — all
eight rows, in the standard's order, at the published values:

| Collection surface | e |
|---|---|
| Pitched roof, smooth — metal, glass, slate, glazed tile | 0.90 |
| Pitched roof, rough — concrete tile | 0.80 |
| Flat roof, without gravel | 0.80 |
| Flat roof, with gravel | 0.70 |
| Green roof, intensive — garden | 0.30 |
| Green roof, extensive | 0.50 |
| Sealed area — asphalt | 0.80 |
| Non-sealed area — cobble stone | 0.50 |

Mixed-material models weight `e` by each block's catchment area. Models saved
with the earlier six surface keys are mapped onto these on open.

The **first flush** input is the tool's own addition; Formula (1) has no
first-flush term. Leave it at 0 to calculate strictly to the standard.

### Store operation — Formulas (A.3) and (A.4), Annex A.2.2.3

Abstraction is the lesser of the demand and the volume in the store at the *end
of the previous step*, before this step's inflow is added; anything over the
usable volume overflows. The convention is known as **YAS**, Yield After
Spillage, and it is the conservative one.

```
St = min(Dt, Vt−1)
Vt = min(Vt−1 + Qt − St, C)
```

Three warm-up cycles run before the reported year, so the answer does not depend
on an assumed starting level. Volume is conserved to within rounding:
`Σ inflow = Σ supplied + Σ overflow`.

Coverage is reported as **C_r**, supplied ÷ demanded, which is Formula (A.5).
A second figure counting the steps in which demand was met in full is the tool's
own; the standard has no such measure.

**The time step matters more than it looks.** On a monthly step the whole
month's demand is drawn in one go against the previous month's closing volume,
so the store can never supply more than **one tank-full a month** however often
it would really refill. On the terraced-housing model a 1 000 L tank reads 4.6%
monthly and 59.3% daily — the monthly figure is an artefact of the step, not a
property of the tank. Turn on *Daily balance* for any store smaller than a
month's demand; the app warns when you have not.

Neither step is the standard's detailed approach (A.2.2), which requires at
least five years of **measured daily** rainfall. The tool holds no daily series
at any point: its daily option derives a wet-day count from the monthly total
and spreads the month's inflow evenly across those synthetic days.

### Store sizing

Three answers, shown together:

1. **Basic approach (A.2.1)** — the lesser of annual yield and annual demand ×
   the design dry period ÷ 365. The standard's examples are 15 days
   (Netherlands), 18 (Ireland, UK) and 21 (Germany); the tool defaults to 18 and
   lets you set it. Where the ratio of annual yield to demand falls below 0.5 or
   rises above 2.0, the UK National Annex NA.3 reduction is applied — the dry
   period is halved.
2. **Curve knee** — the smallest capacity reaching 95% of the best achievable
   coverage. The curve is the standard's C_r = f(V) plot (A.2.2.4); reading a
   knee off it is the tool's own shortcut, not a rule from the standard.
3. **Whatever you set manually.**

### Demand

Per person per day from four editable end uses, times occupancy, plus an
optional seasonal irrigation term; annual demand is daily × 365, as Formula (4).
The WC and laundry defaults (25 and 15 l/person/day) sum to the 40 l/person/day
the UK National Annex NA.1.2 recommends for toilet and washing-machine use; the
split between them, and the cleaning and vehicle-wash figures, are the tool's
own. Note 2 to 6.1.3 allows fewer than 365 days for commercial or public
premises — the tool cannot be told that, so it overstates demand for any
building that is not occupied all year.

### The rainfall library, and where it comes from

The 28 presets were originally written by hand with no dataset behind them.
`CLIMATE_SOURCE` in `index.html` records whether that is still true, and the app
prints the answer under the location selector and on every report, explain sheet
and CSV it exports — so an exported sheet carries its own citation.

To give the library a real source, run the generator once, from a machine with
outbound HTTPS:

```
node tools/build-climate.mjs            # fetch and rewrite index.html
node tools/build-climate.mjs --dry-run  # fetch and report, write nothing
```

It resolves every location first and reports them together, so a bad country code
costs seconds rather than surfacing twenty downloads into the run. The country
code comes from the city's own label and is mapped to ISO 3166-1 where the two
differ — "London, UK" is geocoded as GB — so "Athens, GR" cannot land in Georgia.
It then pulls daily precipitation for the window the app declares, reduces it with
the app's own `CLIMATE.reduce` — the same function the in-app fetch uses, so the
two can never drift — and rewrites the `CITIES` block with coordinates, elevation
and a provenance record. It also writes `docs/climate-source.json` with what each
city matched to, so a run can be checked and repeated. If any city fails it writes
nothing at all: a half-sourced library is worse than none, because you cannot tell
which rows are which.

Beside each city it records the World Bank's average annual precipitation for that
*country*, as an independent cross-check on order of magnitude. It is a check and
not a source: one long-term annual average per country, where the library needs
twelve monthly figures per city. Three pairs in the list share a country — Kuala
Lumpur with Kuching, Seattle with Phoenix, Sydney with Melbourne — and in the
library as it stands they differ by roughly 1 500, 770 and 550 mm a year, so one
national number cannot be right for both halves of any of them. Nothing in the app
is calculated from it, and if the fetch fails the field is null and the library is
unaffected.

Two things to say when citing the result: the archive serves a **reanalysis**,
not gauge measurement, and 1991–2020 is a baseline rather than current
conditions. Which reanalysis dataset answered is recorded per city in
`docs/climate-source.json` under `api` — cite that one, not an assumed one.

**After regenerating, every figure quoted in the method notes and the test suites
is stale** and must be re-measured, not edited to fit.

### Figures still with no source

The code names no origin for the downpipe capacity table, the 75 mm/h design
storm, the cleaning and vehicle-wash demands, or the mains tariff. The full
register is in [`docs/method-notes.html`](docs/method-notes.html).

### What is *not* rigorous

The **gutter and downpipe check is indicative only**. It sizes from a 75 mm/h
design storm and a rule-of-thumb pipe capacity table. A real design follows
**BS EN 12056‑3** with the local design storm and the actual gutter profile. The
app says so on screen and on the report sheet.

### Rainfall data

Four ways in:

1. **Presets** — 28 cities with monthly normals, spanning tropical, monsoon,
   temperate, continental, Mediterranean, semi-arid and arid.
2. **Monthly table** — type your own twelve values.
3. **Annual figure** — one number, distributed using the monthly *shape* of the
   selected city.
4. **Open-Meteo fetch** *(optional)* — enter a latitude and longitude to pull a
   10-year monthly climatology from the Open-Meteo archive API. **This needs
   internet and will be blocked offline, on restricted classroom networks, and
   under a strict WordPress content-security policy.** It fails with a clear
   message and the app keeps working; the presets and the manual table are the
   guaranteed paths. Fetched values land in the editable table so they can be
   corrected by hand.

---

## Teaching with it

### Exercises

1. **Pitch does not matter.** Load `forms`: six roof shapes on one footprint,
   all reporting a catchment of 117.00 m². Now take a 12 × 8 m gable from 15° to
   45° and watch the surface climb from 121.13 to 165.46 m² while the catchment
   stays at 117.00 m² and the yield does not move at all. Then try a sawtooth —
   the one form whose catchment does differ, because it carries its overhang on
   the low edge only.
2. **The vault.** Set a barrel vault with a big rise. Surface / catchment goes
   past ×1.6. Ask what that extra 60% of material is buying.
3. **Distribution beats total.** Compare `clim-trop`, `clim-temp` and `clim-arid`.
   Kuala Lumpur has 4× London's rainfall but does not need 4× the tank — because
   it rains every month. Then set London's annual total to Kuala Lumpur's using
   the Annual mode and see how differently it behaves.
4. **Green roof trade-off.** Load `green`. At the Table 2 values the extensive
   green roof (e 0.50) harvests just over half what smooth metal (0.90) does. Ask whether its runoff attenuation and biodiversity benefits are worth
   it — and note that attenuating runoff and harvesting runoff are partly competing
   goals.
5. **Demand, not catchment, is usually the constraint.** Load `warehouse`: a huge
   smooth-metal roof where most of the harvest spills because there is nobody to
   use it.
   Then raise the occupancy and watch the overflow collapse.
6. **Monthly vs daily.** Load `terrace`, set the tank manually to 1 000 L and
   read the coverage rate with the daily balance off, then on: 4.6% becomes
   59.3%. Ask which figure is the artefact, and why (see *Store operation*).
7. **Read the diagnosis.** Open **Explain** on `clim-arid`, `warehouse` and
   `house` in turn. They come back yield-limited, storage-limited-on-an-oversized-roof,
   and storage-limited. Ask what you would change in each case — and notice that in
   Dubai a bigger tank is the *wrong* answer.
8. **Save two variants** of the same building and compare them in Analysis mode.

Three worked exercises with the numbers to expect, written for students to follow
unaided, are in [`docs/method-notes.html`](docs/method-notes.html).

### Assessment

Have students hand in the **A3 report sheet** (Export → Report sheet →
Print / Save as PDF). It carries the 3D view, the roof schedule, the method with
their own numbers, three charts and the monthly table on one page.

For a sizing exercise, ask for the **Explain sheet** alongside it: it forces them
to state the store capacity as the deliverable and to say what is limiting their
design, rather than quoting whichever number looks largest.

---

## Files

```
index.html                the entire app — single file, no dependencies, no build step
test/                     258 assertions, no dependencies — see Verifying below
package.json              scripts and metadata; there is nothing to install
docs/method-notes.html    method notes for students: what it calculates, which
                          clause each step comes from, and every figure the code
                          leaves unsourced. Paste into a CMS as an HTML block.
docs/climate-source.json  provenance of the rainfall library — written by the
                          generator, absent until it has been run
tools/build-climate.mjs   regenerates the rainfall library from a real source
CITATION.cff              machine-readable citation — the only format GitHub
                          reads, and what puts "Cite this repository" on the
                          repo page
LICENSE                   the MIT grant for the code, on its own so GitHub's
                          licence detector reads it; the CC BY 4.0 terms for
                          the documentation are under Licence, below
README.md                 this file
```

Nothing to install. Nothing to compile. Open the file, or upload it.

---

## Verifying

```
npm test          # or: node test/run.mjs
```

**258 assertions, nothing to install.** Node 18 or newer, no dependencies, no
build step. The suite extracts the app's own modules straight out of
`index.html` and exercises them, so it tests the file that ships rather than a
copy of it — change the app and the tests follow automatically.

What it covers:

- **Yield to BS EN 16941-1** — the equation as Formula (1) writes it, all eight
  Table 2 coefficients at their published values, area-weighted mixing across
  blocks of different surfaces.
- **Catchment is the plan projection** — the identity `(w + 2o)(d + 2o)` across
  every roof form, that pitch moves surface area but never catchment, and the
  sawtooth exception.
- **The water balance conserves volume** — inflow equals supplied plus overflow
  plus the change in store, across several climates and capacities, and that
  overflow can never exceed the harvest.
- **Tank sizing** — the basic approach of A.2.1 at each of the standard's dry
  periods, the National Annex NA.3 halving, and that coverage rises
  monotonically with capacity.
- **The climate reduction** — checked against the code it replaced, kept in the
  suite as an oracle so the two can never drift apart.
- **The generator's rewrite** — round-tripped by re-evaluating the patched file
  rather than eyeballing a diff, plus the country-code handling that stops
  "Athens, GR" landing in Georgia.
- **The citation and the canonical URL** — that the citation in the app, the APA
  entry and BibTeX block in the method notes, `CITATION.cff` and `package.json`
  all give the same work at the same address, so a mirror of the app cannot end
  up being the one people cite.

The browser suites used during development — smoke tests at four viewport
widths, the guided tour, PDF pagination, block dragging, iframe embedding, and
two pixel regressions for render artefacts and flow arrows — need Playwright and
are not shipped here.

## Publishing

`index.html` sits at the repository root, so GitHub Pages will serve the app
directly with no configuration: **Settings → Pages → deploy from branch, root**.

If you are pushing this somewhere new:

```
git branch -m main                      # the history arrives on its original branch
git remote add origin git@github.com:<you>/rainwater-harvesting-studio.git
git push -u origin main
```

## Technical notes

The 3D is a small renderer written into the file: an orbit camera, perspective
projection and a painter's algorithm over Canvas 2D. Not WebGL, deliberately —

- **Vector output.** The PNG and the A3 report re-render the same scene at 3–4×
  device scale rather than upscaling a screen-resolution framebuffer.
- **Hidden-line and X-ray fall out of the algorithm** for free.
- **No context-loss, driver or sandbox failure modes** on classroom machines or
  inside an iframe.

Ordering is the hard part of a painter's algorithm, and two things make it
reliable here:

- **Every face is tessellated** into triangles — ear-clipped, then bisected on the
  longest edge until it is short relative to the block — before the depth sort. A
  whole 12 × 8 m roof plane sorted on its centroid alone paints over the wall that
  should occlude it; small triangles put each centroid close to its own local
  depth. Edges are flagged so only real polygon boundaries get stroked, and
  near-coplanar seams (the 18 strips of a barrel vault) are left unstroked, so
  curved roofs read as smooth rather than faceted.
- **Walls carry a small depth bias.** A wall meets the roof exactly along the
  eaves, and on a vault along the whole arch of the gable end. Coincident surfaces
  have no correct order, so walls are pushed fractionally further away, breaking
  every one of those ties in the roof's favour while leaving genuine occlusion
  untouched.

Together these cut measured sorting artifacts by about 92% against a naive
whole-face sort, at 8–25 ms per frame for the shipped models.

Charts are hand-authored inline SVG for the same reasons as the renderer — crisp
at any size, print cleanly, no dependency.

Each sheet sets its own `@page` size as it opens (A4 portrait for Explain, A3
landscape for Report) and drops out of fixed positioning for print, so both
paginate properly instead of being clipped to a single page.

Browser support: any browser from the last few years. Uses `ResizeObserver`,
`pointer events`, `canvas.toBlob` and CSS Grid.

---

## Before you cite

Five things this page cannot settle for you:

- **Record the date you fetched the rainfall** — an API archive is revisable, so
  a citation without a retrieval date names no fixed thing.
- **Cite the reanalysis the generator recorded** in `docs/climate-source.json`,
  not one assumed here; the archive picks by location.
- **Check the Open-Meteo DOI** below on their own site — supplied by an external
  review, not verified here.
- **Open-Meteo's CC BY 4.0 covers non-commercial use**; commercial use needs
  their paid API, per the same review.
- **The BSI standards are paywalled** — a real limit on how far anyone can check
  what is claimed about them.

## References

What the tool draws on. Clause and table numbers were checked against
**BS EN 16941‑1:2024 specifically** — the edition incorporating the July 2024
corrigendum. Numbering moved from the withdrawn 2018 edition.

- **British Standards Institution** (2024), *On-site non-potable water systems.
  Part 1: Systems for the use of rainwater* (BS EN 16941‑1:2024, incorporating
  corrigendum July 2024). BSI — the method, nearly entire: catchment and yield
  (6.1.2, Formula 1), Table 2, demand (6.1.3), store and coverage rate (A.2.2.3),
  capacity and dry periods (A.2.1), the coverage curve (A.2.2.4), and NA.1.2 and
  NA.3 from the BSI UK National Annex. The tool does **not** implement A.2.2,
  NA.4, or anything on water quality.
- **Open-Meteo**, *Historical weather API* —
  <https://open-meteo.com/en/docs/historical-weather-api> — the rainfall, once
  the preset library has been regenerated; until then it supplies nothing, and
  the app says so. Citable software record: Zippenfenig, P. (2023).
  *Open-Meteo.com Weather API* [Computer software]. Zenodo.
  `https://doi.org/10.5281/zenodo.7970649`
- **World Meteorological Organization** (2017), *WMO guidelines on the
  calculation of climate normals* (WMO-No. 1203). WMO — defines the thirty-year
  standard normal, so it decides which years the rainfall averages over.

## Also named in the code

Named in `index.html` or `tools/build-climate.mjs`, but **drawn on for nothing**
— listed so every name can be traced, and kept apart so that appearing in a list
is not mistaken for contributing a number.

- **British Standards Institution** (2013), *Rainwater harvesting systems: Code
  of practice* (BS 8515:2009+A1:2013). BSI — the national foreword to
  BS EN 16941‑1:2024 calls it the standard "which this standard replaces"; quoted
  rather than interpreted, with no supersession chain asserted. The code names it
  without the 2013 amendment.
- **British Standards Institution** (2000), *Gravity drainage systems inside
  buildings. Part 3: Roof drainage, layout and calculation* (BS EN 12056‑3:2000).
  BSI — **where to go for gutter and downpipe sizing**, which this tool does not
  do. Its own UK National Annex is where a design rainfall intensity comes from;
  the 75 mm/h here did not come from there.
- **World Bank**, *Average precipitation in depth (mm per year)*
  (AG.LND.PRCP.MM) — <https://data.worldbank.org/indicator/AG.LND.PRCP.MM> — a
  country-level annual average recorded beside each city as a sanity check, never
  an input. A republication: its metadata page names FAO (AQUASTAT) as the source.

Reviewed for comparison, not used as a source:
[DROP Rainwater Harvesting Design Software](https://www.freeflush.co.uk/pages/drop-rainwater-harvesting-software)
and [Autodesk InfoDrainage](https://www.autodesk.com/products/infodrainage/features).

---

## Licence

© Karam Al-Obaidi. The code is **MIT** (see [`LICENSE`](LICENSE)); the
documentation, screenshots and exercises are
**[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**. Nothing
third-party is bundled — no external script, stylesheet or font. A model you
make with the tool is yours; neither licence claims anything over it.
