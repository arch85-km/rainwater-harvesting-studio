/* Stand in for WWIS and NOAA so the generator can be RUN, not merely imported.
 *
 * Three runs failed on the author's machine-that-isn't: a quoting bug, then a
 * temporal-dead-zone error. Neither could be caught by `node --check`, which
 * only parses, or by `npm test`, which imports the module but never calls
 * main() — main() is guarded so that importing it does not fire 29 requests.
 * So the whole procedural half had never executed anywhere except a GitHub
 * runner, and every bug in it cost a round trip.
 *
 * Installed with `node --import`, this replaces global fetch with canned
 * responses shaped like the real ones — the city list with its quoting intact,
 * city records matching the published WWIS schema, and the two normals CSVs
 * read from disk when present. Then `node tools/build-climate-wwis.mjs
 * --dry-run` exercises the real code path end to end, offline, in a second.
 *
 * It is a stand-in, not a simulator: it proves the code runs and its logic
 * holds together. Only a real run proves the data.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

/* The country names are read out of the generator's source rather than imported
   from it. Importing would execute the module, and because this file is loaded
   with --import while the generator is the entry point, its main() would fire
   before the fetch stub below is installed — and reach the real network. Reading
   the text keeps the two in step without running anything. */
const genSrc = readFileSync(resolve(ROOT, "tools/build-climate-wwis.mjs"), "utf8");
const WWIS_COUNTRY = Object.fromEntries(
  [...genSrc.slice(genSrc.indexOf("export const WWIS_COUNTRY"))
            .slice(0, genSrc.slice(genSrc.indexOf("export const WWIS_COUNTRY")).indexOf("};"))
            .matchAll(/([A-Z]{2}):\s*"([^"]+)"/g)]
    .map(m => [m[1], m[2]])
);
if (Object.keys(WWIS_COUNTRY).length < 20)
  throw new Error("fake-wwis: could not read WWIS_COUNTRY from the generator");

/* The presets, so the fake list covers exactly what the generator will ask for. */
const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
const block = html.match(/const CITIES = \[([\s\S]*?)\n\];/)[1];
const presets = [...block.matchAll(/id:"([a-z]+)",\s*name:"([^"]+)"/g)]
  .map(m => { const [city, cc] = m[2].split(",").map(s => s.trim()); return { city, cc }; });

/* Quoted exactly as WWIS serves it — that quoting was bug number one — and
   carrying WWIS's real country names, which is bug number two: the generator now
   filters candidates by country, and a fixture with invented country names would
   exercise the failure path rather than the success one. The names come from the
   generator's own map, so the two cannot drift apart.

   A decoy Toronto in Australia is included deliberately. WWIS really has one and
   really has no Toronto in Canada, and taking the first match put a Canadian
   preset in New South Wales. */
const DECOYS = [
  '"Canada";"London";"9003"',             // real: London, Ontario
  '"Dominican Republic";"Santiago";"9001"',
  '"Panama";"Santiago";"9002"',
  '"Australia";"Toronto";"1739"'          // real, and the only Toronto WWIS has
];

/* Decoys go FIRST. Appended, they never win a first-match and the test proves
   nothing — which is exactly what happened: the earlier version put the decoys
   last and passed even with the country filter deleted. */
const cityList = ['"Country";"City";"CityId"']
  .concat(DECOYS)
  .concat(presets.map((p, i) => `"${WWIS_COUNTRY[p.cc] ?? "Unknown"}";"${p.city}";"${1000 + i}"`))
  .join("\n");

/* Cities the fixture deliberately gives no rain days, to exercise the
   whole-city fallback to the normals rather than leaving it unrun. */
const NO_RAINDAYS = new Set(["Singapore", "Manila", "Auckland"]);

/* Real WWIS coordinates for the cities whose normals station is found by
   proximity rather than by name. Without them every city sits at 1.0,2.0 and no
   station is ever within range, so the nearest-station path never runs and the
   test proves nothing — which is what happened the first time. Bogota is here
   deliberately: its nearest station is close but 64% wetter, and must be
   rejected rather than adopted. */
const REAL_COORDS = {
  "Kuala Lumpur": [3.116667, 101.55],
  "Jakarta":      [-6.17, 106.8],
  "Istanbul":     [40.97, 29.08],
  "Bogota":       [4.62, -74.08]
};

function cityJSON(id) {
  const p = presets[Number(id) - 1000];
  const wet = NO_RAINDAYS.has(p.city) ? 0 : 8;
  return JSON.stringify({
    city: {
      cityName: p.city, cityId: Number(id),
      cityLatitude: String((REAL_COORDS[p.city] || [1.0, 2.0])[0]),
      cityLongitude: String((REAL_COORDS[p.city] || [1.0, 2.0])[1]),
      stationName: `${p.city} Station`,
      member: { memId: 1, memName: "Test Service", orgName: "Test NMHS", url: "https://example.invalid" },
      climate: {
        raintype: "Rainfall", raindef: 1, rainunit: "mm",
        datab: 1991, datae: 2020,
        /* Annual totals close to what WWIS really reports for these cities, so
           the caller's disagreement guard is exercised against realistic gaps
           rather than against a flat 666 mm. */
        climateMonth: (() => {
          const annual = { "Kuala Lumpur": 2427, "Jakarta": 1655, "Istanbul": 678, "Bogota": 799 }[p.city];
          const each = annual ? annual / 12 : 50;
          return Array.from({ length: 12 }, (_, i) => ({
            month: i + 1, rainfall: annual ? each : 50 + i, raindays: wet
          }));
        })()
      }
    }
  });
}

/* Real rows from the WMO Climatological Standard Normals 1991-2020 (NOAA NCEI
   Accession 0253808 v6.6, CC0 1.0), for the four cities whose station is found
   by distance rather than by name. They are copied, not invented, because the
   geometry IS the test: Sariyer wins Istanbul at 19.7 km over Florya at
   24.7 km, so a matcher that took the first station within range rather than
   the nearest would still pass against made-up coordinates. Bogota's La_Bolsa
   is here to be refused — 12 km away, 3,195 m up, and 64% wetter than the
   city's own service reports.

   Each row carries both series: PRCP (mean monthly total, mm) and DP01 (mean
   days with >= 1 mm). Distances are from the WWIS coordinates in REAL_COORDS
   above.

     Malaysia    Subang                       1.6 km   <- taken
                 Melaka                     122.4 km      too far to consider
     Indonesia   StasiunMeteorologiKemayoran  4.7 km   <- taken
                 ...MaritimTanju             11.3 km      near, but not nearest
     Turkiye     Sariyer                     19.7 km   <- taken
                 Florya                      24.7 km      also within 25 km
     Colombia    La_Bolsa                    12.0 km      nearest, and refused
                 El_Dorado_Catam__AUT_       12.4 km                          */
const NEAR_STATIONS = [
  ["00048647", "Malaysia", "Subang", 3.131, 101.553, 17,
   [226.7, 192.8, 270.4, 301.5, 229.9, 145.8, 165.2, 174.3, 220.3, 283.8, 355.8, 280.6],
   [13.6, 11.9, 15.0, 16.8, 13.2, 9.6, 10.6, 10.9, 13.3, 16.3, 19.7, 16.3]],
  ["00048665", "Malaysia", "Melaka", 2.267, 102.250, 9,
   [102.1, 79.7, 129.1, 166.1, 167.3, 172.6, 196.0, 219.5, 161.7, 189.4, 233.1, 177.1],
   [8.0, 6.5, 10.1, 11.9, 10.6, 9.4, 11.7, 12.4, 11.4, 12.1, 15.7, 12.5]],
  ["00096745", "Indonesia", "StasiunMeteorologiKemayoran", -6.156, 106.840, 4,
   [373.3, 381.4, 210.4, 164.1, 103.2, 80.4, 77.7, 51.5, 61.0, 112.2, 134.8, 183.3],
   [17.5, 17.9, 14.1, 11.5, 8.2, 6.2, 4.8, 3.3, 4.0, 7.4, 10.4, 12.8]],
  ["00096741", "Indonesia", "StasiunMeteorologiMaritimTanju", -6.108, 106.881, 3,
   [408.1, 416.7, 195.9, 122.1, 100.6, 67.5, 51.5, 50.9, 55.2, 83.3, 125.2, 201.7],
   [18.9, 17.6, 13.8, 10.9, 8.8, 6.0, 6.1, 4.7, 5.3, 8.2, 11.6, 13.7]],
  ["00017061", "Turkiye", "Sariyer", 41.146, 29.050, 59,
   [96.1, 87.7, 69.8, 45.1, 37.2, 44.7, 36.3, 43.5, 81.3, 98.3, 100.5, 124.8],
   [12.3, 11.0, 9.2, 6.6, 4.8, 4.6, 3.6, 3.7, 6.6, 8.4, 9.6, 13.1]],
  ["00017636", "Turkiye", "Florya", 40.976, 28.786, 37,
   [74.4, 77.1, 60.5, 47.2, 33.1, 31.0, 19.4, 22.9, 42.5, 75.1, 70.4, 87.7],
   [10.0, 10.3, 8.6, 6.7, 4.1, 4.3, 2.2, 3.3, 5.1, 6.8, 7.6, 11.0]],
  ["35025060", "Colombia", "La_Bolsa", 4.576, -73.981, 3195,
   [35.9, 51.3, 90.6, 140.2, 153.8, 152.2, 159.0, 124.6, 89.9, 120.6, 133.7, 57.0],
   [6.2, 7.6, 11.7, 16.6, 20.9, 21.3, 23.1, 19.8, 14.4, 15.7, 14.9, 9.3]],
  ["21205791", "Colombia", "El_Dorado_Catam__AUT_", 4.706, -74.151, 2547,
   [32.9, 51.4, 83.4, 116.7, 109.0, 57.4, 48.6, 44.3, 56.7, 108.2, 107.2, 61.4],
   [4.9, 7.4, 10.9, 13.4, 13.5, 10.2, 9.5, 9.1, 9.0, 12.1, 12.1, 7.7]]
];

/* The local copies are ~3 MB of real normals and are gitignored, so most runs
   — every fresh clone, and CI — get the stand-in below. It therefore has to
   carry every case the suite asserts on, not merely enough to avoid a crash.
   It did not: the two proximity assertions passed here and failed in a clean
   checkout, because the cities they name were only ever in the untracked
   files. */
const csv = name => {
  const f = resolve(ROOT, `test/fixtures/${name}`);
  if (existsSync(f)) return readFileSync(f, "utf8");
  const wantDays = /dp01/i.test(name);
  const head = "Elem,Rgn,ID,WIGOS_ID,Latitude,Longitude,Elevation,Country,Station,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Annual";
  /* Flat rows for the cities matched by name, where the figures carry no
     meaning beyond being present and complete. */
  const row = (id, country, station, v) =>
    `001,1,${id},0-x-${id},1.0,2.0,5.0,${country},${station},${Array(12).fill(v).join(",")},${v * 12}`;
  const realRow = ([id, country, station, lat, lon, elev, prcp, dp01]) => {
    const v = wantDays ? dp01 : prcp;
    const annual = Math.round(v.reduce((s, x) => s + x, 0) * 10) / 10;
    return `001,1,${id},0-x-${id},${lat},${lon},${elev},${country},${station},${v.join(",")},${annual}`;
  };
  return [head,
    row("1", "Singapore", "ChangiAirport", 100),
    row("2", "Philippines", "PortAreaManila", 120),
    row("3", "New_Zealand", "Auckland_Aero_AWS", 90),
    row("4", "Bangladesh", "Chittagong", 200),
    row("5", "United_Kingdom", "London", 50),
    ...NEAR_STATIONS.map(realRow)
  ].join("\n");
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  const ok = body => new Response(body, { status: 200, headers: { "content-type": "text/plain" } });

  if (u.includes("full_city_list.txt")) return ok(cityList);
  const m = u.match(/\/(\d+)_en\.json$/);
  if (m) return ok(cityJSON(m[1]));
  if (u.includes("PRCP.csv")) return ok(csv("prcp.csv"));
  if (u.includes("DP01.csv")) return ok(csv("dp01.csv"));

  throw new Error(`fake-wwis: nothing canned for ${u} — add it rather than reaching the network`);
};
