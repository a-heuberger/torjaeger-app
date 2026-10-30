/* ============ Grafik: Ball, Pokal, Wappen, Karten, Icons, Angel-Szene ============ */
const svgTag = (vb, body, attrs) => '<svg viewBox="' + vb + '" aria-hidden="true" focusable="false"' + (attrs ? ' ' + attrs : '') + '>' + body + '</svg>';
const f1 = n => n.toFixed(1);

/* ---- Fußball: berechnet, damit die Geometrie stimmt ---- */
function pentPts(cx, cy, r, rot) {
  const p = [];
  for (let i = 0; i < 5; i++) { const a = rot + i * 2 * Math.PI / 5; p.push(f1(cx + r * Math.cos(a)) + ',' + f1(cy + r * Math.sin(a))); }
  return p.join(' ');
}
function pentVerts(cx, cy, r, rot) {
  const p = [];
  for (let i = 0; i < 5; i++) { const a = rot + i * 2 * Math.PI / 5; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return p;
}
const BALL_INNER = (function () {
  const R1 = 16, D = 47, R2 = 15, ink = '#14201a';
  let fills = '<polygon points="' + pentPts(50, 50, R1, -Math.PI / 2) + '"/>';
  let seams = '';
  const outer = [];
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * 2 * Math.PI / 5;
    const cx = 50 + D * Math.cos(a), cy = 50 + D * Math.sin(a);
    fills += '<polygon points="' + pentPts(cx, cy, R2, a + Math.PI) + '"/>';
    const vx = 50 + R1 * Math.cos(a), vy = 50 + R1 * Math.sin(a);
    const ix = cx + R2 * Math.cos(a + Math.PI), iy = cy + R2 * Math.sin(a + Math.PI);
    seams += 'M' + f1(vx) + ' ' + f1(vy) + 'L' + f1(ix) + ' ' + f1(iy);
    outer.push({ cx, cy, a, v: pentVerts(cx, cy, R2, a + Math.PI) });
  }
  // Nähte zwischen benachbarten äußeren Fünfecken: je die zugewandten Ecken verbinden
  for (let k = 0; k < 5; k++) {
    const A = outer[k], B = outer[(k + 1) % 5];
    const near = (P, Q) => P.v.slice(1).reduce((best, v) => (Math.hypot(v[0] - Q.cx, v[1] - Q.cy) < Math.hypot(best[0] - Q.cx, best[1] - Q.cy) ? v : best), P.v[1]);
    const va = near(A, B), vb = near(B, A);
    seams += 'M' + f1(va[0]) + ' ' + f1(va[1]) + 'L' + f1(vb[0]) + ' ' + f1(vb[1]);
  }
  return '<circle cx="50" cy="50" r="48" fill="url(#gBall)"/>' +
    '<g clip-path="url(#ballClip)"><g fill="' + ink + '" stroke="' + ink + '" stroke-width="1.2" stroke-linejoin="round">' + fills + '</g>' +
    '<path d="' + seams + '" fill="none" stroke="' + ink + '" stroke-width="1.5" stroke-linecap="round"/>' +
    '<ellipse cx="34" cy="26" rx="17" ry="9" fill="#fff" opacity=".5" transform="rotate(-32 34 26)"/></g>' +
    '<circle cx="50" cy="50" r="48" fill="none" stroke="' + ink + '" stroke-width="2.6"/>';
})();
const ballSVG = (size, cls) => '<svg class="ball' + (cls ? ' ' + cls : '') + '" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' + BALL_INNER + '</svg>';

/* Einfarbiger Ball für die Tab-Leiste */
const BALL_MONO = svgTag('0 0 24 24',
  '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<polygon points="' + pentPts(12, 12.3, 3.6, -Math.PI / 2) + '" fill="currentColor"/>' +
  '<path d="M12 8.7V5M15.2 10.6l3.6-1.2M14 14.6l2.3 3.1M10 14.6l-2.3 3.1M8.8 10.6L5.2 9.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>');

/* ---- Pokal (Farbe über CSS-Klasse bronze/silver/gold) ---- */
const trophySVG = (cls, size) => '<svg class="troph ' + cls + '" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' +
  '<g fill="currentColor"><path d="M18 7h28v15a14 14 0 0 1-28 0V7z"/><path d="M28 36h8v8h-8z"/><path d="M19 46h26a3 3 0 0 1 3 3v5H16v-5a3 3 0 0 1 3-3z"/></g>' +
  '<path d="M18 11H9v4c0 6.5 4.6 10.5 10.5 11.5M46 11h9v4c0 6.5-4.6 10.5-10.5 11.5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
  '<path d="M23 12h4.5v15c-3.2-1.2-4.5-4-4.5-7.5z" fill="#fff" opacity=".42"/>' +
  '<path d="M24 50h16" stroke="#000" stroke-opacity=".18" stroke-width="2" stroke-linecap="round"/></svg>';

function starPts(cx, cy, R, r) {
  const p = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; p.push(f1(cx + d * Math.cos(a)) + ',' + f1(cy + d * Math.sin(a))); }
  return p.join(' ');
}
/* ---- Trikot mit Rückennummer; pro gefangenem Fisch ein Stern ---- */
const JERSEYS = {
  green: { name: 'Grün', fill: '#2f9d4f', dark: '#17562b', ink: '#ffffff' },
  blue: { name: 'Blau', fill: '#2f6fe0', dark: '#183f8f', ink: '#ffffff' },
  red: { name: 'Rot', fill: '#d63a3a', dark: '#862020', ink: '#ffffff' },
  yellow: { name: 'Gelb', fill: '#f2c500', dark: '#a98900', ink: '#1a1a1a' },
  white: { name: 'Weiß', fill: '#f3f5f4', dark: '#aab2ae', ink: '#1a1a1a' },
  black: { name: 'Schwarz', fill: '#2a3033', dark: '#101314', ink: '#ffffff' },
};
function jerseySVG(color, num, size, stars) {
  const j = JERSEYS[color] || JERSEYS.green, n = String(num == null ? '' : num).slice(0, 2);
  let st = '';
  const k = Math.max(0, Math.min(5, stars || 0));
  for (let i = 0; i < k; i++) st += '<polygon points="' + starPts(32 + (i - (k - 1) / 2) * 7.2, 22, 3.6, 1.55) + '" fill="#ffd23c" stroke="rgba(60,40,0,.75)" stroke-width=".7" stroke-linejoin="round"/>';
  return '<svg class="jersey" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' +
    '<path d="M21 4l11 4 11-4 15 10-7 13-5-3.5V58Q32 62 18 58V23.5L13 27 6 14z" fill="' + j.fill + '" stroke="rgba(0,0,0,.45)" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M6 14l7 13 5-3.5V20.5L13 17zM58 14l-7 13-5-3.5V20.5L51 17z" fill="' + j.dark + '" opacity=".55"/>' +
    '<path d="M25.5 4.4Q32 14 38.5 4.4" fill="none" stroke="' + j.dark + '" stroke-width="3" stroke-linecap="round"/>' +
    st + '<text x="32" y="' + (k ? 46 : 42.5) + '" text-anchor="middle" font-family="Barlow Condensed,Impact,sans-serif" font-weight="900" font-style="italic" font-size="' + (n.length > 1 ? 25 : 29) + '" fill="' + j.ink + '">' + esc(n) + '</text></svg>';
}

/* ---- Gegner-Monster: lümmelt gähnend (lazy, wenn es vorn liegt), schaut geknickt (sad) oder gelassen (meh). Nie schadenfroh. ---- */
function monsterSVG(mood, size) {
  const m = mood || 'meh';
  let eyes, brows, mouth, extra = '';
  if (m === 'lazy') {
    eyes = '<g fill="none" stroke="#3b1408" stroke-width="3" stroke-linecap="round"><path d="M15 34Q23 40 31 34"/><path d="M36 32Q41 37 47 32"/></g>';
    brows = '<g fill="none" stroke="#3b1408" stroke-width="3" stroke-linecap="round"><path d="M15 25l14-2M49 24l-12-1"/></g>';
    mouth = '<ellipse cx="32" cy="51" rx="5.4" ry="6.4" fill="#4a1220"/><ellipse cx="32" cy="54" rx="3" ry="2.6" fill="#c8506a"/>';
    extra = '<text x="50" y="14" font-family="Barlow Condensed,Impact,sans-serif" font-weight="900" font-style="italic" font-size="13" fill="#fff" opacity=".85">z</text><text x="56" y="8" font-family="Barlow Condensed,Impact,sans-serif" font-weight="900" font-style="italic" font-size="9" fill="#fff" opacity=".6">z</text>';
  } else {
    const pup = m === 'sad' ? [23, 36.5, 41, 33.5] : [24.5, 33.5, 40.5, 31];
    eyes = '<circle cx="23" cy="34" r="8.4" fill="#fff"/><circle cx="41" cy="31.5" r="6.3" fill="#fff"/>' +
      '<circle cx="' + pup[0] + '" cy="' + pup[1] + '" r="3.7" fill="#161616"/><circle cx="' + pup[2] + '" cy="' + pup[3] + '" r="2.9" fill="#161616"/>' +
      '<circle cx="' + (pup[0] - 1) + '" cy="' + (pup[1] - 1.2) + '" r="1.1" fill="#fff"/>';
    brows = '<g fill="none" stroke="#3b1408" stroke-width="3" stroke-linecap="round">' + (m === 'sad' ? '<path d="M15 29l14-6M49 27L36 23"/>' : '<path d="M15 26h14M49 25H36"/>') + '</g>';
    mouth = m === 'sad'
      ? '<path d="M21 52Q32 43 43 52" fill="none" stroke="#4a1220" stroke-width="3.4" stroke-linecap="round"/>'
      : '<path d="M22 49h20" stroke="#4a1220" stroke-width="3.4" stroke-linecap="round"/>';
    if (m === 'sad') extra = '<path d="M52 40q3 5 0 7q-3-2 0-7z" fill="#bfeaff"/>';
  }
  return '<svg class="monster ' + m + '" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' +
    '<path d="M15 20L10 5l13 8zM49 20l5-15-13 8z" fill="#ffe7b0" stroke="rgba(0,0,0,.3)" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M5 41C5 24 17 12 32 12s27 12 27 29c0 13-11 19-27 19S5 54 5 41z" fill="url(#gMon)" stroke="rgba(0,0,0,.4)" stroke-width="1.8"/>' +
    eyes + brows + mouth + extra +
    '<circle cx="12.5" cy="44" r="3.2" fill="#ff7a8a" opacity=".5"/><circle cx="52" cy="43" r="3.2" fill="#ff7a8a" opacity=".5"/></svg>';
}

/* ---- Tor mit Netz (Ziel des Torschusses) ---- */
function goalSVG(w) {
  let net = '';
  for (let x = 18; x < 148; x += 10) net += 'M' + x + ' 8V80';
  for (let y = 18; y < 80; y += 9) net += 'M8 ' + y + 'H152';
  return '<svg class="goal" viewBox="0 0 160 88" width="' + w + '" height="' + f1(w * 88 / 160) + '" aria-hidden="true" focusable="false">' +
    '<g class="netg"><path d="' + net + '" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1"/></g>' +
    '<path d="M6 82V8h148v74" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M0 84h160" stroke="#fff" stroke-opacity=".35" stroke-width="2"/></svg>';
}

/* ---- Sticker-Tüte ---- */
function packSVG(size) {
  let crimp = '';
  for (let x = 12; x <= 68; x += 4) crimp += 'M' + x + ' 8v6M' + x + ' 96v6';
  return '<svg class="packsvg" viewBox="0 0 80 110" width="' + f1(size * 80 / 110) + '" height="' + size + '" aria-hidden="true" focusable="false">' +
    '<rect x="8" y="5" width="64" height="100" rx="5" fill="url(#gPack)" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>' +
    '<rect x="8" y="5" width="64" height="11" rx="4" fill="#0a1d3a" opacity=".75"/><rect x="8" y="94" width="64" height="11" rx="4" fill="#0a1d3a" opacity=".75"/>' +
    '<path d="' + crimp + '" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>' +
    '<g transform="translate(24 28) scale(.32)">' + BALL_INNER + '</g>' +
    '<text x="40" y="76" text-anchor="middle" font-family="Barlow Condensed,Impact,sans-serif" font-weight="900" font-style="italic" font-size="15" fill="#fff">STICKER</text>' +
    '<text x="40" y="88" text-anchor="middle" font-family="Barlow,Arial,sans-serif" font-weight="700" font-size="7" letter-spacing="1.6" fill="#ffd23c">TÜTE</text>' +
    '<path d="M14 18L40 100" stroke="#fff" stroke-opacity=".12" stroke-width="10"/></svg>';
}

/* ---- Karten ---- */
const cardSVG = (kind, size) => '<svg class="card-ic ' + kind + '" viewBox="0 0 24 32" width="' + f1(size * .75) + '" height="' + size + '" aria-hidden="true" focusable="false">' +
  '<g transform="rotate(8 12 16)"><rect x="3.5" y="2" width="17" height="28" rx="3" fill="currentColor"/><rect x="6.2" y="4.6" width="3.4" height="22.5" rx="1.7" fill="#fff" opacity=".38"/></g></svg>';

/* ---- Symbole ---- */
const IC = {
  check: svgTag('0 0 24 24', '<path d="M4.5 12.5l5 5L19.5 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  cross: svgTag('0 0 24 24', '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>'),
  minus: svgTag('0 0 24 24', '<path d="M5.5 12h13" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>'),
  plus: svgTag('0 0 24 24', '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>'),
  lock: svgTag('0 0 24 24', '<rect x="5" y="11" width="14" height="9.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.6 0V11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  unlock: svgTag('0 0 24 24', '<rect x="5" y="11" width="14" height="9.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.2-1.7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  chevL: svgTag('0 0 24 24', '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  chevR: svgTag('0 0 24 24', '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  flame: svgTag('0 0 24 24', '<path d="M12.2 1.8c.7 3.6 5.1 5.9 5.1 10.7a5.3 5.3 0 0 1-10.6 0c0-2.3 1.1-3.6 2.3-4.7.1 1.4.8 2.3 1.8 2.8-.6-3-.3-6.5 1.4-8.8z" fill="url(#gFlame)"/><path d="M12 22.2a3.2 3.2 0 0 1-3.2-3.2c0-1.7 1.3-2.6 1.9-3.6.7 1.1 2.5 1.8 2.5 3.6 0 1.1-.5 2-1.2 3.2z" fill="#ffe27a"/>'),
  star: svgTag('0 0 24 24', '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/>'),
  trophy: svgTag('0 0 24 24', '<path d="M7 4h10v5.2a5 5 0 0 1-10 0V4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 6H4v1.6A3.2 3.2 0 0 0 7 11M17 6h3v1.6A3.2 3.2 0 0 1 17 11M12 14.2V18M8.5 20.3h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  coin: svgTag('0 0 24 24', '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.4 8.9c-.6-.9-1.7-1.4-3-1.4-1.9 0-3.2 1.4-3.2 4.5s1.3 4.5 3.2 4.5c1.3 0 2.4-.5 3-1.4M7.6 10.8h5.6M7.6 13.2h5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  fish: svgTag('0 0 24 24', '<path d="M2.5 12c3.2-4.8 9.6-6 13.4-2.6L21.5 6v12l-5.6-3.4C12.1 18 5.7 16.8 2.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="7.2" cy="11" r="1.1" fill="currentColor"/>'),
  whistle: svgTag('0 0 24 24', '<path d="M3 14.8a6 6 0 1 0 12 0 6 6 0 0 0-12 0z" fill="none" stroke="currentColor" stroke-width="2.1"/><path d="M13.4 10.4L21.5 8.6v4.3l-6.4 1.3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/><circle cx="9" cy="14.8" r="1.5" fill="currentColor"/>'),
  eye: svgTag('0 0 24 24', '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
  back: svgTag('0 0 24 24', '<path d="M10 6l-6 6 6 6M4.5 12H20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  sound: svgTag('0 0 24 24', '<path d="M4 9.5h3.6L12.5 5v14l-4.9-4.5H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 5.8a9 9 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  mute: svgTag('0 0 24 24', '<path d="M4 9.5h3.6L12.5 5v14l-4.9-4.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
};
const TAB_IC = { today: BALL_MONO, week: IC.trophy, achieve: IC.fish, konto: IC.coin, coach: IC.whistle };

/* ---- Goldmünze für das Konto ---- */
const coinSVG = size => '<svg class="coin-svg" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' +
  '<circle cx="32" cy="35" r="26" fill="#a85f12"/><circle cx="32" cy="31" r="26" fill="url(#gCoin)"/>' +
  '<circle cx="32" cy="31" r="20.5" fill="none" stroke="#a8620f" stroke-opacity=".5" stroke-width="2.4"/>' +
  '<path d="M39.8 23.4c-1.6-2.4-4.2-3.7-7.4-3.7-4.9 0-8 3.6-8 11.3s3.1 11.3 8 11.3c3.2 0 5.8-1.3 7.4-3.7M20.6 28.2h15.8M20.6 33.8h15.8" fill="none" stroke="#8a4d08" stroke-width="3.8" stroke-linecap="round"/>' +
  '<path d="M15.5 23A20 20 0 0 1 30 11" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="3" stroke-linecap="round"/></svg>';

/* ---- Angel-Szene: Riesen-Hecht wird an Land gezogen ---- */
const FISH_SHAPE =
  '<path d="M62 -26Q54 -12 52 0Q54 12 62 26L40 8L40 -8Z" fill="#2c6a3a"/>' +
  '<path d="M-4 -18Q8 -40 30 -11Z" fill="#265f33"/>' +
  '<path d="M-6 17Q2 33 17 16Z" fill="#e0662c"/>' +
  '<path d="M-54 4C-50 -4 -42 -12 -30 -15C-10 -21 18 -19 40 -8L40 8C18 20 -10 22 -30 15C-42 12 -50 10 -54 4Z" fill="url(#gFish)"/>' +
  '<path d="M-44 9C-26 19 4 21 38 8C8 24 -28 21 -44 9Z" fill="#f1f7c9" opacity=".7"/>' +
  '<g fill="#e8e08a" opacity=".75"><ellipse cx="-8" cy="-9" rx="4.4" ry="2.4"/><ellipse cx="8" cy="-8" rx="4" ry="2.2"/><ellipse cx="22" cy="-5" rx="3.6" ry="2"/><ellipse cx="-20" cy="-11" rx="3.4" ry="2"/></g>' +
  '<path d="M-22 -9Q-15 0 -22 11" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M-54 4L-33 7.5" stroke="#14261a" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M-50 4.6l2.6 3.2 2.6-2.6zM-42 6l2.6 3.2 2.6-2.4zM-35 7l2.4 2.8 2.2-2z" fill="#fff"/>' +
  '<circle cx="-31" cy="-4.5" r="5.6" fill="#fff"/><circle cx="-32.4" cy="-4.2" r="3" fill="#111"/><circle cx="-33.4" cy="-5.2" r="1" fill="#fff"/>' +
  '<path d="M-38 -12.5L-24 -8" stroke="#12261a" stroke-width="2.6" stroke-linecap="round"/>';
const fishSVG = (size) => '<svg class="fish-emb" viewBox="-70 -42 144 84" width="' + size + '" height="' + f1(size * 84 / 144) + '" aria-hidden="true" focusable="false">' + FISH_SHAPE + '</svg>';

/* ---- Fisch-Sticker der Angel-Serie: Arten parametrisch gezeichnet (64 x 40, Kopf links, ohne Verläufe) ---- */
function speciesSVG(o) {
  const cx = 31, cy = 21, rx = o.rx, ry = o.ry, n1 = v => Math.round(v * 10) / 10;
  const hy = x => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) * ((x - cx) / rx)));
  const top = x => cy - hy(x), bot = x => cy + hy(x);
  const spikes = (x0, x1, n, h, c) => {
    let d = 'M' + x0 + ' ' + n1(top(x0) + 2);
    const st = (x1 - x0) / n;
    for (let i = 0; i < n; i++) { const xa = x0 + st * i, xp = xa + st * .4, xb = xa + st; d += 'L' + n1(xp) + ' ' + n1(top(xp) - h) + 'L' + n1(xb) + ' ' + n1(top(xb) + 1.5); }
    return '<path d="' + d + 'Z" fill="' + c + '"/>';
  };
  const soft = (x0, x1, h, c) => '<path d="M' + x0 + ' ' + n1(top(x0) + 2) + 'Q' + n1((x0 + x1) / 2) + ' ' + n1(top((x0 + x1) / 2) - h) + ' ' + x1 + ' ' + n1(top(x1) + 2) + 'Z" fill="' + c + '"/>';
  const under = (x0, x1, h, c) => '<path d="M' + x0 + ' ' + n1(bot(x0) - 2) + 'Q' + n1((x0 + x1) / 2) + ' ' + n1(bot((x0 + x1) / 2) + h) + ' ' + x1 + ' ' + n1(bot(x1) - 2) + 'Z" fill="' + c + '"/>';
  const tx = cx + rx - 3;
  let s = '<path d="M' + n1(tx) + ' ' + cy + 'L63 ' + (cy - o.tail) + 'Q' + n1(tx + 8) + ' ' + cy + ' 63 ' + (cy + o.tail) + 'Z" fill="' + o.fin + '"/>';
  s += o.fins(spikes, soft, under);
  s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + o.body + '"/>';
  s += '<path d="M' + n1(cx - rx + 4) + ' ' + n1(cy + ry * .3) + 'Q' + cx + ' ' + n1(cy + ry * 1.4) + ' ' + n1(cx + rx - 4) + ' ' + n1(cy + ry * .3) + 'Q' + cx + ' ' + n1(cy + ry * .62) + ' ' + n1(cx - rx + 4) + ' ' + n1(cy + ry * .3) + 'Z" fill="' + o.belly + '" opacity=".9"/>';
  s += o.pattern(hy, cx, cy, n1);
  s += '<path d="M' + n1(cx - rx + 11) + ' ' + n1(cy - ry * .75) + 'Q' + n1(cx - rx + 15) + ' ' + cy + ' ' + n1(cx - rx + 11) + ' ' + n1(cy + ry * .75) + '" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1.5" stroke-linecap="round"/>';
  const ex = n1(cx - rx + 8), ey = n1(cy - ry * .25), er = o.eye || 2.6;
  s += (o.extra || '') + '<circle cx="' + ex + '" cy="' + ey + '" r="' + er + '" fill="' + (o.eyeC || '#fff') + '"/><circle cx="' + n1(ex - .5) + '" cy="' + ey + '" r="' + n1(er * .52) + '" fill="#10200f"/>';
  return '<svg class="spc" viewBox="0 0 64 40" aria-hidden="true" focusable="false">' + s + '</svg>';
}
const bars = (xs, c, w, op) => (hy, cx, cy, n1) => xs.map(x => '<path d="M' + x + ' ' + n1(cy - hy(x) + 1.6) + 'V' + n1(cy + hy(x) * .55) + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" opacity="' + op + '"/>').join('');
const FISH_ICO = {
  'Der Kapitale': '<svg class="spc" viewBox="-64 -40 134 80" aria-hidden="true" focusable="false">' + FISH_SHAPE + '</svg>',
  Barsch: speciesSVG({ rx: 22, ry: 12.5, tail: 10, body: '#86a43a', belly: '#eef1a4', fin: '#e8502a', eye: 2.7, eyeC: '#ffd44a',
    fins: (sp, so, un) => sp(17, 34, 5, 7, '#34521c') + so(35, 46, 7, '#3f5f20') + un(22, 30, 8, '#e8502a') + un(38, 46, 6, '#e8502a'),
    pattern: bars([19, 25, 31, 37, 43], '#26370f', 3.4, '.55') }),
  Zander: speciesSVG({ rx: 26, ry: 9.5, tail: 8.5, body: '#7d927b', belly: '#e0e7d0', fin: '#6b8068', eye: 3.5, eyeC: '#f6f1c2',
    fins: (sp, so, un) => sp(16, 33, 6, 6, '#4b6150') + so(35, 48, 5, '#566d58') + un(40, 49, 5, '#6b8068'),
    pattern: bars([20, 26, 32, 38, 44], '#2c3a2e', 4.2, '.32') }),
  Karpfen: speciesSVG({ rx: 22.5, ry: 14.5, tail: 9.5, body: '#cf9632', belly: '#f2da8e', fin: '#b9651f', eye: 2.4,
    fins: (sp, so, un) => so(15, 46, 10, '#7b5a1c') + un(24, 31, 7, '#c8742a') + un(39, 47, 6, '#c8742a'),
    pattern: (hy, cx, cy, n1) => { let d = ''; for (let r = -2; r <= 2; r++) for (let x = cx - 12 + (r & 1) * 3; x <= cx + 16; x += 6) { if (Math.abs(r * 5) < hy(x) - 3) d += 'M' + n1(x) + ' ' + n1(cy + r * 5 - 1.5) + 'q3 3.6 6 0'; } return '<path d="' + d + '" fill="none" stroke="#7d5513" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>'; },
    extra: '<path d="M9.4 24.2q-4.2 .8-5 4.6M10.6 26.2q-3 2.6-2.2 6" fill="none" stroke="#7d5513" stroke-width="1.3" stroke-linecap="round"/>' }),
  Hecht: speciesSVG({ rx: 27, ry: 8, tail: 9, body: '#5f8c3b', belly: '#dfe9ae', fin: '#7b9a3a', eye: 2.8, eyeC: '#f3d24c',
    fins: (sp, so, un) => so(43, 53, 8, '#7b9a3a') + un(43, 52, 7, '#7b9a3a') + un(20, 26, 5, '#8aa845'),
    pattern: (hy, cx, cy, n1) => { let d = ''; [[13, -3], [19, -4.6], [25, -2], [30, -5], [36, -3], [42, -2.4], [16, 1], [23, 2], [30, 1.4], [38, 1.2]].forEach(a => { d += '<ellipse cx="' + a[0] + '" cy="' + n1(cy + a[1]) + '" rx="2.3" ry="1.2" fill="#e8e28c" opacity=".85"/>'; }); return d; },
    extra: '<path d="M4.6 18.4L2 19.6Q.4 22.2 2 24.6L5 25.6Z" fill="#5f8c3b"/><path d="M2.2 23.2H10.5" stroke="#1d2e14" stroke-width=".9" stroke-linecap="round"/><path d="M4 24v1.2M6.2 24v1.2M8.4 24v1.2" stroke="#fff" stroke-width=".8" stroke-linecap="round"/>' }),
  Forelle: speciesSVG({ rx: 24.5, ry: 10.5, tail: 9, body: '#9db07a', belly: '#f4f1d6', fin: '#8ea46c', eye: 2.8,
    fins: (sp, so, un) => so(22, 36, 8, '#85a063') + so(42, 47, 4, '#e8873a') + un(24, 31, 6, '#b9c796') + un(38, 46, 5, '#b9c796'),
    pattern: (hy, cx, cy, n1) => { let d = '<path d="M13 ' + n1(cy + .6) + 'Q31 ' + n1(cy - 1.4) + ' 51 ' + n1(cy + .4) + '" fill="none" stroke="#e58a9c" stroke-width="3" stroke-linecap="round" opacity=".85"/>'; [[16, -4], [21, -6], [26, -4.4], [31, -6.4], [36, -4], [41, -5], [46, -2.6], [19, 4], [27, 4.6], [35, 4.4], [43, 3]].forEach(a => { d += '<circle cx="' + a[0] + '" cy="' + n1(cy + a[1]) + '" r="1.1" fill="#26301c"/>'; if (a[1] > 0) d += '<circle cx="' + a[0] + '" cy="' + n1(cy + a[1]) + '" r="2" fill="none" stroke="#e0483e" stroke-width=".8" opacity=".9"/>'; }); return d; } }),
};
Object.assign(FISH_ICO, {
  Rotauge: speciesSVG({ rx: 22, ry: 11.5, tail: 9, body: '#a9b9bd', belly: '#f0f4f2', fin: '#e2573a', eye: 2.9, eyeC: '#f26a3a',
    fins: (sp, so, un) => so(24, 38, 6, '#7c8f93') + un(26, 34, 6, '#e2573a') + un(38, 47, 5, '#e2573a'),
    pattern: (hy, cx, cy, n1) => '<path d="M15 ' + n1(cy - 3.4) + 'Q31 ' + n1(cy - 6.4) + ' 49 ' + n1(cy - 3.2) + '" fill="none" stroke="#5f7479" stroke-width="3" stroke-linecap="round" opacity=".38"/><path d="M15 ' + n1(cy + .6) + 'Q31 ' + n1(cy - 1.6) + ' 49 ' + n1(cy + .4) + '" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>' }),
  Aal: speciesSVG({ rx: 29, ry: 5.2, tail: 2.6, body: '#6f7a45', belly: '#e6df9f', fin: '#59612f', eye: 1.9, eyeC: '#e9e6c0',
    fins: (sp, so, un) => so(14, 56, 3.4, '#59612f') + un(20, 56, 3.4, '#59612f'),
    pattern: (hy, cx, cy, n1) => '<path d="M8 ' + n1(cy - 2.2) + 'Q31 ' + n1(cy - 5.2) + ' 56 ' + n1(cy - 1.6) + '" fill="none" stroke="#3f4720" stroke-width="2.4" stroke-linecap="round" opacity=".38"/>',
    extra: '<path d="M13.4 22.6Q17 27 20.4 23.4Z" fill="#59612f"/>' }),
  Lachs: speciesSVG({ rx: 25, ry: 10, tail: 9, body: '#9db0c1', belly: '#eef3f6', fin: '#5d7285', eye: 2.7,
    fins: (sp, so, un) => so(24, 36, 6, '#6e8497') + so(43, 47, 3, '#6e8497') + un(26, 34, 6, '#c8d3dc') + un(38, 47, 5, '#c8d3dc'),
    pattern: (hy, cx, cy, n1) => { let d = '<path d="M13 ' + n1(cy - 3.6) + 'Q31 ' + n1(cy - 6.6) + ' 50 ' + n1(cy - 3.4) + '" fill="none" stroke="#5f7a92" stroke-width="3.2" stroke-linecap="round" opacity=".5"/>'; [[18, -4.6], [23, -6], [28, -4.2], [33, -6.2], [38, -4.4], [43, -3.4], [21, -1.6], [30, -1.4], [40, -1], [26, 1.6]].forEach(a => { d += '<circle cx="' + a[0] + '" cy="' + n1(cy + a[1]) + '" r=".95" fill="#26343f" opacity=".85"/>'; }); return d; } }),
  Wels: speciesSVG({ rx: 27, ry: 10.5, tail: 5.2, body: '#515a3a', belly: '#d7cfa4', fin: '#3f472b', eye: 1.9, eyeC: '#f2e6a0',
    fins: (sp, so, un) => so(17, 24, 3, '#3f472b') + un(22, 56, 5.4, '#3f472b'),
    pattern: (hy, cx, cy, n1) => { let d = ''; [[20, -3.5, 4.2, 2.2], [29, 1.5, 4.6, 2.4], [37, -3, 4, 2.2], [45, 2, 3.8, 2], [24, 4.5, 3.4, 1.8], [33, -6, 3, 1.6]].forEach(a => { d += '<ellipse cx="' + a[0] + '" cy="' + n1(cy + a[1]) + '" rx="' + a[2] + '" ry="' + a[3] + '" fill="#2e3520" opacity=".42"/>'; }); return d; },
    extra: '<path d="M4.3 22.4Q8 25.2 13 23.8" fill="none" stroke="#1f2415" stroke-width="1.1" stroke-linecap="round"/><path d="M5.2 21.4Q1.6 20 .4 16.8M5.6 23Q1.8 24.6 .6 28.4M8.2 24.4Q6 28 6.6 31.4" fill="none" stroke="#2e3520" stroke-width="1.1" stroke-linecap="round"/>' }),
});
STICKERS.forEach(s => { if (FISH_ICO[s.name]) s.ico = FISH_ICO[s.name]; });

/* ---- Der Angler: ein blonder Junge (9) mit grünem Kapuzenpulli, steht am Steg und kurbelt. Blickt nach rechts, zur Sonne.
   Die Rutenspitze liegt bei ROD_TIP (192, 47): Von dort läuft die Schnur zum Fisch. ---- */
const ANGLER_SVG = '<g class="angler">' +
  /* Schatten auf dem Steg */
  '<ellipse cx="94" cy="109" rx="19" ry="2" fill="#1a0f08" opacity=".35"/>' +
  /* hinteres Bein */
  '<path d="M88.4 89L85.4 100.6" stroke="#e2a47a" stroke-width="4.3" stroke-linecap="round" fill="none"/>' +
  '<path d="M85.5 100.2L85.1 104.4" stroke="#e9eef2" stroke-width="4.5" stroke-linecap="round" fill="none"/>' +
  '<path d="M83.3 100.3H87.7" stroke="#ff7a2b" stroke-width=".9" stroke-linecap="round"/>' +
  '<path d="M90.6 81.5L88.6 90.6" stroke="#223a73" stroke-width="8" stroke-linecap="round" fill="none"/>' +
  '<path d="M79.6 108.4Q79 104.8 82.6 103.8L87.2 103.5Q92.6 104.4 93.6 107.2Q93.8 108.4 92.6 108.5Z" fill="#d5dbe1"/>' +
  '<path d="M79.4 107.7H93.8" stroke="#e0661f" stroke-width="1.2" stroke-linecap="round"/>' +
  /* hinterer Arm (verdeckt vom Oberkörper) */
  '<path d="M91.4 65L95.2 74.6L102.4 73.4" stroke="#238a42" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  /* vorderes Bein */
  '<path d="M97.8 89L100.2 100.6" stroke="#f1b88b" stroke-width="4.5" stroke-linecap="round" fill="none"/>' +
  '<path d="M100.3 100.2L100.7 104.4" stroke="#fff" stroke-width="4.7" stroke-linecap="round" fill="none"/>' +
  '<path d="M98.1 100.3H102.5" stroke="#ff7a2b" stroke-width=".9" stroke-linecap="round"/>' +
  '<path d="M93.2 81.6L97.6 90.2" stroke="#2f4f9a" stroke-width="8.6" stroke-linecap="round" fill="none"/>' +
  '<path d="M92.2 80.6L96.2 88.4" stroke="#4a6dc0" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".6"/>' +
  '<path d="M95.6 108.4Q95 104.4 98.4 103.4L102.8 103.2Q108.6 104 110.6 107Q111 108.5 109.6 108.6Z" fill="#f6f8fa"/>' +
  '<path d="M99.4 106Q103.4 104.8 107 106.4" stroke="#ff7a2b" stroke-width="1.1" stroke-linecap="round" fill="none"/>' +
  '<path d="M95.6 107.7H110.6" stroke="#ff7a2b" stroke-width="1.3" stroke-linecap="round"/>' +
  /* Kapuze im Rücken, Oberkörper (grüner Pulli) */
  '<path d="M88.6 62.2Q86 63.6 86.6 68Q88.6 67 90.8 64.4Z" fill="#2b9a4c"/>' +
  '<path d="M89.6 62.6Q94.6 59.8 99.4 62.8Q101 69 99.6 75Q98.9 80 98.6 83.6L88 84Q86.8 76 87.8 70Q88.2 65.6 89.6 62.6Z" fill="#35b35a"/>' +
  '<path d="M87.8 70Q86.8 76 88 84L91.8 83.8Q90.4 76 91.4 68.4Z" fill="#238a42" opacity=".55"/>' +
  '<path d="M88 81.8L98.6 81.6L98.6 84.1L88 84.4Z" fill="#238a42"/>' +
  '<path d="M99.3 63.2Q100.9 69 99.5 75" stroke="#ffd29a" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".6"/>' +
  '<path d="M95.7 63.2L95.5 67.2M97.4 63.4L97.5 66.8" stroke="#eef6ef" stroke-width=".7" stroke-linecap="round"/>' +
  /* Hals und Kopf */
  '<path d="M93 57.2H97.4V62.4Q95.2 63.8 93 62.4Z" fill="#e6a678"/>' +
  '<circle cx="95.6" cy="52" r="6.7" fill="#f6c39a"/>' +
  '<ellipse cx="102.1" cy="54.3" rx="1.3" ry="1.15" fill="#f6c39a"/>' +
  '<ellipse cx="92.6" cy="53.5" rx="1.6" ry="2.1" fill="#eeb085"/><ellipse cx="92.7" cy="53.6" rx=".7" ry="1.1" fill="#d9946a"/>' +
  '<ellipse cx="98.9" cy="51.9" rx=".95" ry="1.25" fill="#2a1a10"/><circle cx="99.2" cy="51.4" r=".38" fill="#fff"/>' +
  '<path d="M97.4 49.7Q99 48.8 100.6 49.4" stroke="#b78a2c" stroke-width=".9" stroke-linecap="round" fill="none"/>' +
  '<circle cx="98.5" cy="55.8" r="1.7" fill="#ff8f84" opacity=".5"/>' +
  '<g fill="#c98c63" opacity=".7"><circle cx="100.3" cy="54.5" r=".28"/><circle cx="101" cy="55" r=".28"/></g>' +
  '<path d="M99.8 57.4Q101.1 58.4 102.3 57.2" stroke="#b3533f" stroke-width=".75" stroke-linecap="round" fill="none"/>' +
  /* blonde Haare: wuschelig, mit Stirnfransen */
  '<path d="M101.7 49.6Q103 44.6 98.6 43.4Q95 42.4 91.8 43.8Q87.8 45.4 87.6 50.4Q87.2 55 89.6 58.2Q91 56.4 91.2 53.8L92.6 50.8Q95.6 50.2 98.6 48.8Q100.4 49.8 101.7 49.6Z" fill="#f7cf4e"/>' +
  '<path d="M93.4 43.6L92.4 40.6L95.6 42.6ZM96.6 42.8L97 39.8L99.4 42.8ZM99.8 43.8L101.8 41.6L102.2 45Z" fill="#f7cf4e"/>' +
  '<path d="M98.6 48.8L99.6 46.2L100.6 48.9L101.9 46.9L101.7 50.2Z" fill="#f7cf4e"/>' +
  '<path d="M87.6 50.4Q87.2 55 89.6 58.2Q90.6 57 91 55.4Q89 53 89.2 50Z" fill="#dcae33"/>' +
  '<path d="M92.2 45.4Q95.6 43.6 99.2 45.2" stroke="#fff0b8" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".85"/>' +
  /* vorderer Arm: Ärmel, Faust */
  '<path d="M94.8 64.6L96.9 73.4L103.2 71" stroke="#35b35a" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '<path d="M95.6 65.6L97.4 72.2" stroke="#6fdc88" stroke-width="1" stroke-linecap="round" fill="none" opacity=".6"/>' +
  '<path d="M102.2 71.4L103.9 70.8" stroke="#1f7a3a" stroke-width="5.4" stroke-linecap="round" fill="none"/>' +
  /* Angelrute: Korkgriff, Rolle, Rutenblatt bis zur Spitze */
  '<path d="M94 77Q102.96 71.72 111.56 67.36" stroke="#c89a62" stroke-width="3.6" stroke-linecap="round" fill="none"/>' +
  '<path d="M111.56 67.36Q134.14 55.92 154.25 50.83" stroke="#25252d" stroke-width="2.3" stroke-linecap="round" fill="none"/>' +
  '<path d="M154.25 50.83Q174.36 45.74 192 47" stroke="#25252d" stroke-width="1.4" stroke-linecap="round" fill="none"/>' +
  '<circle cx="192" cy="47" r="1.3" fill="none" stroke="#25252d" stroke-width=".7"/>' +
  '<circle cx="101.8" cy="76.4" r="3.1" fill="#d9dde4" stroke="#8c92a0" stroke-width=".9"/><circle cx="101.8" cy="76.4" r="1.2" fill="#8c92a0"/>' +
  '<path d="M101.8 76.4L99.6 79.6" stroke="#8c92a0" stroke-width="1" stroke-linecap="round"/><circle cx="99.4" cy="80" r="1" fill="#e2661f"/>' +
  /* Hände: hinten (Kurbel) und vorn (Griff) */
  '<circle cx="102.8" cy="73.4" r="2.2" fill="#e6a678"/>' +
  '<ellipse cx="105.4" cy="70.4" rx="2.7" ry="2.4" fill="#f6c39a"/><path d="M104.2 69.4H106.9M104.4 71.4H106.8" stroke="#d9946a" stroke-width=".55" stroke-linecap="round"/>' +
  '<ellipse cx="104.1" cy="68.7" rx="1.4" ry=".85" fill="#f6c39a" transform="rotate(-20 104.1 68.7)"/>' +
  '</g>';

/* Die Szene ist 360 x 250. Fisch und Schnur werden per setFish() positioniert (0 = tief und weit weg, 1 = gefangen). */
const ROD_TIP = [192, 47];
const CAUGHT_POSE = { x: 213, y: 86, s: 1.04, rot: 32 };
function swimPose(e) { return { x: 320 - 108 * e, y: 224 - 78 * e - Math.sin(e * Math.PI) * 8, s: .46 + .5 * e, rot: Math.sin(e * 9) * 3 }; }
function fishPose(p) {
  const e = Math.max(0, Math.min(1, p)), sw = swimPose(e);
  if (p >= 1) return Object.assign({ caught: true, e: 1 }, CAUGHT_POSE);
  if (p < .96) return Object.assign({ caught: false, e }, sw);
  const k = (p - .96) / .04, ks = k * k * (3 - 2 * k), L = (a, b) => a + (b - a) * ks;
  return { caught: false, e, x: L(sw.x, CAUGHT_POSE.x), y: L(sw.y, CAUGHT_POSE.y), s: L(sw.s, CAUGHT_POSE.s), rot: L(sw.rot, CAUGHT_POSE.rot) };
}
function fishMouth(po) {
  const a = po.rot * Math.PI / 180, mx = -54 * po.s, my = 4 * po.s;
  return [po.x + mx * Math.cos(a) - my * Math.sin(a), po.y + mx * Math.sin(a) + my * Math.cos(a)];
}
function linePath(po) {
  const m = fishMouth(po), t = ROD_TIP, slack = po.caught ? 0 : 1 - po.e;
  const cx = (t[0] + m[0]) / 2 + 12 * slack, cy = (t[1] + m[1]) / 2 + 24 * slack;
  return 'M' + f1(t[0]) + ' ' + f1(t[1]) + 'Q' + f1(cx) + ' ' + f1(cy) + ' ' + f1(m[0]) + ' ' + f1(m[1]);
}
function setFish(root, p) {
  if (!root) return;
  const po = fishPose(p), g = root.querySelector('#fFish'), l = root.querySelector('#fLine');
  if (g) g.setAttribute('transform', 'translate(' + f1(po.x) + ' ' + f1(po.y) + ') rotate(' + f1(po.rot) + ') scale(' + po.s.toFixed(3) + ')');
  if (l) l.setAttribute('d', linePath(po));
  const fadeDeep = po.caught ? 1 : .55 + .45 * po.e;
  if (g) g.setAttribute('opacity', fadeDeep.toFixed(2));
  root.classList.toggle('caught', !!po.caught);
}
function fangSVG(p) {
  const stars = [[22, 16, 1.2], [58, 34, 1], [96, 12, 1.4], [140, 28, .9], [176, 10, 1.1], [214, 30, 1], [296, 14, 1.3], [334, 36, 1], [318, 62, .9], [40, 62, .9]]
    .map(s => '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" fill="#fff" opacity=".75"/>').join('');
  const glints = [[0, 128, 40], [1, 133, 30], [2, 139, 22], [3, 146, 15], [4, 154, 10]]
    .map(g => '<rect x="' + (252 - g[2] / 2) + '" y="' + g[1] + '" width="' + g[2] + '" height="2.6" rx="1.3" fill="#ffe9a8" opacity="' + (.85 - g[0] * .14).toFixed(2) + '"/>').join('');
  const po = fishPose(p);
  return '<svg class="fang-svg' + (po.caught ? ' caught' : '') + '" viewBox="0 0 360 250" role="img" aria-label="Angel-Szene im Sonnenuntergang: ein blonder Junge zieht einen Riesen-Hecht an Land">' +
    '<defs><clipPath id="fWater"><rect x="0" y="121" width="360" height="129"/></clipPath></defs>' +
    '<rect width="360" height="124" fill="url(#gSky)"/>' + stars +
    '<circle cx="252" cy="118" r="58" fill="url(#gSun)"/><circle cx="252" cy="118" r="29" fill="#ffe9a8"/>' +
    '<path d="M0 113C34 93 74 104 116 97S198 86 244 101S330 91 360 99V126H0z" fill="#3a2f66"/>' +
    '<path d="M0 118C48 104 96 114 150 108S250 104 300 112S340 108 360 112V126H0z" fill="#27264f"/>' +
    '<g clip-path="url(#fWater)"><rect y="121" width="360" height="129" fill="url(#gWater)"/>' + glints +
    '<g class="waves" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="1.6" opacity=".16">' +
    '<path class="wv w1" d="M-40 150q12-5 24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0"/>' +
    '<path class="wv w2" d="M-40 182q14-6 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0"/>' +
    '<path class="wv w3" d="M-40 214q16-6 32 0t32 0t32 0t32 0t32 0t32 0t32 0t32 0t32 0t32 0"/></g>' +
    '<g class="bubbles" fill="none" stroke="#bfeaff" stroke-width="1.2" opacity=".6"><circle class="bb b1" cx="268" cy="206" r="3"/><circle class="bb b2" cx="286" cy="214" r="2"/><circle class="bb b3" cx="252" cy="222" r="2.4"/></g>' +
    '<rect y="190" width="360" height="60" fill="url(#gDeep)"/></g>' +
    '<g id="fFish" opacity="' + (po.caught ? 1 : .55 + .45 * po.e).toFixed(2) + '" transform="translate(' + f1(po.x) + ' ' + f1(po.y) + ') rotate(' + f1(po.rot) + ') scale(' + po.s.toFixed(3) + ')"><g class="fish-bob">' + FISH_SHAPE + '</g></g>' +
    '<g class="splash" fill="none" stroke="#fff" stroke-width="1.8"><ellipse class="sp s1" cx="262" cy="125" rx="16" ry="4"/><ellipse class="sp s2" cx="262" cy="125" rx="29" ry="7"/></g>' +
    '<g class="drops" fill="#cfefff"><circle cx="252" cy="106" r="2.4"/><circle cx="274" cy="102" r="2"/><circle cx="286" cy="113" r="1.8"/><circle cx="246" cy="116" r="1.6"/></g>' +
    '<path id="fLine" d="' + linePath(po) + '" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.3"/>' +
    '<g class="pier"><rect x="0" y="108" width="134" height="7" rx="1.5" fill="#6a4727"/><rect x="0" y="108" width="134" height="2" fill="#8a6038"/>' +
    '<path d="M22 108v7M44 108v7M66 108v7M88 108v7M110 108v7" stroke="#3a2412" stroke-width="1"/>' +
    '<rect x="14" y="115" width="7" height="60" fill="#3a2514"/><rect x="58" y="115" width="7" height="60" fill="#3a2514"/><rect x="104" y="115" width="7" height="60" fill="#3a2514"/></g>' +
    ANGLER_SVG +
    '</svg>';
}

/* ---- Spielfeldlinien (für den Spielstand) ---- */
const PITCH_BG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 220' preserveAspectRatio='none'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='.17' stroke-width='2'%3E%3Crect x='10' y='10' width='380' height='200' rx='6'/%3E%3Cline x1='200' y1='10' x2='200' y2='210'/%3E%3Ccircle cx='200' cy='110' r='36'/%3E%3Crect x='10' y='62' width='58' height='96'/%3E%3Crect x='332' y='62' width='58' height='96'/%3E%3C/g%3E%3C/svg%3E\")";

/* ---- gemeinsame Definitionen (Verläufe, Clip) – einmal im Dokument ---- */
const SVG_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
  '<radialGradient id="gBall" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef2f0"/><stop offset="1" stop-color="#aebab3"/></radialGradient>' +
  '<clipPath id="ballClip"><circle cx="50" cy="50" r="48"/></clipPath>' +
  '<linearGradient id="gFlame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23c"/><stop offset="1" stop-color="#ff5a1f"/></linearGradient>' +
  '<linearGradient id="gMon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb04a"/><stop offset="1" stop-color="#e0541a"/></linearGradient>' +
  '<linearGradient id="gPack" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a7cff"/><stop offset=".55" stop-color="#173f9f"/><stop offset="1" stop-color="#0a1f5c"/></linearGradient>' +
  '<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14224f"/><stop offset=".45" stop-color="#8a417c"/><stop offset=".78" stop-color="#e5675f"/><stop offset="1" stop-color="#ffa55a"/></linearGradient>' +
  '<radialGradient id="gSun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd27a" stop-opacity=".85"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e07a5f"/><stop offset=".1" stop-color="#3f6fa6"/><stop offset="1" stop-color="#071d3a"/></linearGradient>' +
  '<linearGradient id="gDeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04122a" stop-opacity="0"/><stop offset="1" stop-color="#04122a" stop-opacity=".55"/></linearGradient>' +
  '<linearGradient id="gFish" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a6a37"/><stop offset=".55" stop-color="#4f9c4b"/><stop offset="1" stop-color="#d4e59c"/></linearGradient>' +
  '<linearGradient id="gCoin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe58a"/><stop offset=".55" stop-color="#ffc23c"/><stop offset="1" stop-color="#ff9a3c"/></linearGradient>' +
  '</defs></svg>';
