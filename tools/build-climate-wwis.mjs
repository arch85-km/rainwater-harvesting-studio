/* ==========================================================================
   build-climate-wwis.mjs — source the preset library from the WMO World
   Weather Information Service.

   WWIS publishes city-level climatological normals supplied by each national
   meteorological and hydrological service. Two of its fields are exactly what
   this app needs, and it is worth being precise about why:

     climateMonth[].rainfall   mean total precipitation  -> r[12]
     climateMonth[].raindays   mean number of precipitation days

   dpd — the app's depth per wet day — is then the quotient of the two annual
   sums. That is a division of two published normals, where the Open-Meteo
   route derived it from a reanalysis daily series. These are gauge
   measurements from the national service, which removes the
   "reanalysis, not measurement" limitation the other source carries.

   Three things are RECORDED, never silently adjusted:

     raindef / rainunit   the threshold that defines a precipitation day. The
                          app's own rule is >= 1 mm. If a service uses 0.1 mm
                          it counts more days, so dpd comes out lower and the
                          daily step behaves differently. Recorded per city and
                          reported loudly; not converted, because there is no
                          honest way to convert it.
     raintype             whether the figures are rainfall or precipitation
                          INCLUDING SNOW. Snow is collected eventually but not
                          when it falls, so a winter month can read wetter than
                          a roof experiences.
     rainfallb/e, rdayb/e the normal period, which WWIS gives separately for
                          rainfall and for rain days, and which varies by
                          country. The app used to declare one window for
                          every city; it cannot any more, and says so.

   Acknowledgement to the WMO WWIS and to the supplying service is required,
   and the data must be reproduced accurately. Both are written into
   docs/climate-source.json and surfaced by the app.

   Usage, from the repository root:

     node tools/build-climate-wwis.mjs --dry-run   # fetch, report, write nothing
     node tools/build-climate-wwis.mjs             # fetch and rewrite

   Needs Node 18+ and outbound HTTPS to worldweather.wmo.int.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCities, patch } from "./build-climate.mjs";

const ROOT   = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP    = resolve(ROOT, "index.html");
const RECORD = resolve(ROOT, "docs/climate-source.json");

const BASE      = "https://worldweather.wmo.int/en/json";
const CITY_LIST = `${BASE}/full_city_list.txt`;
const SOURCE    = "WMO World Weather Information Service (WWIS)";
const LICENCE   = "Acknowledgement to the WMO World Weather Information Service, and to the national meteorological service named per city, is required. Data reproduced accurately and unaltered.";
const NOTE      = "Gauge normals from national meteorological services. The normal period and the rain-day threshold vary by city — see docs/climate-source.json.";

/* An independent check on the same quantities. The WMO Climate Normals
   1991-2020 (the official CLINO, distributed by NOAA NCEI) publish mean
   precipitation days per station over a period that is uniform for every
   station — where WWIS's period varies by country. Comparing the two is a real
   check: same city, same quantity, different provider and different period.

   It is recorded, never substituted. Coverage is partial — 127 countries, and
   several of this app's presets are in countries the composite does not carry —
   so a city without a match records null and nothing else changes. */
const NORMALS_DIR = "https://www.ncei.noaa.gov/data/oceans/archive/arc0216/0253808/6.6/data/0-data/data-composite-primary-parameters";
const NORMALS_RAINDAYS = `${NORMALS_DIR}/wmo_normals_9120_DP01.csv`;
const NORMALS_NAME = "WMO Climate Normals 1991-2020, mean number of precipitation days (DP01), via NOAA NCEI";

/* Country names exactly as that file spells them, checked against its own
   country column rather than written from memory — it spells Turkey "Turkiye",
   and six of this app's countries are absent from it entirely. */
export const NORMALS_COUNTRY = {
  MY:"Malaysia", SG:"Singapore", ID:"Indonesia", PH:"Philippines", IN:"India",
  NG:"Nigeria", KE:"Kenya", UK:"United_Kingdom", IE:"Ireland", DE:"Germany",
  US:"United_States", CA:"Canada", NZ:"New_Zealand", AU:"Australia", TR:"Turkiye",
  GR:"Greece", MA:"Morocco", JO:"Jordan", IQ:"Iraq", EG:"Egypt",
  AE:"United_Arab_Emirates", QA:"Qatar", SA:"Saudi_Arabia", CO:"Colombia", CL:"Chile"
};

const DRY = process.argv.includes("--dry-run");
const normArg = process.argv[process.argv.indexOf("--normals") + 1];
const NORMALS = process.argv.includes("--normals") && normArg ? normArg : NORMALS_RAINDAYS;
const NO_NORMALS = process.argv.includes("--no-normals");

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

async function get(url, what) {
  const r = await fetch(url, { headers: { accept: "*/*" } });
  if (!r.ok) throw new Error(`${what}: ${r.status} ${r.statusText}`);
  return r.text();
}

/* ---- the cross-check table, loaded once ---- */
export const normKey = s => s.toLowerCase().replace(/[^a-z]/g, "");

export async function loadNormals(src) {
  const text = /^https?:/.test(src)
    ? await get(src, "WMO normals")
    : readFileSync(resolve(ROOT, src), "utf8");

  /* Fixed-ish CSV: Elem,Rgn,ID,WIGOS_ID,Latitude,Longitude,Elevation,Country,
     Station,Jan..Dec,Annual — fields padded with spaces, so everything is
     trimmed and nothing is positional beyond the column order. */
  const rows = text.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(",").map(f => f.trim()));
  const head = rows.shift();
  if (!head || head[7] !== "Country" || head[8] !== "Station")
    throw new Error(`unexpected columns: ${head && head.slice(0, 10).join(",")}`);

  return rows.filter(r => r.length > 21).map(r => ({
    country: r[7], station: r[8],
    lat: Number(r[4]), lon: Number(r[5]),
    months: r.slice(9, 21).map(Number),
    annual: Number(r[21])
  }));
}

export function matchNormals(table, city, cc) {
  const country = NORMALS_COUNTRY[cc];
  if (!country) return { status: "no country mapping for " + cc };
  const pool = table.filter(d => d.country === country);
  if (!pool.length) return { status: `country ${country} absent from the normals` };
  const n = normKey(city);
  const hits = pool.filter(d => normKey(d.station) === n);
  const loose = hits.length ? hits : pool.filter(d => normKey(d.station).includes(n));
  if (!loose.length) return { status: `no station named for ${city} among ${pool.length} in ${country}` };
  const d = loose[0];
  return {
    status: "matched",
    station: d.station, country: d.country, latitude: d.lat, longitude: d.lon,
    monthlyRainDays: d.months, annualRainDays: d.annual,
    candidates: loose.length
  };
}

/* ── run ──────────────────────────────────────────────────────────────────
   Guarded, so importing this module for its pure functions does not fire 29
   requests at WWIS. The same guard build-climate.mjs uses, and for the same
   reason: the matcher below is exactly where an "Athens, GR lands in Georgia"
   bug lives, so it has to be reachable from a test. */
const invokedDirectly = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) await main();

async function main() {
/* ---- the presets, read from the app rather than restated here ---- */
const html = readFileSync(APP, "utf8");
const block = html.match(/const CITIES = \[([\s\S]*?)\n\];/);
if (!block) { console.error("index.html: CITIES block not found"); process.exit(1); }
const presets = [...block[1].matchAll(/id:"([a-z]+)",\s*name:"([^"]+)",\s*zone:"([^"]+)"/g)]
  .map(m => {
    const [city, cc] = m[2].split(",").map(s => s.trim());
    return { id: m[1], name: m[2], zone: m[3], city, cc };
  });

console.log(`${SOURCE}`);
console.log(`${presets.length} presets read from index.html${DRY ? "   — DRY RUN, nothing will be written" : ""}\n`);

/* ---- 1. resolve every preset to a WWIS cityId ---- */
console.log("Fetching the city list …");
const listRaw = await get(CITY_LIST, "city list");
const lines = listRaw.split(/\r?\n/).filter(l => l.trim());
console.log(`  ${lines.length} lines\n`);

/* The separator is detected, not assumed: whatever splits the first line into
   the most fields wins, and the choice is printed so a wrong guess is visible. */
const seps = [[";", "semicolon"], [",", "comma"], ["\t", "tab"], ["|", "pipe"]];
const [sep, sepName] = seps.reduce((b, s) =>
  lines[0].split(s[0]).length > lines[0].split(b[0]).length ? s : b);
const rows = lines.map(l => l.split(sep).map(s => s.trim()));
console.log(`Separator detected: ${sepName} (${rows[0].length} fields). First line verbatim:`);
console.log(`  | ${lines[0]}\n`);

console.log("Resolving presets to WWIS cities:");
const resolved = [], unresolved = [];
for (const p of presets) {
  const needle = p.city.toLowerCase();
  const hit = rows.find(r => r.some(f => f.toLowerCase() === needle))
           || rows.find(r => r.some(f => f.toLowerCase().includes(needle)));
  const cityId = hit && hit.find(f => /^\d{1,6}$/.test(f));
  if (hit && cityId) {
    resolved.push({ ...p, cityId, listRow: hit.join(" | ") });
    console.log(`  ${p.name.padEnd(22)} id ${String(cityId).padStart(6)}   ${hit.join(" | ").slice(0, 70)}`);
  } else {
    unresolved.push(p);
    console.log(`  ${p.name.padEnd(22)} NOT FOUND`);
  }
}

if (unresolved.length) {
  console.error(`\n${unresolved.length} preset(s) not found in WWIS: ${unresolved.map(u => u.name).join(", ")}`);
  console.error(`WWIS covers selected cities only. A partial library cannot carry a`);
  console.error(`provenance record, so nothing is written. Either drop those presets`);
  console.error(`or source them separately — do not mix silently.`);
  process.exit(1);
}
console.log(`\nAll ${resolved.length} resolved.\n`);

/* ---- 2. the cross-check table ---- */
let normalsTable = null, normalsError = null;
if (NO_NORMALS) {
  console.log("Cross-check skipped (--no-normals).\n");
} else {
  process.stdout.write(`Loading the cross-check (${NORMALS_NAME}) … `);
  try {
    normalsTable = await loadNormals(NORMALS);
    console.log(`${normalsTable.length} stations`);
    console.log(`  ${[...new Set(normalsTable.map(d => d.country))].length} countries. Six of this app's` +
                ` countries are not among them; those cities simply record null.\n`);
  } catch (e) {
    normalsError = e.message;
    console.log(`FAILED — ${e.message}`);
    console.log(`  Continuing without it. The cross-check is a check, not a dependency.\n`);
  }
}

/* ---- 3. pull each city's normals ---- */
console.log("Downloading normals:\n");
const out = [], record = [], warnings = [];

for (const c of resolved) {
  process.stdout.write(`  ${c.name.padEnd(22)} `);
  try {
    const j = JSON.parse(await get(`${BASE}/${c.cityId}_en.json`, c.name));
    const city = j.city;
    if (!city) throw new Error("no `city` object");
    const cl = city.climate;
    if (!cl) throw new Error("no `city.climate`");
    const months = cl.climateMonth;
    if (!Array.isArray(months) || months.length !== 12)
      throw new Error(`climateMonth has ${Array.isArray(months) ? months.length : "no"} entries, expected 12`);

    const r = new Array(12).fill(null), rd = new Array(12).fill(null);
    for (const m of months) {
      const i = Number(m.month) - 1;
      if (!(i >= 0 && i < 12)) throw new Error(`month out of range: ${m.month}`);
      const rf = Number(m.rainfall), dy = Number(m.raindays);
      if (!isFinite(rf)) throw new Error(`month ${m.month}: rainfall is ${JSON.stringify(m.rainfall)}`);
      if (!isFinite(dy)) throw new Error(`month ${m.month}: raindays is ${JSON.stringify(m.raindays)}`);
      r[i] = Math.round(rf * 10) / 10;
      rd[i] = dy;
    }
    if (r.some(v => v === null)) throw new Error("not all twelve months present");

    const annual = r.reduce((s, v) => s + v, 0);
    const wetDays = rd.reduce((s, v) => s + v, 0);
    if (!(wetDays > 0)) throw new Error("annual rain days total zero — dpd undefined");
    const dpd = clamp(Math.round(annual / wetDays), 2, 30);

    out.push({ id: c.id, name: c.name, zone: c.zone,
               lat: Number(city.cityLatitude), lon: Number(city.cityLongitude),
               elev: null, dpd, r });

    record.push({
      id: c.id, name: c.name,
      wwis: { cityId: Number(city.cityId), cityName: city.cityName,
              stationName: city.stationName ?? null,
              latitude: city.cityLatitude, longitude: city.cityLongitude,
              listRow: c.listRow },
      supplier: { memId: city.member?.memId ?? null, memName: city.member?.memName ?? null,
                  orgName: city.member?.orgName ?? null, url: city.member?.url ?? null },
      normals: {
        raintype: cl.raintype ?? null,
        raindayThreshold: cl.raindef ?? null,
        raindayThresholdUnit: cl.rainunit ?? null,
        rainfallPeriod: (cl.rainfallb && cl.rainfalle) ? `${cl.rainfallb}-${cl.rainfalle}` : null,
        raindayPeriod:  (cl.rdayb && cl.rdaye)         ? `${cl.rdayb}-${cl.rdaye}`         : null,
        generalPeriod:  (cl.datab && cl.datae)         ? `${cl.datab}-${cl.datae}`         : null,
        fromCLINO: cl.climatefromclino ?? null
      },
      monthlyRainfallMm: r,
      monthlyRainDays: rd,
      crossCheck: normalsTable ? matchNormals(normalsTable, c.city, c.cc)
                               : { status: normalsError ? "not loaded: " + normalsError : "skipped" },
      annualMm: Math.round(annual * 10) / 10,
      annualRainDays: Math.round(wetDays * 10) / 10,
      dpd
    });

    /* Recorded, and said out loud. Neither is converted. */
    const def = Number(cl.raindef);
    if (isFinite(def) && def !== 1)
      warnings.push(`${c.name}: rain days counted at >= ${cl.raindef} ${cl.rainunit ?? ""}`.trim() +
                    `, not the 1 mm the app assumes — dpd means something slightly different here`);
    if (cl.raintype && /snow|precipitation/i.test(cl.raintype) && !/^rainfall$/i.test(cl.raintype))
      warnings.push(`${c.name}: raintype is "${cl.raintype}" — may include snow, which a roof does not collect when it falls`);

    console.log(`${String(Math.round(annual)).padStart(5)} mm/yr  ${String(Math.round(wetDays)).padStart(3)} days  dpd ${String(dpd).padStart(2)}  ` +
                `${record.at(-1).normals.rainfallPeriod ?? "period?"}`);
  } catch (e) {
    console.log(`FAILED — ${e.message}`);
    record.push({ id: c.id, name: c.name, error: e.message });
  }
  await new Promise(r => setTimeout(r, 300));
}

const failed = record.filter(x => x.error);
if (failed.length) {
  console.error(`\n${failed.length} city/cities failed: ${failed.map(f => f.name).join(", ")}`);
  console.error(`A half-sourced library is worse than none — you cannot tell which rows`);
  console.error(`are which. Nothing written.`);
  process.exit(1);
}

/* ---- 3. what varies, stated before anything is written ---- */
/* The cross-check, reported as a spread rather than a pass/fail. WWIS and the
   normals may count a rain day at different thresholds and over different
   periods, so they are not expected to agree exactly — a large gap is a
   prompt to look, not a verdict. */
console.log(`\nCross-check against the WMO Climate Normals 1991-2020:\n`);
let checked = 0, wide = 0;
for (const c of record) {
  const x = c.crossCheck || {};
  if (x.status !== "matched") { console.log(`  ${c.name.padEnd(22)} —   ${x.status || "no check"}`); continue; }
  checked++;
  const diff = x.annualRainDays > 0 ? (c.annualRainDays - x.annualRainDays) / x.annualRainDays : null;
  const pct = diff === null ? "  n/a" : `${diff >= 0 ? "+" : ""}${Math.round(diff * 100)}%`;
  const flag = diff !== null && Math.abs(diff) > 0.25 ? "  <-- look at this one" : "";
  if (flag) wide++;
  console.log(`  ${c.name.padEnd(22)} WWIS ${String(Math.round(c.annualRainDays)).padStart(3)} d/yr` +
              `   normals ${String(Math.round(x.annualRainDays)).padStart(3)} d/yr  (${x.station})  ${pct}${flag}`);
}
console.log(`\n  ${checked} of ${record.length} cities cross-checked; ${wide} differ by more than 25%.`);
if (wide) console.log(`  A wide gap usually means a different rain-day threshold or a different`);
if (wide) console.log(`  station, not an error. Check the raindef recorded for those cities.`);

const periods = [...new Set(record.map(c => c.normals.rainfallPeriod).filter(Boolean))].sort();
const thresholds = [...new Set(record.map(c => `${c.normals.raindayThreshold} ${c.normals.raindayThresholdUnit ?? ""}`.trim()))];

console.log(`\nNormal periods present: ${periods.join(", ") || "none declared"}`);
console.log(`Rain-day thresholds present: ${thresholds.join(", ") || "none declared"}`);
if (warnings.length) {
  console.log(`\n${warnings.length} thing(s) to know — recorded, not adjusted:`);
  for (const w of warnings) console.log(`  · ${w}`);
}

const windowLabel = periods.length === 1
  ? periods[0]
  : `varies by city (${periods[0]} to ${periods.at(-1)}) — see docs/climate-source.json`;

const meta = {
  name: SOURCE,
  endpoint: `${BASE}/{cityId}_en.json`,
  cityList: CITY_LIST,
  window: windowLabel,
  accessed: new Date().toISOString().slice(0, 10),
  licence: LICENCE,
  note: NOTE,
  acknowledgement: "Data from the WMO World Weather Information Service (worldweather.wmo.int), supplied by the national meteorological and hydrological service named against each city.",
  reduction: "r[] is climateMonth[].rainfall as published; dpd = annual rainfall / annual raindays, rounded, clamped 2-30. The rain-day threshold is whatever the supplying service declares in raindef and is recorded per city; it is NOT converted to the app's 1 mm rule.",
  generator: "tools/build-climate-wwis.mjs",
  cross_check: {
    name: NORMALS_NAME,
    endpoint: NORMALS,
    what: "Mean number of precipitation days per station, 1991-2020, recorded beside each city where the composite carries its country. An independent check on the same quantity over a uniform period — nothing in the app is calculated from it.",
    loaded: normalsTable ? `${normalsTable.length} stations` : (normalsError ? `failed: ${normalsError}` : "skipped"),
    matched: record.filter(c => c.crossCheck && c.crossCheck.status === "matched").length,
    caveat: "WWIS and the normals may define a precipitation day at different thresholds; a difference between them is not in itself an error."
  },
  periods_present: periods,
  rainday_thresholds_present: thresholds,
  warnings
};

if (DRY) {
  console.log(`\nDry run: index.html and docs/climate-source.json unchanged.`);
  process.exit(0);
}

writeFileSync(APP, patch(html, out, meta));
writeFileSync(RECORD, JSON.stringify({ ...meta, cities: record }, null, 2) + "\n");

console.log(`\nWritten:`);
console.log(`  index.html               CITIES and CLIMATE_SOURCE`);
console.log(`  docs/climate-source.json provenance, per-city periods and thresholds`);
console.log(`\nEvery figure quoted in docs/method-notes.html and pinned in the test`);
console.log(`suites was measured on the old data and is now stale. Re-derive them`);
console.log(`by measurement — do not edit them to fit.`);
}
