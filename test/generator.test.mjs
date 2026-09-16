/* tools/build-climate.mjs — the parts that do not need a network.
   The rewrite is the risky half: if patch() emits JavaScript the app cannot
   parse, or silently drops a city, the library is gone. So the round-trip is
   tested by re-evaluating the patched file, not by eyeballing a diff. */
/* no filesystem writes: the patch round-trip is checked in memory, so running the
   suite never touches index.html */
import * as G from '../tools/build-climate.mjs';
import * as W from '../tools/build-climate-wwis.mjs';

let pass = 0, fail = 0;
const t = (n, c, got, want) => { if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + '\n         got ' + got + '  want ' + want); } };

console.log('\n── labels and the country filter ──');
{
  t('"Athens, GR" splits into place and country',
    G.splitLabel('Athens, GR').place === 'Athens' && G.splitLabel('Athens, GR').cc === 'GR',
    JSON.stringify(G.splitLabel('Athens, GR')), 'Athens / GR');
  t('"Kuala Lumpur, MY" keeps the space in the place name',
    G.splitLabel('Kuala Lumpur, MY').place === 'Kuala Lumpur', G.splitLabel('Kuala Lumpur, MY').place, 'Kuala Lumpur');
  let threw = false; try { G.splitLabel('Nowhere'); } catch (e) { threw = true; }
  t('a label with no country code throws', threw, threw, true);

  /* the failure this filter exists to prevent */
  const results = [
    { name:'Athens', country_code:'US', admin1:'Georgia',  latitude:33.96, longitude:-83.38, elevation:200, population:127315 },
    { name:'Athens', country_code:'GR', admin1:'Attica',   latitude:37.98, longitude:23.72,  elevation:70,  population:664046 },
    { name:'Athens', country_code:'US', admin1:'Alabama',  latitude:34.80, longitude:-86.97, elevation:220, population:25406 }
  ];
  const hit = G.pickHit('Athens, GR', results);
  t('picks Athens GR, not Athens Georgia', hit.matched === 'Athens, Attica, GR', hit.matched, 'Athens, Attica, GR');
  t('carries the coordinates the geocoder returned', hit.lat === 37.98 && hit.lon === 23.72, hit.lat + ',' + hit.lon, '37.98,23.72');
  t('rounds elevation to a whole metre', hit.elev === 70, hit.elev, 70);

  const many = [
    { name:'Springfield', country_code:'US', admin1:'Illinois', latitude:39.8, longitude:-89.6, elevation:170, population:114230 },
    { name:'Springfield', country_code:'US', admin1:'Missouri', latitude:37.2, longitude:-93.3, elevation:390, population:169176 }
  ];
  t('within the right country, takes the most populous',
    G.pickHit('Springfield, US', many).matched === 'Springfield, Missouri, US',
    G.pickHit('Springfield, US', many).matched, 'Springfield, Missouri, US');
  t('reports the runners-up so a bad match can be spotted',
    G.pickHit('Springfield, US', many).alternatives.length === 1,
    G.pickHit('Springfield, US', many).alternatives.length, 1);

  let threw2 = false, msg = '';
  try { G.pickHit('Athens, GR', [{ name:'Athens', country_code:'US', latitude:1, longitude:1, population:9 }]); }
  catch (e) { threw2 = true; msg = e.message; }
  t('no match in the right country throws, naming what it did find',
    threw2 && /country GR/.test(msg) && /Athens\/US/.test(msg), msg, 'an explanatory throw');
  t('an empty response throws rather than returning undefined',
    (() => { try { G.pickHit('Athens, GR', []); return false; } catch (e) { return true; } })(), 'threw', 'threw');
}

console.log('\n── country codes that are not ISO 3166-1 ──');
{
  /* The regression this exists for: the label reads "London, UK", but every
     geocoder reports the United Kingdom as GB. Before the alias, the filter
     found no match, London threw, and because the generator refuses to write a
     partial library the whole run produced nothing. */
  t('"London, UK" resolves to the ISO code GB',
    G.splitLabel('London, UK').cc === 'GB', G.splitLabel('London, UK').cc, 'GB');
  t('the label the student sees is preserved separately',
    G.splitLabel('London, UK').shown === 'UK', G.splitLabel('London, UK').shown, 'UK');
  const uk = [
    { name:'London', country_code:'GB', admin1:'England', latitude:51.5085, longitude:-0.1257, elevation:25, population:8961989 },
    { name:'London', country_code:'CA', admin1:'Ontario', latitude:42.98,   longitude:-81.23,  elevation:251, population:346765 }
  ];
  t('London UK matches the GB result, not the Canadian one',
    G.pickHit('London, UK', uk).matched === 'London, England, GB',
    G.pickHit('London, UK', uk).matched, 'London, England, GB');
  t('a code needing no alias passes through untouched',
    G.splitLabel('Dublin, IE').cc === 'IE' && G.splitLabel('Dublin, IE').shown === 'IE', 'IE/IE', 'IE/IE');
  t('an error message names both the ISO code and the label code',
    (() => { try { G.pickHit('London, UK', [{name:'London',country_code:'CA',latitude:1,longitude:1,population:9}]); return false; }
             catch (e) { return /country GB/.test(e.message) && /label says UK/.test(e.message); } })(),
    'names both', 'names both');
  let threw = false;
  try { G.splitLabel('Somewhere, XYZ'); } catch (e) { threw = true; }
  t('a three-letter code is rejected rather than silently used', threw, threw, true);
}

console.log('\n── reading the app ──');
const app = G.loadFromApp();
{
  t('finds all 28 cities', app.CITIES.length === 28, app.CITIES.length, 28);
  t('reads the window from the app, not a copy',
    app.CLIMATE_WINDOW.from === '1991-01-01' && app.CLIMATE_WINDOW.to === '2020-12-31',
    app.CLIMATE_WINDOW.from + '..' + app.CLIMATE_WINDOW.to, '1991-01-01..2020-12-31');
  t('reads the app\'s own reducer', typeof app.CLIMATE.reduce === 'function', typeof app.CLIMATE.reduce, 'function');
  const r = app.CLIMATE.reduce(['2020-01-01','2020-01-02','2020-02-01'], [10, 0.5, 4]);
  t('the reducer it read actually works', r.monthly[0] === 10.5 && r.monthly[1] === 4, r.monthly.slice(0,2).join(','), '10.5,4');
  t('every city has an id, a name with a country code and a zone',
    app.CITIES.every(c => c.id && /,\s*[A-Z]{2}$/.test(c.name) && c.zone), 'all well formed', 'all well formed');
  /* preflight in miniature: every label in the shipped library must parse, or
     the run dies partway through */
  const parsed = app.CITIES.map(c => { try { return { ok: true, ...G.splitLabel(c.name) }; }
                                       catch (e) { return { ok: false, name: c.name, e: e.message }; } });
  t('every shipped city label parses into a place and an ISO code',
    parsed.every(p => p.ok), parsed.filter(p => !p.ok).map(p => p.name).join(', ') || 'all parse', 'all parse');
  t('every resolved code is two letters',
    parsed.every(p => /^[A-Z]{2}$/.test(p.cc)), 'all ISO2', 'all ISO2');
  t('the one aliased label is London, and it maps to GB',
    parsed.filter(p => p.cc !== p.shown).map(p => p.shown + '->' + p.cc).join(',') === 'UK->GB',
    parsed.filter(p => p.cc !== p.shown).map(p => p.shown + '->' + p.cc).join(',') || 'none', 'UK->GB');
}

console.log('\n── the rewrite round-trips ──');
{
  const meta = { name:'Test source', endpoint:'https://example.invalid/v1', window:'1991-01-01 to 2020-12-31',
                 accessed:'2026-09-14', licence:'CC BY 4.0' };
  const rows = app.CITIES.map((c, i) => ({
    ...c, lat: +(i - 14 + 0.25).toFixed(4), lon: +(i * 3 - 40 + 0.5).toFixed(4),
    elev: i === 0 ? null : i * 7, dpd: 2 + (i % 20),
    r: Array.from({ length: 12 }, (_, m) => +((i + 1) * (m + 1) * 0.7).toFixed(1))
  }));
  const patched = G.patch(app.html, rows, meta);

  /* the real test: can the app still be parsed and evaluated? */
  const js = patched.match(/<script>([\s\S]*?)<\/script>/)[1];
  const cut = js.indexOf('const GEO =');
  const back = new Function(js.slice(0, cut) + '\nreturn { CITIES, CLIMATE_SOURCE, climateProvenance };')();

  t('patched file still parses and evaluates', back.CITIES.length === 28, back.CITIES.length, 28);
  t('every id survives in order',
    back.CITIES.every((c, i) => c.id === rows[i].id), 'in order', 'in order');
  t('monthly values round-trip exactly',
    back.CITIES.every((c, i) => c.r.length === 12 && c.r.every((v, m) => v === rows[i].r[m])), 'exact', 'exact');
  t('coordinates, elevation and dpd round-trip',
    back.CITIES.every((c, i) => c.lat === rows[i].lat && c.lon === rows[i].lon &&
      c.elev === rows[i].elev && c.dpd === rows[i].dpd), 'exact', 'exact');
  t('a null elevation stays null, not 0 or "null"',
    back.CITIES[0].elev === null, JSON.stringify(back.CITIES[0].elev), 'null');
  t('names with a comma and a space survive quoting',
    back.CITIES.find(c => c.id === 'kul').name === 'Kuala Lumpur, MY',
    back.CITIES.find(c => c.id === 'kul').name, 'Kuala Lumpur, MY');

  t('CLIMATE_SOURCE is flipped to sourced', back.CLIMATE_SOURCE.sourced === true, back.CLIMATE_SOURCE.sourced, true);
  t('the provenance line now names source, window and date',
    /Test source/.test(back.climateProvenance()) && /1991/.test(back.climateProvenance()) &&
    /2026-09-14/.test(back.climateProvenance()), back.climateProvenance(), 'source · window · date');
  t('the disclaimer is gone once sourced',
    !/not a citable source/.test(back.climateProvenance()), back.climateProvenance(), 'no disclaimer');

  t('nothing outside the two blocks is touched',
    patched.length > 100000 && patched.includes('BS EN 16941-1:2024 Table 2') &&
    patched.includes('</html>'), 'app intact', 'app intact');

  /* patching the result again must be stable, or a second run corrupts the file */
  const twice = G.patch(patched, rows, meta);
  t('patching an already-patched file is stable', twice === patched, 'identical', 'identical');
}

console.log('\n\u2500\u2500 WWIS cross-check against the WMO Climate Normals \u2500\u2500');
{
  /* A canned table, not the 1.3 MB file: the point is the matching rule, and a
     test that needs a large download is a test that gets skipped.

     The case that matters is the one this project has already been bitten by —
     a city name that exists in the wrong country. "Athens" is a station in the
     United States; "Berlin" is one in Colombia; "Sydney" is one in Canada. A
     matcher that ignores the country finds all three and is confidently wrong. */
  const table = [
    { country: 'United_Kingdom', station: 'London',             lat: 51.5, lon: -0.1, months: [], annual: 113.5 },
    { country: 'United_States',  station: 'ATHENS_BEN_EPPS_AP', lat: 33.9, lon: -83.3, months: [], annual: 92.0 },
    { country: 'Colombia',       station: 'Berlin_Automatica',  lat: 7.2,  lon: -72.9, months: [], annual: 114.9 },
    { country: 'Germany',        station: 'Berlin-Brandenburg', lat: 52.4, lon: 13.5, months: [], annual: 100.6 },
    { country: 'Canada',         station: 'Sydney_Cs',          lat: 46.2, lon: -60.0, months: [], annual: 141.2 },
    { country: 'Australia',      station: 'SydneyAirport',      lat: -33.9, lon: 151.2, months: [], annual: 93.2 },
    { country: 'Singapore',      station: 'Changi',             lat: 1.4,  lon: 103.9, months: [], annual: 160.0 }
  ];

  const m = (city, cc) => W.matchNormals(table, city, cc);

  t('an exact station name in the right country matches',
    m('London', 'UK').station === 'London', m('London', 'UK').status, 'London');

  t('Athens, GR does NOT match the Athens in the United States',
    m('Athens', 'GR').status !== 'matched' && !('station' in m('Athens', 'GR')),
    JSON.stringify(m('Athens', 'GR')), 'no match — Greece is absent');

  t('Berlin, DE matches Germany and not Colombia',
    m('Berlin', 'DE').country === 'Germany', m('Berlin', 'DE').country, 'Germany');

  t('Sydney, AU matches Australia and not Canada',
    m('Sydney', 'AU').country === 'Australia', m('Sydney', 'AU').country, 'Australia');

  t('a country with no stations is reported, not silently skipped',
    /absent from the normals/.test(m('Nairobi', 'KE').status), m('Nairobi', 'KE').status, 'absent');

  t('a present country with no matching station says how many it looked at',
    /among 1 in Singapore/.test(m('Singapore', 'SG').status), m('Singapore', 'SG').status,
    'no station named for Singapore among 1 in Singapore');

  t('an unmapped country code is reported rather than guessed',
    /no country mapping/.test(m('Reykjavik', 'IS').status), m('Reykjavik', 'IS').status, 'no mapping');

  /* Turkey is spelled Turkiye in that file. Writing the map from memory gets
     this wrong, and the failure is silent: every Turkish city just misses. */
  t('the country map uses the spellings the file actually uses',
    W.NORMALS_COUNTRY.TR === 'Turkiye' && W.NORMALS_COUNTRY.UK === 'United_Kingdom',
    W.NORMALS_COUNTRY.TR, 'Turkiye');

  t('normKey ignores case, spaces and punctuation',
    W.normKey('KUALA LUMPUR') === W.normKey('kuala-lumpur') && W.normKey('St. John\'s') === 'stjohns',
    W.normKey('St. John\'s'), 'stjohns');
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
