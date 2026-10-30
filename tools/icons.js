// Zeichnet die App-Symbole (Trikot Nr. 10 mit Ball auf dunklem Rasen) nach assets/. Aufruf: node tools/icons.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const src = ['logic.js', 'svg.js'].map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
  const fontCss = [['Barlow Condensed', 900, 'italic', 'barlow-condensed-latin-900-italic.woff2']].map(([fam, w, st, f]) =>
    '@font-face{font-family:"' + fam + '";font-weight:' + w + ';font-style:' + st + ';src:url(file://' + path.join(root, 'node_modules/@fontsource/barlow-condensed/files', f) + ') format("woff2")}').join('');
  // name, Kantenlänge, Anteil der Fläche, den das Motiv nutzt (maskable: kleiner, damit nichts abgeschnitten wird)
  const targets = [['icon-512', 512, 1], ['icon-192', 192, 1], ['icon-180', 180, 1], ['icon-maskable-512', 512, 0.76]];
  const b = await chromium.launch();
  for (const [name, S, k] of targets) {
    const page = await b.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
    const html = '<!doctype html><html><head><meta charset="utf-8"><style>' + fontCss + 'html,body{margin:0;width:' + S + 'px;height:' + S + 'px;overflow:hidden}' +
      'body{position:relative;background:radial-gradient(120% 90% at 50% 18%,#1f6e36 0%,#0c3318 48%,#06110b 100%)}' +
      '.st{position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.045) 0 ' + S / 8 + 'px,rgba(0,0,0,0) ' + S / 8 + 'px ' + S / 4 + 'px)}' +
      '.m{position:absolute;left:50%;top:50%;width:' + S * k + 'px;height:' + S * k + 'px;transform:translate(-50%,-50%)}' +
      '.j{position:absolute;left:11%;top:6%;width:78%;filter:drop-shadow(0 ' + S * 0.02 + 'px ' + S * 0.035 + 'px rgba(0,0,0,.55))}.j svg{width:100%;height:auto;display:block}' +
      '.bl{position:absolute;right:8%;bottom:7%;width:34%;filter:drop-shadow(0 ' + S * 0.015 + 'px ' + S * 0.03 + 'px rgba(0,0,0,.6))}.bl svg{width:100%;height:auto;display:block}</style></head><body>' +
      '<div class="st"></div><div class="m"><div class="j" id="j"></div><div class="bl" id="bl"></div></div>' +
      '<script>const esc=s=>String(s);\n' + src + '\ndocument.body.insertAdjacentHTML("afterbegin", SVG_DEFS);document.getElementById("j").innerHTML=jerseySVG("green",10,100,0);document.getElementById("bl").innerHTML=ballSVG(100);<\/script></body></html>';
    await page.setContent(html); await page.waitForTimeout(400);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, 'assets', name + '.png'), omitBackground: false });
    await page.close();
  }
  await b.close();
  console.log('Symbole geschrieben:', targets.map(t => t[0]).join(', '));
})();
