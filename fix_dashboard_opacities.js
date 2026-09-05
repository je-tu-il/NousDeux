const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

// Quests contrast
code = code.replace(
  "backgroundColor: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)'",
  "backgroundColor: 'rgba(234,179,8,0.25)', borderColor: 'rgba(234,179,8,0.6)'"
);

// Shop (cosmetic) contrast
code = code.replace(
  "backgroundColor: 'rgba(236,72,153,0.1)', borderColor: 'rgba(236,72,153,0.3)'",
  "backgroundColor: 'rgba(236,72,153,0.25)', borderColor: 'rgba(236,72,153,0.6)'"
);

// Question du jour contrast (from 0.08 / 0.25 to 0.2 / 0.5)
code = code.replace(
  "backgroundColor: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.25)'",
  "backgroundColor: 'rgba(168,85,247,0.2)', borderColor: 'rgba(168,85,247,0.5)'"
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Fixed dashboard opacities!");
