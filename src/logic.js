/* ============ Regeln, Datum, Auswertung (rein, ohne DOM) ============ */
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const pad2 = n => String(n).padStart(2, '0');
const fmtDate = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const parseDate = s => { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
const dowOf = s => parseDate(s).getDay();
const mondayOf = s => { const d = parseDate(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmtDate(d); };
const todayStr = () => fmtDate(new Date());
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
function isoWeek(s) {
  const d = parseDate(s);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4, 12);
  return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

/* ---------- Voreinstellungen ---------- */
function defaultCfg(today) {
  const all = [0, 1, 2, 3, 4, 5, 6], school = [1, 2, 3, 4, 5];
  return {
    v: 4,
    name: 'Ben',
    rival: 'Sofa United',
    jersey: { num: 10, color: 'green' },
    pin: '',
    cardsAck: false,     // Hinweis für Eltern gelesen (schaltet Karten frei)
    shootMode: true,     // Ben schießt jedes bestätigte Tor selbst
    yellowPts: 1,        // Gelbe Karte = so viele Minus-Tore (zählen bei Zielen und Fang, nicht in der Übersicht)
    redPts: 3,           // Rote Karte (auch automatisch) = so viele Minus-Tore, höchstens einmal pro Tag
    yellowExpiry: 0,     // 0 = Gelbe verfallen nie; zwei offene Gelbe ergeben Rot
    extraMax: 3,         // höchstens so viele Extra-Tore pro Tag
    packEvery: 6,        // alle so viele Tore gibt es eine Sticker-Tüte
    agreement: '',       // Abmachung der Woche (ersetzt den Untertitel der Abmachungs-Aufgabe)
    noteMoney: { 1: 500, 2: 300, 3: 200, 4: 0, 5: 0, 6: 0 },   // Konto: Euro-Cent, die eine Note bringt (bei jeder Buchung änderbar)
    /* Die Gründe für ein Tor oder Kein Tor (Vorgabe des Trainers). Die Untertitel bleiben leer, die Kriterien legt er selbst fest. */
    tasks: [
      { id: 't_hefte', icon: '📓', title: 'Hefteinträge ordentlich', sub: '', pts: 1, bonus: false, days: school },
      { id: 't_notiert', icon: '📒', title: 'Hausaufgabenheft eingetragen', sub: '', pts: 1, bonus: false, days: school },
      { id: 't_hausaufgaben', icon: '✏️', title: 'Hausaufgaben gut gemacht', sub: '', pts: 1, bonus: false, days: school },
      { id: 't_zimmer', icon: '🧹', title: 'Zimmer sauber', sub: '', pts: 1, bonus: false, days: all },
      { id: 't_eincremen', icon: '🧴', title: 'Eingecremt', sub: '', pts: 1, bonus: false, days: all },
      { id: 't_buch', icon: '📖', title: 'Buch gelesen', sub: '', pts: 1, bonus: false, days: all },
      { id: 't_spuelmaschine', icon: '🍽️', title: 'Spülmaschine ausgeräumt', sub: '', pts: 1, bonus: false, days: all },
      { id: 't_tisch', icon: '🍴', title: 'Tisch gedeckt und abgeräumt', sub: '', pts: 1, bonus: false, days: all },
      { id: 't_abmachung', icon: '🤝', title: 'An Abmachungen gehalten', sub: '', pts: 1, bonus: false, days: all },
    ],
    /* Ziele: Alle Tore zusammen (Aufgaben, eigene Gründe, Bonus-Tore der Sticker). Das letzte Ziel ist der große Fang. Vorgabe des Trainers. */
    goals: [
      { id: 'g25', at: 25, reward: 'Fußballpack' },
      { id: 'g50', at: 50, reward: '5 € aufs Guthabenkonto' },
      { id: 'g75', at: 75, reward: 'Eine Stunde YouTube Handyzeit' },
      { id: 'g100', at: 100, reward: 'Wird später festgelegt' },
      { id: 'g125', at: 125, reward: 'Fußballpack' },
      { id: 'g150', at: 150, reward: '5 € aufs Guthabenkonto' },
      { id: 'g175', at: 175, reward: 'Zum Asiamarkt nach Mühldorf inkl. 20 € Guthaben' },
      { id: 'g200', at: 200, reward: 'Wird später festgelegt' },
      { id: 'g250', at: 250, reward: '5 € aufs Guthabenkonto' },
      { id: 'g300', at: 300, reward: 'Wird später festgelegt' },
      { id: 'g500', at: 500, reward: 'Ausflug in den Freizeitpark' },
    ],
    season: { title: 'Der Riesen-Hecht' },        // Name des Fischs im Angelbild; er wird beim letzten Ziel gefangen
    goodReasons: ['Ehrlich zugegeben', 'Wiedergutmachung', 'Hat geholfen', 'Besonders freundlich', 'Selbstständig gewesen', 'Mut gezeigt'],
  };
}

/* Ziele bereinigen: nach Tore sortiert, jede Zahl nur einmal, Belohnung als Text. Ohne brauchbare Liste gelten die Standard-Ziele. */
function normGoals(list, dflt) {
  const out = [], used = {};
  (Array.isArray(list) ? list : []).forEach(g => {
    const at = Math.round(+(g && g.at));
    if (!isFinite(at) || at < 1 || at > 100000) return;
    let id = String((g && g.id) || 'g' + at); while (used[id]) id += 'x';
    used[id] = 1;
    out.push({ id, at, reward: String(g.reward == null ? '' : g.reward).slice(0, 120) });
  });
  out.sort((a, b) => a.at - b.at);
  for (let i = 1; i < out.length; i++) if (out[i].at <= out[i - 1].at) out[i].at = out[i - 1].at + 1;
  return out.length ? out : dflt.map(g => Object.assign({}, g));
}
const clampInt = (v, a, b, dflt) => { const n = Math.round(+v); return isFinite(n) ? Math.max(a, Math.min(b, n)) : dflt; };

/* Aufgabenliste von Version 3 auf die neue Liste umstellen, ohne den Verlauf zu verändern und ohne vom Datum abzuhängen:
   - gleiche Nummer (id) = dieselbe Aufgabe, nur umbenannt: Bisherige Tore bleiben dabei.
   - alte Standard-Aufgaben ohne Gegenstück („Ehrlich geblieben“, „Gute Note“) laufen aus: Bereits gewertete Tage zählen weiter.
   - neue Aufgaben gelten erst ab NEW_TASKS_FROM, damit frühere Tage nicht plötzlich offene Aufgaben haben.
   - eigene Aufgaben des Trainers bleiben unverändert. */
const NEW_TASKS_FROM = '2026-10-30';
const RETIRED_UNTIL = '2000-01-01';
const OLD_DEFAULT_IDS = ['t_notiert', 't_hausaufgaben', 't_zimmer', 't_abmachung', 't_ehrlich', 't_note'];
function migrateTasks(stored, fresh) {
  const byId = {};
  stored.forEach(t => { byId[t.id] = t; });
  const out = fresh.map(nt => {
    const o = byId[nt.id];
    if (!o) return Object.assign({}, nt, { from: NEW_TASKS_FROM });
    delete byId[nt.id];
    const m = Object.assign({}, o, { icon: nt.icon, title: nt.title, sub: nt.sub, pts: nt.pts, bonus: nt.bonus, days: nt.days.slice() });
    delete m.until;
    return m;
  });
  stored.forEach(t => {
    if (!byId[t.id]) return;
    out.push(OLD_DEFAULT_IDS.indexOf(t.id) >= 0 ? Object.assign({}, t, { until: t.until || RETIRED_UNTIL }) : t);
  });
  return out;
}

/* Fehlende Felder aus den Voreinstellungen ergänzen (alte Daten bleiben nutzbar). */
function migrateCfg(c, today) {
  const d = defaultCfg(today || todayStr());
  const old = c || {};
  const legacy = (old.v || 0) < 4;
  const out = Object.assign({}, d, old);
  const storedTasks = Array.isArray(old.tasks) ? old.tasks : null;
  out.tasks = (storedTasks ? (legacy ? migrateTasks(storedTasks, d.tasks) : storedTasks) : d.tasks).map(t => Object.assign({ icon: '⭐', title: '', sub: '', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6] }, t));
  out.season = { title: String((old.season && old.season.title) || d.season.title).slice(0, 40) };
  out.jersey = Object.assign({}, d.jersey, old.jersey || {});
  out.noteMoney = {};
  for (let g = 1; g <= 6; g++) { const v = old.noteMoney && old.noteMoney[g] != null ? +old.noteMoney[g] : d.noteMoney[g]; out.noteMoney[g] = Math.max(0, Math.min(2000, Math.round(v) || 0)); }
  out.goals = normGoals(!legacy ? old.goals : null, d.goals);     // frühere Wochenpokale und Fang-Ziel fallen weg: Es gilt die neue Liste
  /* Karten: ab Version 4 kosten sie Minus-Tore (Gelb 1, Rot 3) und verfallen nie. */
  if (legacy) { out.yellowPts = d.yellowPts; out.redPts = d.redPts; out.yellowExpiry = 0; if (+old.packEvery === 5 || old.packEvery == null) out.packEvery = d.packEvery; }
  out.yellowPts = clampInt(out.yellowPts, 0, 5, d.yellowPts);
  out.redPts = clampInt(out.redPts, 1, 9, d.redPts);
  out.yellowExpiry = 0;
  out.packEvery = clampInt(out.packEvery, 3, 20, d.packEvery);
  if (!Array.isArray(out.goodReasons)) out.goodReasons = d.goodReasons;
  ['tiers', 'yellowRules', 'redRules', 'cardsOn', 'yellowLimit'].forEach(k => { delete out[k]; });
  out.v = 4;
  return out;
}
const normProg = p => Object.assign({ cel: {}, red: {}, redK: {}, seasons: [], album: [], foil: [], pick: {} }, p || {});
const taskSub = (cfg, t) => (t.id === 't_abmachung' && cfg.agreement ? cfg.agreement : t.sub);

/* ---------- Konto (Guthaben): Beträge immer in ganzen Cent ---------- */
const fmtEUR = c => (c < 0 ? '−' : '') + Math.floor(Math.abs(c) / 100) + ',' + pad2(Math.abs(c) % 100) + ' €';
const fmtPlain = c => Math.floor(c / 100) + ',' + pad2(c % 100);
/* „2,5“, „2.50“, „€ 3“ → Cent. Nur Beträge über 0 bis 1000 €, sonst null. */
function parseMoney(s) {
  const t = String(s == null ? '' : s).replace(/[€\s ]/g, '').replace(/^\+/, '');
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(t)) return null;
  const c = Math.round(parseFloat(t.replace(',', '.')) * 100);
  return c > 0 && c <= 100000 ? c : null;
}
const kontoBalance = S => Object.keys(S.konto || {}).reduce((n, id) => n + (Math.round(+S.konto[id].c) || 0), 0);
const kontoList = S => Object.keys(S.konto || {}).map(id => Object.assign({ id }, S.konto[id])).sort((a, b) => ((b.ts || 0) - (a.ts || 0)) || (a.id < b.id ? 1 : -1));
const genitive = n => (/[sßxz]$/i.test(n) ? n + '’' : n + 's');

/* ---------- Tagesleiter (Tore an einem Tag) ---------- */
const LADDER = { 1: 'Tor!', 2: 'Doppelpack!', 3: 'Hattrick!', 4: 'Viererpack!', 5: 'Fünferpack!' };
const ladderText = (n, perfect) => (perfect ? 'Weiße Weste!' : LADDER[Math.min(n, 5)] || 'Tor!');

/* ---------- Sammelsticker: 100 Stück in drei Seltenheiten ----------
   Normal zählt 1 Punkt, selten 2, ultraselten 5. Je 10 Sticker-Punkte gibt es 1 Bonus-Tor.
   Die ersten 30 Nummern (s01 bis s30) bleiben, wie sie waren: Wer sie schon hat, behält sie. */
const RARITY = { n: { name: 'Normal', pts: 1 }, r: { name: 'Selten', pts: 2 }, u: { name: 'Ultraselten', pts: 5 } };
const RAR_ORDER = ['u', 'r', 'n'];
const RAR_WEIGHT = { n: 12, r: 4, u: 1 };       // Ziehungsgewicht in der Tüte: Seltene kommen seltener
const PTS_PER_TOR = 10;
const STICKER_DATA = [
  /* Stadion 1 bis 10 */
  ['⚽', 'Der Anstoß', 'Stadion', 'n'], ['👟', 'Gold-Schuh', 'Stadion', 'r'], ['🧤', 'Torwart-Parade', 'Stadion', 'n'], ['🥅', 'Netz-Zittern', 'Stadion', 'n'], ['🚩', 'Eckfahne', 'Stadion', 'n'],
  ['🎽', 'Trikot-Tausch', 'Stadion', 'n'], ['🏟️', 'Heimspiel', 'Stadion', 'n'], ['📣', 'Fan-Kurve', 'Stadion', 'n'], ['🔔', 'Schiri-Pfeife', 'Stadion', 'n'], ['💡', 'Flutlicht', 'Stadion', 'r'],
  /* Technik 11 bis 20 */
  ['🚀', 'Hecht­kopfball', 'Technik', 'r'], ['🔄', 'Fall­rück­zieher', 'Technik', 'r'], ['🎯', 'Elfmeter-Nerven', 'Technik', 'n'], ['🤝', 'Doppelpass', 'Technik', 'n'], ['🏹', 'Flanke', 'Technik', 'n'],
  ['🌈', 'Freistoß-Bogen', 'Technik', 'n'], ['⏱️', 'Nach­spiel­zeit', 'Technik', 'n'], ['🏆', 'Pokal-Nacht', 'Technik', 'r'], ['🔥', 'Derby-Tag', 'Technik', 'n'], ['💥', 'Seit­fall­zieher', 'Technik', 'u'],
  /* Angeln 21 bis 30 */
  ['🎣', 'Angel-Rolle', 'Angeln', 'n'], ['🐟', 'Der Kapitale', 'Angeln', 'u'], ['🐟', 'Zander', 'Angeln', 'r'], ['🐟', 'Barsch', 'Angeln', 'n'], ['🐟', 'Karpfen', 'Angeln', 'n'],
  ['🌅', 'Sonnen­aufgang', 'Angeln', 'r'], ['🐟', 'Hecht', 'Angeln', 'r'], ['🐟', 'Forelle', 'Angeln', 'n'], ['🌊', 'Welle', 'Angeln', 'n'], ['⚓', 'Anker', 'Angeln', 'n'],
  /* Stadion, neu 31 bis 45 */
  ['🥁', 'Trommel-Takt', 'Stadion', 'n'], ['🎺', 'Stadion-Hymne', 'Stadion', 'n'], ['🧣', 'Fan-Schal', 'Stadion', 'n'], ['🎫', 'Eintritts-Karte', 'Stadion', 'n'], ['🚌', 'Mannschafts­bus', 'Stadion', 'n'],
  ['📺', 'Live-Über­tragung', 'Stadion', 'n'], ['🎤', 'Stadion-Sprecher', 'Stadion', 'n'], ['🥤', 'Halbzeit-Limo', 'Stadion', 'n'], ['🧢', 'Fan-Mütze', 'Stadion', 'n'],
  ['📸', 'Torjubel-Foto', 'Stadion', 'r'], ['🥇', 'Gold-Medaille', 'Stadion', 'r'], ['🎆', 'Meister-Feier', 'Stadion', 'r'], ['🎖️', 'Kapitäns-Binde', 'Stadion', 'r'], ['✨', 'Wunder-Tor', 'Stadion', 'r'],
  ['👑', 'Torschützen-König', 'Stadion', 'u'],
  /* Technik, neu 46 bis 60 */
  ['🦵', 'Spann-Schuss', 'Technik', 'n'], ['👣', 'Dribbling', 'Technik', 'n'], ['🧱', 'Freistoß-Mauer', 'Technik', 'n'], ['🏃', 'Sprint-Duell', 'Technik', 'n'], ['🦶', 'Heber', 'Technik', 'n'],
  ['⚡', 'Konter', 'Technik', 'n'], ['👀', 'Über­blick', 'Technik', 'n'], ['🏁', 'Steil-Pass', 'Technik', 'n'], ['🤹', 'Jonglage', 'Technik', 'n'],
  ['🌀', 'Über­steiger', 'Technik', 'r'], ['☄️', 'Volley-Schuss', 'Technik', 'r'], ['🧲', 'Ball-Magnet', 'Technik', 'r'], ['🎪', 'Zirkus-Trick', 'Technik', 'r'],
  ['🌠', 'Traum-Tor', 'Technik', 'u'], ['💎', 'Diamant-Pass', 'Technik', 'u'],
  /* Angeln, neu 61 bis 75 */
  ['🐟', 'Rotauge', 'Angeln', 'n'], ['🐛', 'Köder-Wurm', 'Angeln', 'n'], ['🧰', 'Angel-Kiste', 'Angeln', 'n'], ['🛶', 'Ruder-Boot', 'Angeln', 'n'], ['🌲', 'Wald-See', 'Angeln', 'n'],
  ['🦆', 'Enten-Teich', 'Angeln', 'n'], ['🐸', 'Frosch', 'Angeln', 'n'], ['⛺', 'Zelt-Nacht', 'Angeln', 'n'],
  ['🐟', 'Aal', 'Angeln', 'r'], ['🐟', 'Lachs', 'Angeln', 'r'], ['🦀', 'Krebs', 'Angeln', 'r'], ['🌙', 'Nacht-Fang', 'Angeln', 'r'], ['🌫️', 'Morgen-Nebel', 'Angeln', 'r'],
  ['🐟', 'Wels', 'Angeln', 'u'], ['🐠', 'Der Goldene', 'Angeln', 'u'],
  /* Action, neu 76 bis 100 */
  ['🛹', 'Skateboard', 'Action', 'n'], ['🛴', 'Roller', 'Action', 'n'], ['🚲', 'Fahrrad-Tour', 'Action', 'n'], ['🏎️', 'Renn-Wagen', 'Action', 'n'], ['🪁', 'Flug-Drachen', 'Action', 'n'],
  ['🧗', 'Kletter-Wand', 'Action', 'n'], ['⛷️', 'Ski-Abfahrt', 'Action', 'n'], ['🎮', 'Joystick', 'Action', 'n'], ['🏕️', 'Camping', 'Action', 'n'], ['🥾', 'Wander-Schuh', 'Action', 'n'],
  ['🛷', 'Schlitten', 'Action', 'n'], ['🚒', 'Feuerwehr', 'Action', 'n'], ['🚜', 'Traktor', 'Action', 'n'], ['⛵', 'Segel-Boot', 'Action', 'n'],
  ['🚁', 'Hub­schrauber', 'Action', 'r'], ['🤿', 'Tauch-Gang', 'Action', 'r'], ['🏍️', 'Motocross', 'Action', 'r'], ['🪂', 'Fallschirm', 'Action', 'r'], ['🎢', 'Achterbahn', 'Action', 'r'],
  ['🦖', 'Dino-Jäger', 'Action', 'r'], ['🥷', 'Ninja', 'Action', 'r'], ['🚤', 'Speed-Boot', 'Action', 'r'],
  ['🛸', 'Ufo-Landung', 'Action', 'u'], ['🦸', 'Super-Held', 'Action', 'u'], ['🐉', 'Drachen-Herz', 'Action', 'u'],
];
const STICKERS = STICKER_DATA.map((s, i) => ({ id: 's' + pad2(i + 1), ico: s[0], name: s[1], cat: s[2], rar: s[3] }));
const STICKER_BY = {};
STICKERS.forEach(s => { STICKER_BY[s.id] = s; });
/* Steckbriefe (Schlüssel = Name ohne Trennstriche). Erscheinen beim Antippen und beim Öffnen der Tüte. */
const STICKER_FACT = {
  'Der Kapitale': 'So nennen Angler einen richtig großen Fang.',
  Zander: 'Raubfisch mit Glasaugen: Er sieht in trübem Wasser und in der Dämmerung bestens.',
  Barsch: 'Erkennbar am Streifenhemd und an den roten Flossen. Junge Barsche jagen im Schwarm.',
  Karpfen: 'Schlau und zäh: Ein Karpfen kann über 30 Jahre alt werden.',
  Hecht: 'Der Räuber im Teich: bis zu 1,5 Meter lang und mit vielen spitzen Zähnen.',
  Forelle: 'Sie liebt kaltes, klares Wasser. An den roten Punkten erkennst du sie.',
  Rotauge: 'Ein Schwarmfisch mit roten Augen und roten Flossen. Er lebt fast überall im Wasser.',
  Aal: 'Aale schwimmen Tausende Kilometer durchs Meer, um ihre Eier abzulegen.',
  Lachs: 'Lachse springen Wasserfälle hinauf, wenn sie zurück in ihren Heimatfluss wollen.',
  Wels: 'Der größte Süßwasserfisch Europas: über zwei Meter lang, mit Barteln wie eine Katze.',
  'Der Goldene': 'Eine Legende unter Anglern. Nur wenige wollen ihn je gesehen haben.',
  Seitfallzieher: 'Ein Akrobatik-Tor: Der Ball fliegt, der Spieler auch.',
  'Torschützen-König': 'Die Krone bekommt, wer in einer Saison die meisten Tore schießt.',
  'Traum-Tor': 'So eines gelingt vielleicht einmal im Leben.',
  'Diamant-Pass': 'So genau gespielt, dass der Stürmer den Ball nur noch einschieben muss.',
  'Ufo-Landung': 'Gelandet! Nur die Mutigsten erzählen davon.',
  'Super-Held': 'Auch Helden fangen klein an: mit einem aufgeräumten Zimmer.',
  'Drachen-Herz': 'Der Drache bewacht deinen Schatz und gibt ihn nur den Besten.',
};
const factOf = s => STICKER_FACT[s.name.replace(/­/g, '')] || '';
const rarOf = id => (STICKER_BY[id] ? STICKER_BY[id].rar : 'n');
const stickerPoints = prog => (prog.album || []).reduce((n, id) => n + RARITY[rarOf(id)].pts, 0);
const stickerBonus = prog => Math.floor(stickerPoints(prog) / PTS_PER_TOR);
/* Zieht einen Sticker aus der Liste, Seltene mit kleinerem Gewicht (rnd liefert 0 bis unter 1). */
function pickSticker(list, rnd) {
  const r = rnd || Math.random, tot = list.reduce((n, s) => n + RAR_WEIGHT[s.rar], 0);
  let x = r() * tot;
  for (let i = 0; i < list.length; i++) { x -= RAR_WEIGHT[list[i].rar]; if (x < 0) return list[i]; }
  return list[list.length - 1];
}
const packsLeft = (earned, album, foil) => { const opened = album.length + (foil || []).length; return opened >= 2 * STICKERS.length ? 0 : Math.max(0, earned - opened); };

/* ---------- Aufgaben eines Tages ---------- */
function tasksOn(S, ds) {
  const day = S.days[ds], m = (day && day.m) || {}, wd = dowOf(ds);
  return S.cfg.tasks.filter(t => {
    if (m[t.id]) return true;                       // bereits gewertet: zählt weiter, auch wenn die Aufgabe später geändert wird
    if (t.from && ds < t.from) return false;        // erst ab Anlegedatum
    if (t.until && ds >= t.until) return false;     // ausgeblendet ab Datum
    return (t.days || []).indexOf(wd) >= 0;
  });
}

/* ---------- Karten (rechnet alle Tage der Reihe nach durch) ----------
   Gelb = Verwarnung und kostet yellowPts Minus-Tore. Gelbe verfallen nie.
   Zwei offene Gelbe = automatisch Rot. Rot kostet redPts Minus-Tore (höchstens einmal pro Tag) und leert die Gelben.
   Das Minus (L.minus) steht bei den Zielen und beim Fang auf der Rechnung. Die Tore des Tages und der Spielstand bleiben unberührt,
   und der Gegner bekommt für Karten nichts.
   Alte Fair-Play-Einträge (k: 'f') streichen weiterhin die jüngste Gelbe.
   Automatische Rote sind abgeleitet, nicht gespeichert: Wird ein Eintrag gelöscht, rechnet sich alles neu.
   Der automatische Eintrag merkt sich in src die zweite Gelbe, die ihn ausgelöst hat. */
function buildLedger(S) {
  const cfg = S.cfg;
  const limit = 2;
  const expiry = Math.max(0, +cfg.yellowExpiry || 0);
  const yPts = Math.max(0, +cfg.yellowPts || 0), rPts = Math.max(0, +cfg.redPts || 0);
  const xMax = Math.max(0, cfg.extraMax == null ? 3 : +cfg.extraMax);
  const dates = Object.keys(S.days).filter(ds => (!S.days[ds].off || S.days[ds].joker) && (S.days[ds].ev || []).length).sort();
  const byDay = {};
  let active = [];
  for (const ds of dates) {
    const L = { plus: 0, plusRaw: 0, plusN: 0, yellow: 0, red: 0, autoRed: 0, fair: 0, minus: 0, rivalFree: 0, freeNo: 0, entries: [] };
    let redDone = false;
    const live = () => { if (expiry > 0) active = active.filter(d => daysBetween(d, ds) < expiry); };
    const sendOff = (auto, e, src) => {
      const counts = !redDone; redDone = true;
      if (auto) L.autoRed++; else L.red++;
      if (counts) L.minus += rPts;
      active = [];
      L.entries.push(auto ? { k: 'r', auto, capped: !counts, src } : Object.assign({}, e, { capped: !counts }));
    };
    for (const e of S.days[ds].ev) {
      if (e.k === '+') { L.plusRaw += +e.v || 1; L.plusN++; L.entries.push(e); }
      else if (e.k === 'n') { L.rivalFree += Math.max(1, Math.round(+e.v) || 1); L.freeNo++; L.entries.push(e); }   // eigener Grund: Kein Tor, der Gegner bekommt es
      else if (e.k === 'f') { live(); active.pop(); L.fair++; L.entries.push(e); }   // alter Eintrag: streicht die jüngste Gelbe
      else if (e.k === 'r') sendOff(null, e);
      else if (e.k === 'y') {
        live(); active.push(ds); L.yellow++; L.minus += yPts; L.entries.push(e);
        if (active.length >= limit) sendOff('sum', null, e.id);
      }
    }
    L.plus = Math.min(L.plusRaw, xMax);
    byDay[ds] = L;
  }
  return { byDay, active, limit, expiry };
}
function ledgerOf(S) {
  if (S._ledger && S._v !== undefined && S._lv === S._v) return S._ledger;
  S._ledger = buildLedger(S); S._lv = S._v;
  return S._ledger;
}
const touch = S => { S._v = (S._v || 0) + 1; };

/* Stand des Verwarnungskontos (offene Gelbe; ohne Verfall, solange yellowExpiry 0 ist). */
function accountNow(S, today) {
  const lg = ledgerOf(S);
  const act = lg.expiry > 0 ? lg.active.filter(d => daysBetween(d, today) < lg.expiry) : lg.active.slice();
  return { count: act.length, limit: lg.limit, dates: act, expires: act.length && lg.expiry > 0 ? addDays(act[0], lg.expiry) : null, expiry: lg.expiry };
}

/* ---------- Ein Tag ---------- */
function evalDay(S, ds) {
  const day = S.days[ds] || {};
  const r = { ds, off: false, joker: false, items: [], max: 0, gain: 0, plus: 0, plusN: 0, minus: 0, rival: 0, freeNo: 0, open: 0, ok: 0, bad: 0, na: 0, appN: 0, bonusDone: 0, judged: 0, hasData: false, result: 'none', perfect: false, complete: false, entries: [], yellow: 0, red: 0, fair: 0 };
  if (day.off) { r.off = true; r.joker = !!day.joker; r.result = 'off'; return r; }
  const m = day.m || {};
  let gain = 0;
  r.items = tasksOn(S, ds).map(t => {
    const st = m[t.id] || null;
    if (t.bonus) { if (st === 'y') { gain += t.pts; r.bonusDone++; } }
    else if (st === 'x') r.na++;
    else {
      r.appN++; r.max += t.pts;
      if (st === 'y') { gain += t.pts; r.ok++; }
      else if (st === 'n') { r.rival += t.pts; r.bad++; }
      else r.open++;
    }
    return { t, st };
  });
  const led = ledgerOf(S).byDay[ds];
  if (led) {
    r.plus = led.plus; r.plusN = led.plusN; r.entries = led.entries;
    r.yellow = led.yellow; r.red = led.red + led.autoRed; r.fair = led.fair;
    r.minus = led.minus;                           // Abzug durch Karten: zählt bei den Zielen, nicht im Spielstand
    r.freeNo = led.freeNo;
    r.rival += led.rivalFree;                      // eigene „Kein Tor“-Gründe zählen wie eine nicht geschaffte Aufgabe
  }
  r.gain = gain + r.plus;                          // alle Tore des Tages ohne Abzug: Das zeigt die Übersicht
  r.judged = r.ok + r.bad;
  r.hasData = r.judged > 0 || r.gain > 0 || r.freeNo > 0;      // Karten allein ergeben noch kein Spiel
  if (r.hasData) r.result = r.gain > r.rival ? 'win' : r.gain === r.rival ? 'draw' : 'loss';
  r.perfect = r.appN > 0 && r.ok === r.appN && r.red === 0 && r.yellow === 0 && r.freeNo === 0;
  r.complete = r.appN > 0 && r.open === 0;
  return r;
}

/* ---------- Eine Woche (Montag bis Sonntag) ---------- */
function evalWeek(S, mon) {
  const days = [];
  let goals = 0, max = 0, perfect = 0, joker = null, yellow = 0, red = 0, minus = 0;
  for (let i = 0; i < 7; i++) {
    const ds = addDays(mon, i), e = evalDay(S, ds);
    days.push(e); goals += e.gain; max += e.max; if (e.perfect) perfect++;
    yellow += e.yellow; red += e.red; minus += e.minus;
    if (e.joker) joker = ds;
  }
  return { mon, days, goals, max, perfect, joker, yellow, red, minus };
}

/* ---------- Gesamtstand ----------
   total = alle Tore (Aufgaben, eigene Gründe, Bonus-Tore der Sticker): Das zeigt die Übersicht und danach richten sich die Sticker-Tüten.
   minus = Abzug durch Gelbe und Rote Karten, score = total − minus: Danach richten sich die Ziele und der Fang. */
function computeStats(S, today) {
  const dates = Object.keys(S.days).filter(d => d <= today).sort();
  let days = 0, perfect = 0, bonusDone = 0, extras = 0, cur = 0, best = 0, yellows = 0, reds = 0, minus = 0;
  for (const ds of dates) {
    const e = evalDay(S, ds);
    if (e.off) continue;
    days += e.gain; minus += e.minus; bonusDone += e.bonusDone; extras += e.plusN; yellows += e.yellow; reds += e.red;
    if (e.perfect) perfect++;
    if (e.result === 'win' || e.result === 'draw') { cur++; if (cur > best) best = cur; }
    else if (e.result === 'loss') cur = 0;
  }
  const album = S.prog.album || [], foil = S.prog.foil || [];
  const pts = stickerPoints(S.prog), bonus = Math.floor(pts / PTS_PER_TOR);
  const total = days + bonus;                                             // Tore aus Aufgaben plus Bonus-Tore der Sticker
  const score = total - minus;                                            // zählt für Ziele und Fang
  const every = Math.max(1, +S.cfg.packEvery || 5);
  const earned = 1 + Math.floor(total / every);
  const cel = S.prog.cel || {};
  const last = S.cfg.goals[S.cfg.goals.length - 1];
  return {
    total, minus, score, days, perfect, bonusDone, extras, cur, best, yellows, reds,
    caught: !!last && goalReached(S, score, last),
    account: accountNow(S, today),
    stickers: { count: album.length, pts, bonus, toNext: PTS_PER_TOR - (pts % PTS_PER_TOR) },
    packs: { earned, opened: album.length + foil.length, left: packsLeft(earned, album, foil), complete: album.length >= STICKERS.length, foil: foil.length, every, next: every - (total % every) },
    reachedOn: id => { const v = cel['g:' + id]; return typeof v === 'string' ? v : null; },
  };
}

/* Ein Ziel ist erreicht, wenn die Tore nach Abzug reichen. Ein eingelöstes Ziel bleibt erreicht: Eine Belohnung, die schon da ist, nimmt kein Minus zurück. */
const goalReached = (S, score, g) => score >= g.at || !!(S.prog.red && S.prog.red[g.id]);

/* Die Ziele mit Stand (gerechnet mit den Toren nach Abzug). Das letzte Ziel ist der große Fang. */
function goalList(S, st) {
  const red = S.prog.red || {}, gs = S.cfg.goals;
  return gs.map((g, i) => ({
    id: g.id, at: g.at, reward: g.reward, last: i === gs.length - 1, tier: i < gs.length * 0.36 ? 'bronze' : i < gs.length * 0.72 ? 'silver' : 'gold',
    reached: goalReached(S, st.score, g), need: Math.max(0, g.at - st.score), prev: i ? gs[i - 1].at : 0,
    on: st.reachedOn(g.id), done: red[g.id] || null, money: rewardMoney(g.reward),
  }));
}
/* Nächstes noch nicht erreichtes Ziel (null, wenn alle erreicht sind). */
const nextGoal = (S, st) => goalList(S, st).find(g => !g.reached) || null;
/* Steht in der Belohnung „5 € aufs Guthabenkonto“, bucht die App den Betrag beim Einlösen (in Cent, sonst 0). */
function rewardMoney(text) {
  const m = /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|euro)\s*(?:auf|aufs|auf\s+das|auf\s+dem)\s*(?:guthaben)?\s*konto/i.exec(String(text || ''));
  return m ? (parseMoney(m[1]) || 0) : 0;
}

/* Meilensteine vor/nach einer Änderung vergleichen (für Feiern). */
function milestones(S, ds, today) {
  const e = evalDay(S, ds), st = computeStats(S, today);
  return { perfect: e.perfect, goals: S.cfg.goals.filter(g => goalReached(S, st.score, g)).map(g => g.id), caught: st.caught, total: st.total, score: st.score, packs: st.packs.earned, ok: e.ok, red: e.red, yellow: e.yellow, account: st.account.count };
}

/* Hinweise für den Trainer (Bremse): Hürde zu hoch? Belohnung offen? */
function coachAdvice(S, today) {
  const out = [];
  if (S.cfg.tasks.some(t => t.id === 't_abmachung' && !(t.until && t.until <= today)) && !String(S.cfg.agreement || '').trim()) out.push({ kind: 'agreement' });
  let reds = 0;
  for (let i = 0; i < 7; i++) reds += evalDay(S, addDays(today, -i)).red;
  if (reds >= 2) out.push({ kind: 'reds', n: reds });
  goalList(S, computeStats(S, today)).forEach(g => { if (g.reached && !g.done && g.on && daysBetween(g.on, today) >= 7) out.push({ kind: 'open', id: g.id, at: g.at, since: g.on }); });
  if ((S.prog.album || []).length >= STICKERS.length) out.push({ kind: 'album' });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fmtEUR, fmtPlain, parseMoney, kontoBalance, kontoList, genitive, STICKER_FACT, factOf, WD_SHORT, WD_LONG, MONTHS_SHORT, fmtDate, parseDate, addDays, dowOf, mondayOf, todayStr, daysBetween, isoWeek, defaultCfg, migrateCfg, normGoals, normProg, taskSub, goalReached, goalList, nextGoal, rewardMoney, LADDER, ladderText, RARITY, RAR_ORDER, RAR_WEIGHT, PTS_PER_TOR, STICKERS, STICKER_BY, rarOf, stickerPoints, stickerBonus, pickSticker, packsLeft, tasksOn, buildLedger, ledgerOf, touch, accountNow, evalDay, evalWeek, computeStats, milestones, coachAdvice };
}
