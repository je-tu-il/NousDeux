import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function Index() {
  const [hydrated, setHydrated] = useState(false);
  const isSynced = useOnboardingStore((state) => state.isSynced);
  const uid = useOnboardingStore((state) => state.uid);
  const pseudo = useOnboardingStore((state) => state.pseudo);
  const age = useOnboardingStore((state) => state.age);

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

  // Rediriger selon l'état réel du compte
  if (!uid) {
    return <Redirect href="/onboarding/login" />;
  }

  if (isSynced) {
    return <Redirect href="/dashboard" />;
  }

  if (!pseudo) {
    return <Redirect href="/onboarding/pseudo" />;
  }

  if (!age) {
    return <Redirect href="/onboarding/age" />;
  }

  // Profil configuré mais pas encore lié : autoriser l'accès au dashboard (mode solo)
  return <Redirect href="/dashboard" />;
}
