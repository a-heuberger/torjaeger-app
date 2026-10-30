// Web-App gegen den echten Firestore-Emulator (echtes Firebase-SDK, echte Sicherheitsregeln aus firestore.rules.template):
// Erststart, Einrichtung, zwei Geräte live, falscher Code, offline schreiben und neu laden, Link teilen, abmelden, Regeln direkt.
// Voraussetzung: Emulator läuft auf 127.0.0.1:8085 (siehe AGENTS.md), gebaut mit: node build.js
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..', 'build/pwa-test');
const EMU = 'http://127.0.0.1:8085', PROJECT = 'demo-torjaeger', CODE = 'TESTCODE23456789', WRONG = 'WRONGCODE2345678', PORT = 5199;
const BASEURL = 'http://127.0.0.1:' + PORT + '/';
const DOCS = EMU + '/v1/projects/' + PROJECT + '/databases/(default)/documents';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let bad = 0;
const ok = (name, cond, info) => { if (!cond) bad++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? ' | ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = []; let allow = []; const ALWAYS = /cleardot\.gif|Failed to load resource.*(ERR_TUNNEL|ERR_PROXY|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION)/i;      // im Sandkasten ohne freies Internet scheitert nur dieser Ping an Google

/* ---- kleiner Webserver für build/pwa-test ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nicht da'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});

/* ---- Emulator: leeren, Dokumente lesen (Firestore-REST-Werte in einfache Objekte umwandeln) ---- */
const clearDb = () => fetch(EMU + '/emulator/v1/projects/' + PROJECT + '/databases/(default)/documents', { method: 'DELETE' });
function fromFs(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return +v.integerValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  return v;
}
async function getDoc(rel, code = CODE) {
  const r = await fetch(DOCS + '/families/' + code + '/' + rel, { headers: { Authorization: 'Bearer owner' } });
  if (r.status === 404) return null;
  const j = await r.json(); return fromFs({ mapValue: { fields: j.fields || {} } });
}
async function listDocs(rel, code = CODE) {
  const r = await fetch(DOCS + '/families/' + code + '/' + rel, { headers: { Authorization: 'Bearer owner' } });
  const j = await r.json(); return (j.documents || []).map(d => ({ id: d.name.split('/').pop(), data: fromFs({ mapValue: { fields: d.fields || {} } }) }));
}
async function waitFor(fn, ms = 12000, step = 250) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step); } }

/* ---- Familienlink ---- */
const payload = code => ({ k: code, f: { apiKey: 'fake-api-key', projectId: PROJECT, appId: '1:123:web:abc' }, e: { host: '127.0.0.1', port: 8085 } });
const link = code => BASEURL + '#c=' + Buffer.from(JSON.stringify(payload(code))).toString('base64url');

/* ---- Browser ---- */
async function open(b, url, o = {}) {
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: !!o.mobile, userAgent: o.ua });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!ALWAYS.test(t) && !allow.some(r => r.test(t))) errs.push('console.error: ' + t); } });
  page.on('pageerror', e => { if (!allow.some(r => r.test(e.message))) errs.push('PAGEERROR ' + e.message); });
  await page.clock.setFixedTime(new Date('2026-10-30T18:30:00'));
  await page.goto(url); await page.waitForTimeout(o.settle || 1500);
  return page;
}
const H = page => ({
  txt: sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/[\s ]+/g, ' ').trim() : null; }, sel),
  cnt: sel => page.evaluate(s => document.querySelectorAll(s).length, sel),
  digits: () => page.evaluate(() => { const e = document.querySelector('.digits'); return e ? e.textContent.replace(/\s/g, '') : null; }),
  wait: ms => page.waitForTimeout(ms),
});
/* Der Trainer-Modus lässt jedes Tor erst „schießen“ (Ball): Hier überspringen, damit der Spielstand sofort zählt. */
async function skipShots(page) { if (await page.evaluate(() => !!document.querySelector('[data-act="shoot-skip"]'))) { await page.click('[data-act="shoot-skip"]'); await page.waitForTimeout(500); } }
async function enter(page, name) {          // Einlauf durchspielen
  const h = H(page);
  await page.waitForSelector('.sheet.onboard', { timeout: 8000 });
  if (name) await page.fill('#ob-name', name);
  await page.click('[data-act="ob-go"]'); await h.wait(700);
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const b = await chromium.launch();
  const reach = await fetch(EMU).then(r => r.ok, () => false);
  if (!reach) { console.log('FAIL Emulator nicht erreichbar auf ' + EMU); process.exit(2); }

  // ---- A) Regeln direkt prüfen (ohne App): nur der Familienbereich ist erreichbar ----
  await clearDb();
  const st = async (method, rel, body) => (await fetch(DOCS + rel, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).status;
  const f1 = { fields: { x: { stringValue: 'a' } } };
  ok('A richtiger Code: Schreiben erlaubt', await st('PATCH', '/families/' + CODE + '/cfg/probe', f1) === 200);
  ok('A richtiger Code: Lesen erlaubt', await st('GET', '/families/' + CODE + '/cfg/probe') === 200);
  ok('A richtiger Code: Auflisten erlaubt', await st('GET', '/families/' + CODE + '/cfg') === 200);
  ok('A falscher Code: Lesen gesperrt', await st('GET', '/families/' + WRONG + '/cfg/probe') === 403);
  ok('A falscher Code: Schreiben gesperrt', await st('PATCH', '/families/' + WRONG + '/cfg/probe', f1) === 403);
  ok('A anderer Pfad: Schreiben gesperrt', await st('PATCH', '/andere/x', f1) === 403);
  ok('A Familienliste nicht abrufbar (niemand kann Codes auflisten)', await st('GET', '/families') === 403);
  await clearDb();

  // ---- B) Erststart ohne Link ----
  let page = await open(b, BASEURL); let h = H(page);
  ok('B ohne Link: Sperrseite „Familienlink fehlt“, kein Spiel, keine Einrichtung', /Familienlink fehlt/.test(await h.txt('.gate')) && await h.cnt('.tab, .task, .sheet') === 0);
  ok('B Eingabefeld und Knopf „Verbinden“ da', await h.cnt('#link-in') === 1 && /Verbinden/.test(await h.txt('[data-act="link-save"]')));
  await page.fill('#link-in', 'das ist kein link'); await page.click('[data-act="link-save"]'); await h.wait(300);
  ok('B ungültiger Text: Hinweis erscheint, nichts wird gespeichert', await page.evaluate(() => !document.querySelector('#link-err').hidden && localStorage.getItem('torj-cloud-v1') === null));
  const sw = await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r));
  ok('B Service Worker ist angemeldet', sw === true);
  ok('B Manifest und Symbole sind erreichbar', await page.evaluate(async () => { const m = await (await fetch('manifest.webmanifest')).json(); const i = await fetch('icon-180.png'); return m.display === 'standalone' && m.icons.length >= 3 && i.ok && i.headers.get('content-type') === 'image/png'; }));
  ok('B Apple-Meta: Symbol, Vollbild, Titel', await page.evaluate(() => !!document.querySelector('link[rel="apple-touch-icon"]') && document.querySelector('meta[name="apple-mobile-web-app-capable"]').content === 'yes' && document.querySelector('meta[name="apple-mobile-web-app-title"]').content === 'Torjäger'));
  // gültigen Link einfügen (ganzer Link)
  await page.fill('#link-in', link(CODE)); await page.click('[data-act="link-save"]'); await page.waitForTimeout(2500);
  ok('B gültiger Link eingefügt: App verbindet sich, Einlauf erscheint (leerer Stand)', await h.cnt('.sheet.onboard') === 1);
  ok('B Link bleibt in der Adresszeile (für „Zum Home-Bildschirm“)', page.url().includes('#c='));
  ok('B Zugang liegt auf dem Gerät', await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('torj-cloud-v1') || 'null'); return !!c && c.k === 'TESTCODE23456789'; }));
  await page.fill('#ob-name', 'Ben'); await page.click('[data-act="ob-go"]'); await h.wait(1200);
  ok('B Einlauf fertig: App läuft, neun Aufgaben', await h.cnt('.tabs') === 1 && await h.cnt('.task') === 9);
  const cfg1 = await waitFor(() => getDoc('cfg/main'), 8000);
  ok('B Einstellungen liegen in Firestore unter dem Familiencode', !!cfg1 && cfg1.name === 'Ben' && cfg1.v === 4 && cfg1.tasks.length === 9, cfg1 ? 'Name ' + cfg1.name + ', ' + cfg1.tasks.length + ' Aufgaben' : 'nichts');
  ok('B Fortschritt (Sticker, Ziele) ebenfalls', !!(await waitFor(() => getDoc('cfg/progress'), 6000)));
  const dev1 = page;

  // ---- C) Trainer trägt ein, zweites Gerät sieht es live ----
  await dev1.click('[data-act="lock"]'); await h.wait(300);
  await dev1.click('.task[data-task="t_hefte"] [data-st="y"]'); await h.wait(500);
  await dev1.click('.task[data-task="t_notiert"] [data-st="n"]'); await h.wait(500);
  await skipShots(dev1);
  const day1 = await waitFor(async () => { const d = await getDoc('days/2026-10-30'); return d && d.m && d.m.t_hefte === 'y' && d.m.t_notiert === 'n' ? d : null; }, 8000);
  ok('C Eintragungen landen als Tag in Firestore', !!day1, JSON.stringify(day1 && day1.m));
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const dev2 = await open(b, link(CODE), { ctx: ctx2, settle: 2500 }); const h2 = H(dev2);
  ok('C zweites Gerät (anderer Speicher) kommt mit dem Link direkt ins Spiel, ohne Einlauf', await h2.cnt('.sheet.onboard') === 0 && await h2.cnt('.task') === 9);
  ok('C es zeigt denselben Stand: 1:1, Name Ben', (await h2.digits()) === '1:1' && /BEN/i.test(await h2.txt('.nm')), await h2.digits());
  ok('C Ben-Gerät: keine Trainer-Knöpfe, solange nicht entsperrt', await h2.cnt('.task .seg') === 0);
  await dev1.click('.task[data-task="t_hausaufgaben"] [data-st="y"]'); await h.wait(400); await skipShots(dev1);
  const live = await waitFor(async () => (await h2.digits()) === '2:1', 8000);
  ok('C Änderung auf Gerät 1 erscheint live auf Gerät 2 (2:1)', !!live, await h2.digits());
  // zweites Gerät entsperrt (kein Code gesetzt) und trägt selbst ein: Gerät 1 sieht es
  await dev2.click('[data-act="lock"]'); await h2.wait(300);
  await dev2.click('.task[data-task="t_zimmer"] [data-st="n"]'); await h2.wait(500);
  const back = await waitFor(async () => (await h.digits()) === '2:2', 8000);
  ok('C Eintrag auf Gerät 2 erscheint live auf Gerät 1 (2:2)', !!back, await h.digits());
  ok('C Kopfzeile zählt Tore: 2', (await h.txt('.chip:not(.fire):not(.lockbtn) b')) === '2');

  // ---- D) Offline: schreiben, neu laden, später ankommen ----
  await dev1.evaluate(() => navigator.serviceWorker.ready); await h.wait(500);
  allow = [/ERR_INTERNET_DISCONNECTED|Failed to load resource|net::ERR|Could not reach Cloud Firestore|transport errored|WebChannel/i];
  await dev1.context().setOffline(true); await h.wait(600);
  await dev1.click('.task[data-task="t_buch"] [data-st="y"]'); await h.wait(600); await skipShots(dev1);
  ok('D offline: Eintrag erscheint trotzdem sofort (3:2)', (await h.digits()) === '3:2', await h.digits());
  const notYet = await getDoc('days/2026-10-30');
  ok('D offline: auf dem Server ist er noch nicht', !!notYet && notYet.m.t_buch === undefined);
  await dev1.reload(); await h.wait(2500);
  ok('D offline neu geladen: App und Stand kommen aus dem Zwischenspeicher (3:2, keine Sperrseite)', (await h.digits()) === '3:2' && await h.cnt('.gate') === 0, (await h.digits()) + ' / gate ' + await h.cnt('.gate'));
  await dev1.context().setOffline(false);
  const arrived = await waitFor(async () => { const d = await getDoc('days/2026-10-30'); return d && d.m.t_buch === 'y' ? d : null; }, 20000, 500);
  ok('D wieder online: der Offline-Eintrag wird nachgeschickt', !!arrived);
  const arrived2 = await waitFor(async () => (await h2.digits()) === '3:2', 12000);
  ok('D und erscheint auf dem anderen Gerät', !!arrived2, await h2.digits());
  allow = [];

  // ---- E) Falscher Code: Sperrseite, dann neuer Link ----
  allow = [/permission-denied|Missing or insufficient|Uncaught Error in snapshot|Failed to load resource|403/i];
  const ctx3 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const dev3 = await open(b, link(WRONG), { ctx: ctx3, settle: 3000 }); const h3 = H(dev3);
  ok('E falscher Code: „Der Link passt nicht“, kein Spiel, kein fremder Stand', /Der Link passt nicht/.test(await h3.txt('.gate')) && await h3.cnt('.task, .tab') === 0, await h3.txt('#app'));
  ok('E Knopf „Neuen Link eingeben“ führt zur Eingabe', await (async () => { await dev3.click('[data-act="link-reset"]'); await h3.wait(1500); return /Familienlink fehlt/.test(await h3.txt('.gate')); })());
  ok('E danach liegt kein Zugang mehr auf dem Gerät', await dev3.evaluate(() => localStorage.getItem('torj-cloud-v1') === null && !location.hash.includes('c=')));
  await dev3.fill('#link-in', link(CODE)); await dev3.click('[data-act="link-save"]'); await h3.wait(3000);
  ok('E richtiger Link eingefügt: Stand ist da (3:2)', (await h3.digits()) === '3:2', await h3.digits());
  allow = [];

  // ---- F) Link teilen und auf einem dritten Gerät benutzen ----
  await dev1.click('[data-act="lock"]'); await h.wait(300);                     // nach dem Neuladen ist der Trainer-Modus wieder aus
  await dev1.click('.tab[data-tab="coach"]'); await h.wait(500);
  ok('F Trainer → Speicher: erklärt Europa/Offline, Knöpfe „Familienlink teilen“ und „abmelden“', /Europa/.test(await h.txt('#sec-speicher')) && await h.cnt('[data-act="link-share"]') === 1 && await h.cnt('[data-act="link-reset-ask"]') === 1);
  await dev1.evaluate(() => { navigator.share = async d => { window.__shared = d; }; });
  await dev1.click('[data-act="link-share"]'); await h.wait(500);
  const shared = await dev1.evaluate(() => window.__shared || null);
  ok('F Teilen übergibt Titel und den Link mit allem hinter dem #', !!shared && /^http:\/\/127\.0\.0\.1:5199\/#c=[A-Za-z0-9_-]{40,}$/.test(shared.url), shared && shared.url.slice(0, 50));
  const ctx4 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const dev4 = await open(b, shared.url, { ctx: ctx4, settle: 2500 }); const h4 = H(dev4);
  ok('F der geteilte Link funktioniert auf einem frischen Gerät (3:2)', (await h4.digits()) === '3:2', await h4.digits());
  ok('F die Seite warnt vor Weitergabe', /nur an die Familie|nur die Familie/i.test(await h.txt('#sec-speicher')));

  // ---- G) Abmelden ----
  await dev4.click('[data-act="lock"]'); await h4.wait(300);
  await dev4.click('.tab[data-tab="coach"]'); await h4.wait(400);
  await dev4.click('[data-act="link-reset-ask"]'); await h4.wait(300);
  ok('G Abmelden fragt nach und sagt, dass der Stand erhalten bleibt', /Dieses Gerät abmelden/.test(await h4.txt('.sheet h2')) && /Stand selbst bleibt/.test(await h4.txt('.sheet')));
  await dev4.click('[data-act="confirm-yes"]'); await h4.wait(2500);
  ok('G danach wieder die Eingabe, Zugang und Adresse sind leer', /Familienlink fehlt/.test(await h4.txt('.gate')) && await dev4.evaluate(() => localStorage.getItem('torj-cloud-v1') === null && !location.hash));
  ok('G der Stand in Firestore ist unberührt (Name Ben, 3 Tore)', (await getDoc('cfg/main')).name === 'Ben' && Object.keys((await getDoc('days/2026-10-30')).m).length === 5);

  // ---- H) iPhone: Installationshinweis ----
  const ctx5 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: IPHONE });
  const dev5 = await open(b, link(CODE), { ctx: ctx5, settle: 2500 }); const h5 = H(dev5);
  ok('H iPhone in Safari: Hinweis „Zum Home-Bildschirm“ unter Heute', /Zum Home-Bildschirm/.test(await h5.txt('.a2hs')), await h5.txt('.a2hs'));
  await dev5.click('[data-act="a2hs-close"]'); await h5.wait(300);
  await dev5.reload(); await h5.wait(2000);
  ok('H „Verstanden“ blendet ihn dauerhaft aus', await h5.cnt('.a2hs') === 0);
  ok('H auf dem Desktop-Browser kommt er nie', await h.cnt('.a2hs') === 0);

  // ---- I) Breite ----
  for (const tab of ['today', 'week', 'achieve', 'konto']) {
    await dev5.click('.tab[data-tab="' + tab + '"]'); await h5.wait(600);
    const o = await dev5.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok('I iPhone-Breite ' + tab + ': kein seitliches Scrollen', o.sw <= o.cw, o.sw + ' von ' + o.cw);
  }

  // ---- J) Link aus dem Werkzeug tools/familienlink.js (so entsteht der echte Link nach dem Einfügen der Firebase-Konfiguration) ----
  const cfgFile = path.join(require('os').tmpdir(), 'torjaeger-test-config.txt');
  fs.writeFileSync(cfgFile, 'import { initializeApp } from "firebase/app";\nconst firebaseConfig = {\n  apiKey: "AIzaSyD-TestKey_0123456789abcdefghij",\n  authDomain: "demo-torjaeger.firebaseapp.com",\n  projectId: "demo-torjaeger",\n  storageBucket: "demo-torjaeger.firebasestorage.app",\n  messagingSenderId: "123456789012",\n  appId: "1:123456789012:web:abcdef1234567890"\n};\n');
  const toolLink = require('child_process').execFileSync('node', [path.resolve(__dirname, '..', 'tools/familienlink.js'), BASEURL, CODE, cfgFile, '--emulator', '127.0.0.1:8085']).toString().trim();
  ok('J Werkzeug erzeugt einen Link mit Adresse und #c=', toolLink.startsWith(BASEURL + '#c=') && toolLink.length > 200, toolLink.slice(0, 60));
  const ctx6 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const dev6 = await open(b, toolLink, { ctx: ctx6, settle: 3000 }); const h6 = H(dev6);
  ok('J der Link aus dem Werkzeug verbindet und zeigt den Stand (3:2)', (await h6.digits()) === '3:2', await h6.digits());
  // Link wird geöffnet, während die App schon mit der Eingabeseite läuft (z. B. aus einer Nachricht): sie nimmt ihn sofort an
  const ctx7 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const dev7 = await open(b, BASEURL, { ctx: ctx7 }); const h7 = H(dev7);
  await dev7.evaluate(u => { location.hash = u.split('#')[1]; }, toolLink); await h7.wait(3500);
  ok('J Link in die Adresszeile der laufenden App: sie verbindet sich ohne Neuladen von Hand', (await h7.digits()) === '3:2', await h7.digits());

  console.log(errs.length ? 'FEHLER im Browser:\n' + errs.join('\n') : 'ok   keine unerwarteten Konsolenfehler (auch keine Verstöße gegen die Sicherheitsrichtlinie)');
  console.log(bad ? '\n' + bad + ' Prüfung(en) fehlgeschlagen' : '\nalle Prüfungen ok');
  await b.close(); server.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
