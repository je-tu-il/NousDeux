const fs = require('fs');
const files = ['src/app/shop.tsx', 'src/app/dashboard.tsx', 'src/app/quests.tsx', 'src/components/QuestCard.tsx', 'src/app/settings.tsx', 'src/app/avatar-builder.tsx'];
files.forEach(f => {
  let txt = fs.readFileSync(f, 'utf8');
  txt = txt.replace(/Ã©/g, 'é')
           .replace(/Ã¨/g, 'è')
           .replace(/Ã /g, 'à')
           .replace(/Ã¢/g, 'â')
           .replace(/Ãª/g, 'ê')
           .replace(/Ã®/g, 'î')
           .replace(/Ã´/g, 'ô')
           .replace(/Ã»/g, 'û')
           .replace(/Ã§/g, 'ç')
           .replace(/â€”/g, '—')
           .replace(/âœ…/g, '✅')
           .replace(/ðŸŒ¸/g, '🌸')
           .replace(/ðŸ‘—/g, '👗')
           .replace(/Ã‰/g, 'É')
           .replace(/ðŸ’Ž/g, '💎')
           .replace(/ðŸ˜Ž/g, '😎')
           .replace(/ðŸ’/g, '💰')
           .replace(/ðŸŽ/g, '🎯')
           .replace(/Â/g, '') // NBSP
           .replace(/ï¸ /g, '')
           .replace(/Ã¯/g, 'ï');
  fs.writeFileSync(f, txt, 'utf8');
});
console.log('Fixed encodings!');
