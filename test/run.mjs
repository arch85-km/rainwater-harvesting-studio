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
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extract } from "./extract-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUITES = [
  ["Data, geometry and hydrology", "core.test.js"],
  ["Climate library generator",    "generator.test.mjs"],
  ["Citation and canonical URL",   "citation.test.mjs"],
  ["WWIS generator, end to end",   "wwis-smoke.test.mjs"]
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

/* The README states the size of this suite, and that number is the first thing
   a reader checks it against. It had drifted to 310 while the suite ran 325,
   because nothing compared them. Now something does: this is not one of the
   assertions the suites count, it is a condition on the run as a whole. */
const readme = readFileSync(resolve(HERE, "..", "README.md"), "utf8");
const claimed = readme.match(/\*\*(\d+) assertions/);
let readmeWrong = false;
if (!claimed) {
  readmeWrong = true;
  console.error(`\n  !! README.md no longer states an assertion count in the form "**N assertions"`);
} else if (Number(claimed[1]) !== pass + fail) {
  readmeWrong = true;
  console.error(`\n  !! README.md says ${claimed[1]} assertions; this run has ${pass + fail}.` +
                `\n     Update the count in README.md under "## Verifying".`);
}

console.log(`\n${"═".repeat(64)}`);
console.log(`  ${fail || broke || readmeWrong ? "FAILED" : "OK"}   ${pass} passed, ${fail} failed` +
            (broke ? "  (a suite did not report — see above)" : "") +
            (readmeWrong ? "  (the README's count is wrong — see above)" : ""));
console.log(`${"═".repeat(64)}\n`);
process.exit(fail || broke || readmeWrong ? 1 : 0);
