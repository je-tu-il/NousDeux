const fs = require('fs');
const files = ['src/app/dashboard.tsx', 'src/app/quests.tsx', 'src/components/QuestCard.tsx', 'src/app/settings.tsx', 'src/app/avatar-builder.tsx', 'src/app/shop.tsx'];
files.forEach(f => {
  let txt = fs.readFileSync(f, 'utf8');
  const initial = txt;
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
           .replace(/Ã¯/g, 'ï')
           .replace(/Bient.t/g, 'Bientôt')
           .replace(/rǸsolution/g, 'résolution')
           .replace(/tr.s/g, 'très')
           .replace(/Ǹ/g, 'é')
           .replace(/Ǧ/g, 'ê')
           .replace(/Y'/g, '🚀')
           .replace(/Y'T/g, '🌙')
           .replace(/Y'Z/g, '👾')
           .replace(/YZ/g, '👗')
           .replace(/YO/g, '🌸')
           .replace(/YZ%/g, '🎁')
           .replace(/Y\?/g, '🏆');
  if (initial !== txt) {
    fs.writeFileSync(f, txt, 'utf8');
    console.log('Fixed', f);
  }
});
