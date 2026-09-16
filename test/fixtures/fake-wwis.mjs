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

function cityJSON(id) {
  const p = presets[Number(id) - 1000];
  const wet = NO_RAINDAYS.has(p.city) ? 0 : 8;
  return JSON.stringify({
    city: {
      cityName: p.city, cityId: Number(id),
      cityLatitude: "1.0", cityLongitude: "2.0", stationName: `${p.city} Station`,
      member: { memId: 1, memName: "Test Service", orgName: "Test NMHS", url: "https://example.invalid" },
      climate: {
        raintype: "Rainfall", raindef: 1, rainunit: "mm",
        datab: 1991, datae: 2020,
        climateMonth: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1, rainfall: 50 + i, raindays: wet
        }))
      }
    }
  });
}

const csv = name => {
  const f = resolve(ROOT, `test/fixtures/${name}`);
  if (existsSync(f)) return readFileSync(f, "utf8");
  /* Minimal stand-in with the real column names and the real sentinel. */
  const head = "Elem,Rgn,ID,WIGOS_ID,Latitude,Longitude,Elevation,Country,Station,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Annual";
  const row = (id, country, station, v) =>
    `001,1,${id},0-x-${id},1.0,2.0,5.0,${country},${station},${Array(12).fill(v).join(",")},${v * 12}`;
  return [head,
    row("1", "Singapore", "ChangiAirport", 100),
    row("2", "Philippines", "PortAreaManila", 120),
    row("3", "New_Zealand", "Auckland_Aero_AWS", 90),
    row("4", "Bangladesh", "Chittagong", 200),
    row("5", "United_Kingdom", "London", 50)
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
