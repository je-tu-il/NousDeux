const fs = require('fs');
let code = fs.readFileSync('src/data/cosmetics.ts', 'utf8');

const defaultIds = ['bg_free_1', 'bd_free_1', 'tag_free_0'];

const lines = code.split('\n');
const newLines = lines.map(line => {
  if (line.includes("unlock: { type: 'free' }")) {
    const hasDefault = defaultIds.some(id => line.includes(`id: '${id}'`));
    if (!hasDefault) {
      return line.replace("unlock: { type: 'free' }", "unlock: { type: 'purchase', price: 50 }");
    }
  }
  return line;
});

fs.writeFileSync('src/data/cosmetics.ts', newLines.join('\n'));
console.log("Fixed free cosmetics!");
