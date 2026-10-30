// Guthabenkonto: Gutschreiben (Noten), Abbuchen (nur mit Ja), Auszahlen, Löschen, Speichern, Mitlesen, Einstellungen
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = 'file://' + path.resolve('build/torjaeger.test.html');
const errs = [];
let bad = 0;
const ok = (name, cond, info) => { if (!cond) bad++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? ' | ' + info : '')); };
const NB = ' ';            // h.txt macht aus geschützten Leerzeichen normale
const BASE = () => ({
  'cfg/main': { name: 'Ben', rival: 'Sofa United', cardsAck: true, season: { start: '2026-10-19' } },
  'cfg/progress': { cel: {}, red: {}, seasons: [], album: [], foil: [], pick: {} },
});
async function open(b, preload, o = {}) {
  const ctx = o.ctx || await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  if (preload) await page.addInitScript(d => { window.__preload = d; }, preload);
  if (o.readonly) await page.addInitScript(() => { window.__readonly = true; });
  if (!o.noMock) await page.addInitScript(fs.readFileSync('test/mock-claude.js', 'utf8'));
  await page.clock.setFixedTime(new Date('2026-10-21T18:30:00'));
  await page.goto(URL); await page.waitForTimeout(900);
  return page;
}
const H = page => ({
  txt: sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel),
  cnt: sel => page.evaluate(s => document.querySelectorAll(s).length, sel),
  wait: ms => page.waitForTimeout(ms),
  konto: () => page.evaluate(() => [...window.__mock.store.keys()].filter(k => k.startsWith('konto/')).length),
});
(async () => {
  const b = await chromium.launch();
  let page = await open(b, BASE());
  let h = H(page);

  // ---- A) Konto-Tab, leer, nur ansehen ----
  ok('A fünf Tabs mit Konto (Heute, Woche, Erfolge, Konto, Trainer)', await h.cnt('.tab') === 5 && await h.cnt('.tab[data-tab="konto"]') === 1, 'Tabs: ' + await h.cnt('.tab'));
  await page.click('.tab[data-tab="konto"]'); await h.wait(300);
  ok('A leer: 0,00 € und freundlicher Hinweis', (await h.txt('#kontoSum')) === '0,00' + NB + '€' && /Noch nichts auf dem Konto/.test(await h.txt('.kh-tx small') || ''), await h.txt('#kontoSum'));
  ok('A gesperrt: keine Buchungsknöpfe', await h.cnt('.kbtns') === 0 && /Noch keine Buchungen/.test(await h.txt('main') || ''));
  ok('A Überschrift im Genitiv', /Bens Konto/i.test(await h.txt('.konto-hero .eyebrow') || ''), await h.txt('.konto-hero .eyebrow'));

  // ---- B) Entsperren, Note gutschreiben ----
  await page.click('[data-act="lock"]'); await h.wait(300);
  ok('B vier Knöpfe', await h.cnt('.kbtns .xbtn') === 4);
  await page.click('[data-act="konto-open"][data-k="note"]'); await h.wait(300);
  const grades = await page.evaluate(() => Array.from(document.querySelectorAll('.vals.grades button')).map(e => (e.querySelector('b').textContent + ' ' + e.querySelector('small').textContent).replace(/\s+/g, ' ').trim()));
  ok('B nur Noten mit Betrag (1 bis 3), Beträge 5/3/2 €', JSON.stringify(grades) === JSON.stringify(['1 5,00' + NB + '€', '2 3,00' + NB + '€', '3 2,00' + NB + '€']), JSON.stringify(grades));
  await page.click('[data-act="kx-save"]'); await h.wait(200);
  ok('B ohne Note: Hinweis, Fenster bleibt', /zuerst die Note wählen/.test(await h.txt('#toast') || '') && await h.cnt('.sheet') === 1, await h.txt('#toast'));
  await page.click('[data-act="kx-grade"][data-g="1"]'); await h.wait(200);
  ok('B Note 1 setzt 5,00 vor, Vorschau stimmt', (await page.inputValue('#kx-amt')) === '5,00' && /Danach auf dem Konto: 5,00/.test(await h.txt('#kx-after') || ''), await page.inputValue('#kx-amt') + ' | ' + await h.txt('#kx-after'));
  await page.click('[data-act="kx-save"]'); await h.wait(500);
  ok('B 5,00 € gutgeschrieben', (await h.txt('#kontoSum')) === '5,00' + NB + '€' && await h.cnt('.kl .ev.good') === 1, await h.txt('#kontoSum'));
  ok('B Einblendung', /5,00.*gutgeschrieben/.test(await h.txt('#banner') || ''), await h.txt('#banner'));
  ok('B Eintrag im Mock-Speicher', await h.konto() === 1);
  // Note 2 mit eigenem Betrag und Fach
  await page.click('[data-act="konto-open"][data-k="note"]'); await h.wait(250);
  await page.click('[data-act="kx-grade"][data-g="2"]'); await h.wait(150);
  await page.fill('#kx-amt', '3,50'); await page.fill('#kx-text', 'Mathe'); await h.wait(150);
  ok('B Vorschau nach Eingabe: 8,50', /Danach auf dem Konto: 8,50/.test(await h.txt('#kx-after') || ''), await h.txt('#kx-after'));
  await page.click('[data-act="kx-save"]'); await h.wait(500);
  ok('B 8,50 € und „Note 2: Mathe“', (await h.txt('#kontoSum')) === '8,50' + NB + '€' && /Note 2: Mathe/.test(await h.txt('.kl') || ''), await h.txt('#kontoSum'));
  // ungültiger Betrag
  await page.click('[data-act="konto-open"][data-k="plus"]'); await h.wait(250);
  await page.fill('#kx-amt', 'abc'); await page.click('[data-act="kx-save"]'); await h.wait(200);
  ok('B ungültiger Betrag wird abgelehnt', /Betrag über 0/.test(await h.txt('#toast') || '') && await h.cnt('.sheet') === 1);
  await page.click('.sheet [data-act="sheet-close"]'); await h.wait(250);

  // ---- C) Abbuchen nur mit Ja, nie über das Guthaben ----
  await page.click('[data-act="konto-open"][data-k="minus"]'); await h.wait(250);
  await page.click('[data-act="kx-amt"][data-c="200"]'); await h.wait(150);
  await page.fill('#kx-amt', '2,50'); await page.click('[data-act="kx-chip"][data-t="Eis"]'); await h.wait(200);
  ok('C Abbuchen-Fenster fragt nach dem Ja', await h.cnt('[data-act="kx-ok"]') === 1 && /hat dazu Ja gesagt/.test(await h.txt('.sheet') || ''));
  await page.click('[data-act="kx-save"]'); await h.wait(200);
  ok('C ohne Ja keine Abbuchung', /hat dazu Ja gesagt/.test(await h.txt('#toast') || '') && (await h.txt('#kontoSum')) === '8,50' + NB + '€', await h.txt('#toast'));
  await page.click('[data-act="kx-ok"]'); await h.wait(150);
  ok('C Betrag und Grund blieben beim Umschalten stehen', (await page.inputValue('#kx-amt')) === '2,50' && (await page.inputValue('#kx-text')) === 'Eis');
  await page.click('[data-act="kx-save"]'); await h.wait(500);
  ok('C 6,00 € nach der Abbuchung, Zeile „Eis“ mit −2,50 €', (await h.txt('#kontoSum')) === '6,00' + NB + '€' && /Eis/.test(await h.txt('.kl') || '') && /−2,50/.test(await h.txt('.kl .ev.out') || ''), await h.txt('.kl .ev.out'));
  await page.click('[data-act="konto-open"][data-k="minus"]'); await h.wait(250);
  await page.fill('#kx-amt', '20'); await page.click('[data-act="kx-ok"]'); await h.wait(150);
  ok('C Vorschau warnt', /reicht nicht/.test(await h.txt('#kx-after') || ''), await h.txt('#kx-after'));
  await page.click('[data-act="kx-save"]'); await h.wait(200);
  ok('C über dem Guthaben: abgelehnt, Konto bleibt bei 6,00 €', /reicht nicht/.test(await h.txt('#toast') || '') && (await h.txt('#kontoSum')) === '6,00' + NB + '€' && await h.cnt('.sheet') === 1);
  await page.click('.sheet [data-act="sheet-close"]'); await h.wait(250);

  // ---- D) Auszahlen, dann leer ----
  await page.click('[data-act="konto-open"][data-k="pay"]'); await h.wait(250);
  ok('D Auszahlen: ganzer Betrag und „Ausgezahlt“ vorbelegt', (await page.inputValue('#kx-amt')) === '6,00' && (await page.inputValue('#kx-text')) === 'Ausgezahlt');
  await page.click('[data-act="kx-save"]'); await h.wait(500);
  ok('D nach der Auszahlung 0,00 €', (await h.txt('#kontoSum')) === '0,00' + NB + '€' && await h.cnt('.kh-sum.zero') === 1 && await h.cnt('.kl .ev') === 4, await h.txt('#kontoSum') + ' | Zeilen ' + await h.cnt('.kl .ev'));
  await page.click('[data-act="konto-open"][data-k="pay"]'); await h.wait(250);
  ok('D bei leerem Konto kein Fenster, sondern Hinweis', await h.cnt('.sheet') === 0 && /nichts, das sich abbuchen lässt/.test(await h.txt('#toast') || ''), await h.txt('#toast'));

  // ---- E) Eine Buchung löschen ----
  await page.click('.kl .ev.out [data-act="konto-del"]'); await h.wait(250);
  ok('E Rückfrage nennt die Buchung', /Eis/.test(await h.txt('.sheet') || '') && /Buchung löschen/.test(await h.txt('.sheet') || ''), await h.txt('.sheet'));
  await page.click('[data-act="confirm-yes"]'); await h.wait(400);
  ok('E danach 2,50 € mehr (Eis weg)', (await h.txt('#kontoSum')) === '2,50' + NB + '€' && await h.cnt('.kl .ev') === 3 && await h.konto() === 3, await h.txt('#kontoSum') + ' | gespeichert ' + await h.konto());

  // ---- F) Nach dem Neuladen steht alles noch da; nur ansehen sieht dasselbe ohne Knöpfe ----
  const store = await page.evaluate(() => Object.fromEntries(window.__mock.store));
  await page.close();
  page = await open(b, store); h = H(page);
  await page.click('.tab[data-tab="konto"]'); await h.wait(300);
  ok('F nach dem Neuladen 2,50 € und drei Buchungen', (await h.txt('#kontoSum')) === '2,50' + NB + '€' && await h.cnt('.kl .ev') === 3, await h.txt('#kontoSum'));
  await page.close();
  // ---- G) Zweites Gerät schreibt und löscht live mit ----
  page = await open(b, store); h = H(page);
  await page.click('.tab[data-tab="konto"]'); await h.wait(300);
  await page.evaluate(async () => { const db = await window.claude.use('db'); await db.doc('konto/kfremd1').set({ ts: Date.now(), ds: '2026-10-21', c: 700, k: 'plus', t: 'Geschenk' }); });
  await h.wait(500);
  ok('G fremde Gutschrift erscheint live (9,50 €)', (await h.txt('#kontoSum')) === '9,50' + NB + '€', await h.txt('#kontoSum'));
  await page.evaluate(async () => { const db = await window.claude.use('db'); await db.doc('konto/kfremd1').delete(); });
  await h.wait(500);
  ok('G fremde Löschung wirkt live (2,50 €)', (await h.txt('#kontoSum')) === '2,50' + NB + '€', await h.txt('#kontoSum'));
  await page.close();

  // ---- F2) Nur ansehen: Summe und Liste sichtbar, aber keine Knöpfe und keine Löschen-Kreuze ----
  page = await open(b, store, { readonly: true }); h = H(page);
  await page.click('.tab[data-tab="konto"]'); await h.wait(300);
  ok('F2 nur ansehen: Summe sichtbar, vier Tabs, keine Knöpfe, keine Löschen-Kreuze', (await h.txt('#kontoSum')) === '2,50' + NB + '€' && await h.cnt('.kbtns') === 0 && await h.cnt('[data-act="konto-del"]') === 0 && await h.cnt('.tab') === 4, await h.txt('#kontoSum'));
  await page.close();

  // ---- H) Einstellungen: Beträge je Note ----
  page = await open(b, BASE()); h = H(page);
  await page.click('[data-act="lock"]'); await page.click('.tab[data-tab="coach"]'); await h.wait(400);
  ok('H sechs Zeilen „Note 1 bis 6“ mit 5,00 / 3,00 / 2,00 / 0,00 …', await h.cnt('.kline') === 6 && (await page.evaluate(() => Array.from(document.querySelectorAll('.kline output')).map(o => o.textContent.trim()).join('|'))) === ['5,00', '3,00', '2,00', '0,00', '0,00', '0,00'].map(x => x + '\u00a0€').join('|'));
  await page.click('[data-act="step"][data-key="4"][data-d="50"]'); await page.click('[data-act="step"][data-key="1"][data-d="-50"]'); await h.wait(300);
  await page.click('.tab[data-tab="konto"]'); await h.wait(300);
  await page.click('[data-act="konto-open"][data-k="note"]'); await h.wait(250);
  const g2 = await page.evaluate(() => Array.from(document.querySelectorAll('.vals.grades button')).map(e => (e.querySelector('b').textContent + ' ' + e.querySelector('small').textContent).replace(/\s+/g, ' ').trim()));
  ok('H geänderte Beträge wirken: Note 1 = 4,50 €, Note 4 jetzt dabei mit 0,50 €', g2.length === 4 && g2[0] === '1 4,50' + NB + '€' && g2[3] === '4 0,50' + NB + '€', JSON.stringify(g2));
  await page.click('.sheet [data-act="sheet-close"]'); await h.wait(200);
  await page.click('[data-act="rules"]', { timeout: 2000 }).catch(() => {});
  await page.click('.tab[data-tab="today"]'); await h.wait(300);
  await page.click('[data-act="rules"]'); await h.wait(300);
  const rb = await h.txt('.sheet') || '';
  ok('H Regelbuch: Dein Konto, nur mit Ja, nie als Strafe', /Dein Konto/.test(rb) && /mit deinem Ja\. Nie als Strafe/.test(rb) && !/4,50|5,00/.test(rb), rb.slice(rb.indexOf('Dein Konto'), rb.indexOf('Dein Konto') + 80));
  await page.click('.sheet [data-act="sheet-close"]'); await h.wait(200);
  await page.click('.tab[data-tab="coach"]'); await h.wait(300);
  await page.click('[data-act="parents"]'); await h.wait(300);
  ok('H Hinweise für Eltern: Anerkennung, keine Bedingung', /Geld auf dem Konto ist Anerkennung, keine Bedingung/.test(await h.txt('.sheet') || '') && /Bens Ja/.test(await h.txt('.sheet') || ''));
  await page.close();

  // ---- I) Ohne Datenbank (nur dieses Gerät): Konto bleibt über Neuladen erhalten ----
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page = await open(b, null, { ctx, noMock: true }); h = H(page);
  await page.click('[data-act="ob-go"]'); await h.wait(500);
  await page.click('[data-act="lock"]'); await page.click('.tab[data-tab="konto"]'); await h.wait(300);
  await page.click('[data-act="konto-open"][data-k="note"]'); await h.wait(250);
  await page.click('[data-act="kx-grade"][data-g="3"]'); await page.click('[data-act="kx-save"]'); await h.wait(500);
  ok('I lokal: 2,00 € gebucht', (await h.txt('#kontoSum')) === '2,00' + NB + '€', await h.txt('#kontoSum'));
  await page.reload(); await h.wait(900);
  await page.click('.tab[data-tab="konto"]'); await h.wait(300);
  ok('I lokal: nach dem Neuladen noch da', (await h.txt('#kontoSum')) === '2,00' + NB + '€', await h.txt('#kontoSum'));
  await ctx.close();

  ok('keine Konsolenfehler', errs.length === 0, errs.join(' | '));
  console.log(bad ? '\n' + bad + ' FEHLER' : '\nalle Prüfungen ok');
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
