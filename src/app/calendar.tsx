import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ImageBackground, Platform, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import StreakCalendar from '@/components/StreakCalendar';
import { Colors } from '@/constants/Colors';

export default function CalendarScreen() {
  const theme  = Colors.light;
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

  return (
    <ImageBackground
      source={require('../../assets/images/romantic_calendar_bg.png')}
      style={styles.container}
      resizeMode="cover"
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
    paddingTop: Platform.OS === 'web' ? 30 : 60,
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
