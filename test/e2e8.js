// Minispiele: Spielzeit aus den Toren von gestern (ab 14 Uhr), Uhr im Spielfenster, Abpfiff, Bonusspiel Endgegner,
// alle sieben Spiele starten, Trainer-Test ohne Uhr, Schalter im Trainer-Bereich, Regelbuch.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = 'file://' + path.resolve('build/torjaeger.test.html');
const errs = [];
let bad = 0;
const ok = (name, cond, info) => { if (!cond) bad++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? ' | ' + info : '')); };
const T9 = ['t_hefte', 't_notiert', 't_hausaufgaben', 't_zimmer', 't_eincremen', 't_buch', 't_spuelmaschine', 't_tisch', 't_abmachung'];
const marks = (ids, v) => Object.fromEntries(ids.map(id => [id, v]));
// Do 12.11.2026: 7 Tore, 2 Kein Tor -> Fr 13.11.: 7 Minuten Minispiele, 2 Minuten Endgegner
const YDAY = { 'days/2026-11-12': { m: Object.assign(marks(T9.slice(0, 7), 'y'), marks(T9.slice(7), 'n')) } };
const BASE = over => Object.assign({
  'cfg/main': { name: 'Ben', rival: 'Sofa United', cardsAck: true, shootMode: false },
  'cfg/progress': { cel: {}, red: {}, seasons: [], album: [], foil: [], pick: {} },
}, YDAY, over || {});
async function open(b, preload, now) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.addInitScript(d => { window.__preload = d; }, preload);
  await page.addInitScript(fs.readFileSync('test/mock-claude.js', 'utf8'));
  await page.clock.setFixedTime(new Date(now || '2026-11-13T15:00:00'));
  await page.goto(URL); await page.waitForTimeout(900);
  return page;
}
const H = page => ({
  txt: sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/[\s ]+/g, ' ').trim() : null; }, sel),
  cnt: sel => page.evaluate(s => document.querySelectorAll(s).length, sel),
  wait: ms => page.waitForTimeout(ms),
  store: key => page.evaluate(k => { const v = window.__mock.store.get(k); return v === undefined ? null : JSON.parse(JSON.stringify(v)); }, key),
  game: () => page.evaluate(() => (window.__game ? { id: window.__game.id, phase: window.__game.phase } : null)),
});

(async () => {
  const b = await chromium.launch();

  // ---- A) vor 14 Uhr: Minuten stehen da, Spiele sind zu ----
  let page = await open(b, BASE(), '2026-11-13T11:30:00'), h = H(page);
  const card = await h.txt('.games');
  ok('A Karte Minispiele mit 7 Minuten für 7 Tore und 2 Minuten Endgegner', /7 Minuten/.test(card) && /für 7 Tore gestern/.test(card) && /2 Minuten/.test(card) && /2 Tore des Gegners/.test(card), card);
  ok('A Hinweis: ab 14 Uhr', /ab 14 Uhr los/.test(card), card);
  ok('A sechs Spiele plus Endgegner, alle gesperrt', await h.cnt('.games .gtile') === 7 && await h.cnt('.games .gtile.off') === 7 && await h.cnt('.gtile.boss') === 1);
  await page.click('.gtile[data-game="memory"]', { force: true }); await h.wait(300);
  ok('A Antippen vor 14 Uhr: Hinweis statt Spiel', !(await h.game()) && /ab 14 Uhr/.test(await h.txt('#toast')), await h.txt('#toast'));
  await page.close();

  // ---- B) ab 14 Uhr: Spiel öffnen, Uhr läuft, Verbrauch wird gespeichert ----
  page = await open(b, BASE()); h = H(page);
  ok('B um 15 Uhr: alle Spiele offen', await h.cnt('.games .gtile.off') === 0);
  await page.click('.gtile[data-game="memory"]'); await h.wait(400);
  ok('B Memory offen: 16 Karten, Uhr zeigt 7:00', await h.cnt('.mcard') === 16 && /7:00/.test(await h.txt('#gclock')), await h.txt('#gclock'));
  await h.wait(3200);
  const clk = await h.txt('#gclock');
  ok('B Uhr zählt herunter', /6:5[5-8]/.test(clk), clk);
  await page.click('.g-x'); await h.wait(500);
  const play = await h.store('cfg/play');
  ok('B Schließen speichert den Verbrauch (cfg/play, Minispiele)', play && play.d === '2026-11-13' && play.r >= 2 && play.r <= 5 && play.b === 0, JSON.stringify(play));
  ok('B Karte zeigt die übrige Zeit', /Noch 6:5\d/.test(await h.txt('.pt-box.reg')), await h.txt('.pt-box.reg'));
  // Memory zu Ende spielen
  await page.click('.gtile[data-game="memory"]'); await h.wait(300);
  await page.evaluate(async () => {
    const g = window.__game, byV = {};
    g.cards.forEach((c, i) => { (byV[c.v] = byV[c.v] || []).push(i); });
    for (const v of Object.keys(byV)) { for (const i of byV[v]) document.querySelector('.mcard[data-i="' + i + '"]').click(); await new Promise(r => setTimeout(r, 320)); }
  });
  await h.wait(500);
  ok('B Memory gelöst: 8 Züge, Nochmal-Knopf', /Alle Paare gefunden/.test(await h.txt('#gfoot')) && /8 Züge/.test(await h.txt('#gfoot')), await h.txt('#gfoot'));
  await page.click('.g-x'); await h.wait(400);
  ok('B Rekord im Spielzeit-Dokument', ((await h.store('cfg/play')).best || {}).memory === 8, JSON.stringify(await h.store('cfg/play')));
  await page.close();

  // ---- C) Zeit läuft ab: Abpfiff, danach gesperrt; Endgegner hat eigene Zeit ----
  page = await open(b, BASE({ 'cfg/play': { d: '2026-11-13', r: 418, b: 0 } })); h = H(page);
  ok('C Karte: noch 0:02', /Noch 0:02/.test(await h.txt('.pt-box.reg')), await h.txt('.pt-box.reg'));
  await page.click('.gtile[data-game="elfer"]'); await h.wait(3600);
  ok('C Abpfiff nach Ablauf', /Abpfiff/.test(await h.txt('.sheet')) && /Spielzeit ist um/.test(await h.txt('.sheet')) && !(await h.game()), await h.txt('.sheet'));
  ok('C Hinweis auf übrige Endgegner-Zeit', /2:00 für den Endgegner/.test(await h.txt('.sheet')), await h.txt('.sheet'));
  await page.click('.sheet [data-act="sheet-close"]'); await h.wait(400);
  ok('C Minispiele gesperrt, Endgegner offen', await h.cnt('.gtiles .gtile.off') === 6 && await h.cnt('.gtile.boss.off') === 0);
  ok('C Verbrauch gespeichert: 420 s', (await h.store('cfg/play')).r === 420, JSON.stringify(await h.store('cfg/play')));
  await page.click('.gtile[data-game="elfer"]', { force: true }); await h.wait(300);
  ok('C gesperrtes Spiel öffnet nicht', !(await h.game()) && /keine Spielzeit mehr/.test(await h.txt('#toast')), await h.txt('#toast'));
  // Endgegner: Bonuszeit zählt getrennt
  await page.click('.gtile[data-game="boss"]'); await h.wait(300);
  ok('C Endgegner: Uhr 2:00, Startbild', /2:00/.test(await h.txt('#gclock')) && /Endgegner/.test(await h.txt('.sheet')), await h.txt('#gclock'));
  await page.click('[data-act="boss-go"]'); await h.wait(2300);
  const bt = await h.txt('#bsT');
  ok('C Endgegner läuft (Sekunden zählen) oder ist schon abgegrätscht', /^\d,\d$/.test(bt) && (+bt.replace(',', '.') >= 1.5 || (await h.game()).phase === 'over'), bt);
  await page.click('.g-x'); await h.wait(400);
  const pb = await h.store('cfg/play');
  ok('C Endgegner verbraucht Bonuszeit, nicht die Minispiele', pb.b >= 1 && pb.b <= 4 && pb.r === 420, JSON.stringify(pb));
  await page.close();

  // ---- D) Rote Karte gestern: keine Minuten für Tore ----
  page = await open(b, BASE({ 'days/2026-11-14': { m: marks(T9.slice(3, 7), 'y'), ev: [{ k: 'r', id: 'r1' }] } }), '2026-11-15T16:00:00'); h = H(page);
  ok('D Rot gestern: 0 Minuten Minispiele', /0 Minuten/.test(await h.txt('.pt-box.reg')) && await h.cnt('.gtiles .gtile.off') === 6, await h.txt('.pt-box.reg'));
  await page.close();

  // ---- E) Trainer-Test: alle Spiele ohne Uhr, jedes startet ohne Fehler ----
  page = await open(b, BASE({ 'days/2026-11-12': {} }), '2026-11-13T09:00:00'); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(300);
  ok('E Trainer: Spiele offen trotz 9 Uhr und 0 Minuten', await h.cnt('.games .gtile.off') === 0 && /Trainer-Modus/.test(await h.txt('.pt-note')));
  const starts = { elfer: null, keeper: 'keep-go', memory: null, cups: null, juggle: 'jug-go', rechnen: 'math-go', boss: 'boss-go' };
  for (const id of Object.keys(starts)) {
    await page.click('.gtile[data-game="' + id + '"]'); await h.wait(300);
    const clock = await h.txt('#gclock');
    if (starts[id]) { await page.click('[data-act="' + starts[id] + '"]'); }
    await h.wait(900);
    const g = await h.game();
    ok('E ' + id + ': läuft, Uhr „Trainer-Test“', g && g.id === id && /Trainer-Test/.test(clock), JSON.stringify(g) + ' ' + clock);
    await page.click('.g-x'); await h.wait(250);
  }
  ok('E Trainer-Test verbraucht keine Zeit', !(await h.store('cfg/play')) || (await h.store('cfg/play')).r === 0);
  // Elfmeter: ein Schuss zählt
  await page.click('.gtile[data-game="elfer"]'); await h.wait(300);
  await page.click('#elfGoal', { position: { x: 20, y: 30 } }); await h.wait(1500);
  ok('E Elfmeter: Schuss 2 von 10, Ergebnis angezeigt', (await h.txt('#elfS')) === '2' && /Tor!|Gehalten!|Nächster Schuss/.test(await h.txt('#gfoot')), await h.txt('#gfoot'));
  await page.click('.g-x'); await h.wait(250);
  // Rechen-Elfer: richtige Antwort = Tor
  await page.click('.gtile[data-game="rechnen"]'); await h.wait(300);
  await page.click('[data-act="math-go"]'); await h.wait(200);
  const r = await page.evaluate(() => window.__game.task.r);
  await page.click('.math-o[data-v="' + r + '"]'); await h.wait(500);
  ok('E Rechen-Elfer: richtige Antwort = 1 Tor, neue Aufgabe', (await h.txt('#mtG')) === '1' && await h.cnt('.math-o') === 3);
  await page.click('.g-x'); await h.wait(250);
  // Hochhalten: ohne Tippen fällt der Ball
  await page.click('.gtile[data-game="juggle"]'); await h.wait(300);
  await page.click('[data-act="jug-go"]'); await h.wait(2500);
  ok('E Hochhalten: Ball fällt ohne Tippen, Spiel vorbei', (await h.game()).phase === 'over' && /0-mal hochgehalten/.test(await h.txt('#gfoot')), await h.txt('#gfoot'));
  await page.click('.g-x'); await h.wait(250);
  // Hütchen: Mischen endet mit Wahl
  await page.click('.gtile[data-game="cups"]'); await h.wait(4800);
  ok('E Hütchen: nach dem Mischen wählbar', (await h.game()).phase === 'pick' && await page.evaluate(() => !document.querySelector('.cup').disabled));
  const ball = await page.evaluate(() => window.__game.ball);
  await page.click('.cup[data-cup="' + ball + '"]', { force: true }); await h.wait(400);
  ok('E Hütchen: richtig getippt = gefunden', /Gefunden/.test(await h.txt('#gfoot')), await h.txt('#gfoot'));
  await page.click('.g-x'); await h.wait(250);
  // Schalter im Trainer-Bereich und Regelbuch
  await page.click('[data-act="tab"][data-tab="coach"]'); await h.wait(300);
  ok('E Schalter „Minispiele auf Heute“ im Trainer-Bereich', /Minispiele auf „Heute“/.test(await h.txt('main')));
  await page.click('[data-act="games-toggle"]'); await h.wait(300);
  ok('E Schalter speichert games: false', (await h.store('cfg/main')).games === false);
  await page.click('[data-act="tab"][data-tab="today"]'); await h.wait(300);
  ok('E ausgeschaltet: keine Minispiele auf Heute', await h.cnt('.games') === 0);
  await page.click('[data-act="tab"][data-tab="coach"]'); await h.wait(300);
  await page.click('[data-act="rules"]'); await h.wait(300);
  ok('E Regelbuch erklärt die Minispiele', /Minispiele/.test(await h.txt('.sheet')) && /1 Minute/.test(await h.txt('.sheet')) && /14 Uhr/.test(await h.txt('.sheet')));
  await page.close();

  // ---- F) Endgegner wird nach 30 Sekunden kaum schaffbar (rechnerisch, ohne 40 s zu warten) ----
  page = await open(b, BASE()); h = H(page);
  await page.click('.gtile[data-game="boss"]'); await h.wait(300);
  await page.click('[data-act="boss-go"]');
  // Uhr des Spiels vorstellen: Startzeit 34 s zurück, dann ohne Ausweichen höchstens kurz überleben
  await page.evaluate(() => { const g = window.__game; g.t0 -= 34000; });
  await h.wait(1500);
  const g2 = await page.evaluate(() => ({ phase: window.__game && window.__game.phase, rows: window.__game && window.__game.rows.length }));
  ok('F Endgegner nach 34 s: sofort abgegrätscht', g2.phase === 'over' && /Abgegrätscht nach 3\d,\d Sekunden/.test(await h.txt('#gfoot')), JSON.stringify(g2) + ' ' + await h.txt('#gfoot'));
  await page.close();

  console.log(errs.length ? 'FEHLER im Browser:\n' + errs.join('\n') : 'ok   keine Konsolenfehler');
  console.log(bad ? '\n' + bad + ' Prüfung(en) fehlgeschlagen' : '\nalle Prüfungen ok');
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
