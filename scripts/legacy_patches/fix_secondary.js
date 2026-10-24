const fs = require('fs');
const files = ['src/app/dashboard.tsx', 'src/app/settings.tsx', 'src/app/quests.tsx', 'src/app/shop.tsx', 'src/app/avatar-builder.tsx', 'src/app/pairing.tsx', 'src/app/chat.tsx', 'src/components/QuestCard.tsx'];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/color:\s*'#A99693'/g, 'color: theme.tabIconDefault');
  c = c.replace(/color:\s*'#7D6B68'/g, 'color: theme.tabIconDefault');
  c = c.replace(/color="#A99693"/g, 'color={theme.tabIconDefault}');
  c = c.replace(/placeholderTextColor="#A99693"/g, 'placeholderTextColor={theme.tabIconDefault}');
  c = c.replace(/backgroundColor:\s*'#7D6B68'/g, 'backgroundColor: theme.tabIconDefault');
  fs.writeFileSync(f, c, 'utf8');
});
console.log('Fixed secondary colors');
