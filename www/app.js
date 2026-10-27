/* Bench & Loop — app shell: navigation, favourites, recents, saved inputs, settings */
const APP_VERSION = '1.0.0';
const GLYPH = {molarity:'M',dilution:'C₁V₁',concentration:'ppm',ph:'pH',buffer:'pKa',beer:'A',curve:'R²',rcf:'×g',
  'ma-scaling':'mA',calibration:'5-pt',rtd:'Ω',thermocouple:'mV','dp-flow':'√ΔP','dp-level':'h',pressure:'bar',valve:'Cv'};

/* ---------- storage (always guarded) ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem('bl.'+k); return v===null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('bl.'+k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem('bl.'+k); }catch(e){} }
};
let favs = store.get('favs', ['ma-scaling','dilution']);
let recents = store.get('recents', []);
let filter = 'All', query = '';

/* ---------- native bridges (no-ops in a browser) ---------- */
const P = (window.Capacitor && window.Capacitor.Plugins) || {};
const tap = () => { try{ P.Haptics && P.Haptics.impact({style:'LIGHT'}); }catch(e){} };
function applyTheme(){
  const t = store.get('theme','system');
  if(t==='system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t==='dark' || (t==='system' && matchMedia('(prefers-color-scheme: dark)').matches);
  try{ P.StatusBar && P.StatusBar.setStyle({style: dark ? 'DARK' : 'LIGHT'}); }catch(e){}
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------- icons ---------- */
const I = {
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  star:f=>`<svg viewBox="0 0 24 24" fill="${f?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>`,
  chev:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--muted);flex:none"><path d="m9 6 6 6-6 6"/></svg>'
};

const app = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
const byId = id => TOOLS.find(t => t.id === id);

function toast(msg){
  const el = document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>el.remove(), 1600);
}
function rowHTML(t){
  return `<div class="row" data-open="${t.id}" role="button" tabindex="0">
    <div class="glyph">${GLYPH[t.id]||''}</div>
    <div class="txt"><div class="nm">${t.name}</div><div class="tg">${t.tag} · ${t.group}</div></div>${I.chev}</div>`;
}

/* ---------- screens ---------- */
function renderHome(){
  const q = query.trim().toLowerCase();
  const match = t => (filter==='All' || t.group===filter) &&
    (!q || (t.name+' '+t.title+' '+t.tag+' '+t.desc).toLowerCase().includes(q));
  const list = TOOLS.filter(match);
  const rec = !q && filter==='All' ? recents.map(byId).filter(Boolean).slice(0,3) : [];
  const groups = filter==='All' ? ['Lab','Instrumentation'] : [filter];
  app.innerHTML = `<section class="screen">
    <div class="topbar"><h1>Bench <span>&amp;</span> Loop</h1></div>
    <div class="pad">
      <label class="search">${I.search}<input id="q" type="search" placeholder="Search calculators" value="${esc(query)}" autocomplete="off" enterkeyhint="search"></label>
      <div class="seg" role="group" aria-label="Filter">${['All','Lab','Instrumentation'].map(g=>`<button data-filter="${g}" aria-pressed="${g===filter}">${g}</button>`).join('')}</div>
      ${rec.length?`<div class="sec-label">Recent</div><div class="list">${rec.map(rowHTML).join('')}</div>`:''}
      ${groups.map(g=>{const items=list.filter(t=>t.group===g);return items.length?`<div class="sec-label">${g}</div><div class="list">${items.map(rowHTML).join('')}</div>`:''}).join('')}
      ${list.length?'':`<div class="list empty"><b>No calculators match “${esc(query)}”</b>Try a unit or quantity, such as “mA”, “ppm” or “pressure”.</div>`}
    </div></section>`;
  const qi = document.getElementById('q');
  qi.addEventListener('input', e => { query = e.target.value; const pos=qi.selectionStart; renderHome(); const n=document.getElementById('q'); n.focus(); n.setSelectionRange(pos,pos); });
}

function renderFavourites(){
  const list = favs.map(byId).filter(Boolean);
  app.innerHTML = `<section class="screen">
    <div class="topbar"><h1>Favourites</h1></div>
    <div class="pad">${list.length?`<div class="list">${list.map(rowHTML).join('')}</div>`:
      `<div class="list empty"><b>No favourites yet</b>Open any calculator and tap the star to keep it here.</div>`}</div></section>`;
}

function renderSettings(){
  const t = store.get('theme','system');
  app.innerHTML = `<section class="screen">
    <div class="topbar"><h1>Settings</h1></div>
    <div class="pad">
      <div class="sec-label">Appearance</div>
      <div class="list"><div class="set-row"><span>Theme</span>
        <div class="inp" style="border:0;background:none"><select id="theme">${[['system','System'],['light','Light'],['dark','Dark']].map(([v,l])=>`<option value="${v}"${v===t?' selected':''}>${l}</option>`).join('')}</select></div></div></div>
      <div class="sec-label">Data</div>
      <div class="list">
        <div class="set-row"><span>Saved inputs</span><button class="btn" id="clear">Reset all calculators</button></div>
      </div>
      <div class="sec-label">About</div>
      <div class="list">
        <div class="set-row"><span>Version</span><span>${APP_VERSION}</span></div>
        <div class="set-row"><span>Privacy</span><a href="#/privacy">Privacy policy</a></div>
        <div class="set-row"><span>Standards used</span><span>NIST ITS-90 · IEC 60751 · IEC 60534 · NAMUR NE 43</span></div>
      </div>
      <p class="about">Bench &amp; Loop works fully offline and stores your inputs only on this device. Results are for engineering guidance; verify critical values against your site procedures and calibrated references.</p>
    </div></section>`;
  document.getElementById('theme').addEventListener('change', e => { store.set('theme', e.target.value); applyTheme(); });
  document.getElementById('clear').addEventListener('click', e => {
    const b = e.currentTarget;
    if(b.dataset.armed){ TOOLS.forEach(t=>store.del('in.'+t.id)); recents=[]; store.set('recents',[]); b.textContent='Reset all calculators'; delete b.dataset.armed; toast('All calculators reset to examples'); }
    else { b.dataset.armed='1'; b.textContent='Tap again to confirm'; setTimeout(()=>{ if(b.isConnected&&b.dataset.armed){delete b.dataset.armed;b.textContent='Reset all calculators';} },3000); }
  });
}

function renderPrivacy(){
  app.innerHTML = `<section class="screen tool-screen">
    <div class="topbar"><button class="iconbtn" data-back aria-label="Back">${I.back}</button><h2>Privacy policy</h2></div>
    <div class="pad" style="max-width:68ch">
      <p class="desc">Last updated 27 October 2026</p>
      <p>Bench &amp; Loop does not collect, transmit or share any personal data. The app has no accounts, no analytics, no advertising and no network access.</p>
      <p>The values you type and your favourites are saved only in the app’s local storage on your device so they are there next time you open it. Uninstalling the app, or using Settings → Reset all calculators, deletes them.</p>
      <p>The app requests no device permissions such as camera, location, contacts or storage.</p>
      <p>If this policy changes, the new version will be published with an app update. Questions can be sent to the developer contact shown on the app’s store page.</p>
    </div></section>`;
}

function renderTool(t){
  const saved = store.get('in.'+t.id, {});
  const fields = t.fields.map(f=>{
    const id = `${t.id}-${f.id}`, val = saved[f.id] ?? f.v;
    let ctl;
    if(f.type==='select') ctl = `<div class="inp"><select id="${id}">${f.options.map(o=>`<option${o===val?' selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
    else if(f.type==='text') ctl = `<div class="inp"><textarea id="${id}" spellcheck="false" autocapitalize="off">${esc(val)}</textarea></div>`;
    else if(f.type==='textin') ctl = `<div class="inp"><input id="${id}" type="text" value="${esc(val)}" autocapitalize="off"></div>`;
    else ctl = `<div class="inp"><input id="${id}" type="text" inputmode="decimal" autocomplete="off" value="${esc(val)}" placeholder="solve"><span class="u"${f.unit?'':' hidden'}>${esc(f.unit||'')}</span></div>`;
    return `<div class="f${f.wide?' wide':''}"><label for="${id}">${f.label}</label>${ctl}</div>`;
  }).join('');
  const fav = favs.includes(t.id);
  app.innerHTML = `<section class="screen tool-screen">
    <div class="topbar"><button class="iconbtn" data-back aria-label="Back">${I.back}</button><h2>${t.name}</h2>
      <button class="iconbtn${fav?' on':''}" id="fav" aria-label="${fav?'Remove from favourites':'Add to favourites'}" aria-pressed="${fav}">${I.star(fav)}</button></div>
    <div class="live" id="live" aria-live="polite"></div>
    <div class="pad">
      <p class="desc">${t.desc}</p>
      <div class="fields" id="fields">${fields}</div>
      <div class="card" id="detail"></div>
      <div class="actions"><button class="btn" id="copy">Copy result</button><button class="btn" id="reset">Reset to example</button></div>
    </div></section>`;
  const fieldsEl = document.getElementById('fields');
  const onChange = () => { const raw={}; t.fields.forEach(f=>raw[f.id]=document.getElementById(`${t.id}-${f.id}`).value); store.set('in.'+t.id, raw); compute(t); };
  fieldsEl.addEventListener('input', onChange); fieldsEl.addEventListener('change', onChange);
  document.getElementById('fav').addEventListener('click', e => {
    tap(); const b=e.currentTarget, on=!favs.includes(t.id);
    favs = on ? [...favs, t.id] : favs.filter(x=>x!==t.id); store.set('favs', favs);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = I.star(on);
    toast(on ? 'Added to favourites' : 'Removed from favourites');
  });
  document.getElementById('reset').addEventListener('click', () => { store.del('in.'+t.id); renderTool(t); toast('Example values restored'); });
  document.getElementById('copy').addEventListener('click', () => {
    const txt = lastText; if(!txt) return;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(()=>{tap();toast('Result copied');}).catch(()=>toast('Copy isn’t available on this device'));
  });
  recents = [t.id, ...recents.filter(x=>x!==t.id)].slice(0,6); store.set('recents', recents);
  compute(t);
}

/* ---------- calculation ---------- */
let lastText = '';
function readValues(t){
  const v = {};
  t.fields.forEach(f=>{
    const el = document.getElementById(`${t.id}-${f.id}`);
    if(f.type==='select'||f.type==='text'||f.type==='textin') v[f.id]=el.value;
    else { const s=el.value.trim().replace(/,/g,''); el.parentElement.classList.toggle('blank', s===''); v[f.id] = s==='' ? null : (isFinite(+s) ? +s : NaN); }
  });
  return v;
}
function compute(t){
  const live = document.getElementById('live'), detail = document.getElementById('detail');
  const v = readValues(t);
  const fail = msg => { live.className='live err'; live.innerHTML=`<div class="lbl">Waiting for input</div><div class="val">${msg}</div>`; detail.hidden=true; lastText=''; };
  if(Object.values(v).some(x=>typeof x==='number'&&isNaN(x))) return fail('One field isn’t a number. Use digits, a decimal point, or e-notation like 1.5e-3.');
  let r; try{ r = t.calc(v); }catch(e){ r = {error:'Could not calculate with these values.'}; }
  if(r.error) return fail(r.error);
  const [lbl,val,unit] = r.main;
  const vs = typeof val==='number' ? fmt(val) : esc(val);
  live.className='live';
  live.innerHTML = `<div class="lbl">${lbl}${r.status?` <span class="pill">${r.status==='ok'?'PASS':'FAIL'}</span>`:''}</div><div class="val">${vs}${unit?`<small>${esc(unit)}</small>`:''}</div>`;
  const rows = (r.rows||[]).map(([a,b,u])=>`<dt>${a}</dt><dd>${typeof b==='number'?fmt(b):esc(b)}${u?`<small>${esc(u)}</small>`:''}</dd>`).join('');
  detail.hidden = false;
  detail.innerHTML = `${rows?`<dl class="rows">${rows}</dl>`:''}${r.extra||''}<div class="formula">${r.formula}</div>${r.note?`<p class="note">${r.note}</p>`:''}`;
  lastText = `${t.name}: ${lbl} = ${typeof val==='number'?fmt(val):val} ${unit||''}`.trim() + '\n' +
    (r.rows||[]).map(([a,b,u])=>`${a}: ${typeof b==='number'?fmt(b):b} ${u||''}`.trim()).join('\n');
}

/* ---------- routing ---------- */
function route(){
  const h = location.hash.replace(/^#\/?/,'');
  let tab = 'home';
  if(h.startsWith('tool/') && byId(h.slice(5))){ renderTool(byId(h.slice(5))); tab = null; }
  else if(h==='favourites'){ renderFavourites(); tab='favourites'; }
  else if(h==='settings'){ renderSettings(); tab='settings'; }
  else if(h==='privacy'){ renderPrivacy(); tab='settings'; }
  else renderHome();
  tabbar.hidden = tab===null || h==='privacy';
  tabbar.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current', b.dataset.tab===tab?'page':'false'));
  window.scrollTo(0,0);
}
window.addEventListener('hashchange', route);
const isSub = () => /^#\/?(tool\/|privacy)/.test(location.hash);
const goBack = () => { if(history.length>1) history.back(); else location.hash = '#/'; };

document.addEventListener('click', e=>{
  const o = e.target.closest('[data-open]'); if(o){ tap(); location.hash = '#/tool/'+o.dataset.open; return; }
  if(e.target.closest('[data-back]')){ goBack(); return; }
  const f = e.target.closest('[data-filter]'); if(f){ filter = f.dataset.filter; renderHome(); return; }
  const tb = e.target.closest('[data-tab]'); if(tb){ tap(); location.hash = tb.dataset.tab==='home' ? '#/' : '#/'+tb.dataset.tab; }
});
document.addEventListener('keydown', e=>{ const o=e.target.closest?.('[data-open]'); if(o && (e.key==='Enter'||e.key===' ')){ e.preventDefault(); o.click(); } });

/* Android hardware back button */
try{ P.App && P.App.addListener('backButton', () => { if(isSub()) goBack(); else if(location.hash && location.hash!=='#/') location.hash='#/'; else P.App.exitApp(); }); }catch(e){}

applyTheme();
route();
try{ P.SplashScreen && P.SplashScreen.hide(); }catch(e){}
