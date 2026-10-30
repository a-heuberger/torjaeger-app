// Baut aus src/ zusammen:
//  build/torjaeger.html       = Inhalt der Claude-Seite (ohne <html>/<head>/<body>), wird per Artifact-Werkzeug veröffentlicht
//  build/torjaeger.test.html  = derselbe Inhalt im Dokument-Rahmen der Plattform (für die Tests)
//  docs/                      = die Web-App für den iPhone-Home-Bildschirm (GitHub Pages liefert diesen Ordner aus)
//  build/pwa-test/            = dieselbe Web-App mit gelockerter Sicherheitsrichtlinie für den Firebase-Emulator (nur Tests)
// Symbole liegen fertig in assets/ (erzeugen: node tools/icons.js).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = __dirname;
const r = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const sha = (s, enc) => crypto.createHash('sha256').update(s).digest(enc || 'hex');
const mkdir = d => fs.mkdirSync(d, { recursive: true });

const parts = ['logic.js', 'svg.js', 'fx.js', 'store.js', 'cloud.js', 'views.js', 'actions.js'].map(r).join('\n');
const body = r('body.html');

/* ---- Claude-Seite ---- */
function buildArtifact() {
  mkdir(path.join(root, 'build'));
  const html = [
    '<title>Bens Torjäger-Challenge</title>',
    '<meta name="claude:viewport-fit-sides" content="cover">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800;1,900&family=Barlow:wght@500;600;700&display=swap">',
    '<style>\n' + r('style.css') + '\n</style>',
    body,
    '<script>\n(function () {\n"use strict";\n' + parts + '\n})();\n</script>',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'build/torjaeger.html'), html);
  const reset = ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html,body{margin:0}body{font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}';
  fs.writeFileSync(path.join(root, 'build/torjaeger.test.html'),
    '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + reset + '</style></head><body>' + html + '</body></html>');
  console.log('Claude-Seite:', (html.length / 1024).toFixed(1), 'KB');
}

/* ---- Web-App ---- */
const FONTS = [   // Familie, Gewicht, Kursiv
  ['Barlow', 500, 0], ['Barlow', 600, 0], ['Barlow', 700, 0],
  ['Barlow Condensed', 600, 0], ['Barlow Condensed', 700, 0], ['Barlow Condensed', 800, 0],
  ['Barlow Condensed', 700, 1], ['Barlow Condensed', 800, 1], ['Barlow Condensed', 900, 1],
];
const slug = f => f.toLowerCase().replace(/ /g, '-');
function fontFiles(out) {
  mkdir(path.join(out, 'fonts'));
  return FONTS.map(([fam, w, it]) => {
    const name = slug(fam) + '-latin-' + w + '-' + (it ? 'italic' : 'normal') + '.woff2';
    const src = path.join(root, 'node_modules/@fontsource', slug(fam), 'files', name);
    fs.copyFileSync(src, path.join(out, 'fonts', name));
    return '@font-face{font-family:"' + fam + '";font-style:' + (it ? 'italic' : 'normal') + ';font-weight:' + w + ';font-display:swap;src:url(fonts/' + name + ') format("woff2")}';
  }).join('\n');
}
function bundleFirebase(out) {
  const esbuild = require('esbuild');
  esbuild.buildSync({ entryPoints: [path.join(root, 'tools/firebase-entry.js')], bundle: true, minify: true, format: 'iife', globalName: 'FB', target: ['safari15', 'chrome100'], legalComments: 'none', outfile: path.join(out, 'firebase.js'), logLevel: 'error' });
}
function buildPwa(out, test) {
  fs.rmSync(out, { recursive: true, force: true }); mkdir(out);
  const script = '\n"use strict";\nwindow.__PWA__ = true;\n(function () {\n"use strict";\n' + parts + '\n})();\n';
  const csp = [
    "default-src 'none'",
    "script-src 'self' 'sha256-" + sha(script, 'base64') + "'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://www.google.com",      // das Firebase-SDK prüft damit bei Störungen, ob überhaupt Netz da ist (cleardot.gif)
    "font-src 'self'",
    "connect-src 'self' https://firestore.googleapis.com wss://firestore.googleapis.com" + (test ? ' http://127.0.0.1:* http://localhost:*' : ''),
    "manifest-src 'self'", "worker-src 'self'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
  const html = [
    '<!doctype html>', '<html lang="de">', '<head>', '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta http-equiv="Content-Security-Policy" content="' + csp + '">',
    '<title>Torjäger</title>',
    '<meta name="robots" content="noindex, nofollow">',
    '<meta name="theme-color" content="#06110b">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Torjäger">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<link rel="manifest" href="manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="icon-180.png">',
    '<link rel="icon" type="image/png" href="icon-192.png">',
    '<style>\n' + fontFiles(out) + '\n' + r('style.css') + '\n</style>',
    '<script src="firebase.js"></script>',
    '</head>', '<body>', body,
    '<script>' + script + '</script>',
    '</body>', '</html>',
  ].join('\n');
  fs.writeFileSync(path.join(out, 'index.html'), html);
  bundleFirebase(out);
  for (const f of ['manifest.webmanifest', 'robots.txt', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    const p = path.join(root, 'assets', f);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(out, f)); else console.warn('Fehlt in assets/:', f);
  }
  const version = sha(html + fs.readFileSync(path.join(out, 'firebase.js'), 'utf8')).slice(0, 12);
  const fonts = fs.readdirSync(path.join(out, 'fonts')).sort().map(n => 'fonts/' + n);
  fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(root, 'assets/sw.template.js'), 'utf8').replace('__VERSION__', version).replace('__FONTS__', JSON.stringify(fonts)));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  const size = d => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
  console.log((test ? 'Web-App (Test): ' : 'Web-App: ') + path.relative(root, out) + ' | Version ' + version + ' | ' + (size(out) / 1024).toFixed(0) + ' KB gesamt');
}

const only = process.argv[2];
if (!only || only === 'artifact') buildArtifact();
if (!only || only === 'pwa') { buildPwa(path.join(root, 'docs'), false); buildPwa(path.join(root, 'build/pwa-test'), true); }
