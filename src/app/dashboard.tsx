import AppLaunchAd from '@/components/AppLaunchAd';
import CoinWallet from '@/components/CoinWallet';
import DailyClaim from '@/components/DailyClaim';
import GoogleAdBanner from '@/components/GoogleAdBanner';
import PixelAvatar from '@/components/PixelAvatar';
import StreakCalendar from '@/components/StreakCalendar';
import { Colors } from '@/constants/Colors';
import { Cosmetic, COSMETICS, getCosmeticById, getCosmeticImage, parseGradientColors } from '@/data/cosmetics';
import { cacheWallet, checkStreakRestorable, computeStreakCached, getCachedWallet, getUserProfile, getWallet, invalidateStreakCache, restoreLostStreak, STREAK_RESTORE_COST, syncUnlimitedStats, updateWalletStreak, UserProfile } from '@/lib/economy';
import { auth, db } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useSegments } from 'expo-router';
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore';
import { Brain, CalendarHeart, Camera, Coffee, Copy, Flame, Heart, HeartHandshake, Home, Infinity as InfinityIcon, Lock, MessageCircle, Rocket, Settings, Smile, Split, Star, Trophy, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { ensureUserPairingCode } from '@/lib/pairing';
import { useToastStore } from '@/store/toastStore';
import { triggerHaptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTopInset } from '@/hooks/useTopInset';
import { syncWidgetData } from '@/lib/widgets';
import { registerPushTokenForUser, triggerPartnerAnsweredNotification } from '@/lib/notifications';
import { getById } from '@/data/questions';
import { getScheduledQuestionId } from '@/data/scheduledQuestions';

type PartnerData = { pseudo: string; avatarUrl?: string; coupleDate?: string; age?: string; coupleId?: string };

export default function DashboardScreen() {
  const store = useOnboardingStore((state) => state);
  const { width: windowWidth } = useWindowDimensions();
  const topInset = useTopInset();
  const segments = useSegments();
  const redirectGuardRef = useRef<string | null>(null);

  const redirectToSetup = (route: '/onboarding/sync' | '/onboarding/date') => {
    const current = segments[segments.length - 1];
    if (current === 'sync' || current === 'date') return;
    if (redirectGuardRef.current === route) return;
    redirectGuardRef.current = route;
    router.replace(route);
  };
  
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const styles: any = getStyles(theme, windowWidth);
  const background = getCosmeticById(store.selectedBackground);
  const backgroundSource = getCosmeticImage(background, store.isDarkMode) || (store.isDarkMode
    ? require('../../assets/images/nousdeux_dark_background.png')
    : require('../../assets/images/nousdeux_warm_background.png'));
  const backgroundResizeMode = 'cover';

  const [unlockedCosmetic, setUnlockedCosmetic] = useState<Cosmetic | null>(null);
  const [partner, setPartner] = useState<PartnerData | null>(() => (
    store.isSynced && store.partnerUid && store.partnerPseudo && store.uid
      ? {
          pseudo: store.partnerPseudo,
          avatarUrl: store.partnerAvatar ?? undefined,
          coupleId: [store.uid, store.partnerUid].sort().join('_'),
        }
      : null
  ));
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [unlockedItems, setUnlockedItems] = useState<Cosmetic[]>([]);
  const [wallet, setWallet] = useState<any>(() => {
    const initialCoupleId = store.isSynced && store.partnerUid && store.uid ? [store.uid, store.partnerUid].sort().join('_') : null;
    return initialCoupleId ? getCachedWallet(initialCoupleId) : null;
  });
  const [hasQuestRewards, setHasQuestRewards] = useState(false);
  const [partnerAnsweredCategories, setPartnerAnsweredCategories] = useState<Set<string>>(new Set());

  const activeUid = store.uid || auth?.currentUser?.uid;
  const previousUidRef = useRef(activeUid);
  useEffect(() => {
    if (previousUidRef.current !== activeUid) {
      previousUidRef.current = activeUid;
      setPartner(null);
      setPartnerLeft(false);
      setMyProfile(null);
      setPartnerProfile(null);
      setWallet(null);
      setUnlockedItems([]);
      setPartnerAnsweredCategories(new Set());
    }
  }, [activeUid]);

  useEffect(() => {
    const checkStreakUnlock = async () => {
      if (!wallet?.streak) return;
      try {
        const lastSeenStr = await AsyncStorage.getItem('last_seen_streak_unlock');
        const lastSeen = lastSeenStr ? parseInt(lastSeenStr) : 0;
        if (wallet.streak > lastSeen) {
          const newUnlocks = COSMETICS.filter(c => c.unlock.type === 'streak' && c.unlock.days === wallet.streak);
          if (newUnlocks.length > 0) {
            setUnlockedItems(newUnlocks);
            await AsyncStorage.setItem('last_seen_streak_unlock', wallet.streak.toString());
          }
        }
      } catch(e) {}
    };
    checkStreakUnlock();
  }, [wallet?.streak]);

  const [streakRestoreOffer, setStreakRestoreOffer] = useState<{ canRestore: boolean; lostStreak: number; cost: number } | null>(null);
  const [restoringStreak, setRestoringStreak] = useState(false);

  const [isLoading, setIsLoading] = useState(Boolean(store.uid));
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1500 }), withTiming(1, { duration: 1500 })),
      -1,
      true
    );

    const activeUid = store.uid || auth?.currentUser?.uid;
    if (!activeUid) {
      router.replace('/onboarding/login');
      return;
    }
    if (!store.uid && activeUid) {
      store.setUid(activeUid);
    }
    let partnerUnsub: any = null;

    const unsub = onSnapshot(doc(db, 'users', activeUid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        const currentAvatar = data.avatarUrl || data.avatar || null;
        if (currentAvatar && store.avatar !== currentAvatar) {
          store.setAvatar(currentAvatar);
        }
        if (data.pseudo && store.pseudo !== data.pseudo) {
          store.setPseudo(data.pseudo);
        }
        if (data.pairingCode && store.myCode !== data.pairingCode) {
          store.setMyCode(data.pairingCode);
        } else if (!data.pairingCode) {
          ensureUserPairingCode(activeUid, store.myCode).then((code) => {
            store.setMyCode(code);
          }).catch(() => {});
        }

        if (!data.linkedTo) {
          if (partnerUnsub) {
            partnerUnsub();
            partnerUnsub = null;
          }
          setPartner(null);
          setPartnerProfile(null);
          setWallet(null);
          setPartnerLeft(true);
          store.setSynced(false);
          store.clearPartnerCache();
          setIsLoading(false);
          return;
        }
        if (data.needsDate) {
          setIsLoading(false);
          router.replace('/onboarding/date');
          return;
        }
        // We set up a realtime listener for the partner document
        if (!partnerUnsub) {
          partnerUnsub = onSnapshot(doc(db, 'users', data.linkedTo), (pSnap) => {
            if (pSnap.exists()) {
              const pData = pSnap.data();
              // Vérification réciproque : si le partenaire a délié son compte, repasser en mode solo
              if (pData.linkedTo && pData.linkedTo === activeUid) {
                store.setSynced(true);
                store.setPartnerCache(data.linkedTo, pData.pseudo, pData.avatarUrl ?? null);
                setPartner({
                  pseudo: pData.pseudo,
                  avatarUrl: pData.avatarUrl,
                  coupleDate: data.coupleDate,
                  age: pData.age,
                  coupleId: [activeUid, data.linkedTo].sort().join('_'),
                });
                setPartnerLeft(false);
              } else {
                store.setSynced(false);
                store.clearPartnerCache();
                setPartner(null);
                setPartnerProfile(null);
                setWallet(null);
                setPartnerLeft(true);
              }
            } else {
              store.setSynced(false);
              store.clearPartnerCache();
              setPartner(null);
              setPartnerProfile(null);
              setWallet(null);
              setPartnerLeft(true);
            }
            setIsLoading(false);
          }, () => {
            store.setSynced(false);
            store.clearPartnerCache();
            setPartner(null);
            setPartnerProfile(null);
            setWallet(null);
            setPartnerLeft(true);
            setIsLoading(false);
          });
        }
      } else {
        // Le document utilisateur n'existe pas encore en Firestore (nouveau compte ou après suppression)
        ensureUserPairingCode(activeUid, store.myCode).then((code) => {
          store.setMyCode(code);
        }).catch(() => {});
        setIsLoading(false);
      }
    }, (error) => {
      console.warn("Snapshot utilisateur dashboard :", error);
      setIsLoading(false);
      // Ne déconnecter que si Firebase Auth confirme que l'utilisateur a été supprimé
      if ((error.code === 'permission-denied' || error.code === 'not-found') && auth.currentUser) {
        auth.currentUser.reload().catch((reloadErr: any) => {
          if (reloadErr?.code === 'auth/user-not-found' || reloadErr?.code === 'auth/user-token-expired') {
            void auth.signOut().finally(() => {
              store.resetSession();
              router.replace('/onboarding/login');
            });
          }
        });
      }
    });

    return () => {
      unsub();
      if (partnerUnsub) partnerUnsub();
    };
  }, [store.uid]);

  // Profiles are loaded when the account or partner changes, not on every focus.
  useEffect(() => {
    if (store.uid) {
      getUserProfile(store.uid).then(p => {
        if (p) {
          setMyProfile(p);
          store.setSelectedCosmetics(p.selectedBackground, p.selectedBorder, p.selectedTag);
        }
      });
      registerPushTokenForUser(store.uid).catch(() => {});
    }
    if (partner?.coupleId && store.uid) {
      const partnerId = partner.coupleId.replace(store.uid, '').replace('_', '');
      getUserProfile(partnerId).then(p => { if (p) setPartnerProfile(p); });
    }
  }, [store.uid, partner?.coupleId]);

  useEffect(() => {
    const currentUid = store.uid;
    if (!partner?.coupleId || !currentUid) return;
    const coupleId = partner.coupleId;
    const loadPartnerAnswers = async () => {
      const partnerId = coupleId.replace(currentUid, '').replace('_', '');
      const dailySnap = await getDocs(collection(db, 'couples', coupleId, 'daily'));
      const answeredCategories = new Set<string>();
      let hasPartnerAnsweredToday = false;
      let hasUserAnsweredToday = false;
      let todayQuestionText = '';
      let todayCategory = '';

      const d = new Date();
      const tKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      await Promise.all(dailySnap.docs.map(async (dailyDoc) => {
        const category = dailyDoc.data().category as string | undefined;
        const answerSnap = await getDocs(collection(db, 'couples', coupleId, 'daily', dailyDoc.id, 'answers'));
        const partnerAnswered = answerSnap.docs.some(answer => answer.id === partnerId);
        const myAnswered = answerSnap.docs.some(answer => answer.id === store.uid);

        if (category && category !== 'all') {
          if (partnerAnswered && !myAnswered) answeredCategories.add(category);
        }

        if (dailyDoc.id === tKey) {
          hasPartnerAnsweredToday = partnerAnswered;
          hasUserAnsweredToday = myAnswered;
          const qId = dailyDoc.data().questionId;
          if (qId) {
            const q = getById(qId);
            if (q) {
              todayQuestionText = q.text;
              todayCategory = q.category;
            }
          }
        }
      }));
      setPartnerAnsweredCategories(answeredCategories);

      if (!todayQuestionText) {
        const scheduledId = getScheduledQuestionId(tKey);
        if (scheduledId) {
          const q = getById(scheduledId);
          if (q) {
            todayQuestionText = q.text;
            todayCategory = q.category;
          }
        }
      }

      if (hasPartnerAnsweredToday) {
        const notifKey = `nousdeux_notified_ans_${tKey}`;
        AsyncStorage.getItem(notifKey).then((already) => {
          if (!already) {
            AsyncStorage.setItem(notifKey, '1');
            void triggerPartnerAnsweredNotification(partner?.pseudo || 'Ton amour');
          }
        }).catch(() => {});
      }

      const activeStreak = await computeStreakCached(coupleId, true).catch(() => wallet?.streak ?? 1);

      if (Platform.OS !== 'web') {
        void syncWidgetData({
          streak: typeof activeStreak === 'number' && activeStreak >= 0 ? activeStreak : (wallet?.streak ?? 1),
          todayQuestion: todayQuestionText || undefined,
          categoryName: todayCategory || undefined,
          userAnswered: hasUserAnsweredToday,
          partnerAnswered: hasPartnerAnsweredToday,
          bothAnswered: hasUserAnsweredToday && hasPartnerAnsweredToday,
          userPseudo: store.pseudo || 'Moi',
          partnerPseudo: partner?.pseudo || 'Mon Amour',
          userAvatar: store.avatar || null,
          partnerAvatar: partner?.avatarUrl || null,
          themeId: store.selectedWidget || 'widget_default',
        });
      }
    };
    const dailyQuery = collection(db, 'couples', coupleId, 'daily');
    const unsubscribeDaily = onSnapshot(dailyQuery, () => {
      invalidateStreakCache(coupleId);
      loadPartnerAnswers().catch(() => setPartnerAnsweredCategories(new Set()));
      computeStreakCached(coupleId, true).then((streak) => {
        setWallet((current: any) => current ? { ...current, streak } : current);
      }).catch(() => {});
    }, (error) => {
      if (error.code === 'permission-denied' || error.code === 'not-found') {
        // Couple subcollections can be unavailable briefly while the second
        // device finishes syncing. Keep the relationship and cached data.
        setWallet((current: any) => current ?? { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 });
      }
    });
    return () => {
      unsubscribeDaily();
    };
  }, [partner?.coupleId, store.uid]);

  // Notification de déblocage par série
  useEffect(() => {
    if (!wallet?.streak) return;
    const checkUnlocks = async () => {
      const lastSeenStr = await AsyncStorage.getItem('last_seen_streak');
      const lastSeen = lastSeenStr ? parseInt(lastSeenStr) : 0;
      if (wallet.streak > lastSeen) {
        // Trouver s'il y a un cosmétique pour cette série exacte
        const unlocked = COSMETICS.find(c => c.unlock.type === 'streak' && (c.unlock as any).days === wallet.streak);
        if (unlocked) {
          setUnlockedCosmetic(unlocked);
        }
        await AsyncStorage.setItem('last_seen_streak', wallet.streak.toString());
      }
    };
    checkUnlocks();
  }, [wallet?.streak]);

  useEffect(() => {
    if (partner?.coupleId) {
      checkStreakRestorable(partner.coupleId).then((res) => {
        if (res.canRestore) setStreakRestoreOffer(res);
        else setStreakRestoreOffer(null);
      }).catch(() => {});
    }
  }, [partner?.coupleId, wallet?.streak]);

  const handleRestoreStreak = async () => {
    if (!partner?.coupleId || !store.uid || restoringStreak) return;
    setRestoringStreak(true);
    try {
      const res = await restoreLostStreak(partner.coupleId, store.uid);
      if (res.success) {
        sound.success();
        triggerHaptic('success');
        useToastStore.getState().showToast(`Série restaurée avec succès ! 🔥 (${res.newStreak} jours)`);
        setStreakRestoreOffer(null);
        const updatedWallet = await getWallet(partner.coupleId);
        setWallet(updatedWallet);
        cacheWallet(partner.coupleId, updatedWallet);
      } else {
        sound.warning();
        triggerHaptic('warning');
        useToastStore.getState().showToast(res.error || 'Impossible de restaurer la série.');
      }
    } catch {
      useToastStore.getState().showToast('Erreur lors de la restauration.');
    } finally {
      setRestoringStreak(false);
    }
  };

  useEffect(() => {
    if (!partner?.coupleId) return;
    AsyncStorage.getItem(`wallet_${partner.coupleId}`).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setWallet((curr: any) => curr ?? parsed);
        } catch {}
      }
    }).catch(() => {});
  }, [partner?.coupleId]);

  // Ecoute du Wallet en temps réel + correction streak
  useEffect(() => {
    if (!partner?.coupleId) return;
    const coupleId = partner.coupleId;
    syncUnlimitedStats(coupleId).then((stats) => {
      setWallet((current: any) => current ? { ...current, unlimitedStats: stats } : current);
    }).catch(() => {});
    const walletRef = doc(db, `couples/${coupleId}/economy/wallet`);
    const unsub = onSnapshot(walletRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Mettre à jour immédiatement pour éviter tout blocage d'affichage
        setWallet((curr: any) => ({ ...(curr || {}), ...(data as any) }));
        const calculatedStreak = await computeStreakCached(coupleId);
        const nextWallet = { ...(data as any), streak: calculatedStreak };
        cacheWallet(coupleId, nextWallet);
        AsyncStorage.setItem(`wallet_${coupleId}`, JSON.stringify(nextWallet)).catch(() => {});
        setWallet(nextWallet);
        if (data.streak !== calculatedStreak) updateWalletStreak(coupleId).catch(console.error);
        if (Platform.OS !== 'web') {
          void syncWidgetData({ streak: calculatedStreak });
        }
      } else {
        const sharedWallet = await getWallet(coupleId);
        cacheWallet(coupleId, sharedWallet);
        AsyncStorage.setItem(`wallet_${coupleId}`, JSON.stringify(sharedWallet)).catch(() => {});
        setWallet(sharedWallet);
      }
    }, (error) => {
      if (error.code === 'permission-denied' || error.code === 'not-found') {
        setWallet((current: any) => current ?? { petals: 0, streak: 0, lastClaimDate: '', totalEarned: 0 });
      }
    });
    return () => unsub();
  }, [partner?.coupleId]);

  useEffect(() => {
    if (!partner?.coupleId) return;
    return onSnapshot(doc(db, `couples/${partner.coupleId}/quests/progress`), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setHasQuestRewards(Object.values(data).some((entry) => {
        const quest = entry as { unclaimedTiers?: string[] };
        return (quest.unclaimedTiers?.length ?? 0) > 0;
      }));
    }, () => setHasQuestRewards(false));
  }, [partner?.coupleId]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  
  const getDaysSince = (dateString?: string) => {
    if (!dateString) return '0';
    const diff = new Date().getTime() - new Date(dateString).getTime();
    return Math.floor(diff / (1000 * 3600 * 24)).toString();
  };
  
  const formattedDate = partner?.coupleDate
    ? new Date(partner.coupleDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date non définie';

  if (isLoading) {
    return (
      <ImageBackground source={backgroundSource} style={styles.container as any} resizeMode={backgroundResizeMode} imageStyle={{ objectPosition: windowWidth < 600 ? 'center bottom' : 'center' } as any}>
        <View style={[styles.safeArea, { overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }]}> 
          <ActivityIndicator color={theme.tint} size="large" />
          <Text style={{ color: theme.text, marginTop: 14 }}>Chargement du Dashboard...</Text>
        </View>
        
        {/* Streak Unlock Popup */}
      <Modal visible={unlockedItems.length > 0} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 10 }}>🎯</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 10 }}>Nouveauté Débloquée !</Text>
            <Text style={{ fontSize: 14, color: theme.tabIconDefault, textAlign: 'center', marginBottom: 20 }}>Ton streak de {wallet?.streak} jours t’a permis de débloquer :</Text>
            
            {unlockedItems.map(item => (
              <View key={item.id} style={{ alignItems: 'center', marginBottom: 15, padding: 10, backgroundColor: 'rgba(255,154,139,0.1)', borderRadius: 16, width: '100%' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FF6A88' }}>{item.emoji ? item.emoji + ' ' : ''}{item.name}</Text>
                <Text style={{ fontSize: 12, color: theme.tabIconDefault }}>{item.description}</Text>
              </View>
            ))}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, width: '100%' }}>
              <Pressable style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center' }} onPress={() => setUnlockedItems([])}>
                <Text style={{ color: theme.text, fontWeight: 'bold' }}>Fermer</Text>
              </Pressable>
              <Pressable style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#FF6A88', alignItems: 'center' }} onPress={() => { setUnlockedItems([]); router.push('/shop'); }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Voir boutique</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
  
      </ImageBackground>
    );
  }

  const renderAvatar = (avatarUrl: string | null | undefined, pseudo: string, isPartner: boolean, profile: UserProfile | null) => {
    const streak = wallet?.streak || 0;
    const isUnlocked = (c: any) => !c || c.unlock.type !== 'streak' || streak >= c.unlock.days;
    let cosmeticBg = profile?.selectedBackground ? getCosmeticById(profile.selectedBackground) : null;
    let cosmeticBorder = profile?.selectedBorder ? getCosmeticById(profile.selectedBorder) : null;
    if (!isUnlocked(cosmeticBg)) cosmeticBg = null;
    if (!isUnlocked(cosmeticBorder)) cosmeticBorder = null;


    const fallbackBorderColor = cosmeticBorder && !cosmeticBorder.image 
      ? parseGradientColors(cosmeticBorder.preview || 'none')[0] 
      : 'white';

    const baseStyle = isPartner ? styles.partnerAvatar : styles.userAvatar;
    const avatarWidth = isPartner ? 28 : 70;
    
    // Si c'est une bordure image, pas de bordure CSS
    const borderStyle: any = cosmeticBorder?.image 
      ? { borderWidth: 0 } 
      : { borderWidth: 3, borderColor: fallbackBorderColor, borderStyle: 'solid' };

    const borderImageSize = avatarWidth * 1.35;
    const borderOffset = - (borderImageSize - avatarWidth) / 2;

    const innerAvatar = avatarUrl ? (
      <Image source={{ uri: avatarUrl }} style={[baseStyle, { zIndex: 1, position: 'relative' }, borderStyle]} />
    ) : (
      <View style={[baseStyle, { backgroundColor: isPartner ? theme.gradientEnd : theme.tint, justifyContent: 'center', alignItems: 'center', zIndex: 1, position: 'relative' }, borderStyle]}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: isPartner ? 12 : 24 }}>{pseudo.charAt(0) || (isPartner ? 'P' : 'M')}</Text>
      </View>
    );

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ position: 'relative', marginRight: isPartner ? 12 : 4 }}>
          
          {/* L'avatar de base (photo, PixelAvatar ou initiale) */}
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={[baseStyle, { zIndex: 1, position: 'relative' }, borderStyle]} />
          ) : profile?.avatar ? (
             <View style={[baseStyle, borderStyle, { overflow: 'hidden', position: 'relative', zIndex: 1, backgroundColor: isPartner ? '#FF9A8B' : '#FF6A88', justifyContent: 'center', alignItems: 'center' }]}>
               <PixelAvatar config={profile.avatar} size={avatarWidth} showShadow={false} />
             </View>
          ) : innerAvatar}

          {/* Bordure image superposée */}
          {cosmeticBorder?.image && (
            <View pointerEvents="none" style={{ position: 'absolute', top: borderOffset, left: borderOffset, width: borderImageSize, height: borderImageSize, zIndex: 2 }}>
              <Image 
                source={cosmeticBorder.image} 
                style={{ width: '100%', height: '100%' }} 
              />
            </View>
          )}
        </View>
      </View>
    );
  };



  return (
    <ImageBackground source={backgroundSource} style={styles.container} resizeMode={backgroundResizeMode} imageStyle={{ objectPosition: windowWidth < 600 ? 'center bottom' : 'center' } as any}>
      <AppLaunchAd />
      <View style={[styles.safeArea, { overflow: 'visible', backgroundColor: 'transparent', paddingTop: topInset }]}> 
        <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>{/* NOUVEAU HEADER : LinearGradient Mon Profil + Wallet */}
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.headerBanner}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* Mon Profil */}
            <Pressable
              style={[styles.partnerBadge, { flex: 1, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, padding: 0 }]}
              onPress={() => setShowMyProfile(true)}
            >
              {renderAvatar(store.avatar, store.pseudo || 'Moi', false, myProfile)}
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }} numberOfLines={1}>{store.pseudo}</Text>
                {myProfile?.selectedTag && myProfile.selectedTag !== 'tag_free_0' && getCosmeticById(myProfile.selectedTag) && (
                  <View style={{ marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255, 255, 255, 0.22)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)' }}>
                    <Text style={{ fontSize: 12, color: 'white', fontWeight: '800' }} numberOfLines={1}>
                      {getCosmeticById(myProfile.selectedTag)?.emoji} {getCosmeticById(myProfile.selectedTag)?.name}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>

            {/* Wallet */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 20 }}>
              <CoinWallet petals={wallet?.petals ?? 0} size="small" theme="white" />
            </View>
          </View>
        </LinearGradient>

        {/* --- WIDGETS RESPONSIVE --- */}
        {windowWidth < 600 ? (
          /* =========================================================================
             MOBILE LAYOUT (< 600px):
             Ligne 1: En couple / Mon compte (flex: 1) + Réglages (width: 76)
             Ligne 2: Roulette (flex: 1) + Mini-calendrier (flex: 1.2) côte à côte
             ========================================================================= */
          <>
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 10, alignItems: 'stretch' }}>
              {/* BLOC 1: EN COUPLE AVEC / MODE SOLO */}
              <Pressable 
                style={{ flex: 1, backgroundColor: theme.glassBackground, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
                onPress={() => {
                  triggerHaptic('light');
                  if (partner && !partnerLeft) {
                    setShowPartnerProfile(true);
                  } else {
                    router.push('/onboarding/sync');
                  }
                }}
              >
                {partner && !partnerLeft
                  ? renderAvatar(partner.avatarUrl, partner.pseudo, true, partnerProfile)
                  : <View style={[styles.partnerAvatar, { backgroundColor: 'rgba(120,110,110,0.35)', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: theme.tabIconDefault, fontSize: 18 }}>–</Text></View>}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ color: partner && !partnerLeft ? theme.text : theme.tabIconDefault, fontSize: 13, fontWeight: '600' }}>{partner && !partnerLeft ? 'En couple avec' : 'Mode solo'}</Text>
                  <Text style={{ color: partner && !partnerLeft ? '#FF6A88' : theme.tabIconDefault, fontSize: 16, fontWeight: 'bold' }} numberOfLines={1}>{partner && !partnerLeft ? partner.pseudo : 'Partenaire indisponible'}</Text>
                  {(!partner || partnerLeft) && (
                    <View style={{ marginTop: 5 }}>
                      {store.myCode ? (
                        <Pressable
                          onPress={async () => {
                            triggerHaptic('selection');
                            await Clipboard.setStringAsync(store.myCode);
                            useToastStore.getState().showToast('Code copié !');
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                        >
                          <Text style={{ color: theme.text, fontSize: 11, fontWeight: '600' }}>
                            Mon code : <Text style={{ color: theme.tint, fontWeight: '800', letterSpacing: 1 }}>{store.myCode}</Text>
                          </Text>
                          <Copy size={12} color={theme.tint} style={{ marginLeft: 4 }} />
                        </Pressable>
                      ) : null}
                      <Pressable 
                        onPress={() => {
                          triggerHaptic('light');
                          router.push('/onboarding/sync');
                        }} 
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{
                          marginTop: 4,
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          backgroundColor: 'rgba(255, 106, 136, 0.15)',
                          alignSelf: 'flex-start',
                        }}
                      >
                        <Text style={{ color: theme.tint, fontSize: 12, fontWeight: '800' }}>
                          {store.myCode ? 'Lier un partenaire ➔' : 'Obtenir / entrer un code ➔'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                  {partner && !partnerLeft && partnerProfile?.selectedTag && partnerProfile.selectedTag !== 'tag_free_0' && getCosmeticById(partnerProfile.selectedTag) && (
                    <View style={{ marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255, 106, 136, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 106, 136, 0.3)' }}>
                      <Text style={{ fontSize: 13, color: '#FF6A88', fontWeight: '800' }} numberOfLines={1}>
                        {getCosmeticById(partnerProfile.selectedTag)?.emoji} {getCosmeticById(partnerProfile.selectedTag)?.name}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>

              {/* REGLAGES */}
              <Pressable 
                accessibilityLabel="Réglages"
                style={{ width: 60, backgroundColor: theme.glassBackground, borderRadius: 20, padding: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
                onPress={() => {
                  sound.tap();
                  triggerHaptic('light');
                  router.push('/settings');
                }}
              >
                <Settings color="#FF6A88" size={28} />
              </Pressable>
            </View>

            {/* LIGNE 2 MOBILE: ROULETTE + MINI-CALENDRIER CÔTE À CÔTE */}
            {partner?.coupleId && store.uid && (
              <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 10, height: 116, alignItems: 'stretch' }}>
                <Animated.View entering={FadeInUp.delay(50).duration(400)} style={{ flex: 1, height: 116 }}>
                  <DailyClaim 
                    compact={true}
                    coupleId={partner.coupleId} 
                    myUid={store.uid} 
                    wallet={wallet}
                    onClaimed={(newW) => {
                      sound.reward();
                      triggerHaptic('success');
                      cacheWallet(partner.coupleId!, newW);
                      setWallet(newW);
                    }} 
                  />
                </Animated.View>
                <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ flex: 1.2, height: 116 }}>
                  <Link href="/calendar" asChild>
                    <Pressable 
                      style={{ width: '100%', height: 116 }}
                      onPress={() => {
                        sound.tap();
                        triggerHaptic('light');
                      }}
                    >
                      <StreakCalendar 
                        coupleId={partner.coupleId} 
                        compact={true} 
                        fullWidth={false} 
                        currentStreak={wallet?.streak} 
                        darkMode={store.isDarkMode} 
                      />
                    </Pressable>
                  </Link>
                </Animated.View>
              </View>
            )}
          </>
        ) : (
          /* =========================================================================
             TABLET / DESKTOP LAYOUT (>= 600px):
             Ligne 1: En couple (flex: 2) + Roulette (flex: 1.2) + Réglages (flex: 0.9)
             Ligne 2: StreakCalendar pleine largeur (fullWidth: true)
             ========================================================================= */
          <>
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, gap: 10, alignItems: 'stretch' }}>
              {/* BLOC 1: EN COUPLE AVEC / MODE SOLO */}
              <Pressable 
                style={{ flex: partner?.coupleId ? 2 : 2.5, backgroundColor: theme.glassBackground, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
                onPress={() => {
                  triggerHaptic('light');
                  if (partner && !partnerLeft) {
                    setShowPartnerProfile(true);
                  } else {
                    router.push('/onboarding/sync');
                  }
                }}
              >
                {partner && !partnerLeft
                  ? renderAvatar(partner.avatarUrl, partner.pseudo, true, partnerProfile)
                  : <View style={[styles.partnerAvatar, { backgroundColor: 'rgba(120,110,110,0.35)', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: theme.tabIconDefault, fontSize: 18 }}>–</Text></View>}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ color: partner && !partnerLeft ? theme.text : theme.tabIconDefault, fontSize: 13, fontWeight: '600' }}>{partner && !partnerLeft ? 'En couple avec' : 'Mode solo'}</Text>
                  <Text style={{ color: partner && !partnerLeft ? '#FF6A88' : theme.tabIconDefault, fontSize: 16, fontWeight: 'bold' }} numberOfLines={1}>{partner && !partnerLeft ? partner.pseudo : 'Partenaire indisponible'}</Text>
                  {(!partner || partnerLeft) && (
                    <View style={{ marginTop: 5 }}>
                      {store.myCode ? (
                        <Pressable
                          onPress={async () => {
                            triggerHaptic('selection');
                            await Clipboard.setStringAsync(store.myCode);
                            useToastStore.getState().showToast('Code copié !');
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                        >
                          <Text style={{ color: theme.text, fontSize: 11, fontWeight: '600' }}>
                            Mon code : <Text style={{ color: theme.tint, fontWeight: '800', letterSpacing: 1 }}>{store.myCode}</Text>
                          </Text>
                          <Copy size={12} color={theme.tint} style={{ marginLeft: 4 }} />
                        </Pressable>
                      ) : null}
                      <Pressable 
                        onPress={() => {
                          triggerHaptic('light');
                          router.push('/onboarding/sync');
                        }} 
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{
                          marginTop: 4,
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          backgroundColor: 'rgba(255, 106, 136, 0.15)',
                          alignSelf: 'flex-start',
                        }}
                      >
                        <Text style={{ color: theme.tint, fontSize: 12, fontWeight: '800' }}>
                          {store.myCode ? 'Lier un partenaire ➔' : 'Obtenir / entrer un code ➔'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                  {partner && !partnerLeft && partnerProfile?.selectedTag && partnerProfile.selectedTag !== 'tag_free_0' && getCosmeticById(partnerProfile.selectedTag) && (
                    <View style={{ marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255, 106, 136, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 106, 136, 0.3)' }}>
                      <Text style={{ fontSize: 13, color: '#FF6A88', fontWeight: '800' }} numberOfLines={1}>
                        {getCosmeticById(partnerProfile.selectedTag)?.emoji} {getCosmeticById(partnerProfile.selectedTag)?.name}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>

              {/* BLOC 2: LA ROULETTE (à la suite de la case en couple, à gauche de réglages) */}
              {partner?.coupleId && store.uid && (
                <Animated.View entering={FadeInUp.delay(50).duration(400)} style={{ flex: 1.2 }}>
                  <DailyClaim 
                    compact={true}
                    coupleId={partner.coupleId} 
                    myUid={store.uid} 
                    wallet={wallet}
                    onClaimed={(newW) => {
                      triggerHaptic('success');
                      cacheWallet(partner.coupleId!, newW);
                      setWallet(newW);
                    }} 
                  />
                </Animated.View>
              )}

              {/* BLOC 3: REGLAGES */}
              <Pressable 
                accessibilityLabel="Réglages"
                style={{ width: 64, backgroundColor: theme.glassBackground, borderRadius: 20, padding: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
                onPress={() => {
                  sound.tap();
                  triggerHaptic('light');
                  router.push('/settings');
                }}
              >
                <Settings color="#FF6A88" size={28} />
              </Pressable>
            </View>

            {/* --- LIGNE CALENDRIER PLEINE LONGUEUR --- */}
            {partner?.coupleId && (
              <Animated.View entering={FadeInUp.delay(100).duration(400)} style={{ marginHorizontal: 16, marginBottom: 16 }}>
                <Link href="/calendar" asChild>
                  <Pressable 
                    style={{ width: '100%' }}
                    onPress={() => triggerHaptic('light')}
                  >
                    <StreakCalendar 
                      coupleId={partner.coupleId} 
                      compact={true} 
                      fullWidth={true} 
                      currentStreak={wallet?.streak} 
                      darkMode={store.isDarkMode} 
                    />
                  </Pressable>
                </Link>
              </Animated.View>
            )}
          </>
        )}

        {/* BANNIÈRE DE RESTAURATION DE SÉRIE */}
        {streakRestoreOffer?.canRestore && (
          <Animated.View entering={FadeInUp.duration(400)} style={{ marginHorizontal: 16, marginBottom: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#FF9A8B' }}>
            <LinearGradient
              colors={store.isDarkMode ? ['#362222', '#261919'] : ['#FFF2EE', '#FFE5DC']}
              style={{ padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#FF6B35' }}>
                  🔥 Série brisée hier ({streakRestoreOffer.lostStreak} jour{streakRestoreOffer.lostStreak > 1 ? 's' : ''})
                </Text>
                <Text style={{ fontSize: 12, color: store.isDarkMode ? '#E0D0CE' : '#6B5B59', marginTop: 2 }}>
                  Restaure ta flamme pour 2 000 🌸 et garde votre série intacte !
                </Text>
              </View>
              <Pressable
                onPress={handleRestoreStreak}
                disabled={restoringStreak}
                style={{
                  backgroundColor: '#FF6A88',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  opacity: restoringStreak ? 0.7 : 1,
                  shadowColor: '#FF6A88',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>
                  {restoringStreak ? 'Restauration...' : 'Restaurer (2 000 🌸)'}
                </Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Main Grid */}
        <View style={styles.grid}>
          {/* Quêtes & Boutique (Haut) */}
          <View style={styles.row}>
            <Animated.View entering={FadeInUp.delay(120).duration(400)} style={styles.halfCardWrapper}>
              <Link href="/quests" style={[styles.smallCard, { backgroundColor: store.isDarkMode ? 'rgba(28,18,5,0.88)' : 'rgba(255,247,237,0.85)', borderColor: 'rgba(234,179,8,0.3)' }]}>
                <Trophy color="#B45309" size={28} />
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.smallCardTitle, { color: theme.text }]}>Quêtes</Text>
                    {hasQuestRewards && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444' }} />}
                  </View>
                  <Text style={{ fontSize: 12, color: '#B45309', fontWeight: 'bold' }}>Récompenses</Text>
                </View>
              </Link>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(140).duration(400)} style={styles.halfCardWrapper}>
              <Link href="/shop" style={[styles.smallCard, { backgroundColor: store.isDarkMode ? 'rgba(28,10,20,0.88)' : 'rgba(253,242,248,0.85)', borderColor: 'rgba(236,72,153,0.3)' }]}>
                <Star color="#BE185D" size={28} />
                <View>
                  <Text style={[styles.smallCardTitle, { color: theme.text }]}>Boutique</Text>
                  <Text style={{ fontSize: 12, color: '#BE185D', fontWeight: 'bold' }}>Cosmétiques</Text>
                </View>
              </Link>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInUp.delay(150).duration(400)}>
            <Link 
              href="/daylink" 
              style={[styles.mainCard, { backgroundColor: store.isDarkMode ? 'rgba(5,22,20,0.88)' : 'rgba(240,253,250,0.85)', borderColor: 'rgba(20,184,166,0.3)' }]}
              onPress={() => sound.tap()}
            >
              <Animated.View style={[styles.iconWrapper, { backgroundColor: theme.tint }, pulseStyle]}>
                <CalendarHeart color="white" size={32} />
              </Animated.View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Question du Jour</Text>
              <Text style={[styles.cardDesc, { color: theme.text }]}>La même pour vous deux chaque jour !</Text>
            </Link>
          </Animated.View>

          {/* Questions Illimitées */}
          <Animated.View entering={FadeInUp.delay(220).duration(400)}>
            <Pressable 
              style={[styles.mainCard, { backgroundColor: store.isDarkMode ? 'rgba(20,8,30,0.88)' : 'rgba(250,245,255,0.85)', borderColor: 'rgba(168,85,247,0.3)' }]}
              onPress={() => {
                sound.tap();
                router.push('/unlimited' as any);
              }}
            >
              <View style={[styles.iconWrapper, { backgroundColor: '#A855F7' }]}>
                <InfinityIcon color="white" size={32} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Questions Illimitées</Text>
              <Text style={[styles.cardDesc, { color: theme.text }]}>Répondez à autant de questions que vous voulez 💬</Text>
            </Pressable>
          </Animated.View>

          {/* Titre Thèmes */}
          <Animated.View entering={FadeInUp.delay(290).duration(400)} style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thèmes Spécifiques</Text>
          </Animated.View>

          <View style={styles.categoryGrid}>
            {[
              { id: 'amour', title: 'Amour', icon: <Heart color="#EF4444" size={24} />, bg: 'rgba(254,242,242,0.95)', bgDark: 'rgba(50,20,20,0.92)', border: 'rgba(239,68,68,0.7)', requires: null, rarity: 'Commun' },
              { id: 'fun', title: 'Fun', icon: <Smile color="#F59E0B" size={24} />, bg: 'rgba(254,243,199,0.95)', bgDark: 'rgba(50,38,15,0.92)', border: 'rgba(245,158,11,0.7)', requires: 'fun', rarity: 'Commun' },
              { id: 'profond', title: 'Profond', icon: <Brain color="#3B82F6" size={24} />, bg: 'rgba(239,246,255,0.95)', bgDark: 'rgba(20,30,55,0.92)', border: 'rgba(59,130,246,0.7)', requires: 'profond', rarity: 'Commun' },
              { id: 'intime', title: 'Intime', icon: <Flame color="#BE185D" size={24} />, bg: 'rgba(253,242,248,0.95)', bgDark: 'rgba(50,15,35,0.92)', border: 'rgba(236,72,153,0.7)', requires: 'intime', rarity: 'Rare' },
              { id: 'pile_ou_face', title: 'Tu préfères', icon: <Split color="#0EA5E9" size={24} />, bg: 'rgba(240,249,255,0.95)', bgDark: 'rgba(15,35,50,0.92)', border: 'rgba(14,165,233,0.7)', requires: 'pile_ou_face', rarity: 'Rare' },
              { id: 'famille', title: 'Famille', icon: <Home color="#10B981" size={24} />, bg: 'rgba(236,253,245,0.95)', bgDark: 'rgba(15,45,30,0.92)', border: 'rgba(16,185,129,0.7)', requires: 'famille', rarity: 'Rare' },
              { id: 'debat', title: 'Débat', icon: <MessageCircle color="#8B5CF6" size={24} />, bg: 'rgba(245,243,255,0.95)', bgDark: 'rgba(35,20,55,0.92)', border: 'rgba(139,92,246,0.7)', requires: 'debat', rarity: 'Rare' },
              { id: 'futur', title: 'Futur', icon: <Rocket color="#6366F1" size={24} />, bg: 'rgba(238,242,255,0.95)', bgDark: 'rgba(25,25,60,0.92)', border: 'rgba(99,102,241,0.7)', requires: 'futur', rarity: 'Épique' },
              { id: 'souvenir', title: 'Souvenir', icon: <Camera color="#14B8A6" size={24} />, bg: 'rgba(240,253,250,0.95)', bgDark: 'rgba(15,45,45,0.92)', border: 'rgba(20,184,166,0.7)', requires: 'souvenir', rarity: 'Épique' },
              { id: 'reve', title: 'Rêve', icon: <Star color="#F59E0B" size={24} />, bg: 'rgba(254,252,232,0.95)', bgDark: 'rgba(50,45,15,0.92)', border: 'rgba(252,211,77,0.8)', requires: 'reve', rarity: 'Légendaire' },
              { id: 'quotidien', title: 'Quotidien', icon: <Coffee color="#78716C" size={24} />, bg: 'rgba(245,245,244,0.95)', bgDark: 'rgba(40,38,36,0.92)', border: 'rgba(168,162,158,0.7)', requires: 'quotidien', rarity: 'Légendaire' },
              { id: 'defi', title: 'Défi', icon: <Trophy color="#F97316" size={24} />, bg: 'rgba(255,247,237,0.95)', bgDark: 'rgba(55,25,10,0.92)', border: 'rgba(249,115,22,0.7)', requires: 'defi', rarity: 'Légendaire' },
            ].map((cat, index) => {
              // Vérifier si le thème a atteint 10 questions en mode illimité
              const count = (wallet as any)?.unlimitedStats?.[cat.id] || 0;
              const isLocked = cat.requires !== null && count < 10;
              const cardBg = store.isDarkMode ? cat.bgDark : cat.bg;
              
              return (
                <Animated.View key={cat.id} entering={FadeInUp.delay(300 + index * 25).duration(350)} style={styles.categoryCardWrapper}>
                  {isLocked ? (
                    <Pressable 
                      style={[styles.categoryCard, { backgroundColor: store.isDarkMode ? 'rgba(38,28,27,0.95)' : 'rgba(245,245,247,0.95)', borderColor: store.isDarkMode ? 'rgba(80,60,58,0.8)' : '#D1D5DB' }]}
                      onPress={() => {
                        sound.tap();
                        setAlertMessage(
                          `Le thème "${cat.title}" est verrouillé. Répondez ensemble à 10 questions de ce thème en mode Illimité pour le débloquer ! (${count}/10)`,
                        );
                      }}
                    >
                      <View style={{ opacity: 0.65, alignItems: 'center' }}>
                        {cat.icon}
                        <Text style={styles.categoryCardTitle}>{cat.title}</Text>
                      </View>
                      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: store.isDarkMode ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.7)', borderRadius: 20 }}>
                        <Lock color={store.isDarkMode ? '#A89997' : '#6B7280'} size={24} />
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: store.isDarkMode ? '#A89997' : '#4B5563', marginTop: 4 }}>
                          {count}/10
                        </Text>
                      </View>
                    </Pressable>
                  ) : (
                    <Link 
                      href={`/unlimited?category=${cat.id}`} 
                      style={[styles.categoryCard, { backgroundColor: cardBg, borderColor: cat.border }]}
                      onPress={() => sound.tap()}
                    >
                      {cat.icon}
                      {partnerAnsweredCategories.has(cat.id) && <View style={styles.partnerAnswerDot} />}
                      <Text style={styles.categoryCardTitle}>{cat.title}</Text>
                    </Link>
                  )}
                </Animated.View>
              );
            })}
          </View>
        </View>
        <GoogleAdBanner />
        </ScrollView>

      {/* â”€â”€ Modal Mon Profil â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal visible={showMyProfile} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMyProfile(false)}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.modalContent}>
            <Pressable style={styles.closeBtn} onPress={() => setShowMyProfile(false)}>
              <X color={theme.tabIconDefault} size={24} />
            </Pressable>

            <View style={{ alignItems: 'center', marginBottom: 20, transform: [{ scale: 1.5 }], marginTop: 10 }}>
              {renderAvatar(store.avatar, store.pseudo || 'Moi', false, myProfile)}
            </View>

            <Text style={styles.modalPseudo}>{store.pseudo}</Text>
            <Text style={styles.modalAge}>{store.age} ans</Text>

            {partner && (
              <View style={styles.modalPartnerBox}>
                <HeartHandshake color={theme.gradientEnd} size={30} style={{ alignSelf: 'center', marginBottom: 10 }} />
                <Text style={styles.modalPartnerText}>En couple avec <Text style={{ fontWeight: 'bold' }}>{partner.pseudo}</Text></Text>
                <Text style={styles.modalDateText}>Depuis le {formattedDate}</Text>
              </View>
            )}
          </Animated.View>
        </Pressable>
      </Modal>

      {/* â”€â”€ Modal Profil Partenaire â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal visible={showPartnerProfile} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowPartnerProfile(false)}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.modalContent}>
            <Pressable style={styles.closeBtn} onPress={() => setShowPartnerProfile(false)}>
              <X color={theme.tabIconDefault} size={24} />
            </Pressable>

            {partner && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 20, transform: [{ scale: 1.5 }], marginTop: 10 }}>
                  {renderAvatar(partner.avatarUrl, partner.pseudo || 'P', false, partnerProfile)}
                </View>

                <Text style={styles.modalPseudo}>{partner.pseudo}</Text>
                {partnerProfile?.selectedTag && partnerProfile.selectedTag !== 'tag_free_0' && getCosmeticById(partnerProfile.selectedTag) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,106,136,0.1)', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 10 }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>{getCosmeticById(partnerProfile.selectedTag)?.emoji}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF6A88' }}>{getCosmeticById(partnerProfile.selectedTag)?.name}</Text>
                  </View>
                )}
                {partner.age && <Text style={styles.modalAge}>{partner.age} ans</Text>}

                <View style={styles.modalPartnerBox}>
                  <HeartHandshake color={theme.tint} size={30} style={{ alignSelf: 'center', marginBottom: 10 }} />
                  <Text style={styles.modalPartnerText}>Ensemble depuis le</Text>
                  <Text style={[styles.modalDateText, { fontSize: 16, fontWeight: '700', color: theme.tint, marginTop: 4 }]}>
                    {formattedDate} {'\u2764\uFE0F'}
                  </Text>
                </View>
              </>
            )}
          </Animated.View>
        </Pressable>
      </Modal>
      {/* Modal d'Alerte Custom */}
      <Modal visible={!!alertMessage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 320 }]}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 15 }}>
              Oops !
            </Text>
            <Text style={{ fontSize: 15, color: theme.text, textAlign: 'center', marginBottom: 20 }}>
              {alertMessage}
            </Text>
            <Pressable 
              style={{ backgroundColor: '#FF6A88', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, alignSelf: 'center' }} 
              onPress={() => setAlertMessage(null)}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>J’ai compris</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal de nouveau cosmétique de série */}
      <Modal visible={!!unlockedCosmetic} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 320, alignItems: 'center' }]}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text, textAlign: 'center', marginBottom: 10 }}>Nouveau Cosmétique !</Text>
            <Text style={{ fontSize: 16, color: theme.text, opacity: 0.8, textAlign: 'center', marginBottom: 20 }}>Ta série de {wallet?.streak} jours a débloqué :</Text>
            
            <View style={{ width: 120, height: 120, borderRadius: 24, overflow: 'hidden', marginBottom: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.tint }}>
              {unlockedCosmetic?.type === 'background' ? (
                 unlockedCosmetic.image ? <ImageBackground source={unlockedCosmetic.image} style={{ width: '100%', height: '100%' }} /> : <LinearGradient colors={parseGradientColors(unlockedCosmetic.preview) as [string, string]} style={{ width: '100%', height: '100%' }} />
              ) : unlockedCosmetic?.type === 'border' ? (
                 unlockedCosmetic.image ? <Image source={unlockedCosmetic.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <View style={{ width: '70%', height: '70%', borderWidth: 3, borderRadius: 18, borderStyle: 'solid', borderColor: parseGradientColors(unlockedCosmetic.preview)[0] || theme.tint }} />
              ) : (
                 <View style={{ width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                   <Text style={{ fontSize: 30 }}>{unlockedCosmetic?.emoji}</Text>
                   <Text style={{ fontSize: 12, color: theme.text, marginTop: 5 }}>{unlockedCosmetic?.name}</Text>
                 </View>
              )}
            </View>

            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.tint, marginBottom: 25 }}>{unlockedCosmetic?.name}</Text>

            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <Pressable onPress={() => setUnlockedCosmetic(null)} style={{ flex: 1, paddingVertical: 14, backgroundColor: theme.glassBackground, borderRadius: 20, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: 'bold' }}>Fermer</Text>
              </Pressable>
              <Pressable onPress={() => { setUnlockedCosmetic(null); router.push('/shop' as any); }} style={{ flex: 1, paddingVertical: 14, backgroundColor: theme.tint, borderRadius: 20, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Voir Boutique</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      </View>
    </ImageBackground>
  );
}

const getStyles = (theme: any, windowWidth: number = 400) => StyleSheet.create({
  headerBanner: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20, borderRadius: 30, marginBottom: 20 },
  container: { flex: 1, width: '100%', height: '100%', minHeight: Platform.OS === 'web' ? 700 : 0, overflow: 'hidden', backgroundColor: 'transparent' },
  safeArea: { flex: 1, width: '100%', maxWidth: windowWidth >= 640 ? 720 : 500, alignSelf: 'center' },
  scrollContent: { padding: 20, paddingTop: Platform.OS === 'web' ? 20 : 10, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  userAvatar: { width: 70, height: 70, borderRadius: 4, borderWidth: 3, borderColor: 'white', overflow: 'hidden' },
  welcome: { fontSize: 28, fontWeight: '900', marginBottom: 6 },
  streak: { fontSize: 16, fontWeight: 'bold' },
  partnerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.glassBackground, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  partnerAvatar: { width: 28, height: 28, borderRadius: 4, marginRight: 8, overflow: 'hidden' },
  partnerText: { fontSize: 14, fontWeight: '700', color: theme.text },
  grid: { flex: 1, gap: 20 },
  mainCard: { padding: 24, borderRadius: 24, borderWidth: 1, alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  iconWrapper: { padding: 20, borderRadius: 24, marginBottom: 16, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  cardDesc: { fontSize: 16, opacity: 0.7 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  halfCardWrapper: { flex: 1 },
  smallCard: { flexDirection: 'row', padding: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 12, minHeight: 80, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  smallCardTitle: { fontSize: 16, fontWeight: 'bold' },
  lockText: { fontSize: 13, fontWeight: 'bold', opacity: 0.8 },
  
  sectionHeader: { 
    marginTop: 16, 
    marginBottom: 14, 
    alignSelf: 'flex-start',
    backgroundColor: theme.glassBackground,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: 0.3 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  categoryCardWrapper: { width: windowWidth >= 640 ? '31.5%' : '48%', marginBottom: 12 },
  categoryCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1.5, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  categoryCardTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  partnerAnswerDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#16A34A', borderWidth: 3, borderColor: '#FFFFFF', position: 'absolute', top: 5, right: 5, shadowColor: '#16A34A', shadowOpacity: 0.55, shadowRadius: 5, elevation: 5 },
  settingsButton: { padding: 10 },
  // Modaux
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: theme.card, padding: 30, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, position: 'relative' },
  closeBtn: { position: 'absolute', top: 10, right: 10, padding: 15, zIndex: 10 },
  modalAvatar: { width: 120, height: 120, borderRadius: 28, borderWidth: 4, borderColor: 'white', overflow: 'hidden' },
  modalPseudo: { fontSize: 28, fontWeight: '900', color: theme.text, textAlign: 'center', marginBottom: 5 },
  modalAge: {
    fontSize: 16,
    color: theme.tabIconDefault,
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: 'bold',
  },
  modalPartnerBox: {
    backgroundColor: theme.glassBackground,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  modalPartnerText: {
    fontSize: 18,
    color: theme.text,
    textAlign: 'center',
    marginBottom: 5,
  },
  modalDateText: {
    fontSize: 14,
    color: theme.tabIconDefault,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
