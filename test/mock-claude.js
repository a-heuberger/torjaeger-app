// Attrappe für window.claude (nur für Tests): bildet die db- und user-Schnittstelle nach, wie sie in db.d.ts / user.d.ts beschrieben ist.
(() => {
  const store = new Map(), listeners = [], calls = [];
  const M = window.__mock = { store, calls, canWrite: true, delay: 10, failSet: null, snapshotsDelivered: 0 };
  if (window.__preload) { for (const k of Object.keys(window.__preload)) store.set(k, JSON.parse(JSON.stringify(window.__preload[k]))); }
  if (window.__readonly) M.canWrite = false;
  const J = o => JSON.parse(JSON.stringify(o));
  const depth = p => p.split('/').length;
  const snapOf = path => ({
    id: path.split('/').pop(), exists: store.has(path),
    data: () => (store.has(path) ? Object.freeze(J(store.get(path))) : undefined),
    metadata: { fromCache: false, hasPendingWrites: false },
  });
  const colKeys = col => [...store.keys()].filter(k => k.startsWith(col + '/') && depth(k) === depth(col) + 1).sort();
  const colSnap = (l, now, changes) => ({ docs: now.map(snapOf), size: now.length, empty: !now.length, docChanges: () => changes, metadata: { fromCache: false, hasPendingWrites: false } });
  function deliverCol(l) {
    const now = colKeys(l.path), changes = [];
    for (const k of now) { const j = JSON.stringify(store.get(k)); if (l.prev.get(k) !== j) changes.push({ type: l.prev.has(k) ? 'modified' : 'added', doc: snapOf(k) }); }
    for (const [k, j] of l.prev) if (!store.has(k)) changes.push({ type: 'removed', doc: { id: k.split('/').pop(), exists: true, data: () => JSON.parse(j), metadata: {} } });
    l.prev = new Map(now.map(k => [k, JSON.stringify(store.get(k))]));
    M.snapshotsDelivered++; l.cb(colSnap(l, now, changes));
  }
  function fire(path) {
    for (const l of listeners) {
      if (l.kind === 'doc' && l.path === path) setTimeout(() => { M.snapshotsDelivered++; l.cb(snapOf(path)); }, 5);
      if (l.kind === 'col' && path.startsWith(l.path + '/') && depth(path) === depth(l.path) + 1) setTimeout(() => deliverCol(l), 5);
    }
  }
  const wait = () => new Promise(r => setTimeout(r, M.delay));
  const api = {
    doc: path => {
      if (depth(path) % 2 !== 0) throw new TypeError('doc path needs an even number of segments: ' + path);
      return {
        id: path.split('/').pop(), path,
        get: async () => snapOf(path),
        set: async d => {
          calls.push(['set', path]);
          if (!M.canWrite) throw { code: 'invalid_argument', message: 'no write' };
          if (M.failSet) { const c = M.failSet; M.failSet = null; throw { code: c, message: 'x' }; }
          await wait(); store.set(path, J(d)); fire(path);
        },
        update: async d => { calls.push(['update', path]); await wait(); store.set(path, Object.assign({}, store.get(path), J(d))); fire(path); },
        delete: async () => { calls.push(['delete', path]); if (!M.canWrite) throw { code: 'invalid_argument', message: 'no write' }; await wait(); store.delete(path); fire(path); },
        onSnapshot: cb => { const l = { kind: 'doc', path, cb }; listeners.push(l); setTimeout(() => { M.snapshotsDelivered++; cb(snapOf(path)); }, 5); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; },
      };
    },
    collection: path => {
      if (depth(path) % 2 !== 1) throw new TypeError('collection path needs an odd number of segments: ' + path);
      return {
        path,
        doc: id => api.doc(path + '/' + id),
        get: async () => colSnap(null, colKeys(path), []),
        onSnapshot: cb => { const l = { kind: 'col', path, cb, prev: new Map() }; listeners.push(l); setTimeout(() => deliverCol(l), 5); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; },
      };
    },
  };
  window.claude = {
    use: async name => (name === 'db' ? (window.__nodb ? null : api) : name === 'user' ? { isOwner: async () => true, canEdit: async () => true, can: async () => M.canWrite, id: async () => 'u_test' } : null),
  };
})();
