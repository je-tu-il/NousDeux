const fs = require('fs');
const code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');
const startIndex = code.indexOf('Modal Mon Profil');
console.log(code.substring(startIndex, startIndex + 1000));
