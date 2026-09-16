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
const zen   = JSON.parse(readFileSync(resolve(ROOT, ".zenodo.json"), "utf8"));

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
    /* The entry ends with the locator twice — once as the link text, once as the
       href — so the anchor text is dropped and the href compared on its own.
       The locator is the DOI, not the site: APA takes one, and the archived copy
       outlives a personal domain. */
    const entry = norm(m[1].replace(/<a [^>]*>[\s\S]*?<\/a>/, ""))
                    .replace(/\s*$/, " " + CITATION.doiUrl);
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

console.log("\n\u2500\u2500 5. The Zenodo record says the same as the citation \u2500\u2500");
{
  /* .zenodo.json is what the archive reads when a release is made, and it is
     the one file here whose mistakes become permanent: a DOI is minted against
     whatever it says. It duplicates CITATION.cff — title, version, date,
     licence, author, ORCID, keywords — so it is a fifth copy of the citation,
     and a fifth copy drifts like the other four did.

     Held to the .cff rather than to text written here, so the .cff stays the
     one place a citation is edited. */
  const cffField = k => {
    const m = cff.match(new RegExp(`^${k}:[ \\t]*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };

  t("the Zenodo title is CITATION.cff's title", zen.title === cffField("title"),
    zen.title, cffField("title"));
  t("the Zenodo version is VERSION.number", zen.version === VERSION.number,
    zen.version, VERSION.number);
  t("the Zenodo publication date is VERSION.date", zen.publication_date === VERSION.date,
    zen.publication_date, VERSION.date);
  t("the Zenodo licence is package.json's", zen.license === pkg.license, zen.license, pkg.license);
  t("the deposit is open access", zen.access_right === "open", zen.access_right, "open");
  t("the upload type is software", zen.upload_type === "software", zen.upload_type, "software");

  /* One creator, carrying the same ORCID the .cff does — bare, as Zenodo wants
     it, not as a URL. The name is the .cff's structured name joined as Zenodo
     asks ("Family, Given"), NOT CITATION.author: that is the APA short form,
     "Al-Obaidi, K.M.", and initials in an archive record are a worse identifier
     than the name the author actually publishes under. */
  t("there is exactly one creator", Array.isArray(zen.creators) && zen.creators.length === 1,
    zen.creators && zen.creators.length, 1);
  const c = (zen.creators || [])[0] || {};
  const nm = cff.match(/family-names:[ \t]*(.+)\n\s*given-names:[ \t]*(.+)/);
  const want = nm ? `${nm[1].trim()}, ${nm[2].trim()}` : null;
  t("the creator is the .cff's name as \"Family, Given\"", c.name === want, c.name, want);
  t("the creator is not the APA short form", c.name !== CITATION.author,
    c.name, "not " + CITATION.author);
  const cffOrcid = (cff.match(/orcid:[ \t]*["']?https:\/\/orcid\.org\/([\dX-]+)/) || [])[1];
  t("the creator's ORCID is the .cff's, without the URL prefix",
    c.orcid === cffOrcid, c.orcid, cffOrcid);

  /* Keywords are what makes it findable; a subset is a silent loss. */
  const cffKeys = (cff.match(/^keywords:\n((?:\s+-\s+.+\n)+)/m) || ["", ""])[1]
    .split("\n").map(l => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
  t("the keywords are the .cff's, in the same order",
    JSON.stringify(zen.keywords) === JSON.stringify(cffKeys),
    JSON.stringify(zen.keywords), JSON.stringify(cffKeys));

  /* The address of record, declared to Zenodo as the same work. */
  const ident = (zen.related_identifiers || []).find(r => r.identifier === CITATION.url);
  t("the record points at the address of record", !!ident,
    JSON.stringify((zen.related_identifiers || []).map(r => r.identifier)), CITATION.url);

  /* WWIS's condition applies wherever its information is used, and a Zenodo
     abstract is a place it is used. */
  t("the description carries the WWIS acknowledgement",
    /Acknowledgement must be given to the WMO World Weather Information Service/.test(zen.description),
    "absent", "the condition, verbatim");
}

console.log("\n\u2500\u2500 6. The DOI, in every copy of the citation \u2500\u2500");
{
  /* A DOI is only worth minting if the work carries it. It now lives in five
     files, which is five chances to paste it wrong — and a wrong DOI is worse
     than none: it resolves, to someone else's record.

     Two of them, and the pair is the point. The concept DOI resolves to the
     newest version and is what a citation of the tool should say; the version
     DOI is frozen on 1.0 and is what reproducing a figure needs. Swapping them
     is a silent error — both resolve, to different things — so each is checked
     where it belongs rather than "a DOI is present". */
  const DOI = /^10\.5281\/zenodo\.\d+$/;
  const cffDoi = (cff.match(/^doi:[ \t]*["']?([^"'\n]+)/m) || [])[1];

  t("CITATION.cff carries a doi", !!cffDoi, cffDoi || "none", "a doi: line");
  t("it is shaped like a Zenodo DOI", DOI.test(cffDoi || ""), cffDoi, "10.5281/zenodo.<digits>");
  t("the .cff's doi is the concept DOI, not the version's",
    cffDoi === CITATION.doi, cffDoi, CITATION.doi + " (concept)");

  /* The two must differ. Zenodo mints them one apart, and a copy-paste that
     takes the same number twice passes every other check here. */
  t("the two DOIs are different", CITATION.doi !== CITATION.doiVersion,
    CITATION.doi + " / " + CITATION.doiVersion, "two distinct DOIs");
  t("the version DOI is shaped like one too", DOI.test(CITATION.doiVersion),
    CITATION.doiVersion, "10.5281/zenodo.<digits>");

  /* The .cff lists both under identifiers:, so a reader of that file alone can
     find the frozen version. */
  for (const [what, doi] of [["concept", CITATION.doi], ["version", CITATION.doiVersion]])
    t(`CITATION.cff lists the ${what} DOI under identifiers`,
      new RegExp(`value:[ \\t]*["']?${doi.replace(/[.\/]/g, "\\$&")}`).test(cff),
      "absent", doi);

  /* The app builds its own APA line, so the DOI has to be in the file that
     ships, not only in the repository around it. */
  t("the app's citation resolves through doi.org",
    CITATION.doiUrl === `https://doi.org/${CITATION.doi}`, CITATION.doiUrl,
    `https://doi.org/${CITATION.doi}`);
  t("the app's APA line ends with the DOI", CITATION.apa.endsWith(CITATION.doiUrl),
    CITATION.apa.slice(-60), "\u2026 " + CITATION.doiUrl);
  t("the app names the archive as publisher", CITATION.apa.includes(". Zenodo. "),
    CITATION.apa.slice(-80), "\u2026 [Computer software]. Zenodo. \u2026");

  /* The BibTeX block a student copies. */
  const bibDoi = notes.match(/doi\s*=\s*\{([^}]+)\}/);
  t("the BibTeX block carries the concept DOI",
    !!bibDoi && bibDoi[1].trim() === CITATION.doi,
    bibDoi ? bibDoi[1].trim() : "no doi field", CITATION.doi);

  /* And the README badge, which is the first thing seen and the easiest to
     leave pointing at a previous deposit. */
  t("the README badge links to the concept DOI",
    rdme.includes(`](https://doi.org/${CITATION.doi})`),
    "absent or different", `](https://doi.org/${CITATION.doi})`);
  t("the README names the version DOI too",
    rdme.includes(CITATION.doiVersion), "absent", CITATION.doiVersion);

  /* Both DOIs, in the notes, distinguished. */
  for (const [what, doi] of [["concept", CITATION.doi], ["version", CITATION.doiVersion]])
    t(`the method notes name the ${what} DOI`, notes.includes(doi), "absent", doi);
}

console.log(`\n${pass ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
