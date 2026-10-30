/* ============ Ton (Web Audio), Konfetti (Canvas), Vibration ============ */
const Hap = { go(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* kein Gerät mit Vibration */ } } };
const stillMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

const Snd = (function () {
  let ctx = null, master = null, muted = false;
  function ensure() {
    if (muted) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = .6; master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(f, t, d, type, g, f2) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    a.gain.setValueAtTime(.0001, t); a.gain.exponentialRampToValueAtTime(g || .2, t + .012); a.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(a); a.connect(master); o.start(t); o.stop(t + d + .05);
  }
  function crowd(t, d, g, f0, f1) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * d)), buf = ctx.createBuffer(1, n, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), a = ctx.createGain();
    s.buffer = buf; bp.type = 'bandpass'; bp.Q.value = .7;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f1, t + d);
    a.gain.setValueAtTime(.0001, t); a.gain.linearRampToValueAtTime(g, t + d * .35); a.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(bp); bp.connect(a); a.connect(master); s.start(t);
  }
  function pfiff(t, d) {
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), a = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 34; lg.gain.value = 140;
    lfo.connect(lg); lg.connect(o.frequency);
    a.gain.setValueAtTime(.0001, t); a.gain.exponentialRampToValueAtTime(.22, t + .02); a.gain.setValueAtTime(.22, t + d - .05); a.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(a); a.connect(master); o.start(t); lfo.start(t); o.stop(t + d + .05); lfo.stop(t + d + .05);
  }
  function brass(f, t, d, g) {
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), a = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2200, t + d * .5);
    lfo.frequency.value = 5.5; lg.gain.value = f * .006; lfo.connect(lg); lg.connect(o.frequency);
    a.gain.setValueAtTime(.0001, t); a.gain.exponentialRampToValueAtTime(g, t + .04); a.gain.setValueAtTime(g, t + d * .7); a.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(lp); lp.connect(a); a.connect(master); o.start(t); lfo.start(t); o.stop(t + d + .05); lfo.stop(t + d + .05);
  }
  const run = fn => { const c = ensure(); if (!c) return; try { fn(c.currentTime); } catch (e) { /* Ton ist nie wichtig genug für einen Fehler */ } };
  return {
    setMuted(m) { muted = !!m; },
    isMuted: () => muted,
    wake() { ensure(); },
    tap() { run(t => tone(700, t, .06, 'sine', .07, 480)); },
    soft() { run(t => tone(240, t, .2, 'sine', .07, 190)); },                                   // ruhig: Kein Tor, Karte
    kick() { run(t => { tone(150, t, .14, 'sine', .45, 48); crowd(t, .07, .22, 350, 900); }); },   // Ball getreten: Wumms und Leder
    stamp() { run(t => { tone(160, t, .16, 'sine', .38, 48); tone(90, t, .12, 'triangle', .22, 40); }); },
    goal() { run(t => { tone(120, t, .16, 'sine', .3, 50); crowd(t, .28, .3, 3500, 6500); crowd(t + .06, 1.1, .26, 600, 1500); }); },   // Netz und Publikum
    fanfare() { run(t => { [261.6, 329.6, 392].forEach((f, i) => brass(f, t + i * .2, .2, .1)); brass(523.3, t + .6, .9, .12); tone(130, t, .2, 'sine', .4, 46); crowd(t, 2.4, .32, 600, 1800); }); },
    pack() { run(t => { crowd(t, .55, .3, 900, 6500); for (let i = 0; i < 6; i++) crowd(t + .1 + i * .08, .03, .26, 2500, 5000); [1318, 1760, 2093].forEach((f, i) => tone(f, t + .65 + i * .07, .22, 'sine', .07)); }); },
    stage() { run(t => { crowd(t, .45, .3, 2500, 900); tone(300, t, .3, 'sine', .2, 90); for (let i = 0; i < 10; i++) tone(1700, t + .3 + i * .055, .02, 'square', .035); }); },
    sparkle() { run(t => { [1318, 1760, 2093, 2637].forEach((f, i) => tone(f, t + i * .07, .22, 'sine', .07)); }); },
    splash() { run(t => { crowd(t, .5, .3, 3000, 900); tone(300, t, .3, 'sine', .2, 90); }); },
  };
})();

const FX = (function () {
  let cv = null, cx = null, parts = [], raf = 0, last = 0, W = 0, H = 0;
  const COLORS = ['#c6ff3d', '#ffd23c', '#ff8a1f', '#38c9f2', '#ffffff', '#ff5a52'];
  function fit() {
    if (!cv) return;
    const d = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cx.setTransform(d, 0, 0, d, 0, 0);
  }
  function init() {
    cv = document.getElementById('fx'); if (!cv) return;
    cx = cv.getContext('2d'); fit(); window.addEventListener('resize', fit);
  }
  function add(x, y, n, o) {
    const emojis = o.emojis || [];
    for (let i = 0; i < n; i++) {
      const a = (o.angle != null ? o.angle : -Math.PI / 2) + (Math.random() - .5) * (o.spread != null ? o.spread : Math.PI * 2);
      const v = (o.speed || 9) * (.45 + Math.random() * .8);
      parts.push({
        x: typeof x === 'function' ? x() : x, y: typeof y === 'function' ? y() : y,
        vx: o.still ? 0 : Math.cos(a) * v, vy: o.fall ? 1 + Math.random() * 3 : Math.sin(a) * v,
        r: Math.random() * 6.28, vr: (Math.random() - .5) * .35, s: 6 + Math.random() * 7,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        e: emojis.length && Math.random() < (o.emojiShare || .2) ? emojis[(Math.random() * emojis.length) | 0] : null,
        shape: Math.random() < .35 ? 'c' : 'r', life: 0, max: (o.life || 2.4) + Math.random() * 1.1, g: o.gravity || .26,
      });
    }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function tick(t) {
    const dt = Math.min(2.5, (t - last) / 16.67); last = t;
    cx.clearRect(0, 0, W, H);
    parts = parts.filter(p => p.life < p.max && p.y < H + 60);
    for (const p of parts) {
      p.life += dt / 60; p.vx *= .985; p.vy = p.vy * .985 + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, (p.max - p.life) / .6)); cx.translate(p.x, p.y); cx.rotate(p.r);
      if (p.e) { cx.font = Math.round(p.s * 2.6) + 'px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(p.e, 0, 0); }
      else {
        cx.fillStyle = p.c;
        if (p.shape === 'c') { cx.beginPath(); cx.arc(0, 0, p.s / 2, 0, 6.3); cx.fill(); } else cx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6);
      }
      cx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
    if (!raf) cx.clearRect(0, 0, W, H);
  }
  const ok = () => cv && !stillMotion();
  return {
    init,
    /* kleiner Knall an einer Stelle (beim Tor) */
    pop(x, y, emojis) { if (ok()) add(x, y, 26, { speed: 7, spread: Math.PI * 1.4, angle: -Math.PI / 2, emojis: emojis || ['⚽'], emojiShare: .25, life: 1.7 }); },
    /* große Feier: zwei Kanonen von unten und Regen von oben */
    party(emojis) {
      if (!ok()) return;
      const e = emojis || ['⚽', '⭐'];
      add(W * .08, H * .92, 70, { angle: -Math.PI * .36, spread: .7, speed: 17, emojis: e, emojiShare: .2, life: 3.2, gravity: .3 });
      add(W * .92, H * .92, 70, { angle: -Math.PI * .64, spread: .7, speed: 17, emojis: e, emojiShare: .2, life: 3.2, gravity: .3 });
      setTimeout(() => add(() => Math.random() * W, -20, 70, { fall: true, still: true, emojis: e, emojiShare: .15, life: 3.6, gravity: .1 }), 350);
    },
    clear() { parts = []; },
  };
})();
