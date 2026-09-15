#!/usr/bin/env node
/* Run the suites that need nothing installed.

   Spawned rather than imported: core.test.js is CommonJS and the other two are
   ES modules, and spawning keeps that difference from mattering. Each prints its
   own results and exits non-zero on failure; this aggregates the totals and the
   exit code.

   The browser suites used during development — smoke, tour, print, drag, embed,
   the documentation-figure checks and two pixel regressions — need Playwright
   and are not shipped. What runs here is the arithmetic — the catchment
   identities, the yield equation, the water balance, the tank sizing, and the
   climate generator's rewrite — plus one text check holding the citation and
   the canonical URL together across index.html, the method notes and
   package.json.

   Usage:  npm test      (or: node test/run.mjs) */

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extract } from "./extract-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUITES = [
  ["Data, geometry and hydrology", "core.test.js"],
  ["Climate library generator",    "generator.test.mjs"],
  ["Citation and canonical URL",   "citation.test.mjs"]
];

const r = extract();
console.log(`\nExtracted ${r.lines} lines of app modules for testing.`);

let pass = 0, fail = 0, broke = false;

for (const [label, file] of SUITES) {
  console.log(`\n${"═".repeat(64)}\n  ${label}  —  test/${file}\n${"═".repeat(64)}`);
  const out = spawnSync(process.execPath, [resolve(HERE, file)], { encoding: "utf8" });
  process.stdout.write(out.stdout || "");
  if (out.stderr) process.stderr.write(out.stderr);
  const m = (out.stdout || "").match(/(\d+) passed, (\d+) failed/);
  if (m) { pass += +m[1]; fail += +m[2]; }
  else { broke = true; console.error(`  !! ${file} produced no result line`); }
  if (out.status !== 0 && !m) broke = true;
}

console.log(`\n${"═".repeat(64)}`);
console.log(`  ${fail || broke ? "FAILED" : "OK"}   ${pass} passed, ${fail} failed` +
            (broke ? "  (a suite did not report — see above)" : ""));
console.log(`${"═".repeat(64)}\n`);
process.exit(fail || broke ? 1 : 0);
