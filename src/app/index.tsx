import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function Index() {
  const [hydrated, setHydrated] = useState(false);
  const isSynced = useOnboardingStore((state) => state.isSynced);
  const uid = useOnboardingStore((state) => state.uid);

  useEffect(() => {
    if (useOnboardingStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const timer = setTimeout(() => {
      setHydrated(true);
    }, 500);
    const unsub = useOnboardingStore.persist.onFinishHydration(() => {
      clearTimeout(timer);
      setHydrated(true);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  // Tant que le store local n'est pas réhydraté, afficher un fond neutre transparent pour éviter le flash de l'écran login
  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: 'transparent' }} />;
  }

  // Rediriger vers le dashboard si l'utilisateur est déjà connecté ou synchronisé
  if (isSynced || uid) {
    return <Redirect href="/dashboard" />;
  }

  return <Redirect href="/onboarding/login" />;
}
