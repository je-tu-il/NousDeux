const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  '<ScrollView style={{ flex: 1 }}',
  '<ScrollView style={styles.safeArea}'
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Restored safeArea to ScrollView!");
