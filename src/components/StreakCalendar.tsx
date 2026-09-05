import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { computeStreakCached } from '../lib/economy';
import { db } from '../lib/firebase';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

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
  const now = new Date();
  const [streak, setStreak] = useState<number>(currentStreak ?? 0);
  const [activeDays, setActive]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [calMonth, setCalMonth]   = useState(now.getMonth());
  const [calYear, setCalYear]     = useState(now.getFullYear());
  const hasLoadedCalendar = useRef(false);
  const today = todayKey();

  useEffect(() => {
    if (currentStreak !== undefined) setStreak(currentStreak);
  }, [currentStreak]);

  // ── Chargement du mois affiché ─────────────────────────────────────────────
  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;

    const load = async () => {
      if (!hasLoadedCalendar.current) setLoading(true);
      try {
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const miniKeys = Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - index);
          return toKey(date.getFullYear(), date.getMonth(), date.getDate());
        });
        const monthKeys = Array.from({ length: daysInMonth }, (_, i) => toKey(calYear, calMonth, i + 1));
        const keysToLoad = [...new Set([...monthKeys, ...miniKeys])];
        const active = new Set<string>();
        // Load actual completed days from DB
        await Promise.all(
          keysToLoad.map(async (key) => {
            const snap = await getDoc(doc(db, 'couples', coupleId, 'daily', key));
            const data = snap.exists() ? snap.data() : null;
            const completed = data && (data.bothAnswered === true || data.answered === true || data.complete === true);
            const legacyAnswers = data ? await getDocs(collection(snap.ref, 'answers')) : null;
            if (completed || (legacyAnswers?.size ?? 0) >= 2) {
              active.add(key);
            }
          })
        );
        
        if (!cancelled) {
          setActive(active);
          hasLoadedCalendar.current = true;
        }
      } catch (e) {
        console.error('StreakCalendar:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [coupleId, calMonth, calYear]);

  useEffect(() => {
    if (currentStreak !== undefined || !coupleId) return;
    computeStreakCached(coupleId).then(setStreak).catch(() => {});
  }, [coupleId, currentStreak]);

  // ── Streak mini-bar (fenêtre glissante) ─────────────────────────────────────
  const daysToShow = Math.min(Math.max(streak, 1), 7);
  const miniDays: string[] = [];
  for (let i = -(daysToShow - 1); i <= 0; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    miniDays.push(toKey(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  // ── Calendrier mensuel ───────────────────────────────────────────────────────
  const daysInMonth     = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay(); // 0=dim
  // Convertir : dimanche → 6, lundi → 0
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const calCells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Compléter à un multiple de 7
  while (calCells.length % 7 !== 0) calCells.push(null);

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
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.streakLabel}>
          {streak === 0
            ? 'Nouveau streak !'
            : streak === 1
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

      {/* ── Calendrier mensuel complet ── */}
      {showFullCalendar && (
        <>
          {/* Navigation mois */}
          <View style={styles.calHeader}>
            <Pressable
              disabled={calYear === 2026 && calMonth === 0}
              onPress={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                else setCalMonth(m => m - 1);
              }}
              style={[styles.navBtn, calYear === 2026 && calMonth === 0 && styles.navBtnDisabled]}
            >
              <ChevronLeft color="#4A3B39" size={20} />
            </Pressable>
            <Text style={styles.calMonthTitle}>
              {MONTH_NAMES[calMonth]} {calYear}
            </Text>
            <Pressable
              onPress={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                else setCalMonth(m => m + 1);
              }}
              style={styles.navBtn}
            >
              <ChevronRight color="#4A3B39" size={20} />
            </Pressable>
          </View>

          {/* En-têtes jours */}
          <View style={styles.calGrid}>
            {DAY_LABELS.map((l, i) => (
              <View key={i} style={styles.calCell}>
                <Text style={styles.calDayLabel}>{l}</Text>
              </View>
            ))}

            {/* Cellules */}
            {calCells.map((day, i) => {
              if (day === null) return <View key={`empty-${i}`} style={styles.calCell} />;
              const key      = toKey(calYear, calMonth, day);
              const isToday  = key === today;
              const isActive = activeDays.has(key);
              return (
                <View key={key} style={styles.calCell}>
                  <View style={[
                    styles.calDayCircle,
                    isActive && styles.calDayActive,
                    isToday && !isActive && styles.calDayToday,
                  ]}>
                    {isActive
                      ? <Text style={styles.calCheck}>✓</Text>
                      : <Text style={[styles.calDayNum, isToday && { color: '#FF9A8B', fontWeight: '800' }]}>
                          {day}
                        </Text>}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Légende */}
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9A8B' }]} />
            <Text style={styles.legendText}>Tous les deux ont répondu</Text>
          </View>
        </>
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
});
