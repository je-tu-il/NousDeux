const fs = require('fs');
let code = fs.readFileSync('src/app/quests.tsx', 'utf8');

code = code.replace(/romantic_calendar_bg\.png/g, 'nousdeux_warm_background.png');

fs.writeFileSync('src/app/quests.tsx', code);
console.log("Quests fixed!");
