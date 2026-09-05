const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');
code = code.replace("require('../../assets/images/bg_home.png')", "require('../../assets/images/dashboard_bg.png')");
fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Fixed image require!");
