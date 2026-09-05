const fs = require('fs');
let code = fs.readFileSync('src/app/quests.tsx', 'utf8');

code = code.replace(
  "root: {\n    flex: 1,\n    backgroundColor: '#FFF5F2',",
  "root: {\n    flex: 1,\n    width: '100%',\n    height: '100%',\n    backgroundColor: '#FFF5F2',"
);

fs.writeFileSync('src/app/quests.tsx', code);
console.log("Quests root fixed!");
