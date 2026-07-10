// NQ ENTRY OPS v0.2 — dark cockpit trainer
// One day per card. 06:30-06:34 builds the map; core scoring ends at 07:20.
// Scoring model, deck schema, localStorage keys and export format are unchanged from v0.1.

const DECK_URL = 'decks/entry_game_v01_quality_deck.json';
const LABEL_KEY = 'entryGame.v01.labels';
const STATS_KEY = 'entryGame.v01.stats';
const META_KEY  = 'entryGame.v01.meta';
const DAY_GOAL = 20;
const $ = (id) => document.getElementById(id);

let deck = null, cards = [], filtered = [], pos = 0;
let visible5 = 0, revealed = false, playTimer = null;
let labels = loadJson(LABEL_KEY, {});
let stats  = loadJson(STATS_KEY, {played:0, totalScore:0, correct:0, history:[]});
let meta   = loadJson(META_KEY, {xp:0, streak:0, bestStreak:0, badges:{}, counters:{}, daily:{}, hardMode:false});
meta.counters = meta.counters || {}; meta.badges = meta.badges || {}; meta.daily = meta.daily || {};
let selectedSchema = null, selectedSide = null, selectedEntry = null;
let execGeom = null, parentGeom = null;
let showOverlays = true;
let familyFilter = 'ALL';
let cardStartMs = Date.now();
let hoverExec = null;          // {x, i} crosshair on exec chart
let lastResult = null;         // {cardId, gain, bonuses[], newBadges[], leveledTo}

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

const BADGES = [
  {id:'first_rep',    name:'First Blood',          desc:'Score your first rep'},
  {id:'clean_10',     name:'Clean Classifier',     desc:'10 exact schematic reads'},
  {id:'perfect_entry',name:'Perfect Entry',        desc:'Full entry + timing marks on one rep'},
  {id:'discipline',   name:'No-Chase Discipline',  desc:'Correct no-trade on a SKIP day'},
  {id:'d2_sniper',    name:'D2 Sniper',            desc:'5 exact D2 reads'},
  {id:'c_specialist', name:'C-Family Specialist',  desc:'5 exact C / C-F reads'},
  {id:'streak_5',     name:'On A Heater',          desc:'5 good reads in a row'},
  {id:'streak_10',    name:'Unconscious',          desc:'10 good reads in a row'},
  {id:'session_20',   name:'Full Session',         desc:`${DAY_GOAL} reps in one day`},
  {id:'hard_10',      name:'Instruments Only',     desc:'10 reps scored in hard mode'},
];

// ---------- utils ----------
function loadJson(k, fallback){ try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); } catch { return fallback; } }
function saveLabels(){ localStorage.setItem(LABEL_KEY, JSON.stringify(labels)); }
function saveStats(){ localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }
function saveMeta(){ localStorage.setItem(META_KEY, JSON.stringify(meta)); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }
function current(){ return filtered[pos] || cards[0]; }
function tSec(t){ const [h,m,s='0'] = String(t).split(':'); return Number(h)*3600 + Number(m)*60 + Number(s); }
function hm(t){ return String(t || '').slice(0,5); }
function fmtPrice(x){ return Number.isFinite(Number(x)) ? Number(x).toFixed(2) : '—'; }
function todayKey(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function effectiveOverlays(){ return showOverlays && !meta.hardMode; }

// ---------- level / xp ----------
function levelInfo(xp){
  let lvl = 1, need = 150, rem = xp;
  while(rem >= need){ rem -= need; lvl++; need = 150 + (lvl-1)*60; }
  return {lvl, into: rem, need};
}

// ---------- boot ----------
async function boot(){
  bind();
  const r = await fetch(DECK_URL, {cache:'no-store'});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  deck = await r.json();
  cards = deck.cards || [];
  applyFilters();
}

function applyFilters(){
  filtered = cards.filter(c => {
    if(familyFilter !== 'ALL' && c.answer?.schematic !== familyFilter) return false;
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
  cardStartMs = Date.now();
  hoverExec = null;
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

// ---------- render pipeline ----------
function render(){
  renderHUD(); renderHeader(); renderChips(); renderButtons(); renderTicket();
  renderClues(); renderRails(); renderHistory(); draw();
}

function renderHUD(){
  const li = levelInfo(meta.xp || 0);
  $('lvlBadge').textContent = li.lvl;
  $('lvlLabel').textContent = `LEVEL ${li.lvl}`;
  $('xpFill').style.width = `${Math.round(100 * li.into / li.need)}%`;
  $('xpLabel').textContent = `${meta.xp||0} XP · ${li.need - li.into} to next`;
  const st = meta.streak || 0;
  const sv = $('streakVal');
  sv.textContent = st;
  sv.className = 'mono' + (st >= 10 ? ' blazing' : st >= 3 ? ' hot' : '');
  const today = meta.daily[todayKey()] || 0;
  $('todayVal').textContent = `${today}/${DAY_GOAL}`;
  const tf = $('todayFill');
  tf.style.width = `${Math.min(100, Math.round(100*today/DAY_GOAL))}%`;
  tf.classList.toggle('done', today >= DAY_GOAL);
  const avg = stats.played ? (stats.totalScore / stats.played).toFixed(1) : '—';
  $('avgVal').textContent = avg;
  $('winVal').textContent = stats.played ? `${Math.round(100*(stats.correct||0)/stats.played)}%` : '—';
  $('hardBtn').classList.toggle('on', !!meta.hardMode);
  $('hardBtn').textContent = meta.hardMode ? 'HARD ×1.25' : 'HARD';
}

function renderHeader(){
  const c = current(); if(!c) return;
  const lab = labels[c.card_id] || {};
  $('cardTitle').textContent = `${c.date} · ${revealed ? c.answer.schematic + ' ' + c.answer.side : 'SCHEMATIC HIDDEN'}`;
  $('cardMeta').textContent = `card ${pos+1}/${filtered.length} · ${c.meta.normalized_flip === 'FLIPPED_ACTUAL_DOWN' ? 'normalized — actual opening move DOWN' : 'normalized — actual opening move UP'} · core 06:30–07:20`;
  $('deckCount').textContent = `${cards.length} days · ${stats.played||0} reps`;
  $('clock').textContent = hm(currentTime());
  const now = tSec(currentTime() + (currentTime().length === 5 ? ':00' : ''));
  const pc = $('phaseChip');
  if(now < tSec('06:34:00')){ pc.textContent = 'MAP PHASE'; pc.className = 'phase-chip map'; }
  else if(now <= tSec('07:20:00')){ pc.textContent = 'GAME WINDOW'; pc.className = 'phase-chip game'; }
  else { pc.textContent = 'EXTENDED'; pc.className = 'phase-chip ext'; }
  const hb = $('hiddenBadge');
  hb.className = 'status-badge';
  if(lab.scored){ hb.textContent = `${lab.score}/10`; hb.classList.add(lab.score >= 7 ? 'right' : 'wrong'); }
  else hb.textContent = revealed ? 'REVEALED' : 'HIDDEN';
}

function renderChips(){
  document.querySelectorAll('#familyChips .chip').forEach(b => b.classList.toggle('on', b.dataset.f === familyFilter));
  $('overlaysBtn').classList.toggle('on', showOverlays);
  $('overlaysBtn').textContent = meta.hardMode ? 'OVERLAYS (HARD)' : 'OVERLAYS';
}

function renderButtons(){
  document.querySelectorAll('.schema-btn').forEach(b => b.classList.toggle('active', b.dataset.v === selectedSchema));
  document.querySelectorAll('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.v === selectedSide));
  const ready = !!(selectedSchema && selectedSide && (selectedSide === 'SKIP' || selectedEntry));
  $('submitBtn').disabled = false; // submitting an incomplete read is allowed, it just scores low
  $('submitBtn').style.opacity = ready ? '1' : '.75';
}

function renderTicket(){
  const c = current(); if(!c) return;
  const entry = selectedEntry ? `<b>${hm(selectedEntry.time)}</b> @ <b>${fmtPrice(selectedEntry.price)}</b>` : '<b>none</b> — click the 5s chart';
  const warn = selectedEntry && tSec(selectedEntry.time) < tSec('06:34:00') ? `<div class="warn-line">⚠ Before 06:34 — map only, not a valid game entry.</div>` : '';
  const late = selectedEntry && tSec(selectedEntry.time) > tSec('07:20:00') ? `<div class="warn-line">⚠ Outside core window — extended trades don't score as the daily schematic.</div>` : '';
  const ok = selectedEntry && !warn && !late ? `<div class="ok-line">Inside game window.</div>` : '';
  $('tradeTicket').innerHTML = `
    <div>Read: <b>${esc(selectedSchema || '—')}</b> <span>${selectedSchema ? esc(SCHEMA[selectedSchema] || '') : ''}</span></div>
    <div>Side: <b>${esc(selectedSide || '—')}</b> · Entry: ${entry}</div>
    ${warn}${late}${ok}
  `;
}

function renderClues(){
  const c = current(); if(!c) return;
  $('clueStep').classList.toggle('hidden', !!meta.hardMode);
  if(meta.hardMode) return;
  const meta_ = c.meta || {};
  const alphaSeen = (c.alpha_breaks || []).filter(a => tSec(a.time) <= tSec(currentTime()));
  const lastAlpha = alphaSeen[alphaSeen.length - 1];
  const o4 = c.zones?.open4_rails || [];
  const z634 = c.zones?.snapshot_634 || [];
  let html = '';
  html += `<div class="clue rule"><b>Rule</b><span>06:30–06:34 creates the map. Trade only the reaction / flip / continuation after the map exists.</span></div>`;
  if(o4.length) html += `<div class="clue o4"><b>06:34 Open4 rails</b><span>${o4.map(z => `${esc(z.tag.replace('OPEN4_',''))} ${fmtPrice(z.mid)}`).join(' · ')}</span></div>`;
  if(z634.length) html += `<div class="clue mb"><b>06:34 MB / LVN</b><span>${z634.map(z => `${esc(z.tag)} [${fmtPrice(z.bot)}–${fmtPrice(z.top)}]`).join(' · ')}</span></div>`;
  html += `<div class="clue alpha"><b>Alpha boxes</b><span>${lastAlpha ? `Last: ${esc(lastAlpha.time)} ${esc(lastAlpha.dir)} [${fmtPrice(lastAlpha.bot)}–${fmtPrice(lastAlpha.top)}]` : 'No alpha break revealed yet.'}</span></div>`;
  html += `<div class="clue"><b>Objective</b><span>${revealed ? `Answer: ${esc(c.answer.schematic)} ${esc(c.answer.side)} · normalized ${esc(c.answer.normalized_side || '—')}` : 'Classify the day, pick the actual side, click the one winner. Not in taxonomy? Mark NEW and explain.'}</span></div>`;
  $('visibleClues').innerHTML = html;
}

// ---------- scoring (unchanged model from v0.1) ----------
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
  // Parts can sum to 11 (3+2+3+1+2); cap at 10 so the /10 scale is honest (v0.1 displayed 11/10).
  const total = Math.min(10, schema + side + entry + timing + confluence);
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
  const start = entrySec - 10*60;
  for(const b of c.bars_5s || []){
    const bs = tSec(b.t); if(bs < start || bs > entrySec) continue;
    const zones = [...(c.zones?.open4_rails||[]), ...(c.zones?.snapshot_634||[])];
    if(zones.some(z => Number(b.h) >= z.bot - 3 && Number(b.l) <= z.top + 3)) zone = true;
  }
  return {alpha, zone};
}
function nearest5(c, time){ const i = indexAtOrBefore(c.bars_5s, time); return c.bars_5s[i]; }

// ---------- submit + gamification ----------
function submitRead(){
  const c = current(); if(!c) return;
  if(labels[c.card_id]?.scored){ toast('Already scored — NEXT REP or reset the card.'); return; }
  if(!selectedSchema || !selectedSide){ toast('Pick a schematic and a side first.', 'amber'); return; }
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

  // --- gamification layer ---
  const prevLvl = levelInfo(meta.xp || 0).lvl;
  const bonuses = [];
  let gain = s.total * 10;
  const entryT = lab.entry_i != null ? c.bars_5s[lab.entry_i]?.t : null;
  const entryLegal = !entryT || (tSec(entryT) >= tSec('06:34:00') && tSec(entryT) <= tSec('07:20:00'));
  if(s.parts.schema === 3){ gain += 5; bonuses.push('CLEAN CLASS +5'); }
  if(s.parts.entry === 3 && s.parts.timing === 1){ gain += 10; bonuses.push('PERFECT ENTRY +10'); }
  if(c.answer.side === 'SKIP' && lab.side === 'SKIP' && lab.entry_i == null){ gain += 10; bonuses.push('DISCIPLINE +10'); }
  const elapsed = (Date.now() - cardStartMs) / 1000;
  if(elapsed <= 45 && s.total >= 7 && entryLegal){ gain += 10; bonuses.push('FAST READ +10'); }
  if(meta.hardMode){ gain = Math.round(gain * 1.25); bonuses.push('HARD ×1.25'); }

  meta.streak = s.total >= 7 ? (meta.streak || 0) + 1 : 0;
  meta.bestStreak = Math.max(meta.bestStreak || 0, meta.streak);
  const ct = meta.counters;
  if(s.parts.schema === 3) ct.exact = (ct.exact || 0) + 1;
  if(s.parts.schema === 3 && c.answer.schematic === 'D2') ct.d2 = (ct.d2 || 0) + 1;
  if(s.parts.schema === 3 && (c.answer.schematic === 'C' || c.answer.schematic === 'C-F')) ct.cfam = (ct.cfam || 0) + 1;
  if(meta.hardMode) ct.hard = (ct.hard || 0) + 1;
  const tk = todayKey();
  meta.daily[tk] = (meta.daily[tk] || 0) + 1;
  meta.xp = (meta.xp || 0) + gain;

  const newBadges = [];
  const earn = (id) => { if(!meta.badges[id]){ meta.badges[id] = new Date().toISOString(); newBadges.push(BADGES.find(b => b.id === id)); } };
  earn('first_rep');
  if((ct.exact||0) >= 10) earn('clean_10');
  if(s.parts.entry === 3 && s.parts.timing === 1) earn('perfect_entry');
  if(c.answer.side === 'SKIP' && lab.side === 'SKIP' && lab.entry_i == null) earn('discipline');
  if((ct.d2||0) >= 5) earn('d2_sniper');
  if((ct.cfam||0) >= 5) earn('c_specialist');
  if(meta.streak >= 5) earn('streak_5');
  if(meta.streak >= 10) earn('streak_10');
  if(meta.daily[tk] >= DAY_GOAL) earn('session_20');
  if((ct.hard||0) >= 10) earn('hard_10');
  saveMeta();

  const newLvl = levelInfo(meta.xp).lvl;
  lastResult = {cardId: c.card_id, gain, bonuses, newBadges, leveledTo: newLvl > prevLvl ? newLvl : null};
  if(lastResult.leveledTo){ toast(`LEVEL UP → ${newLvl}`, 'green'); $('lvlBadge').classList.add('pop'); setTimeout(()=>$('lvlBadge').classList.remove('pop'), 700); }

  revealed = true; visible5 = c.bars_5s.length - 1;
  render();
  if(s.total >= 9) confetti();
}

// ---------- rails / debrief ----------
function renderRails(){
  const c = current(); if(!c) return;
  const lab = labels[c.card_id];
  const showDebrief = revealed || lab?.scored;
  $('decisionRail').classList.toggle('hidden', !!showDebrief);
  $('debriefRail').classList.toggle('hidden', !showDebrief);
  if(showDebrief) renderDebrief();
}

function gradeFor(score){
  if(score >= 10) return 'S';
  if(score >= 9) return 'A';
  if(score >= 8) return 'B+';
  if(score >= 7) return 'B';
  if(score >= 5) return 'C';
  if(score >= 3) return 'D';
  return 'F';
}

const GOOD_DETAIL = ['schema exact','side correct','primary window','correct no-trade','C family correct, subtype off','A family correct, subtype off','secondary/add window'];

function renderDebrief(){
  const c = current(); if(!c) return;
  const ans = c.answer;
  const lab = labels[c.card_id] || {};
  const scored = !!lab.scored;
  const score = scored ? lab.score : null;
  const win = scored && score >= 7;
  const fresh = lastResult && lastResult.cardId === c.card_id;

  let hero;
  if(scored){
    hero = `
      <div class="debrief-hero ${win ? 'win' : 'loss'}">
        <div class="grade-ring">${gradeFor(score)}</div>
        <div class="debrief-score"><span id="scoreCount">0</span>/10</div>
        <div class="debrief-sub">${win ? 'Good read. Bank it.' : 'Review this rep — the debrief below is the lesson.'}</div>
        ${fresh ? `<div class="xp-toast">+${lastResult.gain} XP</div>` : ''}
        ${fresh && lastResult.bonuses.length ? `<div class="bonus-tags">${lastResult.bonuses.map(b => `<span>${esc(b)}</span>`).join('')}</div>` : ''}
        ${fresh && lastResult.newBadges.length ? `<div class="badge-pop">${lastResult.newBadges.map(b => `<div>★ ${esc(b.name)}<small>${esc(b.desc)}</small></div>`).join('')}</div>` : ''}
      </div>`;
  } else {
    hero = `
      <div class="debrief-hero peek">
        <div class="grade-ring">👁</div>
        <div class="debrief-score">PEEKED</div>
        <div class="debrief-sub">Answer revealed without a read — no score, no XP. Reset the card to play it properly.</div>
      </div>`;
  }

  const parts = lab.parts;
  const bars = parts ? `
    <div class="step">
      <div class="step-head plain">SCORE BREAKDOWN</div>
      <div class="score-bars">
        ${sbar('SCHEMATIC', parts.schema, 3)}
        ${sbar('SIDE', parts.side, 2)}
        ${sbar('ENTRY', parts.entry, 3)}
        ${sbar('TIMING', parts.timing, 1)}
        ${sbar('CONFLUENCE', parts.confluence, 2)}
      </div>
    </div>` : '';

  const yourEntry = lab.entry_i != null ? `${hm(c.bars_5s[lab.entry_i]?.t)} @ ${fmtPrice(lab.entry_price)}` : 'none';
  const windowText = ans.side === 'SKIP' ? 'NO CORE TRADE' : `${ans.entry || '—'} · primary ${ans.primary ? ans.primary.join('–') : '—'}`;
  const secondary = ans.secondary?.length ? `<div class="fact"><span>Secondary / add</span><b>${esc(ans.secondary.map(w => w.join('–')).join(', '))}</b></div>` : '';
  const ext = ans.extended ? `<div class="fact"><span>Extended only</span><b>${esc(ans.extended.side)} ${esc(ans.extended.window.join('–'))} (not core)</b></div>` : '';
  const facts = `
    <div class="step">
      <div class="step-head plain">THE ANSWER</div>
      <div class="answer-facts">
        <div class="fact"><span>Schematic</span><b>${esc(ans.schematic)} — ${esc(SCHEMA[ans.schematic] || '')}</b></div>
        <div class="fact"><span>Actual side</span><b class="${ans.side === 'LONG' ? 'long' : ans.side === 'SHORT' ? 'short' : 'skip'}">${esc(ans.side)}</b></div>
        <div class="fact"><span>Normalized side</span><b>${esc(ans.normalized_side || '—')}</b></div>
        <div class="fact"><span>Trade window</span><b>${esc(windowText)}</b></div>
        ${secondary}${ext}
        <div class="fact"><span>Model result</span><b>${esc(ans.model_result || '—')} · R ${ans.r_net ?? '—'}</b></div>
        <div class="fact"><span>Risk / MAE / MFE</span><b>${ans.risk ?? '—'} / ${ans.mae_r ?? '—'}R / ${ans.mfe_r ?? '—'}R</b></div>
        ${scored ? `<div class="fact"><span>Your read</span><b>${esc(lab.schema || '—')} ${esc(lab.side || '—')} · ${esc(yourEntry)}</b></div>` : ''}
      </div>
    </div>`;

  const misses = lab.detail ? `
    <div class="step">
      <div class="step-head plain">WHAT YOU ${win ? 'NAILED / MISSED' : 'MISSED'}</div>
      <div class="miss-list">
        ${lab.detail.map(d => `<div class="${GOOD_DETAIL.includes(d) ? 'good' : 'bad'}">${esc(d)}</div>`).join('')}
      </div>
    </div>` : '';

  const why = ans.notes ? `<div class="why-note"><b>Why:</b> ${esc(ans.notes)}</div>` : '';
  const research = (ans.schematic === 'C-F' || ans.schematic === 'D2') ?
    `<div class="research-flag">${esc(ans.schematic)} labels are research-derived (model v2), not live-proven. Treat as training/audit labels — corrections welcome in notes.</div>` : '';

  $('debriefRail').innerHTML = `
    ${hero}
    ${bars}
    ${facts}
    ${misses}
    ${why}
    ${research}
    <button id="nextRepBtn" class="next-btn">NEXT REP <kbd>⏎</kbd></button>
    <div class="debrief-row">
      <button id="replayBtn" class="ghost-btn">REPLAY DAY</button>
      <button id="retryBtn" class="ghost-btn">RESET + RETRY</button>
    </div>
  `;
  $('nextRepBtn')?.addEventListener('click', nextRep);
  $('replayBtn')?.addEventListener('click', () => { revealed = false; visible5 = indexAtOrAfter(c.bars_5s, '06:30:00'); startPlay(); });
  $('retryBtn')?.addEventListener('click', resetCard);
  requestAnimationFrame(() => {
    document.querySelectorAll('.sbar-fill').forEach(el => { el.style.width = el.dataset.w; });
    if(scored) countUp($('scoreCount'), score, 650);
  });
}

function sbar(label, v, max){
  const pct = Math.round(100 * v / max);
  const cls = v >= max ? 'full' : v > 0 ? 'part' : 'zero';
  return `<div class="sbar"><span>${label}</span><div class="sbar-track"><div class="sbar-fill ${cls}" data-w="${pct}%"></div></div><b>${v}/${max}</b></div>`;
}

function countUp(el, target, ms){
  if(!el) return;
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if(p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function confetti(){
  const wrap = document.createElement('div');
  wrap.className = 'confetti';
  const colors = ['#2df0a0','#37c8ff','#ffc857','#a78bfa','#ff4d6b'];
  for(let i=0;i<36;i++){
    const s = document.createElement('i');
    s.style.left = `${Math.random()*100}%`;
    s.style.background = colors[i % colors.length];
    s.style.animationDuration = `${1 + Math.random()*1.2}s`;
    s.style.animationDelay = `${Math.random()*.3}s`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 2600);
}

function toast(msg, cls=''){
  const t = document.createElement('div');
  t.className = `toast ${cls}`;
  t.textContent = msg;
  $('toastLayer').appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function renderHistory(){
  const h = (stats.history || []).slice(-10).reverse();
  $('historyTape').innerHTML = h.map(x =>
    `<span class="tape-pill ${x.score >= 7 ? 'good' : x.score >= 5 ? 'mid' : 'bad'}" title="${esc(x.schema||'—')} ${esc(x.side||'—')} vs ${esc(x.answer)}">${esc(x.date.slice(5))} · ${x.score}</span>`
  ).join('') || '<span class="tape-empty">No reps yet. Play the replay, classify, lock it in.</span>';
}

// ---------- stats modal ----------
function renderStatsModal(){
  const byId = {}; cards.forEach(c => byId[c.card_id] = c);
  const fams = ['A1','A2','B','C','C-F','D2'];
  const agg = {};
  fams.forEach(f => agg[f] = {reps:0, exact:0, scoreSum:0, total:0});
  cards.forEach(c => { const f = c.answer?.schematic; if(agg[f]) agg[f].total++; });
  Object.entries(labels).forEach(([id, lab]) => {
    if(!lab.scored) return;
    const c = byId[id]; if(!c) return;
    const f = c.answer?.schematic; if(!agg[f]) return;
    agg[f].reps++; agg[f].scoreSum += lab.score || 0;
    if(lab.schema === f) agg[f].exact++;
  });
  const avg = stats.played ? (stats.totalScore/stats.played).toFixed(1) : '—';
  const famHtml = fams.map(f => {
    const a = agg[f];
    const pct = a.reps ? Math.round(100*a.exact/a.reps) : 0;
    return `<div class="fam-card">
      <div class="fam-head"><b>${esc(f)}</b><em>${a.reps}/${a.total} played</em></div>
      <div class="fam-track"><div class="fam-fill" style="width:${pct}%"></div></div>
      <small>${a.reps ? `${pct}% exact · avg ${(a.scoreSum/a.reps).toFixed(1)}` : 'no reps yet'}</small>
    </div>`;
  }).join('');
  const badgeHtml = BADGES.map(b =>
    `<div class="badge-cell ${meta.badges[b.id] ? 'earned' : ''}"><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`
  ).join('');
  $('statsBody').innerHTML = `
    <div class="stat-hero">
      <div><span>REPS</span><b>${stats.played||0}</b></div>
      <div><span>AVG SCORE</span><b>${avg}</b></div>
      <div><span>BEST STREAK</span><b>${meta.bestStreak||0}</b></div>
      <div><span>TOTAL XP</span><b>${meta.xp||0}</b></div>
    </div>
    <div class="section-title">FAMILY ACCURACY — exact classification</div>
    <div class="fam-grid">${famHtml}</div>
    <div class="research-flag">C-F and D2 are research-derived labels (quality model v2), not live-proven setups. D1 is excluded from this deck entirely.</div>
    <div class="section-title">BADGES — ${Object.keys(meta.badges).length}/${BADGES.length}</div>
    <div class="badge-grid">${badgeHtml}</div>
  `;
}

// ---------- navigation ----------
function resetCard(){ const c=current(); if(!c) return; delete labels[c.card_id]; saveLabels(); lastResult=null; initCard(); }
function nextCard(){ pos=clamp(pos+1,0,filtered.length-1); initCard(); }
function prevCard(){ pos=clamp(pos-1,0,filtered.length-1); initCard(); }
function randomCard(){ pos=Math.floor(Math.random()*filtered.length); initCard(); }
function nextRep(){
  const unplayed = filtered.map((c,i)=>({c,i})).filter(x => !labels[x.c.card_id]?.scored);
  if(unplayed.length){ pos = unplayed[Math.floor(Math.random()*unplayed.length)].i; }
  else { toast('Every card in this filter is played — clearing to random.', 'amber'); pos = Math.floor(Math.random()*filtered.length); }
  initCard();
}
function reveal(){ const c=current(); if(!c) return; revealed=true; labels[c.card_id] = {...(labels[c.card_id]||{}), revealed:true}; saveLabels(); visible5=c.bars_5s.length-1; render(); }
function stepFwd(){ const c=current(); if(!c) return; visible5=clamp(visible5+1,0,c.bars_5s.length-1); draw(); renderHeader(); renderClues(); }
function stepBack(){ const c=current(); if(!c) return; visible5=clamp(visible5-1,0,c.bars_5s.length-1); draw(); renderHeader(); renderClues(); }
function togglePlay(){ playTimer ? stopPlay() : startPlay(); }
function startPlay(){
  $('playBtn').textContent='❚❚ PAUSE'; $('playBtn').classList.add('on');
  playTimer=setInterval(()=>{ const c=current(); if(!c || visible5>=c.bars_5s.length-1){ stopPlay(); if(c && labels[c.card_id]?.scored && !revealed){ revealed=true; render(); } return; } stepFwd(); }, 65);
}
function stopPlay(){ if(playTimer){ clearInterval(playTimer); playTimer=null; } const pb=$('playBtn'); if(pb){ pb.textContent='▶ PLAY'; pb.classList.remove('on'); } }
function jumpTo(time){ const c=current(); if(!c) return; visible5=indexAtOrAfter(c.bars_5s,time); draw(); renderHeader(); renderClues(); }

// ---------- entry click + hover ----------
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

function handleExecHover(e){
  const c = current(); if(!c || !execGeom) return;
  const rect = e.target.getBoundingClientRect(); const x = e.clientX - rect.left;
  if(x < execGeom.left || x > execGeom.right){ if(hoverExec){ hoverExec = null; drawExec(); } return; }
  const frac = (x - execGeom.left) / execGeom.width;
  const i = clamp(Math.round(execGeom.start + frac * execGeom.count), execGeom.start, Math.min(execGeom.end, c.bars_5s.length - 1));
  if(!revealed && i > visible5){ if(hoverExec){ hoverExec = null; drawExec(); } return; }
  if(!hoverExec || hoverExec.i !== i){ hoverExec = {i}; drawExec(); }
}

// ---------- drawing ----------
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
    const x=left+bw*i+bw*.5; const o=+b.o,h=+b.h,l=+b.l,c=+b.c; const bull=c>=o; const col=bull?'#22d68e':'#ff4d6b';
    ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=opts.thin?0.7:1;
    ctx.beginPath(); ctx.moveTo(x,yFor(h,top,pMin,pMax,ch)); ctx.lineTo(x,yFor(l,top,pMin,pMax,ch)); ctx.stroke();
    const yO=yFor(o,top,pMin,pMax,ch), yC=yFor(c,top,pMin,pMax,ch); ctx.fillRect(x-bw*.33, Math.min(yO,yC), Math.max(1,bw*.66), Math.max(1,Math.abs(yC-yO)));
  });
}
function drawGrid(ctx,geom,pMin,pMax){
  const {left,right,top,bottom}=geom; const ch=bottom-top;
  ctx.strokeStyle='rgba(120,145,180,.1)'; ctx.fillStyle='rgba(120,145,180,.55)'; ctx.font='9px JetBrains Mono, SF Mono, monospace';
  for(let i=0;i<=5;i++){ const y=top+ch*i/5; const px=pMax-(pMax-pMin)*i/5; ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke(); ctx.fillText(px.toFixed(0), 5, y+3); }
}
function xFromTime(bars,time,geom){
  const idx = indexAtOrAfter(bars,time); return geom.left + geom.width * idx / Math.max(1,bars.length-1);
}
function drawVertical(ctx,geom,bars,time,color,label){
  const x=xFromTime(bars,time,geom); ctx.strokeStyle=color; ctx.lineWidth=1; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(x,geom.top); ctx.lineTo(x,geom.bottom); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle=color; ctx.font='9px JetBrains Mono, SF Mono, monospace'; ctx.fillText(label,x+3,geom.top+10);
}
function drawZoneBands(ctx,geom,pMin,pMax,zones,color,labelPrefix){
  const ch=geom.bottom-geom.top;
  zones.forEach(z=>{
    const y1=yFor(z.top,geom.top,pMin,pMax,ch), y2=yFor(z.bot,geom.top,pMin,pMax,ch);
    ctx.fillStyle=color; ctx.fillRect(geom.left, y1, geom.right-geom.left, Math.max(2,y2-y1));
    ctx.fillStyle='rgba(219,231,251,.55)'; ctx.font='8px JetBrains Mono, SF Mono, monospace'; ctx.fillText(`${labelPrefix}${z.tag}`, geom.left+4, y1+9);
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
  if(effectiveOverlays()){ drawZoneBands(ctx,geom,pMin,pMax,c.zones.open4_rails||[],'rgba(255,200,87,.09)',''); drawZoneBands(ctx,geom,pMin,pMax,c.zones.snapshot_634||[],'rgba(167,139,250,.1)','MB '); }
  drawCandles(ctx,bars,geom,pMin,pMax,{hideFuture:true});
  drawVertical(ctx,geom,bars,'06:34:00','rgba(255,200,87,.85)','06:34 map'); drawVertical(ctx,geom,bars,'07:20:00','rgba(255,77,107,.8)','07:20 core');
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
  if(effectiveOverlays()){ drawZoneBands(ctx,geom,pMin,pMax,c.zones.open4_rails||[],'rgba(255,200,87,.08)',''); drawZoneBands(ctx,geom,pMin,pMax,c.zones.snapshot_634||[],'rgba(167,139,250,.09)','MB '); drawAlpha(ctx,geom,bars,pMin,pMax,c); }
  drawCandles(ctx,bars,geom,pMin,pMax,{hideFuture:true, thin:true});
  drawVertical(ctx,geom,bars,'06:34:00','rgba(255,200,87,.85)','map'); drawVertical(ctx,geom,bars,'07:20:00','rgba(255,77,107,.8)','cut');
  if(revealed && c.answer.primary) drawAnswerWindow(ctx,geom,bars,c.answer.primary[0],c.answer.primary[1]);
  if(selectedEntry) drawEntry(ctx,geom,bars,pMin,pMax,selectedEntry);
  if(!revealed) drawVertical(ctx,geom,bars,currentTime(),'rgba(255,255,255,.5)','now');
  if(hoverExec) drawHover(ctx,geom,bars,pMin,pMax,all);
  drawTimeLabels(ctx,geom,bars);
}
function drawHover(ctx,geom,bars,pMin,pMax,all){
  const i = hoverExec.i; if(i<geom.start||i>geom.end) return;
  const b = all[i]; if(!b) return;
  const li = i-geom.start; const x=geom.left+geom.width*li/Math.max(1,bars.length-1);
  ctx.strokeStyle='rgba(55,200,255,.35)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
  ctx.beginPath(); ctx.moveTo(x,geom.top); ctx.lineTo(x,geom.bottom); ctx.stroke(); ctx.setLineDash([]);
  const tag=`${hm(b.t)} · ${fmtPrice(b.c)}`;
  ctx.font='9px JetBrains Mono, SF Mono, monospace';
  const tw=ctx.measureText(tag).width+10;
  const bx=clamp(x-tw/2,geom.left,geom.right-tw);
  ctx.fillStyle='rgba(6,10,18,.9)'; ctx.fillRect(bx,geom.bottom-16,tw,13);
  ctx.strokeStyle='rgba(55,200,255,.4)'; ctx.strokeRect(bx,geom.bottom-16,tw,13);
  ctx.fillStyle='rgba(55,200,255,.95)'; ctx.fillText(tag,bx+5,geom.bottom-6);
}
function drawAlpha(ctx,geom,bars,pMin,pMax,c){
  const ch=geom.bottom-geom.top;
  (c.alpha_breaks||[]).forEach(a=>{
    if(!revealed && tSec(a.time)>visibleTimeSec()) return;
    const x=xFromTime(bars,a.time,geom); if(x<geom.left-20||x>geom.right+20) return;
    const y1=yFor(a.top,geom.top,pMin,pMax,ch), y2=yFor(a.bot,geom.top,pMin,pMax,ch);
    ctx.fillStyle=a.dir==='LONG'?'rgba(55,200,255,.1)':'rgba(255,77,107,.1)'; ctx.fillRect(Math.max(geom.left,x-30), y1, 70, Math.max(2,y2-y1));
    ctx.strokeStyle=a.dir==='LONG'?'rgba(55,200,255,.7)':'rgba(255,77,107,.7)'; ctx.strokeRect(Math.max(geom.left,x-30), y1, 70, Math.max(2,y2-y1));
  });
}
function drawAnswerWindow(ctx,geom,bars,start,end){
  const x1=xFromTime(bars,start+':00',geom), x2=xFromTime(bars,end+':00',geom);
  ctx.fillStyle='rgba(45,240,160,.1)'; ctx.fillRect(Math.max(geom.left,x1),geom.top,Math.max(3,x2-x1),geom.bottom-geom.top);
  ctx.strokeStyle='rgba(45,240,160,.8)'; ctx.strokeRect(Math.max(geom.left,x1),geom.top,Math.max(3,x2-x1),geom.bottom-geom.top);
}
function drawEntry(ctx,geom,bars,pMin,pMax,e){
  if(e.i<geom.start||e.i>geom.end) return; const i=e.i-geom.start; const x=geom.left+geom.width*i/Math.max(1,bars.length-1); const y=yFor(e.price,geom.top,pMin,pMax,geom.bottom-geom.top);
  ctx.strokeStyle='#37c8ff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,geom.top); ctx.lineTo(x,geom.bottom); ctx.stroke();
  ctx.shadowColor='rgba(55,200,255,.9)'; ctx.shadowBlur=12;
  ctx.fillStyle='#37c8ff'; ctx.beginPath(); ctx.arc(x,y,4.5,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(55,200,255,.5)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.stroke();
}
function drawTimeLabels(ctx,geom,bars){
  ctx.fillStyle='rgba(120,145,180,.6)'; ctx.font='9px JetBrains Mono, SF Mono, monospace'; const n=bars.length; const step=Math.max(1,Math.floor(n/8));
  for(let i=0;i<n;i+=step){ const x=geom.left+geom.width*i/Math.max(1,n-1); ctx.fillText(hm(bars[i].t),x-12,geom.bottom+15); }
}

// ---------- modals ----------
function openModal(id){ $(id).classList.remove('hidden'); if(id==='statsModal') renderStatsModal(); }
function closeModals(){ document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }

// ---------- bind ----------
function bind(){
  document.querySelectorAll('.schema-btn').forEach(b => b.addEventListener('click',()=>{ selectedSchema=b.dataset.v; if(selectedSchema==='SKIP') selectedSide='SKIP'; render(); }));
  document.querySelectorAll('.side-btn').forEach(b => b.addEventListener('click',()=>{ selectedSide=b.dataset.v; render(); }));
  document.querySelectorAll('#familyChips .chip').forEach(b => b.addEventListener('click',()=>{ familyFilter=b.dataset.f; applyFilters(); }));
  $('submitBtn')?.addEventListener('click', submitRead);
  $('resetBtn')?.addEventListener('click', resetCard);
  $('revealBtn')?.addEventListener('click', reveal);
  $('nextBtn')?.addEventListener('click', nextCard);
  $('prevBtn')?.addEventListener('click', prevCard);
  $('randomBtn')?.addEventListener('click', randomCard);
  $('stepBtn')?.addEventListener('click', stepFwd);
  $('backBtn')?.addEventListener('click', stepBack);
  $('playBtn')?.addEventListener('click', togglePlay);
  $('jumpMapBtn')?.addEventListener('click',()=>jumpTo('06:34:00'));
  $('jumpCoreBtn')?.addEventListener('click',()=>jumpTo('07:20:00'));
  $('unplayedBtn')?.addEventListener('click',function(){this.dataset.on=this.dataset.on==='1'?'0':'1';this.classList.toggle('on',this.dataset.on==='1');applyFilters();});
  $('overlaysBtn')?.addEventListener('click',function(){showOverlays=!showOverlays;render();});
  $('hardBtn')?.addEventListener('click',()=>{ meta.hardMode=!meta.hardMode; saveMeta(); toast(meta.hardMode?'HARD MODE — overlays and checklist hidden, ×1.25 XP':'Hard mode off','amber'); render(); });
  $('statsBtn')?.addEventListener('click',()=>openModal('statsModal'));
  $('keysBtn')?.addEventListener('click',()=>openModal('keysModal'));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModals));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if(e.target === m) closeModals(); }));
  $('exportBtn')?.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({schema:'entry_game_v01_reps', exported_at:new Date().toISOString(), deck:deck?.version, labels, stats, meta},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='entry_game_v01_reps.json'; a.click();
    toast('Reps exported.','green');
  });
  $('executionChart')?.addEventListener('click',handleExecClick);
  $('executionChart')?.addEventListener('mousemove',handleExecHover);
  $('executionChart')?.addEventListener('mouseleave',()=>{ if(hoverExec){ hoverExec=null; drawExec(); } });
  $('note')?.addEventListener('input',()=>{
    const c=current(); if(!c) return;
    if(labels[c.card_id]){ labels[c.card_id].note=$('note').value||''; saveLabels(); }
  });

  document.addEventListener('keydown',e=>{
    if(['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName)) return;
    const k=e.key.toLowerCase();
    if(e.key==='Escape'){ closeModals(); return; }
    if(e.key==='?'){ openModal('keysModal'); return; }
    if(k===' '){ e.preventDefault(); togglePlay(); return; }
    if(k==='arrowright'){ stepFwd(); return; }
    if(k==='arrowleft'){ stepBack(); return; }
    if(e.key==='Enter'){
      e.preventDefault();
      const c=current();
      if(revealed || labels[c?.card_id]?.scored) nextRep(); else submitRead();
      return;
    }
    if(k==='l'){selectedSide='LONG';render();}
    if(k==='s'){selectedSide='SHORT';render();}
    if(k==='k'){selectedSide='SKIP';selectedSchema=selectedSchema||'SKIP';render();}
    if(k==='r') reveal();
    if(k==='g') randomCard();
    if(k==='h'){ $('hardBtn').click(); }
    if(k==='a'){selectedSchema='A1';render();}
    if(k==='2'){selectedSchema='A2';render();}
    if(k==='b'){selectedSchema='B';render();}
    if(k==='c'){selectedSchema='C';render();}
    if(k==='f'){selectedSchema='C-F';render();}
    if(k==='d'){selectedSchema='D2';render();}
    if(k==='n'){selectedSchema='NEW';render();}
  });
  let resizeTimer=null; window.addEventListener('resize',()=>{clearTimeout(resizeTimer); resizeTimer=setTimeout(draw,100);});
}

boot().catch(err => { console.error(err); document.body.innerHTML = `<pre style="color:#ff4d6b;padding:20px;font-family:monospace">Failed to load trainer: ${esc(err.message)}</pre>`; });
