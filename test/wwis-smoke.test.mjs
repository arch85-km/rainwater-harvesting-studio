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
import { resolve, dirname } from "node:path";
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

console.log(`\n${fail ? "✗" : "✓"} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
