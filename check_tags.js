const fs = require('fs');
const code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const openingMatches = code.match(/<([A-Z][a-zA-Z0-9]*)/g) || [];
const closingMatches = code.match(/<\/([A-Z][a-zA-Z0-9]*)/g) || [];
const selfClosingMatches = code.match(/<([A-Z][a-zA-Z0-9]*)[^>]*\/>/g) || [];

const tagCounts = {};

openingMatches.forEach(tag => {
  const t = tag.substring(1);
  tagCounts[t] = (tagCounts[t] || 0) + 1;
});

selfClosingMatches.forEach(tag => {
  const match = tag.match(/<([A-Z][a-zA-Z0-9]*)/);
  if (match) {
    const t = match[1];
    tagCounts[t] = (tagCounts[t] || 0) - 1; // It was counted as opening, so subtract 1
  }
});

closingMatches.forEach(tag => {
  const t = tag.substring(2);
  tagCounts[t] = (tagCounts[t] || 0) - 1;
});

console.log("Unbalanced Tags:");
for (const [tag, count] of Object.entries(tagCounts)) {
  if (count !== 0) {
    console.log(`${tag}: ${count}`);
  }
}
