/* The citation, and the one address of record.

   The app can be opened from somewhere that is not its own address — a GitHub
   Pages copy of the repository, a file dropped on a VLE, a download on a laptop.
   Whoever does should still cite karam.me.uk rather than whatever their address
   bar shows, which only works if the app carries the citation itself.

   That puts the same citation in three places: CITATION in index.html, the APA
   entry in docs/method-notes.html, and the BibTeX block beside it. Three copies
   drift. These assertions hold them together, and hold the <link rel="canonical">
   to the same URL, so a future edit to one cannot silently leave the others
   behind.

   Text assertions, not arithmetic: this suite reads the two files rather than
   exercising the modules. */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const require = createRequire(import.meta.url);

const { CITATION, VERSION } = require("./.core.js");
const html  = readFileSync(resolve(ROOT, "index.html"), "utf8");
const notes = readFileSync(resolve(ROOT, "docs/method-notes.html"), "utf8");
const pkg   = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));

let pass = 0, fail = 0;
const t = (name, cond, got, want) => {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log(`  FAIL  ${name}\n         got  ${got}\n         want ${want}`); }
};

/* Both documents wrap their citation across lines and the notes mark the title
   up with <i>. Normalising strips the presentation so the comparison is of the
   citation itself, not of how it happens to be laid out. */
const norm = s => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

console.log("\n── 1. The app's citation matches the method notes ──");
{
  const apa = norm(CITATION.apa);

  /* The APA entry: the <p class="cs-ref"> that names the author. */
  const m = notes.match(/<p class="cs-ref">\s*(Al-Obaidi[\s\S]*?)<\/p>/);
  t("the notes carry an APA entry for the app", !!m, m ? "found" : "no cs-ref entry", "one entry");

  if (m) {
    /* The entry ends with the URL twice — once as the link text, once as the
       href — so the anchor text is dropped and the href compared on its own. */
    const entry = norm(m[1].replace(/<a [^>]*>[\s\S]*?<\/a>/, ""))
                    .replace(/\s*$/, " " + CITATION.url);
    t("APA entry is character-identical to CITATION.apa", entry === apa, entry, apa);
  }

  const bib = notes.match(/url\s*=\s*\{([^}]+)\}/);
  t("the BibTeX url is the same URL", !!bib && bib[1].trim() === CITATION.url,
    bib ? bib[1].trim() : "no url field", CITATION.url);

  const bibVer = notes.match(/version\s*=\s*\{([^}]+)\}/);
  t("the BibTeX version is VERSION.number", !!bibVer && bibVer[1].trim() === VERSION.number,
    bibVer ? bibVer[1].trim() : "no version field", VERSION.number);

  t("the citation names the current version", apa.includes(`(Version ${VERSION.number})`),
    apa, `…(Version ${VERSION.number})…`);
}

console.log("\n── 2. One address of record ──");
{
  const links = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/g)];
  t("index.html declares exactly one canonical link", links.length === 1,
    links.length + " found", "1");
  if (links.length === 1)
    t("the canonical href is CITATION.url", links[0][1] === CITATION.url,
      links[0][1], CITATION.url);

  t("package.json homepage is the same URL", pkg.homepage === CITATION.url,
    pkg.homepage, CITATION.url);

  /* A mirror's own address must never be written into the files as the app's
     own. Naming it in prose, to explain why the canonical exists, is fine. */
  const inCode = html.match(/href="https:\/\/[a-z0-9-]+\.github\.io[^"]*"/g);
  t("no github.io address is declared as the app's own", !inCode,
    inCode ? inCode.join(", ") : "none", "none");
}

console.log(`\n${pass ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
