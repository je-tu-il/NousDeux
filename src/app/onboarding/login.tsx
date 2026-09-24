import { Colors } from '@/constants/Colors';
import { auth, db } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Link, router } from 'expo-router';
import { browserLocalPersistence, getRedirectResult, GoogleAuthProvider, setPersistence, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CheckSquare, Square } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ImageBackground, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import UIModal, { UIModalType } from '@/components/UIModal';

export default function LoginScreen() {
  const theme = Colors.light;
  const setUid = useOnboardingStore((state) => state.setUid);
  const setPseudo = useOnboardingStore((state) => state.setPseudo);
  const setAge = useOnboardingStore((state) => state.setAge);
  const setAvatar = useOnboardingStore((state) => state.setAvatar);
  const setSynced = useOnboardingStore((state) => state.setSynced);
  const setMyCode = useOnboardingStore((state) => state.setMyCode);
  const hasAcceptedTerms = useOnboardingStore((state) => state.hasAcceptedTerms);
  const setHasAcceptedTerms = useOnboardingStore((state) => state.setHasAcceptedTerms);

  const [accepted, setAccepted] = useState(hasAcceptedTerms);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type?: UIModalType;
    title?: string;
    message?: string;
  }>({ visible: false });

  const withLoginTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
    if (Platform.OS !== 'web') return promise;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error('La fenêtre Google ne répond plus. Fermez-la puis réessayez.');
        error.name = 'auth-popup-timeout';
        reject(error);
      }, 120000);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const completeLogin = async (user: { uid: string; displayName: string | null; photoURL?: string | null }) => {
    setUid(user.uid);
    setHasAcceptedTerms(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setPseudo(data.pseudo || '');
        setAge(data.age || '');
        const av = data.avatarUrl || data.avatar || user.photoURL || null;
        setAvatar(av);
        if (!data.avatarUrl && user.photoURL) {
          setDoc(doc(db, 'users', user.uid), { avatarUrl: user.photoURL }, { merge: true }).catch(() => {});
        }
        try {
          const { getUserProfile } = await import('@/lib/economy');
          const p = await getUserProfile(user.uid);
          if (p?.avatar) useOnboardingStore.getState().setAvatarConfig(p.avatar);
          if (p?.selectedBackground) {
            useOnboardingStore.getState().setSelectedCosmetics(p.selectedBackground, p.selectedBorder, p.selectedTag);
          }
        } catch {}

        if (data.pairingCode) {
          setMyCode(data.pairingCode);
        }
        if (data.linkedTo && !data.needsDate) {
          setSynced(true);
          router.replace('/dashboard');
          return;
        }
        if (data.linkedTo && data.needsDate) {
          setSynced(true);
          router.replace('/onboarding/date');
          return;
        }
        if (data.pseudo && data.age) {
          router.replace('/dashboard');
          return;
        }
        if (data.pseudo) {
          router.replace('/onboarding/age');
          return;
        }
      }
      if (user.displayName && !useOnboardingStore.getState().pseudo) {
        setPseudo(user.displayName.split(' ')[0]);
      }
      router.replace('/onboarding/pseudo');
    } catch (error: any) {
      setLoginError(`Connexion réussie, mais le profil est inaccessible : ${error?.message ?? 'erreur Firestore'}`);
    } finally {
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) void completeLogin(result.user);
      })
      .catch((error: any) => {
        setLoginError(`La connexion Google a échoué : ${error?.message ?? 'erreur inconnue'}`);
        setIsSigningIn(false);
      });
  }, []);

  const handleGoogleLogin = async () => {
    if (!accepted) {
      setModalState({
        visible: true,
        type: 'warning',
        title: 'Conditions requises',
        message: 'Veuillez accepter les CGU et la Politique de confidentialité pour continuer.',
      });
      return;
    }
    setLoginError(null);
    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      if (Platform.OS === 'web') {
        await setPersistence(auth, browserLocalPersistence);
      }
      const result = await withLoginTimeout(signInWithPopup(auth, provider));
      await completeLogin(result.user);
    } catch (error: any) {
      // L'utilisateur a fermé la popup volontairement — pas une erreur bloquante
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        setIsSigningIn(false);
        return;
      }
      if (error?.name === 'auth-popup-timeout') {
        setLoginError(error.message);
      } else if (Platform.OS === 'web' && ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error?.code)) {
        try {
          const redirectProvider = new GoogleAuthProvider();
          redirectProvider.setCustomParameters({ prompt: 'select_account' });
          await signInWithRedirect(auth, redirectProvider);
          return;
        } catch (redirectError: any) {
          setLoginError(`La redirection Google a échoué : ${redirectError?.message ?? 'erreur inconnue'}`);
        }
      } else {
        setLoginError(`Erreur de connexion : ${error?.message ?? 'erreur inconnue'}`);
      }
      setIsSigningIn(false);
    }
  };

  const toggleAccepted = () => {
    const next = !accepted;
    setAccepted(next);
    setHasAcceptedTerms(next); // ← persister dans le store pour survivre à la navigation CGU
  };

  return (
    <ImageBackground source={require('../../../assets/images/nousdeux_warm_background.png')} style={styles.container} resizeMode="cover">
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(800)}>
          <Text style={[styles.title, { color: theme.text }]}>Bienvenue sur NousDeux</Text>
          <Text style={[styles.subtitle, { color: theme.text }]}>Connecte-toi pour lier ton compte à vie.</Text>
        </Animated.View>

        {/* Consentement RGPD */}
        <Animated.View entering={FadeInUp.duration(800).delay(100)} style={styles.consentBox}>
          {/* Checkbox séparée des liens pour éviter le toggle accidentel */}
          <Pressable style={styles.checkRow} onPress={toggleAccepted} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
            {accepted
              ? <CheckSquare color={theme.tint} size={22} />
              : <Square color="#A99693" size={22} />}
            <Text style={styles.consentText}>
              {"J'accepte les conditions générales et la politique de confidentialité de NousDeux."}
            </Text>
          </Pressable>

          {/* Liens CGU en dehors du Pressable pour ne pas déclencher toggleAccepted */}
          <View style={styles.linksRow}>
            <Link href="/terms" style={styles.link}>Conditions Générales</Link>
            <Text style={styles.linkSep}>·</Text>
            <Link href="/privacy" style={styles.link}>Politique de Confidentialité</Link>
          </View>

          <Text style={styles.consentNote}>
            Vos réponses sont chiffrées de bout en bout. Ni NousDeux ni ses serveurs ne peuvent les lire.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.buttonContainer}>
          {loginError && <Text style={styles.errorText}>{loginError}</Text>}
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              { opacity: pressed || isSigningIn ? 0.6 : accepted ? 1 : 0.5 }
            ]}
            onPress={handleGoogleLogin}
            disabled={!accepted || isSigningIn}
          >
            <Text style={styles.googleButtonText}>{isSigningIn ? 'Connexion en cours...' : 'Continuer avec Google'}</Text>
          </Pressable>
        </Animated.View>
      </View>

      <UIModal
        visible={modalState.visible}
        onClose={() => setModalState({ visible: false })}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
      />
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
  linksRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  linkSep: { color: '#A99693', fontSize: 13 },
  buttonContainer: { alignItems: 'center' },
  googleButton: { backgroundColor: 'white', paddingVertical: 18, paddingHorizontal: 32, borderRadius: 30, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  googleButtonText: { color: '#444', fontSize: 18, fontWeight: 'bold' },
  errorText: { color: '#B91C1C', backgroundColor: 'rgba(254,226,226,0.92)', padding: 12, borderRadius: 12, marginBottom: 16, textAlign: 'center', lineHeight: 19 },
});
