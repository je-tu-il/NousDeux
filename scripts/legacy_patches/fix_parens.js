const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  "          )}\n          )}\n        </View>",
  "          )}\n        </View>"
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Fixed dangling parenthesis!");
