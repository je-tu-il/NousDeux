const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const garbage = `white" size={26} />
                <Text style={{ color: 'white', fontSize: 10, marginTop: 4, fontWeight: '700' }}>RǸglages</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>`;

if (code.includes(garbage)) {
  code = code.replace(garbage, '');
  fs.writeFileSync('src/app/dashboard.tsx', code);
  console.log("Fixed garbage text!");
} else {
  console.log("Garbage not found.");
}
