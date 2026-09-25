import { collection, getDocs } from 'firebase/firestore';
import { Flame } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../lib/firebase';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// ─── helpers ─────────────────────────────────────────────────────────────────

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayKey(): string {
  const d = new Date();
  return toKey(d.getFullYear(), d.getMonth(), d.getDate());
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  currentStreak?: number;
  coupleId: string;
  showFullCalendar?: boolean;
  compact?: boolean;
  darkMode?: boolean;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function StreakCalendar({ coupleId, showFullCalendar = false, currentStreak, compact = false, darkMode = false }: Props) {
  const [streak, setStreak] = useState<number>(currentStreak ?? 0);
  const [activeDays, setActive]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [record, setRecord] = useState<{ length: number; start: string; end: string } | null>(null);
  const [currentDates, setCurrentDates] = useState<{ start: string; end: string } | null>(null);
  const today = todayKey();

  // Une seule lecture de la collection remplace les lectures quotidiennes du calendrier.
  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const dailySnapshot = await getDocs(collection(db, 'couples', coupleId, 'daily'));
        const active = new Set<string>();
        dailySnapshot.docs.forEach((dailyDoc) => {
          const data = dailyDoc.data();
          if (data.bothAnswered === true || data.answered === true || data.complete === true) active.add(dailyDoc.id);
        });
        const legacyResults = await Promise.all(
          dailySnapshot.docs
            .filter((dailyDoc) => !active.has(dailyDoc.id))
            .map(async (dailyDoc) => ({ id: dailyDoc.id, count: (await getDocs(collection(dailyDoc.ref, 'answers'))).size }))
        );
        legacyResults.forEach(({ id, count }) => {
          if (count >= 2) active.add(id);
        });
        const sorted = [...active].sort();
        let best: { length: number; start: string; end: string } | null = null;
        let runStart = '';
        let previous: Date | null = null;
        for (const key of sorted) {
          const date = new Date(`${key}T00:00:00`);
          const consecutive = previous && (date.getTime() - previous.getTime()) === 86400000;
          if (!consecutive) runStart = key;
          const candidate = { length: Math.round((date.getTime() - new Date(`${runStart}T00:00:00`).getTime()) / 86400000) + 1, start: runStart, end: key };
          if (!best || candidate.length > best.length) best = candidate;
          previous = date;
        }
        if (!cancelled) {
          setActive(active);
          setRecord(best);
          if (currentStreak === undefined) {
            const cursor = new Date();
            let current = 0;
            const todayCompleted = active.has(todayKey());
            if (!todayCompleted) cursor.setDate(cursor.getDate() - 1);
            const currentEnd = toKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
            let currentStart = currentEnd;
            while (active.has(toKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()))) {
              currentStart = toKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
              current++;
              cursor.setDate(cursor.getDate() - 1);
            }
            setStreak(current);
            setCurrentDates(current ? { start: currentStart, end: currentEnd } : null);
          }
        }
      } catch (e) {
        if ((e as { code?: string })?.code !== 'permission-denied') {
          console.error('StreakCalendar:', e);
        }
        if (!cancelled) {
          setActive(new Set());
          setRecord(null);
          setCurrentDates(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [coupleId]);

  // ── Streak mini-bar (fenêtre glissante) ─────────────────────────────────────
  const displayedStreak = currentStreak ?? streak;
  const daysToShow = compact ? 5 : Math.min(Math.max(displayedStreak, 7), 30);
  const scrollViewRef = useRef<ScrollView>(null);
  const miniDays: string[] = [];
  for (let i = -(daysToShow - 1); i <= 0; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    miniDays.push(toKey(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  const scrollToToday = () => {
    if (scrollViewRef.current) {
      try {
        scrollViewRef.current.scrollToEnd({ animated: false });
      } catch {}
      if (Platform.OS === 'web') {
        const el = (scrollViewRef.current as any)?.getScrollableNode?.() || (scrollViewRef.current as any);
        if (el && typeof el.scrollLeft !== 'undefined') {
          el.scrollLeft = el.scrollWidth;
        }
      }
    }
  };

  useEffect(() => {
    if (!loading) {
      scrollToToday();
      const t1 = setTimeout(scrollToToday, 40);
      const t2 = setTimeout(scrollToToday, 200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [loading, miniDays.length]);

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <ActivityIndicator color="#FF9A8B" size="small" />
      </View>
    );
  }



  return (
    <View style={[styles.container, compact && styles.compactContainer, darkMode && styles.darkContainer]}>
      {/* ── Compteur streak ── */}
      <View style={styles.streakRow}>
        <Flame color="#FF6B35" size={compact ? 20 : 24} fill="#FF6B35" />
        <Text style={[styles.streakNumber, compact && { fontSize: 24 }]}>{displayedStreak}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.streakLabel, compact && { fontSize: 12 }, darkMode && { color: '#F3E8E2' }]}>
          {displayedStreak === 0
            ? 'Nouveau streak !'
            : displayedStreak === 1
            ? 'jour d\'affilée 🚀'
            : 'jours d\'affilée 🔥'}
        </Text>
      </View>

      {/* ── Mini-bar glissante (toujours visible pour garder la hauteur) ── */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: 10000, y: 0 }}
        contentContainerStyle={[
          styles.miniRow,
          compact && { gap: 4, paddingHorizontal: 0, justifyContent: 'space-between', width: '100%' },
          !compact && miniDays.length <= 7 && { justifyContent: 'space-between', width: '100%', paddingHorizontal: 0 }
        ]}
        style={styles.miniScrollView}
        onContentSizeChange={scrollToToday}
        onLayout={scrollToToday}
      >
        {miniDays.map((key) => {
          const isToday  = key === today;
          const isActive = activeDays.has(key);
          const dayNum   = parseInt(key.split('-')[2], 10);
          const d        = new Date(key + 'T00:00:00');
          const label    = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
          return (
            <View key={key} style={styles.miniDayCol}>
              <Text style={[styles.miniLabel, compact && { fontSize: 9 }, isToday && styles.miniLabelToday, darkMode && { color: '#D4B8B4' }]}>{label}</Text>
              <View style={[
                styles.miniCircle, 
                compact && { width: 22, height: 22, borderRadius: 11 },
                isActive && styles.miniActive, 
                isToday && !isActive && styles.miniToday
              ]}>
                {isActive
                  ? <Text style={[styles.miniCheck, compact && { fontSize: 11 }]}>✓</Text>
                  : <Text style={[styles.miniNum, compact && { fontSize: 10 }, isToday && { color: '#FF6B35', fontWeight: '800' }, darkMode && !isToday && { color: '#D4B8B4' }]}>
                      {dayNum}
                    </Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {showFullCalendar && (
        <>
          <View style={styles.recordBox}>
            <Text style={styles.recordTitle}>Série en cours</Text>
            <Text style={styles.recordValue}>{displayedStreak} jour{displayedStreak === 1 ? '' : 's'}</Text>
            {currentDates && <Text style={styles.recordDates}>Du {currentDates.start} au {currentDates.end}</Text>}
            <View style={styles.recordSeparator} />
            <Text style={styles.recordTitle}>Série record</Text>
            <Text style={styles.recordValue}>{record?.length ?? 0} jour{record?.length === 1 ? '' : 's'}</Text>
            {record && <Text style={styles.recordDates}>Du {record.start} au {record.end}</Text>}
            <Text style={styles.legendText}>{activeDays.size} jour{activeDays.size === 1 ? '' : 's'} complété{activeDays.size === 1 ? '' : 's'} au total</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF0EB',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 106, 136, 0.35)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  darkContainer: {
    backgroundColor: 'rgba(42, 26, 26, 0.95)',
    borderColor: 'rgba(255, 106, 136, 0.3)',
  },
  compactContainer: {
    // Aligne la mini-carte sur la hauteur de la roulette du Dashboard.
    minHeight: 116,
    padding: 10,
    paddingHorizontal: 8,
    marginBottom: 0,
    overflow: 'hidden',
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  streakNumber: { fontSize: 30, fontWeight: '900', color: '#FF6B35' },
  streakLabel: { fontSize: 14, fontWeight: '600', color: '#4A3B39', opacity: 0.7, flexShrink: 1 },

  miniScrollView: { width: '100%', overflow: 'hidden' },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, paddingHorizontal: 4 },
  miniDayCol: { alignItems: 'center', gap: 4 },
  miniLabel: { fontSize: 10, fontWeight: '600', color: '#A99693' },
  miniLabelToday: { color: '#FF9A8B', fontWeight: '800' },
  miniCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255, 154, 139, 0.12)', alignItems: 'center', justifyContent: 'center' },
  miniActive: { backgroundColor: '#FF6B35' },
  miniToday: { borderWidth: 2, borderColor: '#FF9A8B' },
  miniNum: { fontSize: 11, fontWeight: '600', color: '#A99693' },
  miniCheck: { fontSize: 13, fontWeight: '900', color: 'white' },


  recordBox: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,154,139,0.12)' },
  recordTitle: { fontSize: 14, fontWeight: '800', color: '#4A3B39' },
  recordValue: { fontSize: 24, fontWeight: '900', color: '#FF6B35', marginTop: 4 },
  recordDates: { fontSize: 12, color: '#4A3B39', marginTop: 2 },
  recordSeparator: { height: 1, backgroundColor: 'rgba(74,59,57,0.12)', marginVertical: 10 },
});
