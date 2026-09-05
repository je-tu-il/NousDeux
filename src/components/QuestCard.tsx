import { useOnboardingStore } from '@/store/onboardingStore';
import { Colors } from '@/constants/Colors';
import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, withRepeat, withSequence } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Quest } from '../data/quests';
import { QuestProgressEntry } from '../lib/economy';
import { QuestTierLevel } from '../data/quests';

interface QuestCardProps {
  quest: Quest;
  progress: QuestProgressEntry;
  onClaim?: (questId: string, tierLevel: QuestTierLevel, reward: number) => Promise<void>;
  isHighlighted?: boolean;
}

const TIER_STYLE: Record<string, { bg: string; text: string; bar: string; badge: string }> = {
  bronze:   { bg: '#C8752215', text: '#9A5512', bar: '#C87522', badge: '🥉' },
  silver:   { bg: '#75757515', text: '#616161', bar: '#757575', badge: '🥈' },
  gold:     { bg: '#FFD70020', text: '#A07800', bar: '#FFD700', badge: '🥇' },
  platinum: { bg: '#9C27B015', text: '#6A0DAD', bar: '#CE93D8', badge: '💎' },
};

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const;

function nextTierIndex(completedTier: string | null): number {
  if (!completedTier) return 0;
  const idx = TIER_ORDER.indexOf(completedTier as any);
  return idx === TIER_ORDER.length - 1 ? -1 : idx + 1;
}

export default memo(function QuestCard({ quest, progress, onClaim, isHighlighted }: QuestCardProps) {
  const store = useOnboardingStore((state) => state);
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const completedTier = progress.tier ?? null;
  const naturallyNextIdx = nextTierIndex(completedTier);
  const isFullyDone = naturallyNextIdx === -1;
  
  // Par défaut on affiche le prochain palier, ou le platine si tout est fini
  const defaultIdx = isFullyDone ? 3 : naturallyNextIdx;
  const [viewIdx, setViewIdx] = useState<number>(defaultIdx);
  const [loadingClaim, setLoadingClaim] = useState(false);

  // Plus de sauvegarde dans AsyncStorage, on reste sur le palier en cours par défaut
  useEffect(() => {
    setViewIdx(defaultIdx);
  }, [defaultIdx]);

  const glowAnim = useSharedValue(0);
  useEffect(() => {
    if (isHighlighted) {
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        3, // 3 fois
        true
      );
    } else {
      glowAnim.value = 0;
    }
  }, [isHighlighted]);

  const highlightStyle = useAnimatedStyle(() => {
    return {
      shadowColor: '#FF9A8B',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glowAnim.value * 0.8,
      shadowRadius: glowAnim.value * 15,
      elevation: glowAnim.value * 10,
      borderColor: `rgba(255, 154, 139, ${glowAnim.value * 0.5})`,
      borderWidth: glowAnim.value > 0 ? 2 : 1,
    };
  });

  const handleSelectTier = (idx: number) => {
    setViewIdx(idx);
  };

  const viewTier = quest.tiers[viewIdx];
  const targetAmount = viewTier.threshold;
  const currentAmount = progress.current ?? 0;
  const progressRatio = Math.min(currentAmount / targetAmount, 1);
  const isViewTierDone = currentAmount >= targetAmount;
  
  const isUnclaimed = progress.unclaimedTiers?.includes(viewTier.tier);
  const hasBeenClaimed = isViewTierDone && !isUnclaimed;
  
  const ts = TIER_STYLE[viewTier.tier];

  // Animation barre
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withTiming(progressRatio * 100, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progressRatio]);
  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));

  const handleClaim = async () => {
    if (!onClaim || !isUnclaimed) return;
    setLoadingClaim(true);
    await onClaim(quest.id, viewTier.tier, viewTier.reward);
    setLoadingClaim(false);
  };

  // Carte verte si le palier visé est terminé (que ce soit claimé ou non)
  const cardDoneStyle = isViewTierDone ? { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' } : {};

  return (
    <Animated.View style={[styles.card, cardDoneStyle, highlightStyle]}>
      
      {/* 1ère ligne : Titre + Récompense */}
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <Text style={styles.icon}>{quest.icon}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {quest.description} ({targetAmount})
          </Text>
        </View>
        <View style={styles.rewardBadge}>
          <Text style={styles.rewardText}>+{viewTier.reward} 🌸</Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { backgroundColor: isViewTierDone ? '#22c55e' : ts.bar }, barStyle]} />
        </View>
        <Text style={styles.count}>{currentAmount}/{targetAmount}</Text>
      </View>

      {/* Ligne du bas : Paliers sélectionnables + Bouton Claim */}
      <View style={styles.bottomRow}>
        <View style={styles.roadmap}>
          {quest.tiers.map((t, i) => {
            const isSelected = i === viewIdx;
            const tStyle = TIER_STYLE[t.tier];
            // Est-ce que ce palier précis est terminé ?
            const isThisTierDone = currentAmount >= t.threshold;
            const isThisTierUnclaimed = progress.unclaimedTiers?.includes(t.tier);
            
            return (
              <Pressable 
                key={t.tier} 
                onPress={() => handleSelectTier(i)}
                style={[
                  styles.milestone,
                  isSelected && { backgroundColor: tStyle.bg, borderColor: tStyle.bar, borderWidth: 2 },
                  !isSelected && isThisTierDone && { opacity: 0.6 }
                ]}
              >
                <Text style={styles.milestoneEmoji}>{tStyle.badge}</Text>
                {/* Petit point d'exclamation si non réclamé */}
                {isThisTierUnclaimed && (
                  <View style={styles.unclaimedDot} />
                )}
              </Pressable>
            );
          })}
        </View>

        {isUnclaimed && (
          <Pressable style={styles.claimBtn} onPress={handleClaim} disabled={loadingClaim}>
            {loadingClaim ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.claimBtnText}>Récupérer</Text>}
          </Pressable>
        )}
        
        {hasBeenClaimed && (
          <View style={styles.claimedBadge}>
            <Text style={styles.claimedText}>✓ Récupéré</Text>
          </View>
        )}
      </View>
      </Animated.View>
  );
});

const getStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: 'rgba(255,154,139,0.12)', gap: 12,
  },
  
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  titleArea: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  icon:   { fontSize: 22 },
  description: { fontSize: 14, fontWeight: '700', color: theme.text, flex: 1, lineHeight: 18 },
  
  rewardBadge: { backgroundColor: '#F9F4F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  rewardText:  { fontSize: 13, fontWeight: '800', color: '#FF6A88' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 8, backgroundColor: '#F0EAE8', borderRadius: 4, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 4 },
  count: { fontSize: 12, fontWeight: '700', color: theme.text, minWidth: 40, textAlign: 'right' },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  
  roadmap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  milestone: {
    padding: 6, borderRadius: 10,
    borderWidth: 2, borderColor: 'transparent', backgroundColor: '#F9F4F2',
    position: 'relative'
  },
  milestoneEmoji: { fontSize: 16 },
  unclaimedDot: {
    position: 'absolute', top: -2, right: -2,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444',
    borderWidth: 1, borderColor: 'white'
  },

  claimBtn: { backgroundColor: '#22c55e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  claimBtnText: { color: 'white', fontWeight: '800', fontSize: 12 },
  
  claimedBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  claimedText: { color: '#64748b', fontWeight: '700', fontSize: 12 }
});

