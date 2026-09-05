const fs = require('fs');
const files = ['src/app/dashboard.tsx', 'src/app/settings.tsx', 'src/app/quests.tsx', 'src/app/shop.tsx', 'src/app/avatar-builder.tsx', 'src/app/pairing.tsx', 'src/app/chat.tsx'];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/require\('\.\.\/\.\.\/assets\/images\/cosmetics\/backgrounds\/Nuit\.png'\)/g, "require('../../assets/images/nousdeux_dark_background.png')");
  fs.writeFileSync(f, c, 'utf8');
});
console.log('Fixed background images');
