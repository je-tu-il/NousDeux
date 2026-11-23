import { auth } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Link } from 'expo-router';
import { getRedirectResult, GoogleAuthProvider, OAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { CheckSquare, Square, Heart, ArrowRight, Sparkles, MessageCircle, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { getLoginFeedback } from '@/lib/login-feedback.mjs';
import { BackHandler, Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import UIModal, { UIModalType } from '@/components/UIModal';
import { triggerHaptic } from '@/lib/haptics';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const compact = width < 390;
  const insets = useSafeAreaInsets();
  const accepted = useOnboardingStore((state) => state.hasAcceptedTerms);
  const setHasAcceptedTerms = useOnboardingStore((state) => state.setHasAcceptedTerms);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const signingIn = useRef(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type?: UIModalType;
    title?: string;
    message?: string;
  }>({ visible: false });

  // Empêcher le retour arrière Android d'afficher une session précédente
  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        BackHandler.exitApp();
        return true;
      });
      return () => sub.remove();
    }
  }, []);

  const withLoginTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
    if (Platform.OS !== 'web') return promise;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error('OAuth popup timeout');
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

  // Navigation and profile restoration are owned by the session bootstrap.
  // Keeping a second asynchronous restore here caused first-login/reload races.
  const completeLogin = async (_user: { uid: string; displayName: string | null; photoURL?: string | null }) => {
    setHasAcceptedTerms(true);
    setIsSigningIn(false);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setHasAcceptedTerms(true);
        }
      })
      .catch((error: any) => {
        if (error?.code !== 'auth/popup-closed-by-user') {
          console.warn("Erreur getRedirectResult :", error);
        }
        setIsSigningIn(false);
      });
  }, [setHasAcceptedTerms]);

  const beginLogin = () => {
    if (signingIn.current) return false;
    if (!accepted) {
      triggerHaptic('warning');
      setModalState({
        visible: true,
        type: 'warning',
        title: 'Conditions requises',
        message: 'Veuillez accepter les CGU et la Politique de confidentialité pour continuer.',
      });
      return false;
    }
    signingIn.current = true;
    setLoginError(null);
    setIsSigningIn(true);
    triggerHaptic('light');
    return true;
  };

  const finishLoginAttempt = () => {
    signingIn.current = false;
    setIsSigningIn(false);
  };

  const showProviderError = (provider: 'apple' | 'google', error: unknown) => {
    const feedback = getLoginFeedback(provider, error);
    if (!feedback) return;
    triggerHaptic('warning');
    setLoginError(feedback);
  };

  const handleGoogleLogin = async () => {
    if (!beginLogin()) return;
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        // NOTE: Ne pas faire d'await avant signInWithPopup pour préserver le geste utilisateur sur Safari/iOS/Chrome
        const result = await withLoginTimeout(signInWithPopup(auth, provider));
        if (result?.user) {
          await completeLogin(result.user);
        }
      } else {
        // Native Mobile (iOS IPA / Android APK)
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

        GoogleSignin.configure({
          webClientId: '617698669043-fjlmaj3eja7tenr5ov2kcbdol76ped0g.apps.googleusercontent.com',
          iosClientId: '617698669043-ioqqer8rkgih638t0a2b4d7j1sthg4un.apps.googleusercontent.com',
          offlineAccess: false,
        });

        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        } catch (playErr: any) {
          console.warn('PlayServices status check:', playErr);
        }
        // S'assurer qu'aucune session expirée ou d'un compte supprimé ne bloque la reconnexion
        await GoogleSignin.signOut().catch(() => {});
        const signInResult = await GoogleSignin.signIn();

        if ((signInResult as any).type === 'cancelled') {
          setIsSigningIn(false);
          return;
        }

        const idToken = signInResult.data?.idToken || (signInResult as any).idToken;
        if (!idToken) {
          throw new Error("Impossible de récupérer le jeton de connexion Google.");
        }

        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        await completeLogin(userCredential.user);
      }
    } catch (error) {
      showProviderError('google', error);
    } finally {
      finishLoginAttempt();
    }
  };

  const handleAppleLogin = async () => {
    if (!beginLogin()) return;

    try {
      if (Platform.OS === 'ios') {
        const AppleAuthentication = await import('expo-apple-authentication');
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
          throw new Error("La connexion avec Apple n'est pas disponible sur cet appareil.");
        }

        // Génération d'un nonce cryptographique requis par Firebase Auth
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce
        );

        const appleCredential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce,
        });

        const { identityToken } = appleCredential;
        if (!identityToken) {
          throw new Error("Impossible de récupérer le jeton de connexion Apple.");
        }

        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: identityToken,
          rawNonce: rawNonce,
        });
        const userCredential = await signInWithCredential(auth, credential);
        const fullName = appleCredential.fullName
          ? [appleCredential.fullName.givenName, appleCredential.fullName.familyName].filter(Boolean).join(' ')
          : null;
        await completeLogin({
          uid: userCredential.user.uid,
          displayName: fullName || userCredential.user.displayName,
          photoURL: userCredential.user.photoURL,
        });
      } else if (Platform.OS === 'web') {
        // Web: Firebase OAuthProvider
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        const result = await withLoginTimeout(signInWithPopup(auth, provider));
        if (result?.user) {
          await completeLogin(result.user);
        }
      } else {
        // Native Android APK
        setIsSigningIn(false);
        setModalState({
          visible: true,
          type: 'info',
          title: 'Connexion Apple',
          message: 'La connexion avec Apple est conçue pour iOS (iPhone/iPad) et le Web. Sur votre appareil Android, utilisez la connexion avec Google en 1 clic !',
        });
        return;
      }
    } catch (error) {
      showProviderError('apple', error);
    } finally {
      finishLoginAttempt();
    }
  };

  const toggleAccepted = () => {
    triggerHaptic('selection');
    setHasAcceptedTerms(!accepted);
  };

  return (
    <ImageBackground source={require('../../../assets/images/optimized/nousdeux_warm_background.jpg')} style={styles.container} resizeMode="cover">
      <ScrollView contentContainerStyle={[styles.scroll, compact && { paddingHorizontal: 16 }, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={[styles.brandRow, compact && { marginBottom: 22 }]}>
            <Image source={require('../../../assets/images/optimized/brand-icon.png')} style={styles.brandIcon} />
            <Text style={styles.brandName}>NousDeux<Text style={{ color: '#B65A6D' }}>.</Text></Text>
            {wide && <Text style={styles.brandNote}>LE RENDEZ-VOUS DES COMPLICES</Text>}
          </View>
          <View style={[styles.content, wide && styles.wideContent]}>
            {!compact && <View style={[styles.story, wide && { flex: 1, paddingRight: 72 }]}>
              <View style={styles.eyebrow}><Heart size={13} color="#A5475F" /><Text style={styles.eyebrowText}>UN PEU DE VOUS, CHAQUE JOUR</Text></View>
              <Text style={[styles.title, wide && { fontSize: 66, lineHeight: 72 }]}>Les petits moments font les grandes histoires.</Text>
              <Text style={styles.subtitle}>Une question, un sourire, une nouvelle façon de se découvrir. Prenez le temps de vous retrouver.</Text>
              {wide && <View style={styles.features}>
                <View style={styles.feature}><MessageCircle size={20} color="#A5475F" /><View style={{ flex: 1 }}><Text style={styles.featureTitle}>Votre rituel à deux</Text><Text style={styles.featureText}>Une nouvelle question à partager chaque jour.</Text></View></View>
                <View style={styles.feature}><Sparkles size={20} color="#A5475F" /><View style={{ flex: 1 }}><Text style={styles.featureTitle}>À votre image</Text><Text style={styles.featureText}>Des souvenirs et un espace qui vous ressemblent.</Text></View></View>
                <View style={styles.quote}><Text style={styles.quoteText}>« Et si on apprenait encore quelque chose sur nous aujourd’hui ? »</Text><Text style={styles.quoteCaption}>VOTRE PROCHAIN CHAPITRE COMMENCE ICI</Text></View>
              </View>}
            </View>}
            <View style={[styles.card, compact && { padding: 18 }, wide && { width: 410 }]}>
              <View style={styles.cardBadge}><Heart size={22} color="#A5475F" /></View>
              <Text style={styles.cardTitle}>Votre histoire continue ici</Text>
              <Text style={styles.cardSubtitle}>Crée ton compte ou retrouve ton espace.
Ton partenaire pourra te rejoindre ensuite.</Text>
              <View style={styles.consentBox}>
                <Pressable style={styles.checkRow} onPress={toggleAccepted} accessibilityRole="checkbox" accessibilityLabel="Accepter les conditions générales et la politique de confidentialité" accessibilityState={{ checked: accepted }} aria-checked={accepted}>
                  {accepted ? <CheckSquare color="#A5475F" size={22} /> : <Square color="#89787C" size={22} />}
                  <Text style={styles.consentText}>J’accepte les conditions générales et la politique de confidentialité.</Text>
                </Pressable>
                <View style={styles.linksRow}>
                  <Link href="/terms" style={styles.link}>Conditions générales</Link>
                  <Text style={styles.linkSep}>·</Text>
                  <Link href="/privacy" style={styles.link}>Confidentialité</Link>
                </View>
              </View>
              {loginError && <Text accessibilityRole="alert" style={styles.errorText}>{loginError}</Text>}
              <View style={styles.buttonContainer}>
                <Pressable accessibilityRole="button" accessibilityLabel={isSigningIn ? 'Connexion en cours' : 'Continuer avec Google'} accessibilityState={{ busy: isSigningIn, disabled: isSigningIn }} style={({ pressed }) => [styles.googleButton, { opacity: pressed || isSigningIn ? 0.6 : 1 }]} onPress={handleGoogleLogin} disabled={isSigningIn}>
                  <Text style={styles.googleMark}>G</Text><Text style={styles.googleButtonText}>{isSigningIn ? 'Connexion en cours…' : 'Continuer avec Google'}</Text><ArrowRight size={17} color="#665459" />
                </Pressable>
                {Platform.OS === 'ios' ? (
                  <View pointerEvents={isSigningIn ? 'none' : 'auto'} style={{ width: '100%', opacity: isSigningIn ? 0.6 : 1 }}>
                    <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={14} style={{ height: 54, width: '100%' }} onPress={handleAppleLogin} />
                  </View>
                ) : Platform.OS === 'web' ? (
                  <Pressable accessibilityRole="button" accessibilityState={{ busy: isSigningIn, disabled: isSigningIn }} style={({ pressed }) => [styles.appleButton, { opacity: pressed || isSigningIn ? 0.6 : 1 }]} onPress={handleAppleLogin} disabled={isSigningIn}>
                    <Text style={styles.appleButtonText}>{isSigningIn ? 'Connexion en cours…' : 'Continuer avec Apple'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.securityNote}><ShieldCheck size={14} color="#89787C" /><Text style={styles.consentNote}>Un espace réservé à votre duo.</Text></View>
            </View>
          </View>
          <View style={styles.footer}><Text style={styles.footerText}>À deux, c’est encore mieux.</Text><Link href="/contact" style={styles.footerLink}>Besoin d’un coup de main ?</Link></View>
        </View>
      </ScrollView>
      <UIModal visible={modalState.visible} onClose={() => setModalState({ visible: false })} type={modalState.type} title={modalState.title} message={modalState.message} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', backgroundColor: '#FCF8F5' },
  scroll: { flexGrow: 1, backgroundColor: 'rgba(252,248,245,0.97)', paddingHorizontal: 24 },
  page: { flex: 1, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, marginBottom: 38 },
  brandIcon: { width: 38, height: 38, borderRadius: 12 },
  brandName: { fontSize: 25, fontWeight: '700', color: '#402B32', letterSpacing: -1 },
  brandNote: { marginLeft: 'auto', color: '#8E7C80', fontSize: 10, fontWeight: '600', letterSpacing: 2.2 },
  content: { flex: 1, justifyContent: 'center', gap: 32, width: '100%', maxWidth: 480, alignSelf: 'center' },
  wideContent: { flexDirection: 'row', alignItems: 'center', maxWidth: 1120, gap: 0, paddingVertical: 30 },
  story: { width: '100%' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  eyebrowText: { color: '#A5475F', fontSize: 10, fontWeight: '700', letterSpacing: 1.8 },
  title: { fontSize: 37, lineHeight: 43, fontWeight: '600', color: '#402B32', letterSpacing: -1.7 },
  subtitle: { color: '#79646A', fontSize: 16, lineHeight: 26, marginTop: 22, maxWidth: 420 },
  features: { gap: 24, marginTop: 36 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  featureTitle: { color: '#503740', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  featureText: { color: '#89787C', fontSize: 13, lineHeight: 20 },
  quote: { borderLeftWidth: 2, borderColor: '#DDB5BC', paddingLeft: 20, marginTop: 8, maxWidth: 370 },
  quoteText: { fontSize: 17, lineHeight: 27, color: '#79646A', fontStyle: 'italic' },
  quoteCaption: { fontSize: 8, letterSpacing: 1.6, color: '#A28A90', marginTop: 12 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDE2E1', borderRadius: 28, padding: 28, width: '100%', shadowColor: '#67454E', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.07, shadowRadius: 36, elevation: 2 },
  cardBadge: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FAEFF1', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  cardTitle: { color: '#402B32', fontSize: 25, lineHeight: 31, fontWeight: '600', letterSpacing: -0.6 },
  cardSubtitle: { color: '#89787C', fontSize: 14, lineHeight: 22, marginTop: 12, marginBottom: 26 },
  consentBox: { gap: 12, marginBottom: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  consentText: { flex: 1, color: '#665459', fontSize: 12, lineHeight: 19 },
  linksRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingLeft: 32 },
  link: { fontSize: 11, color: '#A5475F', textDecorationLine: 'underline' },
  linkSep: { color: '#B6A2A7', fontSize: 11 },
  buttonContainer: { width: '100%', gap: 12 },
  googleButton: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DED2D5', minHeight: 54, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  googleMark: { color: '#4285F4', fontSize: 20, fontWeight: '700' },
  googleButtonText: { color: '#402B32', fontSize: 14, fontWeight: '600' },
  appleButton: { backgroundColor: '#211C1E', minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  appleButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  securityNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24 },
  consentNote: { color: '#89787C', fontSize: 11 },
  errorText: { color: '#9D2841', backgroundColor: '#FFF0F2', padding: 12, borderRadius: 12, marginBottom: 16, fontSize: 12, lineHeight: 19 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginTop: 40, paddingVertical: 16, borderTopWidth: 1, borderColor: '#EDE2E1' },
  footerText: { fontSize: 11, color: '#A28A90' },
  footerLink: { fontSize: 11, color: '#79646A' },
});
