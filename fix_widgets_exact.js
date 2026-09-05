const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const oldDaily = `{/* DailyClaim Roulette Popup Button */}
        {partner?.coupleId && store.uid && (
          <Animated.View entering={FadeInUp.delay(50).duration(400)}>
            <DailyClaim 
              coupleId={partner.coupleId} 
              myUid={store.uid} 
              wallet={wallet} 
              onClaimed={(w) => updateDoc(doc(db, 'couples', partner.coupleId!), { wallet: w })}
            />
          </Animated.View>
        )}

        {/* Streak + calendrier - cliquable pour ouvrir le calendrier complet */}
        {partner?.coupleId && (
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <Link href="/calendar" asChild>
              <Pressable>
                <StreakCalendar coupleId={partner.coupleId} />
              </Pressable>
            </Link>
          </Animated.View>
        )}`;

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
        </View>`;

if (code.includes('DailyClaim Roulette Popup Button')) {
  // Try to find the exact block and replace
  // If exact string match fails, use indexOf
  const startIndex = code.indexOf('{/* DailyClaim Roulette Popup Button */}');
  const endIndex = code.indexOf('</Animated.View>\n        )}', startIndex + 100);
  
  if (startIndex !== -1 && endIndex !== -1) {
    // wait, there are TWO blocks! DailyClaim and StreakCalendar
    const finalEndIndex = code.indexOf('</Animated.View>\n        )}', endIndex + 50);
    if (finalEndIndex !== -1) {
      const actualEnd = finalEndIndex + '</Animated.View>\n        )}'.length;
      
      code = code.substring(0, startIndex) + newWidgets + code.substring(actualEnd);
      fs.writeFileSync('src/app/dashboard.tsx', code);
      console.log("Successfully replaced both widgets!");
    } else {
       console.log("Could not find end of streak block");
    }
  } else {
    console.log("Could not find start/end of daily block");
  }
}
