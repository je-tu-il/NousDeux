import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Flame } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Retourne la clé YYYY-MM-DD d'un jour relatif à aujourd'hui (0 = aujourd'hui, -1 = hier, etc.) */
function dateKeyOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

function dayNumber(dateKey: string): string {
  return String(parseInt(dateKey.split('-')[2], 10));
}

interface Props {
  coupleId: string;
}

export default function StreakCalendar({ coupleId }: Props) {
  const [streak, setStreak]     = useState<number>(0);
  const [activeDays, setActive] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;

    const load = async () => {
      try {
        // 1. Lire le streak courant
        const statsSnap = await getDoc(doc(db, 'couples', coupleId, 'stats', 'streak'));
        const currentStreak: number = statsSnap.exists()
          ? (statsSnap.data().currentStreak ?? 0)
          : 0;

        // 2. Vérifier les jours à afficher
        //    On n'affiche que min(streak, 7) jours — du plus ancien au plus récent
        const daysToShow = Math.min(Math.max(currentStreak, 1), 7);
        const dateKeys: string[] = [];
        for (let i = -(daysToShow - 1); i <= 0; i++) {
          dateKeys.push(dateKeyOffset(i));
        }

        // 3. Pour chaque jour, vérifier si bothAnswered
        const active = new Set<string>();
        await Promise.all(
          dateKeys.map(async (dateKey) => {
            const daySnap = await getDoc(doc(db, 'couples', coupleId, 'daily', dateKey));
            if (daySnap.exists() && daySnap.data().bothAnswered === true) {
              active.add(dateKey);
            }
          })
        );

        if (!cancelled) {
          setStreak(currentStreak);
          setActive(active);
        }
      } catch (e) {
        console.error('StreakCalendar:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [coupleId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#FF9A8B" size="small" />
      </View>
    );
  }

  // Jours à afficher : au minimum aujourd'hui, au maximum 7
  const daysToShow = Math.min(Math.max(streak, 1), 7);
  const dateKeys: string[] = [];
  for (let i = -(daysToShow - 1); i <= 0; i++) {
    dateKeys.push(dateKeyOffset(i));
  }
  const today = dateKeyOffset(0);

  return (
    <View style={styles.container}>
      {/* Compteur streak */}
      <View style={styles.streakRow}>
        <Flame color="#FF6B35" size={22} fill="#FF6B35" />
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text style={styles.streakLabel}>
          {streak === 0
            ? 'Commencez votre streak !'
            : streak === 1
            ? 'jour d\'affilée 🎉'
            : `jour${streak > 1 ? 's' : ''} d'affilée 🔥`}
        </Text>
      </View>

      {/* Mini calendrier glissant */}
      <View style={styles.calRow}>
        {dateKeys.map((dateKey) => {
          const isToday  = dateKey === today;
          const isActive = activeDays.has(dateKey);
          return (
            <View key={dateKey} style={styles.dayCol}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {dayLabel(dateKey)}
              </Text>
              <View style={[
                styles.dayCircle,
                isActive && styles.dayActive,
                isToday && !isActive && styles.dayToday,
              ]}>
                {isActive
                  ? <Text style={styles.dayCheckmark}>✓</Text>
                  : <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                      {dayNumber(dateKey)}
                    </Text>}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF6B35',
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A3B39',
    opacity: 0.7,
    flexShrink: 1,
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 6,
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A99693',
  },
  dayLabelToday: {
    color: '#FF9A8B',
    fontWeight: '800',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayActive: {
    backgroundColor: '#FF9A8B',
  },
  dayToday: {
    borderWidth: 2,
    borderColor: '#FF9A8B',
    backgroundColor: 'transparent',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A99693',
  },
  dayNumberToday: {
    color: '#FF9A8B',
    fontWeight: '800',
  },
  dayCheckmark: {
    fontSize: 14,
    fontWeight: '900',
    color: 'white',
  },
});
