/* Extract the app's data, geometry and hydrology modules from index.html so Node
   can exercise them directly.

   index.html is a single file with no build step, which is the point of it — but
   it means the modules under test live inside a <script> tag alongside code that
   needs a DOM. This takes everything up to the APP module (DATA, GEO, HYD, R3D,
   CHART and the demo models), appends a CommonJS export, and writes it to
   test/.core.js.

   That file is generated and gitignored. Never edit it: edit index.html and run
   this again, or the tests will quietly stop testing the app that ships. */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CORE = resolve(ROOT, "test/.core.js");

const EXPORTS = [
  "GEO", "HYD", "CLIMATE", "CLIMATE_SOURCE", "CLIMATE_WINDOW",
  "climateProvenance", "rainfallProvenanceFor",
  "MATERIALS", "MATERIAL_ORDER", "MATERIAL_ALIAS", "matKey",
  "ROOFS", "ROOF_ORDER", "CITIES", "CITY_BY_ID", "DEMOS",
  "newModel", "newBlock", "climateFor", "sum", "MONTHS", "DAYS_IN_MONTH"
];

export function extract() {
  const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("index.html: no <script> block found");
  const lines = m[1].split("\n");
  const cut = lines.findIndex(l => l.includes("APP ═"));
  if (cut < 0) throw new Error("index.html: could not find the APP module boundary");
  const core = lines.slice(0, cut).join("\n") +
    `\n\nmodule.exports = { ${EXPORTS.join(", ")} };\n`;
  writeFileSync(CORE, core);
  return { path: CORE, lines: cut };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const r = extract();
  console.log(`extracted ${r.lines} lines to ${r.path}`);
}
