# Rainwater Collection Studio

A parametric 3D roof modeller that calculates rainwater harvesting yield, store
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

1. Upload `index.html` to your site — either through **Media Library → Add New**,
   or by FTP to something like `/wp-content/uploads/rwc/index.html`.
2. Copy the file's URL.
3. Add a **Custom HTML** block to your page and paste this, replacing the `src`:

```html
<div style="position:relative;width:100%;height:82vh;min-height:560px;
            border:1px solid #d7d6d1;border-radius:8px;overflow:hidden">
  <iframe
    src="/wp-content/uploads/rwc/index.html?embed=1"
    title="Rainwater Collection Studio"
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
| Catchment, rainfall, Yc × Fc | **Input** | What you are working from |
| Annual yield | **Harvest** | What the roof delivers to the tank, `A · R · Yc · Fc` |
| Non-potable demand | **Need** | What the building wants |
| **Storage capacity** | **Deliverable** | **The answer.** The figure that goes on the drawing and into the specification |
| Demand met % | **Justification** | Why that store size and not half or twice it. BS calls this the water saving efficiency |
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
- **Sizing the store — three answers** — the BS simplified 5% rule, the
  optimisation-curve knee, and whatever you set, side by side.
- **What is limiting this design** — a diagnosis generated from your numbers:
  *yield-limited* (even an unlimited tank could not meet the demand, so a bigger
  tank cannot help), *storage-limited* (naming the knee capacity and the percentage
  it would reach), or *demand-limited* (the roof collects far more than the
  building can use), with the single biggest lever called out.

Clicking a tile opens the sheet at that step.

---

## Method

### Yield — BS EN 16941‑1:2024 (which superseded BS 8515:2009)

```
Y = A · R · Yc · Fc          litres per year
```

- `A` — **projected** catchment area, m² (plan area including the eaves overhang)
- `R` — annual rainfall depth, mm (1 mm on 1 m² = 1 litre)
- `Yc` — yield (run-off) coefficient of the roof surface
- `Fc` — hydraulic filter efficiency, **0.90** by default: the standard requires
  the pre-tank treatment to be at least 90% efficient

Yield coefficients, per BS EN 16941‑1 Table 2:

| Surface | Yc |
|---|---|
| Smooth metal sheet | 0.90 |
| Pitched tile / slate | 0.80 |
| Concrete / asphalt | 0.75 |
| Gravel-ballasted flat | 0.60 |
| Flat roof, smooth felt | 0.50 |
| Green roof (extensive) | 0.40 |

Mixed-material models weight `Yc` by each block's catchment area.

### Store operation — YAS

The tank is operated with the **Yield After Spillage** rule, the conservative
convention: demand is met from what was in the tank at the *end of the previous
step*, before this step's inflow is added.

```
Yt = min(Dt, Vt−1)
Vt = min(Vt−1 + Qt − Yt, C)
```

Three warm-up cycles run before the reported year, so the answer does not depend
on an assumed starting level. Volume is conserved to within rounding:
`Σ inflow = Σ supplied + Σ overflow`.

**Monthly stepping assumes rain falls evenly all month, which flatters
reliability.** Turn on *Daily balance* (Demand tab) to spread each month's depth
over its wet days and step day by day — this is why storage exists at all, and
the difference between the two is worth showing students.

### Store sizing

Three answers, shown together:

1. **BS simplified (5% rule)** — 5% of the lesser of annual yield and annual
   demand, roughly 18 days.
2. **Profile-optimised knee** — the smallest capacity that reaches 95% of the best
   achievable water-saving efficiency, read off the optimisation sweep. Past the
   knee, more tank buys almost nothing.
3. **Whatever you set manually.**

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

1. **Pitch does not matter.** Load `forms`. Note that all six roofs report the
   same catchment. Now change the gable's pitch from 15° to 45° and watch the
   surface area climb 15% while the yield does not move at all.
2. **The vault.** Set a barrel vault with a big rise. Surface / catchment goes
   past ×1.6. Ask what that extra 60% of material is buying.
3. **Distribution beats total.** Compare `clim-trop`, `clim-temp` and `clim-arid`.
   Kuala Lumpur has 4× London's rainfall but does not need 4× the tank — because
   it rains every month. Then set London's annual total to Kuala Lumpur's using
   the Annual mode and see how differently it behaves.
4. **Green roof trade-off.** Load `green`. The green roof more than halves the
   harvest. Ask whether its runoff attenuation and biodiversity benefits are worth
   it — and note that attenuating runoff and harvesting runoff are partly competing
   goals.
5. **Demand, not catchment, is usually the constraint.** Load `warehouse`: a huge
   metal roof where most of the harvest spills because there is nobody to use it.
   Then raise the occupancy and watch the overflow collapse.
6. **Monthly vs daily.** Turn on the daily balance on any model and watch
   reliability drop. Ask why.
7. **Read the diagnosis.** Open **Explain** on `clim-arid`, `warehouse` and
   `house` in turn. They come back yield-limited, storage-limited-on-an-oversized-roof,
   and storage-limited. Ask what you would change in each case — and notice that in
   Dubai a bigger tank is the *wrong* answer.
8. **Save two variants** of the same building and compare them in Analysis mode.

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
index.html    the entire app — single file, no dependencies, no build step
README.md     this file
```

Nothing to install. Nothing to compile. Open the file, or upload it.

---

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

## References

- BS EN 16941‑1:2024, *On-site non-potable water systems — Systems for the use of
  rainwater* (supersedes BS 8515:2009)
- BS EN 12056‑3, *Gravity drainage systems inside buildings — Roof drainage*
- [DROP Rainwater Harvesting Design Software — Freeflush](https://www.freeflush.co.uk/pages/drop-rainwater-harvesting-software)
- [Autodesk InfoDrainage](https://www.autodesk.com/products/infodrainage/features)
- [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api)
