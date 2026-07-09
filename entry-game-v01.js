// NQ Entry Game v0.1
// One day per card. 06:30-06:34 builds the map; core scoring ends at 07:20.

const DECK_URL = 'decks/entry_game_v01_quality_deck.json';
const LABEL_KEY = 'entryGame.v01.labels';
const STATS_KEY = 'entryGame.v01.stats';
const $ = (id) => document.getElementById(id);

let deck = null, cards = [], filtered = [], pos = 0;
let visible5 = 0, revealed = false, playTimer = null;
let labels = loadJson(LABEL_KEY, {}), stats = loadJson(STATS_KEY, {played:0, totalScore:0, correct:0, history:[]});
let selectedSchema = null, selectedSide = null, selectedEntry = null;
let execGeom = null, parentGeom = null;
let showOverlays = true;

const SCHEMA = {
  A1: 'A1 clean retest continuation',
  A2: 'A2 no-retest / drive continuation',
  B: 'B failed-A scalp',
  C: 'C1 true AMD high-take',
  'C-F': 'C-F attempt/failure scalp',
  D2: 'D2 bull-trap / upside continuation trap',
  SKIP: 'Skip / no core trade',
  NEW: 'New box / correction',
};

function loadJson(k, fallback){ try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch { return fallback; } }
function saveLabels(){ localStorage.setItem(LABEL_KEY, JSON.stringify(labels)); }
function saveStats(){ localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }
function current(){ return filtered[pos] || cards[0]; }
function tSec(t){ const [h,m,s='0'] = String(t).split(':'); return Number(h)*3600 + Number(m)*60 + Number(s); }
function hm(t){ return String(t || '').slice(0,5); }
function absMin(a,b){ return Math.abs(tSec(a+':00') - tSec(b+':00')) / 60; }
function fmtPrice(x){ return Number.isFinite(Number(x)) ? Number(x).toFixed(2) : '—'; }

async function boot(){
  bind();
  const r = await fetch(DECK_URL, {cache:'no-store'});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  deck = await r.json();
  cards = deck.cards || [];
  applyFilters();
}

function applyFilters(){
  const f = $('schemaFilter')?.value || 'ALL';
  filtered = cards.filter(c => {
    if(f !== 'ALL' && c.answer?.schematic !== f) return false;
    if($('unplayedBtn')?.dataset.on === '1' && labels[c.card_id]?.scored) return false;
    return true;
  });
  if(!filtered.length) filtered = cards.slice();
  pos = clamp(pos, 0, filtered.length - 1);
  initCard();
}

function initCard(){
  const c = current(); if(!c) return;
  stopPlay();
  const lab = labels[c.card_id] || {};
  revealed = !!lab.revealed;
  visible5 = revealed ? c.bars_5s.length - 1 : indexAtOrAfter(c.bars_5s, '06:34:00');
  selectedSchema = lab.schema || null;
  selectedSide = lab.side || null;
  selectedEntry = lab.entry_i != null ? {i: lab.entry_i, price: lab.entry_price, time: c.bars_5s[lab.entry_i]?.t} : null;
  $('note').value = lab.note || '';
  render();
}

function indexAtOrAfter(bars, time){
  const target = tSec(time);
  for(let i=0;i<bars.length;i++) if(tSec(bars[i].t) >= target) return i;
  return 0;
}
function indexAtOrBefore(bars, time){
  const target = tSec(time); let last = 0;
  for(let i=0;i<bars.length;i++){ if(tSec(bars[i].t) <= target) last = i; else break; }
  return last;
}
function currentTime(){ const c=current(); return c?.bars_5s?.[visible5]?.t || '—'; }

function render(){
  renderHeader(); renderButtons(); renderTicket(); renderClues(); renderStats(); renderAnswer(); renderHistory(); draw();
}

function renderHeader(){
  const c = current(); if(!c) return;
  const lab = labels[c.card_id] || {};
  $('cardTitle').textContent = `${c.date} · ${revealed ? c.answer.schematic + ' ' + c.answer.side : 'hidden schematic'} · now ${hm(currentTime())}`;
  $('cardMeta').textContent = `${pos+1}/${filtered.length} · ${c.meta.normalized_flip === 'FLIPPED_ACTUAL_DOWN' ? 'chart normalized: actual opening move DOWN' : 'chart normalized: actual opening move UP'} · core 06:30-07:20`;
  $('deckCount').textContent = `${cards.length} days · ${stats.played||0} reps`;
  const hb = $('hiddenBadge');
  hb.className = 'hidden-badge';
  if(lab.scored){ hb.textContent = `${lab.score}/10`; hb.classList.add(lab.score >= 7 ? 'right' : 'wrong'); }
  else hb.textContent = revealed ? 'REVEALED' : 'HIDDEN';
  $('showOverlaysBtn')?.classList.toggle('on', showOverlays);
  $('showOverlaysBtn').textContent = showOverlays ? 'Overlays on' : 'Overlays off';
}

function renderButtons(){
  document.querySelectorAll('.schema-btn').forEach(b => b.classList.toggle('active', b.dataset.v === selectedSchema));
  document.querySelectorAll('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.v === selectedSide));
}

function renderTicket(){
  const c = current(); if(!c) return;
  const entry = selectedEntry ? `<b>${hm(selectedEntry.time)}</b> @ <b>${fmtPrice(selectedEntry.price)}</b>` : '<b>none</b>';
  const warn = selectedEntry && tSec(selectedEntry.time) < tSec('06:34:00') ? `<div class="warn-line">⚠️ Before 06:34 — opening move is map only, not a valid game entry.</div>` : '';
  const late = selectedEntry && tSec(selectedEntry.time) > tSec('07:20:00') ? `<div class="warn-line">⚠️ Outside core game window — extended-session trades do not score as the daily schematic.</div>` : '';
  $('tradeTicket').innerHTML = `
    <div>Schema: <b>${esc(selectedSchema || '—')}</b> ${selectedSchema ? `<span class="muted">${esc(SCHEMA[selectedSchema] || '')}</span>` : ''}</div>
    <div>Side: <b>${esc(selectedSide || '—')}</b></div>
    <div>Entry: ${entry}</div>
    ${warn}${late}
  `;
}

function renderClues(){
  const c = current(); if(!c) return;
  const meta = c.meta || {};
  const alphaSeen = (c.alpha_breaks || []).filter(a => tSec(a.time) <= tSec(currentTime()));
  const lastAlpha = alphaSeen[alphaSeen.length - 1];
  const o4 = c.zones?.open4_rails || [];
  const z634 = c.zones?.snapshot_634 || [];
  const hiddenAnswer = !revealed;
  let html = '';
  html += `<div class="map-note"><b>Rule:</b> 06:30-06:34 creates the map. Do not trade the first move. Trade only the reaction/flip/continuation after the map exists.</div>`;
  html += `<div class="clue"><b>Opening 4m map</b><span>Norm flip: ${esc(meta.normalized_flip)} · Open4 high ${meta.open4_high_norm} · low ${meta.open4_low_norm} · core close ${meta.core_close_norm}</span></div>`;
  if(o4.length) html += `<div class="clue event sweep"><b>6:34 Open4 rails</b><span>${o4.map(z => `${z.tag.replace('OPEN4_','')}: ${fmtPrice(z.mid)}`).join(' · ')}</span></div>`;
  if(z634.length) html += `<div class="clue event awps"><b>6:34 snapshot MB/LVN</b><span>${z634.map(z => `${z.tag} [${fmtPrice(z.bot)}-${fmtPrice(z.top)}]`).join(' · ')}</span></div>`;
  html += `<div class="clue event dragon"><b>Alpha boxes</b><span>${lastAlpha ? `Last seen: ${lastAlpha.time} ${lastAlpha.dir} box [${fmtPrice(lastAlpha.bot)}-${fmtPrice(lastAlpha.top)}]` : 'No alpha break revealed yet.'}</span></div>`;
  html += `<div class="clue"><b>Game objective</b><span>${hiddenAnswer ? 'Classify A1/A2/B/C/C-F/D2, pick actual market side, then click the one winner. If it is not in the deck taxonomy, mark NEW and explain.' : `Answer: ${c.answer.schematic} ${c.answer.side}. Normalized side: ${esc(c.answer.normalized_side || '—')}. ${esc(c.answer.notes)}`}</span></div>`;
  $('visibleClues').innerHTML = html;
}

function renderStats(){
  const avg = stats.played ? (stats.totalScore / stats.played).toFixed(1) : '—';
  $('statsBox').innerHTML = `Played <b>${stats.played||0}</b> · Avg <b>${avg}/10</b> · Correct <b>${stats.correct||0}</b>`;
}

function scoreRead(c, lab){
  const ans = c.answer;
  let schema = 0, side = 0, entry = 0, timing = 0, confluence = 0;
  const detail = [];
  if(lab.schema === ans.schematic) { schema = 3; detail.push('schema exact'); }
  else if((lab.schema === 'C' && ans.schematic === 'C-F') || (lab.schema === 'C-F' && ans.schematic === 'C')) { schema = 2; detail.push('C family correct, subtype off'); }
  else if((lab.schema === 'A1' && ans.schematic === 'A2') || (lab.schema === 'A2' && ans.schematic === 'A1')) { schema = 2; detail.push('A family correct, subtype off'); }
  else if(lab.schema === 'NEW') { schema = 1; detail.push('marked new box/correction'); }
  else if(lab.schema === 'SKIP' && ans.side === 'SKIP') { schema = 2; detail.push('skip family ok'); }
  else detail.push(`schema ${lab.schema || '—'} vs ${ans.schematic}`);

  if(lab.side === ans.side) { side = 2; detail.push('side correct'); }
  else detail.push(`side ${lab.side || '—'} vs ${ans.side}`);

  if(ans.side === 'SKIP'){
    if(lab.side === 'SKIP' && lab.entry_i == null) { entry = 3; timing = 1; confluence = 1; detail.push('correct no-trade'); }
    else { detail.push('forced trade on skip day'); }
  } else if(lab.entry_i != null){
    const et = c.bars_5s[lab.entry_i]?.t || '00:00:00';
    const ehm = hm(et);
    if(tSec(et) >= tSec('06:34:00') && tSec(et) <= tSec('07:20:00')) timing = 1;
    if(inWindow(ehm, ans.primary?.[0], ans.primary?.[1])) { entry = 3; detail.push('primary window'); }
    else if((ans.secondary || []).some(w => inWindow(ehm, w[0], w[1]))) { entry = 2; detail.push('secondary/add window'); }
    else {
      const dist = minDistToWindows(ehm, [ans.primary, ...(ans.secondary||[])].filter(Boolean));
      if(dist <= 5) { entry = 1; detail.push(`${dist.toFixed(1)}m from window`); }
      else detail.push(`entry ${ehm}, target ${ans.entry || ans.primary?.join('-')}`);
    }
    const conf = confluenceAt(c, et, lab.side);
    if(conf.alpha) confluence += 1;
    if(conf.zone) confluence += 1;
    detail.push(`alpha ${conf.alpha?'yes':'no'} · zone ${conf.zone?'yes':'no'}`);
  } else {
    detail.push('no entry marked');
  }
  const total = schema + side + entry + timing + confluence;
  return {total, parts:{schema, side, entry, timing, confluence}, detail};
}

function inWindow(hmTime, start, end){ if(!start || !end) return false; return tSec(hmTime+':00') >= tSec(start+':00') && tSec(hmTime+':00') <= tSec(end+':00'); }
function minDistToWindows(hmTime, windows){
  if(!windows.length) return 99;
  const x = tSec(hmTime+':00');
  return Math.min(...windows.map(w => Math.min(Math.abs(x - tSec(w[0]+':00')), Math.abs(x - tSec(w[1]+':00'))) / 60));
}

function confluenceAt(c, entryTime, side){
  const entrySec = tSec(entryTime);
  const alpha = (c.alpha_breaks || []).some(a => (a.actual_dir || a.dir) === side && entrySec - tSec(a.time) >= -60 && entrySec - tSec(a.time) <= 12*60);
  const bar = nearest5(c, entryTime);
  const price = bar ? Number(bar.c) : null;
  let zone = false;
  if(price != null){
    const zones = [...(c.zones?.open4_rails||[]), ...(c.zones?.snapshot_634||[]), ...(c.zones?.mb_standard||[])];
    zone = zones.some(z => price >= z.bot - 25 && price <= z.top + 25);
  }
  // Also count if any zone was touched within the previous 10 minutes.
  const start = entrySec - 10*60;
  for(const b of c.bars_5s || []){
    const bs = tSec(b.t); if(bs < start || bs > entrySec) continue;
    const zones = [...(c.zones?.open4_rails||[]), ...(c.zones?.snapshot_634||[])];
    if(zones.some(z => Number(b.h) >= z.bot - 3 && Number(b.l) <= z.top + 3)) zone = true;
  }
  return {alpha, zone};
}
function nearest5(c, time){ const i = indexAtOrBefore(c.bars_5s, time); return c.bars_5s[i]; }

function submitRead(){
  const c = current(); if(!c) return;
  const lab = labels[c.card_id] || {};
  lab.schema = selectedSchema;
  lab.side = selectedSide;
  lab.note = $('note').value || '';
  if(selectedEntry){ lab.entry_i = selectedEntry.i; lab.entry_price = selectedEntry.price; }
  else { delete lab.entry_i; delete lab.entry_price; }
  lab.revealed = true; lab.scored = true;
  const s = scoreRead(c, lab);
  lab.score = s.total; lab.parts = s.parts; lab.detail = s.detail;
  labels[c.card_id] = lab;
  stats.played = (stats.played || 0) + 1;
  stats.totalScore = (stats.totalScore || 0) + s.total;
  if(s.total >= 7) stats.correct = (stats.correct || 0) + 1;
  stats.history = stats.history || [];
  stats.history.push({date:c.date, score:s.total, schema:lab.schema, side:lab.side, answer:`${c.answer.schematic} ${c.answer.side}`});
  if(stats.history.length > 50) stats.history.shift();
  saveLabels(); saveStats();
  revealed = true; visible5 = c.bars_5s.length - 1;
  render();
}

function renderAnswer(){
  const c = current(); if(!c) return;
  const lab = labels[c.card_id];
  const panel = $('answerPanel');
  if(!revealed && !lab?.scored){ panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const ans = c.answer;
  const score = lab?.scored ? lab.score : null;
  const cls = score == null ? '' : score >= 7 ? 'win' : 'loss';
  const entryText = ans.side === 'SKIP' ? 'NO CORE TRADE' : `${ans.entry} ${ans.side} · primary ${ans.primary?.join('-')} · R ${ans.r_net ?? '—'}`;
  const secondary = ans.secondary ? `<div>${rowHtml('Secondary/add', ans.secondary.map(w => w.join('-')).join(', '))}</div>` : '';
  const ext = ans.extended ? `<div>${rowHtml('Extended only', `${ans.extended.side} ${ans.extended.window.join('-')} (not core score)`)}</div>` : '';
  $('answerBox').innerHTML = `
    <div class="answer-card ${cls}">
      ${score != null ? `<div class="big-score">${score}/10</div><div class="score-title">${score>=7?'✅ Good read':'⚠️ Review this rep'}</div>` : ''}
      ${rowHtml('Answer', `${ans.schematic} · actual ${ans.side} · normalized ${ans.normalized_side || '—'}`)}
      ${rowHtml('Trade window', entryText)}
      ${rowHtml('Model', `${ans.model_result || '—'} · risk ${ans.risk ?? '—'} · MAE ${ans.mae_r ?? '—'}R · MFE ${ans.mfe_r ?? '—'}R`)}
      ${secondary}${ext}
      ${rowHtml('Why', ans.notes)}
      ${lab?.parts ? `<div class="score-grid"><span>Schematic</span><b>${lab.parts.schema}/3</b><span>Side</span><b>${lab.parts.side}/2</b><span>Entry</span><b>${lab.parts.entry}/3</b><span>Timing</span><b>${lab.parts.timing}/1</b><span>Confluence</span><b>${lab.parts.confluence}/2</b></div>` : ''}
      ${lab?.detail ? `<div class="banner-detail">${lab.detail.map(esc).join(' · ')}</div>` : ''}
    </div>`;
}
function rowHtml(k,v){ return `<div class="result-line"><span>${esc(k)}</span><b>${esc(v)}</b></div>`; }

function renderHistory(){
  const h = (stats.history || []).slice(-8).reverse();
  $('historyTape').innerHTML = h.map(x => `<div class="daily-pill ${x.score>=7?'good':'warn'}">${esc(x.date)} ${x.score}/10</div>`).join('') || '<span class="muted small">No reps yet.</span>';
}

function resetCard(){ const c=current(); if(!c) return; delete labels[c.card_id]; saveLabels(); initCard(); }
function nextCard(){ pos=clamp(pos+1,0,filtered.length-1); initCard(); }
function prevCard(){ pos=clamp(pos-1,0,filtered.length-1); initCard(); }
function randomCard(){ pos=Math.floor(Math.random()*filtered.length); initCard(); }
function reveal(){ const c=current(); if(!c) return; revealed=true; labels[c.card_id] = {...(labels[c.card_id]||{}), revealed:true}; saveLabels(); visible5=c.bars_5s.length-1; render(); }
function stepFwd(){ const c=current(); if(!c) return; visible5=clamp(visible5+1,0,c.bars_5s.length-1); draw(); renderHeader(); renderClues(); }
function stepBack(){ const c=current(); if(!c) return; visible5=clamp(visible5-1,0,c.bars_5s.length-1); draw(); renderHeader(); renderClues(); }
function togglePlay(){ playTimer ? stopPlay() : startPlay(); }
function startPlay(){ $('playBtn').textContent='⏸ Pause'; playTimer=setInterval(()=>{ const c=current(); if(!c || visible5>=c.bars_5s.length-1){ stopPlay(); return; } stepFwd(); }, 65); }
function stopPlay(){ if(playTimer){ clearInterval(playTimer); playTimer=null; } if($('playBtn')) $('playBtn').textContent='▶ Play'; }
function jumpTo(time){ const c=current(); if(!c) return; visible5=indexAtOrAfter(c.bars_5s,time); render(); }

function handleExecClick(e){
  const c = current(); if(!c || labels[c.card_id]?.scored) return;
  if(!execGeom) return;
  const rect = e.target.getBoundingClientRect(); const x = e.clientX - rect.left;
  if(x < execGeom.left || x > execGeom.right) return;
  const frac = (x - execGeom.left) / execGeom.width;
  const i = clamp(Math.round(execGeom.start + frac * execGeom.count), execGeom.start, Math.min(execGeom.end, c.bars_5s.length - 1));
  const b = c.bars_5s[i];
  if(!b || (!revealed && i > visible5)) return;
  selectedEntry = {i, time:b.t, price:Math.round(Number(b.c)*4)/4};
  render();
}

// Drawing
function resizeCanvas(cv){
  const dpr = window.devicePixelRatio || 1; const rect = cv.getBoundingClientRect();
  cv.width = Math.max(10, Math.round(rect.width*dpr)); cv.height = Math.max(10, Math.round(rect.height*dpr));
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w:rect.width,h:rect.height};
}
function draw(){ drawParent(); drawExec(); }
function visibleTimeSec(){ const c=current(); return tSec(c?.bars_5s?.[visible5]?.t || '06:34:00'); }
function isVisibleTime(t){ return revealed || tSec(t) <= visibleTimeSec(); }
function yFor(price, top, pMin, pMax, ch){ return top + ((pMax - price) / (pMax - pMin)) * ch; }
function drawCandles(ctx,bars,geom,pMin,pMax, opts={}){
  const {left,right,top,bottom}=geom; const cw=right-left, ch=bottom-top; const bw=cw/Math.max(1,bars.length);
  bars.forEach((b,i)=>{
    if(opts.hideFuture && !isVisibleTime(b.t)) return;
    const x=left+bw*i+bw*.5; const o=+b.o,h=+b.h,l=+b.l,c=+b.c; const bull=c>=o; const col=bull?'#25d784':'#ff5b72';
    ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=opts.thin?0.7:1;
    ctx.beginPath(); ctx.moveTo(x,yFor(h,top,pMin,pMax,ch)); ctx.lineTo(x,yFor(l,top,pMin,pMax,ch)); ctx.stroke();
    const yO=yFor(o,top,pMin,pMax,ch), yC=yFor(c,top,pMin,pMax,ch); ctx.fillRect(x-bw*.33, Math.min(yO,yC), Math.max(1,bw*.66), Math.max(1,Math.abs(yC-yO)));
  });
}
function drawGrid(ctx,geom,pMin,pMax){
  const {left,right,top,bottom}=geom; const ch=bottom-top;
  ctx.strokeStyle='rgba(148,163,184,.12)'; ctx.fillStyle='rgba(148,163,184,.55)'; ctx.font='9px SF Mono';
  for(let i=0;i<=5;i++){ const y=top+ch*i/5; const px=pMax-(pMax-pMin)*i/5; ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke(); ctx.fillText(px.toFixed(0), 5, y+3); }
}
function xFromTime(bars,time,geom){
  const idx = indexAtOrAfter(bars,time); return geom.left + geom.width * idx / Math.max(1,bars.length-1);
}
function drawVertical(ctx,geom,bars,time,color,label){
  const x=xFromTime(bars,time,geom); ctx.strokeStyle=color; ctx.lineWidth=1; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(x,geom.top); ctx.lineTo(x,geom.bottom); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle=color; ctx.font='9px SF Mono'; ctx.fillText(label,x+3,geom.top+10);
}
function drawZoneBands(ctx,geom,pMin,pMax,zones,color,labelPrefix){
  const ch=geom.bottom-geom.top;
  zones.forEach(z=>{
    const y1=yFor(z.top,geom.top,pMin,pMax,ch), y2=yFor(z.bot,geom.top,pMin,pMax,ch);
    ctx.fillStyle=color; ctx.fillRect(geom.left, y1, geom.right-geom.left, Math.max(2,y2-y1));
    ctx.fillStyle='rgba(229,238,252,.65)'; ctx.font='9px SF Mono'; ctx.fillText(`${labelPrefix}${z.tag}`, geom.left+4, y1+10);
  });
}
function visiblePriceRange(bars){
  let lo=Infinity, hi=-Infinity;
  bars.forEach(b=>{ if(!revealed && !isVisibleTime(b.t)) return; lo=Math.min(lo,+b.l); hi=Math.max(hi,+b.h); });
  if(!Number.isFinite(lo)){ lo=0; hi=1; }
  const pad=Math.max(8,(hi-lo)*.08); return [lo-pad,hi+pad];
}
function drawParent(){
  const c=current(), cv=$('parentChart'); if(!c||!cv) return; const {ctx,w,h}=resizeCanvas(cv); ctx.clearRect(0,0,w,h);
  const bars=c.bars_1m || []; const [pMin,pMax]=visiblePriceRange(bars); const geom={left:55,right:w-15,top:12,bottom:h-24,width:w-70}; parentGeom=geom;
  drawGrid(ctx,geom,pMin,pMax);
  if(showOverlays){ drawZoneBands(ctx,geom,pMin,pMax,c.zones.open4_rails||[],'rgba(255,209,102,.09)',''); drawZoneBands(ctx,geom,pMin,pMax,c.zones.snapshot_634||[],'rgba(167,139,250,.10)','MB '); }
  drawCandles(ctx,bars,geom,pMin,pMax,{hideFuture:true});
  drawVertical(ctx,geom,bars,'06:34:00','rgba(255,209,102,.85)','06:34 map'); drawVertical(ctx,geom,bars,'07:20:00','rgba(255,91,114,.8)','07:20 core');
  if(revealed && c.answer.primary) drawAnswerWindow(ctx,geom,bars,c.answer.primary[0],c.answer.primary[1]);
  drawTimeLabels(ctx,geom,bars);
}
function drawExec(){
  const c=current(), cv=$('executionChart'); if(!c||!cv) return; const {ctx,w,h}=resizeCanvas(cv); ctx.clearRect(0,0,w,h);
  const all=c.bars_5s || [];
  let center = revealed && c.answer.entry ? indexAtOrAfter(all,c.answer.entry+':00') : visible5;
  if(selectedEntry) center = selectedEntry.i;
  const count = 360; const start=clamp(center-170,0,Math.max(0,all.length-count)); const end=Math.min(all.length-1,start+count); const bars=all.slice(start,end+1);
  const [pMin,pMax]=visiblePriceRange(bars); const geom={left:55,right:w-15,top:12,bottom:h-24,width:w-70,start,end,count:bars.length}; execGeom=geom;
  drawGrid(ctx,geom,pMin,pMax);
  if(showOverlays){ drawZoneBands(ctx,geom,pMin,pMax,c.zones.open4_rails||[],'rgba(255,209,102,.08)',''); drawZoneBands(ctx,geom,pMin,pMax,c.zones.snapshot_634||[],'rgba(167,139,250,.09)','MB '); drawAlpha(ctx,geom,bars,pMin,pMax,c); }
  drawCandles(ctx,bars,geom,pMin,pMax,{hideFuture:true, thin:true});
  drawVertical(ctx,geom,bars,'06:34:00','rgba(255,209,102,.85)','map'); drawVertical(ctx,geom,bars,'07:20:00','rgba(255,91,114,.8)','cut');
  if(revealed && c.answer.primary) drawAnswerWindow(ctx,geom,bars,c.answer.primary[0],c.answer.primary[1]);
  if(selectedEntry) drawEntry(ctx,geom,bars,pMin,pMax,selectedEntry);
  if(!revealed) drawVertical(ctx,geom,bars,currentTime(),'rgba(255,255,255,.5)','now');
  drawTimeLabels(ctx,geom,bars);
}
function drawAlpha(ctx,geom,bars,pMin,pMax,c){
  const ch=geom.bottom-geom.top;
  (c.alpha_breaks||[]).forEach(a=>{
    if(!revealed && tSec(a.time)>visibleTimeSec()) return;
    const x=xFromTime(bars,a.time,geom); if(x<geom.left-20||x>geom.right+20) return;
    const y1=yFor(a.top,geom.top,pMin,pMax,ch), y2=yFor(a.bot,geom.top,pMin,pMax,ch);
    ctx.fillStyle=a.dir==='LONG'?'rgba(102,167,255,.10)':'rgba(255,91,114,.10)'; ctx.fillRect(Math.max(geom.left,x-30), y1, 70, Math.max(2,y2-y1));
    ctx.strokeStyle=a.dir==='LONG'?'rgba(102,167,255,.7)':'rgba(255,91,114,.7)'; ctx.strokeRect(Math.max(geom.left,x-30), y1, 70, Math.max(2,y2-y1));
  });
}
function drawAnswerWindow(ctx,geom,bars,start,end){
  const x1=xFromTime(bars,start+':00',geom), x2=xFromTime(bars,end+':00',geom);
  ctx.fillStyle='rgba(55,242,154,.10)'; ctx.fillRect(Math.max(geom.left,x1),geom.top,Math.max(3,x2-x1),geom.bottom-geom.top);
  ctx.strokeStyle='rgba(55,242,154,.8)'; ctx.strokeRect(Math.max(geom.left,x1),geom.top,Math.max(3,x2-x1),geom.bottom-geom.top);
}
function drawEntry(ctx,geom,bars,pMin,pMax,e){
  if(e.i<geom.start||e.i>geom.end) return; const i=e.i-geom.start; const x=geom.left+geom.width*i/Math.max(1,bars.length-1); const y=yFor(e.price,geom.top,pMin,pMax,geom.bottom-geom.top);
  ctx.strokeStyle='#00d4ff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,geom.top); ctx.lineTo(x,geom.bottom); ctx.stroke(); ctx.fillStyle='#00d4ff'; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
}
function drawTimeLabels(ctx,geom,bars){
  ctx.fillStyle='rgba(148,163,184,.62)'; ctx.font='9px SF Mono'; const n=bars.length; const step=Math.max(1,Math.floor(n/8));
  for(let i=0;i<n;i+=step){ const x=geom.left+geom.width*i/Math.max(1,n-1); ctx.fillText(hm(bars[i].t),x-12,geom.bottom+15); }
}

function bind(){
  document.querySelectorAll('.schema-btn').forEach(b => b.addEventListener('click',()=>{ selectedSchema=b.dataset.v; if(selectedSchema==='SKIP') selectedSide='SKIP'; render(); }));
  document.querySelectorAll('.side-btn').forEach(b => b.addEventListener('click',()=>{ selectedSide=b.dataset.v; render(); }));
  $('submitBtn')?.addEventListener('click', submitRead); $('resetBtn')?.addEventListener('click', resetCard); $('revealBtn')?.addEventListener('click', reveal);
  $('nextBtn')?.addEventListener('click', nextCard); $('prevBtn')?.addEventListener('click', prevCard); $('randomBtn')?.addEventListener('click', randomCard);
  $('stepBtn')?.addEventListener('click', stepFwd); $('backBtn')?.addEventListener('click', stepBack); $('playBtn')?.addEventListener('click', togglePlay);
  $('jumpMapBtn')?.addEventListener('click',()=>jumpTo('06:34:00')); $('jumpCoreBtn')?.addEventListener('click',()=>jumpTo('07:20:00'));
  $('schemaFilter')?.addEventListener('change',applyFilters);
  $('unplayedBtn')?.addEventListener('click',function(){this.dataset.on=this.dataset.on==='1'?'0':'1';this.classList.toggle('on');this.textContent=this.dataset.on==='1'?'Unplayed on':'Unplayed off';applyFilters();});
  $('showOverlaysBtn')?.addEventListener('click',function(){showOverlays=!showOverlays;render();});
  $('exportBtn')?.addEventListener('click',()=>{ const blob=new Blob([JSON.stringify({schema:'entry_game_v01_reps', exported_at:new Date().toISOString(), deck:deck?.version, labels, stats},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='entry_game_v01_reps.json'; a.click(); });
  $('executionChart')?.addEventListener('click',handleExecClick);
  document.addEventListener('keydown',e=>{ if(['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName)) return; const k=e.key.toLowerCase(); if(k===' ') {e.preventDefault();togglePlay();} if(k==='arrowright') stepFwd(); if(k==='arrowleft') stepBack(); if(k==='l'){selectedSide='LONG';render();} if(k==='s'){selectedSide='SHORT';render();} if(k==='k'){selectedSide='SKIP';selectedSchema=selectedSchema||'SKIP';render();} if(k==='r') reveal(); if(k==='a'){selectedSchema='A1';render();} if(k==='2'){selectedSchema='A2';render();} if(k==='b'){selectedSchema='B';render();} if(k==='c'){selectedSchema='C';render();} if(k==='f'){selectedSchema='C-F';render();} if(k==='d'){selectedSchema='D2';render();} if(k==='n'){selectedSchema='NEW';render();} });
  let resizeTimer=null; window.addEventListener('resize',()=>{clearTimeout(resizeTimer); resizeTimer=setTimeout(draw,100);});
}

boot().catch(err => { console.error(err); document.body.innerHTML = `<pre style="color:#ff5b72;padding:20px">Failed to load trainer: ${esc(err.message)}</pre>`; });
