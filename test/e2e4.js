// Zwei-Geräte-Test: Änderungen von außen kommen live an, eigene Schreibvorgänge flackern nicht
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const dump = { 'cfg/main': { name: 'Ben', rival: 'Sofa United', cardsAck: true, shootMode: false } };
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(d => { window.__preload = d; }, { 'cfg/main': dump['cfg/main'], 'cfg/progress': { cel: {}, red: {}, seasons: [], album: [], foil: [], pick: {} } });
  await page.addInitScript(fs.readFileSync('test/mock-claude.js', 'utf8'));
  await page.clock.setFixedTime(new Date('2026-10-21T18:30:00'));
  await page.goto('file://' + path.resolve('build/torjaeger.test.html')); await page.waitForTimeout(800);
  const txt = s => page.evaluate(q => { const e = document.querySelector(q); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, s);
  console.log('start: punkte', await txt('#scoreN'));
  // anderes Gerät trägt zwei Tore ein
  await page.evaluate(async () => { const db = await window.claude.use('db'); await db.doc('days/2026-10-21').set({ m: { t_notiert: 'y', t_hausaufgaben: 'y' }, ev: [] }); });
  await page.waitForTimeout(500);
  console.log('nach fremdem eintrag: punkte', await txt('#scoreN'), '| gesperrt, also kein schuss:', await page.evaluate(() => document.querySelectorAll('.shotbar').length));
  // anderes Gerät ändert die Einstellungen (Gegnername)
  await page.evaluate(async () => { const db = await window.claude.use('db'); const c = (await db.doc('cfg/main').get()).data(); await db.doc('cfg/main').set(Object.assign({}, c, { rival: 'FC Später' })); });
  await page.waitForTimeout(500);
  console.log('nach fremder einstellung: gegner', await txt('.board .team:last-child .tn'));
  // eigene Eingabe: Tippen im Textfeld darf nicht vom Echo überschrieben werden
  await page.click('[data-act="lock"]'); await page.click('.tab[data-tab="coach"]'); await page.waitForTimeout(300);
  await page.fill('#f-name', 'Ben'); 
  await page.locator('#f-name').pressSequentially(' Marco', { delay: 120 });
  await page.waitForTimeout(1500);
  console.log('eingabe nach echo:', await page.inputValue('#f-name'), '| writes:', await page.evaluate(() => window.__mock.calls.filter(c => c[1] === 'cfg/main').length));
  console.log(errs.length ? 'FEHLER: ' + errs.join(' | ') : 'keine Fehler');
  await b.close();
})();
