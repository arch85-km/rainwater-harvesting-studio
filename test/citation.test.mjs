/* The citation, and the one address of record.

   The app can be opened from somewhere that is not its own address — a GitHub
   Pages copy of the repository, a file dropped on a VLE, a download on a laptop.
   Whoever does should still cite karam.me.uk rather than whatever their address
   bar shows, which only works if the app carries the citation itself.

   That puts the same citation in four places: CITATION in index.html, the APA
   entry in docs/method-notes.html, the BibTeX block beside it, and CITATION.cff
   — which is the only one GitHub can read, and what puts the "Cite this
   repository" button on the repo page. Four copies drift. These assertions hold
   them together, and hold the <link rel="canonical">, package.json's homepage
   and the .cff's url to the same address, so a future edit to one cannot
   silently leave the others behind.

   Text assertions, not arithmetic: this suite reads the files rather than
   exercising the modules. */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const require = createRequire(import.meta.url);

const { CITATION, VERSION, CLIMATE_SOURCE } = require("./.core.js");
const html  = readFileSync(resolve(ROOT, "index.html"), "utf8");
const notes = readFileSync(resolve(ROOT, "docs/method-notes.html"), "utf8");
const pkg   = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const cff   = readFileSync(resolve(ROOT, "CITATION.cff"), "utf8");
const rdme  = readFileSync(resolve(ROOT, "README.md"), "utf8");

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

console.log("\n── 3. CITATION.cff says the same thing ──");
{
  /* Line-oriented rather than a YAML parser: the repository has no
     dependencies and `npm test` has to keep running on a bare Node 18. Each
     key is read from its own top-level line, quotes optional. */
  const field = k => {
    const m = cff.match(new RegExp(`^${k}:[ \\t]*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };

  t("title matches CITATION.title", field("title") === CITATION.title,
    field("title"), CITATION.title);
  t("version matches VERSION.number", field("version") === VERSION.number,
    field("version"), VERSION.number);
  t("date-released matches VERSION.date", field("date-released") === VERSION.date,
    field("date-released"), VERSION.date);
  t("url is the address of record, not the repo", field("url") === CITATION.url,
    field("url"), CITATION.url);
  t("license matches package.json", field("license") === pkg.license,
    field("license"), pkg.license);

  /* repository-code is deliberately NOT the cited address: a reader who cites
     the GitHub mirror instead of karam.me.uk is the failure this whole suite
     exists to prevent. */
  t("repository-code is distinct from the cited url",
    field("repository-code") && field("repository-code") !== CITATION.url,
    field("repository-code"), "a different URL from " + CITATION.url);

  /* Derive the APA form from the .cff's structured name and compare it with
     CITATION.author, rather than testing that it merely looks similar:
     "Al-Obaidi" + "Karam M." must reduce to exactly "Al-Obaidi, K.M." */
  const author = cff.match(/family-names:[ \t]*(.+)\n\s*given-names:[ \t]*(.+)/);
  const initials = g => g.trim().split(/\s+/).map(w => w[0].toUpperCase() + ".").join("");
  const cffAuthor = author ? `${author[1].trim()}, ${initials(author[2])}` : null;
  t("the author reduces to CITATION.author", cffAuthor === CITATION.author,
    cffAuthor, CITATION.author);

  for (const k of ["cff-version", "message", "type", "abstract"])
    t(`required key "${k}" is present`, field(k) !== null, "missing", "present");

  /* The ORCID is checked by its own checksum (ISO 7064 MOD 11-2), not merely
     for being present and the right shape. A transposed digit produces a
     perfectly well-formed identifier that belongs to someone else, or to
     nobody — and a citation record is the worst place to discover that. */
  const orcid = (cff.match(/orcid:[ \t]*["']?(https:\/\/orcid\.org\/([\dX-]+))["']?/) || [])[2];
  t("the author carries an ORCID", !!orcid, orcid || "none", "an orcid: line");

  if (orcid) {
    const d = orcid.replace(/-/g, "");
    t("the ORCID is 16 characters", d.length === 16, d.length, 16);
    let total = 0;
    for (const ch of d.slice(0, 15)) total = (total + Number(ch)) * 2 % 11;
    const r = (12 - total % 11) % 11;
    const want = r === 10 ? "X" : String(r);
    t("the ORCID checksum is valid", d[15] === want, d[15], want);
  }
}

console.log("\n\u2500\u2500 4. The README describes the app that ships \u2500\u2500");
{
  /* The README is the first thing a reader meets, and on Zenodo it is the
     landing text for a permanent DOI. Nothing read it, and it drifted: it went
     on describing a reanalysis and a World Bank cross-check for a day after the
     app had moved to WMO gauge normals, and it claimed an assertion count two
     changes out of date. These are the cheapest checks that would have caught
     it — not a review of the prose, just the handful of facts it shares with
     the code. (The assertion count itself is checked by test/run.mjs, which is
     the only place that knows the total.) */

  /* Whatever CLIMATE_SOURCE declares, the README has to name it. Both halves:
     a README naming only one of the two providers is the state this caught. */
  for (const provider of ["WMO Climatological Standard Normals", "World Weather Information Service"])
    t(`the README names "${provider}"`, rdme.includes(provider),
      "absent", "named in the README");

  /* WWIS requires the acknowledgement wherever its information is used, and the
     README is where a reader looks for terms. Quoted, not paraphrased. */
  t("the README quotes the WWIS acknowledgement condition",
    rdme.includes("Acknowledgement must be given to the WMO World Weather Information Service"),
    "absent", "the condition, verbatim");

  /* The specific claim that went stale. If the library is sourced, the README
     must not still be telling people it is not. */
  if (CLIMATE_SOURCE.sourced) {
    const unsourced = [
      "written by hand with no dataset",
      "no dataset behind them",
      "until then it supplies nothing",
      "the archive serves a **reanalysis**"
    ].filter(phrase => rdme.includes(phrase));
    t("the README does not still call the library unsourced",
      unsourced.length === 0, unsourced.join("; ") || "none present", "none present");
  }

  /* The version line. index.html, CITATION.cff and package.json are held
     together above; these are the two copies that were edited by hand. */
  const ver = rdme.match(/^\*\*Version ([^*]+)\*\*\s+\u2014\s+(.+)$/m);
  t("the README states the version and release date", !!ver,
    ver ? ver[0] : "no '**Version N** — date' line", "**Version N** — date");
  if (ver) {
    t("the README's version is VERSION.number", ver[1].trim() === VERSION.number,
      ver[1].trim(), VERSION.number);
    t("the README's date is VERSION.label", ver[2].trim() === VERSION.label,
      ver[2].trim(), VERSION.label);
  }

  const upd = notes.match(/<b>Updated<\/b>\s*([^<]+)</);
  t("the method notes' Updated line is VERSION.label",
    !!upd && upd[1].replace(/&nbsp;/g, " ").trim() === VERSION.label,
    upd ? upd[1].trim() : "no Updated line", VERSION.label);
}

console.log(`\n${pass ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
