const fs = require('fs');

let content = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

const effectCode = `  useEffect(() => {
    const checkStreakUnlock = async () => {
      if (!wallet?.streak) return;
      try {
        const lastSeenStr = await AsyncStorage.getItem('last_seen_streak_unlock');
        const lastSeen = lastSeenStr ? parseInt(lastSeenStr) : 0;
        if (wallet.streak > lastSeen) {
          const newUnlocks = COSMETICS.filter(c => c.unlock.type === 'streak' && c.unlock.days === wallet.streak);
          if (newUnlocks.length > 0) {
            setUnlockedItems(newUnlocks);
            await AsyncStorage.setItem('last_seen_streak_unlock', wallet.streak.toString());
          }
        }
      } catch(e) {}
    };
    checkStreakUnlock();
  }, [wallet?.streak]);
`;

// Remove the effect from the top
content = content.replace(effectCode, "");

// Add it after const [wallet, setWallet] = useState<any>(null);
content = content.replace(
  "const [wallet, setWallet] = useState<any>(null);",
  "const [wallet, setWallet] = useState<any>(null);\n\n" + effectCode
);

fs.writeFileSync('src/app/dashboard.tsx', content);
console.log("Fixed dashboard.tsx Temporal Dead Zone issue");
