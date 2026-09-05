import { Redirect } from 'expo-router';

// /onboarding n'a pas de page propre — redirige toujours vers login
export default function OnboardingIndex() {
  return <Redirect href="/onboarding/login" />;
}
