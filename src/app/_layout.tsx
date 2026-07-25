import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  const uid = useOnboardingStore((state) => state.uid);
  const pseudo = useOnboardingStore((state) => state.pseudo);
  const age = useOnboardingStore((state) => state.age);

  useEffect(() => {
    if (!segments.length) return;
    
    const currentRoute = segments[segments.length - 1];

    // Protection globale : obliger le login si pas de UID
    if (!uid && currentRoute !== 'login') {
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

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Sur web, on utilise une animation fade pour éviter les glitches
        // Sur mobile, slide natif
        animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
        // Durée de l'animation web (en ms)
        animationDuration: Platform.OS === 'web' ? 200 : undefined,
        // Important sur web : empêche le flash blanc entre les pages
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
