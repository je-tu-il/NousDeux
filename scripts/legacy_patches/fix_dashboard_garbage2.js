const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const anchor1 = `          <Pressable 
            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 20, padding: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
            onPress={() => router.push('/settings')}
          >
            <Settings color="#FF6A88" size={32} />`;
            
const split1 = code.indexOf(anchor1);
if (split1 !== -1) {
  const endOfValidView = code.indexOf('</View>', split1) + 7;
  const nextValidBlock = code.indexOf('{/* --- WIDGETS LIGNE --- */}', endOfValidView);
  
  if (nextValidBlock !== -1) {
    code = code.substring(0, endOfValidView) + '\n\n        ' + code.substring(nextValidBlock);
    fs.writeFileSync('src/app/dashboard.tsx', code);
    console.log("Fixed garbage successfully!");
  } else {
    console.log("next block not found");
  }
} else {
  console.log("anchor not found");
}
