import { getCosmeticById, getCosmeticImage, parseGradientColors } from '@/data/cosmetics';
import { auth } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useSessionBootstrap } from '@/hooks/use-session-bootstrap';
import StartupScreen from '@/components/StartupScreen';

import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import FloatingToast from '@/components/FloatingToast';
import ForceUpdateModal from '@/components/ForceUpdateModal';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { ready: authReady, error: startupError, user: firebaseUser, retry } = useSessionBootstrap();
  const segments = useSegments();
  const router = useRouter();
  const uid = useOnboardingStore((state) => state.uid);
  const pseudo = useOnboardingStore((state) => state.pseudo);
  const age = useOnboardingStore((state) => state.age);
  const isSynced = useOnboardingStore((state) => state.isSynced);
  const isDark = useOnboardingStore((state) => state.isDarkMode);
  const selectedBackground = useOnboardingStore((state) => state.selectedBackground);
  const shouldShowChat = Boolean(authReady && firebaseUser && uid === firebaseUser.uid && isSynced && segments[0] !== 'onboarding');
  const [FloatingChat, setFloatingChat] = useState<React.ComponentType | null>(null);
  const pendingDeepLinkRef = useRef<string | null>(null);
  const initialUrlHandled = useRef(false);

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
    if (authReady && Platform.OS !== 'web') {
      import('@/lib/widgets')
        .then(({ syncWidgetData }) => syncWidgetData({}))
        .catch((err) => console.warn('[App] Initial widget sync error:', err));
    }
  }, [authReady, uid]);

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      try {
        const raw = (event.url || '').toLowerCase();
        const parsed = Linking.parse(event.url);
        const path = (parsed.path || parsed.hostname || '').toLowerCase();
        let target: string | null = null;
        if (path.includes('daylink') || raw.includes('daylink')) {
          target = '/daylink';
        } else if (path.includes('dashboard') || raw.includes('dashboard')) {
          target = '/dashboard';
        }

        if (target) {
          if (!authReady || !uid) {
            pendingDeepLinkRef.current = target;
            return;
          }
          const currentPath = `/${segments.join('/')}`;
          if (currentPath === target || (target === '/daylink' && currentPath.includes('daylink'))) {
            return;
          }
          router.replace(target as any);
        }
      } catch (e) {
        console.warn('[Linking] Error handling url:', e);
      }
    };

    if (!initialUrlHandled.current) {
      initialUrlHandled.current = true;
      Linking.getInitialURL().then((url) => {
        if (url) handleUrl({ url });
      }).catch(() => {});
    }

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => {
      subscription.remove();
    };
  }, [router, authReady, uid, segments]);

  useEffect(() => {
    // The lightweight recovery screen is already drawn when the native splash hides.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.lang = 'fr';
      document.documentElement.setAttribute('dir', 'ltr');
    }
  }, []);

  useEffect(() => {
    if (authReady && Platform.OS !== 'web') {
      import('@/lib/notifications').then(({ initBackgroundSync, scheduleDailyReminders, checkPartnerAnswerAndSync }) => {
        initBackgroundSync().catch(() => {});
        if (uid) {
          scheduleDailyReminders().catch(() => {});
          checkPartnerAnswerAndSync().catch(() => {});
        }
      }).catch(() => {});

      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          import('@/lib/notifications').then(({ checkPartnerAnswerAndSync, scheduleDailyReminders }) => {
            checkPartnerAnswerAndSync().catch(() => {});
            scheduleDailyReminders().catch(() => {});
          }).catch(() => {});
        }
      });

      return () => {
        subscription.remove();
      };
    }
  }, [uid, authReady]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        const mobileAds = require('react-native-google-mobile-ads').default;
        if (typeof mobileAds === 'function') {
          mobileAds().initialize().catch(() => {});
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!shouldShowChat || FloatingChat) return;
    let active = true;
    import('../components/FloatingChat')
      .then(({ default: Chat }) => { if (active) setFloatingChat(() => Chat); })
      .catch(() => {});
    return () => { active = false; };
  }, [shouldShowChat, FloatingChat]);

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
    const publicRoutes = ['login', 'terms', 'privacy', 'contact', '+not-found'];
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
        if (pendingDeepLinkRef.current) {
          const next = pendingDeepLinkRef.current;
          pendingDeepLinkRef.current = null;
          router.replace(next as any);
        } else {
          router.replace('/dashboard');
        }
      } else {
        router.replace(!pseudo ? '/onboarding/pseudo' : '/onboarding/age');
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
      if (pendingDeepLinkRef.current) {
        const next = pendingDeepLinkRef.current;
        pendingDeepLinkRef.current = null;
        router.replace(next as any);
      }
    }
  }, [authReady, firebaseUser, segments, uid, pseudo, age, router]);

  const bgCosmetic = selectedBackground ? getCosmeticById(selectedBackground) : null;
  const defaultBg = isDark ? require('../../assets/images/optimized/nousdeux_dark_background.jpg') : require('../../assets/images/optimized/nousdeux_warm_background.jpg');
  const cosmeticImage = getCosmeticImage(bgCosmetic, isDark);
  const bgImage = cosmeticImage ?? defaultBg;
  const backgroundResizeMode = 'cover';
  const bgColors = bgCosmetic && !cosmeticImage ? parseGradientColors(bgCosmetic.preview) : null;

  const webScaleStyle = { flex: 1, width: '100%', height: '100%' } as const;

  return (
    <SafeAreaProvider style={{ flex: 1, width: '100%', height: '100%' }}>
      <View style={[{ flex: 1, width: '100%', height: '100%', overflow: 'hidden', backgroundColor: isDark ? '#1A1514' : '#FFF5F2' }] as any}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={webScaleStyle as any}>
        {bgColors ? (
          <LinearGradient colors={bgColors as [string, string]} style={StyleSheet.absoluteFill} />
        ) : (
          <Image source={bgImage} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode={backgroundResizeMode} />
        )}
        {authReady ? (
          <Stack key={firebaseUser?.uid ?? 'signed-out'} screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        ) : <StartupScreen error={startupError} onRetry={retry} />}
        </View>
        {shouldShowChat && FloatingChat ? <FloatingChat /> : null}
        <FloatingToast />
        <ForceUpdateModal />
      </View>
    </SafeAreaProvider>
  );
}
