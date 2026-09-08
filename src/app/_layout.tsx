import { getCosmeticById, getCosmeticImage, parseGradientColors } from '@/data/cosmetics';
import { auth } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ImageBackground, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { LogBox } from 'react-native';

const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('M_ID')) return;
  originalError(...args);
};

LogBox.ignoreLogs(['M_ID']);

export default function RootLayout() {
  const { width: windowWidth } = useWindowDimensions();
  const [FloatingChat, setFloatingChat] = useState<React.ComponentType | null>(null);
  const segments = useSegments();
  const router = useRouter();
  const uid = useOnboardingStore((state) => state.uid);
  const pseudo = useOnboardingStore((state) => state.pseudo);
  const age = useOnboardingStore((state) => state.age);

  useEffect(() => {
    const clearDeletedSession = async () => {
      await auth.signOut().catch(() => {});
      const store = useOnboardingStore.getState();
      store.setUid(null);
      store.setPseudo('');
      store.setAge('');
      store.setAvatar(null);
      store.setSynced(false);
      router.replace('/onboarding/login');
      if (Platform.OS === 'web') window.location.reload();
    };
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user && useOnboardingStore.getState().uid) {
        void clearDeletedSession();
      } else if (user) {
        void user.reload().catch((error: any) => {
          if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-user-token') {
            void clearDeletedSession();
          }
        });
      }
    });
    return unsubscribe;
  }, []);

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
    const timer = setTimeout(() => {
      import('../components/FloatingChat').then(({ default: Chat }) => setFloatingChat(() => Chat));
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!segments.length) return;

    const currentRoute = segments[segments.length - 1];
    const fullPath = segments.join('/');

    // Si on atterrit sur le dossier /onboarding lui-même (pas de page index),
    // rediriger immédiatement vers login
    if (currentRoute === 'onboarding' || fullPath === 'onboarding') {
      router.replace('/onboarding/login');
      return;
    }

    // Protection globale : obliger le login si pas de UID
    // Les pages légales et contact sont accessibles sans connexion
    const publicRoutes = ['login', 'terms', 'privacy', 'contact', 'pseudo', 'age', 'avatar', 'date', 'sync'];
    if (!uid && !publicRoutes.includes(currentRoute)) {
      router.replace('/onboarding/login');
      return;
    }

    // Empêcher le retour en arrière sur les écrans d'onboarding de base si on a déjà passé cette étape
    if (uid && pseudo && age) {
      if (['login', 'pseudo', 'age'].includes(currentRoute)) {
        router.replace('/dashboard');
        return;
      }
    } else if (uid) {
      // Si on est connecté mais profil incomplet
      if (currentRoute === 'login') {
        router.replace('/onboarding/pseudo');
        return;
      }
    }
  }, [segments, uid, pseudo, age]);

  const store = useOnboardingStore();
  const isDark = store.isDarkMode;
  const bgCosmetic = store.selectedBackground ? getCosmeticById(store.selectedBackground) : null;
  const defaultBg = isDark ? require('../../assets/images/nousdeux_dark_background.png') : require('../../assets/images/nousdeux_warm_background.png');
  const bgImage = getCosmeticImage(bgCosmetic, isDark) ?? defaultBg;
  const backgroundResizeMode = 'cover';
  const isGradient = bgCosmetic && !getCosmeticImage(bgCosmetic, isDark);
  const bgColors = isGradient ? parseGradientColors(bgCosmetic.preview) : null;

  const webScaleStyle = Platform.OS === 'web' ? {
    position: 'absolute' as const,
    width: '133.333333%',
    height: '133.333333%' as any,
    transform: [{ scale: 0.75 }],
    transformOrigin: 'top left' as any,
  } : StyleSheet.absoluteFill;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1A1514' : '#FFF5F2' }] as any}>
      <View style={webScaleStyle as any}>
      {isGradient && bgColors ? (
        <LinearGradient colors={bgColors as [string, string]} style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.2)' : 'transparent' }}>
            <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }} />
            {FloatingChat ? <FloatingChat /> : null}
          </View>
        </LinearGradient>
      ) : (
        <ImageBackground
          source={bgImage}
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1A1514' : '#FFF5F2' }]}
          resizeMode={backgroundResizeMode}
          imageStyle={{
            ...(Platform.OS === 'web' ? { objectPosition: bgCosmetic?.imagePosition || (windowWidth < 600 ? 'center bottom' : 'center') } : {}) 
          } as any}
          blurRadius={0}
        >
          <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.2)' : 'transparent' }}>
            <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }} />
            {FloatingChat ? <FloatingChat /> : null}
          </View>
        </ImageBackground>
      )}
      </View>
    </View>
  );
}
