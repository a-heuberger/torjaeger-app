// Die ausgelieferte Web-App (docs/) so, wie GitHub Pages sie ausliefert: unter dem Unterpfad /torjaeger-app/.
// Fehlt irgendwo ein relativer Pfad, landet eine Anfrage außerhalb des Präfixes (404) und fällt hier auf.
// Dazu: Service Worker, Manifest, Symbole, Schriften und der Start ohne Netz (der Server wird dafür abgeschaltet).
// Voraussetzung: gebaut mit node build.js. Braucht keinen Emulator.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..', 'docs');
const PREFIX = '/torjaeger-app/', PORT = 5198;
const BASE = 'http://127.0.0.1:' + PORT + PREFIX;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

let bad = 0;
const ok = (name, cond, info) => { if (!cond) bad++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? ' | ' + info : '')); };

const hits = [], sockets = new Set();
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  hits.push(u);
  if (!u.startsWith(PREFIX)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('außerhalb des Unterpfads'); return; }
  let rel = u.slice(PREFIX.length); if (!rel || rel.endsWith('/')) rel += 'index.html';
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('nicht da'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });   // wie GitHub Pages
  fs.createReadStream(f).pipe(res);
});
server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const failed = [], cons = [];
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') cons.push(m.text()); });
  page.on('pageerror', e => cons.push('pageerror: ' + e.message));

  await page.goto(BASE, { waitUntil: 'load' });
  const scope = await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(r => r.scope), new Promise(r => setTimeout(() => r('Zeitüberschreitung'), 8000))]));
  ok('Service Worker meldet sich im Unterpfad an', scope === BASE, scope);
  const gate = await page.evaluate(() => { const g = document.querySelector('.gate'); return g ? g.textContent : ''; });
  ok('ohne Link: Sperrseite „Familienlink fehlt“', /Familienlink fehlt/i.test(gate), gate.replace(/\s+/g, ' ').slice(0, 60));

  const man = await page.evaluate(async () => {
    const l = document.querySelector('link[rel="manifest"]'), m = await (await fetch(l.href)).json();
    return { start: new URL(m.start_url, l.href).href, scope: new URL(m.scope, l.href).href, display: m.display, icons: await Promise.all(m.icons.map(async i => (await fetch(new URL(i.src, l.href))).ok)) };
  });
  ok('Manifest: Start und Bereich liegen im Unterpfad', man.start === BASE && man.scope === BASE && man.display === 'standalone', man.start + ' | ' + man.scope);
  ok('Manifest: alle Symbole erreichbar', man.icons.length >= 3 && man.icons.every(Boolean));
  const links = await page.evaluate(() => Promise.all([...document.querySelectorAll('link[rel~="apple-touch-icon"], link[rel~="icon"]')].map(async l => (await fetch(l.href)).ok)));
  ok('Apple-Symbol und Tab-Symbol erreichbar', links.length === 2 && links.every(Boolean));

  const cached = await page.evaluate(async () => { const out = []; for (const k of await caches.keys()) { const c = await caches.open(k); out.push(...(await c.keys()).map(r => new URL(r.url).pathname)); } return out; });
  const nFonts = fs.readdirSync(path.join(ROOT, 'fonts')).length;
  ok('Hülle ist gemerkt: Seite, Firebase-Skript, Manifest, Symbole', ['', 'index.html', 'firebase.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png'].every(f => cached.includes(PREFIX + f)));
  ok('alle ' + nFonts + ' Schriften sind schon beim Installieren gemerkt', cached.filter(p => p.startsWith(PREFIX + 'fonts/')).length === nFonts, cached.filter(p => p.startsWith(PREFIX + 'fonts/')).length + ' gemerkt');
  const f1 = await page.evaluate(async () => { await document.fonts.ready; const a = [...document.fonts]; return { loaded: a.filter(f => f.status === 'loaded').length, error: a.filter(f => f.status === 'error').length }; });
  ok('Schriften laden aus dem Unterpfad', f1.loaded >= 1 && f1.error === 0, JSON.stringify(f1));
  ok('keine Anfrage außerhalb des Unterpfads', hits.every(u => u.startsWith(PREFIX)), hits.filter(u => !u.startsWith(PREFIX)).join(', '));
  ok('keine Antwort 4xx/5xx', failed.length === 0, failed.join(', '));
  ok('Konsole sauber', cons.length === 0, cons.join(' | '));

  // Netz weg: Server abschalten, neu laden. Jetzt muss alles aus dem Zwischenspeicher des Service Workers kommen.
  await new Promise(r => { server.close(r); sockets.forEach(s => s.destroy()); });
  await page.reload({ waitUntil: 'load' });
  const off = await page.evaluate(async () => { await document.fonts.ready; const a = [...document.fonts]; return { gate: !!document.querySelector('.gate'), loaded: a.filter(f => f.status === 'loaded').length, error: a.filter(f => f.status === 'error').length }; });
  ok('ohne Netz neu geladen: App kommt aus dem Zwischenspeicher', off.gate);
  ok('ohne Netz: Schriften kommen aus dem Zwischenspeicher, keine Fehler', off.loaded >= 1 && off.error === 0, JSON.stringify(off));
  ok('ohne Netz: Konsole bleibt sauber', cons.length === 0, cons.join(' | '));

  await b.close();
  console.log(bad ? '\n' + bad + ' FEHLER' : '\nalles ok');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL Testfehler | ' + (e && e.message)); process.exit(1); });
