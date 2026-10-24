const fs = require('fs');
let c = fs.readFileSync('src/app/avatar-builder.tsx', 'utf8');
c = c.replace(/color="#4A3B39"/g, 'color={theme.icon}');
fs.writeFileSync('src/app/avatar-builder.tsx', c, 'utf8');
console.log('Fixed avatar-builder.tsx');
