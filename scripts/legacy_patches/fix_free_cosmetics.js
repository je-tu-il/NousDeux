const fs = require('fs');
let code = fs.readFileSync('src/data/cosmetics.ts', 'utf8');

// Replace unlock: { type: 'free' } with unlock: { type: 'purchase', price: 50 }
// but ONLY if the ID is NOT bg_free_1, bd_free_1, or tag_free_0.

code = code.replace(/(\{ id: 'bg_free_([2-9]|3b)',.*?unlock: \{ )type: 'free'( \}.*?\})/g, "$1type: 'purchase', price: 50$3");
code = code.replace(/(\{ id: 'bd_free_([2-9])',.*?unlock: \{ )type: 'free'( \}.*?\})/g, "$1type: 'purchase', price: 50$3");
code = code.replace(/(\{ id: 'tag_free_([1-9])',.*?unlock: \{ )type: 'free'( \}.*?\})/g, "$1type: 'purchase', price: 50$3");

fs.writeFileSync('src/data/cosmetics.ts', code);
console.log("Updated free cosmetics to cost 50 petals!");
