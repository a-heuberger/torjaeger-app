// Baut den Familienlink aus App-Adresse, Familiencode und der Firebase-Konfiguration.
// Aufruf:  node tools/familienlink.js <App-Adresse> <Familiencode> <Datei mit dem Konfigurationsblock | -> [--emulator host:port]
// Der Block ist das „const firebaseConfig = { … }“ aus der Firebase-Konsole (JavaScript oder JSON, beides geht).
const fs = require('fs');
const args = process.argv.slice(2); const emu = args.indexOf('--emulator') >= 0 ? args.splice(args.indexOf('--emulator'), 2)[1] : null;
const [url, code, file] = args;
const fail = m => { console.error(m); process.exit(1); };
if (!url || !code || !file) fail('Aufruf: node tools/familienlink.js <App-Adresse> <Familiencode> <Konfigurationsdatei | ->');
if (!/^[A-Z2-9]{16}$/.test(code)) fail('Der Familiencode muss aus 16 Zeichen (A-Z, 2-9) bestehen. Neuen erzeugen: node tools/familiencode.js');
const txt = fs.readFileSync(file === '-' ? 0 : file, 'utf8');
const f = {};
for (const k of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']) {
  const m = new RegExp(k + '["\']?\\s*:\\s*["\']([^"\']+)["\']').exec(txt); if (m) f[k] = m[1];
}
if (!f.projectId || !f.apiKey) fail('In der Konfiguration fehlen apiKey und/oder projectId.');
const payload = { k: code, f };
if (emu) { const [host, port] = emu.split(':'); payload.e = { host, port: +port }; }
console.log(url.replace(/#.*$/, '') + '#c=' + Buffer.from(JSON.stringify(payload)).toString('base64url'));
