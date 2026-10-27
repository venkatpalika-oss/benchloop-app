/* Bench & Loop calculation engine: units, sensor equations and tool definitions */
/* ---------- helpers ---------- */
const SUP={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':''};
function fmt(x,sig=5){
  if(x===null||x===undefined||!isFinite(x))return '—';
  if(x===0)return '0';
  const a=Math.abs(x);
  if(a>=1e7||a<1e-4){const [m,e]=x.toExponential(sig-1).split('e');return `${(+m)} × 10${e.replace(/./g,c=>SUP[c]??c)}`}
  return x.toLocaleString('en-US',{maximumSignificantDigits:sig});
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function solveBlank(v,keys,solvers){
  const blanks=keys.filter(k=>v[k]===null);
  if(blanks.length!==1)return {error:`Leave exactly one field empty to solve for it (${blanks.length} empty now).`};
  const k=blanks[0];return {key:k,value:solvers[k](v)};
}

/* ---------- Type K thermocouple (NIST ITS-90) ---------- */
const KNEG=[0,3.9450128025e-2,2.3622373598e-5,-3.2858906784e-7,-4.9904828777e-9,-6.7509059173e-11,-5.7410327428e-13,-3.1088872894e-15,-1.0451609365e-17,-1.9889266878e-20,-1.6322697486e-23];
const KPOS=[-1.7600413686e-2,3.8921204975e-2,1.8558770032e-5,-9.9457592874e-8,3.1840945719e-10,-5.6072844889e-13,5.6075059059e-16,-3.2020720003e-19,9.7151147152e-23,-1.2104721275e-26];
function kEmf(t){const c=t<0?KNEG:KPOS;let e=0;for(let i=c.length-1;i>=0;i--)e=e*t+c[i];if(t>=0)e+=0.1185976*Math.exp(-1.183432e-4*(t-126.9686)**2);return e}
function bisect(f,target,lo,hi){let flo=f(lo)-target;if(flo*(f(hi)-target)>0)return NaN;for(let i=0;i<80;i++){const m=(lo+hi)/2,fm=f(m)-target;if(flo*fm<=0)hi=m;else{lo=m;flo=fm}}return (lo+hi)/2}
/* ---------- RTD (IEC 60751 Callendar–Van Dusen) ---------- */
const RA=3.9083e-3,RB=-5.775e-7,RC=-4.183e-12;
function rtdR(t,r0){return r0*(1+RA*t+RB*t*t+(t<0?RC*(t-100)*t**3:0))}

/* ---------- unit tables ---------- */
const PU={'Pa':1,'kPa':1e3,'MPa':1e6,'bar':1e5,'mbar':100,'psi':6894.757,'atm':101325,'kg/cm²':98066.5,'mmHg':133.3224,'inHg':3386.389,'mmH₂O':9.80665,'inH₂O':249.0889};
const CU={'% w/v':10,'g/L':1,'mg/L (ppm)':1e-3,'µg/L (ppb)':1e-6,'mol/L':'M','mmol/L':'mM'};

/* ---------- tool definitions ---------- */
const TOOLS=[
{id:'molarity',group:'Lab',name:'Molarity',tag:'n = m/M',title:'Molarity & mass to weigh',
 desc:'How much solid to weigh for a target molar solution, or the molarity of what you made. Leave one field empty to solve for it.',
 fields:[{id:'mw',label:'Molar mass',unit:'g/mol',v:58.44},{id:'c',label:'Concentration',unit:'mol/L',v:0.5},{id:'vol',label:'Final volume',unit:'mL',v:250},{id:'m',label:'Mass',unit:'g',v:''}],
 calc(v){const r=solveBlank(v,['mw','c','vol','m'],{
   m:v=>v.c*v.vol/1000*v.mw, c:v=>v.m/v.mw/(v.vol/1000), vol:v=>v.m/v.mw/v.c*1000, mw:v=>v.m/(v.c*v.vol/1000)});
   if(r.error)return r;
   const L={m:['Mass to weigh','g'],c:['Concentration','mol/L'],vol:['Final volume','mL'],mw:['Molar mass','g/mol']}[r.key];
   const all={...v,[r.key]:r.value};
   return {main:[L[0],r.value,L[1]],rows:[['Amount',all.m/all.mw*1000,'mmol'],['Concentration',all.c*1000,'mmol/L'],['Mass concentration',all.c*all.mw,'g/L']],
     formula:'mass (g) = M (mol/L) × V (L) × MW (g/mol)',note:'Example: 0.5 M NaCl, 250 mL.'}}},

{id:'dilution',group:'Lab',name:'Dilution',tag:'C₁V₁=C₂V₂',title:'Dilution  C₁V₁ = C₂V₂',
 desc:'Use any concentration unit, as long as C₁ and C₂ match, and any volume unit for V₁ and V₂. Leave one field empty.',
 fields:[{id:'c1',label:'Stock conc. C₁',unit:'conc',v:1000},{id:'v1',label:'Stock volume V₁',unit:'vol',v:''},{id:'c2',label:'Final conc. C₂',unit:'conc',v:10},{id:'v2',label:'Final volume V₂',unit:'vol',v:100}],
 calc(v){const r=solveBlank(v,['c1','v1','c2','v2'],{c1:v=>v.c2*v.v2/v.v1,v1:v=>v.c2*v.v2/v.c1,c2:v=>v.c1*v.v1/v.v2,v2:v=>v.c1*v.v1/v.c2});
   if(r.error)return r;const a={...v,[r.key]:r.value};
   const L={c1:'Stock concentration C₁',v1:'Stock volume V₁',c2:'Final concentration C₂',v2:'Final volume V₂'}[r.key];
   return {main:[L,r.value,''],rows:[['Diluent to add (V₂ − V₁)',a.v2-a.v1,''],['Dilution factor',a.c1/a.c2,'×'],['Ratio',`1 : ${fmt(a.c1/a.c2-1,4)}`,'stock : diluent']],
     formula:'C₁ × V₁ = C₂ × V₂',note:a.c2>a.c1?'C₂ is higher than C₁. A dilution cannot concentrate a solution.':'Example: 1000 mg/L standard down to 10 mg/L in a 100 mL flask.'}}},

{id:'concentration',group:'Lab',name:'Concentration units',tag:'ppm ↔ M',title:'Concentration unit converter',
 desc:'Convert between %, g/L, ppm, ppb and molar units. ppm/ppb assume a dilute aqueous solution (density ≈ 1 g/mL).',
 fields:[{id:'x',label:'Value',unit:'',v:250},{id:'u',label:'From',type:'select',options:Object.keys(CU),v:'mg/L (ppm)'},{id:'mw',label:'Molar mass (for molar units)',unit:'g/mol',v:342.3}],
 calc(v){const f=CU[v.u];if(v.x===null)return {error:'Enter a value to convert.'};
   const needMW=typeof f==='string';if(needMW&&!v.mw)return {error:'Enter the molar mass to convert from a molar unit.'};
   const gL=f==='M'?v.x*v.mw:f==='mM'?v.x*v.mw/1000:v.x*f;
   const rows=[['% w/v',gL/10,'%'],['g/L',gL,'g/L'],['mg/L (ppm)',gL*1e3,'ppm'],['µg/L (ppb)',gL*1e6,'ppb']];
   if(v.mw)rows.push(['mol/L',gL/v.mw,'M'],['mmol/L',gL/v.mw*1e3,'mM'],['µmol/L',gL/v.mw*1e6,'µM']);
   return {main:['Mass concentration',gL,'g/L'],rows,formula:'1 % w/v = 10 g/L · 1 ppm ≈ 1 mg/L · M = (g/L) ÷ MW',note:'Example: 250 ppm sucrose (MW 342.3).'}}},

{id:'ph',group:'Lab',name:'pH & pOH',tag:'−log[H⁺]',title:'pH, pOH and ion concentrations',
 desc:'Assumes 25 °C (Kw = 1.0 × 10⁻¹⁴) and full dissociation for strong acids and bases.',
 fields:[{id:'mode',label:'Input is',type:'select',options:['pH','[H⁺] in mol/L','[OH⁻] in mol/L','Strong acid conc. (mol/L, monoprotic)','Strong base conc. (mol/L, monohydroxide)'],v:'Strong acid conc. (mol/L, monoprotic)'},{id:'x',label:'Value',unit:'',v:0.01}],
 calc(v){if(v.x===null)return {error:'Enter a value.'};let pH;const m=v.mode;
   if(m==='pH')pH=v.x;else{if(v.x<=0)return {error:'Concentration must be above zero.'};
     if(m.startsWith('[H')||m.startsWith('Strong acid'))pH=-Math.log10(v.x);else pH=14+Math.log10(v.x);}
   const H=10**-pH,OH=10**-(14-pH);
   return {main:['pH',pH,''],rows:[['pOH',14-pH,''],['[H⁺]',H,'mol/L'],['[OH⁻]',OH,'mol/L'],['Character',pH<7?'Acidic':pH>7?'Basic':'Neutral','']],
     formula:'pH = −log₁₀[H⁺] · pH + pOH = 14',note:'Very dilute acids (< 10⁻⁶ M) approach pH 7 because of water autoionisation; this simple model ignores that.'}}},

{id:'buffer',group:'Lab',name:'Buffer pH',tag:'H–H',title:'Buffer pH  (Henderson–Hasselbalch)',
 desc:'pH of a weak acid / conjugate base buffer, and the base-to-acid ratio needed for a target pH.',
 fields:[{id:'pka',label:'pKa',unit:'',v:4.76},{id:'a',label:'[A⁻] conjugate base',unit:'mol/L',v:0.15},{id:'ha',label:'[HA] weak acid',unit:'mol/L',v:0.1},{id:'t',label:'Target pH (optional)',unit:'',v:5.0}],
 calc(v){if(v.pka===null||!v.a||!v.ha)return {error:'Enter pKa and both concentrations.'};
   const pH=v.pka+Math.log10(v.a/v.ha);const rows=[['[A⁻]/[HA]',v.a/v.ha,''],['Total buffer',v.a+v.ha,'mol/L']];
   if(v.t!==null){const r=10**(v.t-v.pka);rows.push(['Ratio for target pH',r,''],['At same total: [A⁻]',(v.a+v.ha)*r/(1+r),'mol/L'],['At same total: [HA]',(v.a+v.ha)/(1+r),'mol/L'])}
   return {main:['Buffer pH',pH,''],rows,formula:'pH = pKa + log₁₀([A⁻]/[HA])',
     note:Math.abs(pH-v.pka)>1?'pH is more than 1 unit from pKa, so buffer capacity is poor.':'Example: acetate buffer, pKa 4.76. Effective range is pKa ± 1.'}}},

{id:'beer',group:'Lab',name:'Beer–Lambert',tag:'A = εlc',title:'Beer–Lambert law',
 desc:'Absorbance, molar absorptivity, path length or concentration. Leave one field empty.',
 fields:[{id:'A',label:'Absorbance A',unit:'AU',v:0.42},{id:'e',label:'Molar absorptivity ε',unit:'L/mol·cm',v:6220},{id:'l',label:'Path length l',unit:'cm',v:1},{id:'c',label:'Concentration c',unit:'mol/L',v:''}],
 calc(v){const r=solveBlank(v,['A','e','l','c'],{A:v=>v.e*v.l*v.c,e:v=>v.A/(v.l*v.c),l:v=>v.A/(v.e*v.c),c:v=>v.A/(v.e*v.l)});
   if(r.error)return r;const a={...v,[r.key]:r.value};
   const L={A:['Absorbance','AU'],e:['Molar absorptivity','L/mol·cm'],l:['Path length','cm'],c:['Concentration','mol/L']}[r.key];
   return {main:[L[0],r.value,L[1]],rows:[['Transmittance',100*10**-a.A,'%T'],['Concentration',a.c*1e6,'µmol/L']],
     formula:'A = ε × l × c · %T = 100 × 10^(−A)',note:a.A>1.5?'Above ~1.5 AU most spectrophotometers lose linearity. Dilute the sample.':'Example: NADH at 340 nm (ε = 6220).'}}},

{id:'curve',group:'Lab',name:'Standard curve',tag:'y = mx + b',title:'Standard curve & unknown',
 desc:'Paste calibration standards as “concentration  response” pairs, one per line. Least-squares fit, R², and back-calculated unknowns.',
 fields:[{id:'d',label:'Standards (x  y)',type:'text',wide:true,v:'0 0.002\n2 0.108\n4 0.211\n6 0.322\n8 0.418\n10 0.531'},{id:'y',label:'Unknown response',unit:'',v:0.265},{id:'df',label:'Dilution factor',unit:'×',v:1}],
 calc(v){const pts=String(v.d).split(/\n/).map(l=>l.trim().split(/[\s,;\t]+/).map(Number)).filter(p=>p.length>=2&&isFinite(p[0])&&isFinite(p[1]));
   if(pts.length<2)return {error:'Enter at least two standards, one “x y” pair per line.'};
   const n=pts.length,sx=pts.reduce((s,p)=>s+p[0],0),sy=pts.reduce((s,p)=>s+p[1],0),mx=sx/n,my=sy/n;
   let sxx=0,sxy=0,syy=0;pts.forEach(([x,y])=>{sxx+=(x-mx)**2;sxy+=(x-mx)*(y-my);syy+=(y-my)**2});
   if(!sxx)return {error:'Standards need at least two different x values.'};
   const m=sxy/sxx,b=my-m*mx,r2=syy?sxy*sxy/(sxx*syy):1;
   const xu=v.y!==null?(v.y-b)/m:null,xmin=Math.min(...pts.map(p=>p[0])),xmax=Math.max(...pts.map(p=>p[0]));
   const rows=[['Slope m',m,''],['Intercept b',b,''],['R²',r2,''],['Standards',n,'']];
   if(xu!==null)rows.push(['Sample conc. × dilution',xu*(v.df||1),'']);
   const out=xu!==null&&(xu<xmin||xu>xmax);
   return {main:['Unknown concentration',xu,''],rows,formula:`y = ${fmt(m,5)}·x ${b<0?'−':'+'} ${fmt(Math.abs(b),4)}`,
     note:(r2<0.995?'R² is below 0.995. Check the standards. ':'')+(out?'Unknown lies outside the calibrated range, so the result is an extrapolation.':''),
     extra:curveSvg(pts,m,b,xu,v.y)}}},

{id:'rcf',group:'Lab',name:'Centrifuge RCF',tag:'× g ↔ rpm',title:'Centrifuge  RCF ↔ RPM',
 desc:'Protocols state × g; rotors run in rpm. The radius is from the rotor centre to the bottom of the tube.',
 fields:[{id:'mode',label:'Convert',type:'select',options:['RPM → RCF (× g)','RCF (× g) → RPM'],v:'RPM → RCF (× g)'},{id:'x',label:'Value',unit:'',v:3000},{id:'r',label:'Rotor radius',unit:'cm',v:10}],
 calc(v){if(v.x===null||!v.r)return {error:'Enter a value and the rotor radius.'};
   if(v.mode.startsWith('RPM')){const g=1.118e-5*v.r*v.x**2;return {main:['Relative centrifugal force',g,'× g'],rows:[['Speed',v.x,'rpm'],['Radius',v.r,'cm']],formula:'RCF = 1.118 × 10⁻⁵ × r(cm) × rpm²',note:'Example: 3000 rpm on a 10 cm rotor.'}}
   const rpm=Math.sqrt(v.x/(1.118e-5*v.r));return {main:['Rotor speed',rpm,'rpm'],rows:[['RCF',v.x,'× g'],['Radius',v.r,'cm']],formula:'rpm = √(RCF ÷ (1.118 × 10⁻⁵ × r))'}}},

/* ---------- Instrumentation ---------- */
{id:'ma-scaling',group:'Instrumentation',name:'4–20 mA scaling',tag:'mA ↔ PV',title:'4–20 mA signal scaling',
 desc:'Convert between loop current, process value and percent of span for a linear transmitter.',
 fields:[{id:'lrv',label:'LRV (4 mA)',unit:'',v:0},{id:'urv',label:'URV (20 mA)',unit:'',v:16},{id:'eu',label:'Engineering unit',type:'textin',v:'bar'},{id:'from',label:'Convert from',type:'select',options:['mA','Process value','% of span'],v:'mA'},{id:'x',label:'Value',unit:'',v:12.8}],
 calc(v){if(v.lrv===null||v.urv===null||v.x===null)return {error:'Enter LRV, URV and a value.'};if(v.urv===v.lrv)return {error:'URV must differ from LRV.'};
   const span=v.urv-v.lrv;let pct;
   if(v.from==='mA')pct=(v.x-4)/16*100;else if(v.from==='% of span')pct=v.x;else pct=(v.x-v.lrv)/span*100;
   const mA=4+pct*0.16,pv=v.lrv+pct/100*span,eu=v.eu||'';
   let note='Example: 0–16 bar pressure transmitter.';
   if(mA<3.8||mA>20.5)note='Outside the NAMUR NE 43 measuring range (3.8–20.5 mA). The transmitter is signalling a fault or is saturated.';
   const rows=[['Loop current',mA,'mA'],['% of span',pct,'%'],['Process value',pv,eu],['Voltage across 250 Ω',mA*0.25,'V']];
   const tb=[0,25,50,75,100].map(p=>`<tr><td>${p} %</td><td>${fmt(4+p*.16,4)}</td><td>${fmt(v.lrv+p/100*span,5)}</td><td>${fmt(1+p*.04,3)}</td></tr>`).join('');
   return {main:[v.from==='Process value'?'Loop current':'Process value',v.from==='Process value'?mA:pv,v.from==='Process value'?'mA':eu],rows,
     formula:'PV = LRV + (mA − 4) ÷ 16 × (URV − LRV)',note,
     extra:`<div class="tbl"><table><thead><tr><th>Span</th><th>mA</th><th>PV ${esc(eu)}</th><th>V @ 250 Ω</th></tr></thead><tbody>${tb}</tbody></table></div>`}}},

{id:'calibration',group:'Instrumentation',name:'Calibration check',tag:'5-point',title:'Five-point calibration check',
 desc:'Enter as-found output readings in mA at 0, 25, 50, 75 and 100 % of the applied input. Errors are in % of span.',
 fields:[{id:'tol',label:'Tolerance',unit:'% span',v:0.25},{id:'p0',label:'At 0 %',unit:'mA',v:4.012},{id:'p25',label:'At 25 %',unit:'mA',v:7.996},{id:'p50',label:'At 50 %',unit:'mA',v:12.031},{id:'p75',label:'At 75 %',unit:'mA',v:16.018},{id:'p100',label:'At 100 %',unit:'mA',v:19.962}],
 calc(v){const P=[0,25,50,75,100];let worst=0,anyBad=false,rows='';const tol=v.tol??0.25;
   P.forEach(p=>{const m=v['p'+p],ideal=4+p*.16;if(m===null){rows+=`<tr><td>${p} %</td><td>${fmt(ideal,4)}</td><td>—</td><td>—</td><td></td></tr>`;return}
     const e=(m-ideal)/16*100,bad=Math.abs(e)>tol;anyBad||=bad;if(Math.abs(e)>Math.abs(worst))worst=e;
     rows+=`<tr><td>${p} %</td><td>${fmt(ideal,4)}</td><td>${fmt(m,5)}</td><td>${e>=0?'+':''}${e.toFixed(3)}</td><td><span class="pill ${bad?'bad':'ok'}">${bad?'FAIL':'PASS'}</span></td></tr>`});
   return {main:['Largest error',worst,'% span'],rows:[['Tolerance',tol,'% span'],['Result',anyBad?'Adjust and re-test':'Within tolerance','']],
     formula:'error % span = (as-found − ideal) ÷ 16 mA × 100',note:'Example as-found data. Record as-left readings after any adjustment.',
     status:anyBad?'bad':'ok',
     extra:`<div class="tbl"><table><thead><tr><th>Input</th><th>Ideal mA</th><th>As found</th><th>Error %</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`}}},

{id:'rtd',group:'Instrumentation',name:'RTD Pt100',tag:'°C ↔ Ω',title:'RTD  temperature ↔ resistance',
 desc:'IEC 60751 platinum RTD (α = 0.00385), Callendar–Van Dusen equation, valid −200 to 850 °C.',
 fields:[{id:'r0',label:'Sensor',type:'select',options:['Pt100','Pt500','Pt1000'],v:'Pt100'},{id:'mode',label:'Convert',type:'select',options:['Temperature → Resistance','Resistance → Temperature'],v:'Resistance → Temperature'},{id:'x',label:'Value (°C or Ω)',unit:'',v:138.51}],
 calc(v){if(v.x===null)return {error:'Enter a value.'};const r0={Pt100:100,Pt500:500,Pt1000:1000}[v.r0];
   if(v.mode.startsWith('Temp')){if(v.x<-200||v.x>850)return {error:'Temperature must be between −200 and 850 °C.'};const R=rtdR(v.x,r0);
     return {main:['Resistance',R,'Ω'],rows:[['Temperature',v.x,'°C'],['R / R₀',R/r0,''],['Sensitivity near this point',(rtdR(v.x+.5,r0)-rtdR(v.x-.5,r0)),'Ω/°C']],formula:'R(t) = R₀ [1 + A·t + B·t² + C·(t − 100)·t³]   (C = 0 for t ≥ 0)'}}
   const t=bisect(t=>rtdR(t,r0),v.x,-200,850);if(!isFinite(t))return {error:`Resistance is outside the −200 to 850 °C range for a ${v.r0}.`};
   return {main:['Temperature',t,'°C'],rows:[['Temperature',t*9/5+32,'°F'],['Temperature',t+273.15,'K'],['R / R₀',v.x/r0,'']],
     formula:'R(t) = R₀ [1 + A·t + B·t² + C·(t − 100)·t³]',note:'A = 3.9083×10⁻³, B = −5.775×10⁻⁷, C = −4.183×10⁻¹². Example: 138.51 Ω on a Pt100 is 100 °C.'}}},

{id:'thermocouple',group:'Instrumentation',name:'Thermocouple K',tag:'°C ↔ mV',title:'Type K thermocouple with cold-junction compensation',
 desc:'NIST ITS-90 reference functions, −270 to 1372 °C. The meter reads the EMF between hot and cold junctions; add back E(cold junction) to get temperature.',
 fields:[{id:'mode',label:'Convert',type:'select',options:['Measured mV → Temperature','Temperature → Expected mV'],v:'Measured mV → Temperature'},{id:'x',label:'Value (mV or °C)',unit:'',v:15.2},{id:'cj',label:'Cold-junction temp.',unit:'°C',v:25}],
 calc(v){if(v.x===null||v.cj===null)return {error:'Enter a value and the cold-junction temperature.'};const ecj=kEmf(v.cj);
   if(v.mode.startsWith('Measured')){const tot=v.x+ecj,t=bisect(kEmf,tot,-270,1372);if(!isFinite(t))return {error:'EMF is outside the Type K range.'};
     return {main:['Hot-junction temperature',t,'°C'],rows:[['E(cold junction)',ecj,'mV'],['Compensated EMF (ref 0 °C)',tot,'mV'],['Temperature',t*9/5+32,'°F'],['Error if CJC ignored',bisect(kEmf,v.x,-270,1372)-t,'°C']],
       formula:'E(T) = E_measured + E(T_cj)  →  T = E⁻¹(E(T))',note:'Example: 15.2 mV read with terminals at 25 °C.'}}
   if(v.x<-270||v.x>1372)return {error:'Temperature must be between −270 and 1372 °C.'};const e=kEmf(v.x);
   return {main:['Expected reading at terminals',e-ecj,'mV'],rows:[['E(T) referenced to 0 °C',e,'mV'],['E(cold junction)',ecj,'mV'],['Seebeck coefficient here',(kEmf(v.x+.5)-kEmf(v.x-.5))*1000,'µV/°C']],
     formula:'E_terminals = E(T) − E(T_cj)'}}},

{id:'dp-flow',group:'Instrumentation',name:'DP flow',tag:'√ΔP',title:'Differential-pressure flow (square root)',
 desc:'Orifice, venturi and similar primary elements: flow is proportional to the square root of differential pressure.',
 fields:[{id:'dpmax',label:'DP at max flow',unit:'kPa',v:25},{id:'qmax',label:'Max flow',unit:'m³/h',v:120},{id:'mode',label:'Convert',type:'select',options:['DP → Flow','Flow → DP'],v:'DP → Flow'},{id:'x',label:'Value',unit:'',v:6.25}],
 calc(v){if(!v.dpmax||!v.qmax||v.x===null)return {error:'Enter DP range, max flow and a value.'};let dp,q;
   if(v.mode==='DP → Flow'){dp=v.x;if(dp<0)return {error:'DP cannot be negative.'};q=v.qmax*Math.sqrt(dp/v.dpmax)}else{q=v.x;dp=v.dpmax*(q/v.qmax)**2}
   const dpP=dp/v.dpmax*100,qP=q/v.qmax*100;
   return {main:[v.mode==='DP → Flow'?'Flow':'Differential pressure',v.mode==='DP → Flow'?q:dp,v.mode==='DP → Flow'?'m³/h':'kPa'],
     rows:[['DP % of range',dpP,'%'],['Flow % of range',qP,'%'],['DP transmitter output',4+dpP*.16,'mA'],['Flow signal after √ extraction',4+qP*.16,'mA']],
     formula:'Q = Q_max × √(ΔP ÷ ΔP_max)',note:qP<10?'Below ~10 % flow the DP signal is tiny and noisy, so a low-flow cutoff is normally applied.':'Example: 25 % DP gives 50 % flow.'}}},

{id:'dp-level',group:'Instrumentation',name:'DP level',tag:'h = ΔP/ρg',title:'Hydrostatic level from differential pressure',
 desc:'Liquid height above the lower tap from the measured DP and the liquid’s specific gravity (open tank or dry leg).',
 fields:[{id:'dp',label:'Measured DP',unit:'',v:150},{id:'u',label:'DP unit',type:'select',options:['kPa','mbar','bar','psi','mmH₂O','inH₂O'],v:'mbar'},{id:'sg',label:'Specific gravity',unit:'',v:0.85},{id:'span',label:'Calibrated level span',unit:'m',v:3}],
 calc(v){if(v.dp===null||!v.sg)return {error:'Enter DP and specific gravity.'};const pa=v.dp*PU[v.u],h=pa/(v.sg*1000*9.80665);
   const rows=[['Height',h*1000,'mm'],['Height',h*3.28084,'ft']];
   if(v.span){const full=v.span*v.sg*1000*9.80665/PU[v.u],pct=h/v.span*100;rows.push(['% of level span',pct,'%'],['Transmitter output',4+pct*.16,'mA'],['URV to configure',full,v.u])}
   return {main:['Liquid level',h,'m'],rows,formula:'h = ΔP ÷ (SG × 1000 kg/m³ × 9.80665 m/s²)',note:'Example: 150 mbar of a 0.85 SG oil.'}}},

{id:'pressure',group:'Instrumentation',name:'Pressure units',tag:'bar ↔ psi',title:'Pressure unit converter',
 desc:'Converts between SI, imperial and liquid-column units. Water columns use 4 °C water (1 mmH₂O = 9.80665 Pa).',
 fields:[{id:'x',label:'Value',unit:'',v:10},{id:'u',label:'From',type:'select',options:Object.keys(PU),v:'bar'}],
 calc(v){if(v.x===null)return {error:'Enter a value.'};const pa=v.x*PU[v.u];
   return {main:['Pressure',pa/1000,'kPa'],rows:Object.keys(PU).filter(k=>k!==v.u).map(k=>[k,pa/PU[k],k]),formula:'1 bar = 100 kPa = 14.5038 psi',note:'Gauge vs absolute: add 1.01325 bar to gauge pressure for absolute at sea level.'}}},

{id:'valve',group:'Instrumentation',name:'Control valve Cv',tag:'Kv / Cv',title:'Control valve sizing  (liquid, non-choked)',
 desc:'Required flow coefficient for a liquid service at the given flow and pressure drop across the valve.',
 fields:[{id:'q',label:'Flow rate',unit:'m³/h',v:40},{id:'dp',label:'Pressure drop',unit:'bar',v:1.2},{id:'sg',label:'Specific gravity',unit:'',v:1.0}],
 calc(v){if(!v.q||!v.dp||!v.sg)return {error:'Enter flow, pressure drop and SG, all above zero.'};const kv=v.q*Math.sqrt(v.sg/v.dp),cv=1.156*kv;
   return {main:['Required Cv',cv,'US gpm/√psi'],rows:[['Required Kv',kv,'m³/h/√bar'],['Flow',v.q*4.40287,'US gpm'],['Pressure drop',v.dp*14.5038,'psi'],['Pick a valve with rated Cv ≈',cv/0.75,'(75 % open)']],
     formula:'Kv = Q × √(SG ÷ ΔP) · Cv = 1.156 × Kv',note:'Simplified IEC 60534 liquid equation. Check for choked flow and cavitation on high ΔP or flashing service.'}}},
];

/* ---------- standard curve chart ---------- */
function curveSvg(pts,m,b,xu,yu){
  const W=420,H=230,L=46,R=12,T=12,B=30;
  const xs=pts.map(p=>p[0]).concat(xu!=null&&isFinite(xu)?[xu]:[]),ys=pts.map(p=>p[1]).concat(yu!=null?[yu]:[]);
  let x0=Math.min(0,...xs),x1=Math.max(...xs),y0=Math.min(0,...ys),y1=Math.max(...ys);if(x1===x0)x1=x0+1;if(y1===y0)y1=y0+1;
  y1+= (y1-y0)*.06;
  const X=x=>L+(x-x0)/(x1-x0)*(W-L-R),Y=y=>H-B-(y-y0)/(y1-y0)*(H-T-B);
  let g='';for(let i=0;i<=4;i++){const yv=y0+(y1-y0)*i/4,xv=x0+(x1-x0)*i/4;
    g+=`<line x1="${L}" x2="${W-R}" y1="${Y(yv)}" y2="${Y(yv)}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${Y(yv)+4}" text-anchor="end">${fmt(yv,3)}</text><text x="${X(xv)}" y="${H-10}" text-anchor="middle">${fmt(xv,3)}</text>`}
  const line=`<line x1="${X(x0)}" y1="${Y(m*x0+b)}" x2="${X(x1)}" y2="${Y(m*x1+b)}" stroke="var(--accent)" stroke-width="2"/>`;
  const dots=pts.map(([x,y])=>`<circle cx="${X(x)}" cy="${Y(y)}" r="4" fill="var(--panel)" stroke="var(--accent)" stroke-width="2"/>`).join('');
  let u='';if(xu!=null&&isFinite(xu)&&xu>=x0&&xu<=x1)u=`<line x1="${X(xu)}" x2="${X(xu)}" y1="${Y(yu)}" y2="${H-B}" stroke="var(--warn)" stroke-dasharray="3 3"/><line x1="${L}" x2="${X(xu)}" y1="${Y(yu)}" y2="${Y(yu)}" stroke="var(--warn)" stroke-dasharray="3 3"/><circle cx="${X(xu)}" cy="${Y(yu)}" r="5" fill="var(--warn)"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Standard curve with fitted line">${g}${line}${dots}${u}</svg>`;
}
