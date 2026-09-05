const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

code = code.replace(
  '<ScrollView style={styles.safeArea} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>',
  '<View style={styles.safeArea}><ScrollView style={{ flex: 1, width: ' + "'100%'" + ' }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>'
);

// Now find the closing tags at the end of the file
const endTags = '            </ScrollView>\n      </ImageBackground>\n    </View>\n  );\n}';
const newEndTags = '            </ScrollView>\n        </View>\n      </ImageBackground>\n    </View>\n  );\n}';

code = code.replace(endTags, newEndTags);

fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Restored View wrapper for safeArea!");
