const fs = require('fs');
const code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const scrollviewEnd = code.lastIndexOf('</ScrollView>', code.lastIndexOf('</ScrollView>') - 1); // Get the first one

const restOfFile = code.substring(scrollviewEnd);
fs.writeFileSync('rest_of_dashboard.txt', restOfFile);
console.log("Written rest of file");
