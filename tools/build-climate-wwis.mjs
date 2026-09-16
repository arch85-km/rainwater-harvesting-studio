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
const SOURCE    = "WMO Climate Normals 1991-2020 (NOAA NCEI) where available; WMO World Weather Information Service (WWIS) otherwise";
export const LICENCE   = "WMO Climatological Standard Normals 1991-2020, NCEI Accession 0253808, CC0 1.0. For the cities from the WMO World Weather Information Service its terms apply: \u201cAcknowledgement must be given to the WMO World Weather Information Service (https://worldweather.wmo.int) as the source of information\u201d and \u201cThe forecast and climatological information of the WWIS website must be reproduced accurately\u201d.";
export const NOTE      = "Gauge normals. Most cities use the WMO Climate Normals 1991-2020; the rest come from WWIS, where the period and the rain-day threshold vary by city. Each city records which — see docs/climate-source.json.";

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
const NORMALS_RAINFALL = `${NORMALS_DIR}/wmo_normals_9120_PRCP.csv`;
const NORMALS_NAME = "WMO Climatological Standard Normals 1991-2020 (PRCP and DP01), NOAA NCEI Accession 0253808 v6.6, https://doi.org/10.25921/800j-vn07";

/* The dataset's missing-month marker. 525 of PRCP's values and 186 of DP01's
   carry it, and it is negative, so summing a series without rejecting it
   produces a negative annual rainfall — Toronto_City is missing April, August
   and December and totals -99.9 mm a year. A station missing any month cannot
   supply a twelve-month profile and is dropped, not patched. */
const MISSING = -99.9;
const isMissing = v => !isFinite(v) || Math.abs(v - MISSING) < 1e-9;

/* Country names exactly as that file spells them, checked against its own
   country column rather than written from memory — it spells Turkey "Turkiye",
   and six of this app's countries are absent from it entirely. */
export const NORMALS_COUNTRY = {
  MY:"Malaysia", SG:"Singapore", ID:"Indonesia", PH:"Philippines", IN:"India",
  NG:"Nigeria", KE:"Kenya", UK:"United_Kingdom", IE:"Ireland", DE:"Germany",
  BD:"Bangladesh",
  US:"United_States", CA:"Canada", NZ:"New_Zealand", AU:"Australia", TR:"Turkiye",
  GR:"Greece", MA:"Morocco", JO:"Jordan", IQ:"Iraq", EG:"Egypt",
  AE:"United_Arab_Emirates", QA:"Qatar", SA:"Saudi_Arabia", CO:"Colombia", CL:"Chile"
};

const DRY = process.argv.includes("--dry-run");
const argAfter = flag => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};
const NORMALS_RAIN = argAfter("--normals-rainfall") || NORMALS_RAINFALL;
const NORMALS_DAYS = argAfter("--normals-raindays") || NORMALS_RAINDAYS;
const NO_NORMALS = process.argv.includes("--no-normals");

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

async function get(url, what) {
  const r = await fetch(url, { headers: { accept: "*/*" } });
  if (!r.ok) throw new Error(`${what}: ${r.status} ${r.statusText}`);
  return r.text();
}

/* WWIS country names, taken from a real run's output rather than guessed —
   it writes the United Kingdom out in full and spells Türkiye with the umlaut.

   Without this filter the matcher took the first city of a given name in the
   whole list, and put Toronto, Canada in New South Wales: WWIS has a Toronto in
   Australia and none in Canada, so the wrong one was not merely preferred, it
   was the only one. Santiago matched three — Chile, the Dominican Republic and
   Panama — and got Chile by luck. A city that cannot be found in its own
   country now fails loudly instead of being silently relocated. */
export const WWIS_COUNTRY = {
  MY: "Malaysia", SG: "Singapore", ID: "Indonesia", PH: "Philippines",
  BD: "Bangladesh", NG: "Nigeria", KE: "Kenya",
  UK: "United Kingdom of Great Britain and Northern Ireland",
  IE: "Ireland", DE: "Germany", US: "United States of America",
  CA: "Canada", NZ: "New Zealand", AU: "Australia", TR: "Türkiye",
  GR: "Greece", MA: "Morocco", JO: "Jordan", IQ: "Iraq", EG: "Egypt",
  AE: "United Arab Emirates", QA: "Qatar", SA: "Saudi Arabia",
  CO: "Colombia", CL: "Chile"
};

/* WWIS gives the normal period in up to three places, and most cities fill in
   none of them. Reporting only rainfallb/e made almost every city print
   "period?" when a general period was often present — a misleading diagnostic,
   and the reason the first full run looked worse than it was. This returns the
   most specific period available and says which field it came from, so an
   undeclared period is distinguishable from one this code failed to look for. */
export function bestPeriod(cl) {
  const span = (b, e) => (b && e) ? `${b}-${e}` : null;
  const rainfall = span(cl.rainfallb, cl.rainfalle);
  if (rainfall) return { period: rainfall, from: "rainfallb/rainfalle" };
  const general = span(cl.datab, cl.datae);
  if (general) return { period: general, from: "datab/datae" };
  if (cl.climatefromclino) return { period: String(cl.climatefromclino), from: "climatefromclino" };
  return { period: null, from: "not declared" };
}

/* ---- the WWIS city list ----

   The real format, from a run rather than from a guess:

     "Country";"City";"CityId"
     "Afghanistan";"Kabul";"1"

   Semicolon-separated and every field wrapped in double quotes. The first
   version of this compared an unquoted city name against a quoted field, so
   nothing matched and all 28 presets reported NOT FOUND — a failure that was at
   least loud, because the generator refuses to write a partial library.

   Columns are located by their header name rather than by position, so a
   reordering upstream is survivable; a missing column is not, and says so. */
export function parseCityList(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error("city list is empty");

  const seps = [";", ",", "\t", "|"];
  const sep = seps.reduce((b, c) => lines[0].split(c).length > lines[0].split(b).length ? c : b);

  const unquote = f => f.trim().replace(/^"(.*)"$/s, "$1").trim();
  const split = l => l.split(sep).map(unquote);

  const head = split(lines[0]).map(h => h.toLowerCase());
  const at = name => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`city list has no "${name}" column — found: ${head.join(", ")}`);
    return i;
  };
  const ci = at("country"), cy = at("city"), id = at("cityid");

  const rows = [];
  for (const line of lines.slice(1)) {
    const f = split(line);
    if (f.length <= Math.max(ci, cy, id)) continue;
    if (!f[id]) continue;
    rows.push({ country: f[ci], city: f[cy], cityId: f[id] });
  }
  if (!rows.length) throw new Error("city list parsed to no rows");
  return { separator: sep === "\t" ? "tab" : sep, columns: head, rows };
}

/* A preset's city name against the list. WWIS names are the plain city, so an
   exact match is the norm; the loose pass is a fallback for "Kuala Lumpur" vs
   "Kuala_Lumpur" style differences. Country is not filtered on here because the
   preset label carries an ISO code and the list carries a country name, and
   inventing that mapping is how "Athens, GR" ends up in Georgia — instead every
   candidate is returned and an ambiguous city is reported rather than guessed. */
export function findCity(list, city, cc) {
  const n = normKey(city);
  const byName = list.rows.filter(r => normKey(r.city) === n).length
    ? list.rows.filter(r => normKey(r.city) === n)
    : list.rows.filter(r => normKey(r.city).includes(n));

  if (!cc) return byName;

  const country = WWIS_COUNTRY[cc];
  if (!country) return { error: `no WWIS country name mapped for ${cc}` };

  const inCountry = byName.filter(r => normKey(r.country) === normKey(country));
  if (inCountry.length) return inCountry;

  /* Found the name, but never in the right country. Saying where it WAS found
     is the difference between a puzzling failure and an obvious one. */
  return { error: byName.length
    ? `${city} is not in ${country} in WWIS — found only in ${[...new Set(byName.map(r => r.country))].join(", ")}`
    : `${city} is not in the WWIS city list at all` };
}

/* ---- the cross-check table, loaded once ---- */
export const normKey = s => s.toLowerCase().replace(/[^a-z]/g, "");

export async function loadNormals(src, read) {
  const text = /^https?:/.test(src)
    ? await (read || get)(src, "WMO normals")
    : readFileSync(resolve(ROOT, src), "utf8");

  /* Elem,Rgn,ID,WIGOS_ID,Latitude,Longitude,Elevation,Country,Station,
     Jan..Dec,Annual — space-padded, so every field is trimmed. */
  const rows = text.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(",").map(f => f.trim()));
  const head = rows.shift();
  if (!head || head[7] !== "Country" || head[8] !== "Station")
    throw new Error(`unexpected columns: ${head && head.slice(0, 10).join(",")}`);

  const out = new Map();
  for (const r of rows) {
    if (r.length < 22) continue;
    const months = r.slice(9, 21).map(Number);
    out.set(r[2], {
      id: r[2], country: r[7], station: r[8],
      lat: Number(r[4]), lon: Number(r[5]), elev: Number(r[6]),
      months,
      complete: months.every(v => !isMissing(v)),
      annual: months.every(v => !isMissing(v)) ? months.reduce((a, b) => a + b, 0) : null
    });
  }
  return out;
}

/* Both halves, keyed by WMO station id. A station is only usable if BOTH files
   carry it with all twelve months intact. */
export async function loadNormalsPair(rainfallSrc, raindaySrc, read) {
  const [rain, days] = await Promise.all([
    loadNormals(rainfallSrc, read), loadNormals(raindaySrc, read)
  ]);
  const out = [];
  for (const [id, p] of rain) {
    const d = days.get(id);
    if (!d) continue;
    out.push({
      id, country: p.country, station: p.station, lat: p.lat, lon: p.lon, elev: p.elev,
      rainfallMonths: p.months, raindayMonths: d.months,
      annualMm: p.annual, annualDays: d.annual,
      complete: p.complete && d.complete
    });
  }
  return out;
}

/* Every valid station for the city, not one arbitrary pick.

   Five of this app's presets have more than one station and the choice moves
   the number a long way: Berlin has four, Sydney three. Choosing "the first
   match" is arbitrary and unreproducible, and for a cross-check there is no
   need to choose at all — the honest output is the span across the candidates,
   which is itself information about how well any single station represents
   the city. */
/* Great-circle distance, km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, p = Math.PI / 180;
  const h = Math.sin((lat2 - lat1) * p / 2) ** 2 +
            Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lon2 - lon1) * p / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* How far a station may be from the city and still be taken to represent it. */
export const NEAR_KM = 25;

/* How far a proximity-matched station's annual total may sit from the city's
   own published figure before it is treated as a different place. */
export const NEAR_DISAGREE = 0.40;

export function matchNormals(table, city, cc, near) {
  const country = NORMALS_COUNTRY[cc];
  if (!country) return { status: "no country mapping for " + cc };
  const pool = table.filter(d => d.country === country);
  if (!pool.length) return { status: `country ${country} absent from the normals` };

  const n = normKey(city);
  const named = pool.filter(d => normKey(d.station) === n);
  let cands = named.length ? named : pool.filter(d => normKey(d.station).includes(n));

  /* A station need not carry its city's name: Singapore's is "ChangiAirport".
     Where a country contributes exactly one station there is nothing to choose
     between, so the name is not required — but the fact that the match was made
     on the country rather than the name is reported, because it is a weaker
     claim and a reader should be able to see which kind of match they have. */
  let matchedBy = named.length ? "exact name" : (cands.length ? "partial name" : null);
  if (!cands.length && pool.length === 1) { cands = pool; matchedBy = "sole station in country"; }

  /* A station is often not named for the city it serves: Kuala Lumpur's is
     Subang, 2 km away, and Jakarta's is Stasiun Meteorologi Kemayoran at 5 km.
     Where the city's coordinates are known, the nearest usable station within
     NEAR_KM is taken and the distance recorded, so a reader can judge it.

     Distance alone is not enough in mountains — Bogota sits at 2,600 m and the
     nearest station 12 km away reads 64% wetter, because it is down-valley in a
     different regime. The caller compares the two annual totals and rejects a
     match that disagrees wildly; this function only reports the distance. */
  let nearestKm = null;
  if (!cands.length && near && isFinite(near.lat) && isFinite(near.lon)) {
    const usable = pool.filter(d => d.complete);
    if (usable.length) {
      const best = usable.reduce((a, b) =>
        distanceKm(near.lat, near.lon, a.lat, a.lon) <= distanceKm(near.lat, near.lon, b.lat, b.lon) ? a : b);
      const km = distanceKm(near.lat, near.lon, best.lat, best.lon);
      if (km <= NEAR_KM) { cands = [best]; matchedBy = `nearest station, ${km.toFixed(0)} km`; nearestKm = km; }
    }
  }

  if (!cands.length) return { status: `no station named for ${city} among ${pool.length} in ${country}` };

  const usable = cands.filter(d => d.complete);
  if (!usable.length)
    return { status: `every candidate has missing months: ${cands.map(d => d.station).join(", ")}`,
             rejected: cands.map(d => d.station) };

  /* The WMO station number, not just the name. "London" in this file is a
     station, and Heathrow is a different row 2 km away with a different figure —
     so a name alone does not identify what a preset was built from. Elevation
     comes too: it is what makes a nearby station wrong in mountains. */
  const stations = usable.map(d => ({
    station: d.station, wmoStationId: d.id,
    latitude: d.lat, longitude: d.lon, elevationM: d.elev,
    annualMm: Math.round(d.annualMm * 10) / 10,
    annualRainDays: Math.round(d.annualDays * 10) / 10,
    dpd: d.annualDays > 0 ? Math.min(30, Math.max(2, Math.round(d.annualMm / d.annualDays))) : null
  })).sort((a, b) => a.station.localeCompare(b.station));

  const mm = stations.map(x => x.annualMm);
  return {
    status: "matched",
    country,
    matchedBy,
    nearestKm,
    stations,
    annualMmRange: [Math.min(...mm), Math.max(...mm)],
    rejectedForMissingMonths: cands.filter(d => !d.complete).map(d => d.station)
  };
}

/* ── run ──────────────────────────────────────────────────────────────────
   Guarded, so importing this module for its pure functions does not fire 29
   requests at WWIS. The same guard build-climate.mjs uses, and for the same
   reason: the matcher above is exactly where an "Athens, GR lands in Georgia"
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
const list = parseCityList(await get(CITY_LIST, "city list"));
console.log(`  ${list.rows.length} cities, ${list.separator}-separated, columns: ${list.columns.join(", ")}\n`);

console.log("Resolving presets to WWIS cities:");
const resolved = [], unresolved = [], ambiguous = [];
for (const p of presets) {
  const hits = findCity(list, p.city, p.cc);
  if (hits.error) {
    unresolved.push({ ...p, why: hits.error });
    console.log(`  ${p.name.padEnd(22)} ${hits.error}`);
    continue;
  }
  if (!hits.length) {
    unresolved.push({ ...p, why: "not in the city list" });
    console.log(`  ${p.name.padEnd(22)} NOT FOUND`);
    continue;
  }
  /* More than one country has a Springfield. The preset label carries an ISO
     code and the list a country name, so rather than invent a mapping between
     them the ambiguity is printed and the first is taken — with every candidate
     recorded, so the choice is auditable instead of invisible. */
  if (hits.length > 1) ambiguous.push({ preset: p.name, hits });
  const h = hits[0];
  resolved.push({ ...p, cityId: h.cityId, wwisCountry: h.country, wwisCity: h.city,
                  candidates: hits.map(x => `${x.city}, ${x.country} (${x.cityId})`) });
  console.log(`  ${p.name.padEnd(22)} id ${String(h.cityId).padStart(6)}   ${h.city}, ${h.country}` +
              (hits.length > 1 ? `   ${hits.length} candidates` : ""));
}

if (ambiguous.length) {
  console.log(`\n${ambiguous.length} preset(s) matched more than one WWIS city — first taken, all recorded:`);
  for (const a of ambiguous) console.log(`  ${a.preset}: ${a.hits.map(h => `${h.city}, ${h.country}`).join(" | ")}`);
}

if (unresolved.length) {
  console.error(`\n${unresolved.length} preset(s) could not be resolved in WWIS:`);
  for (const u of unresolved) console.error(`  ${u.name.padEnd(22)} ${u.why}`);
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
    normalsTable = await loadNormalsPair(NORMALS_RAIN, NORMALS_DAYS);
    const complete = normalsTable.filter(d => d.complete).length;
    console.log(`${normalsTable.length} stations in both files, ${complete} with all twelve months`);
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

    let annual = r.reduce((s, v) => s + v, 0);
    let wetDays = rd.reduce((s, v) => s + v, 0);
    let from = "wwis";

    /* Some national services publish rainfall but no precipitation-day counts,
       which leaves dpd undefined. Where that happens the whole city falls back
       to the WMO Climate Normals rather than borrowing only the missing half:
       rainfall from one provider and rain days from another, for one city, over
       two different periods, is a number nobody could describe in a sentence.
       Whole-city fallback keeps each city internally consistent, and which
       source served it is recorded per city. */
    /* The normals lead where they reach.

       WWIS is city-curated and covers every preset, which is why it was chosen
       first. Running it showed why that was wrong: its rain-day threshold is
       declared as 0.001 mm in Baghdad, 0.01 in Cairo, 0.2 in Dubai and not at
       all in sixteen cities, against the 1 mm this app assumes — so dpd is not
       comparable between cities. Its normal periods run from 1929-2000 to
       1991-2020. The WMO Climate Normals are one period and one definition for
       every station, so where they carry a city they are the better source, and
       WWIS covers the rest with its period and threshold recorded per city.

       Where a city has several stations the alphabetically first is taken and
       every candidate is recorded. That choice is arbitrary and is labelled
       arbitrary; Berlin's four span 9% on the annual total and agree exactly on
       dpd, which is the figure the app uses. */
    const alt = normalsTable
      ? matchNormals(normalsTable, c.city, c.cc,
          { lat: Number(city.cityLatitude), lon: Number(city.cityLongitude) })
      : { status: "no normals loaded" };
    let prefer = alt.status === "matched" ? alt.stations[0] : null;

    /* A station matched only by proximity has to earn it. If its annual total
       disagrees with what the city's own service publishes by more than
       NEAR_DISAGREE, it is probably not representing the same place —
       Bogota's nearest station is 12 km away and 64% wetter, because the city
       is at 2,600 m and the station is not. Rejected, recorded, and WWIS keeps
       the city. A name or sole-station match is not subjected to this: there
       the identification is not in doubt, only the gauge. */
    if (prefer && alt.matchedBy && alt.matchedBy.startsWith("nearest") && annual > 0) {
      const gap = Math.abs(prefer.annualMm - annual) / annual;
      if (gap > NEAR_DISAGREE) {
        warnings.push(`${c.name}: nearest normals station ${prefer.station} is ${alt.nearestKm.toFixed(0)} km away ` +
          `but reads ${Math.round(prefer.annualMm)} mm against WWIS's ${Math.round(annual)} mm ` +
          `(${Math.round(gap * 100)}% apart) — not adopted, WWIS kept`);
        alt.rejectedAsUnrepresentative = { station: prefer.station, km: alt.nearestKm,
                                           normalsMm: prefer.annualMm, wwisMm: Math.round(annual) };
        prefer = null;
      }
    }

    if (prefer) {
      const src = normalsTable.find(d => d.station === prefer.station);
      r.length = 0; r.push(...src.rainfallMonths.map(v => Math.round(v * 10) / 10));
      rd.length = 0; rd.push(...src.raindayMonths);
      annual = r.reduce((s, v) => s + v, 0);
      wetDays = rd.reduce((s, v) => s + v, 0);
      if (!(wetDays > 0)) throw new Error(`the normals station ${prefer.station} has no rain days`);
      from = `wmo-normals:${prefer.station} (WMO ${prefer.wmoStationId})` +
             (alt.stations.length > 1 ? ` (1 of ${alt.stations.length}, chosen alphabetically)` : "");
    } else if (!(wetDays > 0)) {
      throw new Error(`WWIS has no rain days and the normals cannot supply them (${alt.status})`);
    }
    const dpd = clamp(Math.round(annual / wetDays), 2, 30);

    out.push({ id: c.id, name: c.name, zone: c.zone,
               lat: Number(city.cityLatitude), lon: Number(city.cityLongitude),
               elev: null, dpd, r });

    record.push({
      id: c.id, name: c.name,
      wwis: { cityId: Number(city.cityId), cityName: city.cityName,
              stationName: city.stationName ?? null,
              latitude: city.cityLatitude, longitude: city.cityLongitude,
              candidates: c.candidates,
              listCountry: c.wwisCountry, listCity: c.wwisCity },
      supplier: { memId: city.member?.memId ?? null, memName: city.member?.memName ?? null,
                  orgName: city.member?.orgName ?? null, url: city.member?.url ?? null },
      normals: {
        raintype: cl.raintype ?? null,
        raindayThreshold: cl.raindef ?? null,
        raindayThresholdUnit: cl.rainunit ?? null,
        period: bestPeriod(cl).period,
        periodFrom: bestPeriod(cl).from,
        rainfallPeriod: (cl.rainfallb && cl.rainfalle) ? `${cl.rainfallb}-${cl.rainfalle}` : null,
        raindayPeriod:  (cl.rdayb && cl.rdaye)         ? `${cl.rdayb}-${cl.rdaye}`         : null,
        generalPeriod:  (cl.datab && cl.datae)         ? `${cl.datab}-${cl.datae}`         : null,
        fromCLINO: cl.climatefromclino ?? null
      },
      sourcedFrom: from,
      monthlyRainfallMm: r,
      monthlyRainDays: rd,
      /* `alt` — the match that was actually made — and not a second call.
         This used to re-run matchNormals without the city's coordinates, so
         the record showed the result of a name-only search while the data
         came from a proximity match the record never mentioned. Kuala Lumpur
         read "sourcedFrom: wmo-normals:Subang (WMO 00048647)" beside
         "no station named for Kuala Lumpur among 15 in Malaysia", and the
         distance that justified Subang was recorded nowhere. Bogota lost the
         reason its nearest gauge was refused. Record what happened. */
      crossCheck: normalsTable ? alt
                               : { status: normalsError ? "not loaded: " + normalsError : "skipped" },
      annualMm: Math.round(annual * 10) / 10,
      annualRainDays: Math.round(wetDays * 10) / 10,
      dpd
    });

    /* Recorded, and said out loud. Neither is converted. Only relevant for
       cities the normals could not serve — the rest carry the normals' single
       definition, whatever the WWIS record happens to say. */
    const def = from === "wwis" ? Number(cl.raindef) : NaN;
    if (isFinite(def) && def !== 1)
      warnings.push(`${c.name}: rain days counted at >= ${cl.raindef} ${cl.rainunit ?? ""}`.trim() +
                    `, not the 1 mm the app assumes — dpd means something slightly different here`);
    if (from === "wwis" && cl.raintype && /snow|precipitation/i.test(cl.raintype) && !/^rainfall$/i.test(cl.raintype))
      warnings.push(`${c.name}: raintype is "${cl.raintype}" — may include snow, which a roof does not collect when it falls`);

    console.log(`${String(Math.round(annual)).padStart(5)} mm/yr  ${String(Math.round(wetDays)).padStart(3)} days  dpd ${String(dpd).padStart(2)}  ` +
                `${from === "wwis" ? (record.at(-1).normals.period ?? "no period declared")
                                  : "via " + from}`);
  } catch (e) {
    console.log(`FAILED — ${e.message}`);
    record.push({ id: c.id, name: c.name, error: e.message });
  }
  await new Promise(r => setTimeout(r, 300));
}

const failed = record.filter(x => x.error);
if (failed.length) {
  console.log(`\n${failed.length} of ${record.length} cities could not be used:\n`);
  for (const f of failed) console.log(`  ${f.name.padEnd(22)} ${f.error}`);

  /* Where WWIS has rainfall but no rain days, the cross-check may still carry a
     rain-day count for the same city. Whether to use it is a judgement — it
     would mean one city's two numbers coming from two providers — so it is
     reported here and decided deliberately, not taken automatically. */
  if (normalsTable) {
    console.log(`\n  Does the WMO Climate Normals cross-check have rain days for them?`);
    for (const f of failed) {
      const p = presets.find(x => x.name === f.name);
      const x = p ? matchNormals(normalsTable, p.city, p.cc) : { status: "?" };
      console.log(`  ${f.name.padEnd(22)} ${x.status === "matched"
        ? x.stations.map(st => `${st.station} ${st.annualRainDays} d/yr`).join(" | ")
        : x.status}`);
    }
  }

  if (!DRY) {
    console.error(`\nA half-sourced library is worse than none — you cannot tell which rows`);
    console.error(`are which. Nothing written.`);
    process.exit(1);
  }
  console.log(`\n  Dry run: surveying the rest rather than stopping here.`);
}

/* ---- 3. what varies, stated before anything is written ---- */
/* Declared before it is used. The first version of this sat below the loop
   that reads it, which is a temporal-dead-zone error that syntax checking
   cannot see and importing the module does not reach, because main() only runs
   when the file is invoked directly. It took a runner to find it. */
const usable = record.filter(c => !c.error);

/* The cross-check, reported as a spread rather than a pass/fail. WWIS and the
   normals may count a rain day at different thresholds and over different
   periods, so they are not expected to agree exactly — a large gap is a
   prompt to look, not a verdict. */
console.log(`\nCross-check against the WMO Climate Normals 1991-2020:\n`);
let checked = 0, wide = 0;
for (const c of usable) {
  const x = c.crossCheck || {};
  if (x.status !== "matched") { console.log(`  ${c.name.padEnd(22)} —   ${x.status || "no check"}`); continue; }
  checked++;
  const [lo, hi] = x.annualMmRange;
  const span = lo === hi ? `${Math.round(lo)}` : `${Math.round(lo)}-${Math.round(hi)}`;
  /* Compared against the nearest end of the span: a city with several stations
     genuinely has a range, and calling WWIS wrong for sitting inside it would
     be the wrong conclusion. */
  const gap = c.annualMm < lo ? (c.annualMm - lo) / lo
            : c.annualMm > hi ? (c.annualMm - hi) / hi : 0;
  const pct = `${gap >= 0 ? "+" : ""}${Math.round(gap * 100)}%`;
  const flag = Math.abs(gap) > 0.25 ? "  <-- look at this one" : "";
  if (flag) wide++;
  const names = x.stations.length > 1 ? `  [${x.stations.length} stations]` : `  (${x.stations[0].station})`;
  console.log(`  ${c.name.padEnd(22)} WWIS ${String(Math.round(c.annualMm)).padStart(5)} mm/yr` +
              `   normals ${span.padStart(9)} mm/yr  ${pct.padStart(5)}${names}${flag}`);
  if (x.rejectedForMissingMonths?.length)
    console.log(`  ${"".padEnd(22)} dropped for missing months: ${x.rejectedForMissingMonths.join(", ")}`);
}
console.log(`\n  ${checked} of ${usable.length} cities cross-checked; ${wide} outside the normals' own range by more than 25%.`);
if (wide) console.log(`  A wide gap usually means a different rain-day threshold, a different`);
if (wide) console.log(`  period or a different station — check the raindef recorded for those.`);

const periods = [...new Set(usable.map(c => c.normals.period).filter(Boolean))].sort();
const undeclared = usable.filter(c => !c.normals.period).length;
const thresholds = [...new Set(usable.map(c => `${c.normals.raindayThreshold ?? "none"} ${c.normals.raindayThresholdUnit ?? ""}`.trim()))];

console.log(`\nNormal periods declared: ${periods.join(", ") || "none"}`);
if (undeclared) console.log(`${undeclared} of ${usable.length} cities declare no period at all.`);
console.log(`Rain-day thresholds present: ${thresholds.join(", ") || "none declared"}`);
if (warnings.length) {
  console.log(`\n${warnings.length} thing(s) to know — recorded, not adjusted:`);
  for (const w of warnings) console.log(`  · ${w}`);
}

const fromNormals = usable.filter(c => c.sourcedFrom && c.sourcedFrom.startsWith("wmo-normals")).length;
const fromWwis = usable.length - fromNormals;
const windowLabel = fromWwis === 0
  ? "1991-2020"
  : `1991-2020 for ${fromNormals} cities; ${fromWwis} from WWIS over other periods — see docs/climate-source.json`;

const meta = {
  name: SOURCE,
  endpoint: `${BASE}/{cityId}_en.json`,
  cityList: CITY_LIST,
  window: windowLabel,
  accessed: new Date().toISOString().slice(0, 10),
  licence: LICENCE,
  note: NOTE,
  acknowledgement: "Data from the WMO World Weather Information Service (worldweather.wmo.int), supplied by the national meteorological and hydrological service named against each city. WWIS is operated on behalf of WMO by the Hong Kong Observatory; the acknowledgement condition names WWIS, not the operator.",
  reduction: "r[] is climateMonth[].rainfall as published; dpd = annual rainfall / annual raindays, rounded, clamped 2-30. The rain-day threshold is whatever the supplying service declares in raindef and is recorded per city; it is NOT converted to the app's 1 mm rule.",
  generator: "tools/build-climate-wwis.mjs",
  cross_check: {
    name: NORMALS_NAME,
    endpoint: { rainfall: NORMALS_RAIN, raindays: NORMALS_DAYS },
    what: "The stations this city's country contributes, 1991-2020, with the WMO number, elevation and annual figures of each. Read it beside sourcedFrom: where that names a wmo-normals station, these ARE the source and stations[0] is the one used; where it says wwis, they are an independent comparison and nothing in the app is calculated from them.",
    loaded: normalsTable ? `${normalsTable.length} stations in both files` : (normalsError ? `failed: ${normalsError}` : "skipped"),
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
