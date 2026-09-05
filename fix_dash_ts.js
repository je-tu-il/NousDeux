const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  '<View style={styles.root}>',
  '<View style={{ flex: 1 }}>'
);

code = code.replace(
  'renderAvatar(store.avatarUrl,',
  'renderAvatar(store.avatar,'
);

code = code.replace(
  "doc(db, 'couples', partner.coupleId)",
  "doc(db, 'couples', partner.coupleId as string)"
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Fixed dashboard TS errors!");
