/* ============ Minispiele ============
   Fünf Minispiele (Hochhalten, Elfmeter, Angeln, Raubfisch, Fischsprung) und zwei Bonusspiele (Endgegner, Meteoritenhagel).
   Spielzeit: jedes Tor von gestern = 1 Minute Minispiele, jedes Tor des Gegners von gestern = 1 Minute Bonusspiele;
   nur heute und erst ab 14 Uhr (Regeln: playState in logic.js). Die Uhr läuft, solange das Spielfenster offen und die App sichtbar ist.
   Verbrauch und Bestwerte stehen in cfg/play. Im Trainer-Modus lassen sich alle Spiele ohne Uhr ausprobieren. Kein Spiel bringt Tore.
   Die Echtzeit-Spiele zeichnen auf eine Leinwand (canvas); Start- und Ergebnistexte liegen als HTML darüber. */
let gameTimers = [];
const gLater = (fn, ms) => { const t = setTimeout(fn, ms); gameTimers.push(t); return t; };
function gameStop() {
  gameTimers.forEach(clearTimeout); gameTimers = [];
  if (U.game && U.game.raf) cancelAnimationFrame(U.game.raf);
  U.game = null; window.__game = null;
}
const gameAlive = g => U.game === g && U.sheet === 'sheet-game';
const rnd = n => Math.floor(Math.random() * n);
const rr = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

const GAMES = {
  juggle: { name: 'Hochhalten', sub: 'Sterne, Wind, Tricks', art: () => '<span class="gt-jug">' + ballSVG(28) + '<i>⭐</i></span>' },
  elfer: { name: 'Elfmeter', sub: 'Wischen und schießen', art: () => '<span class="gt-elf">' + goalSVG(56) + '<i>' + ballSVG(16) + '</i></span>' },
  angeln: { name: 'Angeln', sub: 'Anhauen und drillen', art: () => '<span class="gt-fish">' + FISH_ICO.Hecht + '</span>' },
  raubfisch: { name: 'Raubfisch', sub: 'Fressen und wachsen', art: () => '<span class="gt-fish">' + FISH_ICO.Zander + '</span>' },
  sprung: { name: 'Fischsprung', sub: 'Vorbei an den Haken', art: () => '<span class="gt-fish">' + FISH_ICO.Forelle + '</span>' },
  boss: { name: 'Endgegner', sub: 'Nach 30 Sekunden kaum zu schaffen', bonus: true, art: () => '<span class="gt-boss">' + monsterSVG('meh', 40) + '</span>' },
  meteor: { name: 'Meteoritenhagel', sub: 'Nach 15 Sekunden unmöglich', bonus: true, art: () => '<span class="gt-met">☄️</span>' },
};
const kindOf = id => (GAMES[id] && GAMES[id].bonus ? 'b' : 'r');
const gameBest = id => normPlay(S.play).best[id];
function gameRecord(id, v) {
  const rec = playRecord(S, id, v);
  if (!U.readonly) persist('cfg/play');
  return rec;
}

/* ---------- Spielzeit: Uhr ---------- */
const Play = { kind: null, free: false, last: 0, acc: 0, unsaved: 0, timer: 0 };
const playNow = () => playState(S, new Date());
const leftOf = (p, kind) => (kind === 'b' ? p.bonusLeft : p.regLeft);
function clockStart(kind, free) {
  clockStop();
  Object.assign(Play, { kind, free, last: performance.now(), acc: 0, unsaved: 0 });
  Play.timer = setInterval(clockTick, 1000);
  paintClock();
}
function clockTick() {
  if (!Play.kind) return;
  const now = performance.now(), dt = Math.min(2000, now - Play.last) / 1000; Play.last = now;
  if (document.hidden || Play.free) { paintClock(); return; }
  Play.acc += dt;
  const whole = Math.floor(Play.acc);
  if (whole > 0) {
    Play.acc -= whole; Play.unsaved += whole;
    playUse(S, todayStr(), Play.kind, whole);
    if (Play.unsaved >= 10) { Play.unsaved = 0; persist('cfg/play'); }
  }
  paintClock();
  const p = playNow();
  if (!p.open || leftOf(p, Play.kind) <= 0) timeUp();
}
function clockStop() {
  clearInterval(Play.timer); Play.timer = 0;
  if (Play.kind && !Play.free && Play.unsaved > 0) persist('cfg/play');
  Play.kind = null; Play.unsaved = 0; Play.acc = 0;
}
function paintClock() {
  const el = $('#gclock'); if (!el || !Play.kind) return;
  if (Play.free) { el.innerHTML = '<b>Trainer-Test</b>'; return; }
  const left = leftOf(playNow(), Play.kind);
  el.innerHTML = '⏱ <b>' + fmtMinSec(left) + '</b>';
  el.classList.toggle('low', left <= 30);
}
function timeUp() {
  const kind = Play.kind; clockStop(); gameStop();
  const p = playNow(), other = kind === 'b' ? p.regLeft : p.bonusLeft;
  Snd.soft(); Hap.go([40, 60, 40]);
  setSheet(gameHead('Abpfiff!') + '<div class="g-over"><span class="g-whistle">' + IC.whistle + '</span><p><b>Die Spielzeit ist um.</b></p>' +
    '<p class="hint">' + (!p.open ? 'Morgen ab ' + PLAY_FROM_HOUR + ' Uhr geht es weiter.' : other > 0 ? 'Du hast noch ' + fmtMinSec(other) + ' für ' + (kind === 'b' ? 'die Minispiele' : 'die Bonusspiele') + '.' : 'Jedes Tor heute bringt dir morgen eine Minute.') + '</p></div>' +
    '<button class="btn btn-lime btn-block" data-act="sheet-close">Fertig</button>');
}
/* Darf das Spiel jetzt starten? Im Trainer-Modus immer (ohne Uhr). */
function playGate(id) {
  if (U.unlocked) return { ok: true, free: true };
  const p = playNow();
  if (!p.open) return { ok: false, why: 'Die Spiele gehen heute ab ' + PLAY_FROM_HOUR + ' Uhr los.' };
  if (leftOf(p, kindOf(id)) <= 0) return { ok: false, why: kindOf(id) === 'b' ? 'Heute keine Zeit für die Bonusspiele.' : 'Heute keine Spielzeit mehr.' };
  return { ok: true, free: false };
}

/* ---------- Fenster ---------- */
const gameHead = title => '<div class="g-head"><h2>' + esc(title) + '</h2><span class="g-clock" id="gclock" aria-live="off"></span><button class="g-x" data-act="sheet-close" aria-label="Spiel schließen">' + IC.cross + '</button></div>';
const gameShell = id => gameHead(GAMES[id].name) + '<div class="g-body" id="gbody"></div><div class="g-foot" id="gfoot"></div>';
const setFoot = h => { const f = $('#gfoot'); if (f) f.innerHTML = h; };
const doneFoot = (msg, again) => '<p class="g-msg">' + msg + '</p><div class="row-btns"><button class="btn btn-lime" data-act="' + again + '">Nochmal!</button><button class="btn btn-ghost" data-act="sheet-close">Fertig</button></div>';
const START = { juggle: juggleStart, elfer: elferStart, angeln: angelStart, raubfisch: raubStart, sprung: sprungStart, boss: bossStart, meteor: metStart };

ACT['game-open'] = el => {
  const id = el.dataset.game;
  if (!GAMES[id]) return;
  const gate = playGate(id);
  if (!gate.ok) { toast(gate.why); return; }
  gameStop();
  openSheet(gameShell(id), 'sheet-game');
  clockStart(kindOf(id), gate.free);
  START[id]();
};
/* Aus closeSheet: Fenster zu = Spiel und Uhr aus, Stand auf Heute neu zeichnen. */
function gameClosed() { clockStop(); gameStop(); setTimeout(render, 0); }
/* App im Hintergrund: laufende Echtzeit-Spiele enden (sonst liefe es unsichtbar weiter). Die Uhr zählt dann nicht. */
function gamePause() { const g = U.game; if (g && g.phase !== 'over' && g.phase !== 'ready' && g.end) g.end(); }
/* Nochmal: nur, wenn noch Zeit da ist. */
function again(id) {
  const gate = playGate(id);
  if (!gate.ok && !Play.free) { timeUp(); return; }
  gameStop(); START[id]();
}
ACT['game-again'] = el => again(el.dataset.game);
const againFoot = (id, msg) => '<p class="g-msg">' + msg + '</p><div class="row-btns"><button class="btn btn-lime" data-act="game-again" data-game="' + id + '">Nochmal!</button><button class="btn btn-ghost" data-act="sheet-close">Fertig</button></div>';
const recTxt = (best, unit) => (best != null ? '<p class="hint">Dein Rekord: ' + best + (unit ? ' ' + unit : '') + '</p>' : '');
const startCard = (title, text, rec, act) => '<div class="catch-start"><p><b>' + title + '</b></p><p class="sm">' + text + '</p>' + rec + '<button class="btn btn-lime" data-act="' + act + '">Los!</button></div>';
const ovl = h => { const o = $('#govl'); if (o) o.innerHTML = h || ''; };

/* ---------- Leinwand, Eingabe, Takt, Effekte ---------- */
function stage(hud) {
  const b = $('#gbody'); if (!b) return null;
  b.innerHTML = (hud ? '<div class="g-hud">' + hud + '</div>' : '') + '<div class="gstage"><canvas class="gcv"></canvas><div class="g-ovl" id="govl"></div></div>';
  const cv = b.querySelector('.gcv'), ctx = cv.getContext('2d');
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(240, Math.round(r.width)), H = Math.max(260, Math.round(r.height));
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cv, ctx, W, H };
}
function onPtr(g, cv, h) {
  const pos = ev => { const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top, t: performance.now() }; };
  cv.addEventListener('pointerdown', ev => { if (U.game !== g) return; ev.preventDefault(); try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ } Snd.wake(); if (h.down) h.down(pos(ev)); });
  cv.addEventListener('pointermove', ev => { if (U.game === g && h.move) h.move(pos(ev)); });
  const up = ev => { if (U.game === g && h.up) h.up(pos(ev)); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
function runLoop(g, step) {
  g.last = performance.now();
  const f = now => {
    if (!gameAlive(g)) return;
    const dt = Math.min(.05, Math.max(0, now - g.last) / 1000); g.last = now; g.t += dt;
    step(dt);
    g.raf = requestAnimationFrame(f);
  };
  g.raf = requestAnimationFrame(f);
}
const newGame = (id, s, o) => Object.assign({ id, phase: 'ready', W: s.W, H: s.H, c: s.ctx, cv: s.cv, t: 0, raf: 0, parts: [], pops: [], shake: 0 }, o);
const popTxt = (g, x, y, txt, col, size) => g.pops.push({ x, y, txt, col: col || '#c6ff3d', size: size || 24, t: 0 });
function burst(g, x, y, col, n, sp) {
  for (let i = 0; i < (n || 14); i++) { const a = Math.random() * TAU, s = rr(.3, 1) * (sp || 220); g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rr(.35, .8), col: col || '#fff', r: rr(1.5, 3.8) }); }
}
function drawFx(g, dt) {
  const c = g.c;
  g.parts = g.parts.filter(p => (p.t += dt) < p.life);
  for (const p of g.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
  c.globalAlpha = 1; c.textAlign = 'center'; c.textBaseline = 'middle';
  g.pops = g.pops.filter(p => (p.t += dt) < 1.15);
  for (const p of g.pops) {
    const y = p.y - p.t * 42, sc = p.t < .12 ? .6 + p.t / .12 * .4 : 1;
    c.globalAlpha = Math.max(0, 1 - Math.max(0, p.t - .65) / .5);
    c.font = 'italic 900 ' + Math.round(p.size * sc) + 'px "Barlow Condensed", Impact, sans-serif';
    c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(p.txt, p.x, y); c.fillStyle = p.col; c.fillText(p.txt, p.x, y);
  }
  c.globalAlpha = 1;
}
function drawBall(c, x, y, r, rot) {
  c.save(); c.translate(x, y); c.rotate(rot || 0);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
  c.fillStyle = '#1d1d1d';
  const pent = (cx, cy, s) => { c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; c.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); } c.closePath(); c.fill(); };
  pent(0, 0, r * .36);
  for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + i * TAU / 5; pent(Math.cos(a) * r * .98, Math.sin(a) * r * .98, r * .32); }
  c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.arc(r * .25, r * .3, r * .95, 0, TAU); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = Math.max(1, r * .07); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.arc(x - r * .38, y - r * .42, r * .2, 0, TAU); c.fill();
}
function drawStar(c, x, y, r, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot || 0); c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * .45 : r; c.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
  c.closePath(); c.fillStyle = col || '#ffd23c'; c.shadowColor = col || '#ffd23c'; c.shadowBlur = 14; c.fill(); c.restore();
}
/* Fische aus den Sticker-Zeichnungen (Kopf links) als Bilder für die Leinwand. */
const FIMG = {};
function fishImg(name) {
  if (FIMG[name]) return FIMG[name];
  const im = new Image();
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(String(FISH_ICO[name]).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="80" '));
  return (FIMG[name] = im);
}
/* Fisch mit Blickrichtung a (Bogenmaß), Länge len. */
function drawFish(c, name, x, y, len, a, alpha) {
  const im = fishImg(name); if (!im.complete || !im.naturalWidth) return;
  c.save(); c.translate(x, y);
  if (Math.cos(a) >= 0) { c.rotate(a); c.scale(-1, 1); } else c.rotate(a - Math.PI);
  if (alpha != null) c.globalAlpha = alpha;
  c.drawImage(im, -len / 2, -len * .3125, len, len * .625);
  c.restore();
}
const setHud = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };

/* ======================= 1. Hochhalten ======================= */
/* Tippe genau auf den Ball: Mitte = gerade hoch (Perfekt, 2 Punkte, Serie gibt mehr), Rand = zur Seite. Sterne bringen 5.
   Alle 8 Kontakte ein Level: mehr Schwerkraft, kleinerer Ball, ab Level 3 wechselnder Wind. */
function juggleStart() {
  const s = stage('<span class="ct-score">Punkte <b id="hS">0</b></span><span class="ct-score">Level <b id="hL">1</b></span><span class="g-wind" id="hW"></span>');
  const g = U.game = newGame('juggle', s, { x: s.W / 2, y: s.H * .42, vx: 0, vy: 0, r: 30, rot: 0, score: 0, kicks: 0, combo: 0, lvl: 1, wind: 0, star: null, nextStar: 2 });
  window.__game = g;
  ovl(startCard('Halte den Ball in der Luft!', 'Tippe genau auf den Ball. Triffst du die Mitte, fliegt er gerade hoch (Perfekt!). Am Rand fliegt er zur Seite. Schieß ihn durch die Sterne. Ab Level 3 kommt Wind.', recTxt(gameBest('juggle'), 'Punkte'), 'jug-go'));
  setFoot('<p class="g-msg">Wie viele Punkte schaffst du?</p>');
  onPtr(g, s.cv, { down: p => jugKick(g, p) });
  runLoop(g, dt => jugStep(g, dt));
}
ACT['jug-go'] = () => {
  const g = U.game; if (!g || g.id !== 'juggle' || g.phase !== 'ready') return;
  ovl(''); g.phase = 'play'; g.vy = -g.H * .9; g.nextStar = g.t + 2.5; g.end = () => juggleEnd(g);
};
function jugKick(g, p) {
  if (g.phase !== 'play') return;
  const d = Math.hypot(p.x - g.x, p.y - g.y);
  if (d > g.r * 1.75 || g.vy < -g.H * .55) return;                 // daneben oder der Ball steigt noch
  const off = clamp((g.x - p.x) / g.r, -1.2, 1.2), perfect = d < g.r * .38;
  g.vy = -g.H * rr(1.16, 1.24); g.vx = off * g.H * .62 + g.vx * .25;
  g.kicks++; g.combo = perfect ? g.combo + 1 : 0;
  const pts = perfect ? (g.combo >= 3 ? 3 : 2) : 1;
  g.score += pts;
  popTxt(g, g.x, g.y - g.r - 12, perfect ? (g.combo >= 3 ? 'Perfekt ×' + g.combo + '!' : 'Perfekt! +2') : '+1', perfect ? '#ffd23c' : '#ffffff', perfect ? 26 : 20);
  burst(g, p.x, p.y, perfect ? '#ffd23c' : '#c6ff3d', perfect ? 12 : 6, 140);
  Snd.kick(); Hap.go(perfect ? 20 : 10);
  const lvl = 1 + Math.floor(g.kicks / 8);
  if (lvl > g.lvl) {
    g.lvl = lvl; g.r = Math.max(19, 30 - (lvl - 1) * 1.6); Snd.sparkle();
    popTxt(g, g.W / 2, g.H * .3, 'Level ' + lvl + '!', '#c6ff3d', 38);
    if (lvl === 3) popTxt(g, g.W / 2, g.H * .4, 'Achtung, Wind!', '#38c9f2', 26);
  }
  setHud('hS', g.score); setHud('hL', g.lvl);
}
function jugStep(g, dt) {
  const c = g.c, W = g.W, H = g.H, floor = H - 24;
  if (g.phase === 'play') {
    const grav = H * (1.85 + (g.lvl - 1) * .13);
    g.wind = g.lvl >= 3 ? Math.sin(g.t * .55) * H * (.16 + (g.lvl - 3) * .05) : 0;
    g.vx += g.wind * dt; g.vy += grav * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.rot += g.vx * dt / g.r;
    if (g.x < g.r) { g.x = g.r; g.vx = Math.abs(g.vx) * .7; }
    if (g.x > W - g.r) { g.x = W - g.r; g.vx = -Math.abs(g.vx) * .7; }
    if (g.y < g.r) { g.y = g.r; g.vy = Math.abs(g.vy) * .35; }
    if (!g.star && g.t > g.nextStar) g.star = { x: rr(40, W - 40), y: rr(H * .12, H * .48), t: 0 };
    if (g.star) {
      g.star.t += dt;
      if (Math.hypot(g.star.x - g.x, g.star.y - g.y) < g.r + 16) {
        g.score += 5; setHud('hS', g.score); Snd.sparkle(); Hap.go(25);
        popTxt(g, g.star.x, g.star.y, '+5 ⭐', '#ffd23c', 30); burst(g, g.star.x, g.star.y, '#ffd23c', 22, 260);
        g.star = null; g.nextStar = g.t + rr(1.5, 3.5);
      } else if (g.star.t > 6) { g.star = null; g.nextStar = g.t + rr(1, 2.5); }
    }
    if (g.y > floor - g.r) { g.y = floor - g.r; juggleEnd(g); }
    const w = $('#hW'); if (w) w.textContent = Math.abs(g.wind) > H * .03 ? (g.wind < 0 ? '← Wind' : 'Wind →') : '';
  } else if (g.phase === 'ready') { g.y = H * .42 + Math.sin(g.t * 3) * 8; g.rot += dt * .8; }
  // Bild
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#237a3a' : '#1f6a33'; c.fillRect(i * W / 8, 0, W / 8 + 1, H); }
  c.fillStyle = '#134b22'; c.fillRect(0, floor, W, H - floor);
  c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, floor, W, 2);
  if (g.wind) { c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = H * .12 + i * H * .12, x = ((g.t * g.wind * .9 + i * 97) % (W + 80) + W + 80) % (W + 80) - 40; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sign(g.wind) * 38, y); c.stroke(); } }
  const hgt = clamp((floor - g.y) / H, 0, 1);
  c.fillStyle = 'rgba(0,0,0,' + (.35 - hgt * .25) + ')'; c.beginPath(); c.ellipse(g.x, floor + 4, g.r * (1.1 - hgt * .5), 5, 0, 0, TAU); c.fill();
  if (g.star) drawStar(c, g.star.x, g.star.y, 15 + Math.sin(g.t * 6) * 2, g.t, '#ffd23c');
  drawBall(c, g.x, g.y, g.r, g.rot);
  drawFx(g, dt);
}
function juggleEnd(g) {
  if (g.phase !== 'play') return;
  g.phase = 'over'; Snd.soft(); Hap.go([40, 40]);
  const rec = gameRecord('juggle', g.score);
  if (rec) { Snd.fanfare(); FX.party(['⚽', '⭐']); }
  setFoot(againFoot('juggle', '<b>' + g.score + ' Punkte</b> (' + g.kicks + ' Kontakte, Level ' + g.lvl + ').' + (rec ? ' Neuer Rekord!' : '')));
}

/* ======================= 2. Elfmeter ======================= */
/* Vom Ball zum Tor wischen: Richtung = Richtung, Tempo = Höhe (schnell = hoch, zu schnell = drüber, langsam = flach und lahm).
   Der Torwart rät eine Ecke und wird mit jedem Level schneller und schlauer. Drei Fehlschüsse und es ist vorbei. */
const elfLvlOf = goals => 1 + Math.floor(goals / 3);
function elferStart() {
  const s = stage('<span class="ct-score">Tore <b id="eG">0</b></span><span class="ct-score">Level <b id="eL">1</b></span><span class="ct-score miss" id="eM">○○○</span>');
  const W = s.W, H = s.H, gw = W * .8, gh = gw * .36;
  const g = U.game = newGame('elfer', s, { gw, gh, gx: (W - gw) / 2, gy: H * .13, sx: W / 2, sy: H * .84, goals: 0, misses: 0, lvl: 1, kx: W / 2, kdive: 0, kup: 0, shot: null, swipe: null, net: 0, first: true });
  g.GL = g.gy + gh; window.__game = g;
  ovl(startCard('Elfmeterschießen', 'Wische vom Ball Richtung Tor. Die Richtung bestimmt die Ecke. Schnell gewischt fliegt der Ball hoch, zu schnell geht er drüber. Flache, langsame Schüsse hält der Torwart. Drei Fehlschüsse und es ist vorbei.', recTxt(gameBest('elfer'), 'Tore'), 'elf-go'));
  setFoot('<p class="g-msg">Ziel auf die Ecken!</p>');
  onPtr(g, s.cv, {
    down: p => { if (g.phase === 'aim') g.swipe = { x0: p.x, y0: p.y, t0: p.t, x: p.x, y: p.y }; },
    move: p => { if (g.swipe) { g.swipe.x = p.x; g.swipe.y = p.y; } },
    up: p => { const sw = g.swipe; g.swipe = null; if (sw && g.phase === 'aim') elfShoot(g, p.x - sw.x0, p.y - sw.y0, p.t - sw.t0); },
  });
  runLoop(g, dt => elfStep(g, dt));
}
ACT['elf-go'] = () => { const g = U.game; if (!g || g.id !== 'elfer' || g.phase !== 'ready') return; ovl(''); g.phase = 'aim'; g.end = () => elfEnd(g); };
function elfShoot(g, dx, dy, dur) {
  if (dy > -25) { popTxt(g, g.W / 2, g.sy - 60, 'Nach oben wischen!', '#ffffff', 22); return; }
  const v = Math.hypot(dx, dy) / Math.max(45, dur);                       // Pixel pro Millisekunde
  const u = (dx / -dy) * .87 + rr(-.015, .015);                           // Anteil der Torbreite links/rechts der Mitte
  const h = Math.max(0, (v - .55) / 1.65);                                 // 0 = flach, 1 = Latte
  const T = clamp(.95 - v * .2, .42, .9);
  const lvl = g.lvl, guess = Math.random() < Math.min(.85, .58 + .05 * (lvl - 1));
  let dir = Math.abs(u) < .07 ? 0 : Math.sign(u);
  if (!guess) dir = Math.random() < .25 ? 0 : (dir ? -dir : (Math.random() < .5 ? -1 : 1));
  g.shot = { u, h, T, t: 0, tx: g.W / 2 + u * g.gw, ty: g.GL - Math.min(h, 1.35) * g.gh, dir, kStart: g.kx,
    kTarget: g.W / 2 + dir * g.gw * Math.min(.4, .29 + .02 * (lvl - 1)), rt: Math.max(.1, .3 - .025 * (lvl - 1)), kSpeed: g.gw * (1.25 + .1 * (lvl - 1)) };
  g.phase = 'fly'; g.first = false; Snd.kick(); Hap.go(15);
}
function elfResolve(g) {
  const s = g.shot, au = Math.abs(s.u), W = g.W;
  let res;
  if (Math.abs(au - .5) < .022 && s.h < 1.03) res = 'Pfosten!';
  else if (au < .5 && s.h >= .97 && s.h < 1.06) res = 'Latte!';
  else if (au >= .5) res = 'Daneben!';
  else if (s.h > 1) res = 'Drüber!';
  else {
    const half = g.gw * (s.dir ? .12 : .09) - (s.h > .8 ? g.gw * .035 : 0);
    res = Math.abs(s.tx - g.kx) < half ? 'Gehalten!' : 'TOR!';
  }
  const goal = res === 'TOR!';
  if (goal) {
    g.goals++; g.net = .6; Snd.goal(); Hap.go([20, 30, 20]);
    burst(g, s.tx, s.ty, '#c6ff3d', 24, 260);
    popTxt(g, W / 2, g.gy + g.gh * .5, au > .38 || s.h > .78 ? 'TRAUMTOR!' : 'TOR!', '#c6ff3d', 44);
    const nl = elfLvlOf(g.goals);
    if (nl > g.lvl) { g.lvl = nl; gLater(() => { if (gameAlive(g)) popTxt(g, W / 2, g.GL + 40, 'Level ' + nl + ': Torwart wird besser!', '#ffd23c', 22); }, 500); }
  } else {
    g.misses++; res === 'Gehalten!' ? Snd.soft() : Snd.stamp(); Hap.go(30);
    popTxt(g, W / 2, g.gy + g.gh * .5, res, res === 'Gehalten!' ? '#ff8f88' : '#ffffff', 40);
  }
  setHud('eG', g.goals); setHud('eL', g.lvl); setHud('eM', '●●●'.slice(0, g.misses) + '○○○'.slice(g.misses));
  g.phase = 'result';
  gLater(() => {
    if (!gameAlive(g)) return;
    g.shot = null; g.kdive = 0; g.kx = g.W / 2;
    if (g.misses >= 3) elfEnd(g); else g.phase = 'aim';
  }, 1150);
}
function elfEnd(g) {
  if (g.phase === 'over') return;
  g.phase = 'over';
  const rec = gameRecord('elfer', g.goals);
  if (rec) { Snd.fanfare(); FX.party(['⚽', '🏆']); }
  setFoot(againFoot('elfer', '<b>' + tore(g.goals) + '</b> bis Level ' + g.lvl + '.' + (rec ? ' Neuer Rekord!' : '')));
}
function drawKeeper(c, x, base, h, dive, up) {
  c.save(); c.translate(x, base - up); c.rotate(dive * 1.15);
  const w = h * .34;
  c.fillStyle = '#1b2433'; c.fillRect(-w * .42, -h * .36, w * .34, h * .36); c.fillRect(w * .08, -h * .36, w * .34, h * .36);   // Beine
  c.fillStyle = '#ff8a1f'; c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -h * .78, w, h * .46, 8) : c.rect(-w / 2, -h * .78, w, h * .46); c.fill();   // Trikot
  c.strokeStyle = '#ff8a1f'; c.lineWidth = w * .26; c.lineCap = 'round';
  const arm = dive ? -1.25 : -.55;
  c.beginPath(); c.moveTo(-w * .45, -h * .72); c.lineTo(-w * .45 - Math.cos(arm) * h * .32, -h * .72 + Math.sin(arm) * h * .32); c.stroke();
  c.beginPath(); c.moveTo(w * .45, -h * .72); c.lineTo(w * .45 + Math.cos(arm) * h * .32, -h * .72 + Math.sin(arm) * h * .32); c.stroke();
  c.fillStyle = '#7cff6b';
  c.beginPath(); c.arc(-w * .45 - Math.cos(arm) * h * .34, -h * .72 + Math.sin(arm) * h * .34, w * .2, 0, TAU); c.fill();
  c.beginPath(); c.arc(w * .45 + Math.cos(arm) * h * .34, -h * .72 + Math.sin(arm) * h * .34, w * .2, 0, TAU); c.fill();
  c.fillStyle = '#f2c19a'; c.beginPath(); c.arc(0, -h * .88, h * .11, 0, TAU); c.fill();
  c.fillStyle = '#3a2416'; c.beginPath(); c.arc(0, -h * .92, h * .1, Math.PI, TAU); c.fill();
  c.restore();
}
function elfStep(g, dt) {
  const c = g.c, W = g.W, H = g.H, { gx, gy, gw, gh, GL } = g;
  // Torwart wartet leicht pendelnd, beim Schuss springt er nach der Reaktionszeit in seine Ecke
  if (g.phase === 'aim' || g.phase === 'ready') g.kx = W / 2 + Math.sin(g.t * 1.7) * gw * .045 * (1 + g.lvl * .15);
  let bx = g.sx, by = g.sy, br = 17;
  if (g.shot) {
    const s = g.shot;
    if (g.phase === 'fly') s.t += dt;
    const p = Math.min(1, s.t / s.T);
    bx = g.sx + (s.tx - g.sx) * p; by = g.sy + (s.ty - g.sy) * p - Math.sin(p * Math.PI) * gh * .22 * Math.min(1, s.h + .2); br = 17 - 8 * p;
    if (s.t > s.rt && s.dir) { const d = s.kTarget - g.kx; g.kx += clamp(d, -s.kSpeed * dt, s.kSpeed * dt); g.kdive = clamp((g.kx - s.kStart) / (gw * .3), -1, 1); }
    g.kup = s.dir && s.h > .5 && s.t > s.rt ? Math.min(gh * .25, (s.t - s.rt) * gh) : 0;
    if (g.phase === 'fly' && p >= 1) elfResolve(g);
  }
  // Tribüne und Rasen
  c.fillStyle = '#0b1f13'; c.fillRect(0, 0, W, GL);
  for (let i = 0; i < 90; i++) { c.fillStyle = ['#ff5a52', '#ffd23c', '#38c9f2', '#ffffff', '#c6ff3d'][i % 5]; c.globalAlpha = .28; c.fillRect((i * 53) % W, (i * 29) % (gy + 6), 3, 3); }
  c.globalAlpha = 1;
  for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#237a3a' : '#1f6a33'; const y0 = GL + (H - GL) * (i / 7) ** 1.3, y1 = GL + (H - GL) * ((i + 1) / 7) ** 1.3; c.fillRect(0, y0, W, y1 - y0 + 1); }
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(gx - gw * .18, GL); c.lineTo(gx - gw * .3, H * .6); c.lineTo(gx + gw * 1.3, H * .6); c.lineTo(gx + gw * 1.18, GL); c.stroke();
  // Tor mit Netz (wackelt nach einem Tor)
  if (g.net > 0) g.net = Math.max(0, g.net - dt);
  const bul = g.net * 10;
  c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1;
  for (let x = gx; x <= gx + gw; x += 12) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x + Math.sin(x + g.t * 30) * bul * .3, GL); c.stroke(); }
  for (let y = gy; y <= GL; y += 12) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx + gw, y + Math.sin(y + g.t * 30) * bul * .3); c.stroke(); }
  drawKeeper(c, g.kx, GL, gh * .8, g.kdive, g.kup);
  c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(gx, GL + 2); c.lineTo(gx, gy); c.lineTo(gx + gw, gy); c.lineTo(gx + gw, GL + 2); c.stroke();
  // Punkt, Ball, Wischspur
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(g.sx, g.sy + 14, 6, 3, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(bx, (g.shot ? g.sy + (g.GL - g.sy) * Math.min(1, g.shot.t / g.shot.T) : g.sy) + br * .9, br, br * .3, 0, 0, TAU); c.fill();
  drawBall(c, bx, by, br, g.shot ? g.shot.t * 18 : 0);
  if (g.swipe) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(g.swipe.x0, g.swipe.y0); c.lineTo(g.swipe.x, g.swipe.y); c.stroke(); }
  if (g.first && g.phase === 'aim') {
    const k = (g.t % 1.4) / 1.4; c.globalAlpha = 1 - k; c.fillStyle = '#fff';
    c.beginPath(); c.arc(g.sx + k * 40, g.sy - 30 - k * 110, 12, 0, TAU); c.fill(); c.globalAlpha = 1;
  }
  drawFx(g, dt);
}

/* ======================= 3. Angeln ======================= */
/* Auswerfen (Kraft stoppen: weit = größere Fische), auf den Biss warten (Zupfen ist kein Biss!), im richtigen Moment anhauen,
   dann drillen: Finger halten = einholen, loslassen = Schnur geben. Zieht der Fisch („Er zieht!“), nachgeben, sonst reißt die Schnur.
   Zu locker darf sie aber auch nicht lange sein. Rekord: der schwerste Fisch (in Gramm). */
const FISH_SP = [   // Name, kg von–bis, Wurfweite 0..1, Häufigkeit, Kraft 0..1
  ['Rotauge', .1, .6, .1, 1, .12], ['Barsch', .2, 1.8, .3, 1, .25], ['Forelle', .3, 2.6, .45, .9, .35], ['Aal', .4, 2.2, .55, .6, .42],
  ['Zander', 1, 9, .7, .6, .52], ['Karpfen', 2, 16, .6, .55, .58], ['Hecht', 2, 14, .85, .5, .66], ['Lachs', 3, 15, .95, .3, .72], ['Wels', 8, 60, 1, .16, .92],
];
function pickFish(d) {
  const w = FISH_SP.map(f => f[4] * Math.exp(-((d - f[3]) ** 2) / .06));
  let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
  while (i < w.length - 1 && (r -= w[i]) > 0) i++;
  const f = FISH_SP[i], q = Math.pow(Math.random(), 2.3), kg = f[1] + (f[2] - f[1]) * q;
  return { name: f[0], kg: Math.round(kg * 100) / 100, pow: clamp(f[5] * .75 + q * .35, .1, 1), win: .9 - f[5] * .45 };
}
const kgTxt = kg => (kg < 1 ? Math.round(kg * 1000) + ' g' : kg.toFixed(kg < 10 ? 2 : 1).replace('.', ',') + ' kg');
function angelStart() {
  const s = stage('<span class="ct-score">🎣 <b id="aN">0</b> Fische</span><span class="ct-score" id="aB">schwerster: –</span>');
  const g = U.game = newGame('angeln', s, { SY: s.H * .3, catches: [], heavy: 0, pw: 0, bob: null, fish: null, hold: false, msg: '' });
  g.tip = { x: s.W * .2, y: g.SY - s.H * .14 };
  g.deco = [0, 1, 2].map(i => ({ x: rr(0, s.W), y: rr(g.SY + 50, s.H - 30), v: rr(14, 30) * (i % 2 ? 1 : -1), n: ['Rotauge', 'Barsch', 'Karpfen'][i] }));
  window.__game = g;
  const best = gameBest('angeln');
  ovl(startCard('Petri Heil!', 'Tippe, um die Kraft beim Auswerfen zu stoppen: weit draußen beißen die Großen. Wackelt die Pose nur, ist das Zupfen. Erst wenn sie ganz untertaucht, schnell tippen! Beim Drillen: Finger halten = einholen, loslassen = Schnur geben. Wenn der Fisch zieht, loslassen!', best != null ? '<p class="hint">Dein Rekord: ' + kgTxt(best / 1000) + '</p>' : '', 'fish-go'));
  setFoot('<p class="g-msg">Wer fängt den Wels?</p>');
  onPtr(g, s.cv, { down: () => angDown(g), up: () => { g.hold = false; } });
  runLoop(g, dt => angStep(g, dt));
}
ACT['fish-go'] = () => { const g = U.game; if (!g || g.id !== 'angeln' || g.phase !== 'ready') return; ovl(''); angAim(g); };
function angAim(g) { g.phase = 'aim'; g.bob = null; g.fish = null; g.hold = false; g.pw0 = g.t; g.end = null; setFoot('<p class="g-msg">Tippe zum Auswerfen, wenn die Kraft stimmt.</p>'); }
function angDown(g) {
  if (g.phase === 'aim') {
    const d = 1 - Math.abs(((g.t - g.pw0) * 1.1) % 2 - 1);
    g.phase = 'cast'; g.castD = d; g.bob = { x: g.tip.x, y: g.tip.y, tx: g.W * (.36 + .56 * d), t: 0 };
    Snd.tap(); setFoot('<p class="g-msg">Warte auf den Biss …</p>');
  } else if (g.phase === 'wait') {
    if (g.bite) {
      g.phase = 'fight'; g.hold = true; Snd.kick(); Hap.go(30);
      g.fish = Object.assign(pickFish(g.castD), { D: 1, T: .35, slack: 0, burst: 0, nextBurst: g.t + rr(1, 2.2) });
      popTxt(g, g.bob.x, g.SY - 30, 'Angebissen!', '#c6ff3d', 30);
      setFoot('<p class="g-msg">Halten = einholen · Loslassen = Schnur geben</p>');
    } else angLost(g, g.nib ? 'Zu früh! Das war nur Zupfen.' : 'Zu früh! Der Fisch ist weg.');
  } else if (g.phase === 'fight') g.hold = true;
}
function angLost(g, msg) {
  g.phase = 'lost'; g.hold = false; Snd.soft(); popTxt(g, g.W / 2, g.SY + 40, msg, '#ff8f88', 24);
  gLater(() => { if (gameAlive(g) && g.phase === 'lost') angAim(g); }, 1500);
}
function angCatch(g) {
  const f = g.fish; g.phase = 'caught'; g.hold = false;
  g.catches.push(f); const grams = Math.round(f.kg * 1000);
  const big = grams > g.heavy; if (big) g.heavy = grams;
  const rec = gameRecord('angeln', grams);
  setHud('aN', g.catches.length); setHud('aB', 'schwerster: ' + kgTxt(g.heavy / 1000));
  Snd.fanfare(); Hap.go([30, 40, 30]); if (rec || f.name === 'Wels') FX.party(['🐟', '🎣']);
  ovl('<div class="catch-start fishcard"><span class="fc-img">' + FISH_ICO[f.name] + '</span><p><b>' + esc(f.name) + '</b></p><p class="fc-kg">' + kgTxt(f.kg) + '</p>' +
    (rec ? '<p class="fc-rec">Neuer Rekord!</p>' : big && g.catches.length > 1 ? '<p class="hint">Dein schwerster heute!</p>' : '') + '<button class="btn btn-lime" data-act="fish-next">Weiter angeln</button></div>');
  setFoot('<p class="g-msg">Petri Heil! ' + g.catches.length + (g.catches.length === 1 ? ' Fisch' : ' Fische') + ' gefangen.</p>');
}
ACT['fish-next'] = () => { const g = U.game; if (!g || g.id !== 'angeln' || g.phase !== 'caught') return; ovl(''); angAim(g); };
function angStep(g, dt) {
  const c = g.c, W = g.W, H = g.H, SY = g.SY, tip = g.tip;
  let tens = 0;
  if (g.phase === 'cast') {
    const b = g.bob; b.t += dt / .7; const p = Math.min(1, b.t);
    b.x = tip.x + (b.tx - tip.x) * p; b.y = tip.y + (SY - tip.y) * p - Math.sin(p * Math.PI) * H * .16;
    if (p >= 1) { b.y = SY; g.phase = 'wait'; g.biteAt = g.t + rr(1.8, 5); g.nibAt = g.t + rr(.5, 1.3); g.bite = false; g.nib = false; Snd.splash && Snd.splash(); burst(g, b.x, SY, '#bfe9ff', 12, 120); }
  } else if (g.phase === 'wait') {
    const b = g.bob; let dip = Math.sin(g.t * 2.2) * 1.5;
    if (!g.bite && g.t > g.biteAt) { g.bite = true; g.biteEnd = g.t + (.9 - g.castD * .4); Hap.go(15); }
    if (g.bite) { dip = 18; if (g.t > g.biteEnd) angLost(g, 'Köder geklaut!'); }
    else if (g.t > g.nibAt) { g.nib = true; dip = 5 * Math.sin((g.t - g.nibAt) / .25 * Math.PI); if (g.t > g.nibAt + .25) { g.nib = false; g.nibAt = g.t + rr(.5, 1.6); if (g.nibAt > g.biteAt - .4) g.nibAt = g.biteAt + 9; } }
    b.y = SY + dip;
  } else if (g.phase === 'fight') {
    const f = g.fish;
    if (g.t > f.nextBurst && !f.burst) { f.burst = g.t + rr(.5, 1.1) * (.7 + f.pow * .6); popTxt(g, W * .62, SY + 26, 'Er zieht!', '#ff8f88', 26); Hap.go(20); }
    const pulling = f.burst && g.t < f.burst;
    if (f.burst && !pulling) { f.burst = 0; f.nextBurst = g.t + rr(1, 2.6) * (1.25 - f.pow * .5); }
    if (g.hold) { f.D -= (.2 - f.pow * .07) * dt; f.T += ((.12 + f.pow * .26) + (pulling ? 1.1 + f.pow * .7 : 0)) * dt; }
    else { f.T -= .7 * dt; f.D += ((pulling ? .12 : .02) * (.5 + f.pow)) * dt; }
    f.T = Math.max(0, f.T);
    f.slack = f.T < .1 ? f.slack + dt : 0;
    if (f.T >= 1) angLost(g, 'Schnur gerissen!');
    else if (f.D >= 1.35) angLost(g, 'Entkommen!');
    else if (f.slack > 1.6) angLost(g, 'Zu locker! Er hat sich losgeschüttelt.');
    else if (f.D <= 0) angCatch(g);
    tens = f.T;
  }
  // Himmel, Ufer, Wasser
  const sky = c.createLinearGradient(0, 0, 0, SY); sky.addColorStop(0, '#3b6ea8'); sky.addColorStop(1, '#f6c27a'); c.fillStyle = sky; c.fillRect(0, 0, W, SY);
  c.fillStyle = '#1d3b24'; c.beginPath(); c.moveTo(0, SY); for (let x = 0; x <= W; x += 20) c.lineTo(x, SY - 18 - Math.sin(x * .05) * 8 - Math.sin(x * .13) * 5); c.lineTo(W, SY); c.fill();
  const wat = c.createLinearGradient(0, SY, 0, H); wat.addColorStop(0, '#2f7f8f'); wat.addColorStop(1, '#0a2a33'); c.fillStyle = wat; c.fillRect(0, SY, W, H - SY);
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { const y = SY + 8 + i * 9, o = (g.t * 20 + i * 40) % 60; c.beginPath(); for (let x = -60 + o; x < W; x += 60) { c.moveTo(x, y); c.lineTo(x + 22, y); } c.stroke(); }
  for (const f of g.deco) { f.x += f.v * dt; if (f.x < -40) f.x = W + 40; if (f.x > W + 40) f.x = -40; drawFish(c, f.n, f.x, f.y + Math.sin(g.t + f.y) * 4, 44, f.v > 0 ? 0 : Math.PI, .3); }
  // Steg und Angler
  c.fillStyle = '#6b4a2b'; c.fillRect(0, SY - 8, W * .16, 10); c.fillRect(W * .03, SY, 6, 40); c.fillRect(W * .12, SY, 6, 40);
  c.fillStyle = '#2b5fae'; c.fillRect(W * .07, SY - 48, 16, 40); c.fillStyle = '#f2c19a'; c.beginPath(); c.arc(W * .07 + 8, SY - 56, 9, 0, TAU); c.fill();
  c.fillStyle = '#2e7d32'; c.beginPath(); c.arc(W * .07 + 8, SY - 60, 9, Math.PI, TAU); c.fill();
  // Rute (biegt sich mit der Spannung) und Schnur
  const bend = tens * 30 + (g.phase === 'fight' && g.fish && g.fish.burst ? Math.sin(g.t * 40) * 3 : 0);
  const tx = tip.x + bend * .4, ty = tip.y + bend;
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * .07 + 12, SY - 30); c.quadraticCurveTo(tip.x - 10, tip.y + bend * .3, tx, ty); c.stroke();
  if (g.phase === 'fight' && g.fish) {
    const f = g.fish, fx = tx + 30 + (W * .62 - tx) * Math.min(1.2, f.D), fy = SY + 30 + Math.min(1.2, f.D) * (H - SY) * .45 + Math.sin(g.t * (f.burst ? 14 : 3)) * (f.burst ? 8 : 3);
    const flen = 44 + Math.min(f.kg, 40) * 2.2, fa = Math.atan2(ty - fy, tx - fx) + (f.burst ? Math.sin(g.t * 22) * .35 : Math.sin(g.t * 4) * .08);
    c.strokeStyle = tens > .8 ? '#ff5a52' : tens < .12 ? 'rgba(255,255,255,.35)' : '#ffffff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(tx, ty); if (tens < .12) c.quadraticCurveTo((tx + fx) / 2, fy + 30, fx, fy); else c.lineTo(fx, fy); c.stroke();
    drawFish(c, f.name, fx - Math.cos(fa) * flen * .44, fy - Math.sin(fa) * flen * .44, flen, fa);
    if (f.burst) burst(g, fx + rr(-10, 30), SY + 2, '#bfe9ff', 1, 90);
  } else if (g.bob) {
    const b = g.bob;
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo((tx + b.x) / 2, Math.max(ty, b.y) + 20, b.x, b.y); c.stroke();
    if (g.phase === 'wait') { c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x, b.y + 50); c.stroke(); }
    if (!(g.bite && g.phase === 'wait')) { c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(b.x, b.y - 4, 6, Math.PI, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y - 4, 6, 0, Math.PI); c.fill(); c.fillStyle = '#222'; c.fillRect(b.x - 1, b.y - 16, 2, 8); }
    else { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; const k = (g.t * 3) % 1; c.beginPath(); c.ellipse(b.x, SY, 10 + k * 26, 3 + k * 6, 0, 0, TAU); c.stroke(); c.fillStyle = '#ffd23c'; c.font = 'italic 900 34px "Barlow Condensed", Impact, sans-serif'; c.textAlign = 'center'; c.fillText('!', b.x, SY - 26); }
    if (g.nib && g.phase === 'wait') { c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.beginPath(); c.ellipse(b.x, SY, 14, 4, 0, 0, TAU); c.stroke(); }
  }
  // Kraftanzeige beim Auswerfen, Spannung beim Drill
  if (g.phase === 'aim') {
    const d = 1 - Math.abs(((g.t - g.pw0) * 1.1) % 2 - 1), bw = W * .7, bx = (W - bw) / 2, by = H - 34;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(bx - 3, by - 3, bw + 6, 20);
    const gr = c.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#c6ff3d'); gr.addColorStop(1, '#ff8a1f'); c.fillStyle = gr; c.fillRect(bx, by, bw * d, 14);
    c.fillStyle = '#fff'; c.font = '700 14px Barlow, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('Kraft: tippen zum Auswerfen', W / 2, by - 12);
  }
  if (g.phase === 'fight') {
    const gx = W - 30, gy = SY + 16, gh = H - SY - 40;
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(gx - 4, gy - 4, 22, gh + 8);
    c.fillStyle = 'rgba(198,255,61,.25)'; c.fillRect(gx, gy + gh * (1 - .8), 14, gh * (.8 - .12));
    c.fillStyle = 'rgba(255,90,82,.4)'; c.fillRect(gx, gy, 14, gh * .2);
    c.fillStyle = tens > .8 ? '#ff5a52' : tens < .12 ? '#9fb0a4' : '#c6ff3d'; c.fillRect(gx, gy + gh * (1 - Math.min(1, tens)), 14, gh * Math.min(1, tens));
    c.save(); c.translate(gx - 10, gy + gh / 2); c.rotate(-Math.PI / 2); c.fillStyle = '#fff'; c.font = '700 12px Barlow, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('Spannung', 0, 0); c.restore();
    const f = g.fish, pbw = W * .5;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(16, H - 26, pbw, 12); c.fillStyle = '#38c9f2'; c.fillRect(16, H - 26, pbw * clamp(1 - f.D, 0, 1), 12);
    c.fillStyle = '#fff'; c.font = '700 12px Barlow, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('eingeholt', 20 + pbw, H - 20);
  }
  drawFx(g, dt);
}

/* ======================= 4. Raubfisch ======================= */
/* Du bist ein kleiner Hecht: Finger aufs Wasser, er schwimmt hin. Friss kleinere Fische und wachse, meide größere (rot umrandet).
   Große Räuber jagen dich, wenn du ihnen zu nahe kommst. Mit der Zeit werden es mehr Räuber. */
function raubStart() {
  const s = stage('<span class="ct-score">Punkte <b id="rS">0</b></span><span class="ct-score">Größe <b id="rL">1</b></span>');
  const g = U.game = newGame('raubfisch', s, { me: { x: s.W / 2, y: s.H / 2, a: 0, L: 46 }, tgt: null, npcs: [], spawn: 0, score: 0, lastEat: -9, eaten: 0, bubbles: [] });
  window.__game = g;
  ovl(startCard('Fressen und wachsen', 'Halte den Finger aufs Wasser: Dein Hecht schwimmt dorthin. Fang Fische, die kleiner sind als du. Rot umrandete Fische sind größer: Die fressen dich! Je größer du wirst, desto mehr kannst du jagen.', recTxt(gameBest('raubfisch'), 'Punkte'), 'raub-go'));
  setFoot('<p class="g-msg">Werde der größte Fisch im See!</p>');
  onPtr(g, s.cv, { down: p => { g.tgt = p; }, move: p => { if (g.tgt) g.tgt = p; }, up: () => { g.tgt = null; } });
  for (let i = 0; i < 5; i++) raubSpawn(g, true);
  runLoop(g, dt => raubStep(g, dt));
}
ACT['raub-go'] = () => { const g = U.game; if (!g || g.id !== 'raubfisch' || g.phase !== 'ready') return; ovl(''); g.phase = 'play'; g.t0 = g.t; g.end = () => raubEnd(g, false); };
const SMALL_FISH = ['Rotauge', 'Barsch', 'Forelle', 'Aal'], BIG_FISH = ['Zander', 'Karpfen', 'Lachs', 'Wels', 'Hecht'];
function raubSpawn(g, inside) {
  const me = g.me, el = g.phase === 'play' ? g.t - g.t0 : 0;
  const danger = el > 4 && Math.random() < Math.min(.5, .22 + el / 200);
  const L = danger ? me.L * rr(1.2, 1.9) : me.L * rr(.35, .85);
  const dir = Math.random() < .5 ? 1 : -1;
  g.npcs.push({ name: danger ? BIG_FISH[rnd(BIG_FISH.length)] : SMALL_FISH[rnd(SMALL_FISH.length)], L: Math.min(L, g.W * .55), dir,
    x: inside ? (Math.random() < .5 ? rr(0, g.W * .25) : rr(g.W * .75, g.W)) : (dir > 0 ? -L : g.W + L), y: rr(30, g.H - 30), v: rr(40, 95) * (1 + el / 150), ph: rr(0, 6), a: dir > 0 ? 0 : Math.PI });
}
function raubStep(g, dt) {
  const c = g.c, W = g.W, H = g.H, me = g.me;
  if (g.phase === 'play') {
    const sp = clamp(200 - me.L * .5, 110, 200);
    if (g.tgt) { const want = Math.atan2(g.tgt.y - me.y, g.tgt.x - me.x); let d = want - me.a; d = Math.atan2(Math.sin(d), Math.cos(d)); me.a += clamp(d, -6 * dt, 6 * dt); }
    const go = g.tgt ? Math.min(1, Math.hypot(g.tgt.x - me.x, g.tgt.y - me.y) / 40) : .35;
    me.x = clamp(me.x + Math.cos(me.a) * sp * go * dt, 10, W - 10); me.y = clamp(me.y + Math.sin(me.a) * sp * go * dt, 10, H - 10);
    g.spawn -= dt; if (g.spawn <= 0 && g.npcs.length < 13) { raubSpawn(g); g.spawn = rr(.45, 1); }
    const mx = me.x + Math.cos(me.a) * me.L * .42, my = me.y + Math.sin(me.a) * me.L * .42;
    for (const n of g.npcs) {
      const big = n.L > me.L * 1.08, d = Math.hypot(n.x - me.x, n.y - me.y);
      if (big && d < 110 + n.L * .5) { const want = Math.atan2(me.y - n.y, me.x - n.x); let dd = want - n.a; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); n.a += clamp(dd, -1.8 * dt, 1.8 * dt); n.hunt = true; }
      else { const want = n.dir > 0 ? 0 : Math.PI; let dd = want - n.a; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); n.a += clamp(dd, -1 * dt, 1 * dt); n.hunt = false; }
      const v = n.v * (n.hunt ? 1.3 : 1);
      n.x += Math.cos(n.a) * v * dt; n.y += Math.sin(n.a) * v * dt + Math.sin(g.t * 2 + n.ph) * 10 * dt;
      if (n.L < me.L * .92 && Math.hypot(n.x - mx, n.y - my) < n.L * .42 + 8) {
        n.dead = true; const pts = Math.max(1, Math.round(n.L / 8));
        const combo = g.t - g.lastEat < 1.4; g.lastEat = g.t; g.eaten++;
        g.score += combo ? pts * 2 : pts; me.L = Math.min(W * .32, me.L + n.L * .09);
        popTxt(g, n.x, n.y - 10, combo ? 'Doppelhappen! +' + pts * 2 : '+' + pts, combo ? '#ffd23c' : '#c6ff3d', combo ? 26 : 22);
        burst(g, n.x, n.y, '#bfe9ff', 10, 140); Snd.stamp(); Hap.go(12);
        setHud('rS', g.score); setHud('rL', (me.L / 46).toFixed(1).replace('.', ','));
      } else if (big) {
        const nx = n.x + Math.cos(n.a) * n.L * .42, ny = n.y + Math.sin(n.a) * n.L * .42;
        if (Math.hypot(nx - me.x, ny - me.y) < me.L * .32) { raubEnd(g, true, n); return; }
      }
    }
    g.npcs = g.npcs.filter(n => !n.dead && n.x > -n.L * 1.5 && n.x < W + n.L * 1.5 && n.y > -80 && n.y < H + 80);
  }
  const wat = c.createLinearGradient(0, 0, 0, H); wat.addColorStop(0, '#1f7d92'); wat.addColorStop(1, '#06222b'); c.fillStyle = wat; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 4; i++) { const x = (i * W / 3 + g.t * 12) % (W + 100) - 50; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 50, 0); c.lineTo(x - 40, H); c.lineTo(x - 90, H); c.fill(); }
  c.fillStyle = '#163d1d'; for (let i = 0; i < 9; i++) { const x = i * W / 8; c.beginPath(); c.moveTo(x - 8, H); c.quadraticCurveTo(x + Math.sin(g.t + i) * 10, H - 50 - (i % 3) * 18, x + 6, H); c.fill(); }
  if (Math.random() < dt * 3) g.bubbles.push({ x: rr(0, W), y: H, r: rr(2, 5) });
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; g.bubbles = g.bubbles.filter(b => (b.y -= 40 * dt) > -10); for (const b of g.bubbles) { c.beginPath(); c.arc(b.x + Math.sin(b.y * .05) * 4, b.y, b.r, 0, TAU); c.stroke(); }
  for (const n of g.npcs) {
    if (n.L > me.L * 1.08) { c.strokeStyle = 'rgba(255,90,82,' + (.45 + Math.sin(g.t * 6) * .2) + ')'; c.lineWidth = 3; c.beginPath(); c.ellipse(n.x, n.y, n.L * .55, n.L * .25, n.a, 0, TAU); c.stroke(); }
    drawFish(c, n.name, n.x, n.y, n.L, n.a);
  }
  if (g.phase !== 'over' || g.blink) drawFish(c, 'Hecht', me.x, me.y, me.L, me.a);
  if (g.tgt && g.phase === 'play') { c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.beginPath(); c.arc(g.tgt.x, g.tgt.y, 10, 0, TAU); c.stroke(); }
  drawFx(g, dt);
}
function raubEnd(g, eaten, by) {
  if (g.phase !== 'play') return;
  g.phase = 'over'; g.tgt = null;
  if (eaten) { Snd.soft(); Hap.go([60, 40, 60]); burst(g, g.me.x, g.me.y, '#ff5a52', 20, 200); popTxt(g, g.W / 2, g.H * .4, 'Gefressen!', '#ff8f88', 40); }
  const rec = gameRecord('raubfisch', g.score);
  if (rec) { Snd.fanfare(); FX.party(['🐟', '⭐']); }
  setFoot(againFoot('raubfisch', '<b>' + g.score + ' Punkte</b>, ' + g.eaten + ' Fische gefangen' + (by ? ', dann kam ein ' + esc(by.name) : '') + '.' + (rec ? ' Neuer Rekord!' : '')));
}

/* ======================= 5. Fischsprung ======================= */
/* Tippen = Flossenschlag nach oben. Zwischen Angelhaken (oben) und Schilf (unten) durch. Würmer bringen 3 Extrapunkte.
   Mit jedem Hindernis wird es etwas schneller und die Lücken werden enger. Boden berühren = vorbei. */
function sprungStart() {
  const s = stage('<span class="ct-score">Punkte <b id="fS">0</b></span>');
  const g = U.game = newGame('sprung', s, { y: s.H * .45, vy: 0, obs: [], score: 0, passed: 0, sp: s.W * .42 });
  window.__game = g;
  ovl(startCard('Fischsprung', 'Tippe, damit die Forelle nach oben schwimmt. Schwimm zwischen den Angelhaken und dem Schilf hindurch und schnapp dir die Würmer. Nicht den Grund berühren!', recTxt(gameBest('sprung'), 'Punkte'), 'jump-go'));
  setFoot('<p class="g-msg">Wie weit kommst du?</p>');
  onPtr(g, s.cv, { down: () => { if (g.phase === 'play') { g.vy = -g.H * .82; Snd.tap(); } } });
  runLoop(g, dt => sprungStep(g, dt));
}
ACT['jump-go'] = () => { const g = U.game; if (!g || g.id !== 'sprung' || g.phase !== 'ready') return; ovl(''); g.phase = 'play'; g.vy = -g.H * .7; g.end = () => sprungEnd(g); };
function sprungStep(g, dt) {
  const c = g.c, W = g.W, H = g.H, fx = W * .28, ground = H - 26;
  if (g.phase === 'play') {
    g.vy += H * 2.5 * dt; g.y += g.vy * dt;
    if (g.y < 14) { g.y = 14; g.vy = Math.max(0, g.vy); }
    const sp = Math.min(W * .78, W * .42 + g.passed * W * .012);
    const last = g.obs[g.obs.length - 1];
    if (!last || last.x < W - W * .6) {
      const gap = Math.max(H * .22, H * .36 - g.passed * H * .005), cy = rr(gap / 2 + 20, ground - gap / 2 - 10);
      g.obs.push({ x: W + 30, top: cy - gap / 2, bot: cy + gap / 2, worm: Math.random() < .35 ? { y: cy + rr(-gap * .2, gap * .2) } : null, done: false });
    }
    for (const o of g.obs) {
      o.x -= sp * dt;
      if (!o.done && o.x < fx - 20) { o.done = true; g.passed++; g.score++; setHud('fS', g.score); Snd.tap(); if (g.passed % 10 === 0) popTxt(g, W / 2, H * .3, 'Schneller!', '#ffd23c', 30); }
      if (o.worm && Math.hypot(o.x - fx, o.worm.y - g.y) < 24) { o.worm = null; g.score += 3; setHud('fS', g.score); popTxt(g, fx, g.y - 24, '+3 🪱', '#ffd23c', 24); Snd.sparkle(); }
      if (Math.abs(o.x - fx) < 18 && (g.y - 11 < o.top || g.y + 11 > o.bot)) { sprungEnd(g); break; }
    }
    g.obs = g.obs.filter(o => o.x > -50);
    if (g.y > ground - 10) { g.y = ground - 10; sprungEnd(g); }
  } else if (g.phase === 'ready') g.y = H * .45 + Math.sin(g.t * 3) * 10;
  const wat = c.createLinearGradient(0, 0, 0, H); wat.addColorStop(0, '#2a8fa3'); wat.addColorStop(1, '#0b3440'); c.fillStyle = wat; c.fillRect(0, 0, W, H);
  c.fillStyle = '#5b4a2e'; c.fillRect(0, ground, W, H - ground); c.fillStyle = '#6f5a36'; for (let i = 0; i < 12; i++) { const x = ((i * 47 - g.t * 60) % (W + 40) + W + 40) % (W + 40) - 20; c.beginPath(); c.ellipse(x, ground + 6, 9, 4, 0, 0, TAU); c.fill(); }
  for (const o of g.obs) {
    for (let k = -1; k <= 1; k++) {                                          // drei Schnüre mit Haken, gestaffelt bis zur Lücke
      const lx = o.x + k * 8, ly = o.top - (k === 0 ? 0 : 10 + Math.abs(k) * 4);
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, ly - 14); c.stroke();
      c.fillStyle = '#4a4a4a'; c.beginPath(); c.ellipse(lx, ly - 18, 3.5, 5, 0, 0, TAU); c.fill();
      c.strokeStyle = '#e3e7ec'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(lx, ly - 12); c.lineTo(lx, ly - 4); c.arc(lx - 6, ly - 4, 6, 0, Math.PI * .85); c.stroke();
    }
    for (let k = -2; k <= 2; k++) {                                          // Schilf: Halme vom Grund bis zur Lücke, oben Rohrkolben
      const sx = o.x + k * 6.5, top = o.bot + Math.abs(k) * 6 + 10;
      c.strokeStyle = k % 2 ? '#2f7a2c' : '#3c8f34'; c.lineWidth = 4; c.beginPath(); c.moveTo(sx, ground); c.lineTo(sx + Math.sin(g.t * 2 + k) * 2, top); c.stroke();
      if (k % 2 === 0) { c.fillStyle = '#7a4a22'; c.beginPath(); c.ellipse(sx + Math.sin(g.t * 2 + k) * 2, top - 2, 3.5, 9, 0, 0, TAU); c.fill(); }
    }
    if (o.worm) { c.strokeStyle = '#ff8fb0'; c.lineWidth = 5; c.beginPath(); for (let k = 0; k < 5; k++) c.lineTo(o.x - 8 + k * 4, o.worm.y + Math.sin(g.t * 8 + k) * 3); c.stroke(); }
  }
  drawFish(c, 'Forelle', fx, g.y, 50, clamp(g.vy / (g.H * 2), -.6, .7));
  drawFx(g, dt);
}
function sprungEnd(g) {
  if (g.phase !== 'play') return;
  g.phase = 'over'; Snd.soft(); Hap.go([40, 40]); burst(g, g.W * .28, g.y, '#bfe9ff', 16, 160);
  const rec = gameRecord('sprung', g.score);
  if (rec) { Snd.fanfare(); FX.party(['🐟', '⭐']); }
  setFoot(againFoot('sprung', '<b>' + g.score + ' Punkte</b>, ' + g.passed + ' Hindernisse geschafft.' + (rec ? ' Neuer Rekord!' : '')));
}

/* ======================= Bonus 2: Meteoritenhagel ======================= */
/* Finger hin und her ziehen: Die Rakete folgt. Erst ein paar Brocken, ab 7 Sekunden explodiert das Tempo,
   nach etwa 15 Sekunden ist der Himmel voll, nach 20 praktisch unmöglich. Härter als der Endgegner. */
function metSpeed(t) { return 1 + t * .05 + (t > 7 ? Math.pow((t - 7) / 4, 2) : 0); }
function metGap(t) { return Math.max(.025, .5 - t * .025 - (t > 7 ? (t - 7) * .045 : 0)); }
function metStart() {
  const s = stage('<span class="ct-score">⏱ <b id="mT">0,0</b> s</span>' + (gameBest('meteor') != null ? '<span class="ct-score">Rekord <b>' + (gameBest('meteor') / 10).toFixed(1).replace('.', ',') + '</b> s</span>' : ''));
  const g = U.game = newGame('meteor', s, { x: s.W / 2, tx: s.W / 2, rocks: [], spawn: 0, secs: 0, stars: Array.from({ length: 60 }, () => ({ x: rr(0, s.W), y: rr(0, s.H), z: rr(.3, 1) })) });
  window.__game = g;
  ovl(startCard('Meteoritenhagel', 'Zieh den Finger nach links und rechts, die Rakete folgt. Weich den Meteoriten aus. Am Anfang ist es leicht. Dann wird es irre schnell …', recTxt(gameBest('meteor') != null ? (gameBest('meteor') / 10).toFixed(1).replace('.', ',') : null, 'Sekunden'), 'met-go'));
  setFoot('<p class="g-msg">Wie lange überlebst du im All?</p>');
  onPtr(g, s.cv, { down: p => { g.tx = p.x; }, move: p => { g.tx = p.x; } });
  runLoop(g, dt => metStep(g, dt));
}
ACT['met-go'] = () => { const g = U.game; if (!g || g.id !== 'meteor' || g.phase !== 'ready') return; ovl(''); g.phase = 'play'; g.t0 = g.t; g.end = () => metEnd(g, false); Snd.kick(); };
function metStep(g, dt) {
  const c = g.c, W = g.W, H = g.H, sy = H - 56;
  const el = g.phase === 'play' ? g.t - g.t0 : 0, mul = metSpeed(el);
  if (g.phase === 'play') {
    g.x += (g.tx - g.x) * Math.min(1, dt * 18); g.x = clamp(g.x, 16, W - 16);
    g.spawn -= dt;
    while (g.spawn <= 0) {
      const r = rr(10, 22) * (1 + Math.min(el, 20) * .03);
      g.rocks.push({ x: rr(0, W), y: -r, r, vy: H * rr(.32, .45), vx: el > 10 ? rr(-60, 60) : 0, rot: rr(0, 6), near: false });
      g.spawn += metGap(el);
    }
    for (const m of g.rocks) {
      m.y += m.vy * mul * dt; m.x += m.vx * dt; m.rot += dt * 2;
      const d = Math.hypot(m.x - g.x, m.y - sy);
      if (d < m.r + 11) { g.secs = el; metEnd(g, true); break; }
      if (!m.near && m.y > sy && d < m.r + 34) { m.near = true; popTxt(g, g.x, sy - 30, 'Knapp!', '#ffd23c', 20); }
    }
    g.rocks = g.rocks.filter(m => m.y < H + 40);
    g.secs = el; setHud('mT', el.toFixed(1).replace('.', ','));
  }
  c.fillStyle = '#050816'; c.fillRect(0, 0, W, H);
  for (const s of g.stars) { s.y += (20 + 140 * s.z * (g.phase === 'play' ? mul : 1)) * dt; if (s.y > H) { s.y = 0; s.x = rr(0, W); } c.fillStyle = 'rgba(255,255,255,' + s.z + ')'; c.fillRect(s.x, s.y, 1.6, 1.6 + (mul > 3 ? mul : 0)); }
  for (const m of g.rocks) {
    c.fillStyle = 'rgba(255,138,31,.28)'; c.beginPath(); c.ellipse(m.x - m.vx * .004 * m.r, m.y - m.r * 1.3, m.r * .65, m.r * (1.2 + Math.min(2, mul * .25)), Math.atan2(m.vx, m.vy * mul) * -1, 0, TAU); c.fill();
    c.save(); c.translate(m.x, m.y); c.rotate(m.rot);
    c.fillStyle = '#7a6a5c'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8, rr2 = m.r * (i % 2 ? .82 : 1); c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } c.closePath(); c.fill();
    c.fillStyle = '#5a4c40'; c.beginPath(); c.arc(m.r * .25, -m.r * .2, m.r * .25, 0, TAU); c.fill(); c.restore();
  }
  if (g.phase !== 'over' || Math.sin(g.t * 20) > 0) {
    c.save(); c.translate(g.x, sy); c.rotate(clamp((g.tx - g.x) / 200, -.4, .4));
    c.fillStyle = '#ff8a1f'; c.beginPath(); c.moveTo(-6, 16); c.lineTo(0, 16 + rr(10, 22)); c.lineTo(6, 16); c.fill();
    c.fillStyle = '#e8eef5'; c.beginPath(); c.moveTo(0, -20); c.quadraticCurveTo(11, -6, 9, 16); c.lineTo(-9, 16); c.quadraticCurveTo(-11, -6, 0, -20); c.fill();
    c.fillStyle = '#ff5a52'; c.beginPath(); c.moveTo(-9, 6); c.lineTo(-16, 18); c.lineTo(-8, 16); c.fill(); c.beginPath(); c.moveTo(9, 6); c.lineTo(16, 18); c.lineTo(8, 16); c.fill();
    c.fillStyle = '#38c9f2'; c.beginPath(); c.arc(0, -4, 4.5, 0, TAU); c.fill(); c.restore();
  }
  drawFx(g, dt);
}
function metEnd(g, hit) {
  if (g.phase !== 'play') return;
  g.phase = 'over';
  const tenths = Math.floor(g.secs * 10), rec = gameRecord('meteor', tenths);
  if (hit) { Snd.soft(); Hap.go([80, 40, 80]); burst(g, g.x, g.H - 56, '#ff8a1f', 30, 280); popTxt(g, g.W / 2, g.H * .4, 'BUMM!', '#ff8a1f', 46); }
  if (rec) { Snd.fanfare(); FX.party(['🚀', '⭐']); }
  const s = (tenths / 10).toFixed(1).replace('.', ',');
  setFoot(againFoot('meteor', '<b>' + s + ' Sekunden</b> überlebt.' + (rec ? ' Neuer Rekord!' : g.secs > 15 ? ' Unglaublich!' : '')));
}

/* ---------- 7. Endgegner (Bonusspiel): durch die Abwehr dribbeln ----------
   Drei Bahnen, Verteidiger kommen entgegen. Links oder rechts tippen wechselt die Bahn.
   Bewusst so gebaut: anfangs leicht, ab etwa 28 Sekunden wird es rasend schnell und eng, nach 35 bis 40 Sekunden ist es kaum noch zu schaffen. */
const BOSS_LANES = 3;
function bossSpeed(t, H) {
  const base = H * (.42 + Math.min(t, 28) * .008);                // ruhig steigend bis 28 s
  const boost = t > 28 ? Math.pow((t - 28) / 4, 2) : 0;           // danach immer steiler: 32 s doppelt, 36 s fünffach, 40 s zehnfach
  return base * (1 + boost);
}
function bossGap(t, H) { return H * (t < 12 ? .62 : t < 28 ? .62 - (t - 12) * .014 : Math.max(.2, .4 - (t - 28) * .03)); }
function bossBlocked(t) { return t < 10 ? 1 : t < 22 ? (Math.random() < (t - 10) / 14 ? 2 : 1) : 2; }
function bossStart() {
  const g = U.game = { id: 'boss', phase: 'ready', lane: 1, rows: [], raf: 0, secs: 0 };
  window.__game = g;
  const best = gameBest('boss');
  $('#gbody').innerHTML = '<div class="catch-top"><span class="ct-score">⏱ <b id="bsT">0,0</b> s</span>' + (best != null ? '<span class="ct-score">Rekord <b>' + (best / 10).toFixed(1).replace('.', ',') + '</b> s</span>' : '') + '</div>' +
    '<div class="boss-area" id="barea"><div class="boss-lanes"><i></i><i></i></div><div class="boss-me" id="bme">' + jerseySVG(S.cfg.jersey.color, S.cfg.jersey.num, 46) + '</div>' +
    '<div class="catch-start"><p><b>Der Endgegner!</b> Dribble durch die Abwehr.<br>Tippe links oder rechts, um die Bahn zu wechseln.</p><p class="hint">Am Anfang ist es leicht. Dann wird es immer schwerer …</p><button class="btn btn-lime" data-act="boss-go">Anpfiff!</button></div></div>';
  setFoot('<p class="g-msg">Wie lange hältst du durch?</p>');
  const area = $('#barea');
  area.addEventListener('pointerdown', ev => {
    if (U.game !== g || g.phase !== 'play') return;
    ev.preventDefault();
    const r = area.getBoundingClientRect();
    bossMove(g, ev.clientX - r.left < r.width / 2 ? -1 : 1);
  });
}
function bossMove(g, d) {
  const n = clamp(g.lane + d, 0, BOSS_LANES - 1); if (n === g.lane) return;
  g.lane = n; Snd.tap();
  const me = $('#bme'); if (me) me.style.left = ((n + .5) / BOSS_LANES * 100).toFixed(2) + '%';
}
ACT['boss-go'] = () => {
  const g = U.game; if (!g || g.id !== 'boss' || g.phase !== 'ready') return;
  const st = $('#barea .catch-start'); if (st) st.remove();
  const area = $('#barea'); g.W = area.clientWidth; g.H = area.clientHeight;
  Object.assign(g, { phase: 'play', t0: performance.now(), last: performance.now(), dist: 0, end: () => bossEnd(g, false) });
  bossMove(g, 0); Snd.kick();
  const loop = now => {
    if (!gameAlive(g) || g.phase !== 'play') return;
    const dt = Math.min(40, now - g.last) / 1000, t = (now - g.t0) / 1000; g.last = now;
    const v = bossSpeed(t, g.H), area2 = $('#barea'); if (!area2) return;
    g.dist -= v * dt;
    if (g.dist <= 0) {
      g.dist = bossGap(t, g.H);
      const free = rnd(BOSS_LANES), block = bossBlocked(t), lanes = [];
      for (let i = 0; i < BOSS_LANES && lanes.length < block; i++) { const l = (free + 1 + i) % BOSS_LANES; if (l !== free) lanes.push(l); }
      const row = document.createElement('div'); row.className = 'boss-row';
      row.innerHTML = lanes.map(l => '<span class="boss-def" style="left:' + ((l + .5) / BOSS_LANES * 100).toFixed(2) + '%">' + monsterSVG(t > 28 ? 'lazy' : 'meh', 46) + '</span>').join('');
      area2.appendChild(row);
      g.rows.push({ el: row, y: -50, lanes });
    }
    const meY = g.H - 62;
    for (const r of g.rows) {
      r.y += v * dt; r.el.style.transform = 'translateY(' + r.y.toFixed(1) + 'px)';
      if (!r.hit && r.y > meY - 40 && r.y < meY + 30 && r.lanes.indexOf(g.lane) >= 0) { r.hit = true; g.secs = t; bossEnd(g, true); return; }
    }
    g.rows = g.rows.filter(r => { if (r.y > g.H + 40) { r.el.remove(); return false; } return true; });
    g.secs = t;
    const tt = $('#bsT'); if (tt) tt.textContent = t.toFixed(1).replace('.', ',');
    g.raf = requestAnimationFrame(loop);
  };
  g.raf = requestAnimationFrame(loop);
};
function bossEnd(g, tackled) {
  if (g.phase !== 'play') return;
  g.phase = 'over'; cancelAnimationFrame(g.raf);
  const tenths = Math.floor(g.secs * 10), rec = gameRecord('boss', tenths);
  if (tackled) { Snd.soft(); Hap.go([60, 40, 60]); const me = $('#bme'); if (me) me.classList.add('down'); }
  if (rec) { Snd.fanfare(); FX.party(['⚽', '🔥']); }
  const s = (tenths / 10).toFixed(1).replace('.', ',');
  setFoot(doneFoot('<b>' + (tackled ? 'Abgegrätscht nach ' : 'Durchgehalten: ') + s + ' Sekunden!</b>' + (rec ? ' Neuer Rekord!' : g.secs > 30 ? ' Wahnsinn, so weit!' : ''), 'boss-again'));
}
ACT['boss-again'] = () => again('boss');
