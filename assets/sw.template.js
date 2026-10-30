/* Offline-Hülle der Web-App: Netz zuerst (neue Fassungen kommen sofort an), ohne Netz die zuletzt gemerkte Fassung.
   Die Daten selbst liegen nicht hier, sondern im Zwischenspeicher von Firestore.
   Die Schriften stehen schon in der Hülle: Beim allerersten Laden ist der Service Worker noch nicht aktiv, was die Seite dabei lädt, würde sonst nie gemerkt. */
const CACHE = 'torjaeger-__VERSION__';
const SHELL = ['./', 'index.html', 'firebase.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png'];
const FONTS = __FONTS__;
self.addEventListener('install', e => {
  /* Die Hülle muss ganz ankommen; eine fehlende Schrift soll die Installation nicht verhindern. */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).then(() => Promise.all(FONTS.map(f => c.add(f).catch(() => { /* kommt beim nächsten Laden */ }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(r, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
