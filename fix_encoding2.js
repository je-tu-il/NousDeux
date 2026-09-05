const fs = require('fs');
const files = ['src/app/dashboard.tsx', 'src/app/quests.tsx', 'src/components/QuestCard.tsx'];
files.forEach(f => {
  let txt = fs.readFileSync(f, 'utf8');
  txt = txt.replace(/Ǹ/g, 'é')
           .replace(/Ǧ/g, 'ê')
           .replace(/Bient.t/g, 'Bientôt');
  fs.writeFileSync(f, txt, 'utf8');
});
console.log('Fixed more encodings!');
