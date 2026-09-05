let c = require('fs').readFileSync('src/app/chat.tsx', 'utf8');
c = c.replace(/Messagerie PrivÃ©e ðŸ”’/g, 'Messagerie Privée 🔒');
require('fs').writeFileSync('src/app/chat.tsx', c, 'utf8');
