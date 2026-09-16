#!/usr/bin/env node
/* ==========================================================================
   build-climate.mjs — give the preset climate library a real source.

   The 28 presets in index.html were originally written by hand and had no
   dataset behind them. This script replaces them with figures that do: it
   geocodes each city, pulls a daily precipitation series for the window the
   app declares, reduces it with the app's own CLIMATE.reduce, and rewrites
   the CITIES block together with a provenance record.

   Nothing here is typed from memory. The coordinates are whatever the
   geocoder returns for the city name, filtered by the country code already
   carried in the label, and they are written into the file so the run can be
   checked and repeated.

   Usage, from the repository root:

     node tools/build-climate.mjs              # fetch and rewrite index.html
     node tools/build-climate.mjs --dry-run    # fetch and report, write nothing
     node tools/build-climate.mjs --only lon,dub

   Needs Node 18 or newer (for global fetch) and outbound HTTPS to
   open-meteo.com. It takes a few minutes: 28 cities, 30 years each, fetched
   politely one at a time.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT   = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP    = resolve(ROOT, "index.html");
const RECORD = resolve(ROOT, "docs/climate-source.json");

/* Deliberately does not name a reanalysis dataset. The archive draws on more
   than one and selects by location, so the dataset that answered is a property
   of the response, not of this script. Whatever the API reports is recorded per
   city under `api` in docs/climate-source.json, and that is what to cite. */
const SOURCE_NAME = "Open-Meteo historical weather API (reanalysis)";
const SOURCE_NOTE = "Reanalysis, not gauge measurements. Expect a difference from a nearby station.";
const ARCHIVE     = "https://archive-api.open-meteo.com/v1/archive";
const GEOCODE     = "https://geocoding-api.open-meteo.com/v1/search";
const LICENCE     = "CC BY 4.0 (Open-Meteo terms)";
const PAUSE_MS    = 1200;

/* An independent, country-level sanity check. The World Bank's average
   precipitation indicator is a long-term average over a whole country's land
   area, so it is NOT a substitute for city rainfall — three of these cities
   share a country with another (Kuala Lumpur with Kuching, Seattle with
   Phoenix, Sydney with Melbourne) and a single national figure would collapse
   each pair. It is recorded beside each city so a reader can see how far that
   city sits from its country's mean, and for nothing else. It never affects the
   library: if it cannot be fetched, the run carries on and the field is null. */
const WORLDBANK   = "https://api.worldbank.org/v2/country";
const WB_INDICATOR = "AG.LND.PRCP.MM";
const WB_NAME     = "World Bank, Average precipitation in depth (mm per year), AG.LND.PRCP.MM";

/* The city labels use the code a reader expects, which is not always ISO 3166-1
   alpha-2 — "London, UK", where the geocoder reports GB. Map the label's code to
   the real one rather than changing what students see. Anything not listed is
   passed through unchanged and will fail loudly in preflight if it is wrong. */
const CC_ALIAS = { UK: "GB" };
const iso2 = cc => CC_ALIAS[cc] || cc;

const argv    = process.argv.slice(2);
const DRY     = argv.includes("--dry-run");
const onlyArg = argv[argv.indexOf("--only") + 1];
const ONLY    = argv.includes("--only") && onlyArg ? onlyArg.split(",").map(s => s.trim()) : null;

/* ── the app is the single source of truth for both the window and the rule ──
   Rather than restating them here, where they could drift, pull the real
   definitions out of index.html and run them. */
export function loadFromApp() {
  const html = readFileSync(APP, "utf8");
  const js = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!js) throw new Error("no <script> block found in index.html");
  /* evaluate just enough of the file: the helpers, the window, the reducer and
     the city list. Everything after the GEO module is irrelevant here. */
  const cut = js[1].indexOf("const GEO =");
  const prelude = js[1].slice(0, cut > 0 ? cut : undefined);
  const fn = new Function(prelude + "\nreturn { CLIMATE, CLIMATE_WINDOW, CITIES, CLIMATE_SOURCE };");
  return { html, ...fn() };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, what) {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

/* "Athens, GR" -> { place: "Athens", cc: "GR" }. The country code is what stops
   the geocoder handing back Athens, Georgia. */
export function splitLabel(name) {
  const i = name.lastIndexOf(",");
  if (i < 0) throw new Error(`city label "${name}" has no country code`);
  const shown = name.slice(i + 1).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(shown))
    throw new Error(`city label "${name}" does not end in a two-letter country code`);
  return { place: name.slice(0, i).trim(), cc: iso2(shown), shown };
}

/* Split out from the request so the country filter and the tie-break can be
   tested on canned responses, which is where the real risk lives: a geocoder
   that quietly returns the wrong Athens would poison the whole library. */
export function pickHit(name, results) {
  const { place, cc, shown } = splitLabel(name);
  const hits = (results || []).filter(r => (r.country_code || "").toUpperCase() === cc);
  if (!hits.length)
    throw new Error(`geocode ${place}: no result in country ${cc}` +
      (cc === shown ? "" : ` (label says ${shown})`) + " " +
      `(got ${(results || []).map(r => `${r.name}/${r.country_code}`).join(", ") || "nothing"})`);
  /* most populous match in the right country — the capital or major city, which
     is what a label like "Athens, GR" means */
  hits.sort((a, b) => (b.population || 0) - (a.population || 0));
  const h = hits[0];
  return {
    lat: +h.latitude.toFixed(4), lon: +h.longitude.toFixed(4),
    elev: h.elevation == null ? null : Math.round(h.elevation),
    matched: `${h.name}${h.admin1 ? ", " + h.admin1 : ""}, ${h.country_code}`,
    population: h.population ?? null,
    alternatives: hits.slice(1, 4).map(r => `${r.name}${r.admin1 ? ", " + r.admin1 : ""} (${r.population ?? "?"})`)
  };
}

async function geocode(name) {
  const { place } = splitLabel(name);
  const url = `${GEOCODE}?name=${encodeURIComponent(place)}&count=20&language=en&format=json`;
  const j = await getJSON(url, `geocode ${place}`);
  return pickHit(name, j.results);
}

/* Country-level cross-check. Cached, because three countries carry two cities
   each. Returns null on any failure — this must never be the reason a run dies. */
const wbCache = new Map();
async function nationalAnnual(cc) {
  if (wbCache.has(cc)) return wbCache.get(cc);
  let out = null;
  try {
    const url = `${WORLDBANK}/${cc}/indicator/${WB_INDICATOR}?format=json&mrnev=1`;
    const j = await getJSON(url, `world bank ${cc}`);
    const row = Array.isArray(j) && Array.isArray(j[1]) ? j[1][0] : null;
    if (row && row.value != null)
      out = { mm: +row.value, year: row.date, country: row.country?.value ?? null };
  } catch { /* recorded as null below */ }
  wbCache.set(cc, out);
  return out;
}

async function series(lat, lon, win) {
  const url = `${ARCHIVE}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&start_date=${win.from}&end_date=${win.to}&daily=precipitation_sum&timezone=UTC`;
  const j = await getJSON(url, `archive ${lat},${lon}`);
  const time = j.daily?.time, pr = j.daily?.precipitation_sum;
  if (!time?.length || !pr?.length) throw new Error(`archive ${lat},${lon}: empty series`);
  /* Keep every scalar the response carries alongside the data: whichever key
     names the model, plus the coordinates and elevation the API actually used,
     which can differ from the ones requested. Recorded rather than interpreted —
     this script does not know which keys matter, and guessing a field name would
     be how the wrong dataset ends up cited. */
  const meta = Object.fromEntries(
    Object.entries(j).filter(([, v]) => v === null || typeof v !== "object"));
  return { time, pr, meta };
}

/* ── rewrite ─────────────────────────────────────────────────────────────── */

export function renderCities(rows) {
  const w = (s, n) => String(s).padEnd(n);
  const body = rows.map(c =>
    `  {id:"${c.id}", name:${w(JSON.stringify(c.name) + ",", 22)} zone:${w(JSON.stringify(c.zone) + ",", 16)} ` +
    `lat:${c.lat}, lon:${c.lon}, elev:${c.elev === null ? "null" : c.elev}, dpd:${c.dpd}, ` +
    `r:[${c.r.join(",")}]}`
  ).join(",\n");
  return `const CITIES = [\n${body}\n];`;
}

export function patch(html, rows, meta) {
  const startTag = "const CITIES = [";
  const start = html.indexOf(startTag);
  if (start < 0) throw new Error("CITIES block not found in index.html");
  const end = html.indexOf("\n];", start);
  if (end < 0) throw new Error("end of CITIES block not found");
  html = html.slice(0, start) + renderCities(rows) + html.slice(end + 3);

  /* the provenance record the app prints */
  const src = html.match(/const CLIMATE_SOURCE = \{[\s\S]*?\n\};/);
  if (!src) throw new Error("CLIMATE_SOURCE block not found");
  const filled =
`const CLIMATE_SOURCE = {
  sourced:  true,
  name:     ${JSON.stringify(meta.name)},
  endpoint: ${JSON.stringify(meta.endpoint)},
  window:   ${JSON.stringify(meta.window)},
  accessed: ${JSON.stringify(meta.accessed)},
  licence:  ${JSON.stringify(meta.licence)},
  note:     ${JSON.stringify(meta.note)}
};`;
  return html.replace(src[0], filled);
}

/* ── run ──────────────────────────────────────────────────────────────────
   Guarded, so that importing this module for its pure functions does not fire
   28 requests at Open-Meteo. */

const invokedDirectly = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (!invokedDirectly) { /* imported for testing */ }
else await main();

async function main() {
const { html, CLIMATE, CLIMATE_WINDOW, CITIES } = loadFromApp();
const targets = ONLY ? CITIES.filter(c => ONLY.includes(c.id)) : CITIES;
if (ONLY && targets.length !== ONLY.length)
  throw new Error(`--only: unknown id(s) ${ONLY.filter(id => !CITIES.some(c => c.id === id)).join(", ")}`);

console.log(`${SOURCE_NAME}`);
console.log(`window ${CLIMATE_WINDOW.label}  (${CLIMATE_WINDOW.from} to ${CLIMATE_WINDOW.to})`);
console.log(`${targets.length} cities${DRY ? "  — DRY RUN, nothing will be written" : ""}\n`);

/* ── preflight ──────────────────────────────────────────────────────────────
   Geocode everything first. It is quick, and it means a bad country code or an
   ambiguous city costs seconds rather than surfacing twenty 30-year downloads
   into the run. Every problem is reported together, not one per attempt. */
console.log("Resolving locations:");
const located = [], badly = [];
for (const c of targets) {
  try {
    const g = await geocode(c.name);
    located.push({ city: c, geo: g });
    const flag = g.population != null && g.population < 100000 ? "  ! low population" : "";
    console.log(`  ${c.name.padEnd(20)} ${String(g.lat).padStart(9)},${String(g.lon).padStart(10)}  ` +
      `${g.matched}${flag}`);
    if (flag && g.alternatives.length) console.log(`      other matches: ${g.alternatives.join("; ")}`);
  } catch (err) {
    console.log(`  ${c.name.padEnd(20)} FAILED — ${err.message}`);
    badly.push({ id: c.id, name: c.name, error: err.message });
  }
  await sleep(PAUSE_MS);
}
if (badly.length) {
  console.error(`\n${badly.length} of ${targets.length} locations could not be resolved, so nothing`);
  console.error(`was downloaded and nothing has been written. Fix these and run again:\n`);
  for (const b of badly) console.error(`  ${b.name}: ${b.error}`);
  process.exit(1);
}
console.log(`\nAll ${located.length} resolved. Downloading ${CLIMATE_WINDOW.label} daily series:\n`);

const out = [], record = [], failed = [];

for (const { city: c, geo: g } of located) {
  process.stdout.write(`  ${c.name.padEnd(20)} `);
  try {
    const { time, pr, meta } = await series(g.lat, g.lon, CLIMATE_WINDOW);
    const red = CLIMATE.reduce(time, pr);
    const before = c.r.reduce((a, b) => a + b, 0);
    const wb = await nationalAnnual(splitLabel(c.name).cc);
    out.push({ ...c, lat: g.lat, lon: g.lon, elev: g.elev, dpd: red.dpd, r: red.monthly });
    record.push({
      id: c.id, name: c.name, matched: g.matched, population: g.population,
      alternatives: g.alternatives, lat: g.lat, lon: g.lon, elevation_m: g.elev,
      years: red.years, days: red.days,
      monthly_mm: red.monthly, annual_mm: +red.annual.toFixed(1), dpd_mm: red.dpd,
      previous_annual_mm: before,
      /* Exactly what the archive reported for this location, unedited. Read it
         before citing the rainfall: it names the dataset that actually answered. */
      api: meta,
      /* cross-check only — a country average, not this city. See WORLDBANK above. */
      national_annual_mm: wb ? wb.mm : null,
      national_year: wb ? wb.year : null,
      national_country: wb ? wb.country : null
    });
    const d = red.annual - before, pct = before ? (100 * d / before).toFixed(0) : "—";
    const nat = wb ? `national ${Math.round(wb.mm)} (${wb.year})` : "national n/a";
    console.log(`${String(Math.round(red.annual)).padStart(5)} mm/yr  ` +
      `(was ${String(before).padStart(5)}, ${d >= 0 ? "+" : ""}${pct}%)  ` +
      `dpd ${String(red.dpd).padStart(2)}  ${nat}`);
    await sleep(PAUSE_MS);
  } catch (err) {
    console.log(`FAILED — ${err.message}`);
    failed.push({ id: c.id, name: c.name, error: err.message });
  }
}

if (failed.length) {
  console.error(`\n${failed.length} of ${targets.length} cities failed. Nothing has been written —`);
  console.error(`a half-regenerated library is worse than none, because you cannot tell`);
  console.error(`which rows are sourced. Fix the errors above and run again.\n`);
  for (const f of failed) console.error(`  ${f.name}: ${f.error}`);
  process.exit(1);
}

if (ONLY) {
  console.log(`\n--only was used, so index.html is left alone: a partial library cannot`);
  console.log(`carry a provenance record. Re-run without --only to write.`);
  process.exit(0);
}

const meta = {
  name: SOURCE_NAME, endpoint: ARCHIVE, geocoder: GEOCODE,
  window: `${CLIMATE_WINDOW.from} to ${CLIMATE_WINDOW.to}`,
  accessed: new Date().toISOString().slice(0, 10),
  licence: LICENCE,
  note: SOURCE_NOTE,
  reduction: "monthly totals / distinct years; wet day = 1 mm or more; dpd = annual rain / annual wet days, rounded, clamped 2-30",
  generator: "tools/build-climate.mjs",
  dataset_note: "Open-Meteo's archive draws on more than one reanalysis dataset and selects by location. This file records the archive's own response metadata per city under `api`; cite the dataset named there, not a dataset assumed here.",
  cross_check: {
    name: WB_NAME,
    endpoint: `${WORLDBANK}/{ISO2}/indicator/${WB_INDICATOR}`,
    what: "Long-term average annual precipitation over a whole country's land area. Recorded beside each city as an independent sanity check ONLY — it is neither city-level nor monthly, and nothing in the app is calculated from it.",
    fetched: wbCache.size ? [...wbCache.entries()].filter(([, v]) => v).length + " of " + wbCache.size + " countries" : "none"
  }
};

if (DRY) {
  console.log(`\nDry run: index.html and docs/climate-source.json unchanged.`);
  process.exit(0);
}

writeFileSync(APP, patch(html, out, meta));
writeFileSync(RECORD, JSON.stringify({ ...meta, cities: record }, null, 2) + "\n");
console.log(`\nWritten:`);
console.log(`  index.html               CITIES and CLIMATE_SOURCE`);
console.log(`  docs/climate-source.json provenance and what each city geocoded to`);
console.log(`\nEvery figure quoted in docs/method-notes.html and in the test suites was`);
console.log(`measured on the old data and is now stale. Re-derive them before citing.`);
}
