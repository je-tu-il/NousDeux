import { collection, getDocs } from 'firebase/firestore';
import { Flame } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
  const daysToShow = Math.min(Math.max(displayedStreak, 1), 7);
  const miniDays: string[] = [];
  for (let i = -(daysToShow - 1); i <= 0; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    miniDays.push(toKey(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#FF9A8B" size="small" />
      </View>
    );
  }

  return (
    <View style={[styles.container, darkMode && { backgroundColor: 'rgba(29, 22, 22, 0.92)' }]}>
      {/* ── Compteur streak ── */}
      <View style={styles.streakRow}>
        <Flame color="#FF6B35" size={24} fill="#FF6B35" />
        <Text style={styles.streakNumber}>{displayedStreak}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.streakLabel}>
          {displayedStreak === 0
            ? 'Nouveau streak !'
            : displayedStreak === 1
            ? 'jour d\'affilée 🚀'
            : 'jours d\'affilée 🔥'}
        </Text>
      </View>

      {/* ── Mini-bar glissante (toujours visible pour garder la hauteur) ── */}
      <View style={styles.miniRow}>
        {miniDays.map((key) => {
          const isToday  = key === today;
          const isActive = activeDays.has(key);
          const dayNum   = parseInt(key.split('-')[2], 10);
          const d        = new Date(key + 'T00:00:00');
          const label    = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
          return (
            <View key={key} style={styles.miniDayCol}>
              <Text style={[styles.miniLabel, isToday && styles.miniLabelToday]}>{label}</Text>
              <View style={[styles.miniCircle, isActive && styles.miniActive, isToday && !isActive && styles.miniToday]}>
                {isActive
                  ? <Text style={styles.miniCheck}>✓</Text>
                  : <Text style={[styles.miniNum, isToday && { color: '#FF9A8B', fontWeight: '800' }]}>
                      {dayNum}
                    </Text>}
              </View>
            </View>
          );
        })}
      </View>

      {showFullCalendar && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(220,215,215,0.84)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  streakNumber: { fontSize: 30, fontWeight: '900', color: '#FF6B35' },
  streakLabel: { fontSize: 14, fontWeight: '600', color: '#4A3B39', opacity: 0.7, flexShrink: 1 },

  miniRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 6, marginBottom: 4 },
  miniDayCol: { alignItems: 'center', gap: 4 },
  miniLabel: { fontSize: 10, fontWeight: '600', color: '#A99693' },
  miniLabelToday: { color: '#FF9A8B', fontWeight: '800' },
  miniCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' },
  miniActive: { backgroundColor: '#FF9A8B' },
  miniToday: { borderWidth: 2, borderColor: '#FF9A8B' },
  miniNum: { fontSize: 11, fontWeight: '600', color: '#A99693' },
  miniCheck: { fontSize: 13, fontWeight: '900', color: 'white' },

  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  navBtn: { padding: 6 },
  navBtnDisabled: { opacity: 0.35 },
  calMonthTitle: { fontSize: 16, fontWeight: '800', color: '#4A3B39' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  calDayLabel: { fontSize: 10, fontWeight: '700', color: '#A99693', marginBottom: 4 },
  calDayCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  calDayActive: { backgroundColor: '#FF9A8B' },
  calDayToday: { borderWidth: 2, borderColor: '#FF9A8B' },
  calDayNum: { fontSize: 11, fontWeight: '500', color: '#4A3B39' },
  calCheck: { fontSize: 12, fontWeight: '900', color: 'white' },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#A99693' },
  recordBox: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,154,139,0.12)' },
  recordTitle: { fontSize: 14, fontWeight: '800', color: '#4A3B39' },
  recordValue: { fontSize: 24, fontWeight: '900', color: '#FF6B35', marginTop: 4 },
  recordDates: { fontSize: 12, color: '#4A3B39', marginTop: 2 },
  recordSeparator: { height: 1, backgroundColor: 'rgba(74,59,57,0.12)', marginVertical: 10 },
});
