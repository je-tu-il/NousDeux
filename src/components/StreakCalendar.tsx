import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Flame } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function getLastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push(key);
  }
  return days;
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
  const [streak, setStreak]       = useState<number>(0);
  const [activeDays, setActive]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);

  const last7 = getLastNDays(7);
  const today  = last7[last7.length - 1];

  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;

    const load = async () => {
      try {
        // 1. Lire le streak depuis stats
        const statsSnap = await getDoc(doc(db, 'couples', coupleId, 'stats', 'streak'));
        const currentStreak = statsSnap.exists() ? (statsSnap.data().currentStreak ?? 0) : 0;

        // 2. Vérifier les 7 derniers jours pour le mini-calendrier
        const active = new Set<string>();
        await Promise.all(
          last7.map(async (dateKey) => {
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

  return (
    <View style={styles.container}>
      {/* Streak count */}
      <View style={styles.streakRow}>
        <Flame color="#FF6B35" size={22} fill="#FF6B35" />
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text style={styles.streakLabel}>
          {streak === 0
            ? 'Commencez votre streak !'
            : streak === 1
            ? 'jour d\'affilée'
            : 'jours d\'affilée'}
        </Text>
      </View>

      {/* Mini calendrier — 7 derniers jours */}
      <View style={styles.calRow}>
        {last7.map((dateKey) => {
          const isToday   = dateKey === today;
          const isActive  = activeDays.has(dateKey);
          return (
            <View key={dateKey} style={styles.dayCol}>
              <Text style={[styles.dayLabel, isToday && { color: '#FF9A8B', fontWeight: '800' }]}>
                {dayLabel(dateKey)}
              </Text>
              <View style={[
                styles.dayCircle,
                isActive  && styles.dayActive,
                isToday && !isActive && styles.dayToday,
              ]}>
                {isActive
                  ? <Text style={styles.dayCheckmark}>✓</Text>
                  : <Text style={[styles.dayNumber, isToday && { color: '#FF9A8B' }]}>
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
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A99693',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  dayCheckmark: {
    fontSize: 13,
    fontWeight: '900',
    color: 'white',
  },
});
