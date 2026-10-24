const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

// Change border radius of avatars to make them more square
code = code.replace(
  "userAvatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: 'white', overflow: 'hidden' },",
  "userAvatar: { width: 70, height: 70, borderRadius: 18, borderWidth: 3, borderColor: 'white', overflow: 'hidden' },"
);
code = code.replace(
  "partnerAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, overflow: 'hidden' },",
  "partnerAvatar: { width: 28, height: 28, borderRadius: 8, marginRight: 8, overflow: 'hidden' },"
);
code = code.replace(
  "modalAvatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: 'white', overflow: 'hidden' },",
  "modalAvatar: { width: 120, height: 120, borderRadius: 28, borderWidth: 4, borderColor: 'white', overflow: 'hidden' },"
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Avatar shapes made square!");
