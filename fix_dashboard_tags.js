const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  '</ImageBackground>\n  );\n}',
  '  </ScrollView>\n    </ImageBackground>\n    </View>\n  );\n}'
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Added closing tags!");
