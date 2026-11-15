/* ============ Minispiele ============
   Sechs Minispiele und ein Bonusspiel (Endgegner). Spielzeit: jedes Tor von gestern = 1 Minute Minispiele,
   jedes Tor des Gegners von gestern = 1 Minute Endgegner; nur heute und erst ab 14 Uhr (Regeln: playState in logic.js).
   Die Uhr läuft, solange das Spielfenster offen und die App sichtbar ist. Verbrauch und Bestwerte stehen in cfg/play.
   Im Trainer-Modus lassen sich alle Spiele ohne Uhr ausprobieren. Kein Spiel bringt Tore. */
let gameTimers = [];
const gLater = (fn, ms) => { const t = setTimeout(fn, ms); gameTimers.push(t); return t; };
function gameStop() {
  gameTimers.forEach(clearTimeout); gameTimers = [];
  if (U.game && U.game.raf) cancelAnimationFrame(U.game.raf);
  U.game = null; window.__game = null;
}
const gameAlive = g => U.game === g && U.sheet === 'sheet-game';
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

const GAMES = {
  elfer: { name: 'Elfmeter', sub: 'Schieß am Torwart vorbei', art: () => '<span class="gt-elf">' + goalSVG(54) + '<i>' + ballSVG(18) + '</i></span>' },
  keeper: { name: 'Torwart', sub: 'Halte die Bälle', art: () => '<span class="gt-keep">🧤' + ballSVG(22) + '</span>' },
  memory: { name: 'Memory', sub: 'Paare finden', art: () => '<span class="gt-mem"><i>⚽</i><i>⚽</i></span>' },
  cups: { name: 'Hütchen', sub: 'Wo ist der Ball?', art: () => '<span class="gt-cups">' + coneSVG(22) + '<i>' + ballSVG(18) + '</i>' + coneSVG(22) + '</span>' },
  juggle: { name: 'Hochhalten', sub: 'Lass ihn nicht fallen', art: () => '<span class="gt-jug">' + ballSVG(26) + '<i>👟</i></span>' },
  rechnen: { name: 'Rechen-Elfer', sub: 'Rechnen = Tore', art: () => '<span class="gt-math">7×8</span>' },
  boss: { name: 'Endgegner', sub: 'Bonusspiel: wird immer schwerer', bonus: true, art: () => '<span class="gt-boss">' + monsterSVG('meh', 40) + '</span>' },
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
    '<p class="hint">' + (!p.open ? 'Morgen ab ' + PLAY_FROM_HOUR + ' Uhr geht es weiter.' : other > 0 ? 'Du hast noch ' + fmtMinSec(other) + ' für ' + (kind === 'b' ? 'die Minispiele' : 'den Endgegner') + '.' : 'Jedes Tor heute bringt dir morgen eine Minute.') + '</p></div>' +
    '<button class="btn btn-lime btn-block" data-act="sheet-close">Fertig</button>');
}
/* Darf das Spiel jetzt starten? Im Trainer-Modus immer (ohne Uhr). */
function playGate(id) {
  if (U.unlocked) return { ok: true, free: true };
  const p = playNow();
  if (!p.open) return { ok: false, why: 'Die Spiele gehen heute ab ' + PLAY_FROM_HOUR + ' Uhr los.' };
  if (leftOf(p, kindOf(id)) <= 0) return { ok: false, why: kindOf(id) === 'b' ? 'Heute keine Zeit für den Endgegner.' : 'Heute keine Spielzeit mehr.' };
  return { ok: true, free: false };
}

/* ---------- Fenster ---------- */
const gameHead = title => '<div class="g-head"><h2>' + esc(title) + '</h2><span class="g-clock" id="gclock" aria-live="off"></span><button class="g-x" data-act="sheet-close" aria-label="Spiel schließen">' + IC.cross + '</button></div>';
const gameShell = id => gameHead(GAMES[id].name) + '<div class="g-body" id="gbody"></div><div class="g-foot" id="gfoot"></div>';
const setFoot = h => { const f = $('#gfoot'); if (f) f.innerHTML = h; };
const doneFoot = (msg, again) => '<p class="g-msg">' + msg + '</p><div class="row-btns"><button class="btn btn-lime" data-act="' + again + '">Nochmal!</button><button class="btn btn-ghost" data-act="sheet-close">Fertig</button></div>';
const START = { elfer: elferStart, keeper: keeperStart, memory: memStart, cups: cupsStart, juggle: juggleStart, rechnen: mathStart, boss: bossStart };

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
function gamePause() { const g = U.game; if (g && g.phase === 'play' && g.end) g.end(); }
/* Nochmal: nur, wenn noch Zeit da ist. */
function again(id) {
  const gate = playGate(id);
  if (!gate.ok && !Play.free) { timeUp(); return; }
  gameStop(); START[id]();
}

/* ---------- 1. Elfmeter: Der Torwart läuft hin und her, tippe ins Tor, wohin du schießt ---------- */
const ELF_SHOTS = 10;
function elferStart() {
  const g = U.game = { id: 'elfer', phase: 'aim', shot: 0, goals: 0, t0: performance.now(), raf: 0, kx: .5, speed: 1 };
  window.__game = g;
  $('#gbody').innerHTML = '<div class="elf-score"><span>Tore <b id="elfG">0</b></span><span>Schuss <b id="elfS">1</b>/' + ELF_SHOTS + '</span></div>' +
    '<div class="elf-stage" id="elfStage"><div class="elf-goal" id="elfGoal" data-act="elf-shoot"><div class="elf-net"></div><div class="elf-keeper" id="elfK">' + monsterSVG('meh', 58) + '<i class="glove l">🧤</i><i class="glove r">🧤</i></div></div>' +
    '<div class="elf-spot"></div><div class="elf-ball" id="elfBall">' + ballSVG(34) + '</div></div>';
  const best = gameBest('elfer');
  setFoot('<p class="g-msg">Tippe ins Tor, wohin du schießen willst.' + (best != null ? ' Rekord: ' + best + ' Tore.' : '') + '</p>');
  const loop = now => {
    if (!gameAlive(g)) return;
    const t = (now - g.t0) / 1000;
    g.kx = .5 + .36 * Math.sin(t * (1.6 + g.goals * .22));
    const k = $('#elfK'); if (k) k.style.left = (g.kx * 100).toFixed(2) + '%';
    g.raf = requestAnimationFrame(loop);
  };
  g.raf = requestAnimationFrame(loop);
}
ACT['elf-shoot'] = (el, ev) => {
  const g = U.game; if (!g || g.id !== 'elfer' || g.phase !== 'aim') return;
  const goal = $('#elfGoal'), ball = $('#elfBall'); if (!goal || !ball) return;
  const r = goal.getBoundingClientRect(), br = ball.getBoundingClientRect();
  const x = ev && ev.clientX != null && ev.clientX > 0 ? ev.clientX : r.left + r.width * Math.random();
  const y = ev && ev.clientY != null && ev.clientY > 0 ? ev.clientY : r.top + r.height * .5;
  const fx = clamp((x - r.left) / r.width, .04, .96);
  g.phase = 'fly'; Snd.kick();
  ball.style.transform = 'translate(' + (x - (br.left + br.width / 2)).toFixed(1) + 'px,' + (y - (br.top + br.height / 2)).toFixed(1) + 'px) scale(.62)';
  gLater(() => {
    if (!gameAlive(g)) return;
    const saved = Math.abs(g.kx - fx) < .15;
    g.shot++;
    const kp = $('#elfK');
    if (saved) { Snd.soft(); goal.classList.add('saved'); if (kp) kp.style.transform = 'translateY(' + (-Math.max(0, r.bottom - y - 46)).toFixed(0) + 'px)'; }   // Torwart springt hoch zum Ball
    else { g.goals++; Snd.goal(); Hap.go(30); goal.classList.add('scored'); FX.pop(x, y, ['⚽', '🔥']); }
    $('#elfG').textContent = g.goals;
    setFoot('<p class="g-msg"><b>' + (saved ? 'Gehalten!' : 'Tor!') + '</b></p>');
    gLater(() => {
      if (!gameAlive(g)) return;
      goal.classList.remove('saved', 'scored'); ball.style.transform = ''; if (kp) kp.style.transform = '';
      if (g.shot >= ELF_SHOTS) { elferDone(g); return; }
      $('#elfS').textContent = g.shot + 1; g.phase = 'aim';
      setFoot('<p class="g-msg">Nächster Schuss! Tippe ins Tor.</p>');
    }, 850);
  }, 420);
};
function elferDone(g) {
  g.phase = 'over'; cancelAnimationFrame(g.raf);
  const rec = gameRecord('elfer', g.goals);
  if (g.goals >= 5) { Snd.fanfare(); FX.party(['⚽', '🏆']); }
  setFoot(doneFoot('<b>' + g.goals + ' von ' + ELF_SHOTS + ' verwandelt!</b>' + (rec ? ' Neuer Rekord!' : ''), 'elf-again'));
}
ACT['elf-again'] = () => again('elfer');

/* ---------- 2. Torwart: 30 Sekunden Bälle antippen, bevor sie über die Linie sind ---------- */
const KEEP_SECS = 30;
function keeperStart() {
  const g = U.game = { id: 'keeper', phase: 'ready', saves: 0, conceded: 0, items: [], raf: 0 };
  window.__game = g;
  const best = gameBest('keeper');
  $('#gbody').innerHTML = '<div class="catch-top"><span class="ct-score">🧤 <b id="kpS">0</b> gehalten</span><span class="ct-time"><i id="kpT" style="width:100%"></i></span><span class="ct-score miss">' + ballSVG(16) + ' <b id="kpC">0</b></span></div>' +
    '<div class="catch-area keep-area" id="karea"><div class="catch-start"><p>Die Bälle fliegen aufs Tor.<br>Tippe sie an, bevor sie unten ankommen!</p>' + (best != null ? '<p class="hint">Dein Rekord: ' + best + '</p>' : '') + '<button class="btn btn-lime" data-act="keep-go">Anpfiff!</button></div><div class="keep-line"></div></div>';
  setFoot('<p class="g-msg">Du bist der Torwart.</p>');
  $('#karea').addEventListener('pointerdown', ev => {
    const el = ev.target.closest('.fall'); if (!el || U.game !== g || g.phase !== 'play') return;
    ev.preventDefault();
    const it = g.items.find(x => x.el === el); if (!it || it.hit) return;
    it.hit = true; g.saves++; el.classList.add('hit'); $('#kpS').textContent = g.saves;
    Snd.stamp(); const r = el.getBoundingClientRect(); FX.pop(r.left + r.width / 2, r.top + r.height / 2, ['🧤']);
    gLater(() => el.remove(), 240);
  });
}
ACT['keep-go'] = () => {
  const g = U.game; if (!g || g.id !== 'keeper' || g.phase !== 'ready') return;
  const st = $('#karea .catch-start'); if (st) st.remove();
  g.phase = 'play'; g.t0 = performance.now(); g.last = g.t0; g.spawnIn = 0; g.end = keeperEnd;
  const loop = now => {
    if (!gameAlive(g) || g.phase !== 'play') return;
    const dt = Math.min(64, now - g.last) / 1000, el = (now - g.t0) / 1000; g.last = now;
    const area = $('#karea'); if (!area) return;
    const H = area.clientHeight, W = area.clientWidth;
    g.spawnIn -= dt;
    if (g.spawnIn <= 0) {
      const size = 44 + rnd(12), n = document.createElement('button');
      n.className = 'fall'; n.type = 'button'; n.setAttribute('aria-label', 'Ball'); n.innerHTML = ballSVG(size);
      n.style.left = (Math.random() * Math.max(10, W - size - 8) + 4).toFixed(0) + 'px'; n.style.transform = 'translateY(-60px)';
      area.appendChild(n);
      g.items.push({ el: n, y: -60, v: H * .34 + el * H * .022 + Math.random() * 50, hit: false });
      g.spawnIn = Math.max(.38, .9 - el * .018);
    }
    g.items = g.items.filter(it => {
      if (it.hit) return it.el.isConnected;
      it.y += it.v * dt; it.el.style.transform = 'translateY(' + it.y.toFixed(1) + 'px)';
      if (it.y > H - 40) { it.el.remove(); g.conceded++; const c = $('#kpC'); if (c) c.textContent = g.conceded; Snd.soft(); return false; }
      return true;
    });
    const bar = $('#kpT'); if (bar) bar.style.width = (Math.max(0, 1 - el / KEEP_SECS) * 100).toFixed(1) + '%';
    if (el >= KEEP_SECS) { keeperEnd(); return; }
    g.raf = requestAnimationFrame(loop);
  };
  g.raf = requestAnimationFrame(loop);
};
function keeperEnd() {
  const g = U.game; if (!g || g.id !== 'keeper' || g.phase !== 'play') return;
  g.phase = 'over'; cancelAnimationFrame(g.raf);
  $$('#karea .fall').forEach(n => n.remove()); g.items = [];
  const rec = gameRecord('keeper', g.saves);
  if (g.saves > g.conceded) { Snd.fanfare(); FX.party(['🧤', '⚽']); }
  setFoot(doneFoot('<b>' + g.saves + ' gehalten, ' + g.conceded + ' durch.</b>' + (rec ? ' Neuer Rekord!' : ''), 'keep-again'));
}
ACT['keep-again'] = () => again('keeper');

/* ---------- 3. Memory: 8 Paare ---------- */
const MEM_POOL = ['⚽', '🥅', '🏆', '👟', '🧤', '🎽', '🥇', '📣', '🏟️', '🚩', '🧢', '🦁', '🐯', '🦅', '🔥', '⭐'];
function memStart() {
  const pick = shuffle(MEM_POOL.slice()).slice(0, 8);
  const g = U.game = { id: 'memory', cards: shuffle(pick.concat(pick)).map(v => ({ v, open: false, done: false })), first: -1, lock: false, moves: 0, found: 0 };
  window.__game = g;
  $('#gbody').innerHTML = '<div class="mem-grid">' + g.cards.map((c, i) => '<button class="mcard" data-act="mem-flip" data-i="' + i + '" aria-label="Karte ' + (i + 1) + '"><span class="mc-in"><span class="mc-back">' + ballSVG(30) + '</span><span class="mc-front">' + c.v + '</span></span></button>').join('') + '</div>';
  const best = gameBest('memory');
  setFoot('<p class="g-msg">Finde die Paare! Tippe zwei Karten an.' + (best != null ? ' Rekord: ' + best + ' Züge.' : '') + '</p>');
}
function memPaint(i) {
  const g = U.game, c = g.cards[i], el = $('.mcard[data-i="' + i + '"]'); if (!el) return;
  el.classList.toggle('open', c.open || c.done); el.classList.toggle('done', c.done);
}
ACT['mem-flip'] = el => {
  const g = U.game; if (!g || g.id !== 'memory' || g.lock) return;
  const i = +el.dataset.i, c = g.cards[i]; if (!c || c.open || c.done) return;
  c.open = true; memPaint(i); Snd.tap();
  if (g.first < 0) { g.first = i; return; }
  const j = g.first, d = g.cards[j]; g.first = -1; g.moves++;
  if (d.v === c.v) {
    c.done = d.done = true; g.found++;
    gLater(() => { if (!gameAlive(g)) return; memPaint(i); memPaint(j); Snd.stamp(); if (g.found === g.cards.length / 2) memDone(g); }, 250);
  } else {
    g.lock = true;
    gLater(() => { if (!gameAlive(g)) return; c.open = d.open = false; memPaint(i); memPaint(j); g.lock = false; }, 900);
  }
};
function memDone(g) {
  g.over = true;
  const rec = gameRecord('memory', g.moves);
  Snd.fanfare(); FX.party(['⚽', '🏆']); Hap.go([30, 40, 30]);
  setFoot(doneFoot('<b>Alle Paare gefunden!</b> ' + g.moves + ' Züge.' + (rec ? ' Neuer Rekord!' : ''), 'mem-again'));
}
ACT['mem-again'] = () => again('memory');

/* ---------- 4. Hütchen: Der Ball liegt unter einem von drei Hütchen, die Hütchen werden vertauscht ---------- */
function coneSVG(w) {
  return '<svg class="cone" viewBox="0 0 100 96" width="' + w + '" height="' + f1(w * .96) + '" aria-hidden="true" focusable="false"><path d="M20 86 40 10Q50 4 60 10L80 86z" fill="#ff8a1f" stroke="#a64b00" stroke-width="3.5" stroke-linejoin="round"/>' +
    '<path d="M31 46h38M26 66h48" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".9"/><rect x="8" y="84" width="84" height="9" rx="4" fill="#e06d00" stroke="#a64b00" stroke-width="3"/></svg>';
}
function cupsStart(keep) {
  const prev = keep && U.game && U.game.id === 'cups' ? U.game.streak : 0;
  const g = U.game = { id: 'cups', slots: [0, 1, 2], ball: rnd(3), phase: 'show', streak: prev };
  window.__game = g;
  $('#gbody').innerHTML = '<div class="cups-stage">' + [0, 1, 2].map(c => '<div class="cupw" data-cup="' + c + '" style="left:' + (c * 33.333) + '%">' + (c === g.ball ? '<span class="cup-ball">' + ballSVG(44) + '</span>' : '') +
    '<button class="cup up" data-act="cup-pick" data-cup="' + c + '" aria-label="Hütchen ' + (c + 1) + '" disabled>' + coneSVG(92) + '</button></div>').join('') + '</div>';
  setFoot('<p class="g-msg">' + (g.streak ? '<b>' + g.streak + '× gefunden!</b> ' : '') + 'Schau genau hin: Hier ist der Ball!</p>');
  gLater(() => { if (!gameAlive(g)) return; $$('.cup').forEach(c => c.classList.remove('up')); Snd.soft(); }, 1300);
  gLater(() => { if (gameAlive(g)) cupsShuffle(g); }, 1800);
}
function cupsShuffle(g) {
  g.phase = 'shuffle';
  setFoot('<p class="g-msg">Die Hütchen werden gemischt …</p>');
  const n = 4 + Math.min(g.streak, 8), ms = Math.max(200, 440 - g.streak * 30);
  const stage = $('.cups-stage'); if (stage) stage.style.setProperty('--sw', ms + 'ms');
  let k = 0;
  const step = () => {
    if (!gameAlive(g)) return;
    if (k++ >= n) { g.phase = 'pick'; $$('.cup').forEach(c => { c.disabled = false; }); setFoot('<p class="g-msg"><b>Wo ist der Ball?</b> Tippe auf ein Hütchen.</p>'); return; }
    const a = rnd(3), b = (a + 1 + rnd(2)) % 3, ca = g.slots.indexOf(a), cb = g.slots.indexOf(b);
    g.slots[ca] = b; g.slots[cb] = a;
    $$('.cupw').forEach(w => { w.style.left = (g.slots[+w.dataset.cup] * 33.333) + '%'; });
    Snd.tap(); gLater(step, ms + 50);
  };
  step();
}
ACT['cup-pick'] = el => {
  const g = U.game; if (!g || g.id !== 'cups' || g.phase !== 'pick') return;
  const c = +el.dataset.cup; g.phase = 'reveal';
  $$('.cup').forEach(x => { x.disabled = true; });
  el.classList.add('up');
  if (c === g.ball) {
    g.streak++;
    const rec = gameRecord('cups', g.streak);
    Snd.goal(); Hap.go([20, 30, 20]);
    const r = el.getBoundingClientRect(); FX.pop(r.left + r.width / 2, r.top + r.height, ['⚽', '⭐']);
    setFoot(doneFoot('<b>Gefunden!</b> ' + (g.streak > 1 ? g.streak + '-mal hintereinander.' : 'Gut aufgepasst!') + (rec ? ' Neuer Rekord!' : ''), 'cups-again'));
  } else {
    Snd.soft(); g.streak = 0;
    gLater(() => { if (!gameAlive(g)) return; const right = $('.cup[data-cup="' + g.ball + '"]'); if (right) right.classList.add('up'); }, 500);
    setFoot(doneFoot('<b>Knapp daneben!</b> Hier war er. Nochmal?', 'cups-again'));
  }
};
ACT['cups-again'] = () => {
  const gate = playGate('cups'); if (!gate.ok && !Play.free) { timeUp(); return; }
  gameTimers.forEach(clearTimeout); gameTimers = []; cupsStart(true);
};

/* ---------- 5. Hochhalten: Ball antippen, damit er nicht auf den Boden fällt ---------- */
function juggleStart() {
  const g = U.game = { id: 'juggle', phase: 'ready', kicks: 0, raf: 0 };
  window.__game = g;
  const best = gameBest('juggle');
  $('#gbody').innerHTML = '<div class="catch-top"><span class="ct-score">👟 <b id="jgK">0</b> mal hochgehalten</span></div>' +
    '<div class="jug-area" id="jarea"><div class="jug-ball" id="jball">' + ballSVG(64) + '</div><div class="jug-grass"></div>' +
    '<div class="catch-start"><p>Tippe den Ball an, damit er oben bleibt!</p>' + (best != null ? '<p class="hint">Dein Rekord: ' + best + '</p>' : '') + '<button class="btn btn-lime" data-act="jug-go">Los!</button></div></div>';
  setFoot('<p class="g-msg">Wie oft schaffst du es?</p>');
  $('#jarea').addEventListener('pointerdown', ev => {
    if (U.game !== g || g.phase !== 'play') return;
    const area = $('#jarea'), r = area.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top, R = 32;
    if (Math.hypot(px - g.x, py - g.y) > R * 1.9 || g.vy < -g.H * .4) return;      // nur den Ball treffen, nicht in der Luft nachtreten
    ev.preventDefault();
    g.kicks++; $('#jgK').textContent = g.kicks;
    g.vy = -g.H * (1.25 + Math.random() * .15);
    g.vx = (g.x - px) * 4.5 + (Math.random() - .5) * 90;
    g.grav = g.H * (1.9 + Math.min(g.kicks, 40) * .03);
    Snd.kick(); Hap.go(15);
  });
}
ACT['jug-go'] = () => {
  const g = U.game; if (!g || g.id !== 'juggle' || g.phase !== 'ready') return;
  const st = $('#jarea .catch-start'); if (st) st.remove();
  const area = $('#jarea'); g.W = area.clientWidth; g.H = area.clientHeight;
  Object.assign(g, { phase: 'play', x: g.W / 2, y: g.H * .3, vx: 0, vy: -g.H * .5, grav: g.H * 1.9, last: performance.now(), end: () => juggleEnd(g) });
  const ball = $('#jball');
  const loop = now => {
    if (!gameAlive(g) || g.phase !== 'play') return;
    const dt = Math.min(40, now - g.last) / 1000; g.last = now;
    g.vy += g.grav * dt; g.x += g.vx * dt; g.y += g.vy * dt;
    if (g.x < 32) { g.x = 32; g.vx = Math.abs(g.vx) * .8; }
    if (g.x > g.W - 32) { g.x = g.W - 32; g.vx = -Math.abs(g.vx) * .8; }
    if (g.y < 32) { g.y = 32; g.vy = Math.abs(g.vy) * .3; }
    if (ball) ball.style.transform = 'translate(' + (g.x - 32).toFixed(1) + 'px,' + (g.y - 32).toFixed(1) + 'px) rotate(' + (g.x * 2).toFixed(0) + 'deg)';
    if (g.y > g.H - 46) { juggleEnd(g); return; }
    g.raf = requestAnimationFrame(loop);
  };
  g.raf = requestAnimationFrame(loop);
};
function juggleEnd(g) {
  if (g.phase !== 'play') return;
  g.phase = 'over'; cancelAnimationFrame(g.raf); Snd.soft();
  const rec = gameRecord('juggle', g.kicks);
  if (rec) { Snd.fanfare(); FX.party(['⚽', '👟']); }
  setFoot(doneFoot('<b>' + g.kicks + '-mal hochgehalten!</b>' + (rec ? ' Neuer Rekord!' : ''), 'jug-again'));
}
ACT['jug-again'] = () => again('juggle');

/* ---------- 6. Rechen-Elfer: 60 Sekunden, jede richtige Antwort ist ein Tor ---------- */
const MATH_SECS = 60;
function mathTask() {
  const k = rnd(4);
  let a, b, q, r;
  if (k <= 1) { a = 2 + rnd(9); b = 2 + rnd(9); q = a + ' × ' + b; r = a * b; }
  else if (k === 2) { a = 10 + rnd(80); b = 2 + rnd(Math.min(40, 99 - a)); q = a + ' + ' + b; r = a + b; }
  else { a = 20 + rnd(80); b = 2 + rnd(a - 5); q = a + ' − ' + b; r = a - b; }
  const opts = [r];
  while (opts.length < 3) { const d = r + (rnd(2) ? 1 : -1) * (1 + rnd(k <= 1 ? Math.max(3, a) : 10)); if (d >= 0 && opts.indexOf(d) < 0) opts.push(d); }
  return { q, r, opts: shuffle(opts) };
}
function mathStart() {
  const g = U.game = { id: 'rechnen', phase: 'ready', goals: 0, misses: 0 };
  window.__game = g;
  const best = gameBest('rechnen');
  $('#gbody').innerHTML = '<div class="catch-top"><span class="ct-score">⚽ <b id="mtG">0</b> Tore</span><span class="ct-time"><i id="mtT" style="width:100%"></i></span></div>' +
    '<div class="math-box" id="mbox"><div class="catch-start static"><p>Rechne schnell! Jede richtige Antwort ist ein Tor.</p>' + (best != null ? '<p class="hint">Dein Rekord: ' + best + '</p>' : '') + '<button class="btn btn-lime" data-act="math-go">Los!</button></div></div>';
  setFoot('<p class="g-msg">Du hast ' + MATH_SECS + ' Sekunden.</p>');
}
function mathNext(g) {
  g.task = mathTask(); g.lock = false;
  const b = $('#mbox'); if (!b) return;
  b.innerHTML = '<p class="math-q">' + g.task.q + ' = ?</p><div class="math-opts">' + g.task.opts.map(o => '<button class="btn btn-ghost math-o" data-act="math-pick" data-v="' + o + '">' + o + '</button>').join('') + '</div>';
}
ACT['math-go'] = () => {
  const g = U.game; if (!g || g.id !== 'rechnen' || g.phase !== 'ready') return;
  g.phase = 'play'; g.t0 = performance.now(); g.end = () => mathEnd(g);
  mathNext(g); setFoot('<p class="g-msg">Tippe die richtige Zahl.</p>');
  const tick = () => {
    if (!gameAlive(g) || g.phase !== 'play') return;
    const el = (performance.now() - g.t0) / 1000, bar = $('#mtT');
    if (bar) bar.style.width = (Math.max(0, 1 - el / MATH_SECS) * 100).toFixed(1) + '%';
    if (el >= MATH_SECS) { mathEnd(g); return; }
    gLater(tick, 200);
  };
  tick();
};
ACT['math-pick'] = el => {
  const g = U.game; if (!g || g.id !== 'rechnen' || g.phase !== 'play' || g.lock) return;
  const v = +el.dataset.v; g.lock = true;
  if (v === g.task.r) {
    g.goals++; $('#mtG').textContent = g.goals; el.classList.add('right'); Snd.goal();
    const r = el.getBoundingClientRect(); FX.pop(r.left + r.width / 2, r.top, ['⚽']);
    gLater(() => { if (gameAlive(g) && g.phase === 'play') mathNext(g); }, 380);
  } else {
    g.misses++; el.classList.add('wrong'); Snd.soft();
    const right = $('.math-o[data-v="' + g.task.r + '"]'); if (right) right.classList.add('right');
    gLater(() => { if (gameAlive(g) && g.phase === 'play') mathNext(g); }, 1000);
  }
};
function mathEnd(g) {
  if (g.phase !== 'play') return;
  g.phase = 'over';
  const rec = gameRecord('rechnen', g.goals);
  if (g.goals >= 10) { Snd.fanfare(); FX.party(['⚽', '🧠']); }
  const b = $('#mbox'); if (b) b.innerHTML = '<p class="math-q small">Abpfiff!</p>';
  setFoot(doneFoot('<b>' + tore(g.goals) + ' in ' + MATH_SECS + ' Sekunden!</b>' + (rec ? ' Neuer Rekord!' : ''), 'math-again'));
}
ACT['math-again'] = () => again('rechnen');

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
