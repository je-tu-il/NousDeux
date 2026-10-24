const fs = require('fs');
let c = fs.readFileSync('src/app/quests.tsx', 'utf8');
c = c.replace(/}\r?\n\r?\n\r?\n  const store = useOnboardingStore/, '}\n\nexport default function QuestsScreen() {\n  const store = useOnboardingStore');
fs.writeFileSync('src/app/quests.tsx', c, 'utf8');

let c2 = fs.readFileSync('src/app/shop.tsx', 'utf8');
c2 = c2.replace(/(\u2014|\u2500|\u00E2\u201D\u20AC|â”€)+\r?\n\r?\n\r?\n  const store = useOnboardingStore/, 'â”€â”€â”€\n\nexport default function ShopScreen() {\n  const store = useOnboardingStore');
c2 = c2.replace(/(\n\n\n  const store = useOnboardingStore)/, '\n\nexport default function ShopScreen() {\n  const store = useOnboardingStore'); // Fallback
fs.writeFileSync('src/app/shop.tsx', c2, 'utf8');
console.log('Fixed component signatures in quests and shop');
