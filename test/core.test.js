/* Data, geometry and hydrology — the numbers the app actually reports.
   Runs against the modules extracted from index.html by test/extract-core.mjs,
   so these assertions test the file that ships, not a copy of it.

   Run the whole suite with `npm test` from the repository root. */

const C = require('./.core.js');
const {GEO,HYD,MATERIALS,ROOFS,ROOF_ORDER,DEMOS,newModel,newBlock,sum} = C;
let pass=0, fail=0;
const near=(a,b,tol)=>Math.abs(a-b)<=(tol===undefined?1e-6:tol);
function t(name, cond, got, want){ if(cond){pass++;console.log('  PASS  '+name);} else {fail++;console.log('  FAIL  '+name+'\n         got '+got+'  want '+want);} }

function mk(over, roofOver, mat){
  const m=newModel();
  m.blocks=[newBlock(Object.assign({material:mat||'rough'},over,{roof:Object.assign(newBlock().roof,roofOver||{})}))];
  return m;
}

console.log('\n── 1. Yield to BS EN 16941-1 ──');
{
  const m=mk({w:10,d:10,wallH:4},{type:'flat',overhang:0,pitch:2,parapet:0},'rough');
  m.climate.monthly=new Array(12).fill(700/12); m.climate.mode='manual';
  m.system.filterCoef=0.90; m.system.firstFlush=0;
  const g=GEO.build(m), r=HYD.compute(m,g);
  t('catchment = 100 m²', near(g.catchment,100,1e-9), g.catchment, 100);
  t('Yc = 0.80 (pitched rough, concrete tile)', near(g.ycMean,0.80,1e-9), g.ycMean, 0.80);
  t('Y = 100 × 700mm × 0.80 × 0.90 = 50,400 L/yr', near(r.annualInflow,50400,1e-6), r.annualInflow.toFixed(4), 50400);
  /* Table 2 of BS EN 16941-1:2024, all eight rows, values as published */
  const yc=[['smooth',0.90],['rough',0.80],['flatNoGravel',0.80],['flatGravel',0.70],
            ['greenInt',0.30],['greenExt',0.50],['sealed',0.80],['unsealed',0.50]];
  for(const [k,v] of yc) t('Yc '+k+' = '+v.toFixed(2), MATERIALS[k].yc===v, MATERIALS[k].yc, v);
}

console.log('\n── 2. Catchment is the plan projection, not the surface ──');
{
  const W=12,D=8,O=0.5, plan=(W+2*O)*(D+2*O);
  for(const pitch of [15,30,45]){
    const g=GEO.build(mk({w:W,d:D,wallH:5},{type:'gable',pitch,overhang:O}));
    t(`gable ${pitch}° catchment = ${plan.toFixed(2)} m² (= flat equivalent)`, near(g.catchment,plan,1e-6), g.catchment.toFixed(4), plan.toFixed(4));
    const want=plan/Math.cos(pitch*Math.PI/180);
    t(`gable ${pitch}° surface = plan / cos(pitch) = ${want.toFixed(3)}`, near(g.surface,want,1e-4), g.surface.toFixed(4), want.toFixed(4));
  }
  for(const type of ['flat','hip','shed','butterfly','vault','pyramid']){
    const g=GEO.build(mk({w:W,d:D,wallH:5},{type,pitch:30,overhang:O,rise:3,bays:4,ridgeRatio:1}));
    t(`${type} catchment = ${plan.toFixed(2)} m²`, near(g.catchment,plan,1e-4), g.catchment.toFixed(4), plan.toFixed(4));
    t(`${type} surface >= catchment`, g.surface>=g.catchment-1e-6, g.surface.toFixed(3), '>= '+g.catchment.toFixed(3));
  }
  const gs=GEO.build(mk({w:W,d:D,wallH:5},{type:'sawtooth',pitch:30,overhang:O,bays:4}));
  const wantS=(W+2*O)*(D+O);   // sawtooth carries its overhang on the low edge only
  t(`sawtooth catchment = ${wantS.toFixed(2)} m² (overhang on the low edge only)`, near(gs.catchment,wantS,1e-4), gs.catchment.toFixed(4), wantS.toFixed(4));
  const gv=GEO.build(mk({w:W,d:D,wallH:5},{type:'vault',rise:4,overhang:O}));
  t('vault surface strictly exceeds catchment', gv.surface>gv.catchment*1.05, gv.surface.toFixed(2), '> '+(gv.catchment*1.05).toFixed(2));
  const gf=GEO.build(mk({w:W,d:D,wallH:5},{type:'flat',overhang:O,pitch:2,parapet:0.6}));
  t('flat surface == catchment', near(gf.surface,gf.catchment,1e-6), gf.surface.toFixed(4), gf.catchment.toFixed(4));
}

console.log('\n── 1b. CLIMATE.reduce matches the code it replaced ──');
{
  /* The reduction used to live inline in the Open-Meteo fetch handler. This is
     that code, verbatim, kept here as the oracle: if the extracted function ever
     drifts from it, this fails. */
  const oracle = (time, pr) => {
    const tot = new Array(12).fill(0), yrs = new Set(), wet = new Array(12).fill(0);
    for (let i = 0; i < time.length; i++) {
      const v = pr[i]; if (v == null) continue;
      const mo = +time[i].slice(5, 7) - 1;
      tot[mo] += v; yrs.add(time[i].slice(0, 4));
      if (v >= 1) wet[mo]++;
    }
    const n = Math.max(1, yrs.size);
    const monthly = tot.map(v => Math.round((v / n) * 10) / 10);
    const wetTotal = sum(wet) / n, rainTotal = sum(tot) / n;
    const dpd = Math.max(2, Math.min(30, Math.round(wetTotal > 0 ? rainTotal / wetTotal : 8)));
    return { monthly, dpd };
  };
  /* deterministic pseudo-random series, 6 years of daily values incl. dry spells */
  let seed = 20260914;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const time = [], pr = [];
  for (let y = 2015; y <= 2020; y++)
    for (let m = 1; m <= 12; m++) {
      const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (let d = 1; d <= dim; d++) {
        time.push(y + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0'));
        const x = rnd();
        pr.push(x < 0.55 ? 0 : x < 0.85 ? +(x * 3).toFixed(1) : +(x * 40).toFixed(1));
      }
    }
  const want = oracle(time, pr), got = C.CLIMATE.reduce(time, pr);
  t('monthly means identical to the old inline code',
    got.monthly.every((v,i)=>v===want.monthly[i]), got.monthly.join(','), want.monthly.join(','));
  t('dpd identical to the old inline code', got.dpd===want.dpd, got.dpd, want.dpd);
  t('reports the number of distinct years seen', got.years===6, got.years, 6);
  t('annual is the sum of the monthly means',
    near(got.annual, got.monthly.reduce((a,b)=>a+b,0), 1e-9), got.annual, 'sum');

  /* purity: same input twice, same output */
  const again = C.CLIMATE.reduce(time, pr);
  t('pure — the same series reduces identically twice',
    JSON.stringify(again)===JSON.stringify(got), 'stable', 'stable');

  /* gaps and junk are skipped, not counted */
  const holed = pr.slice(); holed[10]=null; holed[11]=undefined; holed[12]=NaN;
  const hg = C.CLIMATE.reduce(time, holed);
  t('null, undefined and NaN days are skipped', hg.days===got.days-3, hg.days, got.days-3);

  /* dpd edges. A wet day is 1 mm or more, so a place that never reaches 1 mm has
     no wet days at all and no meaningful depth per wet day: the rule falls back
     to 8 rather than dividing by zero. Worth knowing for the driest presets. */
  const drizzle = time.map(()=>0.2), atOneMm = time.map(()=>1.0), deluge = time.map(()=>90);
  t('no day reaching 1 mm falls back to dpd 8', C.CLIMATE.reduce(time,drizzle).dpd===8, C.CLIMATE.reduce(time,drizzle).dpd, 8);
  t('dpd clamped up to 2 when every day is exactly 1 mm', C.CLIMATE.reduce(time,atOneMm).dpd===2, C.CLIMATE.reduce(time,atOneMm).dpd, 2);
  t('dpd clamped down to 30 for constant deluge', C.CLIMATE.reduce(time,deluge).dpd===30, C.CLIMATE.reduce(time,deluge).dpd, 30);

  let threw=false; try { C.CLIMATE.reduce([], []); } catch(e){ threw=true; }
  t('an empty series throws rather than returning zeros', threw, threw, true);
  threw=false; try { C.CLIMATE.reduce(time, time.map(()=>null)); } catch(e){ threw=true; }
  t('an all-null series throws', threw, threw, true);
}

console.log('\n── 1c. Climate provenance is declared, not assumed ──');
{
  const S = C.CLIMATE_SOURCE;
  t('CLIMATE_SOURCE carries a sourced flag', typeof S.sourced === 'boolean', typeof S.sourced, 'boolean');
  t('while unsourced, the provenance line says so',
    S.sourced || /not measured data/.test(C.climateProvenance()), C.climateProvenance(), 'a disclaimer');
  t('a sourced library would print name, window and date',
    !S.sourced || (S.name && S.window && S.accessed), 'complete', 'complete');
  t('the fetch window is the WMO normal period',
    C.CLIMATE_WINDOW.from==='1991-01-01' && C.CLIMATE_WINDOW.to==='2020-12-31',
    C.CLIMATE_WINDOW.from+'..'+C.CLIMATE_WINDOW.to, '1991-01-01..2020-12-31');

  /* four ways rainfall gets into a model, four different things to say about it */
  const P = C.rainfallProvenanceFor;
  t('a fetched series is attributed to Open-Meteo and its window',
    /Open-Meteo/.test(P({source:'open-meteo'})) && /1991/.test(P({source:'open-meteo'})),
    P({source:'open-meteo'}), 'Open-Meteo + window');
  t('a hand-typed profile says the source is the author\'s to give',
    /Entered by hand/.test(P({source:'manual'})), P({source:'manual'}), 'entered by hand');
  t('a scaled preset says it is scaled, and carries the library provenance',
    /scaled/.test(P({source:'preset-scaled'})) && P({source:'preset-scaled'}).includes(C.climateProvenance()),
    P({source:'preset-scaled'}), 'scaled + library provenance');
  t('a preset carries the library provenance unchanged',
    P({source:'preset'}) === C.climateProvenance(), P({source:'preset'}), C.climateProvenance());
  t('an unknown or missing source falls back to the library, never to silence',
    P({}) === C.climateProvenance() && P(null) === C.climateProvenance() && P({source:'nonsense'}) === C.climateProvenance(),
    'falls back', 'falls back');
  t('no provenance line is ever empty',
    ['preset','preset-scaled','manual','open-meteo',undefined].every(src => P({source:src}).trim().length > 10),
    'all non-empty', 'all non-empty');

  /* the demo models must not bypass the stamping */
  t('every demo stamps a rainfall source',
    DEMOS.every(d => !!d.make().climate.source), 'all stamped', 'all stamped');
  t('climateFor carries coordinates once the library has them',
    ['lat','lon'].every(k => typeof C.climateFor('lon')[k] === 'number'),
    JSON.stringify([C.climateFor('lon').lat, C.climateFor('lon').lon]), 'numbers');
}

console.log('\n── 2b. Old material keys migrate onto Table 2 ──');
{
  /* six keys from before the coefficients were corrected */
  const map = {tile:['rough',0.80], metal:['smooth',0.90], felt:['flatNoGravel',0.80],
               concrete:['sealed',0.80], green:['greenExt',0.50], gravel:['flatGravel',0.70]};
  for (const [old,[want,yc]] of Object.entries(map)) {
    t('"'+old+'" maps to '+want, C.matKey(old)===want, C.matKey(old), want);
    const b=newBlock({material:old});
    t('newBlock("'+old+'") carries e = '+yc.toFixed(2), MATERIALS[b.material].yc===yc, MATERIALS[b.material].yc, yc);
  }
  t('an unknown key falls back to pitched rough', C.matKey('nonsense')==='rough', C.matKey('nonsense'), 'rough');
  t('a current key is left alone', C.matKey('greenInt')==='greenInt', C.matKey('greenInt'), 'greenInt');
  t('every demo block uses a current key',
    DEMOS.every(d=>d.make().blocks.every(b=>!!MATERIALS[b.material])), 'all current', 'all current');
}

console.log('\n── 3. Mixed materials weight by area ──');
{
  const m=newModel();
  m.blocks=[newBlock({x:-10,w:10,d:10,material:'greenExt',roof:Object.assign(newBlock().roof,{type:'flat',overhang:0,parapet:0})}),
            newBlock({x:10, w:10,d:10,material:'smooth',roof:Object.assign(newBlock().roof,{type:'flat',overhang:0,parapet:0})})];
  const g=GEO.build(m);
  t('area-weighted Yc = (0.50+0.90)/2 = 0.70', near(g.ycMean,0.70,1e-9), g.ycMean, 0.70);
}

console.log('\n── 3b. Annual totals carry no float noise ──');
{
  /* Monthly rainfall is published to one decimal, so a year's total is exact to
     one decimal — but summing twelve binary floats is not. Ten of the twenty-eight
     cities produced tails like 79.10000000000001 and 1024.1999999999998, and they
     reached the location list verbatim. */
  const noisy = C.CITIES.filter(c => {
    const frac = String(C.sum(c.r)).split('.')[1] || '';
    return frac.length > 1;
  });
  t('raw sums really are noisy, so this test is about something',
    noisy.length > 0, noisy.length, '> 0');

  const stillNoisy = C.CITIES.filter(c => {
    const a = C.climateFor(c.id).annual;
    const frac = String(a).split('.')[1] || '';
    return frac.length > 1;
  });
  t('climateFor().annual is clean for every city',
    stillNoisy.length === 0,
    stillNoisy.map(c => c.name + ' ' + C.climateFor(c.id).annual).join(', ') || 'none', 'none');

  /* Rounding must not move the number, only its representation. */
  const moved = C.CITIES.filter(c => Math.abs(C.climateFor(c.id).annual - C.sum(c.r)) > 0.05);
  t('rounding changes no annual total by more than 0.05 mm',
    moved.length === 0, moved.map(c => c.name).join(', ') || 'none', 'none');
}

console.log('\n── 4. Water balance conserves volume ──');
{
  for(const [name,city,cap] of [['London auto','lon',null],['Kuala Lumpur','kul',5000],['Dubai','dxb',20000],['Chittagong monsoon','cgp',60000]]){
    const m=mk({w:16,d:10,wallH:6},{type:'gable',pitch:30,overhang:0.5});
    m.climate=C.climateFor(city); m.demand.occupants=8;
    if(cap!==null){m.system.tankMode='manual';m.system.tank=cap;}
    for(const daily of [false,true]){
      m.system.daily=daily;
      const g=GEO.build(m), r=HYD.compute(m,g), b=r.bal;
      const resid=b.totalInflow-b.totalSupplied-b.totalOverflow;
      const rel=b.totalInflow>0?Math.abs(resid)/b.totalInflow:0;
      t(`${name} ${daily?'daily ':'monthly'} : inflow = supplied + spill (residual ${(rel*100).toFixed(3)}%)`, rel<0.005, resid.toFixed(1)+' L', '≈ 0');
      t(`${name} ${daily?'daily ':'monthly'} : supplied <= demand`, b.totalSupplied<=b.totalDemand+1e-6, b.totalSupplied.toFixed(0), '<= '+b.totalDemand.toFixed(0));
      t(`${name} ${daily?'daily ':'monthly'} : store never exceeds capacity`, b.level.every(v=>v<=r.capacity+1e-6), Math.max(...b.level).toFixed(0), '<= '+r.capacity.toFixed(0));
      t(`${name} ${daily?'daily ':'monthly'} : store never negative`, b.level.every(v=>v>=-1e-9), Math.min(...b.level).toFixed(3), '>= 0');
      t(`${name} ${daily?'daily ':'monthly'} : 0 <= demand met <= 1`, b.saving>=0&&b.saving<=1+1e-9, b.saving, '0..1');
    }
  }
}

console.log('\n── 5. Tank sizing ──');
{
  const m=mk({w:11,d:8,wallH:5.2},{type:'gable',pitch:35,overhang:0.6});
  m.climate=C.climateFor('lon'); m.demand.occupants=4;
  const g=GEO.build(m), r=HYD.compute(m,g);
  /* A.2.1, Formulas (A.1)/(A.2): lesser of yield and demand x dd / 365 */
  const want=Math.min(r.annualInflow,r.annualDemand)*(r.dryDays/365);
  t('A.2.1 = lesser of yield and demand x dd/365', near(r.simple,want,1e-6), r.simple.toFixed(2), want.toFixed(2));
  const days=r.simple/(Math.min(r.annualInflow,r.annualDemand)/365);
  t('store equals the dry period in days of the binding side', Math.abs(days-r.dryDays)<1e-6, days.toFixed(3), r.dryDays);
  t('National Annex NA.3 halving tracks the yield/demand ratio',
    r.naHalved === (r.ydRatio<0.5||r.ydRatio>2.0) && near(r.dryDays, m.system.dryDays*(r.naHalved?0.5:1),1e-9),
    'halved='+r.naHalved+' ratio='+r.ydRatio.toFixed(2)+' dd='+r.dryDays, 'consistent');

  /* the standard's three worked dry periods, inside the 0.5-2.0 band so NA.3 is off */
  const m2=mk({w:11,d:8,wallH:5.2},{type:'gable',pitch:35,overhang:0.6});
  m2.climate=C.climateFor('lon'); m2.demand.occupants=4;   /* yield/demand 0.83, inside the NA.3 band */
  for(const dd of [15,18,21]){
    m2.system.dryDays=dd;
    const g2=GEO.build(m2), r2=HYD.compute(m2,g2);
    const w2=Math.min(r2.annualInflow,r2.annualDemand)*(dd/365);
    t('dd='+dd+' days sizes the store to '+w2.toFixed(0)+' L',
      !r2.naHalved && near(r2.simple,w2,1e-6), r2.simple.toFixed(2), w2.toFixed(2));
  }
  t('knee is within the swept range', r.knee>=0 && r.knee<=r.sweep[r.sweep.length-1].cap, r.knee.toFixed(0), '0..'+r.sweep[r.sweep.length-1].cap.toFixed(0));
  const mono=r.sweep.every((s,i)=>i===0||s.saving>=r.sweep[i-1].saving-1e-9);
  t('demand met rises monotonically with capacity', mono, 'monotonic', 'monotonic');
  t('capacity 0 gives >0% met only from same-step inflow', r.sweep[0].saving>=0, r.sweep[0].saving, '>= 0');
}

console.log('\n── 6. Every demo model builds and computes ──');
for(const d of DEMOS){
  try{
    const m=d.make(); const g=GEO.build(m); const r=HYD.compute(m,g);
    const ok=isFinite(g.catchment)&&g.catchment>0&&isFinite(r.annualInflow)&&isFinite(r.bal.saving)&&g.faces.length>0;
    t(`${d.id} — ${g.per.length} block(s), ${g.catchment.toFixed(0)} m², ${(r.bal.saving*100).toFixed(0)}% met`, ok, 'built', 'finite');
  }catch(e){ t(d.id+' builds', false, e.message, 'no throw'); }
}

console.log('\n── 7. Every roof type produces closed, finite geometry ──');
for(const type of ROOF_ORDER){
  const g=GEO.build(mk({w:12,d:8,wallH:5},{type,pitch:30,overhang:0.5,rise:3,bays:4,ridgeRatio:1,parapet:0.6}));
  const finite=g.faces.every(f=>f.pts.every(p=>p.every(v=>isFinite(v)))&&isFinite(f.surfaceArea)&&f.surfaceArea>=0);
  const hasRoof=g.faces.some(f=>f.kind==='roof');
  const hasWall=g.faces.filter(f=>f.kind==='wall').length>=4;
  t(`${type}: ${g.faces.length} faces, all finite`, finite, 'finite', 'finite');
  t(`${type}: has roof + at least 4 walls`, hasRoof&&hasWall, 'ok', 'ok');
  t(`${type}: gutters found (${g.drain.gutters.length})`, g.drain.gutters.length>0, g.drain.gutters.length, '> 0');
}

console.log('\n── 8. Edge cases ──');
{
  const m=mk({w:2,d:2,wallH:2},{type:'gable',pitch:1,overhang:0});
  const g=GEO.build(m); t('tiny block, 1° pitch, no overhang', isFinite(g.catchment)&&g.catchment>0, g.catchment, '> 0');
  const m2=mk({w:120,d:120,wallH:40},{type:'hip',pitch:60,overhang:3});
  const g2=GEO.build(m2); t('max-size block, 60° hip', isFinite(g2.catchment)&&g2.catchment>0, g2.catchment.toFixed(0), '> 0');
  const m3=mk({w:12,d:8,wallH:5},{type:'gable',pitch:30,overhang:0.5});
  m3.climate.monthly=new Array(12).fill(0); m3.climate.mode='manual';
  const r3=HYD.compute(m3,GEO.build(m3));
  t('zero rainfall: 0% met, no NaN', r3.bal.saving===0&&isFinite(r3.simple), r3.bal.saving, 0);
  const m4=mk({w:12,d:8,wallH:5},{type:'gable',pitch:30,overhang:0.5});
  m4.demand.occupants=0; m4.demand.irrigArea=0;
  const r4=HYD.compute(m4,GEO.build(m4));
  t('zero demand: no NaN, everything spills', isFinite(r4.bal.saving)&&r4.bal.totalOverflow>0, r4.bal.saving, 'finite');
  const m5=mk({w:12,d:8,wallH:5},{type:'gable',pitch:30,overhang:0.5});
  m5.system.firstFlush=2; m5.climate=C.climateFor('lon');
  const r5a=HYD.compute(m5,GEO.build(m5));
  m5.system.firstFlush=0;
  const r5b=HYD.compute(m5,GEO.build(m5));
  t('first flush reduces yield', r5a.annualInflow<r5b.annualInflow, r5a.annualInflow.toFixed(0), '< '+r5b.annualInflow.toFixed(0));
}


console.log('\n── 9. Tessellation preserves the model exactly ──');
{
  const triArea=p=>{const u=[p[1][0]-p[0][0],p[1][1]-p[0][1],p[1][2]-p[0][2]],v=[p[2][0]-p[0][0],p[2][1]-p[0][1],p[2][2]-p[0][2]];
    return 0.5*Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);};
  for(const type of ROOF_ORDER){
    const g=GEO.build(mk({w:12,d:8,wallH:5},{type,pitch:30,overhang:0.5,rise:3,bays:4,ridgeRatio:1,parapet:0.6}));
    let worst=0;
    for(const f of g.faces){
      const a=g.prims.filter(t=>t.f===f).reduce((s,t)=>s+triArea(t.p),0);
      worst=Math.max(worst,Math.abs(a-f.surfaceArea)/Math.max(1e-9,f.surfaceArea));
    }
    t(`${type}: triangles sum to the face area exactly (${g.prims.length} tris, maxEdge ${g.maxEdge.toFixed(2)} m)`,
      worst<1e-9, (worst*100).toFixed(6)+'%', '0%');
    t(`${type}: triangle count within budget`, g.prims.length<=6000, g.prims.length, '<= 6000');
    const soft=g.faces.some(f=>f.softEdge&&f.softEdge.some(Boolean));
    if(type==='vault') t('vault: near-coplanar strip seams marked smooth', soft, soft, true);
    if(type==='gable') t('gable: the ridge is a real crease, not smoothed',
      g.faces.filter(f=>f.kind==='roof').every(f=>!f.softEdge.every(Boolean)), 'crease kept', 'crease kept');
  }
}

console.log('\n── 10. Plan-overlap detection ──');
{
  const two=(x2)=>{const m=newModel();
    m.blocks=[newBlock({name:'A',x:0,z:0,w:10,d:10,roof:Object.assign(newBlock().roof,{type:'gable',overhang:0.5})}),
              newBlock({name:'B',x:x2,z:0,w:10,d:10,roof:Object.assign(newBlock().roof,{type:'gable',overhang:0.5})})];
    return GEO.build(m);};
  t('clearly separated blocks: no overlap', two(20).overlaps.length===0, two(20).overlaps.length, 0);
  t('roofs exactly touching: no overlap', two(11).overlaps.length===0, two(11).overlaps.length, 0);
  t('roofs interpenetrating: overlap reported', two(10).overlaps.length===1, two(10).overlaps.length, 1);
  t('overlap area is right (1 m x 11 m = 11 m2)', Math.abs(two(10).overlaps[0].area-11)<1e-6, two(10).overlaps[0].area.toFixed(3), 11);
  for(const d of DEMOS) t(`demo ${d.id} does not overlap itself`, GEO.build(d.make()).overlaps.length===0,
    GEO.build(d.make()).overlaps.length, 0);
}

console.log('\n── 11. Harvest vs supplied are distinct quantities ──');
for(const city of ['kul','lon','dxb']){
  const m=mk({w:16,d:10,wallH:6.5},{type:'gable',pitch:30,overhang:0.5});
  m.climate=C.climateFor(city); m.demand.occupants=8;
  const g=GEO.build(m), r=HYD.compute(m,g), b=r.bal;
  const want=g.catchment*r.annualRain*g.ycMean*m.system.filterCoef;
  t(`${city}: annualInflow is the harvest A.R.Yc.Fc`, Math.abs(r.annualInflow-want)<1e-6, r.annualInflow.toFixed(2), want.toFixed(2));
  t(`${city}: overflow can never exceed the harvest`, b.totalOverflow<=r.annualInflow+1e-6,
    b.totalOverflow.toFixed(0), '<= '+r.annualInflow.toFixed(0));
  t(`${city}: supplied <= harvest`, b.totalSupplied<=r.annualInflow+1e-6, b.totalSupplied.toFixed(0), '<= '+r.annualInflow.toFixed(0));
  t(`${city}: mains displaced equals what the store supplied`, Math.abs(r.mainsSaved*1000-b.totalSupplied)<1e-6,
    (r.mainsSaved*1000).toFixed(2), b.totalSupplied.toFixed(2));
}

console.log('\n'+(fail?'✗ ':'✓ ')+pass+' passed, '+fail+' failed\n');
process.exit(fail?1:0);
