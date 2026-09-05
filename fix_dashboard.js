const fs = require('fs');

let content = fs.readFileSync('src/app/dashboard.tsx', 'utf8');

if (!content.includes('import DailyClaim')) {
  content = content.replace('import CoinWallet', "import DailyClaim from '@/components/DailyClaim';\nimport CoinWallet");
}
if (!content.includes('AsyncStorage')) {
  content = content.replace('import { Colors', "import AsyncStorage from '@react-native-async-storage/async-storage';\nimport { Colors");
}
if (!content.includes('COSMETICS')) {
  content = content.replace('import { getCosmeticById', "import { getCosmeticById, COSMETICS, Cosmetic");
}

if (!content.includes('const [unlockedItems, setUnlockedItems]')) {
  content = content.replace('const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);', 
    "const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);\n  const [unlockedItems, setUnlockedItems] = useState<Cosmetic[]>([]);");
}

if (!content.includes('checkStreakUnlock')) {
  const useEffectCode = `
  useEffect(() => {
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
  content = content.replace('export default function DashboardScreen() {', "export default function DashboardScreen() {\n" + useEffectCode);
}

if (!content.includes('Nouveauté Débloquée')) {
  const modalCode = `
      {/* Streak Unlock Popup */}
      <Modal visible={unlockedItems.length > 0} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 10 }}>🎉</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#4A3B39', textAlign: 'center', marginBottom: 10 }}>Nouveauté Débloquée !</Text>
            <Text style={{ fontSize: 14, color: '#A99693', textAlign: 'center', marginBottom: 20 }}>Ton streak de {wallet?.streak} jours t'a permis de débloquer :</Text>
            
            {unlockedItems.map(item => (
              <View key={item.id} style={{ alignItems: 'center', marginBottom: 15, padding: 10, backgroundColor: 'rgba(255,154,139,0.1)', borderRadius: 16, width: '100%' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FF6A88' }}>{item.emoji ? item.emoji + ' ' : ''}{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#A99693' }}>{item.description}</Text>
              </View>
            ))}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, width: '100%' }}>
              <Pressable style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center' }} onPress={() => setUnlockedItems([])}>
                <Text style={{ color: '#4A3B39', fontWeight: 'bold' }}>Fermer</Text>
              </Pressable>
              <Pressable style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#FF6A88', alignItems: 'center' }} onPress={() => { setUnlockedItems([]); router.push('/shop'); }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Voir boutique</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
  `;
  content = content.replace('</ImageBackground>', modalCode + "\n    </ImageBackground>");
}

fs.writeFileSync('src/app/dashboard.tsx', content);
