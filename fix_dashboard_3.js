const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

// 1. Background image
code = code.replace(/dashboard_bg\.png/g, 'nousdeux_warm_background.png');

// 2. Fix the layout of Streak and Roulette
// Old widgets block:
// <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 12 }}>
//   {/* STREAK */}
//   <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ flex: 1 }}> ... </Animated.View>
//   {/* ROULETTE */}
//   <Animated.View entering={FadeInUp.delay(50).duration(400)} style={{ flex: 1 }}> ... </Animated.View>
// </View>

// Let's replace flex: 1 with the proper flex values and swap them.
// Roulette = flex 1 (left), Streak = flex 2 (right)

code = code.replace(
  /<Animated\.View entering=\{FadeInUp\.delay\(100\)\.duration\(400\)\} style=\{\{ flex: 1 \}\}>\s*<Link href="\/calendar" asChild>\s*<Pressable style=\{\{ flex: 1 \}\}>\s*<StreakCalendar coupleId=\{partner\.coupleId\} compact=\{true\} \/>\s*<\/Pressable>\s*<\/Link>\s*<\/Animated\.View>/,
  '%%STREAK%%'
);

code = code.replace(
  /<Animated\.View entering=\{FadeInUp\.delay\(50\)\.duration\(400\)\} style=\{\{ flex: 1 \}\}>\s*<DailyClaim \s*compact=\{true\}\s*coupleId=\{partner\.coupleId\} \s*myUid=\{store\.uid\} \s*wallet=\{wallet\} \s*onClaimed=\{\(w\) => updateDoc\(doc\(db, 'couples', partner\.coupleId as string\), \{ wallet: w \}\)\}\s*\/>\s*<\/Animated\.View>/,
  '%%ROULETTE%%'
);

code = code.replace('%%STREAK%%', 
  `<Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ flex: 2 }}>
              <Link href="/calendar" asChild>
                <Pressable style={{ flex: 1 }}>
                  <StreakCalendar coupleId={partner.coupleId} compact={true} />
                </Pressable>
              </Link>
            </Animated.View>`
);

code = code.replace('%%ROULETTE%%', 
  `<Animated.View entering={FadeInUp.delay(50).duration(400)} style={{ flex: 1 }}>
              <DailyClaim 
                compact={true}
                coupleId={partner.coupleId} 
                myUid={store.uid} 
                wallet={wallet} 
                onClaimed={(w) => updateDoc(doc(db, 'couples', partner.coupleId as string), { wallet: w })}
              />
            </Animated.View>`
);

// Reverse them in the code: Roulette first, then Streak.
code = code.replace(
  /\{\/\* STREAK \*\/\}[\s\S]*?\{\/\* ROULETTE \*\/\}[\s\S]*?<\/Animated\.View>/,
  `{/* ROULETTE */}
          {partner?.coupleId && store.uid && (
            <Animated.View entering={FadeInUp.delay(50).duration(400)} style={{ flex: 1 }}>
              <DailyClaim 
                compact={true}
                coupleId={partner.coupleId} 
                myUid={store.uid} 
                wallet={wallet} 
                onClaimed={(w) => updateDoc(doc(db, 'couples', partner.coupleId as string), { wallet: w })}
              />
            </Animated.View>
          )}

          {/* STREAK */}
          {partner?.coupleId && (
            <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ flex: 2 }}>
              <Link href="/calendar" asChild>
                <Pressable style={{ flex: 1 }}>
                  <StreakCalendar coupleId={partner.coupleId} compact={true} />
                </Pressable>
              </Link>
            </Animated.View>
          )}`
);

// 3. Contrast for Quest and Cosmetics cards
// In Dashboard, "Quêtes" and "Boutique" small cards:
// They use smallCard: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, ... }
// with inline colors: { backgroundColor: 'rgba(255, 106, 136, 0.1)', borderColor: 'rgba(255, 106, 136, 0.3)' }
code = code.replace(
  `backgroundColor: 'rgba(255, 106, 136, 0.1)'`,
  `backgroundColor: 'rgba(255, 106, 136, 0.2)'`
);
code = code.replace(
  `borderColor: 'rgba(255, 106, 136, 0.3)'`,
  `borderColor: 'rgba(255, 106, 136, 0.6)'`
);

// Avoid white background for "Question du jour":
// { backgroundColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.9)' }
code = code.replace(
  `backgroundColor: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.9)'`,
  `backgroundColor: 'rgba(255, 235, 235, 0.8)', borderColor: '#FF9A8B'`
);


fs.writeFileSync('src/app/dashboard.tsx', code);
console.log("Dashboard fixes applied!");
