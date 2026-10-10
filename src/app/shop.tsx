/**
 * shop.tsx — Boutique cosmétique NousDeux
 * Corrections: utilise le bon type Cosmetic (preview, unlock.type, unlock.price...)
 * purchaseItem prend (cId, itemId, itemType, price)
 */

import { Colors } from '@/constants/Colors';
import { getCosmeticById, getCosmeticImage } from '@/data/cosmetics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Check, Lock } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    ImageBackground,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions
} from 'react-native';
import CoinWallet from '../components/CoinWallet';
import UIModal, { UIModalType } from '../components/UIModal';
import { useTopInset } from '@/hooks/useTopInset';
import { BACKGROUNDS, BORDERS, Cosmetic, TAGS, WIDGETS, UnlockCondition, isOwned, parseGradientColors } from '../data/cosmetics';
import { QUESTS } from '../data/quests';
import {
    InventoryData,
    ItemType,
    QuestProgressMap,
    UserProfile,
    WalletData,
    computeStreakCached,
    getUserProfile,
    getWallet,
    purchaseItem,
    saveUserProfile
} from '../lib/economy';
import GoogleAdBanner from '../components/GoogleAdBanner';
import RewardedAdButton from '../components/RewardedAdButton';
import { db } from '../lib/firebase';
import { useOnboardingStore } from '../store/onboardingStore';
import { sound } from '../lib/sound';
import { syncWidgetData } from '../lib/widgets';

// ——— Helpers ————————————————————————————————————————————————————————————————


/** Prix d'un cosmetic (0 si gratuit/streak/quête) */
function getPrice(unlock: UnlockCondition): number {
  // Les gains de la roulette permettent plusieurs achats par jour : réserver
  // les cosmétiques à une progression de plusieurs jours.
  if (unlock.type === 'purchase') return Math.round(((unlock as any).price ?? 0) * 5);
  return 0;
}

/** Peut-on voir/acheter cet item dans le shop (selon wallet streak) */
function canShowPurchase(item: Cosmetic, streak: number): boolean {
  if (item.unlock.type === 'free') return true;
  if (item.unlock.type === 'purchase') return true;
  if (item.unlock.type === 'streak') return streak >= ((item.unlock as any).days ?? 0);
  if (item.unlock.type === 'quest') return false; // montré mais verrouillé
  return true;
}

type TabType = 'backgrounds' | 'borders' | 'tags' | 'widgets';

const TAB_DATA: Record<TabType, Cosmetic[]> = {
  backgrounds: BACKGROUNDS,
  borders: BORDERS,
  tags: TAGS,
  widgets: WIDGETS,
};

// ——— Composant ——————————————————————————————————————————————————————————————


export default function ShopScreen() {
  const store = useOnboardingStore((state) => state);
  const { width: windowWidth } = useWindowDimensions();
  const topInset = useTopInset();
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const background = getCosmeticById(store.selectedBackground);
  const backgroundSource = getCosmeticImage(background, store.isDarkMode) || (store.isDarkMode
    ? require('../../assets/images/nousdeux_dark_background.png')
    : require('../../assets/images/nousdeux_warm_background.png'));
  const myUid = useOnboardingStore(s => s.uid);

  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: TabType = (params.tab && ['backgrounds', 'borders', 'tags', 'widgets'].includes(params.tab))
    ? (params.tab as TabType)
    : 'backgrounds';

  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState<TabType>(initialTab);
  const [wallet,        setWallet]        = useState<WalletData | null>(null);
  const [inventory,     setInventory]     = useState<InventoryData | null>(null);
  const [questProgress, setQuestProgress] = useState<QuestProgressMap>({});
  const [coupleId,      setCoupleId]      = useState<string | null>(null);
  const [selectedItem,  setSelectedItem]  = useState<Cosmetic | null>(null);
  const [isPurchasing,  setIsPurchasing]  = useState(false);
  const [userProfile,   setUserProfile]   = useState<UserProfile | null>(null);
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type?: UIModalType;
    title?: string;
    message?: string;
  }>({ visible: false });

  useEffect(() => {
    if (params.tab && ['backgrounds', 'borders', 'tags', 'widgets'].includes(params.tab)) {
      setActiveTab(params.tab as TabType);
    }
  }, [params.tab]);

  const fetchShopData = useCallback(async () => {
    if (!myUid) return;
    try {
      const snap = await getDoc(doc(db, 'users', myUid));
      if (snap.exists() && snap.data().linkedTo) {
        const pUid = snap.data().linkedTo;
        const cId = [myUid, pUid].sort().join('_');
        setCoupleId(cId);

        // Pas besoin de charger wallet/inventory si on utilise des listeners
      }
      const profile = await getUserProfile(myUid);
      setUserProfile(profile);
    } catch (e) {
      console.error('[Shop] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [myUid]);

  useEffect(() => { fetchShopData(); }, [fetchShopData]);

  // Écoute des données en temps réel
  useEffect(() => {
    if (!coupleId) return;
    const unsubWallet = onSnapshot(doc(db, `couples/${coupleId}/economy/wallet`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as WalletData;
        setWallet(data);
        void computeStreakCached(coupleId, true).then((streak) => {
          setWallet((current) => current ? { ...current, streak } : current);
        });
      }
    });
    const unsubInventory = onSnapshot(doc(db, `couples/${coupleId}/inventory/cosmetics`), (docSnap) => {
      if (docSnap.exists()) setInventory(docSnap.data() as InventoryData);
    });
    const unsubQuests = onSnapshot(doc(db, `couples/${coupleId}/quests/progress`), (docSnap) => {
      if (docSnap.exists()) setQuestProgress(docSnap.data() as QuestProgressMap);
    });
    return () => {
      unsubWallet();
      unsubInventory();
      unsubQuests();
    };
  }, [coupleId]);

  const handlePurchase = async () => {
    if (!selectedItem || !coupleId || !wallet) return;
    const price = getPrice(selectedItem.unlock);
    if (wallet.petals < price) {
      setModalState({
        visible: true,
        type: 'funds',
        title: 'Pétales insuffisantes',
        message: `Il te faut ${price} 🌸 mais vous n'avez que ${wallet.petals} 🌸 dans la cagnotte du couple.`,
      });
      return;
    }

    setIsPurchasing(true);
    try {
      // purchaseItem signature: (cId, itemId, itemType, price)
      const result = await purchaseItem(coupleId, selectedItem.id, selectedItem.type as ItemType, price);
      if (result.success) {
        await fetchShopData();
        setSelectedItem(null);
      } else {
        setModalState({
          visible: true,
          type: 'error',
          title: 'Achat impossible',
          message: result.reason ?? 'Transaction échouée.',
        });
      }
    } catch {
      setModalState({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: 'Une erreur est survenue lors de l\'achat. Vérifie ta connexion.',
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  // —— Rendu d'un item ————————————————————————————————————————————————————

  const renderItemCard = ({ item }: { item: Cosmetic }) => {
    const streak     = wallet?.streak ?? 0;
    const owned      = inventory ? isOwned(inventory, item, streak, questProgress) : false;
    const canBuy     = canShowPurchase(item, streak);
    const price      = getPrice(item.unlock);
    const isLocked   = !owned && !canBuy;

    const bgColors   = item.type === 'background' ? parseGradientColors(item.preview) : ['#F5F5F5', '#ECECEC'];
    const previewImage = item.type === 'background' ? getCosmeticImage(item, store.isDarkMode) : item.image;
    const previewColors = store.isDarkMode ? ['#241B2A', '#111827'] : bgColors;

    const isEquipped = 
      (item.type === 'background' && userProfile?.selectedBackground === item.id) ||
      (item.type === 'border' && userProfile?.selectedBorder === item.id) ||
      (item.type === 'tag' && userProfile?.selectedTag === item.id) ||
      (item.type === 'widget' && (userProfile?.selectedWidget === item.id || store.selectedWidget === item.id));

    const onSelect = async () => {
      // Selecting the currently equipped default/free item must never open
      // the purchase dialog, even while the inventory listener is loading.
      if (isEquipped) {
        sound.pop();
        return;
      }
      if (owned) {
        sound.pop();
        if (myUid) {
          const updates: Partial<UserProfile> = {};
          if (item.type === 'background') updates.selectedBackground = item.id;
          if (item.type === 'border') updates.selectedBorder = item.id;
          if (item.type === 'tag') updates.selectedTag = item.id;
          if (item.type === 'widget') {
            updates.selectedWidget = item.id;
            store.setSelectedWidget(item.id);
            void syncWidgetData({ themeId: item.id });
          }
          await saveUserProfile(myUid, updates);
          const newProfile = await getUserProfile(myUid);
          setUserProfile(newProfile);
          // Sync Zustand store so dashboard updates immediately
          if (newProfile) {
            store.setSelectedCosmetics(
              newProfile.selectedBackground,
              newProfile.selectedBorder,
              newProfile.selectedTag,
            );
          }
        }
      } else {
        sound.tap();
        setSelectedItem(item);
      }
    };

    return (
      <Pressable
        onPress={onSelect}
        style={({ pressed }) => [
          styles.card, 
          isLocked && styles.cardLocked, 
          owned && { backgroundColor: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.3)', borderWidth: 2 },
          isEquipped && { borderColor: '#4CAF50', borderWidth: 3 },
          { opacity: pressed ? 0.88 : 1 }
        ]}
      >
        {/* Preview */}
        <View style={styles.previewContainer}>
          {item.type === 'background' && (
            previewImage ? (
              <Image source={previewImage} style={styles.bgPreview} resizeMode="cover" />
            ) : (
              <LinearGradient colors={previewColors as [string, string]} style={styles.bgPreview} />
            )
          )}
          {item.type === 'border' && (
            <View style={styles.borderCardWrapper}>
              <View style={styles.avatarMiniBase}>
                {store.avatar ? (
                  <Image source={{ uri: store.avatar }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
                ) : (
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>
                    {(store.pseudo || 'M')[0]}
                  </Text>
                )}
              </View>
              {item.image ? (
                <View pointerEvents="none" style={styles.borderCardImageOverlay}>
                  <Image source={item.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
              ) : (
                <View 
                  pointerEvents="none" 
                  style={[
                    styles.borderCardCssOverlay,
                    { borderColor: parseGradientColors(item.preview)[0] || '#FF9A8B' },
                  ]} 
                />
              )}
            </View>
          )}
          {item.type === 'tag' && (
            <View style={styles.tagPreviewBox}>
              <Text style={styles.tagEmoji}>{item.emoji ?? '🏷️'}</Text>
              {windowWidth >= 360 && <Text style={styles.tagName} numberOfLines={1}>{item.name}</Text>}
            </View>
          )}
          {item.type === 'widget' && (
            <LinearGradient
              colors={parseGradientColors(item.preview) as [string, string]}
              style={[styles.bgPreview, { alignItems: 'center', justifyContent: 'center' }]}
            >
              <Text style={{ fontSize: 32 }}>{item.emoji ?? '📱'}</Text>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 4 }}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>WIDGET</Text>
              </View>
            </LinearGradient>
          )}

          {isLocked && (
            <View style={styles.lockOverlay}>
              <Lock color="#FFFFFF" size={22} />
            </View>
          )}
          {isEquipped && (
            <View style={styles.ownedOverlay}>
              <Check color="#FFFFFF" size={18} />
            </View>
          )}
        </View>

        {/* Nom */}
        {windowWidth >= 360 && <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>}

        {/* Badge prix/statut */}
        {windowWidth < 360 ? (
          <View style={styles.compactStatus}><Text style={styles.compactStatusText}>{owned ? '✓' : isLocked ? '🔒' : '🌸'}</Text></View>
        ) : (item.id === 'tag_free_0' || item.id === 'widget_default') ? (
          <View style={[styles.badgeFree, isEquipped && { backgroundColor: '#4CAF50' }]}>
            <Text style={[styles.badgeFreeText, isEquipped && { color: 'white' }]}>
              {isEquipped ? 'Équipé ✅' : 'Défaut'}
            </Text>
          </View>
        ) : owned ? (
          <View style={[styles.badgeOwned, isEquipped && { backgroundColor: '#4CAF50' }]}>
            <Text style={[styles.badgeOwnedText, isEquipped && { color: 'white' }]}>
              {isEquipped ? 'Équipé ✅' : 'Possédé'}
            </Text>
          </View>
        ) : item.unlock.type === 'free' ? (
          <View style={styles.badgeFree}>
            <Text style={styles.badgeFreeText}>Gratuit</Text>
          </View>
        ) : item.unlock.type === 'purchase' ? (
          <View style={[styles.badgePrice, wallet && wallet.petals < price ? styles.badgePriceMissing : null]}>
            <Text style={styles.badgePriceText}>{price} 🌸</Text>
          </View>
        ) : item.unlock.type === 'streak' ? (
          <View style={styles.badgeStreak}>
            <Text style={styles.badgeStreakText}>🔥 {(item.unlock as any).days}j</Text>
          </View>
        ) : (
          <View style={styles.badgeLocked}>
            <Lock color="#A0A0A0" size={12} />
            <Text style={styles.badgeLockedText}> Quête</Text>
          </View>
        )}
      </Pressable>
    );
  };

  // —— Chargement —————————————————————————————————————————————————————————
  if (loading) {
    return (
      <ImageBackground source={backgroundSource} style={styles.root} resizeMode="cover" imageStyle={{ objectPosition: windowWidth < 600 ? 'center bottom' : 'center' } as any}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF9A8B" />
          <Text style={{ marginTop: 14, color: theme.text }}>Chargement de la boutique...</Text>
        </View>
      </ImageBackground>
    );
  }

  const currentData = TAB_DATA[activeTab];

  return (
    <ImageBackground source={backgroundSource} style={styles.root} resizeMode="cover" imageStyle={{ objectPosition: windowWidth < 600 ? 'center bottom' : 'center' } as any}>
      <View style={{ flex: 1, backgroundColor: store.isDarkMode ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.22)', width: '100%', maxWidth: 500, alignSelf: 'center' }}>
        {/* Header */}
        <LinearGradient
          colors={['#FF9A8B', '#FF6A88']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.header, { paddingTop: topInset + 8 }]}
        >
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }} style={styles.backBtn}>
            <ArrowLeft color="white" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Boutique</Text>
            <CoinWallet petals={wallet?.petals ?? 0} size="small" theme="white" />
        </LinearGradient>

      {/* Wrapper global pour centrer sur grand écran */}
      <View style={{ flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center' }}>
        {/* Onglets (barre de choix) */}
        <View style={styles.tabs}>
          {((Platform.OS === 'web'
            ? ['backgrounds', 'borders', 'tags']
            : ['backgrounds', 'borders', 'tags', 'widgets']
          ) as TabType[]).map(tab => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => {
                sound.tap();
                setActiveTab(tab);
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'backgrounds' ? 'Fonds' : tab === 'borders' ? 'Bordures' : tab === 'tags' ? 'Titres' : 'Widgets'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Bouton Publicité Récompensée (+15 Pétales) sous la barre d'onglets */}
        <View style={{ marginTop: 14, marginBottom: 12 }}>
          <RewardedAdButton
            coupleId={coupleId}
            onRewardEarned={() => {
              if (coupleId) {
                getWallet(coupleId).then(setWallet).catch(() => {});
              }
            }}
          />
        </View>

        {Platform.OS !== 'web' && activeTab === 'widgets' && (
          <Pressable
            onPress={() => {
              sound.tap();
              router.push('/widgets');
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme.tint,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 16,
              marginTop: 2,
              marginBottom: 14,
              marginHorizontal: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>📱</Text>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>
                Personnaliser mes widgets en direct ›
              </Text>
            </View>
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>Voir</Text>
          </Pressable>
        )}

        {/* Grille */}
        <FlatList
          key={activeTab} // force re-render on tab change (numColumns)
          data={currentData}
          keyExtractor={item => item.id}
          renderItem={renderItemCard}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<GoogleAdBanner style={{ marginVertical: 16 }} />}
        />
      </View>

      {/* Modal confirmation achat */}
      <Modal visible={!!selectedItem} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedItem(null)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {selectedItem?.unlock.type === 'quest' ? "Exclusif Quête" : "Confirmer l'achat"}
            </Text>
            
            {/* Aperçu agrandi */}
            {selectedItem && (
              <View style={{ width: 160, height: 160, borderRadius: 30, overflow: 'hidden', alignSelf: 'center', marginVertical: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                {selectedItem.type === 'background' && (
                  getCosmeticImage(selectedItem, store.isDarkMode) ? (
                    <Image source={getCosmeticImage(selectedItem, store.isDarkMode)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={(store.isDarkMode ? ['#241B2A', '#111827'] : parseGradientColors(selectedItem.preview)) as [string, string]} style={{ width: '100%', height: '100%' }} />
                  )
                )}
                {selectedItem.type === 'border' && (
                  <View style={{ width: 140, height: 140, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    <View style={{ width: 90, height: 90, borderRadius: 18, overflow: 'hidden', backgroundColor: '#FF9A8B', justifyContent: 'center', alignItems: 'center' }}>
                      {store.avatar ? (
                        <Image source={{ uri: store.avatar }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 34 }}>{(store.pseudo || 'M')[0]}</Text>
                      )}
                    </View>
                    {selectedItem.image ? (
                      <View pointerEvents="none" style={{ position: 'absolute', width: 130, height: 130, justifyContent: 'center', alignItems: 'center', zIndex: 2 }}>
                        <Image source={selectedItem.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      </View>
                    ) : (
                      <View pointerEvents="none" style={{ position: 'absolute', width: 90, height: 90, borderRadius: 18, borderWidth: 3.5, borderStyle: 'solid', borderColor: parseGradientColors(selectedItem.preview)[0] || '#FF9A8B', zIndex: 2 }} />
                    )}
                  </View>
                )}
                {selectedItem.type === 'tag' && (
                  <View style={{ flex: 1, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 50 }}>{selectedItem.emoji}</Text>
                  </View>
                )}
                {selectedItem.type === 'widget' && (
                  <LinearGradient
                    colors={parseGradientColors(selectedItem.preview) as [string, string]}
                    style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 50 }}>{selectedItem.emoji || '📱'}</Text>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 12, marginTop: 4, letterSpacing: 1 }}>
                      STYLE WIDGET
                    </Text>
                  </LinearGradient>
                )}
              </View>
            )}

              {selectedItem && selectedItem.unlock.type === 'quest' ? (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Text style={styles.modalDesc}>
                    Cet objet ({selectedItem.emoji && selectedItem.emoji + ' '}<Text style={{ fontWeight: '800' }}>{selectedItem.name}</Text>) est une récompense exclusive !{'\n\n'}
                    Condition : <Text style={{ color: '#FF9A8B', fontWeight: '800' }}>
                      {(() => {
                        const qId = (selectedItem.unlock as any).questId;
                        const tier = (selectedItem.unlock as any).tier;
                        const q = QUESTS.find(x => x.id === qId);
                        const tName = tier === 'bronze' ? 'Bronze' : tier === 'silver' ? 'Argent' : tier === 'gold' ? 'Or' : 'Platine';
                        return q ? `Quête "${q.name}" (${tName})` : `Quête ${qId} (${tName})`;
                      })()}
                    </Text>
                  </Text>
                  
                  <Pressable 
                    style={{
                      backgroundColor: '#8B5CF6',
                      marginTop: 18,
                      paddingVertical: 12,
                      paddingHorizontal: 36,
                      borderRadius: 14,
                      minWidth: 160,
                      alignItems: 'center',
                    }} 
                    onPress={() => {
                      setSelectedItem(null);
                      router.push({ pathname: '/quests', params: { highlight: (selectedItem.unlock as any).questId } });
                    }}
                  >
                    <Text style={styles.btnConfirmText}>Voir la quête</Text>
                  </Pressable>
                </View>
              ) : selectedItem && selectedItem.unlock.type === 'streak' ? (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Text style={styles.modalDesc}>
                    Cet objet ({selectedItem.emoji && selectedItem.emoji + ' '}<Text style={{ fontWeight: '800' }}>{selectedItem.name}</Text>) est une récompense de fidélité !{'\n\n'}
                    Condition : <Text style={{ color: '#FF9A8B', fontWeight: '800' }}>
                      Nécessite {(selectedItem.unlock as any).days} jours de connexion pour l'obtenir.
                    </Text>
                  </Text>
                  
                  <Pressable 
                    style={{
                      backgroundColor: '#FF9A8B',
                      marginTop: 18,
                      paddingVertical: 12,
                      paddingHorizontal: 36,
                      borderRadius: 14,
                      minWidth: 160,
                      alignItems: 'center',
                    }} 
                    onPress={() => setSelectedItem(null)}
                  >
                    <Text style={styles.btnConfirmText}>Compris</Text>
                  </Pressable>
                </View>
              ) : selectedItem ? (
              <>
                <Text style={styles.modalDesc}>
                  Acheter {selectedItem.emoji && selectedItem.emoji + ' '}<Text style={{ fontWeight: '800' }}>{selectedItem.name}</Text> pour{' '}
                  <Text style={{ color: '#FF9A8B', fontWeight: '800' }}>{getPrice(selectedItem.unlock)} 🌸</Text> ?
                </Text>
                
                {((wallet?.petals ?? 0) - getPrice(selectedItem.unlock)) < 0 ? (
                  <Text style={[styles.modalBalance, { color: '#EF4444', fontWeight: 'bold' }]}>
                    Fonds insuffisants ! Il te manque {getPrice(selectedItem.unlock) - (wallet?.petals ?? 0)} 🌸
                  </Text>
                ) : (
                  <Text style={styles.modalBalance}>
                    Ton solde : {wallet?.petals ?? 0} 🌸 → {(wallet?.petals ?? 0) - getPrice(selectedItem.unlock)} 🌸
                  </Text>
                )}
              </>
            ) : null}

            {(selectedItem?.unlock.type === 'purchase' || selectedItem?.unlock.type === 'free') && (
              <View style={styles.modalActions}>
                <Pressable style={styles.btnCancel} onPress={() => setSelectedItem(null)} disabled={isPurchasing}>
                  <Text style={styles.btnCancelText}>Annuler</Text>
                </Pressable>
                
                <Pressable
                  style={[
                    styles.btnConfirm, 
                    (isPurchasing || !selectedItem || ((wallet?.petals ?? 0) - getPrice(selectedItem.unlock)) < 0) && { opacity: 0.5, backgroundColor: theme.tabIconDefault }
                  ]}
                  onPress={handlePurchase}
                  disabled={isPurchasing || !selectedItem || ((wallet?.petals ?? 0) - getPrice(selectedItem.unlock)) < 0}
                >
                  {isPurchasing
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={styles.btnConfirmText}>{selectedItem.unlock.type === 'free' ? 'Obtenir' : 'Acheter'}</Text>}
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>


      <UIModal
        visible={modalState.visible}
        onClose={() => setModalState({ visible: false })}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
      />
      </View>
    </ImageBackground>
  );
}

// ——— Styles —————————————————————————————————————————————————————————————————

const getStyles = (theme: any) => StyleSheet.create({
  root:    { flex: 1, width: '100%', height: '100%', minHeight: '100vh' as any, backgroundColor: 'transparent' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '800', flex: 1 },
  
  avatarRedirectBtn: {
    backgroundColor: '#FF6A88',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#FF6A88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  avatarRedirectText: { color: 'white', fontWeight: '700', fontSize: 14 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#FF9A8B' },
  tabText:       { color: theme.tabIconDefault, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#FF9A8B', fontWeight: '900' },

  listContent: {
    padding: 12, paddingBottom: 40,
    maxWidth: 600, width: '100%', alignSelf: 'center',
  },
  row: { justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 },

  card: {
    width: '48%',
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  cardLocked: { opacity: 0.65 },

  previewContainer: {
    width: '100%', aspectRatio: 1,
    borderRadius: 12, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8, position: 'relative',
    backgroundColor: theme.glassBackground,
  },
  bgPreview:    { width: '100%', height: '100%' },
  borderCardWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarMiniBase: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FF9A8B',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  borderCardImageOverlay: {
    position: 'absolute',
    width: 74,
    height: 74,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  borderCardCssOverlay: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 3,
    borderStyle: 'solid',
    zIndex: 2,
  },
  tagPreviewBox: { 
    alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.glassBackground, borderRadius: 16,
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2
  },
  tagEmoji:     { fontSize: 26 },
  tagName:      { fontSize: 12, fontWeight: '800', color: '#FF6A88', textAlign: 'center' },

  lockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  ownedOverlay: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: '#22c55e',
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },

  itemName: {
    fontSize: 13, fontWeight: '700', color: theme.text,
    marginBottom: 6, textAlign: 'center', width: '100%',
  },

  badgeOwned:       { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeOwnedText:   { color: '#4CAF50', fontSize: 11, fontWeight: '700' },
  badgeFree:        { backgroundColor: theme.glassBackground, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeFreeText:    { color: theme.tabIconDefault, fontSize: 11, fontWeight: '700' },
  badgePrice:       { backgroundColor: 'rgba(255,154,139,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgePriceMissing: { backgroundColor: 'rgba(239,68,68,0.1)' },
  badgePriceText:   { color: '#FF6A88', fontSize: 11, fontWeight: '800' },
  badgeStreak:      { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeStreakText:  { color: '#1976D2', fontSize: 11, fontWeight: '700' },
  badgeLocked:      { backgroundColor: '#F3F0FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeLockedText:  { color: '#7C3AED', fontSize: 11, fontWeight: '700' },
  compactStatus: { minHeight: 18, alignItems: 'center', justifyContent: 'center' },
  compactStatusText: { fontSize: 14 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: theme.card, borderRadius: 24,
    padding: 24, width: '100%', maxWidth: 380, alignItems: 'center', gap: 12,
  },
  modalTitle:   { fontSize: 20, fontWeight: '900', color: theme.text },
  modalDesc:    { fontSize: 15, color: theme.text, textAlign: 'center', lineHeight: 22 },
  modalBalance: { fontSize: 13, color: theme.tabIconDefault, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  btnCancel: {
    flex: 1, paddingVertical: 13, backgroundColor: theme.glassBackground,
    borderRadius: 14, alignItems: 'center',
  },
  btnCancelText: { color: theme.text, fontWeight: '700', fontSize: 15 },
  btnConfirm: {
    flex: 1, paddingVertical: 13, backgroundColor: '#FF6A88',
    borderRadius: 14, alignItems: 'center',
  },
  btnConfirmText: { color: 'white', fontWeight: '800', fontSize: 15 },
});
