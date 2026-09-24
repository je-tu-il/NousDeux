/**
 * quests.tsx — Page des quêtes
 * Tri : non-complétées d'abord (palier le + avancé en haut), complétées en bas
 * Filtre : uniquement "Tout" (les complétées descendent naturellement)
 * Layout : maxWidth 500 centré
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ImageBackground,
    Modal,
    Platform, Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from 'react-native';
import QuestCard from '../components/QuestCard';
import { Colors } from '../constants/Colors';
import { Cosmetic, COSMETICS, getCosmeticById, getCosmeticImage, parseGradientColors } from '../data/cosmetics';
import { QUESTS } from '../data/quests';
import { claimQuestReward, getQuestProgress, QuestProgressMap, QuestTier, updateCoupleDurationQuest } from '../lib/economy';
import { auth, db } from '../lib/firebase';
import { useOnboardingStore } from '../store/onboardingStore';

const TIER_RANK: Record<string, number> = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
const questProgressCache = new Map<string, QuestProgressMap>();

async function getCoupleId(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists() && snap.data().linkedTo) {
      return [uid, snap.data().linkedTo].sort().join('_');
    }

    return null;
  } catch {
    return null;
  }
}

export default function QuestsScreen() {
  const store = useOnboardingStore((state) => state);
  const { width: windowWidth } = useWindowDimensions();
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const background = getCosmeticById(store.selectedBackground);
  const backgroundSource = getCosmeticImage(background, store.isDarkMode) || (store.isDarkMode
    ? require('../../assets/images/nousdeux_dark_background.png')
    : require('../../assets/images/nousdeux_warm_background.png'));
  const myUid = store.uid || auth.currentUser?.uid;
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const [loading, setLoading]     = useState(Boolean(myUid));
  const [refreshing, setRefreshing] = useState(false);
  const [progressMap, setProgressMap] = useState<QuestProgressMap>({});
  const [coupleId, setCoupleId] = useState<string | null>(null);

  const fetchQuests = useCallback(async () => {
    if (!myUid) {
      return;
    }
    try {
      const cId = await getCoupleId(myUid);
      if (cId) {
        setCoupleId(cId);
        const cached = questProgressCache.get(cId);
        if (cached) {
          setProgressMap(cached);
          setLoading(false);
        }
        const userSnap = await getDoc(doc(db, 'users', myUid));
        const userData = userSnap.data();
        const startDate = userData?.linkedAt || new Date().toISOString();
        if (!userData?.linkedAt) {
          setDoc(doc(db, 'users', myUid), { linkedAt: startDate }, { merge: true }).catch(() => {});
        }
        await updateCoupleDurationQuest(cId, startDate);
        const progress = await getQuestProgress(cId);
        questProgressCache.set(cId, progress);
        setProgressMap(progress || {});
      }
    } catch (e) {
      console.error('[Quests]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myUid]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      if (!myUid) return;
      try {
        const cId = await getCoupleId(myUid);
        if (!cId || isCancelled) return;
        setCoupleId(cId);
        const cached = questProgressCache.get(cId);
        if (cached && !isCancelled) {
          setProgressMap(cached);
          setLoading(false);
        }
        const userSnap = await getDoc(doc(db, 'users', myUid));
        const userData = userSnap.data();
        const startDate = userData?.linkedAt || new Date().toISOString();
        if (!userData?.linkedAt) {
          setDoc(doc(db, 'users', myUid), { linkedAt: startDate }, { merge: true }).catch(() => {});
        }
        await updateCoupleDurationQuest(cId, startDate);
        const progress = await getQuestProgress(cId);
        if (isCancelled) return;
        questProgressCache.set(cId, progress);
        setProgressMap(progress || {});
      } catch (e) {
        console.error('[Quests]', e);
      } finally {
        if (!isCancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => { isCancelled = true; };
  }, [myUid]);

  const [unlockedCosmetic, setUnlockedCosmetic] = useState<Cosmetic | null>(null);

  const handleClaim = async (questId: string, tierLevel: QuestTier, reward: number) => {
    if (!coupleId) return;
    if (!store.uid) return;
    const success = await claimQuestReward(coupleId, questId, tierLevel, reward, store.uid);
    await fetchQuests();
    if (success) {
      // Check if a cosmetic was unlocked
      const cosmetic = COSMETICS.find(c => c.unlock.type === 'quest' && c.unlock.questId === questId && c.unlock.tier === tierLevel);
      if (cosmetic) {
        setUnlockedCosmetic(cosmetic);
      }
    }
  };

  // â”€â”€ Stats et tri â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { sortedQuests } = useMemo(() => {
    const sorted = [...QUESTS].sort((a, b) => {
      const progA = progressMap[a.id];
      const progB = progressMap[b.id];

      // Quêtes platine maxées â†’ tout en bas
      const aFullDone = progA?.tier === 'platinum';
      const bFullDone = progB?.tier === 'platinum';
      if (aFullDone && !bFullDone) return 1;
      if (!aFullDone && bFullDone) return -1;

      // Sort by tier rank (higher first)
      const rankA = TIER_RANK[progA?.tier ?? ''] ?? 0;
      const rankB = TIER_RANK[progB?.tier ?? ''] ?? 0;
      if (rankA !== rankB) return rankB - rankA;

      // Same tier â†’ sort by progress ratio (higher first)
      const nextTierA = a.tiers.find(t => t.tier !== (progA?.tier ?? '')) ?? a.tiers[0];
      const nextTierB = b.tiers.find(t => t.tier !== (progB?.tier ?? '')) ?? b.tiers[0];
      const ratioA = (progA?.current ?? 0) / (nextTierA?.threshold ?? 1);
      const ratioB = (progB?.current ?? 0) / (nextTierB?.threshold ?? 1);
      return ratioB - ratioA;
    });

    return { sortedQuests: sorted };
  }, [progressMap]);

  // â”€â”€ Chargement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) {
    return (
      <ImageBackground source={backgroundSource} style={styles.root} resizeMode="cover">
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF9A8B" />
          <Text style={{ marginTop: 14, color: theme.text }}>Chargement des quêtes...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundSource} style={styles.root} resizeMode="cover" imageStyle={{ objectPosition: windowWidth < 600 ? 'center bottom' : 'center' } as any}>
      <View style={{ flex: 1, backgroundColor: store.isDarkMode ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.22)', width: '100%', maxWidth: 500, alignSelf: 'center' }}>
        {/* Header */}
        <LinearGradient
          colors={['#FF9A8B', '#FF6A88']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }} style={styles.backBtn}>
            <ArrowLeft color="white" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Quêtes</Text>
        </LinearGradient>

        {/* Liste */}
        <FlatList
          data={sortedQuests}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const prog = progressMap[item.id] ?? { current: 0, tier: null };
            return <QuestCard quest={item} progress={prog} onClaim={handleClaim} isHighlighted={highlight === item.id} />;
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchQuests(); }} colors={['#FF9A8B']} tintColor="#FF9A8B" />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucune quête.</Text>
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Modal Récompense Cosmétique */}
        <Modal visible={!!unlockedCosmetic} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setUnlockedCosmetic(null)}>
            <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Nouvel objet débloqué !</Text>
              
              {unlockedCosmetic && (
                <View style={{ width: 140, height: 140, borderRadius: 24, overflow: 'hidden', alignSelf: 'center', marginVertical: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
                    {unlockedCosmetic.image ? (
                      <ImageBackground 
                        source={unlockedCosmetic.image} 
                        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} 
                        resizeMode={unlockedCosmetic.type === 'border' ? 'contain' : 'cover'}
                      >
                      </ImageBackground>
                    ) : (
                    <LinearGradient 
                      colors={unlockedCosmetic.type === 'background' ? parseGradientColors(unlockedCosmetic.preview) as [string, string] : ['#F5F5F5', '#ECECEC']} 
                      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 1 }}
                    >
                      {unlockedCosmetic.type === 'border' && (
                        <View style={{ width: '80%', height: '80%', borderRadius: 12, borderStyle: unlockedCosmetic.preview.includes('dashed') ? 'dashed' : unlockedCosmetic.preview.includes('dotted') ? 'dotted' : 'solid', borderWidth: parseInt(unlockedCosmetic.preview.match(/\d+px/)?.[0] || '3px'), borderColor: parseGradientColors(unlockedCosmetic.preview)[0] }} />
                      )}
                      {unlockedCosmetic.type === 'tag' && (
                        <Text style={{ fontSize: 60 }}>{unlockedCosmetic.emoji}</Text>
                      )}
                    </LinearGradient>
                  )}
                </View>
              )}

              <Text style={styles.modalDesc}>
                Tu as débloqué : <Text style={{ fontWeight: 'bold' }}>{unlockedCosmetic?.name}</Text> !
              </Text>

              <View style={styles.modalActions}>
                <Pressable style={styles.btnCancel} onPress={() => setUnlockedCosmetic(null)}>
                  <Text style={styles.btnCancelText}>Fermer</Text>
                </Pressable>
                <Pressable
                  style={styles.btnConfirm}
                  onPress={() => {
                    setUnlockedCosmetic(null);
                    router.push('/shop');
                  }}
                >
                  <Text style={styles.btnConfirmText}>Voir dans la boutique</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

      </View>
    </ImageBackground>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 50 : 14,
    gap: 12,
  },
  backBtn:       { padding: 4 },
  headerTitle:   { color: 'white', fontSize: 18, fontWeight: '800', flex: 1 },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },

  statsWrap: {
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E5E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  statItem:  { alignItems: 'center', gap: 2 },
  statEmoji: { fontSize: 20 },
  statCount: { fontSize: 18, fontWeight: '900', color: theme.text },
  statLabel: { fontSize: 10, color: theme.tabIconDefault, fontWeight: '600' },

  listContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: theme.background, borderRadius: 24, padding: 24,
    width: '100%', maxWidth: 400, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10
  },
  modalTitle:   { fontSize: 20, fontWeight: '900', color: theme.text, textAlign: 'center' },
  modalDesc:    { fontSize: 15, color: theme.text, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  btnCancel: {
    flex: 1, backgroundColor: '#E2E8F0', padding: 14, borderRadius: 12, alignItems: 'center'
  },
  btnCancelText: { color: '#64748B', fontWeight: '800', fontSize: 15 },
  btnConfirm: {
    flex: 1, backgroundColor: '#FF9A8B', padding: 14, borderRadius: 12, alignItems: 'center'
  },
  btnConfirmText: { color: 'white', fontWeight: '800', fontSize: 15 },
});
