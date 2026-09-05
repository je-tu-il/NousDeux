const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

if (!code.includes('</ScrollView>\n        </View>\n      </ImageBackground>')) {
  // Replace the first occurrence of </ScrollView> matching the end with the extra </View>
  const idx = code.lastIndexOf('</ScrollView>');
  code = code.slice(0, idx) + '</ScrollView>\n        </View>' + code.slice(idx + 13);
  fs.writeFileSync('src/app/dashboard.tsx', code);
  console.log("Added </View> wrapper!");
} else {
  console.log("Already added!");
}
