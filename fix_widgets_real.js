const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const dailyClaimRegex = /\{\/\* DailyClaim Roulette Popup Button \*\/\}[\s\S]*?<\/Animated\.View>\n\s*\)\}/;
const streakCalendarRegex = /\{\/\* Streak \+ calendrier - cliquable pour ouvrir le calendrier complet \*\/\}[\s\S]*?<\/Animated\.View>\n\s*\)\}/;

// Remove them from their original spots
const dailyMatch = code.match(dailyClaimRegex);
const streakMatch = code.match(streakCalendarRegex);

if (dailyMatch && streakMatch) {
  code = code.replace(dailyMatch[0], '');
  code = code.replace(streakMatch[0], '');

  const sideBySideWidgets = `{/* --- WIDGETS LIGNE --- */}
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
          </View>`;

  // Insert before {/* Main Grid */}
  code = code.replace("{/* Main Grid */}", sideBySideWidgets + "\n\n          {/* Main Grid */}");
  
  fs.writeFileSync('src/app/dashboard.tsx', code);
  console.log("Successfully replaced widgets!");
} else {
  console.log("Could not find regex matches.");
}
