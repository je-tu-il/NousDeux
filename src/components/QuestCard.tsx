import { useOnboardingStore } from '@/store/onboardingStore';
import { Colors } from '@/constants/Colors';
import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, withRepeat, withSequence } from 'react-native-reanimated';
import { Quest, QuestTierLevel } from '../data/quests';
import { QuestProgressEntry } from '../lib/economy';

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
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const iconOnly = width < 320;
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const styles = getStyles(theme, store.isDarkMode);
  const completedTier = progress.tier ?? null;
  const naturallyNextIdx = nextTierIndex(completedTier);
  const myUid = store.uid;
  const [optimisticClaimedTiers, setOptimisticClaimedTiers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOptimisticClaimedTiers({});
  }, [myUid]);

  // Trouver le premier palier complété mais pas encore récupéré par CET utilisateur
  let firstUnclaimedIdx = -1;
  if (progress.unclaimedTiers && progress.unclaimedTiers.length > 0) {
    for (let i = 0; i < TIER_ORDER.length; i++) {
      const tierName = TIER_ORDER[i];
      if (progress.unclaimedTiers.includes(tierName)) {
        const claimers = progress.claimedBy?.[tierName] ?? [];
        const hasClaimedThis = (myUid ? claimers.includes(myUid) : false) || Boolean(optimisticClaimedTiers[tierName]);
        if (!hasClaimedThis) {
          firstUnclaimedIdx = i;
          break;
        }
      }
    }
  }

  // Ne pas passer sur le prochain palier de quête si la récompense précédente n'a pas encore été récupérée par l'utilisateur.
  // Une fois récupérée, passer au palier en cours (naturallyNextIdx), ou platine si tout est fini.
  const isFullyDone = naturallyNextIdx === -1;
  const defaultIdx = firstUnclaimedIdx !== -1 
    ? firstUnclaimedIdx 
    : (isFullyDone ? 3 : naturallyNextIdx);

  const [viewIdx, setViewIdx] = useState<number>(defaultIdx);
  const [loadingClaim, setLoadingClaim] = useState(false);

  // Met à jour l'affichage dès que la récompense est récupérée pour basculer sur le palier suivant
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

  const safeViewIdx = Math.max(0, Math.min(viewIdx >= 0 ? viewIdx : 0, quest.tiers.length - 1));
  const viewTier = quest.tiers[safeViewIdx];
  const targetAmount = viewTier.threshold;
  const currentAmount = progress.current ?? 0;
  const progressRatio = Math.min(currentAmount / targetAmount, 1);
  const isViewTierDone = currentAmount >= targetAmount;
  const isUnclaimed = progress.unclaimedTiers?.includes(viewTier.tier);
  const claimedByUsers = progress.claimedBy?.[viewTier.tier] ?? [];

  const hasUserClaimed = (myUid ? claimedByUsers.includes(myUid) : false) || Boolean(optimisticClaimedTiers[viewTier.tier]);
  const partnerClaimed = myUid ? claimedByUsers.some(id => id !== myUid) : claimedByUsers.length > 0;
  const isWaitingForPartner = isUnclaimed && hasUserClaimed;
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
    if (!onClaim || !isUnclaimed || hasUserClaimed || loadingClaim) return;
    const tier = viewTier.tier;
    setOptimisticClaimedTiers((prev) => ({ ...prev, [tier]: true }));
    setLoadingClaim(true);
    try {
      await onClaim(quest.id, tier, viewTier.reward);
    } catch {
      setOptimisticClaimedTiers((prev) => ({ ...prev, [tier]: false }));
    } finally {
      setLoadingClaim(false);
    }
  };

  // Carte verte si le palier visé est terminé (que ce soit claimé ou non)
  const cardDoneStyle = isViewTierDone
    ? {
        backgroundColor: store.isDarkMode ? 'rgba(20,83,45,0.42)' : '#F0FDF4',
        borderColor: store.isDarkMode ? '#166534' : '#BBF7D0',
      }
    : {};

  return (
    <Animated.View style={[styles.card, cardDoneStyle, highlightStyle]}>
      
      {/* 1ère ligne : Titre + Récompense */}
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <Text style={styles.icon}>{quest.icon}</Text>
          {!iconOnly && <Text style={styles.description} numberOfLines={compact ? 1 : 2}>
            {compact ? quest.name : `${quest.description} (${targetAmount})`}
          </Text>}
        </View>
        <View style={[styles.rewardBadge, { backgroundColor: store.isDarkMode ? 'rgba(255,154,139,0.16)' : '#F9F4F2' }]}>
          <Text style={[styles.rewardText, { color: store.isDarkMode ? '#FFB8AD' : '#FF6A88' }]}>+{viewTier.reward} 🌸</Text>
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

        {isUnclaimed && !hasUserClaimed && (
          <Pressable
            style={[styles.claimBtn, loadingClaim && { opacity: 0.6 }]}
            onPress={handleClaim}
            disabled={loadingClaim || hasUserClaimed}
            pointerEvents={loadingClaim || hasUserClaimed ? 'none' : 'auto'}
            accessibilityState={{ disabled: loadingClaim || hasUserClaimed }}
          >
            {loadingClaim ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.claimBtnText}>
                {partnerClaimed ? 'Récupérer ✨' : 'Récupérer'}
              </Text>
            )}
          </Pressable>
        )}

        {isWaitingForPartner && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText} numberOfLines={1}>
              {compact ? '⏳ En attente' : '⏳ En attente partenaire'}
            </Text>
          </View>
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

const getStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: theme.card,
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
  track: { flex: 1, height: 8, backgroundColor: isDark ? '#3A2F35' : '#F0EAE8', borderRadius: 4, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 4 },
  count: { fontSize: 12, fontWeight: '700', color: theme.text, minWidth: 40, textAlign: 'right' },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  
  roadmap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  milestone: {
    padding: 6, borderRadius: 10,
    borderWidth: 2, borderColor: 'transparent', backgroundColor: isDark ? '#302329' : '#F9F4F2',
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
  
  claimedBadge: { backgroundColor: isDark ? '#3A2F35' : '#e2e8f0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  claimedText: { color: isDark ? '#D8C9CE' : '#64748b', fontWeight: '700', fontSize: 12 },
  pendingBadge: { backgroundColor: isDark ? 'rgba(251,191,36,0.15)' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, flexShrink: 1, maxWidth: '52%' },
  pendingText: { color: isDark ? '#FBBF24' : '#B45309', fontWeight: '700', fontSize: 10.5, textAlign: 'center' }
});
