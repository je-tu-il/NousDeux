const fs = require('fs');
['src/app/shop.tsx', 'src/app/quests.tsx', 'src/app/dashboard.tsx', 'src/app/settings.tsx', 'src/app/daylink.tsx'].forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace("root:    { flex: 1, backgroundColor: '#FFF5F2' }", "root:    { flex: 1, width: '100%', height: '100%', backgroundColor: '#FFF5F2' }");
    content = content.replace("container: { flex: 1, backgroundColor: '#FFF5F2' }", "container: { flex: 1, width: '100%', height: '100%', backgroundColor: '#FFF5F2' }");
    fs.writeFileSync(file, content);
  }
});
