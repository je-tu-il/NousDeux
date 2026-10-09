import { getCosmeticById, getCosmeticImage, parseGradientColors } from '@/data/cosmetics';
import { auth, db } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import { doc, getDoc } from 'firebase/firestore';
import { ensureUserPairingCode } from '@/lib/pairing';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import FloatingToast from '@/components/FloatingToast';
import ForceUpdateModal from '@/components/ForceUpdateModal';
import { useEffect, useState } from 'react';
import { ImageBackground, LogBox, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('M_ID')) return;
  originalError(...args);
};

LogBox.ignoreLogs(['M_ID']);

export default function RootLayout() {
  const { width: windowWidth } = useWindowDimensions();
  const [FloatingChat, setFloatingChat] = useState<React.ComponentType | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(auth?.currentUser ?? null);
  const segments = useSegments();
  const router = useRouter();
  const uid = useOnboardingStore((state) => state.uid);
  const pseudo = useOnboardingStore((state) => state.pseudo);
  const age = useOnboardingStore((state) => state.age);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'fr';
      document.documentElement.setAttribute('xml:lang', 'fr');
      document.documentElement.setAttribute('translate', 'no');
      document.documentElement.classList.add('notranslate');
      document.body?.setAttribute('translate', 'no');
      document.body?.classList.add('notranslate');
      if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
        const meta = document.createElement('meta');
        meta.name = 'google';
        meta.content = 'notranslate';
        document.head.appendChild(meta);
      }
    }
  }, []);

  useEffect(() => {
    const clearDeletedSession = async () => {
      if (Platform.OS !== 'web') {
        try {
          const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
          await GoogleSignin.signOut().catch(() => {});
        } catch {}
      }
      if (auth?.signOut) await auth.signOut().catch(() => {});
      useOnboardingStore.getState().resetSession();
      router.replace('/onboarding/login');
    };

    const authFallbackTimer = setTimeout(() => {
      setAuthReady(true);
    }, 1500);

    if (!auth?.onAuthStateChanged) {
      setAuthReady(true);
      return () => clearTimeout(authFallbackTimer);
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
      if (user) {
        const store = useOnboardingStore.getState();
        if (store.uid !== user.uid) store.setUid(user.uid);
      }
      const syncAuthState = async () => {
        try {
          if (user) {
            // Firebase Auth is the source of truth after a refresh/reconnection.
            // The persisted Zustand UID can be empty or stale while Auth is restoring.
            const store = useOnboardingStore.getState();
            if (store.uid && store.uid !== user.uid) {
              store.resetSession();
            }
            if (store.uid !== user.uid) store.setUid(user.uid);
            try {
              await user.reload();
            } catch (error: any) {
              if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-user-token') {
                void clearDeletedSession();
                return;
              }
            }
            // Synchroniser le profil Firestore pour éviter de forcer l'onboarding sur un nouveau navigateur
            try {
              const userSnap = await getDoc(doc(db, 'users', user.uid));
              if (userSnap.exists()) {
                const uData = userSnap.data();
                if (uData.pseudo && store.pseudo !== uData.pseudo) store.setPseudo(uData.pseudo);
                if (uData.age && store.age !== uData.age) store.setAge(uData.age);
                const avatarToSet = uData.avatarUrl || uData.avatar || null;
                if (store.avatar !== avatarToSet) store.setAvatar(avatarToSet);
                if (uData.pairingCode && store.myCode !== uData.pairingCode) store.setMyCode(uData.pairingCode);
                const isLinked = Boolean(uData.linkedTo);
                store.setSynced(isLinked);
                if (!isLinked) {
                  store.clearPartnerCache();
                } else if (store.partnerUid && store.partnerUid !== uData.linkedTo) {
                  store.clearPartnerCache();
                }
              } else {
                // Le compte Firestore n'existe pas encore ou a été supprimé
                // Nettoyer les données locales de session pour éviter la persistance fantôme
                store.setPseudo('');
                store.setAge('');
                store.setAvatar(null);
                store.setSynced(false);
                store.clearPartnerCache();
                const code = await ensureUserPairingCode(user.uid, store.myCode);
                if (store.myCode !== code) store.setMyCode(code);
              }
              try {
                const { getUserProfile } = await import('@/lib/economy');
                const p = await getUserProfile(user.uid);
                if (p) {
                  if (p.selectedBackground) store.setSelectedCosmetics(p.selectedBackground, p.selectedBorder, p.selectedTag);
                  if (p.avatar) store.setAvatarConfig(p.avatar);
                }
              } catch (errProfile) {
                console.error('Erreur chargement userProfile :', errProfile);
              }
            } catch (err) {
              console.error('Erreur chargement profil Firestore :', err);
            }
          }
        } finally {
          clearTimeout(authFallbackTimer);
          setAuthReady(true);
        }
      };
      void syncAuthState();
    });
    return () => {
      clearTimeout(authFallbackTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Masquer le splash screen dès que l'auth est prête (ou après 1.5s max de sécurité)
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 1500);

    if (authReady) {
      clearTimeout(timer);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [authReady]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.lang = 'fr';
      document.documentElement.setAttribute('dir', 'ltr');
    }
  }, []);

  useEffect(() => {
    if (uid && Platform.OS !== 'web') {
      import('@/lib/notifications').then(({ scheduleDailyReminders }) => scheduleDailyReminders()).catch(() => {});
    }
  }, [uid]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        const mobileAds = require('react-native-google-mobile-ads').default;
        if (typeof mobileAds === 'function') {
          mobileAds().initialize().catch(() => {});
        }
      } catch {}
    }
    import('../components/FloatingChat').then(({ default: Chat }) => setFloatingChat(() => Chat)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!authReady || !segments.length) return;

    const currentRoute = segments[segments.length - 1];
    const fullPath = segments.join('/');

    // Si on atterrit sur le dossier /onboarding lui-même (pas de page index),
    // rediriger immédiatement vers login
    if (currentRoute === 'onboarding' || fullPath === 'onboarding') {
      router.replace('/onboarding/login');
      return;
    }

    const activeUser = firebaseUser || auth?.currentUser;

    // Sans session Firebase, seul l'écran de connexion (et ses pages
    // d'information) est accessible. L'UID persistant du store ne suffit pas.
    const publicRoutes = ['login', 'terms', 'privacy', 'contact'];
    if (!activeUser && !publicRoutes.includes(currentRoute)) {
      router.replace('/onboarding/login');
      return;
    }

    if (!activeUser) {
      return;
    }

    if (activeUser && !uid) {
      return;
    }

    const isOnboarding = segments[0] === 'onboarding';

    // Empêcher de rester sur login SEULEMENT si le profil est déjà totalement configuré
    if (currentRoute === 'login') {
      if (pseudo && age) {
        router.replace('/dashboard');
      }
      return;
    }

    // Un profil connecté tentant d'accéder aux routes privées doit d'abord compléter ses informations
    if (!isOnboarding) {
      if (!pseudo) {
        router.replace('/onboarding/pseudo');
        return;
      }
      if (!age) {
        router.replace('/onboarding/age');
        return;
      }
    }
  }, [authReady, firebaseUser, segments, uid, pseudo, age]);

  const store = useOnboardingStore();
  const isDark = store.isDarkMode;
  const bgCosmetic = store.selectedBackground ? getCosmeticById(store.selectedBackground) : null;
  const defaultBg = isDark ? require('../../assets/images/nousdeux_dark_background.png') : require('../../assets/images/nousdeux_warm_background.png');
  const bgImage = getCosmeticImage(bgCosmetic, isDark) ?? defaultBg;
  const backgroundResizeMode = 'cover';
  const isGradient = bgCosmetic && !getCosmeticImage(bgCosmetic, isDark);
  const bgColors = isGradient ? parseGradientColors(bgCosmetic.preview) : null;

  const webScaleStyle = { flex: 1, width: '100%', height: '100%' } as const;

  return (
    <SafeAreaProvider style={{ flex: 1, width: '100%', height: '100%' }}>
      <View style={[{ flex: 1, width: '100%', height: '100%', backgroundColor: isDark ? '#1A1514' : '#FFF5F2' }] as any}>
        <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
        <View style={webScaleStyle as any}>
        {isGradient && bgColors ? (
          <LinearGradient colors={bgColors as [string, string]} style={{ flex: 1, width: '100%', height: '100%' }}>
            <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.2)' : 'transparent' }}>
              <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade', contentStyle: { backgroundColor: 'transparent', flex: 1, width: '100%', height: '100%' } }} />
            </View>
          </LinearGradient>
        ) : (
          <ImageBackground
            source={bgImage}
            style={[{ flex: 1, width: '100%', height: '100%', backgroundColor: isDark ? '#1A1514' : '#FFF5F2' }]}
            resizeMode={backgroundResizeMode}
            imageStyle={{
              width: '100%',
              height: '100%',
              ...(Platform.OS === 'web' ? { objectPosition: bgCosmetic?.imagePosition || (windowWidth < 600 ? 'center bottom' : 'center') } : {}) 
            } as any}
            blurRadius={0}
          >
            <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.2)' : 'transparent' }}>
              <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade', contentStyle: { backgroundColor: 'transparent', flex: 1, width: '100%', height: '100%' } }} />
            </View>
          </ImageBackground>
        )}
        </View>
        {FloatingChat ? <FloatingChat /> : null}
        <FloatingToast />
        <ForceUpdateModal />
      </View>
    </SafeAreaProvider>
  );
}
