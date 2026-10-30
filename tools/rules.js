// Gibt die Firestore-Regeln für einen Familiencode aus. Aufruf: node tools/rules.js ABCDEFGH23456789 [Zieldatei]
const fs = require('fs'), path = require('path');
const code = process.argv[2];
if (!/^[A-Z2-9]{16}$/.test(code || '')) { console.error('Familiencode: 16 Zeichen aus A-Z und 2-9'); process.exit(1); }
const out = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules.template'), 'utf8').replace('FAMILIENCODE', code);
if (process.argv[3]) fs.writeFileSync(process.argv[3], out); else process.stdout.write(out);
