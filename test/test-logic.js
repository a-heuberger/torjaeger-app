const L = require('../src/logic.js');
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
};
const mk = (days, over) => ({ cfg: L.migrateCfg(Object.assign({}, over || {}), '2026-10-19'), prog: L.normProg(), days: days || {}, konto: {} });
const T9 = ['t_hefte', 't_notiert', 't_hausaufgaben', 't_zimmer', 't_eincremen', 't_buch', 't_spuelmaschine', 't_tisch', 't_abmachung'];
const WEEKEND = ['t_zimmer', 't_eincremen', 't_buch', 't_spuelmaschine', 't_tisch', 't_abmachung'];
const marks = (ids, v) => Object.fromEntries(ids.map(id => [id, v]));
const ALL = marks(T9, 'y');
const Y = { k: 'y', t: 'x', id: 'y1' }, R = { k: 'r', t: 'x', id: 'r1' }, F = { k: 'f', t: 'x' };
const Y2 = { k: 'y', id: 'y2' };

// ---- Datum ----
eq('montag', L.dowOf('2026-10-19'), 1);
eq('mondayOf', L.mondayOf('2026-10-25'), '2026-10-19');
eq('isoWeek', L.isoWeek('2026-10-19'), 43);
eq('daysBetween', L.daysBetween('2026-10-19', '2026-11-02'), 14);
eq('daysBetween DST', L.daysBetween('2026-10-24', '2026-10-26'), 2);

// ---- Voreinstellungen (Vorgaben des Trainers) ----
let S = mk();
eq('Aufgaben: genau die neun Gründe in der Reihenfolge des Trainers', S.cfg.tasks.map(t => t.title), ['Hefteinträge ordentlich', 'Hausaufgabenheft eingetragen', 'Hausaufgaben gut gemacht', 'Zimmer sauber', 'Eingecremt', 'Buch gelesen', 'Spülmaschine ausgeräumt', 'Tisch gedeckt und abgeräumt', 'An Abmachungen gehalten']);
eq('Aufgaben: ein Tor je Grund, kein Bonus, Hefte und Hausaufgaben nur an Schultagen', [S.cfg.tasks.every(t => t.pts === 1 && !t.bonus), S.cfg.tasks.filter(t => t.days.length === 5).map(t => t.id), S.cfg.tasks.filter(t => t.days.length === 7).length], [true, ['t_hefte', 't_notiert', 't_hausaufgaben'], 6]);
eq('Karten: Gelb 1, Rot 3 Minus-Tore, Gelbe verfallen nie', [S.cfg.yellowPts, S.cfg.redPts, S.cfg.yellowExpiry, S.cfg.extraMax, S.cfg.packEvery], [1, 3, 0, 3, 6]);
eq('Ziele: die elf Vorgaben des Trainers', S.cfg.goals.map(g => g.at + ' ' + g.reward), [
  '25 Fußballpack', '50 5 € aufs Guthabenkonto', '75 Eine Stunde YouTube Handyzeit', '100 Wird später festgelegt', '125 Fußballpack', '150 5 € aufs Guthabenkonto',
  '175 Zum Asiamarkt nach Mühldorf inkl. 20 € Guthaben', '200 Wird später festgelegt', '250 5 € aufs Guthabenkonto', '300 Wird später festgelegt', '500 Ausflug in den Freizeitpark']);
eq('Fisch hat einen Namen, keine Saison mehr', [S.cfg.season.title, Object.keys(S.cfg.season)], ['Der Riesen-Hecht', ['title']]);
eq('Fassung 4, keine alten Felder', [S.cfg.v, S.cfg.tiers, S.cfg.yellowRules, S.cfg.redRules], [4, undefined, undefined, undefined]);

// ---- Tag ----
S = mk({ '2026-10-19': { m: ALL } });
let e = L.evalDay(S, '2026-10-19');
eq('perfekter Schultag: 9 Tore', [e.max, e.gain, e.perfect, e.result, e.complete], [9, 9, true, 'win', true]);
S = mk({});
eq('Wochenende: 6 Gründe, Schultag 9', [L.evalDay(S, '2026-10-24').max, L.evalDay(S, '2026-10-25').max, L.evalDay(S, '2026-10-21').max], [6, 6, 9]);
S = mk({ '2026-10-19': { m: Object.assign({}, ALL, { t_eincremen: 'n' }) } });
e = L.evalDay(S, '2026-10-19');
eq('8:1', [e.gain, e.rival, e.result, e.perfect], [8, 1, 'win', false]);
S = mk({ '2026-10-19': { m: Object.assign(marks(T9, 'n'), { t_zimmer: 'y' }) } });
eq('1:8 verloren', L.evalDay(S, '2026-10-19').result, 'loss');
S = mk({ '2026-10-24': { m: { t_zimmer: 'y', t_buch: 'n', t_tisch: 'x' } } });
e = L.evalDay(S, '2026-10-24');
eq('Unentschieden und „Nicht dran“ (alte Daten)', [e.gain, e.rival, e.result, e.max, e.na], [1, 1, 'draw', 5, 1]);

// ---- Karten: Gelb = Verwarnung, Minus 1; zwei Gelbe = automatisch Rot, Minus 3. Der Spielstand bleibt unberührt ----
S = mk({ '2026-10-19': { m: ALL, ev: [Y] } });
e = L.evalDay(S, '2026-10-19');
eq('eine Gelbe: Minus 1, Spielstand 9:0 bleibt, kein perfekter Tag mehr', [e.yellow, e.red, e.minus, e.gain, e.rival, e.perfect], [1, 0, 1, 9, 0, false]);
eq('Konto zeigt eine offene Gelbe, ohne Ablauf', [L.accountNow(S, '2026-10-19').count, L.accountNow(S, '2026-10-19').expires], [1, null]);
S = mk({ '2026-10-19': { m: ALL, ev: [Y, Y2] } });
e = L.evalDay(S, '2026-10-19');
eq('zwei Gelbe am Tag: Minus 1 + 1 + 3, Spielstand 9:0 bleibt', [e.yellow, e.red, e.minus, e.gain, e.rival, e.result], [2, 1, 5, 9, 0, 'win']);
eq('automatisches Rot merkt sich die zweite Gelbe', e.entries.filter(x => x.auto).map(x => [x.auto, x.src]), [['sum', 'y2']]);
eq('Konto leer nach Rot', L.accountNow(S, '2026-10-19').count, 0);

// Gelbe verfallen nie: auch nach Monaten ergibt die zweite Gelbe Rot
S = mk({ '2026-10-19': { ev: [Y] }, '2027-02-03': { m: ALL, ev: [Y2] } });
e = L.evalDay(S, '2027-02-03');
eq('Gelb im Oktober + Gelb im Februar = Rot (Minus 1 + 3 am Tag des Februar)', [e.red, e.minus, L.accountNow(S, '2027-02-03').count], [1, 4, 0]);
eq('eine Gelbe vom Oktober gilt auch im Dezember noch', L.accountNow(mk({ '2026-10-19': { ev: [Y] } }), '2026-12-01').count, 1);
S = mk({ '2026-10-19': { ev: [Y] } }, { v: 4, yellowExpiry: 7 });
eq('ein eingestellter Verfall wird ignoriert', [S.cfg.yellowExpiry, L.accountNow(S, '2027-03-01').count], [0, 1]);
S = mk({ '2026-10-19': { ev: [Y, Y2] }, '2026-10-20': { ev: [{ k: 'y', id: 'y3' }] } });
eq('nach dem Rot fängt das Zählen wieder bei eins an', [L.accountNow(S, '2026-10-20').count, L.evalDay(S, '2026-10-20').red, L.evalDay(S, '2026-10-20').minus], [1, 0, 1]);
S = mk({ '2026-10-19': { ev: [Y] }, '2026-10-20': { ev: [Y2] }, '2026-10-21': { ev: [{ k: 'y', id: 'y3' }] } });
eq('drei Gelbe in drei Tagen: Rot am zweiten, dann wieder eine offen', [L.evalDay(S, '2026-10-20').red, L.evalDay(S, '2026-10-21').red, L.accountNow(S, '2026-10-21').count], [1, 0, 1]);

// ---- Direkte Rote: Minus 3, Spielstand bleibt, leert die Gelben, höchstens einmal pro Tag ----
S = mk({ '2026-10-19': { ev: [Y] }, '2026-10-20': { m: ALL, ev: [R] } });
e = L.evalDay(S, '2026-10-20');
eq('direktes Rot', [e.red, e.minus, e.gain, e.rival, e.perfect], [1, 3, 9, 0, false]);
eq('Rot leert das Konto', L.accountNow(S, '2026-10-20').count, 0);
S = mk({ '2026-10-19': { m: ALL, ev: [R, { k: 'r', id: 'r2' }] } });
e = L.evalDay(S, '2026-10-19');
eq('höchstens ein Rot pro Tag wirkt', [e.red, e.minus, e.gain], [2, 3, 9]);
S = mk({ '2026-10-19': { m: ALL, ev: [Y, Y2, R] } });
e = L.evalDay(S, '2026-10-19');
eq('automatisches Rot + Rot = einmal Minus (1 + 1 + 3)', [e.minus, e.gain, e.entries.filter(x => x.capped).length], [5, 9, 1]);
S = mk({ '2026-10-19': { ev: [R] } });
e = L.evalDay(S, '2026-10-19');
eq('nur eine Karte: Minus 3, aber noch kein Spiel (0:0, ohne Ergebnis)', [e.gain, e.rival, e.minus, e.hasData, e.result], [0, 0, 3, false, 'none']);
S = mk({ '2026-10-19': { m: ALL }, '2026-10-20': { m: ALL, ev: [R] } });
eq('Rot wirkt nur am eigenen Tag', [L.evalDay(S, '2026-10-19').minus, L.evalDay(S, '2026-10-20').minus], [0, 3]);
S = mk({ '2026-10-19': { m: { t_hefte: 'y', t_notiert: 'y', t_hausaufgaben: 'y', t_zimmer: 'n' } } });
eq('3:1 ohne Rot', [L.evalDay(S, '2026-10-19').gain, L.evalDay(S, '2026-10-19').rival, L.evalDay(S, '2026-10-19').result], [3, 1, 'win']);
S.days['2026-10-19'].ev = [R]; L.touch(S);
e = L.evalDay(S, '2026-10-19');
eq('3:1 bleibt auch mit Rot 3:1 und ein Sieg, das Minus steht extra (3)', [e.gain, e.rival, e.minus, e.result], [3, 1, 3, 'win']);
S = mk({ '2026-10-19': { m: ALL, ev: [R] } }, { v: 4, redPts: 5, yellowPts: 2 });
eq('Minus pro Karte einstellbar (Version 4)', [L.evalDay(S, '2026-10-19').minus, L.evalDay(S, '2026-10-19').rival], [5, 0]);
S = mk({ '2026-10-19': { m: ALL, ev: [Y] } }, { v: 4, redPts: 5, yellowPts: 0 });
eq('Gelb ohne Minus möglich (0 eingestellt)', [L.evalDay(S, '2026-10-19').minus, L.evalDay(S, '2026-10-19').yellow], [0, 1]);
S = mk({ '2026-10-19': { m: ALL, ev: [Y, R] } }, { cardsOn: false, yellowLimit: 5 });
eq('uralte Einstellungen (Abzug aus, Limit 5) wirken nicht: Gelb 1 + Rot 3', [L.evalDay(S, '2026-10-19').gain, L.evalDay(S, '2026-10-19').minus, S.cfg.cardsOn, S.cfg.yellowLimit], [9, 4, undefined, undefined]);

// ---- Eigener Grund: Tor (Extra) und Kein Tor ----
S = mk({ '2026-10-19': { m: { t_hefte: 'y' }, ev: [{ k: '+', v: 2, t: 'Hund ausgeführt', id: 'x1' }] } });
e = L.evalDay(S, '2026-10-19');
eq('eigener Grund Tor', [e.plus, e.plusN, e.gain], [2, 1, 3]);
S = mk({ '2026-10-19': { ev: [{ k: '+', v: 2, t: 'a' }, { k: '+', v: 2, t: 'b' }] } });
eq('eigene Tor-Gründe gedeckelt auf 3 pro Tag', [L.evalDay(S, '2026-10-19').plus, L.evalDay(S, '2026-10-19').gain], [3, 3]);
S = mk({ '2026-10-19': { ev: [{ k: '+', v: 3, t: 'a' }] } }, { extraMax: 1 });
eq('Obergrenze einstellbar', L.evalDay(S, '2026-10-19').gain, 1);
S = mk({ '2026-10-19': { m: ALL, ev: [{ k: 'n', v: 2, t: 'Frech geantwortet', id: 'n1' }] } });
e = L.evalDay(S, '2026-10-19');
eq('eigener Grund Kein Tor: Gegner +2, Ben behält 9, kein Minus, kein perfekter Tag', [e.freeNo, e.rival, e.minus, e.gain, e.perfect, e.result], [1, 2, 0, 9, false, 'win']);
S = mk({ '2026-10-19': { ev: [{ k: 'n', t: 'x', id: 'n2' }] } });
e = L.evalDay(S, '2026-10-19');
eq('Kein Tor ohne Zahl = 1; ein Tag nur damit hat Daten und ist verloren', [e.rival, e.hasData, e.result, e.entries.length], [1, true, 'loss', 1]);
S = mk({ '2026-10-19': { ev: [{ k: 'n', v: 1, t: 'a' }, { k: 'n', v: 1, t: 'b' }, { k: 'n', v: 1, t: 'c' }, { k: 'n', v: 1, t: 'd' }] } });
eq('Kein Tor ist nicht gedeckelt', L.evalDay(S, '2026-10-19').rival, 4);
S = mk({ '2026-10-19': { ev: [{ k: '+', v: 1, t: 'x' }] } });
eq('nur ein Tor-Grund = Sieg', L.evalDay(S, '2026-10-19').result, 'win');

// ---- Fair-Play-Geste (alte Daten) streicht die jüngste Gelbe ----
S = mk({ '2026-10-19': { ev: [Y, F] } });
eq('Fair Play am selben Tag', [L.accountNow(S, '2026-10-19').count, L.evalDay(S, '2026-10-19').fair], [0, 1]);
S = mk({ '2026-10-19': { ev: [F] } });
eq('Fair Play ohne Gelbe: harmlos', L.accountNow(S, '2026-10-19').count, 0);
S = mk({ '2026-10-19': { ev: [Y, F, Y2] } });
eq('gelb, fair play, gelb: kein Rot', [L.evalDay(S, '2026-10-19').red, L.accountNow(S, '2026-10-19').count], [0, 1]);

// ---- Eintrag löschen rechnet neu ----
S = mk({ '2026-10-19': { m: ALL, ev: [Y, Y2] } });
eq('vorher Rot', L.evalDay(S, '2026-10-19').red, 1);
S.days['2026-10-19'].ev = S.days['2026-10-19'].ev.filter(x => x.id !== 'y2'); L.touch(S);
eq('zweite Gelbe zurückgezogen: kein Rot, eine Gelbe offen, Minus 1', [L.evalDay(S, '2026-10-19').red, L.accountNow(S, '2026-10-19').count, L.evalDay(S, '2026-10-19').minus], [0, 1, 1]);

// ---- Spielfrei / Joker (nur noch für alte Daten) ----
S = mk({ '2026-10-19': { off: true, m: ALL, ev: [Y, Y2] } });
e = L.evalDay(S, '2026-10-19');
eq('Spielfrei neutral', [e.off, e.gain, e.result, e.max], [true, 0, 'off', 0]);
eq('Spielfrei: keine Karten im Konto', L.accountNow(S, '2026-10-19').count, 0);
S = mk({ '2026-10-21': { off: true, joker: true } });
eq('Joker: Woche ohne diesen Tag (5 Schultage * 9 + 2 * 6 - 9)', [L.evalDay(S, '2026-10-21').joker, L.evalWeek(S, '2026-10-19').joker, L.evalWeek(S, '2026-10-19').max], [true, '2026-10-21', 48]);
S = mk({ '2026-10-21': { off: true, joker: true, m: ALL, ev: [Y] } });
eq('Joker: Gelbe bleibt im Konto, Tore zählen nicht', [L.accountNow(S, '2026-10-21').count, L.evalDay(S, '2026-10-21').gain], [1, 0]);

// ---- Woche: Summen, Karten je Woche (keine Wochenpokale mehr) ----
const week = {};
['19', '20', '21', '22', '23'].forEach(d => { week['2026-10-' + d] = { m: ALL }; });
week['2026-10-24'] = { m: marks(WEEKEND, 'y') };
S = mk(week);
const w = L.evalWeek(S, '2026-10-19');
eq('volle Woche: 57 mögliche, 51 Tore, 6 perfekte Tage (5 Schultage + Samstag), keine Pokale', [w.max, w.goals, w.perfect, w.tiers, w.yellow, w.red], [57, 51, 6, undefined, 0, 0]);
week['2026-10-20'] = { m: ALL, ev: [Y] }; week['2026-10-22'] = { m: ALL, ev: [Y2, R] };
S = mk(week);
const w2 = L.evalWeek(S, '2026-10-19');
eq('Karten der Woche gezählt (Gelb + Gelb + automatisch Rot + Rot), Minus 1 + 1 + 3, Tore bleiben 51', [w2.yellow, w2.red, w2.minus, w2.goals], [2, 2, 5, 51]);
eq('Karten je Tag: Di Gelb, Do Gelb und zwei Rote (eine automatisch)', [L.evalDay(S, '2026-10-20').yellow, L.evalDay(S, '2026-10-22').yellow, L.evalDay(S, '2026-10-22').red], [1, 1, 2]);

// ---- Serie ----
S = mk({
  '2026-10-19': { m: ALL }, '2026-10-20': { m: ALL },
  '2026-10-21': { m: Object.assign(marks(T9, 'n'), { t_zimmer: 'y' }) },
  '2026-10-23': { m: ALL },
});
let st = L.computeStats(S, '2026-10-23');
eq('Serie, Rekord, perfekte Tage, Gesamt (ohne Karten zählt alles für die Ziele)', [st.cur, st.best, st.perfect, st.total, st.minus, st.score], [1, 2, 3, 28, 0, 28]);

// ---- Ziele: alle Tore zusammen ----
S = mk();
st = L.computeStats(S, '2026-10-19');
let gl = L.goalList(S, st);
eq('elf Ziele, Pokalfarbe nach Reihenfolge, nur das letzte ist der Fang', [gl.length, gl.map(g => g.tier[0]).join(''), gl.filter(g => g.last).map(g => g.at)], [11, 'bbbbssssggg', [500]]);
eq('Konto-Gutschrift erkannt: 5 € bei 50, 150, 250, sonst nichts', gl.filter(g => g.money).map(g => [g.at, g.money]), [[50, 500], [150, 500], [250, 500]]);
eq('Stand 0: nichts erreicht, 25 fehlen', [gl.filter(g => g.reached).length, gl[0].need, L.nextGoal(S, st).at], [0, 25, 25]);
const lots = {};
for (let i = 0; i < 3; i++) lots[L.addDays('2026-10-19', i)] = { m: ALL };        // 27 Tore
S = mk(lots); st = L.computeStats(S, '2026-10-21'); gl = L.goalList(S, st);
eq('27 Tore: Ziel 25 erreicht, nächstes 50 (23 fehlen, vorheriges 25)', [gl.filter(g => g.reached).map(g => g.at), L.nextGoal(S, st).at, L.nextGoal(S, st).need, L.nextGoal(S, st).prev], [[25], 50, 23, 25]);
S.prog.red.g25 = '2026-10-22'; L.touch(S);
eq('eingelöst wird erkannt', L.goalList(S, L.computeStats(S, '2026-10-21'))[0].done, '2026-10-22');
S = mk({ '2026-10-19': { m: ALL } }); S.cfg.goals = [{ id: 'a', at: 5, reward: '' }, { id: 'b', at: 9, reward: 'x' }]; L.touch(S);
st = L.computeStats(S, '2026-10-19');
eq('Fang gefangen beim letzten Ziel; danach kein nächstes Ziel', [st.caught, L.nextGoal(S, st), L.goalList(S, st).map(g => g.reached)], [true, null, [true, true]]);
S.cfg.goals.push({ id: 'c', at: 20, reward: 'mehr' }); L.touch(S);
st = L.computeStats(S, '2026-10-19');
eq('ein neues letztes Ziel: der Fisch ist wieder unterwegs', [st.caught, L.nextGoal(S, st).at], [false, 20]);
S = mk({ '2026-10-19': { m: ALL } });
S.prog.cel['g:g25'] = '2026-10-19'; S.prog.cel['g:g50'] = 1; L.touch(S);
eq('Erreicht-Datum kommt aus dem Merker (Text = Datum, 1 = unbekannt)', [L.computeStats(S, '2026-10-19').reachedOn('g25'), L.computeStats(S, '2026-10-19').reachedOn('g50'), L.computeStats(S, '2026-10-19').reachedOn('g75')], ['2026-10-19', null, null]);
eq('Alle Tore zählen: auch vor dem Fang und ohne Saison-Start', L.computeStats(mk({ '2026-01-05': { m: ALL } }), '2026-10-19').total, 9);

// ---- Einstellungen bereinigen und von Version 3 übernehmen ----
eq('Ziele bereinigen: sortiert, jede Zahl einmal, Unsinn fliegt raus', L.normGoals([{ id: 'x', at: 50, reward: 'b' }, { id: 'y', at: 25, reward: 'a' }, { id: 'z', at: 50, reward: 'c' }, { at: 'x' }, null, { at: -3 }], []).map(g => g.at + g.reward), ['25a', '50b', '51c']);
eq('Ziele leer: Standard', L.normGoals([], L.defaultCfg('2026-10-19').goals).length, 11);
S = mk({}, { v: 4, goals: [{ id: 'q', at: 10, reward: 'Eis' }, { id: 'r', at: 30, reward: 'Kino' }] });
eq('eigene Ziele (Version 4) bleiben', S.cfg.goals.map(g => g.at + g.reward), ['10Eis', '30Kino']);
const V3 = L.defaultCfg('2026-10-19'); V3.v = 3; delete V3.goals; V3.season = { no: 1, title: 'Mein Hecht', goal: 120, start: '2026-10-19', reward: 'x' }; V3.yellowPts = 0; V3.redPts = 2; V3.yellowExpiry = 7; V3.packEvery = undefined;
V3.tiers = [{ id: 'bronze', pct: 50, reward: 'Film' }];
V3.tasks = [
  { id: 't_notiert', icon: '📒', title: 'Hausaufgaben notiert', sub: 'Alles im Heft', pts: 1, bonus: false, days: [1, 2, 3, 4, 5] },
  { id: 't_hausaufgaben', icon: '✏️', title: 'Hausaufgaben ordentlich', sub: 'x', pts: 1, bonus: false, days: [1, 2, 3, 4, 5] },
  { id: 't_zimmer', icon: '🧹', title: 'Zimmer sauber', sub: 'Boden frei', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 't_abmachung', icon: '🤝', title: 'Abmachung eingehalten', sub: '', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 't_ehrlich', icon: '🏅', title: 'Ehrlich geblieben', sub: '', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 't_note', icon: '⭐', title: 'Gute Note geschrieben', sub: '', pts: 2, bonus: true, days: [1, 2, 3, 4, 5] },
  { id: 't_eigene', icon: '🎹', title: 'Geübt', sub: '', pts: 1, bonus: false, days: [1, 3] },
];
const M = L.migrateCfg(V3, '2026-11-20');
eq('Version 3: gleiche Nummern werden umbenannt, alte laufen aus, neue gelten ab dem Stichtag, eigene bleiben', M.tasks.map(t => t.id + (t.until ? ':aus' : '') + (t.from ? ':ab' : '')), ['t_hefte:ab', 't_notiert', 't_hausaufgaben', 't_zimmer', 't_eincremen:ab', 't_buch:ab', 't_spuelmaschine:ab', 't_tisch:ab', 't_abmachung', 't_ehrlich:aus', 't_note:aus', 't_eigene']);
eq('Version 3: Titel der übernommenen Aufgaben neu, Untertitel leer', M.tasks.filter(t => ['t_notiert', 't_zimmer', 't_abmachung'].indexOf(t.id) >= 0).map(t => t.title + '|' + t.sub), ['Hausaufgabenheft eingetragen|', 'Zimmer sauber|', 'An Abmachungen gehalten|']);
eq('Version 3: Karten (Gelb 1, Rot 3, nie verfallen), Tüte alle 6, Fischname bleibt, alte Ziele gelten nicht mehr', [M.yellowPts, M.redPts, M.yellowExpiry, M.packEvery, M.season.title, M.goals.length, M.goals[0].at, M.v], [1, 3, 0, 6, 'Mein Hecht', 11, 25, 4]);
eq('Umstellung ist unabhängig vom Datum', JSON.stringify(L.migrateCfg(V3, '2027-05-01')) === JSON.stringify(M), true);
eq('zweiter Durchlauf ändert nichts mehr', JSON.stringify(L.migrateCfg(JSON.parse(JSON.stringify(M)), '2028-01-01')) === JSON.stringify(M), true);
// Der Verlauf bleibt: Tage vor der Umstellung haben ihre alten Aufgaben und alle Tore
S = { cfg: M, prog: L.normProg(), days: { '2026-10-27': { m: { t_notiert: 'y', t_hausaufgaben: 'y', t_zimmer: 'y', t_abmachung: 'y', t_ehrlich: 'y', t_note: 'y' } } }, konto: {} };
e = L.evalDay(S, '2026-10-27');
eq('alter Tag zählt weiter (7 Tore, 6 Aufgaben, perfekt)', [e.gain, e.items.length, e.perfect], [7, 6, true]);
eq('neuer Tag: nur die neuen Gründe (Freitag)', L.evalDay(S, '2026-11-20').items.length, 9);
eq('Version 3: Fang ohne eigenen Wert → neue Ziele, Fang 500', L.computeStats(S, '2026-10-27').caught, false);

// ---- Sticker: 100 Stück, Seltenheit, Punkte ----
const cnt = { n: 0, r: 0, u: 0 };
L.STICKERS.forEach(s => { cnt[s.rar]++; });
eq('100 Sticker, eindeutige Nummern, 60 normal / 30 selten / 10 ultraselten', [L.STICKERS.length, new Set(L.STICKERS.map(s => s.id)).size, cnt], [100, 100, { n: 60, r: 30, u: 10 }]);
eq('keine doppelten Namen', new Set(L.STICKERS.map(s => s.name.replace(/­/g, ''))).size, 100);
eq('die ersten 30 Nummern sind unverändert', [L.STICKERS[0], L.STICKERS[21], L.STICKERS[29]].map(s => s.id + ' ' + s.name.replace(/­/g, '')), ['s01 Der Anstoß', 's22 Der Kapitale', 's30 Anker']);
eq('Fischarten mit Bild gibt es auch neu: Rotauge, Aal, Lachs, Wels', ['Rotauge', 'Aal', 'Lachs', 'Wels'].every(n => L.STICKERS.some(s => s.name === n)), true);
eq('Punkte: normal 1, selten 2, ultraselten 5; je 10 Punkte ein Tor', [L.RARITY.n.pts, L.RARITY.r.pts, L.RARITY.u.pts, L.PTS_PER_TOR], [1, 2, 5, 10]);
const ids = r => L.STICKERS.filter(s => s.rar === r).map(s => s.id);
S = mk(); S.prog.album = ids('n').slice(0, 7).concat(ids('r').slice(0, 1), ids('u').slice(0, 1));     // 7 + 2 + 5 = 14
eq('Sticker-Punkte und Bonus-Tore', [L.stickerPoints(S.prog), L.stickerBonus(S.prog)], [14, 1]);
st = L.computeStats(S, '2026-10-19');
eq('Bonus-Tor zählt als Tor (Gesamt), 4 Punkte fehlen bis zum nächsten', [st.total, st.stickers.pts, st.stickers.bonus, st.stickers.toNext], [1, 14, 1, 6]);
S.prog.album = L.STICKERS.map(s => s.id);
eq('Album komplett: 170 Punkte = 17 Bonus-Tore', [L.stickerPoints(S.prog), L.stickerBonus(S.prog), L.computeStats(S, '2026-10-19').packs.complete], [170, 17, true]);
S.prog.album = ['s01', 'unbekannt']; eq('unbekannte Nummer zählt als normal', L.stickerPoints(S.prog), 2);
// Ziehung: Seltene mit kleinerem Gewicht, Reihenfolge der Liste egal
const pool = [L.STICKERS.find(s => s.rar === 'n'), L.STICKERS.find(s => s.rar === 'r'), L.STICKERS.find(s => s.rar === 'u')];
const at = x => L.pickSticker(pool, () => x).rar;
eq('Ziehung nach Gewicht 12 : 4 : 1', [at(0), at(0.7), at(0.72), at(0.93), at(0.95), at(0.99999)], ['n', 'n', 'r', 'r', 'u', 'u']);
let seen = { n: 0, r: 0, u: 0 }; for (let i = 0; i < 20000; i++) seen[L.pickSticker(L.STICKERS, Math.random).rar]++;
eq('Ziehung: 100 Stück, ca. 85 % normal, 14 % selten, 1 % ultraselten', [seen.n / 200 > 80 && seen.n / 200 < 90, seen.r / 200 > 11 && seen.r / 200 < 17, seen.u / 200 > 0.3 && seen.u / 200 < 2.5], [true, true, true]);
eq('Ziehung aus einer Liste mit nur einem Sticker', L.pickSticker([L.STICKERS[5]], Math.random).id, 's06');
eq('Steckbriefe für Fische und Ultraselten', [L.factOf(L.STICKERS.find(s => s.name === 'Wels')).length > 20, L.factOf(L.STICKERS.find(s => s.rar === 'u' && s.name.indexOf('Seit') === 0)).length > 10, L.factOf(L.STICKERS[0])], [true, true, '']);

// ---- Tüten: alle N Tore eine, plus eine zum Start ----
S = mk();
eq('Willkommenstüte', L.computeStats(S, '2026-10-19').packs, { earned: 1, opened: 0, left: 1, complete: false, foil: 0, every: 6, next: 6 });
S = mk({ '2026-10-19': { m: ALL } });
eq('9 Tore: noch eine Tüte (alle 6), 3 bis zur nächsten', [L.computeStats(S, '2026-10-19').packs.earned, L.computeStats(S, '2026-10-19').packs.next], [2, 3]);
S = mk(week);
eq('volle Woche (51 Tore): 1 + 8 Tüten', L.computeStats(S, '2026-10-25').packs.earned, 9);
S.prog.album = ['s01', 's02'];
eq('geöffnete zählen ab', L.computeStats(S, '2026-10-25').packs.left, 7);
S = mk({ '2026-10-19': { m: ALL } }, { v: 4, packEvery: 3 });
eq('Abstand einstellbar', L.computeStats(S, '2026-10-19').packs.earned, 4);
S = mk({ '2026-10-19': { m: ALL } }, { v: 4, packEvery: 1 });
eq('Abstand mindestens 3', S.cfg.packEvery, 3);
const allIds = L.STICKERS.map(s => s.id);
eq('Album voll: weiter Tüten für Glanz-Versionen, danach keine', [L.packsLeft(299, allIds, []), L.packsLeft(299, allIds, allIds)], [199, 0]);
S = mk(); S.prog.album = ids('n').concat(ids('r'), ids('u')).slice(0, 12);
const tBefore = L.computeStats(S, '2026-10-19').total;
eq('Bonus-Tore aus Stickern erhöhen die Zahl der Tüten nicht über sich selbst hinaus (kein Teufelskreis)', L.computeStats(S, '2026-10-19').packs.earned, 1 + Math.floor(tBefore / 6));

// ---- Tagesleiter ----
eq('Leiter', [1, 2, 3, 4, 5].map(n => L.ladderText(n, false)), ['Tor!', 'Doppelpack!', 'Hattrick!', 'Viererpack!', 'Fünferpack!']);
eq('Weiße Weste', L.ladderText(3, true), 'Weiße Weste!');

// ---- Zukunft bleibt aus der Statistik ----
S = mk({ '2026-10-19': { m: ALL }, '2026-10-30': { m: ALL } });
eq('Zukunft ignoriert', L.computeStats(S, '2026-10-22').total, 9);

// ---- Neue / ausgeblendete Aufgaben ----
S = mk({ '2026-10-20': { m: Object.assign({}, ALL) } });
S.cfg.tasks.push({ id: 't_neu', icon: '🎒', title: 'Tasche gepackt', sub: '', pts: 1, bonus: false, days: [1, 2, 3, 4, 5], from: '2026-10-21' }); L.touch(S);
eq('neue Aufgabe nicht rückwirkend', L.evalDay(S, '2026-10-20').max, 9);
eq('neue Aufgabe ab Datum', L.evalDay(S, '2026-10-21').max, 10);
S.cfg.tasks.find(t => t.id === 't_zimmer').until = '2026-10-21'; L.touch(S);
eq('ausgeblendet ab Datum', [L.evalDay(S, '2026-10-21').max, L.evalDay(S, '2026-10-20').max], [9, 9]);

// ---- Abmachung der Woche ersetzt den Untertitel ----
S = mk();
const ab = S.cfg.tasks.find(t => t.id === 't_abmachung');
eq('Abmachung als Untertitel', [L.taskSub(S.cfg, ab), (S.cfg.agreement = 'Nach dem Essen Tablet abgeben', L.taskSub(S.cfg, ab))], ['', 'Nach dem Essen Tablet abgeben']);

// ---- Hinweise für den Trainer ----
S = mk({ '2026-11-05': { ev: [R] }, '2026-11-07': { ev: [{ k: 'r', id: 'r9' }] } });
eq('zwei Rote in 7 Tagen', L.coachAdvice(S, '2026-11-09').filter(a => a.kind === 'reds'), [{ kind: 'reds', n: 2 }]);
S = mk({ '2026-11-09': { ev: [R] } });
eq('eine Rote: keine Warnung', L.coachAdvice(S, '2026-11-09').filter(a => a.kind === 'reds').length, 0);
S = mk(lots);                                                   // 27 Tore → Ziel 25
eq('Ziel ohne Datum (alter Stand): keine Mahnung', L.coachAdvice(S, '2026-11-30').filter(a => a.kind === 'open').length, 0);
S.prog.cel['g:g25'] = '2026-10-21'; L.touch(S);
eq('Ziel erreicht und nach 7 Tagen nicht eingelöst: Hinweis', L.coachAdvice(S, '2026-10-28').filter(a => a.kind === 'open').map(a => [a.id, a.at, a.since]), [['g25', 25, '2026-10-21']]);
eq('zu früh: keine Mahnung', L.coachAdvice(S, '2026-10-27').filter(a => a.kind === 'open').length, 0);
S.prog.red.g25 = '2026-10-25'; L.touch(S);
eq('eingelöst: keine Mahnung', L.coachAdvice(S, '2026-11-30').filter(a => a.kind === 'open').length, 0);
S = mk(); S.prog.album = L.STICKERS.map(s => s.id);
eq('Album komplett: Hinweis', L.coachAdvice(S, '2026-11-09').some(a => a.kind === 'album'), true);
S = mk();
eq('Abmachung fehlt: Hinweis, danach nicht mehr', [L.coachAdvice(S, '2026-10-21').some(a => a.kind === 'agreement'), (S.cfg.agreement = 'Tablet nach dem Essen abgeben', L.coachAdvice(S, '2026-10-21').some(a => a.kind === 'agreement'))], [true, false]);

// ---- Einspruch gibt es nicht mehr; alte Vermerke in gespeicherten Tagen schaden nicht ----
S = mk({ '2026-10-20': { m: { t_zimmer: 'n' }, ap: { 'm:t_zimmer': 'open' } } });
eq('alter Einspruchsvermerk ändert nichts, die Funktion ist weg', [L.evalDay(S, '2026-10-20').rival, L.evalDay(S, '2026-10-20').bad, L.appealCount], [1, 1, undefined]);

// ---- Minus: Die Übersicht zeigt alle Tore, Ziele und Fang rechnen mit Abzug ----
const fresh = o => JSON.parse(JSON.stringify(o));                  // mk() verwendet das übergebene Objekt selbst: Kopie, damit die Tests sich nicht gegenseitig verändern
S = mk(fresh(lots));                                                       // 27 Tore an drei Schultagen, Ziel 25 erreicht
st = L.computeStats(S, '2026-10-21');
eq('ohne Karten: Gesamt = zählt für die Ziele', [st.total, st.minus, st.score, L.goalList(S, st)[0].reached], [27, 0, 27, true]);
S.days['2026-10-21'].ev = [R]; L.touch(S);
st = L.computeStats(S, '2026-10-21');
eq('mit Rot: Gesamt bleibt 27, Minus 3, für die Ziele zählen 24', [st.total, st.minus, st.score], [27, 3, 24]);
gl = L.goalList(S, st);
eq('Ziel 25 ist wieder offen: noch 1 Tor; nächstes Ziel ist 25', [gl[0].reached, gl[0].need, L.nextGoal(S, st).at, L.nextGoal(S, st).need, L.nextGoal(S, st).prev], [false, 1, 25, 1, 0]);
eq('der Spielstand des Tages und die Wochenzahl bleiben brutto (9:0, 27 Tore)', [L.evalDay(S, '2026-10-21').gain, L.evalDay(S, '2026-10-21').rival, L.evalWeek(S, '2026-10-19').goals], [9, 0, 27]);
eq('Sticker-Tüten zählen nach den gesamten Toren, nicht nach dem Rest', [L.computeStats(S, '2026-10-21').packs.earned, L.computeStats(S, '2026-10-21').packs.next], [1 + Math.floor(27 / 6), 6 - (27 % 6)]);
S.days['2026-10-21'].ev = [Y]; L.touch(S);
eq('Gelb: Minus 1, 26 zählen, Ziel 25 bleibt erreicht', [L.computeStats(S, '2026-10-21').score, L.goalList(S, L.computeStats(S, '2026-10-21'))[0].reached], [26, true]);
S.days['2026-10-21'].ev = [R]; S.prog.red.g25 = '2026-10-22'; L.touch(S);
gl = L.goalList(S, L.computeStats(S, '2026-10-21'));
eq('ein eingelöstes Ziel bleibt erreicht, auch wenn Minus darunter fällt', [gl[0].reached, gl[0].done, gl[0].need], [true, '2026-10-22', 1]);
S = mk({ '2026-10-19': { m: ALL } }); S.cfg.goals = [{ id: 'a', at: 5, reward: '' }, { id: 'b', at: 9, reward: 'x' }]; S.days['2026-10-19'].ev = [R]; L.touch(S);
st = L.computeStats(S, '2026-10-19');
eq('Fang mit Minus: 9 Tore, Minus 3, 6 zählen: Ziel a ja, Fang nein', [st.total, st.score, st.caught, L.goalList(S, st).map(g => g.reached), L.nextGoal(S, st).need], [9, 6, false, [true, false], 3]);
S.prog.red.b = '2026-10-20'; L.touch(S);
eq('Fang eingelöst: bleibt gefangen', L.computeStats(S, '2026-10-19').caught, true);
S = mk({ '2026-10-19': { ev: [R] } });
st = L.computeStats(S, '2026-10-19');
eq('Minus vor dem ersten Tor: Gesamt 0, zählt −3, bis Ziel 25 fehlen 28', [st.total, st.score, L.goalList(S, st)[0].need, L.goalList(S, st).filter(g => g.reached).length], [0, -3, 28, 0]);
S = mk(fresh(lots)); S.prog.album = ids('n').slice(0, 10);                  // 10 Sticker-Punkte = 1 Bonus-Tor, auch das zählt für die Ziele
S.days['2026-10-21'].ev = [R]; L.touch(S);
st = L.computeStats(S, '2026-10-21');
eq('Bonus-Tore der Sticker zählen mit: Gesamt 28, Minus 3, zählt 25 (Ziel 25 genau erreicht)', [st.total, st.minus, st.score, L.goalList(S, st)[0].reached], [28, 3, 25, true]);
S = mk(fresh(lots));
const mBefore = L.milestones(S, '2026-10-21', '2026-10-21');
S.days['2026-10-21'].ev = [R]; L.touch(S);
const mAfter = L.milestones(S, '2026-10-21', '2026-10-21');
eq('Meilenstein: ein Rot nimmt das Ziel 25 wieder weg', [mBefore.goals, mAfter.goals, mAfter.total, mAfter.score], [['g25'], [], 27, 24]);

// ---- Konto (Guthaben) ----
const NBSP = ' ';
eq('fmtEUR', [L.fmtEUR(0), L.fmtEUR(250), L.fmtEUR(1205), L.fmtEUR(-300), L.fmtEUR(5)], ['0,00' + NBSP + '€', '2,50' + NBSP + '€', '12,05' + NBSP + '€', '−3,00' + NBSP + '€', '0,05' + NBSP + '€']);
eq('fmtPlain', [L.fmtPlain(500), L.fmtPlain(1205), L.fmtPlain(5)], ['5,00', '12,05', '0,05']);
eq('parseMoney: Komma, Punkt, Euro-Zeichen, Grenzen', ['5', '2,5', '2.50', '€ 3', '0', '-2', 'abc', '1000', '1000,01', '12345', '0,05', '+4', '', '3,456'].map(L.parseMoney), [500, 250, 250, 300, null, null, null, 100000, null, null, 5, 400, null, null]);
eq('genitive', [L.genitive('Ben'), L.genitive('Max'), L.genitive('Lukas'), L.genitive('Moritz')], ['Bens', 'Max’', 'Lukas’', 'Moritz’']);
eq('Standard: 5, 3, 2 Euro für Note 1 bis 3', [L.migrateCfg({}, '2026-10-19').noteMoney, L.migrateCfg({ name: 'Ben' }, '2026-10-19').noteMoney[1]], [{ 1: 500, 2: 300, 3: 200, 4: 0, 5: 0, 6: 0 }, 500]);
eq('Beträge je Note: eigene Werte bleiben, Unsinn wird 0, Obergrenze 20 €', L.migrateCfg({ noteMoney: { 1: 700, 4: -5, 5: 'x', 6: 999999 } }, '2026-10-19').noteMoney, { 1: 700, 2: 300, 3: 200, 4: 0, 5: 0, 6: 2000 });
S = mk(); S.konto = { a: { ts: 3, c: 500 }, b: { ts: 1, c: -150 }, c: { ts: 2, c: 300 }, d: { ts: 5, c: 'x' } };
eq('Guthaben: Summe in Cent, kaputte Werte zählen 0', L.kontoBalance(S), 650);
eq('Buchungen: neueste zuerst', L.kontoList(S).map(e => e.id), ['d', 'a', 'c', 'b']);
eq('ohne Konto: 0 und leer', [L.kontoBalance({}), L.kontoList({}).length, L.kontoBalance(mk())], [0, 0, 0]);
eq('Belohnung mit Betrag aufs Konto', ['5 € aufs Guthabenkonto', '2,50 Euro auf das Konto', '10 € aufs Konto', 'Zum Asiamarkt nach Mühldorf inkl. 20 € Guthaben', 'Fußballpack', '', null].map(L.rewardMoney), [500, 250, 1000, 0, 0, 0, 0]);

// ---- Meilensteine ----
S = mk({ '2026-10-19': { m: { t_hefte: 'y' } } });
const before = L.milestones(S, '2026-10-19', '2026-10-19');
S.days['2026-10-19'].m = ALL; L.touch(S);
const after = L.milestones(S, '2026-10-19', '2026-10-19');
eq('Meilenstein: perfekter Tag, Tüte, noch kein Ziel', [before.perfect, after.perfect, after.packs - before.packs, after.ok, after.goals], [false, true, 1, 9, []]);
S.days['2026-10-20'] = { m: ALL }; S.days['2026-10-21'] = { m: ALL }; L.touch(S);
eq('Meilenstein: 27 Tore erreichen das Ziel bei 25', [L.milestones(S, '2026-10-21', '2026-10-21').goals, L.milestones(S, '2026-10-21', '2026-10-21').caught], [['g25'], false]);

console.log(fail ? `\n${fail} FEHLER, ${pass} ok` : `alle ${pass} Prüfungen ok`);
process.exit(fail ? 1 : 0);
