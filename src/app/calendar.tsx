import StreakCalendar from '@/components/StreakCalendar';
import { Colors } from '@/constants/Colors';
import { getCosmeticById, getCosmeticImage } from '@/data/cosmetics';
import { db } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Link } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, Platform, StyleSheet, Text, View } from 'react-native';

export default function CalendarScreen() {
  const isDarkMode = useOnboardingStore((s) => s.isDarkMode);
  const theme  = isDarkMode ? Colors.dark : Colors.light;
  const myUid  = useOnboardingStore((s) => s.uid);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!myUid) return;
    const init = async () => {
      const myDoc = await getDoc(doc(db, 'users', myUid));
      if (!myDoc.exists()) return;
      const pUid = myDoc.data().linkedTo as string | undefined;
      if (!pUid) { setLoading(false); return; }
      setCoupleId([myUid, pUid].sort().join('_'));
      setLoading(false);
    };
    init();
  }, [myUid]);

  const store = useOnboardingStore();
  const bgSource = getCosmeticImage(getCosmeticById(store.selectedBackground), store.isDarkMode) || (store.isDarkMode ? require('../../assets/images/nousdeux_dark_background.png') : require('../../assets/images/nousdeux_warm_background.png'));

  return (
    <ImageBackground
      source={bgSource}
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#1A1514' : '#FFF5F2' }
      ]}
      resizeMode="cover"
      imageStyle={{ width: '100%', height: '100%', objectPosition: 'center' } as any}
    >
      <View style={styles.safeArea}>
        {/* En-tête */}
        <View style={styles.header}>
          <Link href="/dashboard" style={styles.backBtn}>
            <ArrowLeft color={theme.text} size={26} />
          </Link>
          <Text style={[styles.title, { color: theme.text }]}>Notre Calendrier</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={theme.tint} size="large" style={{ marginTop: 40 }} />
        ) : coupleId ? (
          <StreakCalendar coupleId={coupleId} showFullCalendar />
        ) : (
          <Text style={{ color: theme.text, textAlign: 'center', marginTop: 40, opacity: 0.6 }}>
            Pas de partenaire connecté.
          </Text>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 18 : 44,
    paddingHorizontal: 20,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  title: { fontSize: 22, fontWeight: '800' },
});
