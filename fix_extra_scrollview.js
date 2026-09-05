const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  '            </ScrollView>\n      </ImageBackground>\n    </View>',
  '      </ImageBackground>\n    </View>'
);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Removed extra ScrollView closing tag!");
