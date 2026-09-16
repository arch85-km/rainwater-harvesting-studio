/* Run the WWIS generator end to end, offline.

   The other suites import modules and exercise functions. This one spawns the
   generator as a process, against the canned WWIS and NOAA responses in
   test/fixtures/fake-wwis.mjs, and checks it completes.

   It exists because three consecutive runs failed on a GitHub runner for faults
   that never had a chance to surface here: a quoting bug in the city list, then
   `Cannot access 'usable' before initialization`. Neither is visible to
   `node --check`, which only parses, and neither is reachable from `npm test`,
   which imports the generator but never calls main() — main() is guarded so
   that importing it does not fire 29 requests at WWIS.

   So the entire procedural half of the generator had never executed anywhere
   except on someone else's machine, and every fault in it cost a round trip.
   Now it runs here, in about a second, before it runs anywhere else.

   What this proves: the code path holds together — list parsing, city
   resolution, the whole-city fallback to the normals, the cross-check, the
   summary. What it does not prove: anything about the real data. Only a real
   run does that. */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, c, got, want) => {
  if (c) { pass++; console.log("  PASS  " + n); }
  else { fail++; console.log(`  FAIL  ${n}\n         got  ${got}\n         want ${want}`); }
};

console.log("\n── The WWIS generator runs end to end ──");

const r = spawnSync(process.execPath, [
  "--import", resolve(ROOT, "test/fixtures/fake-wwis.mjs"),
  resolve(ROOT, "tools/build-climate-wwis.mjs"),
  "--dry-run"
], { encoding: "utf8", cwd: ROOT, timeout: 60000 });

const out = (r.stdout || "") + (r.stderr || "");

t("main() completes without throwing", r.status === 0,
  `exit ${r.status}${r.stderr ? "\n         " + r.stderr.trim().split("\n").slice(0, 4).join("\n         ") : ""}`, "exit 0");

t("every preset resolves against the city list", /All 28 resolved/.test(out),
  (out.match(/All \d+ resolved/) || ["not reached"])[0], "All 28 resolved");

/* The quoting bug: an unquoted name compared against a quoted field matched
   nothing, and all 28 reported NOT FOUND. */
t("no preset reports NOT FOUND", !/NOT FOUND/.test(out),
  (out.match(/.*NOT FOUND.*/) || ["none"])[0], "none");

/* The fallback is the least-travelled path and the easiest to leave broken. */
t("a city with no rain days falls back to the normals",
  /via wmo-normals:/.test(out),
  (out.match(/via wmo-normals:\S+/) || ["never fired"])[0], "via wmo-normals:<station>");

t("the fallback names the station it used",
  /via wmo-normals:\w/.test(out), "named", "a station name");

/* The normals lead where they reach; WWIS covers the rest. If this inverts
   silently, every city's period and rain-day threshold changes meaning. */
t("the WMO Normals are preferred over WWIS where they have the city",
  (out.match(/via wmo-normals:/g) || []).length >= 4,
  (out.match(/via wmo-normals:/g) || []).length + " cities", "at least 4");

/* London, Ontario is real and sits ahead of London, England in the fixture.
   Without the country filter the first match wins and the app's London becomes
   Canadian — the same fault that put Toronto, Canada in New South Wales. */
t("a city name shared across countries resolves to the right one",
  /London, United Kingdom/.test(out) && !/London, Canada/.test(out),
  (out.match(/London, \w[^\n]*/) || ["not resolved"])[0], "London, United Kingdom…");

/* A station is often not named for the city it serves — Kuala Lumpur's is
   Subang, 2 km away; Jakarta's is Stasiun Meteorologi Kemayoran at 5 km. Without
   proximity matching those cities stay on WWIS records dating from 1971-2000 and
   1930-1960. */
t("a station near the city is found even when the name does not match",
  /via wmo-normals:Subang/.test(out),
  (out.match(/Kuala Lumpur[^\n]*/) || ["not matched"])[0], "via wmo-normals:Subang");

/* Distance is not enough in mountains. Bogota is at 2,600 m; the nearest
   station is 12 km away and 64% wetter because it is down-valley. Adopting it
   silently would be worse than leaving the city on an older record. */
t("a near station that disagrees wildly is rejected, and says why",
  /not adopted, WWIS kept/.test(out) && !/via wmo-normals:La_Bolsa/.test(out),
  (out.match(/Bogota[^\n]*not adopted[^\n]*/) || ["not rejected"])[0], "rejected with a reason");

t("the cross-check section is reached", /cities cross-checked/.test(out),
  /cities cross-checked/.test(out) ? "reached" : "not reached", "reached");

t("the run reports the periods it found", /Normal periods declared:/.test(out),
  /Normal periods declared:/.test(out) ? "reported" : "missing", "reported");

t("a dry run writes nothing", /index\.html and docs\/climate-source\.json unchanged/.test(out),
  "wrote nothing", "wrote nothing");

/* ── and again, for real, into a copy of the tree ──────────────────────────

   Everything above runs --dry-run, which writes nothing — so nothing above
   ever looks at docs/climate-source.json, the file the app points readers at
   and the one a citation rests on. That gap hid a fault for as long as the
   file existed: the record was built by calling matchNormals a SECOND time,
   without the city's coordinates, so it reported a name-only search while the
   data came from a proximity match. Kuala Lumpur shipped reading

     "sourcedFrom": "wmo-normals:Subang (WMO 00048647)"
     "crossCheck":  { "status": "no station named for Kuala Lumpur among 15 …" }

   — a provenance record that contradicted itself, and no assertion could see
   it, because no assertion had ever read the file.

   So: copy what the generator reads and writes into a temp directory, run it
   there without --dry-run, and read what it wrote. The repository is not
   touched. */

console.log("\n── the record it writes agrees with the data it wrote ──");
{
  const tmp = mkdtempSync(join(tmpdir(), "rwh-gen-"));
  try {
    mkdirSync(join(tmp, "docs"), { recursive: true });
    cpSync(resolve(ROOT, "index.html"), join(tmp, "index.html"));
    cpSync(resolve(ROOT, "tools"), join(tmp, "tools"), { recursive: true });
    cpSync(resolve(ROOT, "test/fixtures"), join(tmp, "test/fixtures"), { recursive: true });

    const w = spawnSync(process.execPath, [
      "--import", join(tmp, "test/fixtures/fake-wwis.mjs"),
      join(tmp, "tools/build-climate-wwis.mjs")
    ], { encoding: "utf8", cwd: tmp, timeout: 60000 });

    t("a real run completes", w.status === 0,
      `exit ${w.status}${w.stderr ? "\n         " + w.stderr.trim().split("\n").slice(0, 3).join("\n         ") : ""}`, "exit 0");

    const rec = JSON.parse(readFileSync(join(tmp, "docs/climate-source.json"), "utf8"));
    const by = Object.fromEntries(rec.cities.map(c => [c.id, c]));

    /* The invariant. Not "the record is present" — that was true before, and
       wrong; "the record names the station the numbers came from". */
    const disagree = rec.cities.filter(c => {
      const m = /^wmo-normals:([^\s(]+)/.exec(c.sourcedFrom || "");
      if (!m) return false;
      const s = (c.crossCheck && c.crossCheck.stations || [])[0];
      return !s || s.station !== m[1];
    }).map(c => `${c.id}: ${c.sourcedFrom} vs ${(c.crossCheck || {}).status}`);
    t("every city sourced from the normals records the station it used",
      disagree.length === 0, disagree.join("; ") || "all agree", "all agree");

    /* The specific case the old record could not express. */
    const kul = by.kul || {};
    t("a city matched by distance records the distance",
      /^nearest station, \d+ km$/.test((kul.crossCheck || {}).matchedBy || ""),
      (kul.crossCheck || {}).matchedBy || "not recorded", "nearest station, N km");
    t("and records the WMO number and elevation of that station",
      ((kul.crossCheck || {}).stations || [{}])[0].wmoStationId === "00048647" &&
      ((kul.crossCheck || {}).stations || [{}])[0].elevationM === 17,
      JSON.stringify(((kul.crossCheck || {}).stations || [{}])[0]), "WMO 00048647 at 17 m");

    /* A refusal is a finding, and belongs in the file rather than only in the
       run's console output, which nobody keeps. */
    const bog = by.bog || {};
    t("a refused station is recorded with its reason",
      !!(bog.crossCheck || {}).rejectedAsUnrepresentative && bog.sourcedFrom === "wwis",
      JSON.stringify((bog.crossCheck || {}).rejectedAsUnrepresentative) + " / " + bog.sourcedFrom,
      "the rejection, and the city still on wwis");

    t("the licence it writes is the one the app carries",
      typeof rec.licence === "string" && rec.licence.includes("0253808"),
      String(rec.licence).slice(0, 40), "… Accession 0253808 …");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n${fail ? "✗" : "✓"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
