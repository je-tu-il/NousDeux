const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const startIndex = code.indexOf('{/* DailyClaim Roulette Popup Button */}');
const endIndex = code.indexOf('{/* Main Grid */}');

if (startIndex !== -1 && endIndex !== -1) {
  const newWidgets = `{/* --- WIDGETS LIGNE --- */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 12 }}>
          {/* STREAK */}
          {partner?.coupleId && (
            <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ flex: 1 }}>
              <Link href="/calendar" asChild>
                <Pressable style={{ flex: 1 }}>
                  <StreakCalendar coupleId={partner.coupleId} compact={true} />
                </Pressable>
              </Link>
            </Animated.View>
          )}

          {/* ROULETTE */}
          {partner?.coupleId && store.uid && (
            <Animated.View entering={FadeInUp.delay(50).duration(400)} style={{ flex: 1 }}>
              <DailyClaim 
                compact={true}
                coupleId={partner.coupleId} 
                myUid={store.uid} 
                wallet={wallet} 
                onClaimed={(w) => updateDoc(doc(db, 'couples', partner.coupleId), { wallet: w })}
              />
            </Animated.View>
          )}
        </View>

        `;
        
  code = code.substring(0, startIndex) + newWidgets + code.substring(endIndex);
  fs.writeFileSync('src/app/dashboard.tsx', code);
  console.log("Replaced widgets block successfully!");
} else {
  console.log("Could not find start/end.");
}
