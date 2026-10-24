const fs = require('fs');
let code = fs.readFileSync('src/data/cosmetics.ts', 'utf8');

code = code.replace(
  "return matches && matches.length >= 2 ? [matches[0], matches[1]] : ['transparent', 'transparent'];",
  "if (!matches) return ['transparent', 'transparent'];\n  if (matches.length === 1) return [matches[0], matches[0]];\n  return [matches[0], matches[1]];"
);

fs.writeFileSync('src/data/cosmetics.ts', code);
