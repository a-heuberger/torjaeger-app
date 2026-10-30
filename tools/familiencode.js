// Würfelt einen neuen Familiencode (16 Zeichen, ohne verwechselbare I, O, 0, 1). Aufruf: node tools/familiencode.js
const crypto = require('crypto');
const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let c = ''; for (let i = 0; i < 16; i++) c += A[crypto.randomInt(A.length)];
console.log(c);
