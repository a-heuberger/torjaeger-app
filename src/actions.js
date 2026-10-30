/* ============ Aktionen: Eintragen, Torschuss, Karten, Feiern, Fenster, Einstellungen ============ */
const ACT = {};
const rid = () => Math.random().toString(36).slice(2, 7);
const taskById = id => S.cfg.tasks.find(t => t.id === id);

/* ---------- Meldungen ---------- */
let toastT = 0, bannerT = 0, celebT = 0, confirmFn = null;
function toast(msg, kind) {
  const h = $('#toast'); if (!h) return;
  clearTimeout(toastT);
  h.innerHTML = '<div class="toast' + (kind === 'warn' ? ' warn' : '') + '">' + esc(msg) + '</div>';
  toastT = setTimeout(() => { h.innerHTML = ''; }, 3300);
}
/* Einblendung wie im Fernsehen. title und sub müssen bereits mit esc() behandelt sein. */
function banner(o) {
  const h = $('#banner'); if (!h) return;
  clearTimeout(bannerT);
  const inner = '<span class="bn-i">' + (o.icon || '') + '</span><span class="bn-t"><b>' + o.title + '</b>' + (o.sub ? '<small>' + o.sub + '</small>' : '') + '</span>';
  /* Mit go (Name eines Tabs) lässt sich die Einblendung antippen und führt direkt dorthin. */
  h.innerHTML = o.go ? '<button class="bn go ' + (o.tone || '') + '" data-act="banner-go" data-tab="' + o.go + '" style="animation-duration:' + (o.ms || 3000) + 'ms">' + inner + '<span class="bn-arrow" aria-hidden="true">' + IC.chevR + '</span></button>'
    : '<div class="bn ' + (o.tone || '') + '" role="status" style="animation-duration:' + (o.ms || 3000) + 'ms">' + inner + '</div>';
  bannerT = setTimeout(() => { h.innerHTML = ''; }, o.ms || 3000);
}
ACT['banner-go'] = el => {
  clearTimeout(bannerT); const h = $('#banner'); if (h) h.innerHTML = '';
  U.tab = el.dataset.tab; window.scrollTo(0, 0); render();
};

/* ---------- Fenster ---------- */
function openSheet(html, cls) {
  const l = $('#layer'); if (!l) return;
  const bn = $('#banner'); if (bn) bn.innerHTML = '';
  l.innerHTML = '<div class="sheet-back" data-act="sheet-close"></div><div class="sheet' + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
  U.sheet = cls || 'x'; document.body.classList.add('noscroll');
  const f = $('.sheet [autofocus]'); if (f) setTimeout(() => f.focus(), 60);
}
const setSheet = html => { const s = $('.sheet'); if (s) s.innerHTML = html; };
function closeSheet() {
  const l = $('#layer'); if (l) l.innerHTML = '';
  U.sheet = null; U.ob = null; U.ex = null; U.kx = null; document.body.classList.remove('noscroll');
}
ACT['sheet-close'] = () => { if (U.sheet === 'onboard') return; closeSheet(); };
function confirmSheet(o, fn) {
  confirmFn = fn;
  openSheet('<h2>' + esc(o.title) + '</h2>' + (o.text ? '<p class="sub">' + esc(o.text) + '</p>' : '') +
    '<div class="row-btns"><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-lime') + '" data-act="confirm-yes">' + esc(o.ok || 'Ja') + '</button><button class="btn btn-ghost" data-act="sheet-close">Abbrechen</button></div>', 'confirm');
}
ACT['confirm-yes'] = () => { const f = confirmFn; confirmFn = null; closeSheet(); if (f) f(); };

/* ---------- Tag, Meilensteine, Feiern ---------- */
function ensureDay(ds) {
  const d = S.days[ds] || (S.days[ds] = {});
  if (!d.m) d.m = {};
  if (!d.ev) d.ev = [];
  return d;
}
const snap = ds => milestones(S, ds, U.today);
const savedDay = ds => persist('days/' + ds);

function afterMutation(ds, b) {
  const a = snap(ds), cel = S.prog.cel, q = [], gs = S.cfg.goals, last = gs[gs.length - 1];
  let dirty = false;
  /* Das Datum merkt sich, wann ein Ziel erreicht wurde („Geschafft am …“). Das letzte Ziel ist der große Fang. */
  const flag = (k, v) => { if (cel[k]) return false; cel[k] = v || 1; dirty = true; return true; };
  /* Ein Minus durch Karten kann ein Ziel wieder aus der Reichweite nehmen: Dann gilt es später erneut als erreicht und wird noch einmal gefeiert. */
  b.goals.filter(id => a.goals.indexOf(id) < 0).forEach(id => { if (cel['g:' + id]) { delete cel['g:' + id]; dirty = true; } });
  a.goals.filter(id => b.goals.indexOf(id) < 0).forEach(id => { if (flag('g:' + id, U.today)) q.push(last && id === last.id ? { type: 'fang' } : { type: 'goal', id }); });
  if (dirty) persist('cfg/progress');
  if (a.packs > b.packs) U.packNote = (U.packNote || 0) + (a.packs - b.packs);
  U.celebQ.push.apply(U.celebQ, q);
  scheduleCeleb(q.length || U.packNote ? 900 : 100);
}
function scheduleCeleb(ms) { clearTimeout(celebT); celebT = setTimeout(showNextCeleb, ms); }

function checkPerfect(ds) {
  const e = evalDay(S, ds);
  if (!e.perfect || pendingFor(ds).length || S.prog.cel['p:' + ds]) return false;
  S.prog.cel['p:' + ds] = 1; persist('cfg/progress');
  Snd.goal(); FX.party(['⚽', '⭐']); Hap.go([40, 40, 40, 40, 80]);
  banner({ icon: ballSVG(40), title: 'Weiße Weste!', sub: 'Perfekter Tag: alle Aufgaben geschafft.', tone: 'gold', ms: 3800 });
  return true;
}
function dayBanner(ds) {
  const e = evalDay(S, ds);
  if (!e.complete || e.perfect || e.off || pendingFor(ds).length) return;
  const key = e.gain + ':' + e.rival;
  if (U.dayBanner[ds] === key) return;
  U.dayBanner[ds] = key;
  const tx = { win: 'Sieg', draw: 'Unentschieden', loss: 'Rückspiel morgen' }[e.result];
  banner({ icon: ballSVG(34), title: 'Abpfiff ' + e.gain + ':' + e.rival + ' · ' + tx, sub: e.result === 'loss' ? 'Du kennst seine Tricks.' : '', tone: e.result === 'loss' ? '' : 'lime', ms: 3300 });
}
function finishRitual(ds) { if (!checkPerfect(ds)) dayBanner(ds); scheduleCeleb(900); }

/* ---------- Eintragen ---------- */
function setMark(ds, id, st) {
  if (!taskById(id)) return;
  const day = ensureDay(ds), cur = day.m[id] || null, next = cur === st ? null : st, b = snap(ds);
  if (next) day.m[id] = next; else delete day.m[id];
  U.shots = U.shots.filter(s => !(s.ds === ds && s.id === id));
  markChanged(); savedDay(ds);
  if (next === 'y') {
    if (S.cfg.shootMode !== false && ds === U.date) { U.shots.push({ ds, id }); Snd.tap(); render(); }
    else land({ ds, id });
  } else if (next === 'n') { Snd.soft(); Hap.go(10); U.fx = { task: id, st: 'n' }; render(); dayBanner(ds); }
  else { Snd.tap(); render(); }
  afterMutation(ds, b);
  if (next !== 'y') finishRitualSoon(ds);
}
const finishRitualSoon = ds => setTimeout(() => { if (!pendingFor(ds).length) finishRitual(ds); }, 200);

function land(s) {
  const ds = s.ds;
  U.fx = { task: s.id, st: 'y' }; U.pop = true;
  const e = evalDay(S, ds), left = pendingFor(ds).length, n = Math.max(1, Math.min(e.ok - left, e.gain));
  Snd.goal(); Hap.go([25, 35, 25]);
  const gb = $('#goalbox'); if (gb) { gb.classList.remove('rip'); void gb.offsetWidth; gb.classList.add('rip'); }
  banner({ icon: ballSVG(34), title: esc(ladderText(n, e.perfect && !left)), sub: n > 1 && !(e.perfect && !left) ? 'Tor Nummer ' + n + ' heute.' : '', tone: 'lime', ms: 2200 });
  render();
  const st = $('#app .task[data-task="' + s.id + '"] .stamp');
  if (st) { const r = st.getBoundingClientRect(); FX.pop(r.left + r.width / 2, r.top + r.height / 2, ['⚽']); }
  if (!left) finishRitual(ds);
}
ACT.mark = el => {
  if (!U.unlocked) return;
  setMark(U.date, el.dataset.task, el.dataset.st);
};
ACT['all-ok'] = () => {
  if (!U.unlocked) return;
  const ds = U.date, e = evalDay(S, ds), b = snap(ds), day = ensureDay(ds);
  let n = 0;
  e.items.forEach(it => { if (!it.t.bonus && !it.st) { day.m[it.t.id] = 'y'; n++; if (S.cfg.shootMode !== false) U.shots.push({ ds, id: it.t.id }); } });
  if (!n) return;
  markChanged(); savedDay(ds);
  if (S.cfg.shootMode === false) { Snd.goal(); U.pop = true; finishRitual(ds); }
  render(); afterMutation(ds, b);
};
ACT.off = () => {
  if (!U.unlocked) return;
  const ds = U.date, day = ensureDay(ds);
  day.off = !day.off; if (!day.off) delete day.joker;
  if (day.off) U.shots = U.shots.filter(s => s.ds !== ds);
  markChanged(); savedDay(ds); Snd.tap(); render();
};
ACT['rest-no'] = () => {
  if (!U.unlocked) return;
  const ds = U.date, e = evalDay(S, ds), b = snap(ds), day = ensureDay(ds);
  let n = 0;
  e.items.forEach(it => { if (!it.t.bonus && !it.st) { day.m[it.t.id] = 'n'; n++; } });
  if (!n) return;
  markChanged(); savedDay(ds); Snd.soft(); Hap.go(10); render();
  dayBanner(ds); afterMutation(ds, b); finishRitualSoon(ds);
  toast(n === 1 ? 'Eine Aufgabe als Kein Tor eingetragen.' : n + ' Aufgaben als Kein Tor eingetragen.');
};

/* ---------- Torschuss: Ball, Tor, Salve ---------- */
function flyBall(fromEl, toEl, ms) {
  return new Promise(res => {
    if (!fromEl || !toEl || stillMotion() || typeof fromEl.getBoundingClientRect !== 'function' || !document.body.animate) return res();
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const x0 = a.left + a.width / 2 - 20, y0 = a.top + a.height / 2 - 20, x1 = b.left + b.width / 2 - 20, y1 = b.top + b.height * .55 - 20;
    const el = document.createElement('div'); el.className = 'flyball'; el.innerHTML = ballSVG(40); document.body.appendChild(el);
    const an = el.animate([
      { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1) rotate(0deg)' },
      { transform: 'translate(' + (x0 + (x1 - x0) * .55) + 'px,' + (Math.min(y0, y1) - 40) + 'px) scale(.85) rotate(280deg)', offset: .55 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.5) rotate(560deg)' },
    ], { duration: ms, easing: 'cubic-bezier(.3,.1,.4,1)', fill: 'forwards' });
    const done = () => { el.remove(); res(); };
    an.onfinish = done; an.oncancel = done;
  });
}
async function shootOne(quick) {
  if (!U.shots.length || U.shooting) return;
  U.shooting = true;
  try {
    Snd.kick(); Hap.go(15);
    await flyBall($('.shotbtn .ball'), $('#goalbox'), quick ? 320 : 520);
    const s = U.shots.shift();
    if (s) land(s);
  } finally { U.shooting = false; }
}
async function volley() {
  if (U.volley) return;
  U.volley = true;
  try { while (U.shots.length) { await shootOne(true); await sleep(130); } } finally { U.volley = false; }
}
ACT.shoot = () => { if (U.suppressClick) { U.suppressClick = false; return; } shootOne(false); };
ACT['shoot-skip'] = () => {
  const days = Array.from(new Set(U.shots.map(s => s.ds)));
  U.shots = []; render(); days.forEach(finishRitual);
};

/* ---------- Extras, Karten, Fair Play ---------- */
function addEvent(ds, ev) {
  const d = ensureDay(ds);
  ev.id = 'e' + Date.now().toString(36) + rid(); ev.ts = Date.now();
  d.ev.push(ev);
}
const EX_TITLE = { '+': 'Eigener Grund', n: 'Eigener Grund', y: 'Gelbe Karte', r: 'Rote Karte' };
const EX_OK = { '+': 'Tor eintragen', n: 'Kein Tor eintragen', y: 'Verwarnung eintragen', r: 'Rote Karte eintragen' };
/* Karten-Fenster: kurz, mit vorbereitetem Knopf „Verwarnung eintragen“. Ein Grund ist freiwillig und hat keine Vorschläge. */
function exHTML() {
  const x = U.ex, c = S.cfg, k = x.k, e = evalDay(S, U.date), st = ST();
  const gy = c.yellowPts ? 'Minus ' + tore(c.yellowPts) + ' bei den Zielen.' : 'Dafür gibt es kein Minus.';
  const free = k === '+' || k === 'n';
  const sub = {
    '+': 'Frei eingeben, wofür es ein Tor gibt.',
    n: 'Frei eingeben, wofür es kein Tor gibt. Der Gegner bekommt ' + tore(x.v) + '.',
    y: st.account.count > 0 ? 'Das ist die zweite Gelbe: Sie ergibt automatisch Rot. Minus zusammen ' + tore(c.yellowPts + (e.red ? 0 : c.redPts)) + ' bei den Zielen.' : gy + ' Eine zweite Gelbe ergibt automatisch Rot.',
    r: 'Minus ' + tore(c.redPts) + ' bei den Zielen' + (e.red ? ' (heute gab es schon Rot, kein weiteres Minus)' : '') + '. In der Übersicht bleiben alle Tore stehen.',
  }[k];
  const left = Math.max(0, c.extraMax - e.plus);
  let h = '<h2' + (k === 'y' || k === 'r' ? ' class="h-card">' + cardSVG(k === 'y' ? 'yellow' : 'red', 34) : '>') + EX_TITLE[k] + '</h2><p class="sub">' + sub + '</p>';
  if (free) h += '<div class="seg two" role="group" aria-label="Tor oder Kein Tor"><button class="b-y" data-act="ex-kind" data-k="+" aria-pressed="' + (k === '+') + '">' + IC.check + '<span>Tor</span></button><button class="b-n" data-act="ex-kind" data-k="n" aria-pressed="' + (k === 'n') + '">' + IC.cross + '<span>Kein Tor</span></button></div>';
  if (k === '+' && c.goodReasons.length) h += '<div class="chips-r" role="group" aria-label="Schnellauswahl">' + c.goodReasons.map((t, i) => '<button data-act="ex-chip" data-i="' + i + '" aria-pressed="' + (x.t === t) + '">' + esc(t) + '</button>').join('') + '</div>';
  h += '<div class="field"><span>' + (free ? 'Wofür?' : 'Grund (freiwillig)') + '</span><input type="text" id="ex-text" data-ex="t" value="' + esc(x.t) + '" maxlength="90" autocomplete="off" placeholder="' + (free ? 'z. B. Hund ausgeführt' : 'Kein Grund nötig') + '"></div>';
  if (free) h += '<div class="field"><span>' + (k === '+' ? 'Wie viele Tore? (heute noch ' + left + ' möglich)' : 'Wie viele Tore bekommt der Gegner?') + '</span><div class="vals">' + [1, 2, 3].map(v => '<button data-act="ex-val" data-v="' + v + '" aria-pressed="' + (x.v === v) + '"' + (k === '+' && v > left ? ' disabled' : '') + '>+' + v + '</button>').join('') + '</div></div>';
  h += '<div class="row-btns"><button class="btn btn-lime" data-act="ex-save">' + EX_OK[k] + '</button><button class="btn btn-ghost" data-act="sheet-close">Abbrechen</button></div>';
  return h;
}
ACT['extra-open'] = el => {
  if (!U.unlocked) return;
  const k = el.dataset.k;
  if ((k === 'y' || k === 'r') && !S.cfg.cardsAck) { ACT['cards-unlock'](); return; }
  if ((k === 'y' || k === 'r') && U.date !== U.today) { toast('Karten gibt es nur am Spieltag selbst.'); return; }
  U.ex = { k, v: 1, t: '' };
  openSheet(exHTML(), 'sheet-ex');
};
ACT['ex-chip'] = el => {
  if (U.ex.k !== '+') return;
  U.ex.t = S.cfg.goodReasons[+el.dataset.i] || ''; setSheet(exHTML());
};
ACT['ex-val'] = el => { U.ex.v = +el.dataset.v; setSheet(exHTML()); };
ACT['ex-kind'] = el => {
  const x = U.ex; if (!x || (x.k !== '+' && x.k !== 'n')) return;
  x.k = el.dataset.k === 'n' ? 'n' : '+';
  if (x.k === '+') { const e = evalDay(S, U.date), left = Math.max(0, S.cfg.extraMax - e.plus); if (x.v > left) x.v = Math.max(1, left); }
  setSheet(exHTML());
};
ACT['ex-save'] = () => {
  const x = U.ex, ds = U.date, k = x.k, c = S.cfg, reason = (x.t || '').trim();
  const b = snap(ds), e0 = evalDay(S, ds);
  if (k === '+') {
    const left = Math.max(0, c.extraMax - e0.plus);
    if (left <= 0) { toast('Heute sind höchstens ' + c.extraMax + ' eigene Tor-Gründe möglich.'); return; }
    addEvent(ds, { k: '+', v: Math.min(x.v, left), t: reason || 'Eigener Grund' });
  } else if (k === 'n') addEvent(ds, { k: 'n', v: x.v, t: reason || 'Kein Tor' });
  else addEvent(ds, reason ? { k, t: reason } : { k });
  markChanged(); savedDay(ds);
  closeSheet();
  const e1 = evalDay(S, ds), newRed = e1.red - e0.red;
  const dot = s => (/[.!?]$/.test(s) ? s : s + '.');
  const gained = e1.minus - e0.minus, why = reason ? esc(dot(reason)) + ' ' : '';
  if (k === '+') { Snd.goal(); FX.pop(innerWidth / 2, innerHeight / 2, ['⚽']); banner({ icon: ballSVG(34), title: 'Tor: ' + esc(reason || 'gut gemacht'), sub: '', tone: 'lime', ms: 3200 }); }
  else if (k === 'n') { Snd.soft(); Hap.go(10); banner({ icon: IC.cross, title: 'Kein Tor: ' + esc(reason || 'eigener Grund'), sub: 'Der Gegner bekommt ' + tore(x.v) + '.', tone: '', ms: 3200 }); }
  else if (newRed > 0) {
    const auto = e1.entries.some(en => en.auto) && !e0.entries.some(en => en.auto);
    banner({ icon: cardSVG('red', 40), title: auto ? 'Zweite Gelbe: Rot!' : 'Rote Karte', sub: why + (gained > 0 ? 'Minus ' + tore(gained) + '.' : 'Heute gab es schon Rot, kein weiteres Minus.'), tone: 'red', ms: 4200 });
  } else banner({ icon: cardSVG('yellow', 40), title: 'Gelbe Karte', sub: why + (gained > 0 ? 'Minus ' + tore(gained) + '. ' : '') + 'Eine zweite Gelbe ergibt Rot.', tone: 'yellow', ms: 3800 });
  render(); afterMutation(ds, b);
};
ACT['ev-del'] = el => {
  if (!U.unlocked) return;
  const ds = U.date, d = S.days[ds]; if (!d) return;
  const b = snap(ds);
  d.ev = (d.ev || []).filter(x => x.id !== el.dataset.id);
  markChanged(); savedDay(ds); render(); afterMutation(ds, b);
};
/* Nur der Trainer zieht eine Karte zurück (mit Rückfrage). Beim automatischen Rot fällt die zweite Gelbe weg, die es ausgelöst hat. */
ACT['card-back'] = el => {
  if (!U.unlocked) return;
  const ds = el.dataset.ds || U.date, id = el.dataset.id, d = S.days[ds];
  const en = d && (d.ev || []).find(x => x.id === id); if (!en) return;
  const yellow = en.k === 'y';
  confirmSheet({ title: 'Karte zurückziehen?', text: 'Die ' + (yellow ? 'Gelbe' : 'Rote') + ' Karte' + (en.t ? ' („' + en.t + '“)' : '') + ' wird gelöscht. Was daraus folgt, rechnet sich neu, auch ein automatisches Rot.', ok: 'Zurückziehen' }, () => {
    const b = snap(ds);
    d.ev = (d.ev || []).filter(x => x.id !== id);
    markChanged(); savedDay(ds); render(); afterMutation(ds, b); toast('Karte zurückgezogen.');
  });
};

/* ---------- Ziele, Belohnungen, Saison ---------- */
ACT.pick = el => {
  if (U.readonly) return;
  S.prog.pick[el.dataset.key] = +el.dataset.i; markChanged(); persist('cfg/progress'); Snd.tap(); render();
};
ACT.redeem = el => {
  if (!U.unlocked) return;
  const k = el.dataset.key, g = S.cfg.goals.find(x => x.id === k); if (!g) return;
  S.prog.redK = S.prog.redK || {};
  if (S.prog.red[k]) {                                                // zurücknehmen: eine Konto-Gutschrift dazu wird wieder entfernt
    delete S.prog.red[k];
    const kid = S.prog.redK[k]; delete S.prog.redK[k];
    if (kid && S.konto[kid]) { delete S.konto[kid]; persist('konto/' + kid); toast('Zurückgenommen. Die Gutschrift auf dem Konto wurde entfernt.'); }
  } else {
    S.prog.red[k] = U.today;
    const cents = rewardMoney(g.reward);                              // „5 € aufs Guthabenkonto“ wird gleich gebucht, damit es nicht vergessen wird
    if (cents > 0) {
      const ts = Date.now(), id = 'k' + ts.toString(36) + rid();
      S.konto[id] = { ts, ds: U.today, c: cents, k: 'plus', t: ('Ziel: ' + tore(g.at)).slice(0, 40) };
      S.prog.redK[k] = id; persist('konto/' + id);
      toast(fmtEUR(cents) + ' wurden dem Konto gutgeschrieben.');
    }
  }
  markChanged(); persist('cfg/progress'); render();
};
ACT['goal-add'] = () => {
  if (!U.unlocked) return;
  const gs = S.cfg.goals, last = gs[gs.length - 1], at = (last ? last.at : 0) + 100;
  gs.push({ id: 'g' + at + rid(), at, reward: '' }); markChanged(); persist('cfg/main'); render();
};
ACT['goal-del'] = el => {
  if (!U.unlocked) return;
  const g = S.cfg.goals.find(x => x.id === el.dataset.id); if (!g || S.cfg.goals.length < 2) return;
  confirmSheet({ title: 'Ziel entfernen?', text: tore(g.at) + ': ' + (String(g.reward || '').trim() || 'noch nichts festgelegt') + '. Das Ziel verschwindet aus der Liste.', ok: 'Entfernen', danger: true }, () => {
    S.cfg.goals = S.cfg.goals.filter(x => x.id !== g.id); markChanged(); persist('cfg/main'); render();
  });
};

/* ---------- Feiern (Vollbild) ---------- */
const celCard = (emblem, eyebrow, title, sub, extra, cls) =>
  '<div class="celeb ' + (cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="rays"></div><div class="ce-card"><div class="emblem">' + emblem + '</div>' +
  '<div class="ce-eyebrow">' + eyebrow + '</div><h2 class="ce-title">' + title + '</h2>' + (sub ? '<p class="ce-sub">' + sub + '</p>' : '') + (extra || '') +
  '<button class="btn btn-lime" data-act="celeb-next">Weiter</button></div></div>';
const rewardBox = txt => '<div class="ce-reward"><span class="gift" aria-hidden="true">🎁</span><div><b>Deine Belohnung</b><span>' + esc(String(txt || '').trim() || 'Wird später festgelegt') + '</span></div></div>';

function showNextCeleb() {
  if (U.celeb || U.pack || U.shots.length || U.sheet) { if (!U.celeb && !U.pack && (U.celebQ.length || U.packNote)) scheduleCeleb(800); return; }
  const it = U.celebQ.shift();
  if (!it) {
    if (U.packNote) {
      const bn0 = $('#banner');
      if (bn0 && bn0.firstElementChild && !bn0.querySelector('.go')) { scheduleCeleb(1200); return; }     // erst ausklingen lassen, was gerade eingeblendet ist (z. B. „Weiße Weste!“)
      const n = U.packNote; U.packNote = 0;
      banner({ icon: packSVG(46), title: n === 1 ? 'Neue Tüte!' : n + ' neue Tüten!', sub: 'Tippe hier, um sie bei den Erfolgen zu öffnen.', tone: 'blue', ms: 7000, go: 'achieve' });
      Snd.sparkle && Snd.sparkle();
    }
    return;
  }
  U.celeb = it;
  const bn = $('#banner'); if (bn) bn.innerHTML = '';
  const c = $('#celeb'); if (!c) return;
  const name = esc(S.cfg.name);
  let html;
  if (it.type === 'goal') {
    const g = goalList(S, ST()).find(x => x.id === it.id);
    if (!g || !g.reached) { U.celeb = null; scheduleCeleb(100); return; }          // inzwischen durch ein Minus wieder verfehlt: nicht feiern
    html = celCard(trophySVG(g.tier, 150), 'Ziel erreicht', tore(g.at).toUpperCase() + '!', 'Stark, ' + name + '!', rewardBox(g.reward));
  } else if (it.type === 'fang') {
    if (!ST().caught) { U.celeb = null; scheduleCeleb(100); return; }
    const lg = S.cfg.goals[S.cfg.goals.length - 1];
    html = celCard(fishSVG(220), 'Der große Fang', 'PETRI HEIL!', 'Geschafft: ' + esc(S.cfg.season.title) + ' ist an Land. Das war richtig stark, ' + name + '!', rewardBox(lg && lg.reward));
  } else { U.celeb = null; return; }
  c.innerHTML = html;
  document.body.classList.add('noscroll');
  Snd.fanfare(); FX.party(it.type === 'fang' ? ['🐟', '🎣', '⭐'] : ['🏆', '⭐', '⚽']); Hap.go([40, 40, 40, 40, 90]);
}
function closeCeleb() {
  const c = $('#celeb'); if (c) c.innerHTML = '';
  U.celeb = null; U.pack = null; FX.clear();
  if (!U.sheet) document.body.classList.remove('noscroll');
}
ACT['celeb-next'] = () => { closeCeleb(); scheduleCeleb(300); };

/* ---------- Sticker-Tüten ---------- */
const stickerBig = (s, got, foil, extra) => '<div class="sticker big r-' + s.rar + ' ' + (got ? 'got' : 'lock') + (foil ? ' foil' : '') + (extra ? ' ' + extra : '') + '"><div class="in"><span class="no">Nr. ' + s.id.slice(1) + ' · ' + s.cat + '</span><span class="em">' + s.ico + '</span><span class="nm2">' + (got ? esc(s.name) : '???') + '</span></div>' + (got ? '<span class="pt" aria-hidden="true">' + RARITY[s.rar].pts + '</span>' : '') + '</div>';
function paintPack() {
  const c = $('#celeb'), p = U.pack; if (!c || !p) return;
  if (p.phase === 'closed' || p.phase === 'tearing') {
    c.innerHTML = '<div class="celeb pack" role="dialog" aria-modal="true" aria-label="Sticker-Tüte"><div class="rays"></div><div class="ce-card"><div class="ce-eyebrow">Sticker-Tüte</div>' +
      '<button class="packbtn' + (p.phase === 'tearing' ? ' tearing' : '') + '" data-act="pack-tear" aria-label="Tüte aufreißen">' + packSVG(230) + '</button>' +
      '<h2 class="ce-title small">' + (p.phase === 'tearing' ? '…' : 'Aufreißen!') + '</h2><p class="ce-sub">Tippe auf die Tüte.</p>' +
      '<button class="btn btn-ghost btn-sm" data-act="pack-close">Später</button></div></div>';
  } else {
    const st = ST(), s = p.sticker, R = RARITY[s.rar], foilKind = p.kind === 'foil';
    const eyebrow = foilKind ? 'Glanz-Version!' : s.rar === 'u' ? 'Ultraselten!' : s.rar === 'r' ? 'Selten!' : 'Neu im Album!';
    c.innerHTML = '<div class="celeb pack open r-' + s.rar + '" role="dialog" aria-modal="true" aria-label="Neuer Sticker"><div class="rays"></div><div class="ce-card"><div class="ce-eyebrow">' + eyebrow + '</div>' +
      '<div class="emblem">' + stickerBig(s, true, foilKind, 'pop') + '</div><h2 class="ce-title small">' + esc(s.name) + '</h2>' +
      '<p class="ce-sub">' + (foilKind ? 'Dein Sticker glänzt jetzt.' : 'Sticker ' + (S.prog.album.length) + ' von ' + STICKERS.length + ' · ' + R.name + ' · ' + punkte(R.pts)) + '</p>' + (factOf(s) ? '<p class="ce-sub fact">' + esc(factOf(s)) + '</p>' : '') +
      (foilKind ? '' : '<p class="ce-sub sp-line">' + (p.bonusNew > 0 ? '<b class="bonus">⚽ Bonus-Tor!</b> ' : '') + 'Sticker-Punkte: <b>' + st.stickers.pts + '</b>' + (st.packs.complete ? '' : ' · noch ' + punkte(st.stickers.toNext) + ' bis zum nächsten Bonus-Tor') + '</p>') +
      '<div class="row-btns">' + (st.packs.left > 0 ? '<button class="btn btn-lime" data-act="pack-again">Nächste Tüte (' + st.packs.left + ')</button>' : '') + '<button class="btn ' + (st.packs.left > 0 ? 'btn-ghost' : 'btn-lime') + '" data-act="pack-close">Ins Album</button></div></div></div>';
  }
}
ACT['pack-open'] = () => {
  if (U.readonly || ST().packs.left <= 0) return;
  U.pack = { phase: 'closed' }; document.body.classList.add('noscroll'); paintPack(); Snd.tap();
};
ACT['pack-again'] = () => { if (ST().packs.left > 0) { U.pack = { phase: 'closed' }; paintPack(); } else ACT['pack-close'](); };
ACT['pack-close'] = () => { closeCeleb(); render(); scheduleCeleb(300); };
ACT['pack-tear'] = () => {
  const p = U.pack; if (!p || p.phase !== 'closed') return;
  const album = S.prog.album, foil = S.prog.foil;
  const fresh = STICKERS.filter(s => album.indexOf(s.id) < 0), noFoil = STICKERS.filter(s => foil.indexOf(s.id) < 0);
  if (!fresh.length && !noFoil.length) return;
  const b = snap(U.today), bonus0 = stickerBonus(S.prog);
  const s = pickSticker(fresh.length ? fresh : noFoil), kind = fresh.length ? 'new' : 'foil';
  if (kind === 'new') album.push(s.id); else foil.push(s.id);
  U.newSticker = s.id; markChanged(); persist('cfg/progress');
  p.bonusNew = stickerBonus(S.prog) - bonus0;
  afterMutation(U.today, b);                        // Bonus-Tore können ein Ziel erreichen; die Feier kommt, sobald die Tüte zu ist
  p.phase = 'tearing'; paintPack(); Snd.pack(); Hap.go([20, 30, 20, 30, 60]);
  setTimeout(() => { if (U.pack !== p) return; p.phase = 'opened'; p.sticker = s; p.kind = kind; paintPack(); FX.party(['⚽', '⭐']); Snd.sparkle && Snd.sparkle(); }, stillMotion() ? 50 : 900);
};
ACT.sticker = el => {
  const s = STICKERS.find(x => x.id === el.dataset.id); if (!s) return;
  const got = (S.prog.album || []).indexOf(s.id) >= 0, foil = (S.prog.foil || []).indexOf(s.id) >= 0, R = RARITY[s.rar];
  openSheet('<h2>' + (got ? esc(s.name) : 'Noch nicht gefunden') + '</h2><div class="stbig-wrap">' + stickerBig(s, got, foil) + '</div><p class="sub">' + (got ? s.cat + ' · ' + R.name + ' · ' + punkte(R.pts) + (foil ? ' · Glanz-Version' : '') : R.name + ' · ' + punkte(R.pts) + '. Alle ' + S.cfg.packEvery + ' Tore gibt es eine Sticker-Tüte.') + '</p>' + (got && factOf(s) ? '<p class="sub fact">' + esc(factOf(s)) + '</p>' : '') + '<button class="btn btn-ghost" data-act="sheet-close">Schließen</button>', 'sheet-st');
};

/* ---------- Konto: Gutschreiben, Abbuchen, Auszahlen ---------- */
const KX_TITLE = { note: 'Note gutschreiben', plus: 'Gutschreiben', minus: 'Abbuchen', pay: 'Auszahlen' };
const KX_CHIPS = { note: ['Mathe', 'Deutsch', 'Sachkunde', 'Englisch'], plus: ['Geschenk', 'Extra-Arbeit'], minus: ['Eis', 'Süßigkeiten', 'Kleinigkeit', 'Spielzeug'], pay: [] };
const KX_AMOUNTS = [50, 100, 200, 500, 1000];
function kxAfter() {
  const x = U.kx; if (!x) return '';
  const c = parseMoney(x.amt), bal = kontoBalance(S);
  if (c == null) return x.k === 'note' && x.g && !(+S.cfg.noteMoney[x.g]) && !String(x.amt || '').trim() ? 'Für diese Note ist kein Geld eingestellt. Du kannst trotzdem einen Betrag eintragen.' : 'Bitte einen Betrag eintragen, zum Beispiel 2,50.';
  const after = x.k === 'note' || x.k === 'plus' ? bal + c : bal - c;
  return after < 0 ? 'Das Guthaben reicht nicht: Es sind nur ' + fmtEUR(bal) + ' auf dem Konto.' : 'Danach auf dem Konto: ' + fmtEUR(after);
}
function kontoSheetHTML() {
  const x = U.kx, c = S.cfg, k = x.k, nm = esc(c.name);
  const sub = {
    note: nm + ' bekommt Geld für eine gute Note. Den Betrag kannst du ändern.',
    plus: 'Für ein Geschenk oder eine vereinbarte Extra-Arbeit. Taschengeld bleibt unabhängig von Noten.',
    minus: 'Du hast etwas für ' + nm + ' ausgelegt. Der Betrag wird vom Konto abgebucht.',
    pay: 'Du zahlst Geld aus. Der Betrag wird vom Konto abgebucht.',
  }[k];
  let h = '<h2>' + KX_TITLE[k] + '</h2><p class="sub">' + sub + '</p>';
  if (k === 'note') {
    const gs = [1, 2, 3, 4, 5, 6].filter(g => (+c.noteMoney[g] || 0) > 0);
    h += gs.length ? '<div class="vals grades" role="group" aria-label="Note">' + gs.map(g => '<button data-act="kx-grade" data-g="' + g + '" aria-pressed="' + (x.g === g) + '" aria-label="Note ' + g + ', ' + esc(fmtEUR(c.noteMoney[g])) + '"><b>' + g + '</b><small>' + fmtEUR(c.noteMoney[g]) + '</small></button>').join('') + '</div>'
      : '<p class="hint">Für keine Note ist ein Betrag eingestellt. Das änderst du im Tab Trainer unter Konto.</p>';
  }
  h += '<div class="field"><span>Betrag in Euro</span><input type="text" inputmode="decimal" id="kx-amt" data-kx="amt" value="' + esc(x.amt) + '" maxlength="8" autocomplete="off" placeholder="z. B. 2,50"></div>';
  if (k === 'plus' || k === 'minus') h += '<div class="chips-r" role="group" aria-label="Schnellauswahl Betrag">' + KX_AMOUNTS.map(v => '<button data-act="kx-amt" data-c="' + v + '">' + fmtEUR(v) + '</button>').join('') + '</div>';
  h += '<div class="field"><span>' + (k === 'note' ? 'Fach oder Notiz (optional)' : k === 'pay' ? 'Notiz (optional)' : 'Wofür?') + '</span><input type="text" id="kx-text" data-kx="t" value="' + esc(x.t) + '" maxlength="40" autocomplete="off"></div>';
  if (KX_CHIPS[k].length) h += '<div class="chips-r" role="group" aria-label="Schnellauswahl">' + KX_CHIPS[k].map(t => '<button data-act="kx-chip" data-t="' + esc(t) + '" aria-pressed="' + (x.t === t) + '">' + esc(t) + '</button>').join('') + '</div>';
  if (k === 'minus') h += switchRow('kx-ok', x.ok, nm + ' hat dazu Ja gesagt', 'Abgebucht wird nur, was ' + nm + ' sich selbst wünscht, nie etwas, das ihr ohnehin zahlt.');
  h += '<p class="hint" id="kx-after">' + esc(kxAfter()) + '</p>';
  h += '<div class="row-btns"><button class="btn btn-lime" data-act="kx-save">' + ({ note: 'Gutschreiben', plus: 'Gutschreiben', minus: 'Abbuchen', pay: 'Auszahlen' }[k]) + '</button><button class="btn btn-ghost" data-act="sheet-close">Abbrechen</button></div>';
  return h;
}
ACT['konto-open'] = el => {
  if (!U.unlocked || U.readonly) return;
  const k = el.dataset.k, bal = kontoBalance(S);
  if ((k === 'minus' || k === 'pay') && bal <= 0) { toast('Auf dem Konto ist nichts, das sich abbuchen lässt.'); return; }
  U.kx = { k, g: 0, amt: k === 'pay' ? fmtPlain(bal) : '', t: k === 'pay' ? 'Ausgezahlt' : '', ok: false };
  openSheet(kontoSheetHTML(), 'sheet-konto');
};
ACT['kx-grade'] = el => { const g = +el.dataset.g; U.kx.g = g; U.kx.amt = fmtPlain(S.cfg.noteMoney[g] || 0); setSheet(kontoSheetHTML()); };
ACT['kx-amt'] = el => { U.kx.amt = fmtPlain(+el.dataset.c); setSheet(kontoSheetHTML()); };
ACT['kx-ok'] = () => { U.kx.ok = !U.kx.ok; setSheet(kontoSheetHTML()); };
ACT['kx-chip'] = el => { U.kx.t = U.kx.t === el.dataset.t ? '' : el.dataset.t; setSheet(kontoSheetHTML()); };
ACT['kx-save'] = () => {
  const x = U.kx; if (!x || !U.unlocked || U.readonly) return;
  const c = parseMoney(x.amt), bal = kontoBalance(S), k = x.k;
  if (k === 'note' && !x.g) { toast('Bitte zuerst die Note wählen.'); return; }
  if (c == null) { toast('Bitte einen Betrag über 0 eintragen, zum Beispiel 2,50.'); return; }
  if (k === 'minus' && !x.ok) { toast('Bitte bestätigen: ' + S.cfg.name + ' hat dazu Ja gesagt.'); return; }
  if ((k === 'minus' || k === 'pay') && c > bal) { toast('Das Guthaben reicht nicht: Es sind nur ' + fmtEUR(bal) + ' auf dem Konto.', 'warn'); return; }
  const ts = Date.now(), id = 'k' + ts.toString(36) + rid(), t = (x.t || '').trim().slice(0, 40), credit = k === 'note' || k === 'plus';
  const en = { ts, ds: U.today, c: credit ? c : -c, k };
  if (t) en.t = t;
  if (k === 'note') en.g = x.g;
  S.konto[id] = en; markChanged(); persist('konto/' + id);
  closeSheet(); render();
  const now = kontoBalance(S), what = kontoTitle(en);
  if (credit) { Snd.goal(); FX.pop(innerWidth / 2, innerHeight / 2, ['💶', '⭐']); }
  else Snd.soft && Snd.soft();
  banner({ icon: IC.coin, title: esc((credit ? '+' : '−') + fmtEUR(c) + (credit ? ' gutgeschrieben' : k === 'pay' ? ' ausgezahlt' : ' abgebucht')), sub: esc(what) + ' · Guthaben jetzt ' + esc(fmtEUR(now)), tone: credit ? 'lime' : '', ms: 3600 });
};
ACT['konto-del'] = el => {
  if (!U.unlocked || U.readonly) return;
  const id = el.dataset.id, en = S.konto[id]; if (!en) return;
  confirmSheet({ title: 'Buchung löschen?', text: kontoTitle(en) + ' (' + (en.c < 0 ? '−' : '+') + fmtEUR(Math.abs(en.c)) + '). Das Guthaben ändert sich entsprechend.', ok: 'Löschen', danger: true }, () => {
    delete S.konto[id]; markChanged(); persist('konto/' + id); render(); toast('Buchung gelöscht.');
  });
};

/* ---------- Regelbuch und Hinweise für Eltern ---------- */
function rulesHTML() {
  const c = S.cfg, gy = c.yellowPts ? 'Minus ' + tore(c.yellowPts) + '.' : 'Dafür gibt es kein Minus.';
  return '<h2>Regelbuch</h2><p class="sub">So wird gespielt.</p>' +
    '<div class="rb"><h3>Tore</h3><ul class="rb-list">' + c.tasks.filter(t => !(t.until && t.until <= U.today)).map(t => '<li><b>' + esc(t.icon) + ' ' + esc(t.title) + '</b>' + (taskSub(c, t) ? ': ' + esc(taskSub(c, t)) : '') + (t.bonus ? ' (Bonus, +' + t.pts + ')' : '') + '</li>').join('') + '</ul>' +
    '<p><b>Tor</b> für jede geschaffte Aufgabe. <b>Kein Tor</b>, wenn es nicht geklappt hat: Dann bekommt der Gegner ein Tor.</p>' +
    '<p><b>Eigener Grund:</b> Der Trainer kann frei eintragen, wofür es ein Tor oder kein Tor gibt (Tore höchstens ' + c.extraMax + ' am Tag).</p>' +
    '<h3>' + cardSVG('yellow', 20) + ' Gelbe Karte</h3><p>Eine Verwarnung. ' + gy + ' Gelbe Karten verfallen nie. <b>Zwei Gelbe ergeben automatisch Rot.</b></p>' +
    '<h3>' + cardSVG('red', 20) + ' Rote Karte</h3><p>Minus ' + tore(c.redPts) + ', höchstens einmal am Tag. Karten entscheidet der Trainer allein, und er kann sie zurückziehen.</p>' +
    '<h3>Minus</h3><p>Das Minus von Karten wird bei den Zielen und beim großen Fang abgezogen. In der Übersicht siehst du immer alle deine Tore. Bei den Erfolgen steht, was davon abgeht und was für die Ziele zählt.</p>' +
    '<h3>Ziele</h3><p>Alle deine Tore zählen zusammen, abzüglich Minus. Bei den Erfolgen siehst du, was du bei welchem Stand bekommst und wie viele Tore noch fehlen. Beim letzten Ziel ist der große Fang an Land. Eine Belohnung, die du schon eingelöst hast, bleibt deine.</p>' +
    '<h3>Sticker</h3><p>Alle ' + c.packEvery + ' Tore gibt es eine Sticker-Tüte. Normale Sticker zählen 1 Punkt, seltene 2 und ultraseltene 5. Je ' + PTS_PER_TOR + ' Punkte ergeben 1 Tor.</p>' +
    '<h3>Dein Konto</h3><p>Für gute Noten wird dir Geld gutgeschrieben. Abgezogen wird nur, wenn du dir etwas wünschst oder Geld ausgezahlt haben willst, mit deinem Ja. Nie als Strafe. Du siehst jederzeit, wie viel dir zusteht.</p>' +
    '<p>Wir haben dich lieb, egal wie das Spiel ausgeht.</p></div>' +
    '<button class="btn btn-ghost btn-block" data-act="sheet-close">Schließen</button>';
}
ACT.rules = () => openSheet(rulesHTML(), 'sheet-rules');
function parentsHTML() {
  const c = S.cfg, nm = esc(c.name);
  return '<h2>Hinweise für Eltern</h2><p class="sub">Karten wirken nur, wenn ' + nm + ' sie fair findet. Kurz lesen, dann geht es los.</p><ol class="rb-ol">' +
    '<li><b>Vorher gemeinsam:</b> Lest zusammen das Regelbuch. ' + nm + ' sucht sich den Gegnernamen und seine Belohnungen mit aus.</li>' +
    '<li><b>Ruhig und abends:</b> Karten nie im Streit und nie im Bett. Beginnt mit dem Besten, dann kommt die Karte.</li>' +
    '<li><b>Rot nur für klare Fälle.</b> Nie für Noten, Leistung oder Gefühle wie Weinen und Wut.</li>' +
    '<li><b>Eingelöstes nie zurücknehmen.</b> Das Minus von Karten wirkt auf den Weg zum nächsten Ziel, eine schon erhaltene Belohnung bleibt. Belohnungen innerhalb von 7 Tagen einlösen. Essen, Schlaf, Verein und Verabredungen sind nie Belohnung und nie Entzug.</li>' +
    '<li><b>Geld auf dem Konto ist Anerkennung, keine Bedingung:</b> nicht vorab anbieten, nicht verhandeln, nie zurücknehmen, nie als Druck. Abgebucht wird nur mit ' + esc(genitive(c.name)) + ' Ja. Lobt zuerst die Mühe.</li>' +
    '<li><b>Warnzeichen:</b> Bauchweh, „Ich bin eh der Böse“, mehr Verheimlichen, Rückzug. Dann Karten pausieren, reden und bei Sorgen Beratung suchen.</li></ol>' +
    (c.cardsAck ? '<button class="btn btn-ghost btn-block" data-act="sheet-close">Schließen</button>'
      : '<button class="btn btn-lime btn-block sticky-act" data-act="cards-ack">Gelesen: Karten freischalten</button><button class="btn btn-ghost btn-block" data-act="sheet-close">Später</button>');
}
ACT.parents = () => openSheet(parentsHTML(), 'sheet-rules');
ACT['cards-unlock'] = () => { if (!U.unlocked) return; openSheet(parentsHTML(), 'sheet-rules'); };
ACT['cards-ack'] = () => { S.cfg.cardsAck = true; markChanged(); persist('cfg/main'); closeSheet(); render(); toast('Karten sind freigeschaltet.'); };

/* ---------- Trainer-Modus und Code ---------- */
async function hashPin(pin) {
  try {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nico-torjaeger|' + pin));   // Salz bleibt, wie er war: Sonst würden bereits gesetzte Trainer-Codes ungültig
    return 'h:' + Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, '0')).join('');
  } catch (e) { return 'p:' + pin; }
}
const checkPin = async p => { const c = S.cfg.pin; return c === 'p:' + p || c === (await hashPin(p)); };
function pinHTML(mode, msg) {
  const t = { enter: 'Trainer-Code', set: 'Neuen Code festlegen', again: 'Code wiederholen' }[mode];
  const sub = msg || { enter: 'Nur der Trainer vergibt Tore und Karten.', set: 'Vier Ziffern. Der Code schützt nur vor versehentlichem Tippen.', again: 'Noch einmal zur Sicherheit.' }[mode];
  return '<h2>' + t + '</h2><p class="sub">' + sub + '</p><div class="pin-dots" id="pindots" aria-live="polite">' + [0, 1, 2, 3].map(i => '<i' + (i < U.pin.length ? ' class="on"' : '') + '></i>').join('') + '</div>' +
    '<div class="pad4">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button data-act="pin-key" data-n="' + n + '">' + n + '</button>').join('') +
    '<button class="ghost" data-act="sheet-close">Zurück</button><button data-act="pin-key" data-n="0">0</button><button class="ghost" data-act="pin-del" aria-label="Löschen">⌫</button></div>';
}
function openPin(mode) { U.pin = ''; U.pinMode = mode; U.pinFirst = ''; openSheet(pinHTML(mode), 'sheet-pin'); }
const paintPin = () => $$('#pindots i').forEach((d, i) => d.classList.toggle('on', i < U.pin.length));
function badPin() {
  const d = $('#pindots'); if (d) { d.classList.add('bad'); setTimeout(() => { d.classList.remove('bad'); U.pin = ''; paintPin(); }, 450); }
  Snd.soft(); Hap.go([30, 40, 30]);
}
ACT['pin-del'] = () => { U.pin = U.pin.slice(0, -1); paintPin(); };
ACT['pin-key'] = async el => {
  if (U.pin.length >= 4) return;
  U.pin += el.dataset.n; Snd.tap(); paintPin();
  if (U.pin.length < 4) return;
  const entered = U.pin;
  if (U.pinMode === 'enter') {
    if (await checkPin(entered)) { closeSheet(); U.unlocked = true; U.last = Date.now(); render(); toast('Trainer-Modus an.'); } else badPin();
  } else if (U.pinMode === 'set') {
    U.pinFirst = entered; U.pin = ''; U.pinMode = 'again'; setSheet(pinHTML('again'));
  } else if (entered === U.pinFirst) {
    S.cfg.pin = await hashPin(entered); markChanged(); persist('cfg/main'); closeSheet(); render(); toast('Code gespeichert.');
  } else { U.pin = ''; U.pinMode = 'set'; setSheet(pinHTML('set', 'Das war nicht gleich. Bitte noch einmal von vorn.')); }
};
function lockNow() { U.unlocked = false; U.editTask = null; render(); }
ACT.lock = () => {
  if (U.readonly) return;
  if (U.unlocked) { lockNow(); toast('Trainer-Modus beendet.'); return; }
  if (!S.cfg.pin) { U.unlocked = true; U.last = Date.now(); render(); toast('Trainer-Modus an.'); return; }
  openPin('enter');
};
ACT['pin-set'] = () => openPin('set');
ACT['pin-clear'] = () => confirmSheet({ title: 'Code entfernen?', text: 'Dann kann ' + S.cfg.name + ' selbst Tore vergeben.', ok: 'Code entfernen', danger: true }, () => { S.cfg.pin = ''; markChanged(); persist('cfg/main'); render(); });
ACT.hint = el => { if (U.unlocked) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); toast('Die Tore vergibt der Trainer.'); };

/* ---------- Navigation ---------- */
ACT.tab = el => { U.tab = el.dataset.tab; window.scrollTo(0, 0); render(); };
ACT.day = el => { U.date = el.dataset.date; if (el.dataset.go) { U.tab = 'today'; window.scrollTo(0, 0); } render(); };
ACT['goto-today'] = () => { U.date = U.today; render(); };
ACT.wk = el => { U.weekOff = clamp(U.weekOff + (+el.dataset.d), -52, 0); render(); };

/* ---------- Einlauf (Start) ---------- */
function obHTML() {
  const o = U.ob;
  return '<h2>Einlauf!</h2><p class="sub">Richtet zusammen den Spieler ein. Das dauert eine Minute.</p><div class="ob-prev">' + jerseySVG(o.color, o.num, 92, 0) + '<span class="disp">' + esc(o.name || 'Ben') + '</span></div>' +
    '<div class="field"><span>Name</span><input type="text" id="ob-name" data-ob="name" value="' + esc(o.name) + '" maxlength="20" autocomplete="off"></div>' +
    '<div class="field"><span>Rückennummer</span>' + '<div class="stepper"><button data-act="ob-num" data-d="-1" aria-label="weniger">−</button><output>' + o.num + '</output><button data-act="ob-num" data-d="1" aria-label="mehr">+</button></div></div>' +
    '<div class="field"><span>Trikotfarbe</span>' + swatches(o.color, 'ob-color') + '</div>' +
    '<div class="field"><span>Name des Gegners</span><div class="chips-r">' + RIVAL_IDEAS.map(r => '<button data-act="ob-rival" data-v="' + esc(r) + '" aria-pressed="' + (o.rival === r) + '">' + esc(r) + '</button>').join('') + '</div><input type="text" id="ob-rival" data-ob="rival" value="' + esc(o.rival) + '" maxlength="24" autocomplete="off"></div>' +
    '<div class="field"><span>Trainer-Code (optional)</span><input type="tel" inputmode="numeric" id="ob-pin" data-ob="pin" value="' + esc(o.pin) + '" maxlength="4" placeholder="4 Ziffern" autocomplete="off"><small>Mit Code kann nur der Trainer Tore und Karten vergeben.</small></div>' +
    '<button class="btn btn-lime btn-block sticky-act" data-act="ob-go">Anpfiff!</button>';
}
function openOnboard() { U.ob = { name: S.cfg.name, num: S.cfg.jersey.num, color: S.cfg.jersey.color, rival: S.cfg.rival, pin: '' }; openSheet(obHTML(), 'onboard'); }
ACT['ob-num'] = el => { U.ob.num = clamp(U.ob.num + (+el.dataset.d), 1, 99); setSheet(obHTML()); };
ACT['ob-color'] = el => { U.ob.color = el.dataset.c; setSheet(obHTML()); };
ACT['ob-rival'] = el => { U.ob.rival = el.dataset.v; setSheet(obHTML()); };
ACT['ob-go'] = async () => {
  const o = U.ob; if (!o) return;
  const c = S.cfg;
  c.name = (o.name || '').trim().slice(0, 20) || 'Ben';
  c.rival = (o.rival || '').trim().slice(0, 24) || 'Sofa United';
  c.jersey = { num: o.num, color: o.color };
  if (/^\d{4}$/.test(o.pin || '')) c.pin = await hashPin(o.pin);
  U.hasCfg = true; markChanged(); persist('cfg/main'); persist('cfg/progress');
  U.sheet = null; closeSheet(); render();
  Snd.goal(); FX.party(['⚽']);
  banner({ icon: jerseySVG(c.jersey.color, c.jersey.num, 44, 0), title: 'Willkommen im Team, ' + esc(c.name) + '!', sub: 'Eine Sticker-Tüte wartet. Tippe hier, um sie zu öffnen.', tone: 'lime', ms: 7000, go: 'achieve' });
};

/* ---------- Einstellungen ---------- */
function stepTarget(obj) {
  const [kind, id] = obj.split(':');
  if (kind === 'cfg') return S.cfg;
  if (kind === 'season') return S.cfg.season;
  if (kind === 'jersey') return S.cfg.jersey;
  if (kind === 'goal') return S.cfg.goals.find(g => g.id === id);
  if (kind === 'task') return taskById(id);
  if (kind === 'note') return S.cfg.noteMoney;
  return null;
}
ACT.step = el => {
  const o = stepTarget(el.dataset.obj), key = el.dataset.key; if (!o) return;
  let v = clamp((+o[key] || 0) + (+el.dataset.d), +el.dataset.min, +el.dataset.max);
  if (el.dataset.obj.indexOf('goal:') === 0) {                      // Ziele bleiben aufsteigend
    const gs = S.cfg.goals, i = gs.indexOf(o);
    v = Math.max(v, i > 0 ? gs[i - 1].at + 5 : 5);
    if (i < gs.length - 1) v = Math.min(v, gs[i + 1].at - 5);
  }
  o[key] = v; markChanged(); persist('cfg/main', 400); render();
};
ACT['shoot-mode'] = () => { S.cfg.shootMode = S.cfg.shootMode === false; if (S.cfg.shootMode === false) U.shots = []; markChanged(); persist('cfg/main'); render(); };
ACT.sound = () => {
  U.muted = !U.muted; Snd.setMuted(U.muted);
  try { localStorage.setItem('torj-muted', U.muted ? '1' : '0'); } catch (e) { /* nur Komfort */ }
  if (!U.muted) Snd.goal();
  render();
};
ACT['jersey-color'] = el => { S.cfg.jersey.color = el.dataset.c; markChanged(); persist('cfg/main'); render(); };
ACT['task-edit'] = el => { U.editTask = U.editTask === el.dataset.id ? null : el.dataset.id; render(); };
ACT.emoji = el => { const t = taskById(el.dataset.id); if (t) { t.icon = el.dataset.e; markChanged(); persist('cfg/main'); render(); } };
ACT['task-bonus'] = el => { const t = taskById(el.dataset.id); if (t) { t.bonus = !t.bonus; markChanged(); persist('cfg/main'); render(); } };
ACT['task-day'] = el => {
  const t = taskById(el.dataset.id); if (!t) return;
  const d = +el.dataset.d, i = t.days.indexOf(d);
  if (i >= 0) { if (t.days.length > 1) t.days.splice(i, 1); } else t.days.push(d);
  markChanged(); persist('cfg/main'); render();
};
ACT['task-move'] = el => {
  const ts = S.cfg.tasks, i = ts.findIndex(t => t.id === el.dataset.id), j = i + (+el.dataset.d);
  if (i < 0 || j < 0 || j >= ts.length) return;
  const t = ts[i]; ts[i] = ts[j]; ts[j] = t; markChanged(); persist('cfg/main'); render();
};
ACT['task-add'] = () => {
  const t = { id: 't_' + Date.now().toString(36) + rid(), icon: '⭐', title: 'Neue Aufgabe', sub: '', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6], from: U.today };
  S.cfg.tasks.push(t); U.editTask = t.id; markChanged(); persist('cfg/main'); render();
};
ACT['task-idea'] = el => {
  const idea = TASK_IDEAS[+el.dataset.i]; if (!idea) return;
  const t = { id: 't_' + Date.now().toString(36) + rid(), icon: idea[0], title: idea[1], sub: '', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6], from: U.today };
  S.cfg.tasks.push(t); U.editTask = t.id; markChanged(); persist('cfg/main'); render();
  toast('„' + idea[1] + '“ ist angelegt. Wochentage und Tore kannst du jetzt anpassen.');
};
ACT['goto-sec'] = el => {
  if (!U.unlocked) return;
  const id = 'sec-' + el.dataset.sec;
  if (U.tab !== 'coach') { U.tab = 'coach'; render(); }
  requestAnimationFrame(() => { const t = document.getElementById(id); if (t) t.scrollIntoView({ behavior: stillMotion() ? 'auto' : 'smooth', block: 'start' }); });
};
ACT['task-del'] = el => {
  const id = el.dataset.id, t = taskById(id); if (!t) return;
  const used = Object.keys(S.days).some(ds => S.days[ds].m && S.days[ds].m[id]);
  confirmSheet({ title: 'Aufgabe entfernen?', text: used ? 'Bisherige Tore bleiben erhalten. Ab morgen erscheint die Aufgabe nicht mehr.' : 'Die Aufgabe wurde noch nie gewertet und wird ganz gelöscht.', ok: 'Entfernen', danger: true }, () => {
    if (used) t.until = addDays(U.today, 1); else S.cfg.tasks = S.cfg.tasks.filter(x => x.id !== id);
    U.editTask = null; markChanged(); persist('cfg/main'); render();
  });
};
ACT['reset-ask'] = () => confirmSheet({ title: 'Alles zurücksetzen?', text: 'Alle Tage, Karten, Sticker und Einstellungen werden gelöscht. Das lässt sich nicht rückgängig machen.', ok: 'Ja, alles löschen', danger: true }, resetAll);
async function resetAll() {
  const ids = Object.keys(S.days);
  const kids = Object.keys(S.konto || {});
  S.days = {}; S.konto = {}; S.cfg = defaultCfg(U.today); S.prog = normProg(); markChanged();
  U.unlocked = false; U.editTask = null; U.fish = 0; U.bars = {}; U.shots = []; U.celebQ = []; U.dayBanner = {}; U.hasCfg = false;
  try { localStorage.setItem('torj-fish', '0'); } catch (e) { /* nur Komfort */ }
  render();
  for (const id of ids) await flushKey('days/' + id);
  for (const id of kids) await flushKey('konto/' + id);
  await flushKey('cfg/main'); await flushKey('cfg/progress');
  openOnboard();
}

/* Eingabefelder: Zustand sofort, Speichern gebündelt */
function bindInput(el) {
  const v = el.value, parts = (el.dataset.bind || '').split(':');
  const c = S.cfg;
  if (parts[0] === 'cfg') c[parts[1]] = parts[1] === 'agreement' ? v.slice(0, 80) : v.slice(0, 24);
  else if (parts[0] === 'task') { const t = taskById(parts[1]); if (t) t[parts[2]] = v; }
  else if (parts[0] === 'goal') {
    const g = c.goals.find(x => x.id === parts[1]); if (!g) return;
    if (parts[2] === 'alt') { g.alts = (g.alts || ['', '']).slice(); g.alts[+parts[3]] = v; } else g.reward = v;
  } else if (parts[0] === 'season') c.season[parts[1]] = v;
  else if (parts[0] === 'list') c[parts[1]] = v.split('\n').map(x => x.trim()).filter(Boolean);
  else return;
  markChanged(); persist('cfg/main', 700);
  if (parts[0] === 'cfg' && parts[1] === 'agreement' && v.trim()) {            // Hinweis „Abmachung fehlt“ sofort weg, ohne die Eingabe zu stören
    const li = $('.adv li[data-adv="agreement"]');
    if (li) { const ul = li.parentNode, box = ul.closest('.warn-box'); li.remove(); if (!ul.children.length && box) box.remove(); }
  }
}

/* ---------- Zeit: Tageswechsel, automatisches Sperren ---------- */
function tick() {
  const t = todayStr();
  if (t !== U.today) {
    const wasToday = U.date === U.today;
    U.today = t; if (wasToday) U.date = t;
    markChanged(); if (U.ready) render();
  }
  if (U.unlocked && Date.now() - U.last > 180000) { lockNow(); toast('Trainer-Modus wurde gesperrt.'); }
}
function afterLoad() {
  U.today = todayStr(); if (!S.days[U.date]) U.date = U.today;
  if (Store.migrated && !U.readonly && U.hasCfg) { Store.migrated = false; persist('cfg/main'); }     // Einstellungen aus älteren Fassungen einmal im neuen Format sichern
  if (!U.readonly && !U.hasCfg && !Store.noAccess) openOnboard();       // ohne Zugriff auf den gemeinsamen Stand wird nichts neu angelegt
}

/* ---------- Ereignisse ---------- */
function bindEvents() {
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    Snd.wake(); U.last = Date.now();
    const fn = ACT[el.dataset.act];
    if (fn) fn(el, ev);
  });
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset && el.dataset.bind) bindInput(el);
    else if (el.dataset && el.dataset.ex && U.ex) U.ex.t = el.value;
    else if (el.dataset && el.dataset.kx && U.kx) { U.kx[el.dataset.kx] = el.value; const p = $('#kx-after'); if (p) p.textContent = kxAfter(); }
    else if (el.dataset && el.dataset.ob && U.ob) {
      const k = el.dataset.ob; U.ob[k] = k === 'pin' ? el.value.replace(/\D/g, '').slice(0, 4) : el.value;
      if (k === 'pin' && el.value !== U.ob.pin) el.value = U.ob.pin;
      if (k === 'name') { const sp = $('.ob-prev .disp'); if (sp) sp.textContent = U.ob.name || 'Ben'; }
    }
  });
  document.addEventListener('change', ev => { if (ev.target.dataset && ev.target.dataset.bind) persist('cfg/main'); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && U.sheet && U.sheet !== 'onboard') closeSheet(); });
  document.addEventListener('contextmenu', ev => { if (ev.target.closest('.shotbtn')) ev.preventDefault(); });
  document.addEventListener('pointerdown', ev => { if (ev.target.closest('.shotbtn')) { U.holdAt = performance.now(); const b = $('.shotbtn'); if (b) b.classList.add('charging'); Snd.wake(); } });
  const endHold = ev => {
    if (U.holdAt == null) return;
    const held = performance.now() - U.holdAt; U.holdAt = null;
    const b = $('.shotbtn'); if (b) b.classList.remove('charging');
    if (held >= 600 && U.shots.length > 1 && ev.type === 'pointerup') { U.suppressClick = true; setTimeout(() => { U.suppressClick = false; }, 450); volley(); }
  };
  document.addEventListener('pointerup', endHold); document.addEventListener('pointercancel', endHold);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) U.hiddenAt = Date.now();
    else { if (U.unlocked && U.hiddenAt && Date.now() - U.hiddenAt > 60000) lockNow(); tick(); }
  });
}

/* ---------- Web-App: Familienlink ---------- */
ACT['link-save'] = () => {
  const inp = $('#link-in'), err = $('#link-err'), c = parseFamilyLink(inp ? inp.value : '');
  if (!c) { if (err) err.hidden = false; return; }
  saveCred(c);
  try { history.replaceState(null, '', location.pathname + '#c=' + b64urlEncode(JSON.stringify({ k: c.k, f: c.f, e: c.e || undefined }))); } catch (e) { /* egal */ }
  location.reload();
};
ACT['link-reset'] = async () => {
  try { if (Store.fs) { await FB.terminate(Store.fs); await FB.clearIndexedDbPersistence(Store.fs); } } catch (e) { /* egal */ }   // auch den Zwischenspeicher dieses Geräts leeren
  forgetCred();
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* egal */ }
  location.reload();
};
ACT['link-reset-ask'] = () => confirmSheet({ title: 'Dieses Gerät abmelden?', text: 'Der Familienlink wird von diesem Gerät entfernt. Der Stand selbst bleibt erhalten. Mit dem Link kommst du jederzeit wieder hinein.', ok: 'Abmelden' }, ACT['link-reset']);
ACT['link-share'] = async () => {
  if (!Store.cred) return;
  const url = familyLink(Store.cred);
  try { if (navigator.share) { await navigator.share({ title: 'Torjäger-Challenge', text: 'Familienlink für die Torjäger-App', url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Familienlink kopiert. Schick ihn nur an die Familie.'); return; } catch (e) { /* Zwischenablage nicht erlaubt: Link zum Kopieren zeigen */ }
  openSheet('<h2>Familienlink</h2><p class="sub">Markieren und kopieren. Schick ihn nur an die Familie.</p><textarea class="linkbox" readonly rows="5" id="link-out">' + esc(url) + '</textarea><button class="btn btn-ghost" data-act="sheet-close">Schließen</button>', 'sheet-link');
  const t = $('#link-out'); if (t) { t.focus(); t.select(); }
};
ACT.reload = () => location.reload();
ACT['a2hs-close'] = () => { try { localStorage.setItem('torj-hint-a2hs', '1'); } catch (e) { /* egal */ } render(); };

function boot() {
  document.documentElement.style.setProperty('--pitch-bg', PITCH_BG);
  document.body.insertAdjacentHTML('afterbegin', SVG_DEFS);
  try {
    U.muted = localStorage.getItem('torj-muted') === '1';
    const f = localStorage.getItem('torj-fish'); if (f != null && !isNaN(+f)) U.fish = +f;
  } catch (e) { /* ohne Speicher geht es auch */ }
  Snd.setMuted(U.muted);
  FX.init(); bindEvents(); render();
  setInterval(tick, 20000);
  if (window.__PWA__ && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Hülle geht es auch */ });
  initStore();
}
boot();
