import { Redirect } from 'expo-router';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function Index() {
  const isSynced = useOnboardingStore((state) => state.isSynced);
  
  // Rediriger vers dashboard si déjà synchro, sinon on commence l'onboarding (le route guard gérera le saut aux bonnes étapes)
  return <Redirect href={isSynced ? "/dashboard" : "/onboarding/login"} />;
}
