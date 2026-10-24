const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  '    </ImageBackground>\n  );\n}\n\nconst styles = StyleSheet.create({',
  '      </ScrollView>\n    </ImageBackground>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({'
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Fixed end tags!");
