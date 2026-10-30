const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const T = (a) => a;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.addInitScript(fs.readFileSync('test/mock-claude.js', 'utf8'));
  await page.clock.setFixedTime(new Date('2026-10-21T18:30:00'));   // Mittwoch
  await page.goto('file://' + path.resolve('build/torjaeger.test.html'));
  await page.waitForTimeout(900);
  const shot = n => page.screenshot({ path: 'shots/' + n + '.png' });
  const txt = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const cnt = sel => page.evaluate(s => document.querySelectorAll(s).length, sel);
  const log = (...a) => console.log(...a);

  // 1) Einlauf
  await page.click('.sw-c[data-c="blue"]');
  await page.click('[data-act="ob-rival"][data-v="Dynamo Ausrede"]');
  await page.fill('#ob-pin', '1234');
  await page.click('[data-act="ob-go"]');
  await page.waitForTimeout(700);
  log('nach einlauf: sheet?', await cnt('.sheet'), '| banner:', await txt('#banner'), '| name:', await txt('.nm'), '| gegner:', await txt('.board .team:last-child .tn'));
  await shot('s02-heute-gesperrt');

  // 2) Entsperren
  await page.click('[data-act="lock"]');
  for (const n of ['1', '2', '3', '4']) await page.click('[data-act="pin-key"][data-n="' + n + '"]');
  await page.waitForTimeout(500);
  log('entsperrt? lock-button on:', await cnt('.lockbtn.on'), '| seg-reihen:', await cnt('.seg'));
  await shot('s03-heute-trainer');

  // 3) Drei Tore bestätigen -> Schuss-Leiste
  for (const id of ['t_notiert', 't_hausaufgaben', 't_zimmer']) await page.click('.task[data-task="' + id + '"] .b-y');
  await page.waitForTimeout(300);
  log('schussleiste:', await cnt('.shotbar'), '| text:', await txt('.shotbtn .st'), '| punkte:', await txt('#scoreN'), '| bereit-stempel:', await cnt('.stamp.ready'));
  await shot('s04-schussleiste');

  // 4) Ein Einzelschuss (Tippen), mitten im Flug ein Bild
  await page.click('.shotbtn');
  await page.waitForTimeout(260);
  await shot('s05-ballflug');
  await page.waitForTimeout(900);
  log('nach einzelschuss -> punkte:', await txt('#scoreN'), '| wartend:', await cnt('.stamp.ready'), '| banner:', await txt('#banner'));

  // 5) Salve (Halten)
  const bb = await page.locator('.shotbtn').boundingBox();
  await page.mouse.move(bb.x + 30, bb.y + 25); await page.mouse.down(); await page.waitForTimeout(750); await shot('s06-laden'); await page.mouse.up();
  await page.waitForTimeout(1800);
  log('nach salve -> punkte:', await txt('#scoreN'), '| wartend:', await cnt('.stamp.ready'), '| schussleiste:', await cnt('.shotbar'), '| banner:', await txt('#banner'));
  await shot('s07-nach-salve');

  // 5b) Es gibt keine Etappen-Feiern mehr: beim ersten Tor kommt nichts dazwischen
  await page.waitForTimeout(1500);
  log('feier sichtbar (erwartet 0):', await cnt('#celeb .celeb'), '| banner:', await txt('#banner'));

  // 6) Ein Kein-Tor, ein Tor -> Abpfiff
  await page.click('.task[data-task="t_abmachung"] .b-n');
  await page.waitForTimeout(400);
  log('nach kein tor: punkte', await txt('#scoreN'), 'gegner', await txt('.digits .rv'), '| banner:', await txt('#banner'));
  await page.click('.task[data-task="t_hefte"] .b-y');
  await page.waitForTimeout(300);
  await page.click('.shotbtn'); await page.waitForTimeout(1200);
  log('abpfiff? punkte', await txt('#scoreN'), 'gegner', await txt('.digits .rv'), '| badge:', await txt('.score .badge'), '| banner:', await txt('#banner'));
  await shot('s08-abpfiff');

  console.log(errs.length ? 'FEHLER:\n' + errs.join('\n') : 'keine Konsolenfehler');
  const keys = await page.evaluate(() => [...window.__mock.store.keys()]);
  log('gespeicherte Dokumente:', keys.join(', '));
  await b.close();
})();
