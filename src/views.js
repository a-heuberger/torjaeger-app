/* ============ Zustand und Ansichten ============ */
const U = {
  tab: 'today', today: todayStr(), date: todayStr(), unlocked: false, ready: false, readonly: false, hasCfg: true,
  weekOff: 0, fx: null, pop: false, editTask: null, last: Date.now(), celebQ: [], sheet: null, pin: '',
  bars: {}, fish: null, newSticker: null, muted: false, shots: [], ob: null, ex: null, kx: null, dayBanner: {},
};
let S = { cfg: defaultCfg(U.today), prog: normProg(), days: {}, konto: {} };
let _st = null;
const markChanged = () => { touch(S); _st = null; };
const ST = () => _st || (_st = computeStats(S, U.today));

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const tore = n => n + (n === 1 ? ' Tor' : ' Tore');
const signed = n => (n < 0 ? '−' + Math.abs(n) : String(n));          // Zahl mit richtigem Minuszeichen
const punkte = n => n + (n === 1 ? ' Punkt' : ' Punkte');
const fmtShort = ds => { const d = parseDate(ds); return WD_SHORT[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
const goalText = g => esc(String(g.reward || '').trim() || 'Wird später festgelegt');
const pendingFor = ds => U.shots.filter(s => s.ds === ds);
const isPending = (ds, id) => U.shots.some(s => s.ds === ds && s.id === id);
const taskPts = id => (S.cfg.tasks.find(t => t.id === id) || { pts: 1 }).pts;
const plain = s => String(s).replace(/­/g, '');

function render() {
  const app = $('#app'); if (!app) return;
  if (Store.gate) { app.innerHTML = gateView(Store.gate); return; }
  if (!U.ready) { app.innerHTML = '<div class="boot">' + ballSVG(76) + '<p>Aufstellung wird geladen …</p></div>'; return; }
  _st = null;
  if (Store.noAccess && !U.hasCfg) { app.innerHTML = gateView('noaccess'); return; }
  if (U.tab === 'coach' && U.readonly) U.tab = 'today';
  const st = ST();
  const views = { today: viewToday, week: viewWeek, achieve: viewAchieve, konto: viewKonto, coach: viewCoach };
  app.innerHTML = headerView(st) + '<main class="wrap main" id="main">' + views[U.tab](st) + '</main>' + tabsView(st);
  afterRender();
}

function afterRender() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.fill[data-to]').forEach(el => { el.style.width = el.dataset.to + '%'; U.bars[el.dataset.key] = +el.dataset.to; });
  }));
  const sc = $('#app .fang-scene'); if (sc) animateFish(sc);
  U.fx = null; U.pop = false; U.newSticker = null;
}

/* ---------- Kopf und Tab-Leiste ---------- */
/* Karten-Marken in der Kopfzeile (auf jedem Tab sichtbar): gelbe Karte offen, rote Karte heute. */
function headerFlags(st) {
  const red = evalDay(S, U.today).red > 0;
  return (st.account.count > 0 ? '<span class="hflag" role="img" aria-label="Gelbe Karte">' + cardSVG('yellow', 24) + '</span>' : '') + (red ? '<span class="hflag" role="img" aria-label="Rote Karte heute">' + cardSVG('red', 24) + '</span>' : '');
}
function headerView(st) {
  const j = S.cfg.jersey;
  const lock = U.readonly ? '' : '<button class="chip lockbtn' + (U.unlocked ? ' on' : '') + '" data-act="lock" aria-label="' + (U.unlocked ? 'Trainer-Modus beenden' : 'Trainer-Modus öffnen') + '">' + (U.unlocked ? IC.unlock : IC.lock) + '</button>';
  return '<header class="top"><div class="wrap top-in"><div class="who">' + jerseySVG(j.color, j.num, 44, st.fish) +
    '<div class="who-tx"><span class="nmrow"><b class="nm">' + esc(S.cfg.name) + '</b>' + headerFlags(st) + '</span></div></div>' +
    '<div class="chips"><div class="chip fire" role="img" aria-label="Ungeschlagen seit ' + st.cur + ' Spielen">' + IC.flame + '<b>' + st.cur + '</b></div>' +
    '<div class="chip" role="img" aria-label="' + tore(st.total) + ' gesamt">' + ballSVG(20) + '<b>' + st.total + '</b></div>' + lock + '</div></div></header>';
}
function tabsView(st) {
  const tabs = [['today', 'Heute'], ['week', 'Woche'], ['achieve', 'Erfolge'], ['konto', 'Konto']].concat(U.readonly ? [] : [['coach', 'Trainer']]);
  return '<nav class="tabs" aria-label="Bereiche"><div class="tabs-in">' + tabs.map(t => {
    const badge = t[0] === 'achieve' && st.packs.left > 0 ? '<i class="dot-badge" aria-label="' + st.packs.left + ' Tüten warten">' + st.packs.left + '</i>'
      : t[0] === 'today' && U.shots.length ? '<i class="dot-badge lime" aria-label="' + U.shots.length + ' Tore warten auf den Schuss">' + U.shots.length + '</i>' : '';
    return '<button class="tab" data-act="tab" data-tab="' + t[0] + '"' + (U.tab === t[0] ? ' aria-current="page"' : '') + '>' + TAB_IC[t[0]] + badge + '<span>' + t[1] + '</span></button>';
  }).join('') + '</div></nav>';
}

/* Sperrseite statt Spiel: noaccess = Claude-Seite ohne Zugriff, nolink = Web-App ohne Familienlink, denied = Link passt nicht (mehr),
   sdk = Programmteil nicht geladen (erster Start ohne Netz), offline = Stand noch nicht vom Server geholt. */
function gateView(kind) {
  const card = (icon, title, body, extra) => '<main class="wrap main gate-main" id="main"><section class="card gate noconn" data-gate="' + kind + '"><div class="lockbig">' + icon + '</div><h2>' + title + '</h2>' + body + (extra || '') + '</section></main>';
  if (kind === 'nolink') {
    return card(IC.lock, 'Familienlink fehlt', '<p class="hint">Diese App zeigt nur den Stand eurer Familie. Öffne den Familienlink, den du bekommen hast, oder füge ihn hier ein.</p>',
      '<div class="field link-in"><input type="text" id="link-in" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Familienlink hier einfügen" aria-label="Familienlink"></div>' +
      '<p class="hint err" id="link-err" role="alert" hidden>Das ist kein gültiger Familienlink. Es muss der ganze Link sein, mit allem hinter dem #.</p>' +
      '<button class="btn btn-lime" data-act="link-save">Verbinden</button>');
  }
  if (kind === 'denied') {
    return card(IC.lock, 'Der Link passt nicht', '<p class="hint">Mit diesem Familienlink kommt die App nicht an den Stand heran. Vielleicht wurde der Zugang erneuert. Frag nach dem neuen Link und füge ihn ein.</p>',
      '<button class="btn btn-lime" data-act="link-reset">Neuen Link eingeben</button>');
  }
  if (kind === 'sdk') {
    return card(IC.lock, 'Die App kann nicht starten', '<p class="hint">Beim ersten Start braucht sie Internet. Verbinde dich und versuche es noch einmal.</p>',
      '<button class="btn btn-lime" data-act="reload">Noch einmal versuchen</button>');
  }
  if (kind === 'offline') {
    return card(IC.lock, 'Noch keine Verbindung', '<p class="hint">Der Stand wird geladen, sobald du online bist. Du musst nichts tun.</p>',
      '<button class="btn btn-ghost" data-act="reload">Noch einmal versuchen</button>');
  }
  return card(IC.lock, 'Hier fehlt die Anmeldung', '<p class="hint">Der Stand liegt in Claude und zeigt sich nur, wenn du dort angemeldet bist und die Seite für dich freigegeben ist. Bitte Mama oder Papa um Hilfe.</p>' +
    '<p class="hint">Für die Eltern: Mit dem Claude-Konto anmelden, in dem die Seite liegt oder für das sie freigegeben wurde, und den Link noch einmal öffnen.</p>');
}
/* Hinweis unter den Karten auf Heute: Nur ansehen (kein Schreibrecht) oder nicht mit dem gemeinsamen Stand verbunden. */
function modeNote() {
  if (Store.noAccess) return '<section class="warn-box mode-note" role="status"><b>Nicht verbunden.</b> Diese Ansicht zeigt nicht den gemeinsamen Stand. Was hier eingetragen wird, bleibt nur auf diesem Gerät.</section>';
  if (U.readonly) return '<p class="hint mode-note" role="note">Nur ansehen: Eintragen und Tüten öffnen macht der Trainer.</p>';
  return '';
}

/* ---------- Heute ---------- */
/* Ganz oben auf Heute: offene Gelbe und Rote des Tages, gut sichtbar und mit einem Satz dazu. */
function cardTop(st) {
  const e = evalDay(S, U.today), c = S.cfg;
  let h = '';
  if (e.red > 0) h += '<section class="cardtop red" role="status">' + cardSVG('red', 36) + '<span class="ct-tx"><b>Rote Karte heute</b><small>Minus ' + tore(c.redPts) + ' bei den Zielen.</small></span></section>';
  if (st.account.count > 0) {
    const d = st.account.dates[0];
    h += '<section class="cardtop yellow" role="status">' + cardSVG('yellow', 36) + '<span class="ct-tx"><b>Gelbe Karte</b><small>' + (d === U.today ? 'Heute bekommen. ' : d ? 'Seit ' + fmtShort(d) + ' ' : '') + (c.yellowPts ? 'Minus ' + tore(c.yellowPts) + ' bei den Zielen. ' : '') + 'Eine zweite Gelbe ergibt Rot.</small></span></section>';
  }
  return h;
}
function dayStrip(sel) {
  const mon = mondayOf(sel);
  let h = '<nav class="strip" aria-label="Tage der Woche">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), e = evalDay(S, d), fut = d > U.today;
    const dot = e.perfect ? 'perfect' : e.result;
    const pc = (e.yellow ? '<i class="pcard y"></i>' : '') + (e.red ? '<i class="pcard r"></i>' : '');
    h += '<button class="pill' + (d === sel ? ' sel' : '') + (d === U.today ? ' today' : '') + (fut ? ' fut' : '') + '" data-act="day" data-date="' + d + '"' + (fut ? ' disabled' : '') + ' aria-label="' + WD_LONG[dowOf(d)] + ', ' + parseDate(d).getDate() + '.' + (e.yellow ? ', Gelbe Karte' : '') + (e.red ? ', Rote Karte' : '') + '"' + (d === sel ? ' aria-current="date"' : '') + '>' +
      '<span class="wd">' + WD_SHORT[dowOf(d)] + '</span><span class="dn">' + parseDate(d).getDate() + '</span><span class="st"><i class="dot ' + dot + '"></i></span>' + (pc ? '<span class="pcards" aria-hidden="true">' + pc + '</span>' : '') + '</button>';
  }
  return h + '</nav>';
}

function dayMessage(e, isToday) {
  const rv = esc(S.cfg.rival);
  if (e.off) return [e.joker ? 'Joker' : 'Spielfrei', ''];
  if (!e.appN && !e.hasData) return ['Heute keine Aufgaben', ''];
  if (e.perfect) return ['Weiße Weste!', ''];
  if (e.complete) {
    if (e.result === 'win') return ['Abpfiff: Sieg!', ''];
    if (e.result === 'draw') return ['Unentschieden', ''];
    return [rv + ' war heute vorn', ''];
  }
  if (!e.hasData) return isToday ? ['Anpfiff!', ''] : ['Noch nichts eingetragen', ''];
  return ['Noch ' + e.open + ' offen', ''];
}

function scoreCard(e, ds) {
  const d = parseDate(ds), msg = dayMessage(e, ds === U.today);
  const pend = pendingFor(ds);
  const pendPts = pend.reduce((n, s) => n + taskPts(s.id), 0);
  const shown = Math.max(0, e.gain - pendPts);                 // der Spielstand zeigt alle Tore des Tages, ohne Abzug durch Karten
  const res = { win: 'Sieg', draw: 'Remis', loss: 'Niederlage' };
  const badge = e.off ? ['off', e.joker ? 'Joker' : 'Spielfrei'] : e.perfect && !pend.length ? ['perfect', 'Perfekter Tag'] : e.complete && !pend.length ? [e.result, res[e.result]] : null;
  const mood = e.off || !e.hasData ? 'meh' : shown > e.rival ? 'sad' : shown < e.rival ? 'lazy' : 'meh';
  const j = S.cfg.jersey, st = ST();
  return '<section class="card score' + (e.perfect && !pend.length ? ' perfect' : '') + '" aria-label="Spielstand">' +
    '<div class="score-top"><span class="date">' + WD_LONG[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS_SHORT[d.getMonth()] + '</span>' + (badge ? '<span class="badge ' + badge[0] + '">' + badge[1] + '</span>' : '') + '</div>' +
    '<div class="board"><div class="team">' + jerseySVG(j.color, j.num, 58, st.fish) + '<span class="tn">' + esc(S.cfg.name) + '</span></div>' +
    '<div class="digits" role="img" aria-label="Spielstand ' + shown + ' zu ' + e.rival + '"><span class="nv' + (U.pop ? ' pop' : '') + '" id="scoreN">' + shown + '</span><span class="colon">:</span><span class="rv">' + e.rival + '</span></div>' +
    '<div class="team">' + monsterSVG(mood, 58) + '<span class="tn">' + esc(S.cfg.rival) + '</span></div></div>' +
    '<p class="msg">' + msg[0] + '</p></section>';
}

function stampHTML(st, t, pend) {
  if (pend) return '<div class="stamp ready">' + ballSVG(28) + '<span>Bereit</span></div>';
  if (st === 'y') return '<div class="stamp y' + (t.bonus ? ' gold' : '') + '">' + ballSVG(26) + '<span>Tor!</span></div>';
  if (st === 'n') return '<div class="stamp n">' + IC.cross + '<span>Kein Tor</span></div>';
  if (st === 'x') return '<div class="stamp x"><span>Frei</span></div>';
  return '<div class="stamp o"><span>Offen</span></div>';
}
function segHTML(t, st) {
  const b = (k, cls, label, icon) => '<button class="' + cls + '" data-act="mark" data-task="' + t.id + '" data-st="' + k + '" aria-pressed="' + (st === k) + '">' + icon + '<span>' + label + '</span></button>';
  if (t.bonus) return '<div class="seg one">' + b('y', 'b-g', 'Geschafft: +' + t.pts + ' Tore', IC.star) + '</div>';
  return '<div class="seg two">' + b('y', 'b-y', 'Tor', IC.check) + b('n', 'b-n', 'Kein Tor', IC.cross) + '</div>';
}
function taskCard(it, ds) {
  const t = it.t, st = it.st, pend = isPending(ds, t.id);
  const pts = t.bonus ? '<span class="tag bonus">Bonus +' + t.pts + '</span>' : (t.pts > 1 ? '<span class="tag">+' + t.pts + '</span>' : '');
  const fx = U.fx && U.fx.task === t.id ? ' fx' : '';
  const sub = taskSub(S.cfg, t);
  return '<li class="task st-' + (pend ? 'ready' : (st || 'o')) + (t.bonus ? ' bonus' : '') + fx + '"' + (U.unlocked ? '' : ' data-act="hint"') + ' data-task="' + t.id + '">' +
    '<div class="ico" aria-hidden="true">' + esc(t.icon) + '</div><div class="tx"><h3>' + esc(t.title) + pts + '</h3>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' +
    '<div class="stamp-wrap">' + stampHTML(st, t, pend) + '</div>' + (U.unlocked ? segHTML(t, st) : '') + '</li>';
}

/* Einträge des Tages (Extra-Tore, Karten). Karten kann nur der Trainer zurückziehen. Ihr Minus steht rechts mit Minuszeichen. */
function entryRow(en, ds) {
  const c = S.cfg;
  if (en.k === '+') return '<li class="ev good"><span class="evi">' + ballSVG(24) + '</span><span class="evt">' + esc(en.t || 'Eigener Grund') + '<small>Eigener Grund · Tor</small></span><b class="evv">+' + (en.v || 1) + '</b>' + delBtn(en) + '</li>';
  if (en.k === 'n') { const g = Math.max(1, Math.round(+en.v) || 1); return '<li class="ev no"><span class="evi">' + IC.cross + '</span><span class="evt">' + esc(en.t || 'Kein Tor') + '<small>Eigener Grund · Kein Tor · Gegner +' + g + '</small></span><b class="evv">+' + g + '</b>' + delBtn(en) + '</li>'; }
  if (en.k === 'f') return '<li class="ev fair"><span class="evi">' + IC.check + '</span><span class="evt">' + esc(en.t || 'Fair-Play-Geste') + '<small>Fair Play · eine Gelbe wurde gestrichen</small></span><b class="evv"></b>' + delBtn(en) + '</li>';
  const back = (id, label) => (U.unlocked && id ? '<div class="ev-act"><button class="btn btn-ghost btn-xs" data-act="card-back" data-id="' + esc(id) + '" data-ds="' + ds + '">' + label + '</button></div>' : '');
  if (en.k === 'y') {
    return '<li class="ev yellow"><span class="evi">' + cardSVG('yellow', 28) + '</span><span class="evt">' + esc(en.t || 'Gelbe Karte') + '<small>' + (en.t ? 'Gelbe Karte · ' : '') + 'Verwarnung' + (c.yellowPts ? ' · Minus ' + c.yellowPts : '') + '</small></span><b class="evv">' + (c.yellowPts ? '−' + c.yellowPts : '') + '</b><span></span>' + back(en.id, 'Karte zurückziehen') + '</li>';
  }
  const why = en.auto ? 'Zwei Gelbe Karten' : (en.t || 'Rote Karte');
  const eff = en.capped ? 'heute schon Rot, kein weiteres Minus' : 'Minus ' + c.redPts;
  return '<li class="ev red"><span class="evi">' + cardSVG('red', 28) + '</span><span class="evt">' + esc(why) + '<small>' + (en.auto ? 'Automatisch Rot' : 'Rote Karte') + ' · ' + eff + '</small></span><b class="evv">' + (en.capped ? '' : '−' + c.redPts) + '</b><span></span>' +
    (en.auto ? back(en.src, 'Zweite Gelbe zurückziehen') : back(en.id, 'Karte zurückziehen')) + '</li>';
}
const delBtn = en => (U.unlocked && en.id ? '<button class="evx" data-act="ev-del" data-id="' + en.id + '" aria-label="Eintrag löschen">' + IC.cross + '</button>' : '<span></span>');

function extrasCard(e, ds, st) {
  const isToday = ds === U.today, c = S.cfg;
  let btns = '';
  if (U.unlocked) {
    const left = Math.max(0, (c.extraMax == null ? 3 : c.extraMax) - e.plus);
    btns = '<div class="xbtns x2">' +
      '<button class="xbtn wide" data-act="extra-open" data-k="+">' + IC.plus + '<span>Eigener Grund</span><small>Tor oder Kein Tor, frei eingeben' + (left <= 0 ? ' · heute keine Extra-Tore mehr' : '') + '</small></button>';
    if (!isToday) btns += '</div><p class="hint">Karten gibt es nur am Spieltag selbst.</p>';
    else if (!c.cardsAck) btns += '<button class="xbtn wide" data-act="cards-unlock">' + cardSVG('yellow', 30) + '<span>Karten freischalten</span></button></div>';
    else btns += '<button class="xbtn" data-act="extra-open" data-k="y">' + cardSVG('yellow', 30) + '<span>Gelb</span></button>' +
      '<button class="xbtn" data-act="extra-open" data-k="r"' + (e.red > 0 ? ' disabled' : '') + '>' + cardSVG('red', 30) + '<span>' + (e.red > 0 ? 'Rot (schon)' : 'Rot') + '</span></button></div>';
  }
  const list = e.entries.length ? '<ul class="evs">' + e.entries.map(en => entryRow(en, ds)).join('') + '</ul>'
    : (U.unlocked ? '' : '<p class="hint">Noch keine Extras. Zeig, was du drauf hast!</p>');
  return '<section class="card extras" aria-label="Extras und Karten"><div class="sec-h"><h2>Extras &amp; Karten</h2><button class="btn btn-ghost btn-sm" data-act="rules">Regelbuch</button></div>' + btns + list + '</section>';
}
function dayTools(e, ds) {
  if (!U.unlocked) return '';
  if (e.off) return '<div class="day-tools"><button class="btn btn-ghost btn-sm" data-act="off">Tag wieder aktivieren</button></div>';   // nur für alte Daten
  const open = e.items.some(it => !it.t.bonus && !it.st);
  return open ? '<div class="day-tools"><button class="btn btn-ghost btn-sm" data-act="all-ok">' + IC.check + 'Alle Tor</button><button class="btn btn-ghost btn-sm" data-act="rest-no">' + IC.cross + 'Rest: Kein Tor</button></div>' : '';
}
function shotBar() {
  const n = U.shots.length;
  if (!n) return '';
  return '<div class="shotbar" role="region" aria-label="Torschuss"><button class="shotbtn" data-act="shoot" aria-label="Schießen. ' + n + ' bereit. Gedrückt halten schießt alle.">' + ballSVG(54) + '<span class="st"><b>Schieß!</b><small>' + (n === 1 ? 'Ein Tor wartet' : n + ' Tore warten') + '<br>Ball halten = alle Tore</small></span><i class="charge"></i></button>' +
    '<div class="goalbox" id="goalbox">' + goalSVG(132) + '<span class="goalflash">Tor!</span></div>' +
    '<button class="skip" data-act="shoot-skip">Überspringen</button></div>';
}

/* Unter den Aufgaben: das nächste Ziel mit Zähler und die nächste Sticker-Tüte. Tippen führt zu den Erfolgen.
   Der Zähler rechnet mit den Toren nach Abzug; gibt es ein Minus, steht darunter, wie sich die Zahl zusammensetzt. */
function nextGoalCard(st) {
  const gl = goalList(S, st), ng = gl.find(g => !g.reached), p = st.packs;
  const waiting = gl.filter(g => g.reached && !g.done);
  let h = '<div class="sec-h"><h2>Nächstes Ziel</h2></div><button class="card nextgoal" data-act="tab" data-tab="achieve" aria-label="Zu den Erfolgen">';
  if (waiting.length) h += '<span class="ng-wait">' + trophySVG(waiting[0].tier, 26) + '<span><b>' + tore(waiting[0].at) + ' geschafft!</b> Deine Belohnung wartet' + (waiting.length > 1 ? ' (' + waiting.length + ' Ziele)' : '') + '.</span></span>';
  if (ng) {
    const pct = clamp(Math.round((st.score - ng.prev) / Math.max(1, ng.at - ng.prev) * 100), 0, 100);
    h += '<span class="ng-main"><span class="ng-ico">' + (ng.last ? fishSVG(50) : trophySVG(ng.tier, 46)) + '</span><span class="ng-tx"><b>Noch ' + tore(ng.need) + '</b><small>bis ' + (ng.last ? 'der Fisch an Land ist' : tore(ng.at)) + ': ' + goalText(ng) + '</small></span><span class="ng-cnt">' + signed(st.score) + '<i>/</i>' + ng.at + '</span></span>' +
      '<span class="ng-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
      (st.minus ? '<span class="ng-note">' + tore(st.total) + ' gesamt, Minus −' + st.minus + ' durch Karten</span>' : '');
  } else h += '<span class="ng-main"><span class="ng-ico">' + fishSVG(50) + '</span><span class="ng-tx"><b>Alles geschafft!</b><small>Der Fisch ist an Land. Der Trainer legt neue Ziele fest.</small></span></span>';
  h += '<span class="ng-pack">' + packSVG(30) + '<span>' + (p.left ? '<b>' + (p.left === 1 ? 'Eine Tüte wartet' : p.left + ' Tüten warten') + '</b> bei den Erfolgen' : 'Noch <b>' + tore(p.next) + '</b> bis zur nächsten Sticker-Tüte') + '</span></span></button>';
  return h;
}
function viewToday(st) {
  const ds = U.date, e = evalDay(S, ds), isToday = ds === U.today;
  let h = (isToday ? cardTop(st) : '') + modeNote() + dayStrip(ds) + shotBar();
  if (!isToday) h += '<button class="btn btn-ghost btn-sm back-today" data-act="goto-today">' + IC.back + 'Zurück zu heute</button>';
  h += scoreCard(e, ds);
  h += '<div class="sec-h"><h2>Aufgaben</h2></div>' + dayTools(e, ds);
  if (e.off) h += '<div class="card pad"><p class="hint">' + (e.joker ? 'Joker: An diesem Tag zählt nichts.' : 'Spielfrei: An diesem Tag zählt nichts.') + '</p></div>';
  else if (!e.items.length) h += '<div class="card pad"><p class="hint">An diesem Tag gibt es keine Aufgaben.</p></div>';
  else h += '<ul class="tasks">' + e.items.map(it => taskCard(it, ds)).join('') + '</ul>';
  if (!e.off) h += extrasCard(e, ds, st);
  if (isToday && !e.off) h += nextGoalCard(st);
  h += installHint();
  return h;
}
/* Auf dem iPhone, solange die Seite noch in Safari läuft: wie sie auf den Home-Bildschirm kommt. */
function installHint() {
  if (!window.__PWA__ || Store.gate) return '';
  try { if (localStorage.getItem('torj-hint-a2hs') === '1') return ''; } catch (e) { /* egal */ }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!ios || standalone) return '';
  return '<section class="card pad a2hs" aria-label="Als App installieren"><span class="a2hs-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg></span>' +
    '<div class="a2hs-tx"><b>Als App auf den Home-Bildschirm</b><p>Tippe unten auf <b>Teilen</b> (Quadrat mit Pfeil) und dann auf <b>Zum Home-Bildschirm</b>. Danach öffnet sie wie eine App.</p></div>' +
    '<button class="btn btn-ghost btn-xs" data-act="a2hs-close">Verstanden</button></section>';
}

/* ---------- Woche ---------- */
/* Kleine Karten eines Tages: eine je Karte, höchstens drei, dann „+N“, dahinter das Minus des Tages. */
function dayCards(e) {
  const mk = (n, kind) => { let s = ''; for (let i = 0; i < Math.min(n, 3); i++) s += cardSVG(kind, 16); return s + (n > 3 ? '<em>+' + (n - 3) + '</em>' : ''); };
  if (!e.yellow && !e.red) return '';
  const lab = (e.yellow ? e.yellow + (e.yellow === 1 ? ' Gelbe Karte' : ' Gelbe Karten') : '') + (e.yellow && e.red ? ', ' : '') + (e.red ? e.red + (e.red === 1 ? ' Rote Karte' : ' Rote Karten') : '') + (e.minus ? ', Minus ' + e.minus : '');
  return '<span class="dcards" role="img" aria-label="' + lab + '">' + mk(e.yellow, 'yellow') + mk(e.red, 'red') + (e.minus ? '<b class="dminus">−' + e.minus + '</b>' : '') + '</span>';
}
function weekCards(w) {
  return '<section class="card pad weekcards" aria-label="Karten dieser Woche"><div class="sec-h"><h2>Karten diese Woche</h2><button class="btn btn-ghost btn-sm" data-act="rules">Regelbuch</button></div><div class="wc">' +
    (w.yellow ? '<span class="cflag yellow">' + cardSVG('yellow', 22) + '<b>' + w.yellow + ' Gelb</b></span>' : '') + (w.red ? '<span class="cflag red">' + cardSVG('red', 22) + '<b>' + w.red + ' Rot</b></span>' : '') +
    (w.minus ? '<span class="cflag minus"><b>Minus −' + w.minus + '</b></span>' : '') + '</div></section>';
}
function viewWeek(st) {
  const mon = addDays(mondayOf(U.today), U.weekOff * 7), w = evalWeek(S, mon);
  const a = parseDate(mon), b = parseDate(addDays(mon, 6));
  const range = a.getDate() + '.' + (a.getMonth() === b.getMonth() ? '' : (a.getMonth() + 1) + '.') + '–' + b.getDate() + '. ' + MONTHS_SHORT[b.getMonth()];
  let h = '<div class="wk-nav"><button class="navbtn" data-act="wk" data-d="-1" aria-label="Vorherige Woche"' + (U.weekOff <= -52 ? ' disabled' : '') + '>' + IC.chevL + '</button>' +
    '<div class="mid"><b>KW ' + isoWeek(mon) + (U.weekOff === 0 ? ' · diese Woche' : '') + '</b><span class="hint">' + range + '</span></div>' +
    '<button class="navbtn" data-act="wk" data-d="1" aria-label="Nächste Woche"' + (U.weekOff >= 0 ? ' disabled' : '') + '>' + IC.chevR + '</button></div>';
  if (w.yellow || w.red) h += weekCards(w);
  h += '<div class="sec-h"><h2>Die Spieltage</h2></div><div class="wk-days">' + w.days.map(dayRow).join('') + '</div>';
  h += '<div class="stats4"><div class="stat"><b>' + w.goals + '</b><span>Tore</span></div><div class="stat"><b>' + w.perfect + '</b><span>Perfekte Tage</span></div><div class="stat"><b>' + st.cur + '</b><span>Serie</span></div><div class="stat"><b>' + st.best + '</b><span>Rekord</span></div></div>';
  return h;
}
function dayRow(e) {
  const d = parseDate(e.ds), fut = e.ds > U.today;
  let balls = '';
  if (e.off) balls = '<em>' + (e.joker ? 'Joker' : 'Spielfrei') + '</em>';
  else if (e.gain > 0) { for (let i = 0; i < Math.min(e.gain, 8); i++) balls += ballSVG(20); if (e.gain > 8) balls += '<em>+' + (e.gain - 8) + '</em>'; }
  else balls = '<em>' + (fut ? '' : e.hasData ? 'Kein Tor' : e.yellow || e.red ? 'Nur Karte' : e.entries.length ? 'Kein Tor' : 'Noch nichts eingetragen') + '</em>';
  const dot = e.perfect ? 'perfect' : e.result;
  return '<button class="wk-day' + (e.ds === U.today ? ' today' : '') + (fut ? ' fut' : '') + '" data-act="day" data-date="' + e.ds + '" data-go="1"' + (fut ? ' disabled' : '') + '>' +
    '<span class="d"><b>' + d.getDate() + '</b><span>' + WD_SHORT[d.getDay()] + '</span></span><span class="balls">' + balls + '</span>' +
    '<span class="res">' + dayCards(e) + (e.hasData && !e.off ? e.gain + ':' + e.rival : '') + '<i class="dot ' + dot + '"></i></span></button>';
}

/* ---------- Erfolge: Fang, Ziele, Sticker ---------- */
function runFish(svg, from, to, done) {
  if (!svg) return;
  if (from === to || stillMotion()) { setFish(svg, to); if (done) done(); return; }
  const t0 = performance.now(), dur = 1500 + Math.min(1500, Math.abs(to - from) * 3000);
  const step = t => {
    if (!svg.isConnected) return;
    const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    setFish(svg, from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step); else if (done) done();
  };
  setFish(svg, from); requestAnimationFrame(step);
}
function animateFish(host) {
  const svg = host.querySelector('svg'); if (!svg) return;
  const to = +host.dataset.p, from = U.fish == null ? to : U.fish;
  U.fish = to;
  try { localStorage.setItem('torj-fish', String(to)); } catch (e) { /* nur Komfort */ }
  runFish(svg, from, to);
}
/* Zeile mit Tüten-Stand: ganz oben bei den Erfolgen, damit sofort klar ist, ob eine Tüte offen ist. */
function packLine(st) {
  const p = st.packs;
  if (p.foil >= STICKERS.length) return '<div class="packline done"><span class="pl-ico">' + packSVG(44) + '</span><span class="pl-tx"><b>Alles in Glanz!</b><small>Alle ' + STICKERS.length + ' Sticker sind Glanz-Versionen. Du bist der Sammelkönig!</small></span></div>';
  const head = p.left === 0 ? 'Gerade keine Tüte offen' : p.left === 1 ? 'Eine Tüte wartet!' : p.left + ' Tüten warten!';
  const sub = p.left ? (U.readonly ? 'Der Trainer öffnet sie mit dir. ' : 'Öffne sie selbst. ') + (p.complete ? 'Ein Sticker wird zur Glanz-Version.' : 'Du bekommst einen neuen Sticker.')
    : 'Noch <b>' + tore(p.next) + '</b> bis zur nächsten Sticker-Tüte. Alle ' + p.every + ' Tore gibt es eine.' + (p.complete ? ' Das Album ist komplett: Neue Tüten machen Sticker zu Glanz-Versionen.' : '');
  return '<div class="packline' + (p.left ? ' has' : '') + '"><span class="pl-ico">' + packSVG(46) + '</span><span class="pl-tx"><b>' + head + '</b><small>' + sub + '</small></span>' +
    (p.left && !U.readonly ? '<button class="btn btn-lime btn-sm" data-act="pack-open">Tüte öffnen</button>' : '') + '</div>';
}
/* Ein Ziel: Tore, Belohnung und Stand. Beim nächsten Ziel zeigt ein Balken den Weg vom letzten Ziel an. */
function goalRow(g, st, isNext) {
  const done = g.done;
  const state = done ? 'Eingelöst am ' + fmtShort(done) : g.reached ? (g.on ? 'Geschafft am ' + fmtShort(g.on) + ' Sag dem Trainer Bescheid.' : 'Geschafft! Sag dem Trainer Bescheid.') : 'Noch ' + tore(g.need);
  const bar = isNext ? '<div class="gbar" aria-hidden="true"><i style="width:' + clamp(Math.round((st.score - g.prev) / Math.max(1, g.at - g.prev) * 100), 0, 100) + '%"></i></div>' : '';
  const btn = U.unlocked && g.reached ? '<button class="btn btn-ghost btn-sm" data-act="redeem" data-key="' + esc(g.id) + '">' + (done ? 'Rückgängig' : 'Als eingelöst markieren' + (g.money ? ' und ' + fmtEUR(g.money) + ' buchen' : '')) + '</button>' : '';
  return '<div class="tier goal' + (g.reached ? ' got' : '') + (done ? ' done' : '') + (isNext ? ' next' : '') + '" data-goal="' + esc(g.id) + '">' + trophySVG(g.tier, 44) +
    '<div><h3>' + tore(g.at) + (g.last ? '<span class="tn-s"> · der große Fang</span>' : '') + '</h3><p' + (/^wird sp/i.test(String(g.reward || '').trim()) || !String(g.reward || '').trim() ? ' class="tbd"' : '') + '>' + goalText(g) + '</p><div class="state">' + state + '</div>' + bar + btn + '</div></div>';
}
function stickerCell(s, own, foilL) {
  const got = own.indexOf(s.id) >= 0, foil = foilL.indexOf(s.id) >= 0, R = RARITY[s.rar], no = s.id.slice(1);
  return '<button class="sticker r-' + s.rar + ' ' + (got ? 'got' : 'lock') + (foil ? ' foil' : '') + (U.newSticker === s.id ? ' new' : '') + '" data-act="sticker" data-id="' + s.id + '" aria-label="' + (got ? esc(plain(s.name)) + ', ' + R.name + ', ' + punkte(R.pts) : 'Sticker ' + (+no) + ', ' + R.name + ', noch nicht gefunden') + '">' +
    '<div class="in"><span class="no">Nr. ' + no + '</span><span class="em">' + s.ico + '</span><span class="nm2">' + (got ? esc(s.name) : '???') + '</span></div>' + (got ? '<span class="pt" aria-hidden="true">' + R.pts + '</span>' : '') + '</button>';
}
/* Sticker-Punkte und was sie bringen: je 10 Punkte ein Bonus-Tor. */
function stickerPointsCard(st) {
  const s = st.stickers, full = st.packs.complete;
  const pct = full ? 100 : (PTS_PER_TOR - s.toNext) / PTS_PER_TOR * 100;
  return '<section class="card stpoints" aria-label="Sticker-Punkte"><div class="sp-top"><div class="sp-n"><b>' + s.pts + '</b><span>Sticker-Punkte</span></div>' +
    '<div class="sp-bonus"><span class="sp-ball">' + ballSVG(30) + '</span><b>' + s.bonus + '</b><span>' + (s.bonus === 1 ? 'Bonus-Tor' : 'Bonus-Tore') + '</span></div></div>' +
    '<div class="bar sp-bar"><div class="fill" data-key="spts" data-to="' + pct + '" style="width:' + (U.bars.spts != null ? U.bars.spts : 0) + '%"></div></div>' +
    '<p class="hint">' + (full ? 'Alle Sticker gesammelt: mehr Punkte gibt es nicht.' : 'Noch <b>' + punkte(s.toNext) + '</b> bis zum nächsten Bonus-Tor.') + '</p>' +
    '<ul class="sp-legend">' + RAR_ORDER.slice().reverse().map(r => '<li><i class="rsw ' + r + '"></i><span><b>' + RARITY[r].name + '</b> ' + punkte(RARITY[r].pts) + '</span></li>').join('') + '</ul>' +
    '<p class="hint">Je ' + PTS_PER_TOR + ' Sticker-Punkte ergeben 1 Tor. Das zählt für deine Ziele und den Fang.</p></section>';
}
/* Aufstellung der Tore: gesamt, Minus durch Karten, was für Ziele und Fang zählt. Gibt es kein Minus, braucht es sie nicht. */
function scoreTally(st) {
  if (!st.minus) return '';
  return '<section class="card tally" aria-label="Tore und Minus"><div class="ty-row"><span>Tore gesamt</span><b>' + st.total + '</b></div>' +
    '<div class="ty-row minus"><span>Minus durch Karten</span><b>−' + st.minus + '</b></div>' +
    '<div class="ty-row sum"><span>Das zählt für Ziele und Fang</span><b>' + signed(st.score) + '</b></div></section>';
}
function viewAchieve(st) {
  const gl = goalList(S, st), last = gl[gl.length - 1], nx = gl.find(g => !g.reached);
  const p = last ? clamp(st.score / last.at, 0, 1) : 0, caught = st.caught;
  const shown = U.fish == null ? p : U.fish;
  const pct = Math.floor(p * 100);
  const left = last ? Math.max(0, last.at - st.score) : 0;
  let h = '<section class="card fang-card"><div class="fang-scene" data-p="' + p + '">' + fangSVG(shown) + '</div><div class="fang-meta">' +
    '<div class="top-line"><div><span class="eyebrow">Der große Fang</span><h2>' + esc(S.cfg.season.title) + '</h2></div><span class="pct">' + pct + '%</span></div>' +
    '<div class="bar"><div class="fill water" data-key="fang" data-to="' + (p * 100) + '" style="width:' + (U.bars.fang != null ? U.bars.fang : 0) + '%"></div></div>' +
    '<p class="hint">' + (caught ? '<b>Gefangen!</b> Petri Heil, der Fisch ist an Land.' : '<b>' + signed(st.score) + ' von ' + (last ? last.at : 0) + ' Toren.</b> Noch ' + tore(left) + ', dann ist der Fisch an Land.') + '</p>' +
    (last ? '<div class="reward-box"><span class="gift" aria-hidden="true">🎁</span><div><b>Die große Belohnung</b><span>' + goalText(last) + '</span></div></div>' : '') +
    packLine(st) + '</div></section>';
  h += scoreTally(st);
  h += '<div class="sec-h"><h2>Meine Ziele</h2>' + (U.unlocked ? '<button class="btn btn-ghost btn-sm" data-act="goto-sec" data-sec="ziele">Ziele ändern</button>' : '<span class="hint">' + tore(st.total) + ' insgesamt</span>') + '</div><div class="tiers">' + gl.map(g => goalRow(g, st, nx && nx.id === g.id)).join('') + '</div>';
  const own = S.prog.album || [], foilL = S.prog.foil || [];
  h += '<div class="sec-h"><h2>Sticker</h2><span class="hint">' + own.length + ' von ' + STICKERS.length + '</span></div>' + stickerPointsCard(st);
  RAR_ORDER.forEach(r => {
    const list = STICKERS.filter(s => s.rar === r), got = list.filter(s => own.indexOf(s.id) >= 0).length;
    h += '<div class="sec-h rar-h r-' + r + '"><h3>' + RARITY[r].name + '</h3><span class="hint">' + punkte(RARITY[r].pts) + ' · ' + got + ' von ' + list.length + '</span></div><div class="album">' + list.map(s => stickerCell(s, own, foilL)).join('') + '</div>';
  });
  return h;
}

/* ---------- Konto ---------- */
function kontoTitle(en) {
  const t = String(en.t || '').trim(), g = Math.round(+en.g) || 0;
  if (en.k === 'note') return 'Note ' + (g >= 1 && g <= 6 ? g : '?') + (t ? ': ' + t : '');
  if (en.k === 'pay') return t || 'Ausgezahlt';
  if (en.k === 'minus') return t || 'Abbuchung';
  return t || 'Gutschrift';
}
function kontoRow(en) {
  const c = Math.round(+en.c) || 0, out = c < 0, g = Math.round(+en.g) || 0;
  const ico = en.k === 'note' ? '<span class="gbadge">' + (g >= 1 && g <= 6 ? g : '·') + '</span>' : en.k === 'pay' ? IC.coin : out ? IC.minus : IC.plus;
  const when = /^\d{4}-\d{2}-\d{2}$/.test(en.ds || '') ? fmtShort(en.ds) : '';
  const kind = { note: 'Gutschrift für eine Note', plus: 'Gutschrift', minus: 'Abbuchung', pay: 'Ausgezahlt' }[en.k] || 'Buchung';
  return '<li class="ev kb ' + (out ? (en.k === 'pay' ? 'pay' : 'out') : 'good') + '"><span class="evi">' + ico + '</span><span class="evt">' + esc(kontoTitle(en)) + '<small>' + (when ? when + ' · ' : '') + kind + '</small></span>' +
    '<b class="evv">' + (out ? '−' : '+') + fmtEUR(Math.abs(c)) + '</b>' +
    (U.unlocked ? '<button class="evx" data-act="konto-del" data-id="' + esc(en.id) + '" aria-label="Buchung löschen">' + IC.cross + '</button>' : '<span></span>') + '</li>';
}
function viewKonto() {
  const bal = kontoBalance(S), list = kontoList(S);
  let h = '<section class="card konto-hero"><div class="kh-ico">' + coinSVG(76) + '</div><div class="kh-tx"><span class="eyebrow">' + esc(genitive(S.cfg.name)) + ' Konto</span>' +
    '<b class="kh-sum' + (bal > 0 ? '' : ' zero') + '" id="kontoSum">' + fmtEUR(bal) + '</b>' +
    '<small>' + (bal > 0 ? 'Dieses Geld schulden wir dir. Es gehört dir.' : 'Noch nichts auf dem Konto. Für gute Noten gibt es Geld!') + '</small></div></section>';
  if (U.unlocked && !U.readonly) {
    h += '<div class="xbtns kbtns">' +
      '<button class="xbtn k-note" data-act="konto-open" data-k="note">' + IC.star + '<span>Note</span></button>' +
      '<button class="xbtn" data-act="konto-open" data-k="plus">' + IC.plus + '<span>Gutschreiben</span></button>' +
      '<button class="xbtn" data-act="konto-open" data-k="minus">' + IC.minus + '<span>Abbuchen</span></button>' +
      '<button class="xbtn" data-act="konto-open" data-k="pay">' + IC.coin + '<span>Auszahlen</span></button></div>';
  }
  h += '<div class="sec-h"><h2>Buchungen</h2>' + (list.length ? '<span class="hint">' + list.length + '</span>' : '') + '</div>';
  h += list.length ? '<ul class="evs kl">' + list.map(kontoRow).join('') + '</ul>' : '<div class="card pad"><p class="hint">Noch keine Buchungen. Hier steht, was gutgeschrieben, abgebucht oder ausgezahlt wurde.</p></div>';
  return h;
}

/* ---------- Trainer ---------- */
const EMOJI_PRESETS = ['📓', '📒', '✏️', '🧹', '🧴', '📖', '🍽️', '🍴', '🤝', '🏅', '⭐', '📚', '🎒', '🦷', '🛏️', '🐕', '🎹', '⚽', '🎣', '💪'];
const TASK_IDEAS = [['🦷', 'Zähne geputzt'], ['🎒', 'Schultasche gepackt'], ['🎹', 'Geübt'], ['🛏️', 'Bett gemacht'], ['🐕', 'Hund ausgeführt'], ['🧸', 'Spielzeug aufgeräumt'], ['🗑️', 'Müll rausgebracht'], ['👕', 'Wäsche weggeräumt']];
const SECTIONS = [['aufgaben', 'Aufgaben'], ['ziele', 'Ziele'], ['karten', 'Karten'], ['konto', 'Konto'], ['spieler', 'Spieler']];
const RIVAL_IDEAS = ['Sofa United', 'Dynamo Ausrede', 'FC Später', 'FC Schweinehund'];
const stepper = (obj, key, val, min, max, step, unit) => '<div class="stepper"><button data-act="step" data-obj="' + obj + '" data-key="' + key + '" data-d="' + (-step) + '" data-min="' + min + '" data-max="' + max + '" aria-label="weniger">−</button><output>' + val + (unit || '') + '</output><button data-act="step" data-obj="' + obj + '" data-key="' + key + '" data-d="' + step + '" data-min="' + min + '" data-max="' + max + '" aria-label="mehr">+</button></div>';
const switchRow = (act, on, title, small, extra) => '<button class="switch" role="switch" aria-checked="' + on + '" data-act="' + act + '" ' + (extra || '') + '><span><b>' + title + '</b>' + (small ? '<small>' + small + '</small>' : '') + '</span><i class="sw"></i></button>';
const swatches = (cur, act) => '<div class="swatches" role="group" aria-label="Trikotfarbe">' + Object.keys(JERSEYS).map(k => '<button class="sw-c" data-act="' + act + '" data-c="' + k + '" aria-pressed="' + (cur === k) + '" aria-label="' + JERSEYS[k].name + '" style="--c:' + JERSEYS[k].fill + '"></button>').join('') + '</div>';

function adviceBox() {
  const adv = coachAdvice(S, U.today);
  if (!adv.length) return '';
  const lines = adv.map(a => {
    if (a.kind === 'agreement') return '<li data-adv="agreement"><b>Die Abmachung der Woche fehlt noch.</b> Legt sie gemeinsam mit ' + esc(S.cfg.name) + ' fest und tragt sie unter „Aufgaben“ ein. Sonst weiß er nicht, woran er sich halten soll.</li>';
    if (a.kind === 'reds') return '<li><b>Zwei Rote in 7 Tagen.</b> Die Hürde ist vermutlich zu hoch. Karten pausieren, Aufgaben reduzieren und in Ruhe reden. Bei Sorgen hilft eine Erziehungsberatung.</li>';
    if (a.kind === 'album') return '<li><b>Das Album ist komplett.</b> Das Sammeln ist geschafft: ein guter Zeitpunkt, die App zu verschlanken (Karten aus, Liste kürzen).</li>';
    return '<li><b>Das Ziel bei ' + tore(a.at) + ' (seit ' + fmtShort(a.since) + ') ist noch nicht eingelöst.</b> Bitte innerhalb von 7 Tagen einlösen.</li>';
  }).join('');
  return '<section class="warn-box"><b>Hinweise für dich</b><ul class="adv">' + lines + '</ul></section>';
}

function viewCoach(st) {
  if (!U.unlocked) {
    return '<section class="card gate"><div class="lockbig">' + IC.lock + '</div><h2>Nur für den Trainer</h2><p class="hint">Hier stellst du Aufgaben, Karten und Belohnungen ein.</p><button class="btn btn-lime" data-act="lock">Trainer-Code eingeben</button></section>';
  }
  const c = S.cfg, gs = c.goals;
  let h = adviceBox();
  h += '<section class="card coach-sec"><h2>Kurzanleitung</h2><p class="hint">Hier stellst du alles ein. Antippen springt zum Bereich.</p>' +
    '<div class="chips-r jump" role="group" aria-label="Bereiche">' + SECTIONS.map(s => '<button data-act="goto-sec" data-sec="' + s[0] + '">' + s[1] + '</button>').join('') + '</div>' +
    '<ul class="rules">' +
    '<li>' + IC.check.replace('<svg', '<svg style="color:var(--lime)"') + '<span><b>Tor</b> für jede geschaffte Aufgabe. <b>Kein Tor</b>: Der Gegner bekommt ein Tor.</span></li>' +
    '<li>' + IC.plus.replace('<svg', '<svg style="color:var(--lime)"') + '<span><b>Eigener Grund</b>: frei eingeben, wofür es ein Tor oder kein Tor gibt (Tor höchstens ' + c.extraMax + 'mal am Tag).</span></li>' +
    '<li>' + cardSVG('yellow', 22) + '<span><b>Gelb</b> ist eine Verwarnung: Minus ' + tore(c.yellowPts) + '. Gelbe verfallen nie. Zwei Gelbe ergeben automatisch Rot.</span></li>' +
    '<li>' + cardSVG('red', 22) + '<span><b>Rot</b>: Minus ' + tore(c.redPts) + '. Ein Grund ist nie nötig. In der Übersicht bleiben alle Tore stehen, das Minus wird nur bei Zielen und Fang abgezogen.</span></li>' +
    '<li>' + trophySVG('gold', 22) + '<span><b>Ziele</b>: Alle Tore zählen zusammen, abzüglich Minus. Es gibt Belohnungen von ' + gs[0].at + ' bis ' + gs[gs.length - 1].at + ' Toren.</span></li></ul>' +
    '<div class="row-btns"><button class="btn btn-ghost btn-sm" data-act="parents">Hinweise für Eltern</button><button class="btn btn-ghost btn-sm" data-act="rules">Regelbuch ansehen</button><button class="btn btn-ghost btn-sm" data-act="lock">' + IC.lock + 'Trainer-Modus beenden</button></div></section>';

  h += '<section class="card coach-sec" id="sec-aufgaben"><h2>Aufgaben</h2><p class="hint">Das ist die tägliche Liste. <b>Aufgabe antippen</b>, um Titel, Untertitel, Symbol, Wochentage und Tore zu ändern. Mit „Neue Aufgabe“ oder einer Idee legst du weitere Themen an.</p>' +
    '<div class="field"><span>Abmachung der Woche</span><input type="text" id="f-agreement" data-bind="cfg:agreement" value="' + esc(c.agreement) + '" maxlength="80" placeholder="Gemeinsam mit ' + esc(c.name) + ' festlegen, z. B. Nach dem Essen Tablet abgeben"><small>Steht bei „An Abmachungen gehalten“ als Untertitel.</small></div>' +
    '<div class="tlist" style="display:grid;gap:8px">' + c.tasks.filter(t => !(t.until && t.until <= U.today)).map(taskEditor).join('') + '</div>' +
    '<button class="btn btn-ghost" data-act="task-add">' + IC.plus + 'Neue Aufgabe</button>' +
    '<div class="field"><span>Ideen zum Antippen</span><div class="chips-r ideas" role="group" aria-label="Aufgaben-Ideen">' + TASK_IDEAS.map((t, i) => '<button data-act="task-idea" data-i="' + i + '">' + t[0] + ' ' + esc(t[1]) + '</button>').join('') + '</div></div></section>';

  h += '<section class="card coach-sec" id="sec-ziele"><h2>Ziele und Belohnungen</h2><p class="hint">Hier legst du fest, was ' + esc(c.name) + ' bei welchem Stand bekommt. Es zählen alle Tore zusammen (Aufgaben, eigene Gründe und Bonus-Tore der Sticker), nicht pro Woche. Das Minus von Gelben und Roten Karten wird davon abgezogen. Das letzte Ziel ist der große Fang. Steht bei der Belohnung „5 € aufs Guthabenkonto“, bucht die App den Betrag beim Einlösen aufs Konto. Bitte nie Essen, Schlaf, Verein, Freunde oder gewohnte gemeinsame Zeit als Belohnung oder Entzug einsetzen.</p>' +
    gs.map((g, i) => {
      const min = i > 0 ? gs[i - 1].at + 5 : 5, max = i < gs.length - 1 ? gs[i + 1].at - 5 : 100000;
      return '<div class="field goaled"><div class="row-btns" style="align-items:center;justify-content:space-between">' + stepper('goal:' + g.id, 'at', g.at, min, max, 5, ' Tore') +
        (gs.length > 1 ? '<button class="evx" data-act="goal-del" data-id="' + esc(g.id) + '" aria-label="Ziel bei ' + g.at + ' Toren entfernen">' + IC.cross + '</button>' : '') + '</div>' +
        '<input type="text" id="f-goal-' + esc(g.id) + '" data-bind="goal:' + esc(g.id) + ':reward" value="' + esc(g.reward) + '" maxlength="120" placeholder="Belohnung (leer: wird später festgelegt)" aria-label="Belohnung bei ' + g.at + ' Toren"></div>';
    }).join('') +
    '<button class="btn btn-ghost" data-act="goal-add">' + IC.plus + 'Ziel hinzufügen</button>' +
    '<div class="field"><span>Name des Fischs im Angelbild</span><input type="text" id="f-season-title" data-bind="season:title" value="' + esc(c.season.title) + '" maxlength="40" aria-label="Name des Fischs"></div>' +
    '<div class="field"><span>Sticker-Tüte</span><div class="row-btns" style="align-items:center">' + stepper('cfg', 'packEvery', c.packEvery, 3, 20, 1, ' Tore') + '</div><small>So viele Tore bis zur nächsten Tüte. Sticker zählen 1, 2 oder 5 Punkte (normal, selten, ultraselten), je ' + PTS_PER_TOR + ' Punkte ergeben 1 Bonus-Tor. Das ist fest.</small></div></section>';

  h += '<section class="card coach-sec" id="sec-karten"><h2>Karten</h2><p class="hint">Gelb ist eine Verwarnung. Zwei Gelbe ergeben automatisch Rot. Gelbe Karten verfallen nie. Jede Karte kostet Minus-Tore: Sie werden bei den Zielen und beim Fang abgezogen und stehen bei den Erfolgen als Minus. In der Übersicht und im Kopf zeigt die App weiter alle Tore von ' + esc(c.name) + '. Einen Grund musst du nie angeben. Du kannst jede Karte zurückziehen.</p>' +
    '<div class="field"><span>Gelbe Karte: Minus-Tore</span>' + stepper('cfg', 'yellowPts', c.yellowPts, 0, 5, 1, c.yellowPts === 1 ? ' Tor' : ' Tore') + '</div>' +
    '<div class="field"><span>Rote Karte: Minus-Tore</span>' + stepper('cfg', 'redPts', c.redPts, 1, 9, 1, c.redPts === 1 ? ' Tor' : ' Tore') + '<small>Wirkt höchstens einmal pro Tag, auch bei automatischem Rot.</small></div>' +
    '<div class="field"><span>Eigene Tor-Gründe höchstens pro Tag</span>' + stepper('cfg', 'extraMax', c.extraMax, 1, 10, 1, '') + '</div>' +
    '<div class="field"><span>Schnellauswahl für „Eigener Grund: Tor“</span><textarea id="f-good" data-bind="list:goodReasons" rows="5">' + esc(c.goodReasons.join('\n')) + '</textarea></div></section>';

  h += '<section class="card coach-sec" id="sec-konto"><h2>Konto</h2><p class="hint">Geld für Noten ist Anerkennung. 0 € heißt: Diese Note wird nicht gebucht. Bei jeder Buchung kannst du den Betrag noch ändern. Abgebucht wird nur mit ' + esc(genitive(c.name)) + ' Ja, nie als Strafe.</p>' +
    [1, 2, 3, 4, 5, 6].map(g => '<div class="kline"><span>Note ' + g + '</span>' + stepper('note', g, fmtEUR(c.noteMoney[g] || 0), 0, 2000, 50, '') + '</div>').join('') + '</section>';

  const j = c.jersey;
  h += '<section class="card coach-sec" id="sec-spieler"><h2>Spieler und Gegner</h2>' +
    '<div class="row2"><div class="field"><span>Name</span><input type="text" id="f-name" data-bind="cfg:name" value="' + esc(c.name) + '" maxlength="20"></div>' +
    '<div class="field"><span>Gegner</span><input type="text" id="f-rival" data-bind="cfg:rival" value="' + esc(c.rival) + '" maxlength="24"></div></div>' +
    '<div class="field"><span>Trikot</span><div class="row-btns" style="align-items:center">' + jerseySVG(j.color, j.num, 56, st.fish) + stepper('jersey', 'num', j.num, 1, 99, 1, '') + '</div>' + swatches(j.color, 'jersey-color') + '</div></section>';

  h += '<section class="card coach-sec"><h2>Ablauf und Ton</h2>' +
    switchRow('shoot-mode', c.shootMode !== false, esc(c.name) + ' schießt jedes Tor selbst', 'Du bestätigst, er tippt auf den Ball. Aus: Tore zählen sofort mit Effekt.') +
    switchRow('sound', !U.muted, 'Ton auf diesem Gerät', 'Torjubel, Netz und Publikum. Auf dem iPhone: Seitenschalter auf laut stellen.') +
    (c.pin ? '<div class="row-btns"><button class="btn btn-ghost btn-sm" data-act="pin-set">Code ändern</button><button class="btn btn-ghost btn-sm" data-act="pin-clear">Code entfernen</button></div>'
      : '<div class="warn-box"><span><b>Kein Trainer-Code gesetzt.</b> Dann kann ' + esc(c.name) + ' selbst Tore vergeben.</span><button class="btn btn-lime btn-sm" data-act="pin-set">Code festlegen</button></div>') + '</section>';

  const memTx = Store.cloud ? 'Der Stand liegt in eurer Datenbank in Europa und ist auf allen Geräten mit dem Familienlink gleich. Ohne Netz geht es weiter, geschrieben wird später nach.'
    : Store.mode === 'db' ? 'Der Stand liegt sicher in der Seite und ist auf allen deinen Geräten gleich.' : Store.lsOk ? 'Der Stand liegt nur auf diesem Gerät.' : 'Achtung: Der Stand wird hier nicht dauerhaft gespeichert.';
  const memBtns = Store.cloud && Store.cred ? '<div class="row-btns"><button class="btn btn-lime btn-sm" data-act="link-share">Familienlink teilen</button><button class="btn btn-ghost btn-sm" data-act="link-reset-ask">Dieses Gerät abmelden</button></div>' +
    '<p class="hint">Wer den Familienlink hat, sieht und ändert den Stand. Schick ihn nur an die Familie.</p>' : '';
  h += '<section class="card coach-sec" id="sec-speicher"><h2>Speicher</h2><p class="hint">' + memTx + '</p>' + memBtns +
    '<button class="btn btn-ghost btn-sm" data-act="reset-ask">Alles zurücksetzen</button></section>';
  return h;
}
function taskEditor(t) {
  const open = U.editTask === t.id;
  const dd = t.days.slice().sort().map(d => WD_SHORT[d]);
  const days = t.days.length === 7 ? 'täglich' : t.days.length === 5 && [1, 2, 3, 4, 5].every(d => t.days.indexOf(d) >= 0) ? 'Mo–Fr' : dd.join(' ');
  let h = '<button class="trow' + (open ? ' open' : '') + '" data-act="task-edit" data-id="' + t.id + '" aria-expanded="' + open + '"><span class="ico">' + esc(t.icon) + '</span><span><b>' + esc(t.title || 'Neue Aufgabe') + '</b><span class="s">' + days + ' · ' + (t.bonus ? 'Bonus ' : '') + tore(t.pts) + '</span></span>' + IC.chevR + '</button>';
  if (!open) return h;
  const i = S.cfg.tasks.indexOf(t);
  h += '<div class="tedit"><div class="field"><span>Symbol</span><div class="emojis">' + EMOJI_PRESETS.map(e => '<button data-act="emoji" data-id="' + t.id + '" data-e="' + e + '" aria-pressed="' + (t.icon === e) + '">' + e + '</button>').join('') + '</div></div>' +
    '<div class="field"><span>Titel</span><input type="text" id="te-title" data-bind="task:' + t.id + ':title" value="' + esc(t.title) + '" maxlength="40"></div>' +
    '<div class="field"><span>Untertitel (woran man es erkennt)</span><input type="text" id="te-sub" data-bind="task:' + t.id + ':sub" value="' + esc(t.sub) + '" maxlength="70"></div>' +
    '<div class="field"><span>Tore</span>' + stepper('task:' + t.id, 'pts', t.pts, 1, 5, 1, '') + '</div>' +
    switchRow('task-bonus', !!t.bonus, 'Bonus-Aufgabe', 'Zählt nur, wenn sie klappt. Es gibt nie „Kein Tor“ dafür.', 'data-id="' + t.id + '"') +
    '<div class="field"><span>Wochentage</span><div class="dchips">' + [1, 2, 3, 4, 5, 6, 0].map(d => '<button data-act="task-day" data-id="' + t.id + '" data-d="' + d + '" aria-pressed="' + (t.days.indexOf(d) >= 0) + '">' + WD_SHORT[d] + '</button>').join('') + '</div></div>' +
    '<div class="row-btns"><button class="btn btn-ghost btn-sm" data-act="task-move" data-id="' + t.id + '" data-d="-1"' + (i <= 0 ? ' disabled' : '') + '>Nach oben</button><button class="btn btn-ghost btn-sm" data-act="task-move" data-id="' + t.id + '" data-d="1"' + (i >= S.cfg.tasks.length - 1 ? ' disabled' : '') + '>Nach unten</button><button class="btn btn-ghost btn-sm" data-act="task-del" data-id="' + t.id + '">Entfernen</button></div></div>';
  return h;
}
