// Minispiele: Spielzeit aus den Toren von gestern (ab 14 Uhr), Uhr im Spielfenster, Abpfiff, Bonusspiele (Endgegner, Meteoritenhagel),
// alle sieben Spiele starten und lassen sich bedienen, Trainer-Test ohne Uhr, Schalter im Trainer-Bereich, Regelbuch.
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
  ok('A Karte Minispiele mit 7 Minuten für 7 Tore und 2 Minuten Bonusspiele', /7 Minuten/.test(card) && /für 7 Tore gestern/.test(card) && /2 Minuten/.test(card) && /2 Tore des Gegners/.test(card), card);
  ok('A Hinweis: ab 14 Uhr', /ab 14 Uhr los/.test(card), card);
  ok('A fünf Spiele plus zwei Bonusspiele, alle gesperrt', await h.cnt('.gtiles .gtile') === 5 && await h.cnt('.gbonus .gtile.boss') === 2 && await h.cnt('.games .gtile.off') === 7);
  await page.click('.gtile[data-game="angeln"]', { force: true }); await h.wait(300);
  ok('A Antippen vor 14 Uhr: Hinweis statt Spiel', !(await h.game()) && /ab 14 Uhr/.test(await h.txt('#toast')), await h.txt('#toast'));
  await page.close();

  // ---- B) ab 14 Uhr: Spiel öffnen, Uhr läuft, Verbrauch wird gespeichert ----
  page = await open(b, BASE()); h = H(page);
  ok('B um 15 Uhr: alle Spiele offen', await h.cnt('.games .gtile.off') === 0);
  await page.click('.gtile[data-game="angeln"]'); await h.wait(400);
  ok('B Angeln offen: Leinwand, Startbild, Uhr zeigt 7:00', await h.cnt('.gcv') === 1 && /Petri Heil/.test(await h.txt('.g-ovl')) && /7:00/.test(await h.txt('#gclock')), await h.txt('#gclock'));
  await h.wait(3200);
  const clk = await h.txt('#gclock');
  ok('B Uhr zählt herunter', /6:5[5-8]/.test(clk), clk);
  await page.click('.g-x'); await h.wait(500);
  const play = await h.store('cfg/play');
  ok('B Schließen speichert den Verbrauch (cfg/play, Minispiele)', play && play.d === '2026-11-13' && play.r >= 2 && play.r <= 5 && play.b === 0, JSON.stringify(play));
  ok('B Karte zeigt die übrige Zeit', /Noch 6:5\d/.test(await h.txt('.pt-box.reg')), await h.txt('.pt-box.reg'));
  // Hochhalten: ohne Tippen fällt der Ball, Ergebnis wird als Rekord gemerkt
  await page.click('.gtile[data-game="juggle"]'); await h.wait(300);
  await page.click('[data-act="jug-go"]'); await h.wait(2600);
  ok('B Hochhalten: Ball fällt ohne Tippen, Spiel vorbei', (await h.game()).phase === 'over' && /0 Punkte/.test(await h.txt('#gfoot')), await h.txt('#gfoot'));
  await page.click('.g-x'); await h.wait(400);
  ok('B Rekord im Spielzeit-Dokument', ((await h.store('cfg/play')).best || {}).juggle === 0, JSON.stringify(await h.store('cfg/play')));
  await page.close();

  // ---- C) Zeit läuft ab: Abpfiff, danach gesperrt; Endgegner hat eigene Zeit ----
  page = await open(b, BASE({ 'cfg/play': { d: '2026-11-13', r: 418, b: 0 } })); h = H(page);
  ok('C Karte: noch 0:02', /Noch 0:02/.test(await h.txt('.pt-box.reg')), await h.txt('.pt-box.reg'));
  await page.click('.gtile[data-game="elfer"]'); await h.wait(3600);
  ok('C Abpfiff nach Ablauf', /Abpfiff/.test(await h.txt('.sheet')) && /Spielzeit ist um/.test(await h.txt('.sheet')) && !(await h.game()), await h.txt('.sheet'));
  ok('C Hinweis auf übrige Bonus-Zeit', /2:00 für die Bonusspiele/.test(await h.txt('.sheet')), await h.txt('.sheet'));
  await page.click('.sheet [data-act="sheet-close"]'); await h.wait(400);
  ok('C Minispiele gesperrt, Bonusspiele offen', await h.cnt('.gtiles .gtile.off') === 5 && await h.cnt('.gbonus .gtile.off') === 0);
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
  ok('D Rot gestern: 0 Minuten Minispiele', /0 Minuten/.test(await h.txt('.pt-box.reg')) && await h.cnt('.gtiles .gtile.off') === 5, await h.txt('.pt-box.reg'));
  await page.close();

  // ---- E) Trainer-Test: alle Spiele ohne Uhr, jedes startet ohne Fehler ----
  page = await open(b, BASE({ 'days/2026-11-12': {} }), '2026-11-13T09:00:00'); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(300);
  ok('E Trainer: Spiele offen trotz 9 Uhr und 0 Minuten', await h.cnt('.games .gtile.off') === 0 && /Trainer-Modus/.test(await h.txt('.pt-note')));
  const starts = { juggle: 'jug-go', elfer: 'elf-go', angeln: 'fish-go', raubfisch: 'raub-go', sprung: 'jump-go', boss: 'boss-go', meteor: 'met-go' };
  for (const id of Object.keys(starts)) {
    await page.click('.gtile[data-game="' + id + '"]'); await h.wait(300);
    const clock = await h.txt('#gclock');
    await page.click('[data-act="' + starts[id] + '"]');
    await h.wait(700);
    const g = await h.game();
    ok('E ' + id + ': läuft, Uhr „Trainer-Test“', g && g.id === id && g.phase !== 'ready' && /Trainer-Test/.test(clock), JSON.stringify(g) + ' ' + clock);
    await page.click('.g-x'); await h.wait(250);
  }
  ok('E Trainer-Test verbraucht keine Zeit', !(await h.store('cfg/play')) || (await h.store('cfg/play')).r === 0);
  const box = async () => page.evaluate(() => { const r = document.querySelector('.gcv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  // Elfmeter: Wischen vom Ball nach oben = Schuss, Ergebnis wird gezählt
  await page.click('.gtile[data-game="elfer"]'); await h.wait(300); await page.click('[data-act="elf-go"]'); await h.wait(200);
  let bx = await box();
  await page.mouse.move(bx.x + bx.w / 2, bx.y + bx.h * .84); await page.mouse.down();
  for (let k = 1; k <= 5; k++) { await page.mouse.move(bx.x + bx.w / 2 + 14 * k, bx.y + bx.h * .84 - 34 * k); await h.wait(25); }
  await page.mouse.up(); await h.wait(1300);
  const el = await page.evaluate(() => ({ goals: __game.goals, misses: __game.misses }));
  ok('E Elfmeter: Wischen schießt, Tor oder Fehlschuss gezählt', el.goals + el.misses === 1, JSON.stringify(el));
  await page.click('.g-x'); await h.wait(250);
  // Angeln: auswerfen, Biss, anhauen, drillen, Fang mit Gewicht und Rekord
  await page.click('.gtile[data-game="angeln"]'); await h.wait(300); await page.click('[data-act="fish-go"]'); await h.wait(300);
  bx = await box();
  await page.mouse.click(bx.x + bx.w / 2, bx.y + bx.h / 2); await h.wait(900);
  ok('E Angeln: ausgeworfen, Pose im Wasser', (await h.game()).phase === 'wait');
  const ba = await page.evaluate(() => __game.biteAt);
  await page.mouse.click(bx.x + bx.w / 2, bx.y + bx.h / 2); await h.wait(300);
  ok('E Angeln: zu früh angehauen = nur Warnung, der Biss kommt später', (await h.game()).phase === 'wait' && (await page.evaluate(() => __game.biteAt)) > ba);
  await page.evaluate(() => { __game.biteAt = __game.t + .1; __game.nibAt = __game.t + 50; }); await h.wait(300);
  await page.mouse.move(bx.x + bx.w / 2, bx.y + bx.h / 2); await page.mouse.down(); await h.wait(300);
  ok('E Angeln: beim Biss angehauen = Drill', (await h.game()).phase === 'fight');
  await page.evaluate(() => { __game.fish.D = .02; __game.fish.T = .4; }); await h.wait(400); await page.mouse.up();
  ok('E Angeln: eingeholt = Fang mit Art und Gewicht', (await h.game()).phase === 'caught' && /Weiter angeln/.test(await h.txt('.g-ovl')) && /\d+(,\d+)? (kg|g)/.test(await h.txt('.g-ovl')), await h.txt('.g-ovl'));
  ok('E Angeln: schwerster Fisch als Rekord in Gramm', ((await h.store('cfg/play')).best || {}).angeln > 0, JSON.stringify(await h.store('cfg/play')));
  await page.click('[data-act="fish-next"]'); await h.wait(200);
  ok('E Angeln: weiter angeln', (await h.game()).phase === 'aim');
  await page.click('.g-x'); await h.wait(250);
  // Fischsprung: ohne Tippen sinkt die Forelle auf den Grund
  await page.click('.gtile[data-game="sprung"]'); await h.wait(300); await page.click('[data-act="jump-go"]'); await h.wait(2200);
  ok('E Fischsprung: ohne Tippen auf dem Grund, Spiel vorbei', (await h.game()).phase === 'over' && /Punkte/.test(await h.txt('#gfoot')), await h.txt('#gfoot'));
  await page.click('.g-x'); await h.wait(250);
  // Raubfisch: Finger hält, Hecht schwimmt hin
  await page.click('.gtile[data-game="raubfisch"]'); await h.wait(300); await page.click('[data-act="raub-go"]'); await h.wait(200);
  bx = await box();
  const x0 = await page.evaluate(() => __game.me.x);
  await page.mouse.move(bx.x + bx.w - 20, bx.y + bx.h / 2); await page.mouse.down(); await h.wait(700); await page.mouse.up();
  ok('E Raubfisch: Hecht schwimmt zum Finger', (await page.evaluate(() => __game.me.x)) > x0 + 40);
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

  // ---- F) Endgegner wird nach etwa einer Minute kaum schaffbar (rechnerisch, ohne 40 s zu warten) ----
  page = await open(b, BASE()); h = H(page);
  await page.click('.gtile[data-game="boss"]'); await h.wait(300);
  await page.click('[data-act="boss-go"]');
  // Uhr des Spiels vorstellen: Startzeit 34 s zurück, dann ohne Ausweichen höchstens kurz überleben
  await page.evaluate(() => { const g = window.__game; g.t0 -= 72000; });
  await h.wait(1500);
  const g2 = await page.evaluate(() => ({ phase: window.__game && window.__game.phase, rows: window.__game && window.__game.rows.length }));
  ok('F Endgegner nach 72 s: sofort abgegrätscht', g2.phase === 'over' && /Abgegrätscht nach 7\d,\d Sekunden/.test(await h.txt('#gfoot')), JSON.stringify(g2) + ' ' + await h.txt('#gfoot'));
  await page.close();

  // ---- G) Meteoritenhagel: nach etwa einer Minute praktisch unmöglich ----
  page = await open(b, BASE()); h = H(page);
  await page.click('.gtile[data-game="meteor"]'); await h.wait(300);
  await page.click('[data-act="met-go"]'); await h.wait(100);
  await page.evaluate(() => { __game.t0 -= 68; });
  await h.wait(2000);
  ok('G Meteoritenhagel nach 68 s: sofort getroffen', (await h.game()).phase === 'over' && /[67]\d,\d Sekunden/.test(await h.txt('#gfoot')), await h.txt('#gfoot'));
  await page.close();

  console.log(errs.length ? 'FEHLER im Browser:\n' + errs.join('\n') : 'ok   keine Konsolenfehler');
  console.log(bad ? '\n' + bad + ' Prüfung(en) fehlgeschlagen' : '\nalle Prüfungen ok');
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
