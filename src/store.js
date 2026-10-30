/* ============ Speicher: geteilte Datenbank der Seite (db) oder lokal (localStorage) ============
   Dokumente: cfg/main (Einstellungen) · cfg/progress (Feiern, Eingelöstes, Saisons) · days/<JJJJ-MM-TT> (ein Tag)
   · konto/<id> (eine Buchung auf dem Guthabenkonto; je Buchung ein Dokument, damit zwei Geräte sich nie überschreiben).
   Eigene Änderungen gehen sofort in den Speicher S und werden gebündelt, eines nach dem anderen, geschrieben.
   Das Echo der eigenen Schreibvorgänge wird erkannt und ignoriert, damit es keine Eingaben überschreibt. */
const LS_KEY = 'torj-local-v2';
/* noAccess: Die Seite läuft in Claude, bekommt aber keinen Zugriff auf den gemeinsamen Speicher (nicht angemeldet, nicht freigegeben). */
/* cloud: Web-App mit Firestore (siehe cloud.js). gate: Sperrseite statt Spiel (nolink, denied, sdk, offline). cred: Zugangsdaten dieses Geräts. */
const Store = { mode: 'boot', db: null, pend: {}, recent: {}, timers: {}, subs: [], lsOk: false, readyTimer: 0, migrated: false, noAccess: false, cloud: false, gate: null, cred: null, fs: null };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jclone = o => JSON.parse(JSON.stringify(o));
const isEmptyDay = d => !d || (!d.off && (!d.m || !Object.keys(d.m).length) && (!d.ev || !d.ev.length));

function docBody(key) {
  if (key === 'cfg/main') return jclone(S.cfg);
  if (key === 'cfg/progress') return jclone(S.prog);
  if (key.indexOf('konto/') === 0) { const e = S.konto[key.slice(6)]; return e ? jclone(e) : null; }
  const d = S.days[key.slice(5)];
  return d && !isEmptyDay(d) ? jclone(d) : null;
}
function assignDoc(key, data) {
  if (key === 'cfg/main') { Store.migrated = !!(data && (data.v || 0) < 4); S.cfg = migrateCfg(data, U.today); }
  else if (key === 'cfg/progress') S.prog = normProg(data);
  else if (key.indexOf('konto/') === 0) { const id = key.slice(6); if (data) S.konto[id] = data; else delete S.konto[id]; }
  else { const ds = key.slice(5); if (data) S.days[ds] = data; else delete S.days[ds]; }
  markChanged();
}
const busy = key => { const p = Store.pend[key]; return !!((p && (p.busy || p.dirty)) || Store.timers[key]); };
const isEcho = (key, json) => (Store.recent[key] || []).indexOf(json) >= 0;

/* ---- lokal ---- */
function lsLoad() { try { const j = localStorage.getItem(LS_KEY); return j ? JSON.parse(j) : null; } catch (e) { return null; } }
function lsSave() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ cfg: S.cfg, prog: S.prog, days: S.days, konto: S.konto })); return true; } catch (e) { return false; }
}

/* ---- schreiben ---- */
function persist(key, delay) {
  if (U.readonly || Store.mode === 'boot') return;
  clearTimeout(Store.timers[key]); delete Store.timers[key];
  if (delay) { Store.timers[key] = setTimeout(() => { delete Store.timers[key]; flushKey(key); }, delay); return; }
  flushKey(key);
}
async function flushKey(key) {
  const p = Store.pend[key] || (Store.pend[key] = { dirty: false, busy: false });
  p.dirty = true;
  if (p.busy) return;
  p.busy = true;
  try { while (p.dirty) { p.dirty = false; await writeKey(key); } } finally { p.busy = false; }
}
async function writeKey(key) {
  const body = docBody(key);
  const rec = Store.recent[key] || (Store.recent[key] = []);
  rec.push(JSON.stringify(body)); if (rec.length > 10) rec.shift();
  if (Store.mode !== 'db') { Store.lsOk = lsSave(); return; }
  const ref = Store.db.doc(key);
  const go = () => (body === null ? ref.delete() : ref.set(body));
  /* Firestore legt die Änderung sofort im Zwischenspeicher ab und schickt sie nach, sobald es Netz gibt: Darauf wird nicht gewartet. */
  if (Store.cloud) { go().catch(cloudWriteFail); return; }
  try { await go(); } catch (e) {
    if (e && e.code === 'unavailable') {
      await sleep(500 + Math.random() * 700);
      try { await go(); return; } catch (e2) { e = e2; }
    }
    writeFail(e);
  }
}
function writeFail(e) {
  const c = e && e.code;
  if (c === 'invalid_argument' || c === 'revoked') { U.readonly = true; U.unlocked = false; toast('Hier kann nur angesehen werden.', 'warn'); render(); }
  else if (c === 'quota_exceeded') toast('Der Speicher dieser Seite ist voll.', 'warn');
  else toast('Speichern hat nicht geklappt. Prüfe die Verbindung und tippe nochmal.', 'warn');
}

/* ---- lesen (live) ---- */
function remoteDoc(key, snap) {
  if (busy(key)) return false;
  const data = snap.exists ? jclone(snap.data()) : null, json = JSON.stringify(data);
  if (isEcho(key, json)) return false;
  if (JSON.stringify(docBody(key)) === json) return false;
  assignDoc(key, data);
  return true;
}
function remoteDays(snap) {
  let changed = false;
  snap.docChanges().forEach(c => {
    const id = c.doc.id, key = 'days/' + id;
    if (busy(key)) return;
    const data = c.type === 'removed' ? null : jclone(c.doc.data()), json = JSON.stringify(data);
    if (isEcho(key, json)) return;
    if (JSON.stringify(docBody(key)) === json) return;
    if (!data && !S.days[id]) return;
    assignDoc(key, data); changed = true;
  });
  return changed;
}

function remoteKonto(snap) {
  let changed = false;
  snap.docChanges().forEach(c => {
    const id = c.doc.id, key = 'konto/' + id;
    if (busy(key)) return;
    const data = c.type === 'removed' ? null : jclone(c.doc.data()), json = JSON.stringify(data);
    if (isEcho(key, json)) return;
    if (JSON.stringify(docBody(key)) === json) return;
    if (!data && !S.konto[id]) return;
    assignDoc(key, data); changed = true;
  });
  return changed;
}

/* ---- Start ---- */
function ready() {
  if (U.ready) return;
  U.ready = true; clearTimeout(Store.readyTimer);
  afterLoad(); render();
}
function initLocal(note) {
  Store.subs.forEach(u => { try { u(); } catch (e) { /* schon beendet */ } }); Store.subs = [];
  Store.mode = 'local';
  const d = lsLoad();
  if (d) { Store.migrated = !!(d.cfg && (d.cfg.v || 0) < 4); S.cfg = migrateCfg(d.cfg, U.today); S.prog = normProg(d.prog); S.days = d.days || {}; S.konto = d.konto || {}; U.hasCfg = !!d.cfg; markChanged(); }
  else U.hasCfg = false;
  Store.lsOk = Store.noAccess && !U.hasCfg ? false : lsSave();         // ohne Zugriff und ohne eigenen Stand nichts anlegen: sonst käme beim nächsten Öffnen ein leeres Spiel statt der Erklärung
  if (note) toast(note, 'warn');
  ready();
}
async function initStore() {
  if (window.__PWA__) return initCloud();
  let db = null;
  try {
    if (window.claude && typeof window.claude.use === 'function') db = await Promise.race([window.claude.use('db'), sleep(9000).then(() => null)]);
  } catch (e) { db = null; }
  if (!db) { Store.noAccess = !!(window.claude && typeof window.claude.use === 'function'); return initLocal(); }
  Store.db = db; Store.mode = 'db';
  try {
    const user = await window.claude.use('user');
    if (user && (await user.can('data.write')) === false) U.readonly = true;
  } catch (e) { /* unbekannt: ein abgelehnter Schreibversuch entscheidet */ }
  const got = { cfg: false, prog: false, days: false, konto: false };
  const step = () => { if (got.cfg && got.prog && got.days && got.konto) ready(); };
  const redraw = ch => { if (ch && U.ready) render(); };
  const fail = e => {
    if (e && e.code === 'revoked') { U.readonly = true; U.unlocked = false; render(); return; }
    if (!U.ready) initLocal('Die Verbindung zum Speicher klappt gerade nicht. Der Stand liegt vorerst nur auf diesem Gerät.');
  };
  try {
    Store.subs.push(db.doc('cfg/main').onSnapshot(s => { U.hasCfg = !!s.exists; redraw(remoteDoc('cfg/main', s)); got.cfg = true; step(); }, fail));
    Store.subs.push(db.doc('cfg/progress').onSnapshot(s => { redraw(remoteDoc('cfg/progress', s)); got.prog = true; step(); }, fail));
    Store.subs.push(db.collection('days').onSnapshot(s => { redraw(remoteDays(s)); got.days = true; step(); }, fail));
    Store.subs.push(db.collection('konto').onSnapshot(s => { redraw(remoteKonto(s)); got.konto = true; step(); }, fail));
  } catch (e) { return initLocal('Die Verbindung zum Speicher klappt gerade nicht. Der Stand liegt vorerst nur auf diesem Gerät.'); }
  Store.readyTimer = setTimeout(() => { if (!U.ready) ready(); }, 7000);
}
