/* ============ Cloud (Web-App): Firestore statt Claude-Speicher ============
   Die Web-App läuft eigenständig (GitHub Pages) und enthält weder Konfiguration noch Zugangscode. Beides steckt im Familienlink:
     https://…/#c=<base64url(JSON { k: Familiencode, f: Firebase-Konfiguration, e: Emulator (nur Tests) })>
   Der Link wird einmal pro Gerät geöffnet oder eingefügt; danach liegt er im lokalen Speicher dieses Geräts.
   Die Daten liegen unter families/<Familiencode>/… in Firestore. Die Sicherheitsregeln lassen nur diesen einen Pfad zu,
   wer den Code nicht kennt, kommt an nichts heran. Der Code steht nie im Quelltext und nie im Repo.
   Dokumente und Schnittstelle sind dieselben wie bei der Claude-Fassung (cfg/main, cfg/progress, days/<Datum>, konto/<id>);
   der Adapter unten bildet die db-Schnittstelle von Claude auf Firestore ab, der Rest der App merkt den Unterschied nicht. */
const CLOUD_KEY = 'torj-cloud-v1';
const CODE_RE = /^[A-Z2-9]{16}$/;
const CFG_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
/* Prüft und bereinigt Zugangsdaten { k, f, e }; null, wenn sie nicht stimmen. */
function cleanCred(o) {
  if (!o || !CODE_RE.test(String(o.k || '')) || !o.f || !o.f.projectId || !o.f.apiKey) return null;
  const f = {}; CFG_KEYS.forEach(k => { if (typeof o.f[k] === 'string' && o.f[k]) f[k] = o.f[k]; });
  const e = o.e && o.e.host && +o.e.port ? { host: String(o.e.host), port: +o.e.port } : null;
  return { k: o.k, f, e };
}
/* Nimmt den ganzen Link, nur den Teil ab „#c=“ oder die reine Zeichenfolge entgegen. */
function parseFamilyLink(text) {
  const t = String(text || '').trim();
  const m = /[#?&]c=([A-Za-z0-9_-]{20,})/.exec(t) || /^([A-Za-z0-9_-]{40,})$/.exec(t);
  if (!m) return null;
  try { return cleanCred(JSON.parse(b64urlDecode(m[1]))); } catch (e) { return null; }
}
function loadCred() { try { return cleanCred(JSON.parse(localStorage.getItem(CLOUD_KEY))); } catch (e) { return null; } }
function saveCred(c) { try { localStorage.setItem(CLOUD_KEY, JSON.stringify(c)); return true; } catch (e) { return false; } }
function forgetCred() { try { localStorage.removeItem(CLOUD_KEY); } catch (e) { /* egal */ } }
/* Der Link, den man weitergibt: dieselbe Adresse wie die App, mit den Zugangsdaten hinter dem #. */
function familyLink(c) {
  return location.origin + location.pathname + '#c=' + b64urlEncode(JSON.stringify({ k: c.k, f: c.f, e: c.e || undefined }));
}

/* Bildet die db-Schnittstelle (doc/collection/onSnapshot/set/delete) auf Firestore unter families/<Code>/ ab. */
function fsAdapter(FB, fs, code) {
  const base = 'families/' + code + '/';
  const snapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), fromCache: !!(s.metadata && s.metadata.fromCache) });
  const api = {
    doc: path => {
      const ref = FB.doc(fs, base + path);
      return {
        id: ref.id, path,
        get: async () => snapDoc(await FB.getDoc(ref)),
        set: d => FB.setDoc(ref, d),
        update: d => FB.updateDoc(ref, d),
        delete: () => FB.deleteDoc(ref),
        onSnapshot: (cb, err, o) => FB.onSnapshot(ref, o && o.meta ? { includeMetadataChanges: true } : {}, s => cb(snapDoc(s)), err),
      };
    },
    collection: path => {
      const ref = FB.collection(fs, base + path);
      return {
        path,
        doc: id => api.doc(path + '/' + id),
        get: async () => { const s = await FB.getDocs(ref); return { docs: s.docs.map(snapDoc), size: s.size, empty: s.empty }; },
        onSnapshot: (cb, err) => FB.onSnapshot(ref, s => cb({ docs: s.docs.map(snapDoc), docChanges: () => s.docChanges().map(c => ({ type: c.type, doc: snapDoc(c.doc) })) }), err),
      };
    },
  };
  return api;
}

/* Zeigt eine Sperrseite (oder nimmt sie weg, wenn kind leer ist). */
function cloudGate(kind) {
  Store.gate = kind || null;
  if (kind) clearTimeout(Store.readyTimer);
  render();
}
function cloudFail(e) {
  if (e && e.code === 'permission-denied') {
    Store.subs.forEach(u => { try { u(); } catch (x) { /* schon beendet */ } }); Store.subs = [];
    cloudGate('denied');
  }
  /* alles andere (kein Netz, kurze Störung): Das SDK versucht es von selbst wieder, geschrieben wird später nach. */
}
function cloudWriteFail(e) {
  const c = e && e.code;
  if (c === 'permission-denied') cloudFail(e);
  else if (c === 'resource-exhausted') toast('Der Tagesvorrat des Speichers ist aufgebraucht. Morgen geht es wieder.', 'warn');
  else if (c !== 'unavailable') toast('Speichern hat nicht geklappt. Prüfe die Verbindung und tippe nochmal.', 'warn');
}

async function initCloud() {
  Store.cloud = true;
  /* Wird ein Familienlink geöffnet, während die App schon läuft (z. B. aus der Nachricht), nimmt sie ihn sofort an. */
  window.addEventListener('hashchange', () => { const c = parseFamilyLink(location.hash); if (c) { saveCred(c); location.reload(); } });
  let cred = parseFamilyLink(location.hash);
  if (cred) saveCred(cred); else cred = loadCred();
  if (!cred) return cloudGate('nolink');
  Store.cred = cred;
  if (!window.FB) return cloudGate('sdk');
  let fs;
  try {
    const app = FB.initializeApp(cred.f);
    let cache; try { cache = FB.persistentLocalCache({ tabManager: FB.persistentMultipleTabManager() }); } catch (e) { cache = FB.memoryLocalCache(); }
    fs = FB.initializeFirestore(app, { localCache: cache, experimentalAutoDetectLongPolling: true });
    if (cred.e) FB.connectFirestoreEmulator(fs, cred.e.host, cred.e.port);
  } catch (e) { return cloudGate('sdk'); }
  Store.fs = fs;
  const db = Store.db = fsAdapter(FB, fs, cred.k); Store.mode = 'db';
  const got = { cfg: false, prog: false, days: false, konto: false };
  const step = () => {
    if (!(got.cfg && got.prog && got.days && got.konto)) return;
    if (Store.gate) { Store.gate = null; if (U.ready) { render(); return; } }
    ready();
  };
  const redraw = ch => { if (ch && U.ready && !Store.gate) render(); };
  /* Ein Dokument, das es im Zwischenspeicher nicht gibt, ist erst „neu“, wenn der Server es bestätigt: sonst würde ein Start ohne Netz wie ein leeres Spiel aussehen. */
  Store.subs.push(db.doc('cfg/main').onSnapshot(s => { if (s.fromCache && !s.exists) return; U.hasCfg = !!s.exists; redraw(remoteDoc('cfg/main', s)); got.cfg = true; step(); }, cloudFail, { meta: true }));
  Store.subs.push(db.doc('cfg/progress').onSnapshot(s => { redraw(remoteDoc('cfg/progress', s)); got.prog = true; step(); }, cloudFail));
  Store.subs.push(db.collection('days').onSnapshot(s => { redraw(remoteDays(s)); got.days = true; step(); }, cloudFail));
  Store.subs.push(db.collection('konto').onSnapshot(s => { redraw(remoteKonto(s)); got.konto = true; step(); }, cloudFail));
  Store.readyTimer = setTimeout(() => { if (!got.cfg && !Store.gate) cloudGate('offline'); }, 9000);
}
