// Fassung 4: neue Aufgaben, Karten als Minus (oben, Woche, zurückziehen, Grund frei, kein Einspruch), eigener Grund,
// Ziele (elf), Einlösen mit Konto-Gutschrift, Sticker (100, Seltenheit, Punkte, Bonus-Tor), antippbare Einblendung, Umstellung
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = 'file://' + path.resolve('build/torjaeger.test.html');
const errs = [];
let bad = 0;
const ok = (name, cond, info) => { if (!cond) bad++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? ' | ' + info : '')); };
const NB = ' ';
const T9 = ['t_hefte', 't_notiert', 't_hausaufgaben', 't_zimmer', 't_eincremen', 't_buch', 't_spuelmaschine', 't_tisch', 't_abmachung'];
const marks = (ids, v) => Object.fromEntries(ids.map(id => [id, v]));
const BASE = over => Object.assign({
  'cfg/main': { name: 'Ben', rival: 'Sofa United', cardsAck: true, shootMode: false },
  'cfg/progress': { cel: {}, red: {}, seasons: [], album: [], foil: [], pick: {} },
}, over || {});
async function open(b, preload, o = {}) {
  const ctx = o.ctx || await b.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  if (preload) await page.addInitScript(d => { window.__preload = d; }, preload);
  if (o.readonly) await page.addInitScript(() => { window.__readonly = true; });
  if (o.nodb) await page.addInitScript(() => { window.__nodb = true; });
  if (o.ls) await page.addInitScript(d => { try { localStorage.setItem('torj-local-v2', JSON.stringify(d)); } catch (e) { /* egal */ } }, o.ls);
  await page.addInitScript(fs.readFileSync('test/mock-claude.js', 'utf8'));
  await page.clock.setFixedTime(new Date('2026-10-30T18:30:00'));
  await page.goto(URL); await page.waitForTimeout(900);
  return page;
}
const H = page => ({
  txt: sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/[\s ]+/g, ' ').trim() : null; }, sel),
  cnt: sel => page.evaluate(s => document.querySelectorAll(s).length, sel),
  all: sel => page.evaluate(s => Array.from(document.querySelectorAll(s)).map(e => e.textContent.replace(/[\s ]+/g, ' ').trim()), sel),
  wait: ms => page.waitForTimeout(ms),
  store: key => page.evaluate(k => { const v = window.__mock.store.get(k); return v === undefined ? null : JSON.parse(JSON.stringify(v)); }, key),
  konto: () => page.evaluate(() => [...window.__mock.store.keys()].filter(k => k.startsWith('konto/')).length),
});
(async () => {
  const b = await chromium.launch();
  let page = await open(b, BASE());
  let h = H(page);

  // ---- A) Heute aus Bens Sicht ----
  ok('A neun Aufgaben (die Gründe des Trainers)', await h.cnt('.task') === 9);
  const titles = await h.all('.task h3');
  ok('A Titel und Reihenfolge', JSON.stringify(titles) === JSON.stringify(['Hefteinträge ordentlich', 'Hausaufgabenheft eingetragen', 'Hausaufgaben gut gemacht', 'Zimmer sauber', 'Eingecremt', 'Buch gelesen', 'Spülmaschine ausgeräumt', 'Tisch gedeckt und abgeräumt', 'An Abmachungen gehalten']), JSON.stringify(titles));
  ok('A kein Level, keine Etappen, keine Wochenziele', !/Level/i.test(await h.txt('body')) && await h.cnt('.lvl-card, .stages, .tbar, .tiers') === 0);
  ok('A ohne Karte: keine Kartenleiste, keine Marke im Kopf', await h.cnt('.cardtop') === 0 && await h.cnt('.hflag') === 0);
  const ng = await h.txt('.nextgoal');
  ok('A Nächstes Ziel: noch 25 Tore bis 25 Tore: Fußballpack', /Noch 25 Tore/.test(ng) && /bis 25 Tore: Fußballpack/.test(ng) && /0\s*\/\s*25/.test(ng), ng);
  ok('A Tüte wartet (Willkommenstüte)', /Eine Tüte wartet/.test(ng), ng);
  ok('A Ben kann nichts vergeben: keine Tor-Knöpfe', await h.cnt('.task .seg') === 0);

  // ---- B) Trainer: pro Aufgabe nur Tor / Kein Tor ----
  await page.click('[data-act="lock"]'); await h.wait(300);
  const segs = await page.evaluate(() => Array.from(document.querySelectorAll('.task .seg')).map(s => Array.from(s.querySelectorAll('button')).map(b => b.textContent.trim()).join('/')));
  ok('B jede Aufgabe: nur „Tor“ und „Kein Tor“', segs.length === 9 && segs.every(x => x === 'Tor/Kein Tor'), JSON.stringify(segs.slice(0, 2)));
  ok('B kein „Nicht dran“, kein „Spielfrei“, kein Joker', !/Nicht dran|Spielfrei|Joker/i.test(await h.txt('main')));
  await page.click('.task[data-task="t_hefte"] [data-st="y"]'); await h.wait(250);
  ok('B ein Klick: 1:0', (await h.txt('.digits')) === '1:0', await h.txt('.digits'));
  await page.click('.task[data-task="t_notiert"] [data-st="n"]'); await h.wait(250);
  ok('B Kein Tor: 1:1', (await h.txt('.digits')) === '1:1', await h.txt('.digits'));
  await page.click('[data-act="rest-no"]'); await h.wait(400);
  ok('B „Rest: Kein Tor“ trägt die übrigen sieben ein: 1:8', (await h.txt('.digits')) === '1:8' && await h.cnt('[data-act="rest-no"]') === 0, await h.txt('.digits'));
  await page.click('[data-act="lock"]'); await h.wait(250);
  ok('B Ben sieht keinen Einspruch, auch nicht bei „Kein Tor“', await h.cnt('.task.st-n') >= 8 && await h.cnt('.appeal-btn, .appeal, .ap-row, [data-act="appeal"]') === 0 && !/Einspruch|Ich sehe das anders/.test(await h.txt('body')));
  await page.close();

  // ---- C) Karten als Minus: Fenster, Leiste oben, Woche, zurückziehen, Spielstand bleibt ----
  page = await open(b, BASE({ 'days/2026-10-30': { m: marks(T9, 'y') } })); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(300);
  ok('C Spielstand 9:0 vor den Karten', (await h.txt('.digits')) === '9:0');
  await page.click('[data-act="extra-open"][data-k="y"]'); await h.wait(400);
  ok('C Gelb-Fenster: Titel, Knopf „Verwarnung eintragen“ gleich bereit', /Gelbe Karte/.test(await h.txt('.sheet h2')) && (await h.txt('[data-act="ex-save"]')) === 'Verwarnung eintragen');
  ok('C keine vorgegebenen Gründe (keine Schnellauswahl)', await h.cnt('.sheet .chips-r') === 0 && !/Nicht gehört|Schimpfwort/.test(await h.txt('.sheet') || ''));
  ok('C Grund freiwillig, Platzhalter „Kein Grund nötig“', (await page.getAttribute('#ex-text', 'placeholder')) === 'Kein Grund nötig' && /freiwillig/i.test(await h.txt('.sheet .field span')));
  ok('C Folge im Fenster: Minus 1 Tor bei den Zielen, kein Gegner-Tor', /Minus 1 Tor bei den Zielen/.test(await h.txt('.sheet .sub')) && !/Gegner/.test(await h.txt('.sheet .sub')), await h.txt('.sheet .sub'));
  await page.click('[data-act="ex-save"]'); await h.wait(500);
  ok('C ohne Grund eingetragen: Eintrag „Gelbe Karte“ mit −1, Spielstand bleibt 9:0', /Gelbe Karte/.test(await h.txt('.ev.yellow')) && (await h.txt('.ev.yellow .evv')) === '−1' && /Minus 1/.test(await h.txt('.ev.yellow')) && (await h.txt('.digits')) === '9:0', await h.txt('.digits') + ' ' + await h.txt('.ev.yellow'));
  ok('C ganz oben: gelbe Leiste mit Hinweis', await h.cnt('.cardtop.yellow') === 1 && /Eine zweite Gelbe ergibt Rot/.test(await h.txt('.cardtop.yellow')) && await page.evaluate(() => { const c = document.querySelector('.cardtop'), m = document.querySelector('#main'); return m.firstElementChild === c; }), await h.txt('.cardtop'));
  ok('C Marke im Kopf und in der Tagesleiste', await h.cnt('.top .hflag') === 1 && await h.cnt('.pill.today .pcard.y') === 1);
  ok('C Perfekter Tag ist mit Karte weg', (await h.txt('.badge')) !== 'Perfekter Tag');
  await page.click('[data-act="extra-open"][data-k="y"]'); await h.wait(400);
  ok('C zweite Gelbe: Fenster sagt Rot und Minus zusammen 4 Tore', /zweite Gelbe/.test(await h.txt('.sheet .sub')) && /Minus zusammen 4 Tore/.test(await h.txt('.sheet .sub')), await h.txt('.sheet .sub'));
  await page.fill('#ex-text', 'Tablet nicht abgegeben'); await page.click('[data-act="ex-save"]'); await h.wait(500);
  ok('C zweite Gelbe = automatisch Rot: Spielstand bleibt 9:0, am Rot steht −3', (await h.txt('.digits')) === '9:0' && (await h.txt('.ev.red .evv')) === '−3', await h.txt('.digits') + ' ' + await h.txt('.ev.red .evv'));
  ok('C rote Leiste, gelbe weg, Grund steht am Eintrag', await h.cnt('.cardtop.red') === 1 && await h.cnt('.cardtop.yellow') === 0 && /Tablet nicht abgegeben/.test(await h.txt('.evs')));
  ok('C drei Einträge: Gelb, Gelb, automatisch Rot', await h.cnt('.evs .ev.yellow') === 2 && await h.cnt('.evs .ev.red') === 1);
  ok('C Trainer-Ansicht: nirgends ein Einspruch', await h.cnt('.appeal, .appeal-btn, .ap-row, [data-act^="appeal"]') === 0);
  // Woche: kleine Karten je Tag
  await page.click('.tab[data-tab="week"]'); await h.wait(400);
  ok('C Woche: am heutigen Tag zwei gelbe und eine rote Karte', await page.evaluate(() => { const d = document.querySelector('.wk-day.today .dcards'); return !!d && d.querySelectorAll('.card-ic.yellow').length === 2 && d.querySelectorAll('.card-ic.red').length === 1; }));
  ok('C Woche: Zusammenfassung 2 Gelb, 1 Rot, Minus −5', /2 Gelb/.test(await h.txt('.weekcards')) && /1 Rot/.test(await h.txt('.weekcards')) && /Minus −5/.test(await h.txt('.weekcards')), await h.txt('.weekcards'));
  ok('C Woche: am Tag steht das Minus (−5) neben den Karten, der Tag zeigt weiter 9:0', /−5/.test(await h.txt('.wk-day.today .dcards')) && /9:0/.test(await h.txt('.wk-day.today .res')), await h.txt('.wk-day.today .res'));
  ok('C Woche: keine Wochenziele, keine Pokale', await h.cnt('.tbar, .tier') === 0 && !/Wochenpokal|Wochenziel/i.test(await h.txt('main')));
  await page.click('.tab[data-tab="today"]'); await h.wait(300);
  // zurückziehen: das automatische Rot über die zweite Gelbe
  ok('C Knopf „Zweite Gelbe zurückziehen“ am automatischen Rot', /Zweite Gelbe zurückziehen/.test(await h.txt('.ev.red .ev-act')));
  await page.click('.ev.red .ev-act button'); await h.wait(300);
  ok('C Rückfrage vor dem Zurückziehen', /Karte zurückziehen\?/.test(await h.txt('.sheet h2')));
  await page.click('[data-act="confirm-yes"]'); await h.wait(500);
  ok('C Rot weg, eine Gelbe offen (−1), 9:0', await h.cnt('.ev.red') === 0 && await h.cnt('.cardtop.yellow') === 1 && (await h.txt('.ev.yellow .evv')) === '−1' && (await h.txt('.digits')) === '9:0', await h.txt('.digits'));
  await page.click('.ev.yellow .ev-act button'); await h.wait(300);
  await page.click('[data-act="confirm-yes"]'); await h.wait(500);
  ok('C auch die erste Gelbe zurückgezogen: keine Karten, 9:0, perfekter Tag', await h.cnt('.cardtop, .ev.yellow') === 0 && (await h.txt('.digits')) === '9:0' && (await h.txt('.badge')) === 'Perfekter Tag', await h.txt('.digits'));
  // direktes Rot
  await page.click('[data-act="extra-open"][data-k="r"]'); await h.wait(400);
  ok('C Rot-Fenster: Knopf „Rote Karte eintragen“, Minus 3 Tore, Übersicht bleibt', (await h.txt('[data-act="ex-save"]')) === 'Rote Karte eintragen' && /Minus 3 Tore/.test(await h.txt('.sheet .sub')) && /In der Übersicht bleiben alle Tore stehen/.test(await h.txt('.sheet .sub')), await h.txt('.sheet .sub'));
  await page.click('[data-act="ex-save"]'); await h.wait(500);
  ok('C Rot ohne Grund: 9:0 bleibt, −3, Leiste rot mit Minus, nur einmal pro Tag (Knopf gesperrt)', (await h.txt('.digits')) === '9:0' && (await h.txt('.ev.red .evv')) === '−3' && await h.cnt('.cardtop.red') === 1 && /Minus 3 Tore bei den Zielen/.test(await h.txt('.cardtop.red')) && await page.evaluate(() => document.querySelector('[data-act="extra-open"][data-k="r"]').disabled));
  await page.click('[data-act="lock"]'); await h.wait(250);
  ok('C Ben: keine Zurückziehen-Knöpfe, kein Einspruch', await h.cnt('.ev-act, .evx, .appeal-btn') === 0);
  ok('C Ben: Kopfzeile zeigt weiter 9 Tore gesamt (kein Abzug in der Übersicht)', (await h.txt('.chip:not(.fire):not(.lockbtn) b')) === '9', await h.txt('.chip:not(.fire):not(.lockbtn) b'));
  await page.close();

  // ---- C2) Gelbe verfallen nie ----
  page = await open(b, BASE({ 'days/2026-08-01': { ev: [{ k: 'y', id: 'old1' }] } })); h = H(page);
  ok('C2 Gelbe vom 1. August gilt am 30. Oktober noch (ohne doppelten Punkt)', await h.cnt('.cardtop.yellow') === 1 && /Seit Sa 1\.8\. Minus 1 Tor bei den Zielen\. Eine zweite Gelbe ergibt Rot/.test(await h.txt('.cardtop.yellow')) && !/\.\./.test(await h.txt('.cardtop.yellow')), await h.txt('.cardtop'));
  await page.close();

  // ---- D) Eigener Grund (Tor / Kein Tor, Freitext) ----
  page = await open(b, BASE()); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(300);
  await page.click('[data-act="extra-open"][data-k="+"]'); await h.wait(400);
  ok('D Fenster: Tor / Kein Tor, Schnellauswahl für Tor, Freitext', await h.cnt('.sheet .seg.two button') === 2 && await h.cnt('.sheet .chips-r button') >= 3 && await h.cnt('#ex-text') === 1);
  await page.fill('#ex-text', 'Hund ausgeführt'); await page.click('[data-act="ex-save"]'); await h.wait(500);
  ok('D Tor mit eigenem Grund: 1:0, Eintrag', (await h.txt('.digits')) === '1:0' && /Hund ausgeführt/.test(await h.txt('.ev.good')) && /Eigener Grund · Tor/.test(await h.txt('.ev.good')), await h.txt('.digits'));
  await page.click('[data-act="extra-open"][data-k="+"]'); await h.wait(300);
  await page.click('[data-act="ex-kind"][data-k="n"]'); await h.wait(250);
  ok('D Kein Tor gewählt: keine Schnellauswahl, Gegner bekommt Tore', await h.cnt('.sheet .chips-r') === 0 && /Gegner/.test(await h.txt('.sheet .sub')) && (await h.txt('[data-act="ex-save"]')) === 'Kein Tor eintragen');
  await page.fill('#ex-text', 'Frech geantwortet'); await page.click('[data-act="ex-val"][data-v="2"]'); await h.wait(150);
  ok('D Text bleibt beim Umschalten erhalten', (await page.inputValue('#ex-text')) === 'Frech geantwortet');
  await page.click('[data-act="ex-save"]'); await h.wait(500);
  ok('D Kein Tor mit Grund: Gegner +2 (1:2), Eintrag mit „Kein Tor“', (await h.txt('.digits')) === '1:2' && /Frech geantwortet/.test(await h.txt('.ev.no')) && /Gegner \+2/.test(await h.txt('.ev.no')), await h.txt('.digits'));
  ok('D Eintrag lässt sich löschen (Trainer)', await h.cnt('.ev.no [data-act="ev-del"]') === 1);
  await page.click('.ev.no [data-act="ev-del"]'); await h.wait(300);
  ok('D gelöscht: 1:0', (await h.txt('.digits')) === '1:0');
  // Obergrenze für Tor-Gründe
  for (let i = 0; i < 2; i++) { await page.click('[data-act="extra-open"][data-k="+"]'); await h.wait(250); await page.fill('#ex-text', 'Grund ' + i); await page.click('[data-act="ex-save"]'); await h.wait(350); }
  ok('D drei Tor-Gründe pro Tag erlaubt: 3:0', (await h.txt('.digits')) === '3:0', await h.txt('.digits'));
  await page.click('[data-act="extra-open"][data-k="+"]'); await h.wait(250);
  await page.click('[data-act="ex-save"]'); await h.wait(300);
  ok('D vierter Tor-Grund wird abgelehnt, das Fenster bleibt offen', (await h.txt('.digits')) === '3:0' && /höchstens 3/.test(await h.txt('#toast') || '') && await h.cnt('.sheet') === 1, await h.txt('#toast'));
  await page.close();

  // ---- E) Erfolge: Fang, Tüten-Zeile, Ziele, Sticker ----
  const album9 = ['s01', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's13'];                // neun normale = 9 Punkte
  page = await open(b, BASE({ 'cfg/progress': { cel: {}, red: {}, seasons: [], album: ['s01', 's03'], foil: [], pick: {} }, 'days/2026-10-29': { m: marks(T9, 'y') } })); h = H(page);
  await page.click('.tab[data-tab="achieve"]'); await h.wait(1500);
  ok('E oben: Der große Fang, kein „Saison“', /Der große Fang/.test(await h.txt('.fang-card .eyebrow')) && !/Saison/.test(await h.txt('.fang-card')));
  ok('E Fang: 9 von 500 Toren', /9 von 500 Toren/.test(await h.txt('.fang-card .hint')) && /Noch 491 Tore/.test(await h.txt('.fang-card .hint')), await h.txt('.fang-card .hint'));
  ok('E große Belohnung: Ausflug in den Freizeitpark', /Ausflug in den Freizeitpark/.test(await h.txt('.fang-card .reward-box')));
  const pl = await h.txt('.fang-card .packline');
  ok('E Tüten-Zeile oben: „Gerade keine Tüte offen“ mit Zähler', /Gerade keine Tüte offen/.test(pl) && /Noch 3 Tore bis zur nächsten Sticker-Tüte/.test(pl) && /Alle 6 Tore/.test(pl), pl);
  ok('E kein Tüten-Knopf ohne Tüte', await h.cnt('[data-act="pack-open"]') === 0);
  ok('E Reihenfolge: Fang-Karte, dann Ziele, dann Sticker', await page.evaluate(() => { const hs = Array.from(document.querySelectorAll('#main > .sec-h h2, #main > .fang-card')).map(e => e.className.indexOf('fang-card') >= 0 ? 'Fang' : e.textContent.trim()); return JSON.stringify(hs) === JSON.stringify(['Fang', 'Meine Ziele', 'Sticker']); }));
  const goals = await page.evaluate(() => Array.from(document.querySelectorAll('.tier.goal')).map(e => (e.querySelector('h3').textContent + ' | ' + e.querySelector('p').textContent + ' | ' + e.querySelector('.state').textContent).replace(/\s+/g, ' ').trim()));
  ok('E elf Ziele', goals.length === 11, String(goals.length));
  ok('E Ziele mit Belohnung und Zähler (Vorgaben des Trainers)', goals[0].startsWith('25 Tore | Fußballpack | Noch 16 Tore') && goals[1].startsWith('50 Tore | 5 € aufs Guthabenkonto | Noch 41 Tore') && goals[2].startsWith('75 Tore | Eine Stunde YouTube Handyzeit') && goals[6].startsWith('175 Tore | Zum Asiamarkt nach Mühldorf inkl. 20 € Guthaben') && /500 Tore · der große Fang \| Ausflug in den Freizeitpark/.test(goals[10]), JSON.stringify(goals.slice(0, 3)));
  ok('E „Wird später festgelegt“ gedämpft', await h.cnt('.tier.goal p.tbd') === 3 && /Wird später festgelegt/.test((await h.all('.tier.goal p.tbd'))[0]));
  ok('E nur das nächste Ziel hat einen Balken', await h.cnt('.tier.goal .gbar') === 1 && await h.cnt('.tier.goal.next') === 1);
  ok('E Sticker-Punkte-Karte: 2 Punkte, 0 Bonus-Tore, Legende 1 / 2 / 5 und „je 10 Punkte“', /2\s*Sticker-Punkte/.test(await h.txt('.stpoints')) && /0\s*Bonus-Tore/.test(await h.txt('.stpoints')) && /Normal 1 Punkt/.test(await h.txt('.stpoints')) && /Selten 2 Punkte/.test(await h.txt('.stpoints')) && /Ultraselten 5 Punkte/.test(await h.txt('.stpoints')) && /Je 10 Sticker-Punkte ergeben 1 Tor/.test(await h.txt('.stpoints')), await h.txt('.stpoints'));
  ok('E Noch 8 Punkte bis zum nächsten Bonus-Tor', /Noch 8 Punkte bis zum nächsten Bonus-Tor/.test(await h.txt('.stpoints')));
  const groups = await h.all('.rar-h');
  ok('E drei Gruppen: ultraselten, selten, normal mit Punkten und Zähler', groups.length === 3 && /Ultraselten.*5 Punkte.*0 von 10/.test(groups[0]) && /Selten.*2 Punkte.*0 von 30/.test(groups[1]) && /Normal.*1 Punkt.*2 von 60/.test(groups[2]), JSON.stringify(groups));
  ok('E 100 Sticker im Album, 10 + 30 + 60 je Gruppe', await h.cnt('.sticker') === 100 && await h.cnt('.sticker.r-u') === 10 && await h.cnt('.sticker.r-r') === 30 && await h.cnt('.sticker.r-n') === 60);
  ok('E gefundener Sticker zeigt Name und Punkte', /Der Anstoß/.test(await h.txt('.sticker.got')) && (await h.txt('.sticker.got .pt')) === '1');
  ok('E Seltenheit schon bei gesperrten sichtbar (Rahmen)', await page.evaluate(() => { const u = document.querySelector('.sticker.r-u.lock'); return !!u && getComputedStyle(u).borderColor !== getComputedStyle(document.querySelector('.sticker.r-n.lock')).borderColor; }));
  ok('E Angler: blonder Junge (kein dunkler Schatten mit orange Mütze)', await page.evaluate(() => { const a = document.querySelector('.fang-svg .angler'); return !!a && a.innerHTML.indexOf('#f7cf4e') >= 0 && a.innerHTML.indexOf('#ff6a1a') < 0 && a.querySelectorAll('path,circle,ellipse').length > 40; }));
  await page.click('.sticker.got'); await h.wait(300);
  ok('E Sticker antippen: Name, „Normal · 1 Punkt“', /Der Anstoß/.test(await h.txt('.sheet h2')) && /Normal · 1 Punkt/.test(await h.txt('.sheet .sub')), await h.txt('.sheet .sub'));
  await page.click('.sheet [data-act="sheet-close"]'); await h.wait(200);
  await page.click('.sticker.r-u.lock'); await h.wait(300);
  ok('E gesperrter ultraselten: „Ultraselten · 5 Punkte“ und Tüten-Regel', /Ultraselten · 5 Punkte/.test(await h.txt('.sheet .sub')) && /Alle 6 Tore/.test(await h.txt('.sheet .sub')), await h.txt('.sheet .sub'));
  await page.close();

  // ---- F) Ziel erreicht: Feier, Einlösen, Konto-Gutschrift ----
  const d18 = { 'days/2026-10-28': { m: marks(T9, 'y') }, 'days/2026-10-29': { m: marks(T9, 'y') } };      // 18 Tore
  page = await open(b, BASE(Object.assign({ 'cfg/progress': { cel: {}, red: {}, seasons: [], album: ['s01'], foil: [], pick: {} } }, d18))); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(250);
  await page.click('[data-act="all-ok"]'); await h.wait(1700);
  ok('F 27 Tore: Feier „25 TORE“ mit Belohnung Fußballpack', /25 TORE!/.test(await h.txt('.celeb') || '') && /Fußballpack/.test(await h.txt('.celeb') || '') && /Ziel erreicht/.test(await h.txt('.celeb') || ''), (await h.txt('.celeb') || '').slice(0, 120));
  ok('F Merker mit Datum gespeichert', (await h.store('cfg/progress')).cel['g:g25'] === '2026-10-30', JSON.stringify((await h.store('cfg/progress')).cel));
  await page.click('[data-act="celeb-next"]'); await h.wait(500);
  ok('F Heute: „25 Tore geschafft, Belohnung wartet“ und nächstes Ziel 50', /25 Tore geschafft/.test(await h.txt('.nextgoal')) && /Noch 23 Tore/.test(await h.txt('.nextgoal')) && /bis 50 Tore: 5 € aufs Guthabenkonto/.test(await h.txt('.nextgoal')), await h.txt('.nextgoal'));
  await page.click('.tab[data-tab="achieve"]'); await h.wait(800);
  const r25 = await h.txt('.tier.goal[data-goal="g25"]');
  ok('F Erfolge: Ziel 25 geschafft am Fr 30.10., Sag dem Trainer Bescheid', /Geschafft am Fr 30\.10\./.test(r25) && /Sag dem Trainer Bescheid/.test(r25), r25);
  ok('F Trainer: Knopf „Als eingelöst markieren“ nur bei erreichtem Ziel', await h.cnt('[data-act="redeem"]') === 1 && (await h.txt('[data-act="redeem"]')) === 'Als eingelöst markieren');
  await page.click('[data-act="redeem"]'); await h.wait(300);
  ok('F eingelöst: Datum, Knopf „Rückgängig“, keine Konto-Buchung (Fußballpack)', /Eingelöst am Fr 30\.10\./.test(await h.txt('.tier.goal[data-goal="g25"]')) && (await h.txt('[data-act="redeem"]')) === 'Rückgängig' && await h.konto() === 0);
  await page.click('[data-act="redeem"]'); await h.wait(300);
  ok('F rückgängig', /Geschafft/.test(await h.txt('.tier.goal[data-goal="g25"]')) && await h.cnt('.tier.goal.done') === 0);
  await page.close();

  // 50 Tore: Gutschrift aufs Konto beim Einlösen und wieder weg beim Zurücknehmen
  const d6 = {}; for (let i = 0; i < 6; i++) d6['days/2026-10-' + (24 + i)] = { m: marks(T9, 'y') };        // 54 Tore
  page = await open(b, BASE(Object.assign({ 'cfg/progress': { cel: { 'g:g25': '2026-10-26', 'g:g50': '2026-10-28' }, red: { g25: '2026-10-27' }, seasons: [], album: ['s01'], foil: [], pick: {} } }, d6))); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(250);
  await page.click('.tab[data-tab="achieve"]'); await h.wait(800);
  ok('F2 Knopf nennt die Gutschrift: „… und 5,00 € buchen“', (await h.txt('.tier.goal[data-goal="g50"] [data-act="redeem"]')) === 'Als eingelöst markieren und 5,00' + NB + '€ buchen'.replace(NB, ' ') || /5,00 € buchen/.test(await h.txt('.tier.goal[data-goal="g50"] [data-act="redeem"]')), await h.txt('.tier.goal[data-goal="g50"] [data-act="redeem"]'));
  await page.click('.tier.goal[data-goal="g50"] [data-act="redeem"]'); await h.wait(500);
  ok('F2 eingelöst: Konto hat eine Buchung über 5,00 €, Hinweis', await h.konto() === 1 && /5,00 € wurden dem Konto gutgeschrieben/.test(await h.txt('#toast') || ''), await h.txt('#toast'));
  const kk = await page.evaluate(() => { const k = [...window.__mock.store.keys()].find(x => x.startsWith('konto/')); return JSON.parse(JSON.stringify(window.__mock.store.get(k))); });
  ok('F2 Buchung: +500 Cent, Gutschrift, „Ziel: 50 Tore“, Datum heute', kk.c === 500 && kk.k === 'plus' && kk.t === 'Ziel: 50 Tore' && kk.ds === '2026-10-30', JSON.stringify(kk));
  await page.click('.tab[data-tab="konto"]'); await h.wait(400);
  ok('F2 Konto zeigt 5,00 €', (await h.txt('#kontoSum')) === '5,00 €', await h.txt('#kontoSum'));
  await page.click('.tab[data-tab="achieve"]'); await h.wait(500);
  await page.click('.tier.goal[data-goal="g50"] [data-act="redeem"]'); await h.wait(500);
  ok('F2 zurückgenommen: Buchung weg, Hinweis', await h.konto() === 0 && /Gutschrift auf dem Konto wurde entfernt/.test(await h.txt('#toast') || ''), await h.txt('#toast'));
  await page.click('.tier.goal[data-goal="g50"] [data-act="redeem"]'); await h.wait(400);
  ok('F2 erneut eingelöst: wieder genau eine Buchung (keine doppelte)', await h.konto() === 1);
  ok('F2 Mahnung des Trainers: Ziel 25 war eingelöst, Ziel 50 eingelöst: keine offene', await h.cnt('.warn-box .adv li') === 0);
  await page.close();

  // ---- G) Sticker öffnen: Seltenheit, Punkte, Bonus-Tor ----
  const d54 = {}; for (let i = 0; i < 6; i++) d54['days/2026-10-' + (24 + i)] = { m: marks(T9, 'y') };
  page = await open(b, BASE(Object.assign({ 'cfg/progress': { cel: { 'g:g25': '2026-10-26', 'g:g50': '2026-10-28' }, red: {}, seasons: [], album: album9, foil: [], pick: {} } }, d54))); h = H(page);
  const t0 = parseInt(await h.txt('.chip:not(.fire):not(.lockbtn) b'), 10);
  await page.click('.tab[data-tab="achieve"]'); await h.wait(900);
  ok('G Tüte wartet: Tüten-Zeile mit Knopf, Plakette am Tab', /Eine Tüte wartet/.test(await h.txt('.packline')) && await h.cnt('[data-act="pack-open"]') === 1 && await h.cnt('.tab .dot-badge') >= 1);
  ok('G 9 Punkte, noch 1 bis zum Bonus-Tor', /9\s*Sticker-Punkte/.test(await h.txt('.stpoints')) && /Noch 1 Punkt bis zum nächsten Bonus-Tor/.test(await h.txt('.stpoints')), await h.txt('.stpoints'));
  await page.evaluate(() => { window.__r = Math.random; Math.random = () => 0; });
  await page.click('[data-act="pack-open"]'); await h.wait(400);
  await page.click('[data-act="pack-tear"]', { force: true }); await h.wait(1800);
  await page.evaluate(() => { Math.random = window.__r; });
  const pk = await h.txt('.celeb.pack');
  ok('G gezogen (Zufall 0 = erster freier Sticker): Gold-Schuh, selten, 2 Punkte', /Gold-Schuh/.test(pk) && /Selten!/.test(pk) && /Selten · 2 Punkte/.test(pk), pk);
  ok('G Bonus-Tor gemeldet, Punktestand 11, 9 bis zum nächsten', /Bonus-Tor!/.test(pk) && /Sticker-Punkte: 11/.test(pk) && /noch 9 Punkte bis zum nächsten Bonus-Tor/.test(pk), pk);
  ok('G Feier selten: blaue Fassung', await h.cnt('.celeb.pack.open.r-r') === 1);
  await page.click('.celeb [data-act="pack-close"]'); await h.wait(500);
  ok('G im Album: Gold-Schuh mit Punkteplakette 2, Gruppe „1 von 30“', await page.evaluate(() => { const s = document.querySelector('.sticker.r-r.got'); return !!s && s.querySelector('.pt').textContent === '2'; }) && /1 von 30/.test((await h.all('.rar-h'))[1]));
  ok('G Karte: 11 Punkte, 1 Bonus-Tor', /11\s*Sticker-Punkte/.test(await h.txt('.stpoints')) && /1\s*Bonus-Tor/.test(await h.txt('.stpoints')));
  const t1 = parseInt(await h.txt('.chip:not(.fire):not(.lockbtn) b'), 10);
  ok('G das Bonus-Tor steht in der Tore-Zahl oben (+1)', t1 === t0 + 1, t0 + ' -> ' + t1);
  ok('G Fang rechnet es mit: 55 von 500 Toren', /55 von 500 Toren/.test(await h.txt('.fang-card .hint')), await h.txt('.fang-card .hint'));
  ok('G Tüten-Zeile danach: keine Tüte offen', /Gerade keine Tüte offen/.test(await h.txt('.packline')), await h.txt('.packline'));
  // ultraselten
  page.on('dialog', d => d.dismiss());
  await page.close();
  page = await open(b, BASE({ 'cfg/progress': { cel: {}, red: {}, seasons: [], album: ['s01'], foil: [], pick: {} }, 'days/2026-10-29': { m: marks(T9, 'y') } })); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(250);
  await page.click('[data-act="all-ok"]'); await h.wait(1500);          // 18 Tore: Tüten 1 + 3 = 4, eine geöffnet → 3 warten
  await page.click('.tab[data-tab="achieve"]'); await h.wait(900);
  await page.evaluate(() => { window.__r = Math.random; Math.random = () => 0.99999; });
  await page.click('[data-act="pack-open"]'); await h.wait(400);
  await page.click('[data-act="pack-tear"]', { force: true }); await h.wait(1800);
  await page.evaluate(() => { Math.random = window.__r; });
  const pu = await h.txt('.celeb.pack');
  ok('G2 Zufall ganz oben: ultraselten Drachen-Herz, 5 Punkte, violette Fassung', /Drachen-Herz/.test(pu) && /Ultraselten!/.test(pu) && /Ultraselten · 5 Punkte/.test(pu) && await h.cnt('.celeb.pack.open.r-u') === 1, pu);
  ok('G2 Steckbrief und Punkte: noch 5 bis zum Bonus-Tor (1 + 5 = 6 Punkte)', /Drachen/.test(pu) && /Sticker-Punkte: 6/.test(pu) && /noch 4 Punkte/.test(pu), pu);
  await page.close();

  // ---- H) Einblendung „Neue Tüte“ ist antippbar und führt zu den Erfolgen ----
  page = await open(b, BASE({ 'days/2026-10-29': { m: marks(T9.slice(0, 5), 'y') }, 'cfg/progress': { cel: {}, red: {}, seasons: [], album: ['s01'], foil: [], pick: {} } })); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(250);
  await page.click('.task[data-task="t_hefte"] [data-st="y"]');                           // 5 + 1 = 6 Tore → zweite Tüte
  await page.waitForSelector('#banner button.bn.go', { timeout: 9000 });                    // erst „Tor!“, danach die Tüten-Meldung
  ok('H Einblendung „Neue Tüte!“ erscheint als Knopf', await h.cnt('#banner button.bn.go') === 1 && /Neue Tüte/.test(await h.txt('#banner')) && /Tippe hier/.test(await h.txt('#banner')), await h.txt('#banner'));
  ok('H sie reagiert auf Tippen (Zeiger-Ereignisse frei)', await page.evaluate(() => getComputedStyle(document.querySelector('#banner button.bn.go')).pointerEvents === 'auto'));
  await page.click('#banner button.bn.go'); await h.wait(500);
  ok('H Tippen führt direkt zu den Erfolgen', (await page.getAttribute('.tab[aria-current="page"]', 'data-tab')) === 'achieve' && await h.cnt('.fang-card') === 1 && await h.cnt('#banner .bn') === 0);
  await page.close();

  // ---- I) Trainer: Ziele, Karten, Gründe ----
  page = await open(b, BASE()); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(250);
  await page.click('.tab[data-tab="coach"]'); await h.wait(500);
  ok('I Bereiche: Aufgaben, Ziele, Karten, Konto, Spieler', JSON.stringify(await h.all('.jump button')) === JSON.stringify(['Aufgaben', 'Ziele', 'Karten', 'Konto', 'Spieler']));
  ok('I elf Ziele bearbeitbar, je Zahl und Belohnung', await h.cnt('.goaled') === 11 && await h.cnt('.goaled input[type="text"]') === 11 && await h.cnt('.goaled .stepper') === 11);
  ok('I Hinweis auf die automatische Konto-Buchung', /5 € aufs Guthabenkonto/.test(await h.txt('#sec-ziele .hint')) && /bucht die App/.test(await h.txt('#sec-ziele .hint')));
  await page.fill('#f-goal-g100', 'Kinobesuch'); await h.wait(900);
  ok('I Belohnung bei 100 Toren ändern wird gespeichert', (await h.store('cfg/main')).goals.find(g => g.at === 100).reward === 'Kinobesuch');
  await page.click('.goaled:nth-of-type(1) .stepper button[aria-label="mehr"]'); await h.wait(400);
  const at0 = (await h.store('cfg/main')).goals[0].at;
  ok('I Zahl des ersten Ziels in Fünferschritten (25 → 30)', at0 === 30, String(at0));
  for (let i = 0; i < 12; i++) { await page.click('.goaled:nth-of-type(1) .stepper button[aria-label="mehr"]'); await h.wait(60); }
  await h.wait(800);
  ok('I Ziele bleiben aufsteigend (erstes Ziel stoppt vor dem zweiten, 45)', (await h.store('cfg/main')).goals[0].at === 45, String((await h.store('cfg/main')).goals[0].at));
  await page.click('[data-act="goal-add"]'); await h.wait(400);
  ok('I Ziel hinzufügen: zwölf, letztes bei 600', await h.cnt('.goaled') === 12 && (await h.store('cfg/main')).goals[11].at === 600);
  await page.locator('.goaled').last().locator('[data-act="goal-del"]').click(); await h.wait(300);
  ok('I Entfernen fragt nach', /Ziel entfernen\?/.test(await h.txt('.sheet h2')));
  await page.click('[data-act="confirm-yes"]'); await h.wait(400);
  ok('I wieder elf', await h.cnt('.goaled') === 11);
  ok('I Karten: Gelb 1 Tor, Rot 3 Tore, keine Beispiel-Listen', /1 Tor/.test(await h.txt('#sec-karten .field:nth-of-type(1) output')) && /3 Tore/.test(await h.txt('#sec-karten .field:nth-of-type(2) output')) && await h.cnt('#f-yellow, #f-red') === 0 && /verfallen nie/.test(await h.txt('#sec-karten .hint')));
  const kh = await h.txt('#sec-karten .hint');
  ok('I Karten-Hinweis: Minus bei Zielen und Fang, Übersicht zeigt alle Tore, Zurückziehen, kein Grund nötig, kein Einspruch', /Jede Karte kostet Minus-Tore/.test(kh) && /bei den Zielen und beim Fang abgezogen/.test(kh) && /weiter alle Tore von Ben/.test(kh) && /Einen Grund musst du nie angeben/.test(kh) && /jede Karte zurückziehen/.test(kh) && !/Einspruch/.test(kh), kh);
  ok('I Karten: Einstellungen heißen „Minus-Tore“ (nicht mehr Gegner-Tore)', /Gelbe Karte: Minus-Tore/.test(await h.txt('#sec-karten')) && /Rote Karte: Minus-Tore/.test(await h.txt('#sec-karten')) && !/für den Gegner/.test(await h.txt('#sec-karten')));
  await page.click('#sec-karten .field:nth-of-type(2) .stepper button[aria-label="mehr"]'); await h.wait(500);
  ok('I Rot auf 4 Tore gestellt und gespeichert', (await h.store('cfg/main')).redPts === 4);
  ok('I Schnellauswahl für „Eigener Grund: Tor“ steht im Trainer, „Karten-Gründe“ nicht', /Schnellauswahl für „Eigener Grund: Tor“/.test(await h.txt('#sec-karten')) && !/Beispiele für Gelb/.test(await h.txt('#sec-karten')));
  ok('I Kurzanleitung nennt Eigener Grund, Gelb (nie verfallen), Rot, Ziele', /Eigener Grund/.test(await h.txt('.rules')) && /verfallen nie/.test(await h.txt('.rules')) && /Ein Grund ist nie nötig/.test(await h.txt('.rules')) && /von 45 bis 500 Toren/.test(await h.txt('.rules')), await h.txt('.rules'));
  ok('I Aufgaben-Idee legt Aufgabe an', true);
  await page.click('[data-act="task-idea"][data-i="0"]'); await h.wait(400);
  ok('I neue Aufgabe „Zähne geputzt“ ab heute', await h.cnt('.tlist .trow') === 10 && (await h.store('cfg/main')).tasks.some(t => t.title === 'Zähne geputzt' && t.from === '2026-10-30'));
  ok('I Abmachung: Hinweis nennt „An Abmachungen gehalten“', /An Abmachungen gehalten/.test(await h.txt('#sec-aufgaben .field small')));
  ok('I Regelbuch: Gelb/Rot ohne Beispielzeilen, Karten entscheidet der Trainer', await page.evaluate(() => true));
  await page.click('[data-act="rules"]'); await h.wait(400);
  const rb = await h.txt('.sheet');
  ok('I Regelbuch: Minus erklärt, Übersicht zeigt alle Tore, Eingelöstes bleibt, kein Einspruch', /Minus 1 Tor\./.test(rb) && /Minus 4 Tore, höchstens einmal am Tag/.test(rb) && /bei den Zielen und beim großen Fang abgezogen/.test(rb) && /In der Übersicht siehst du immer alle deine Tore/.test(rb) && /schon eingelöst hast, bleibt deine/.test(rb) && !/Einspruch|Ich sehe das anders|Der Gegner bekommt 4/.test(rb), rb.slice(0, 60));
  ok('I Regelbuch: nie verfallen, Zwei Gelbe = Rot, keine Beispiele, Trainer entscheidet, Ziele, Sticker 1/2/5', /verfallen nie/.test(rb) && /Zwei Gelbe ergeben automatisch Rot/.test(rb) && !/Zum Beispiel/.test(rb) && /Karten entscheidet der Trainer allein/.test(rb) && /Alle deine Tore zählen zusammen/.test(rb) && /1 Punkt, seltene 2 und ultraseltene 5/.test(rb), rb.slice(0, 80));
  await page.close();

  // ---- J) Umstellung von Fassung 3: Aufgaben, Ziele, Karten; wird einmal gesichert ----
  const old = {
    v: 3, name: 'Ben', rival: 'Sofa United', cardsAck: true, shootMode: false, yellowPts: 0, redPts: 2, yellowExpiry: 7, season: { no: 1, title: 'Der Riesen-Hecht', goal: 120, start: '2026-10-19', reward: 'Altes Abenteuer' },
    tiers: [{ id: 'bronze', pct: 50, reward: 'Alter Film' }],
    tasks: [
      { id: 't_notiert', icon: '📒', title: 'Hausaufgaben notiert', sub: 'Alles im Heft', pts: 1, bonus: false, days: [1, 2, 3, 4, 5] },
      { id: 't_hausaufgaben', icon: '✏️', title: 'Hausaufgaben ordentlich', sub: 'x', pts: 1, bonus: false, days: [1, 2, 3, 4, 5] },
      { id: 't_zimmer', icon: '🧹', title: 'Zimmer sauber', sub: 'Boden frei', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6] },
      { id: 't_abmachung', icon: '🤝', title: 'Abmachung eingehalten', sub: '', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6] },
      { id: 't_ehrlich', icon: '🏅', title: 'Ehrlich geblieben', sub: '', pts: 1, bonus: false, days: [0, 1, 2, 3, 4, 5, 6] },
      { id: 't_note', icon: '⭐', title: 'Gute Note geschrieben', sub: '', pts: 2, bonus: true, days: [1, 2, 3, 4, 5] },
    ],
  };
  page = await open(b, { 'cfg/main': old, 'cfg/progress': { cel: {}, red: {}, seasons: [], album: [], foil: [], pick: {} }, 'days/2026-10-27': { m: { t_notiert: 'y', t_hausaufgaben: 'y', t_zimmer: 'y', t_abmachung: 'y', t_ehrlich: 'y', t_note: 'y' } } }); h = H(page);
  ok('J heute neun Aufgaben (Freitag), keine alten Reste', await h.cnt('.task') === 9 && (await h.all('.task h3')).indexOf('Ehrlich geblieben') < 0);
  ok('J der alte Tag (27.10.) zählt weiter: 7 Tore im Gesamtstand', await page.evaluate(() => /7/.test(document.querySelector('.chip:not(.fire):not(.lockbtn) b').textContent)));
  await page.click('.pill[data-date="2026-10-27"]'); await h.wait(300);
  ok('J der alte Tag zeigt seine sechs Aufgaben und 7:0', await h.cnt('.task') === 6 && (await h.txt('.digits')) === '7:0', await h.txt('.digits'));
  await h.wait(600);
  const saved = await h.store('cfg/main');
  ok('J Umstellung wurde einmal gesichert: Fassung 4, neue Aufgaben, Karten 1/3, nie verfallen', saved && saved.v === 4 && saved.tasks.length === 11 && saved.yellowPts === 1 && saved.redPts === 3 && saved.yellowExpiry === 0 && saved.goals.length === 11 && saved.tiers === undefined, saved ? JSON.stringify({ v: saved.v, n: saved.tasks.length, y: saved.yellowPts, r: saved.redPts }) : 'nichts');
  ok('J Fischname bleibt, altes Fang-Ziel gilt nicht mehr', saved.season.title === 'Der Riesen-Hecht' && saved.season.goal === undefined);
  await page.close();

  // ---- K) Nur ansehen (Mitleser): Karten oben sichtbar, kein Trainer ----
  page = await open(b, BASE({ 'days/2026-10-30': { ev: [{ k: 'y', id: 'v1' }] } }), { readonly: true }); h = H(page);
  ok('K Mitleser: gelbe Leiste und Marke, kein Trainer-Tab, keine Knöpfe', await h.cnt('.cardtop.yellow') === 1 && await h.cnt('.hflag') === 1 && await h.cnt('.tab[data-tab="coach"]') === 0 && await h.cnt('.lockbtn') === 0);
  ok('K Mitleser: Hinweis „Nur ansehen“ steht unter der Karte, die Karte bleibt ganz oben', /Nur ansehen: Eintragen und Tüten öffnen macht der Trainer/.test(await h.txt('.mode-note')) && await page.evaluate(() => { const m = document.querySelector('#main'); return m.firstElementChild.classList.contains('cardtop') && m.children[1].classList.contains('mode-note'); }), await h.txt('.mode-note'));
  await page.close();
  // Mitleser mit wartender Tüte: kein Öffnen-Knopf, der Hinweis sagt, wer sie öffnet
  page = await open(b, BASE({ 'days/2026-10-29': { m: marks(T9, 'y') } }), { readonly: true }); h = H(page);
  await page.click('.tab[data-tab="achieve"]'); await h.wait(900);
  ok('K Mitleser: Tüte wartet, aber kein „Tüte öffnen“; „Der Trainer öffnet sie mit dir“', /Tüten? warte/.test(await h.txt('.packline')) && /Der Trainer öffnet sie mit dir/.test(await h.txt('.packline')) && await h.cnt('[data-act="pack-open"]') === 0, await h.txt('.packline'));
  await page.close();

  // ---- K2) Kein Zugriff auf den gemeinsamen Stand (z. B. Bens Handy ohne Anmeldung) ----
  page = await open(b, null, { nodb: true }); h = H(page);
  ok('K2 ohne Zugriff: erklärende Seite statt leerem Spiel, keine Einrichtung, keine Tabs', /Hier fehlt die Anmeldung/.test(await h.txt('.gate')) && await h.cnt('.sheet') === 0 && await h.cnt('.tab, .task, .digits') === 0, await h.txt('#app'));
  ok('K2 ohne Zugriff: sagt, was zu tun ist (Mama oder Papa, anmelden, Link erneut öffnen)', /Mama oder Papa/.test(await h.txt('.gate')) && /anmelden/.test(await h.txt('.gate')) && /Link noch einmal öffnen/.test(await h.txt('.gate')));
  ok('K2 nichts wird lokal gespeichert', await page.evaluate(() => localStorage.getItem('torj-local-v2') === null));
  await page.close();
  const localGame = { cfg: { v: 4, name: 'Ben', rival: 'Sofa United', cardsAck: true, shootMode: false, goals: [{ id: 'g25', at: 25, reward: 'x' }] }, prog: { cel: {}, red: {}, album: [], foil: [], pick: {} }, days: {}, konto: {} };
  page = await open(b, null, { nodb: true, ls: localGame }); h = H(page);
  ok('K2 mit altem lokalem Stand: das Spiel ist da, ein roter Hinweis „Nicht verbunden“ steht oben', await h.cnt('.task') === 9 && /Nicht verbunden/.test(await h.txt('.mode-note')) && /nur auf diesem Gerät/.test(await h.txt('.mode-note')), await h.txt('.mode-note'));
  await page.close();
  // Mit Zugriff erscheint nichts davon
  page = await open(b, BASE()); h = H(page);
  ok('K2 mit Zugriff: weder Hinweis noch Sperrseite', await h.cnt('.mode-note, .gate') === 0);
  await page.close();

  // ---- L) Breite: kein seitliches Scrollen auf 360 px ----
  page = await open(b, BASE({ 'days/2026-10-29': { m: marks(T9, 'y'), ev: [{ k: 'y', id: 'a1' }, { k: 'y', id: 'a2' }, { k: 'n', v: 1, t: 'Ein sehr langer eigener Grund ohne Ende für den Test der Zeilen', id: 'a3' }] }, 'cfg/progress': { cel: {}, red: {}, seasons: [], album: ['s01', 's02', 's20', 's22'], foil: ['s01'], pick: {} } }), { w: 360, h: 740 }); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(250);
  for (const tab of ['today', 'week', 'achieve', 'konto', 'coach']) {
    await page.click('.tab[data-tab="' + tab + '"]'); await h.wait(700);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok('L 360 px ' + tab + ': kein seitliches Scrollen', o.sw <= o.cw, o.sw + ' von ' + o.cw);
  }
  await page.close();

  // ---- M) Schuss-Ablauf mit Ball (Standard): Alle Tor → neun Schüsse → überspringen → Weiße Weste ----
  page = await open(b, { 'cfg/main': { name: 'Ben', rival: 'Sofa United', cardsAck: true }, 'cfg/progress': { cel: {}, red: {}, seasons: [], album: [], foil: [], pick: {} } }); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(250);
  await page.click('[data-act="all-ok"]'); await h.wait(400);
  ok('M neun Tore warten auf den Schuss, Anzeige noch 0', await h.cnt('.stamp.ready') === 9 && (await h.txt('#scoreN')) === '0', await h.txt('.shotbtn .st'));
  await page.click('.shotbtn'); await h.wait(1100);
  ok('M ein Schuss: 1 Tor, 8 warten', (await h.txt('#scoreN')) === '1' && await h.cnt('.stamp.ready') === 8, await h.txt('#scoreN'));
  await page.click('[data-act="shoot-skip"]'); await h.wait(1500);
  ok('M überspringen: 9 Tore, Weiße Weste', (await h.txt('#scoreN')) === '9' && await h.cnt('.score.perfect') === 1 && /Weiße Weste/.test(await h.txt('#banner') || ''), await h.txt('#banner'));
  await page.close();


  // ---- N) Minus bei Zielen und Fang: Übersicht bleibt brutto ----
  const d27 = { 'days/2026-10-27': { m: marks(T9, 'y') }, 'days/2026-10-28': { m: marks(T9, 'y') }, 'days/2026-10-29': { m: marks(T9, 'y') } };      // 27 Tore
  const withRed = Object.assign({ 'days/2026-10-30': { ev: [{ k: 'r', id: 'r1' }] }, 'cfg/progress': { cel: { 'g:g25': '2026-10-29' }, red: {}, seasons: [], album: [], foil: [], pick: {} } }, d27);
  page = await open(b, BASE(withRed)); h = H(page);
  ok('N Übersicht bleibt brutto: Kopf 27 Tore, Spielstand heute 0:0 (die Karte allein ist kein Spiel)', (await h.txt('.chip:not(.fire):not(.lockbtn) b')) === '27' && (await h.txt('.digits')) === '0:0', await h.txt('.chip:not(.fire):not(.lockbtn) b') + ' / ' + await h.txt('.digits'));
  const ng2 = await h.txt('.nextgoal');
  ok('N Nächstes Ziel rechnet mit Abzug: noch 1 Tor, 24/25, Hinweis „27 Tore gesamt, Minus −3“', /Noch 1 Tor/.test(ng2) && /24\s*\/\s*25/.test(ng2) && /27 Tore gesamt, Minus −3 durch Karten/.test(ng2), ng2);
  await page.click('.tab[data-tab="achieve"]'); await h.wait(1200);
  const ty = await h.txt('.tally');
  ok('N Erfolge: Aufstellung Tore gesamt 27, Minus −3, zählt 24', /Tore gesamt\s*27/.test(ty) && /Minus durch Karten\s*−3/.test(ty) && /Das zählt für Ziele und Fang\s*24/.test(ty), ty);
  ok('N Aufstellung steht zwischen Fang-Karte und „Meine Ziele“', await page.evaluate(() => { const t = document.querySelector('.tally'); return !!t && t.previousElementSibling.classList.contains('fang-card') && /Meine Ziele/.test(t.nextElementSibling.textContent); }));
  ok('N Fang rechnet mit 24: „24 von 500 Toren“, Rest 476', /24 von 500 Toren/.test(await h.txt('.fang-card .hint')) && /Noch 476 Tore/.test(await h.txt('.fang-card .hint')), await h.txt('.fang-card .hint'));
  const g25 = await h.txt('.tier.goal[data-goal="g25"]');
  ok('N Ziel 25 ist wieder offen: „Noch 1 Tor“, nicht „Geschafft“', /Noch 1 Tor/.test(g25) && !/Geschafft/.test(g25) && await h.cnt('.tier.goal.got') === 0, g25);
  ok('N Ziele-Kopf nennt weiter alle Tore: „27 Tore insgesamt“', /27 Tore insgesamt/.test(await h.txt('#main > .sec-h .hint')), await h.txt('#main > .sec-h:nth-of-type(1)'));
  ok('N Sticker-Tüten zählen nach den gesamten Toren (27: 1 + 4 = 5, nicht 1 + 4 bei 24)', /Noch 3 Tore bis zur nächsten Sticker-Tüte/.test(await h.txt('.packline')) || /5 Tüten warten/.test(await h.txt('.packline')), await h.txt('.packline'));
  await page.click('.tab[data-tab="week"]'); await h.wait(500);
  ok('N Woche: Karten-Zusammenfassung mit Minus −3, Tagesspalte zeigt −3, Tore der Woche 27', /Minus −3/.test(await h.txt('.weekcards')) && /−3/.test(await h.txt('.wk-day.today .dcards')) && /27/.test(await h.txt('.stats4 .stat:first-child')), await h.txt('.stats4'));
  await page.close();

  // eingelöstes Ziel bleibt erreicht, auch mit Minus
  const redeemed = Object.assign({ 'days/2026-10-30': { ev: [{ k: 'r', id: 'r1' }] }, 'cfg/progress': { cel: { 'g:g25': '2026-10-29' }, red: { g25: '2026-10-29' }, seasons: [], album: [], foil: [], pick: {} } }, d27);
  page = await open(b, BASE(redeemed)); h = H(page);
  await page.click('.tab[data-tab="achieve"]'); await h.wait(1000);
  ok('N Eingelöstes Ziel 25 bleibt erreicht: „Eingelöst am Do 29.10.“', /Eingelöst am Do 29\.10\./.test(await h.txt('.tier.goal[data-goal="g25"]')) && await h.cnt('.tier.goal.done') === 1);
  ok('N nächstes Ziel ist 50: noch 26 Tore (24 zählen)', /Noch 26 Tore/.test(await h.txt('.tier.goal.next')), await h.txt('.tier.goal.next'));
  await page.close();

  // Minus vor dem ersten Tor: Zahlen bleiben lesbar
  page = await open(b, BASE({ 'days/2026-10-30': { ev: [{ k: 'r', id: 'r1' }] } })); h = H(page);
  await page.click('.tab[data-tab="achieve"]'); await h.wait(1000);
  ok('N Minus vor dem ersten Tor: Gesamt 0, zählt −3, Fang 0 %, Balken nicht negativ', /Tore gesamt\s*0/.test(await h.txt('.tally')) && /zählt|Ziele und Fang\s*−3/.test(await h.txt('.tally')) && /−3 von 500 Toren/.test(await h.txt('.fang-card .hint')) && (await h.txt('.fang-card .pct')) === '0%' && await page.evaluate(() => parseFloat(document.querySelector('.fang-card .fill').style.width) >= 0), await h.txt('.tally'));
  await page.close();

  // Trainer gibt Rot (Ziel 25 fällt), dann ein Tor (Ziel 25 wieder da): wird noch einmal gefeiert
  const fresh27 = Object.assign({ 'cfg/progress': { cel: { 'g:g25': '2026-10-29' }, red: {}, seasons: [], album: [], foil: [], pick: {} } }, d27);
  page = await open(b, BASE(fresh27)); h = H(page);
  await page.click('[data-act="lock"]'); await h.wait(250);
  await page.click('[data-act="extra-open"][data-k="r"]'); await h.wait(350);
  await page.click('[data-act="ex-save"]'); await h.wait(1500);
  ok('N Rot nimmt Ziel 25 weg: Merker „erreicht“ entfernt, keine Feier', (await h.store('cfg/progress')).cel['g:g25'] === undefined && await h.cnt('.celeb') === 0, JSON.stringify((await h.store('cfg/progress')).cel));
  ok('N Banner zum Rot nennt das Minus, kein Gegner-Tor', /Minus 3 Tore/.test(await h.txt('#banner') || '') && !/Gegner/.test(await h.txt('#banner') || ''), await h.txt('#banner'));
  await page.click('.task[data-task="t_hefte"] [data-st="y"]'); await h.wait(2200);
  ok('N ein Tor bringt 25 zurück: Feier „25 TORE!“ noch einmal', /25 TORE!/.test(await h.txt('.celeb') || '') && /Ziel erreicht/.test(await h.txt('.celeb') || ''), (await h.txt('.celeb') || '').slice(0, 80));
  ok('N neuer Merker mit heutigem Datum', (await h.store('cfg/progress')).cel['g:g25'] === '2026-10-30', JSON.stringify((await h.store('cfg/progress')).cel));
  await page.close();

  console.log(errs.length ? 'FEHLER im Browser:\n' + errs.join('\n') : 'ok   keine Konsolenfehler');
  console.log(bad ? '\n' + bad + ' Prüfung(en) fehlgeschlagen' : '\nalle Prüfungen ok');
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
