const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  "paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 30,",
  "paddingTop: 20, paddingBottom: 20,"
);
code = code.replace(
  "borderBottomLeftRadius: 30, borderBottomRightRadius: 30,",
  "borderRadius: 30,"
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Fixed banner styling!");
