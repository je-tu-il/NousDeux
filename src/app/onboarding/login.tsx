import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Pressable, Platform, ImageBackground } from 'react-native';
import { router, Link } from 'expo-router';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useOnboardingStore } from '@/store/onboardingStore';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { CheckSquare, Square } from 'lucide-react-native';

export default function LoginScreen() {
  const theme = Colors.light;
  const setUid = useOnboardingStore((state) => state.setUid);
  const setPseudo = useOnboardingStore((state) => state.setPseudo);
  const setAge = useOnboardingStore((state) => state.setAge);
  const setSynced = useOnboardingStore((state) => state.setSynced);
  const hasAcceptedTerms = useOnboardingStore((state) => state.hasAcceptedTerms);
  const setHasAcceptedTerms = useOnboardingStore((state) => state.setHasAcceptedTerms);

  const [accepted, setAccepted] = useState(hasAcceptedTerms);

  useEffect(() => {
    if (useOnboardingStore.getState().uid) {
      if (useOnboardingStore.getState().isSynced) {
        router.replace('/dashboard');
      } else {
        router.replace('/onboarding/pseudo');
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (!accepted) {
      alert('Veuillez accepter les CGU et la Politique de confidentialité pour continuer.');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      setUid(user.uid);
      setHasAcceptedTerms(true);

      // Timeout de 3 secondes pour ne pas bloquer si Firestore n'est pas prêt
      const fetchProfile = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setPseudo(data.pseudo || "");
            setAge(data.age || "");
            if (data.linkedTo) {
              setSynced(true);
              return '/dashboard';
            }
            return '/onboarding/sync';
          }
        } catch (e) {
          console.error(e);
        }
        return null;
      };

      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

      const redirectPath = await Promise.race([fetchProfile(), timeout]);

      if (redirectPath) {
        router.replace(redirectPath as any);
      } else {
        // Nouvel utilisateur ou erreur de chargement
        if (user.displayName && !useOnboardingStore.getState().pseudo) {
          setPseudo(user.displayName.split(' ')[0]);
        }
        router.replace('/onboarding/pseudo');
      }
    } catch (error: any) {
      alert("Erreur de connexion : " + error.message);
    }
  };

  const toggleAccepted = () => {
    setAccepted((v) => !v);
  };

  return (
    <ImageBackground source={require('../../../assets/images/bloomy_warm_background.png')} style={styles.container} resizeMode="cover">
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(800)}>
          <Text style={[styles.title, { color: theme.text }]}>Bienvenue sur Bloomy</Text>
          <Text style={[styles.subtitle, { color: theme.text }]}>Connecte-toi pour lier ton compte à vie.</Text>
        </Animated.View>

        {/* Consentement RGPD */}
        <Animated.View entering={FadeInUp.duration(800).delay(100)} style={styles.consentBox}>
          <Pressable style={styles.checkRow} onPress={toggleAccepted} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
            {accepted
              ? <CheckSquare color={theme.tint} size={22} />
              : <Square color="#A99693" size={22} />}
            <Text style={styles.consentText}>
              J'accepte les{' '}
              <Link href="/terms" style={styles.link}>Conditions Générales d'Utilisation</Link>
              {' '}et la{' '}
              <Link href="/privacy" style={styles.link}>Politique de Confidentialité</Link>
              {' '}de Bloomy.
            </Text>
          </Pressable>
          <Text style={styles.consentNote}>
            Vos réponses sont chiffrées de bout en bout. Ni Bloomy ni ses serveurs ne peuvent les lire.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.buttonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              { opacity: pressed ? 0.8 : accepted ? 1 : 0.5 }
            ]}
            onPress={handleGoogleLogin}
          >
            <Text style={styles.googleButtonText}>Continuer avec Google</Text>
          </Pressable>
        </Animated.View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', overflow: 'hidden' },
  content: { flex: 1, justifyContent: 'center', padding: 30, width: '100%', maxWidth: 500, alignSelf: 'center' },
  title: { fontSize: 36, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 18, opacity: 0.8, textAlign: 'center', marginBottom: 40, lineHeight: 26 },
  consentBox: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 30,
    gap: 12,
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  consentText: { flex: 1, fontSize: 14, color: '#4A3B39', lineHeight: 20 },
  link: { color: '#E05C5C', fontWeight: '700', textDecorationLine: 'underline' },
  consentNote: { fontSize: 12, color: '#A99693', fontStyle: 'italic', textAlign: 'center' },
  buttonContainer: { alignItems: 'center' },
  googleButton: { backgroundColor: 'white', paddingVertical: 18, paddingHorizontal: 32, borderRadius: 30, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  googleButtonText: { color: '#444', fontSize: 18, fontWeight: 'bold' },
});
