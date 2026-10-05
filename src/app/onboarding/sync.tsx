import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ImageBackground, Share, Alert, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/Colors';
import { getCosmeticById, getCosmeticImage } from '@/data/cosmetics';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { ArrowLeft, Copy, Share2, CheckCircle2, HeartHandshake, Compass } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { auth, db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, setDoc, onSnapshot, deleteField, writeBatch, query, where, limit } from 'firebase/firestore';
import UIModal, { UIModalType } from '@/components/UIModal';
import { ensureUserPairingCode, generatePairingCode } from '@/lib/pairing';
import { useTopInset } from '@/hooks/useTopInset';

const generateCode = generatePairingCode;

async function resetCoupleData(coupleId: string) {
  const subcollections = ['daily', 'progress', 'quests', 'economy', 'inventory', 'messages'];
  for (const subcollection of subcollections) {
    try {
      const snapshot = await getDocs(collection(db, 'couples', coupleId, subcollection));
      if (snapshot.empty) continue;
      const batch = writeBatch(db);
      for (const item of snapshot.docs) {
        if (subcollection === 'daily') {
          const answersSnap = await getDocs(collection(db, 'couples', coupleId, 'daily', item.id, 'answers')).catch(() => null);
          if (answersSnap && !answersSnap.empty) {
            const subBatch = writeBatch(db);
            answersSnap.docs.forEach(ans => subBatch.delete(ans.ref));
            await subBatch.commit().catch(() => {});
          }
        }
        batch.delete(item.ref);
      }
      await batch.commit().catch(() => {});
    } catch (err) {
      console.warn('Error resetting couple subcollection:', subcollection, err);
    }
  }
}

export default function SyncScreen() {
  const [partnerCode, setPartnerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type?: UIModalType;
    title?: string;
    message?: string;
  }>({ visible: false });

  const myCode = useOnboardingStore((state) => state.myCode);
  const myAvatar = useOnboardingStore((state) => state.avatar);
  const setMyCode = useOnboardingStore((state) => state.setMyCode);
  const store = useOnboardingStore((state) => state);
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const backgroundSource = getCosmeticImage(getCosmeticById(store.selectedBackground), store.isDarkMode)
    || (store.isDarkMode
      ? require('../../../assets/images/nousdeux_dark_background.png')
      : require('../../../assets/images/nousdeux_warm_background.png'));

  const isLinking = React.useRef(false);
  const topInset = useTopInset();

  useEffect(() => {
    const state = useOnboardingStore.getState();
    const activeUid = state.uid || auth?.currentUser?.uid;
    if (!activeUid) {
      router.replace('/onboarding/login');
      return;
    }
    if (!state.uid && activeUid) {
      useOnboardingStore.getState().setUid(activeUid);
    }
    if (!state.pseudo) {
      router.replace('/onboarding/pseudo');
      return;
    } else if (!state.age) {
      router.replace('/onboarding/age');
      return;
    }

    // Assurer immédiatement un code sans attendre pour éviter de bloquer sur "Génération..."
    if (!state.myCode) {
      ensureUserPairingCode(state.uid, null).then((code) => {
        setMyCode(code);
      }).catch(() => {});
    }

    // Écoute en temps réel du profil utilisateur (source unique de vérité Firestore)
    const unsub = onSnapshot(doc(db, "users", state.uid), async (docSnap) => {
      if (!docSnap.exists()) {
        const code = await ensureUserPairingCode(state.uid!, useOnboardingStore.getState().myCode);
        setMyCode(code);
        return;
      }
      const data = docSnap.data();

      // 1. Synchronisation temps réel du code de jumelage
      if (data.pairingCode) {
        if (useOnboardingStore.getState().myCode !== data.pairingCode) {
          setMyCode(data.pairingCode);
        }
        // Maintenir systématiquement l'existence du code dans pairing_codes
        setDoc(doc(db, "pairing_codes", data.pairingCode), {
          creatorUid: state.uid,
          createdAt: new Date(),
        }, { merge: true }).catch(() => {});
      } else {
        const code = await ensureUserPairingCode(state.uid!, useOnboardingStore.getState().myCode);
        setMyCode(code);
      }

      // 2. Si on est lié, on enregistre le partenaire et on va directement sur l'écran date
      if (data.linkedTo && !isLinking.current) {
        const partnerDoc = await getDoc(doc(db, "users", data.linkedTo));
        const pName = partnerDoc.exists() ? partnerDoc.data().pseudo : 'ton partenaire';
        const pAvatar = partnerDoc.exists() ? (partnerDoc.data().avatarUrl || null) : null;
        useOnboardingStore.getState().setSynced(true);
        useOnboardingStore.getState().setPartnerCache(data.linkedTo, pName, pAvatar);
        router.replace('/onboarding/date');
        return;
      }
    });

    return () => unsub();
  }, [setMyCode, success]);

  const handleCopy = async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      const shareUrl = Platform.OS === 'web' 
        ? `${window.location.origin}/onboarding/sync?code=${myCode}`
        : `nousdeux://sync?code=${myCode}`;

      await Share.share({
        message: `Rejoins-moi sur NousDeux ! Clique sur ce lien pour lier nos comptes : ${shareUrl}`,
      });
    } catch (error: any) {
      setModalState({
        visible: true,
        type: 'error',
        title: 'Erreur de partage',
        message: error?.message || 'Impossible de partager le code pour le moment.',
      });
    }
  };

  const handleLink = async () => {
    const codeToSearch = partnerCode.trim().toUpperCase();
    setErrorMessage('');
    if (codeToSearch.length === 6 && !loading) {
      isLinking.current = true;
      setLoading(true);
      try {
        const state = useOnboardingStore.getState();
        const myUid = state.uid || auth?.currentUser?.uid;
        if (!state.uid && myUid) {
          useOnboardingStore.getState().setUid(myUid);
        }

        if (!myUid) {
          const msg = "Vous n'êtes pas connecté. Reconnectez-vous puis réessayez.";
          setErrorMessage(msg);
          setModalState({ visible: true, type: 'auth', title: 'Non connecté', message: msg });
          setLoading(false);
          isLinking.current = false;
          return;
        }

        // 1. Chercher le code dans pairing_codes avec timeout pour éviter les blocages réseau
        let partnerUid: string | null = null;
        try {
          const fetchCode = getDoc(doc(db, "pairing_codes", codeToSearch));
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout réseau Firebase")), 4000));
          const codeDoc = await Promise.race([fetchCode, timeout]) as any;

          if (codeDoc && codeDoc.exists()) {
            partnerUid = codeDoc.data()?.creatorUid || null;
          }
        } catch (e) {
          console.warn('Erreur recherche pairing_codes:', e);
        }

        // 1b. Fallback ultra-résilient : si introuvable dans pairing_codes,
        // chercher directement dans 'users' où pairingCode == codeToSearch
        if (!partnerUid) {
          try {
            const q = query(collection(db, 'users'), where('pairingCode', '==', codeToSearch), limit(1));
            const userDocs = await getDocs(q);
            if (!userDocs.empty) {
              partnerUid = userDocs.docs[0].id;
              // Auto-réparation immédiate de pairing_codes
              await setDoc(doc(db, 'pairing_codes', codeToSearch), {
                creatorUid: partnerUid,
                createdAt: new Date(),
              }, { merge: true }).catch(() => {});
            }
          } catch (e) {
            console.warn('Erreur fallback recherche users:', e);
          }
        }

        if (!partnerUid) {
          const msg = "Ce code n'existe pas ou a expiré.";
          setErrorMessage(msg);
          setModalState({
            visible: true,
            type: 'sync',
            title: 'Code introuvable',
            message: "Ce code de synchronisation n'existe pas ou a expiré. Demande à ton partenaire de vérifier son code à 6 caractères.",
          });
          setLoading(false);
          isLinking.current = false;
          return;
        }

        if (partnerUid === myUid) {
          const msg = "Tu ne peux pas te synchroniser avec toi-même ! Ce code appartient à ton propre compte. Demande à ton partenaire de t'envoyer son propre code de synchronisation.";
          setErrorMessage(msg);
          setModalState({
            visible: true,
            type: 'self_pairing',
            title: 'Code personnel',
            message: msg,
          });
          setLoading(false);
          isLinking.current = false;
          return;
        }

        const myDoc = await getDoc(doc(db, 'users', myUid));
        const partnerDoc = await getDoc(doc(db, 'users', partnerUid));

        // Garde défensive : les deux documents utilisateur DOIVENT exister
        if (!myDoc.exists() || !partnerDoc.exists()) {
          const missing = !myDoc.exists() ? 'ton compte' : 'le compte du partenaire';
          const msg = `Impossible de lier : ${missing} n'a pas été trouvé dans la base. Reconnecte-toi ou demande à ton partenaire de se reconnecter.`;
          setErrorMessage(msg);
          setModalState({
            visible: true,
            type: 'error',
            title: 'Compte introuvable',
            message: msg,
          });
          setLoading(false);
          isLinking.current = false;
          return;
        }

        const myData = myDoc.data();
        const partnerData = partnerDoc.data();

        // Empêcher de lier un utilisateur déjà en couple
        if (partnerData.linkedTo && partnerData.linkedTo !== myUid) {
          const msg = "Cette personne est déjà en couple avec un autre utilisateur.";
          setErrorMessage(msg);
          setModalState({
            visible: true,
            type: 'already_linked',
            title: 'Partenaire déjà en couple',
            message: "Ce partenaire est déjà associé à un autre compte. Il doit d'abord se désynchroniser.",
          });
          setLoading(false);
          isLinking.current = false;
          return;
        }
        if (myData.linkedTo && myData.linkedTo !== partnerUid) {
          const msg = "Tu es déjà en couple. Rends-toi dans les Réglages pour te désynchroniser d'abord.";
          setErrorMessage(msg);
          setModalState({
            visible: true,
            type: 'warning',
            title: 'Déjà en couple',
            message: msg,
          });
          setLoading(false);
          isLinking.current = false;
          return;
        }

        // Sécurité primordiale : si l'un des deux se remet avec une autre personne,
        // suppression complète de tous les messages et données de l'ancien couple
        // AVANT MÊME de finaliser la connexion !
        if (myData.lastPartner && myData.lastPartner !== partnerUid) {
          const oldCoupleId = [myUid, myData.lastPartner].sort().join('_');
          await resetCoupleData(oldCoupleId);
        }
        if (partnerData.lastPartner && partnerData.lastPartner !== myUid) {
          const oldPartnerCoupleId = [partnerUid, partnerData.lastPartner].sort().join('_');
          await resetCoupleData(oldPartnerCoupleId);
        }

        const samePreviousPair = myData.lastPartner === partnerUid && partnerData.lastPartner === myUid;
        const coupleId = [myUid, partnerUid].sort().join('_');
        if (!samePreviousPair) {
          await resetCoupleData(coupleId);
        }

        // 2. Lier les comptes et forcer le passage par la page date avec reset total
        const nowIso = new Date().toISOString();
        const effectiveLinkedAt = (samePreviousPair && (myData.previousLinkedAt || partnerData.previousLinkedAt))
          ? (myData.previousLinkedAt || partnerData.previousLinkedAt)
          : nowIso;

        // Utilisation de set(merge:true) au lieu de update() pour éviter
        // l'erreur "No document to update" si un document est supprimé
        // entre la vérification et l'écriture (race condition)
        const linkBatch = writeBatch(db);
        linkBatch.set(doc(db, "users", myUid!), {
          linkedTo: partnerUid,
          needsDate: true,
          lastPartner: partnerUid,
          linkedAt: effectiveLinkedAt,
        }, { merge: true });
        linkBatch.set(doc(db, "users", partnerUid), {
          linkedTo: myUid,
          needsDate: true,
          lastPartner: myUid,
          linkedAt: effectiveLinkedAt,
        }, { merge: true });
        await linkBatch.commit();
        // Supprimer les champs obsolètes séparément (deleteField ne fonctionne
        // pas avec set+merge dans un batch car il nécessite un update)
        const cleanupBatch = writeBatch(db);
        cleanupBatch.update(doc(db, "users", myUid!), {
          coupleDate: deleteField(),
          proposedDate: deleteField(),
        });
        cleanupBatch.update(doc(db, "users", partnerUid), {
          coupleDate: deleteField(),
          proposedDate: deleteField(),
        });
        await cleanupBatch.commit().catch(() => {
          // Non bloquant : les champs seront écrasés par la page date
        });
        // Cosmetic ownership is personal. Re-pairing must not reset the
        // account's equipped items; the new partner reads this profile.
        state.setPartnerCache(null, '', null);

        // Succès garanti APRÈS la confirmation du serveur !
        const partnerDocFetched = await getDoc(doc(db, "users", partnerUid));
        const pPseudo = partnerDocFetched.exists() ? partnerDocFetched.data().pseudo : '';
        const pAvatar = partnerDocFetched.exists() ? (partnerDocFetched.data().avatarUrl || null) : null;
        state.setSynced(true);
        state.setPartnerCache(partnerUid, pPseudo, pAvatar);
        // Redirection directe vers l'écran de sélection de la date de couple
        router.replace('/onboarding/date');
        return;

      } catch (error: any) {
        const isNet = error?.message?.includes('Timeout') || error?.message?.includes('réseau') || error?.code === 'unavailable';
        const msg = `Erreur de connexion : ${error?.message ?? 'Vérifie ta connexion internet puis réessaie.'}`;
        setErrorMessage(msg);
        setModalState({
          visible: true,
          type: isNet ? 'network' : 'error',
          title: isNet ? 'Problème de connexion' : 'Erreur',
          message: isNet ? "Impossible de contacter le serveur. Vérifie ton réseau et réessaie." : (error?.message || "Une erreur est survenue lors de la synchronisation."),
        });
        setLoading(false);
        isLinking.current = false;
      }
    } else if (codeToSearch.length !== 6) {
      const msg = "Le code doit faire exactement 6 caractères.";
      setErrorMessage(msg);
      setModalState({
        visible: true,
        type: 'warning',
        title: 'Code incomplet',
        message: msg,
      });
    }
  };

  if (success) {
    return (
      <ImageBackground source={backgroundSource} style={styles.container} resizeMode="cover">
        {store.isDarkMode && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)', zIndex: 0 }} pointerEvents="none" />
        )}
        <View style={[styles.successContent, { flex: 1, justifyContent: 'center', padding: 20 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 40, gap: 15 }}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.tint, position: 'relative', left: 0 }]}>
              {myAvatar ? (
                <Image source={{ uri: myAvatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.avatarText}>{useOnboardingStore.getState().pseudo?.charAt(0) || "M"}</Text>
              )}
            </View>
            
            <HeartHandshake color={theme.gradientEnd} size={50} />
            
            <View style={[styles.avatarCircle, { backgroundColor: theme.gradientEnd, position: 'relative', right: 0 }]}>
              {partnerAvatar ? (
                <Image source={{ uri: partnerAvatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.avatarText}>{partnerName?.charAt(0) || "P"}</Text>
              )}
            </View>
          </View>

          <Text style={[styles.successTitle, { color: theme.text }]}>
            Synchronisé !
          </Text>
          <Text style={[styles.successSubtitle, { color: theme.text }]}>
            Ton compte est maintenant lié à {partnerName} ❤️
          </Text>

          <View style={{ marginTop: 40, width: '100%' }}>
            <Pressable 
              style={({ pressed }) => [styles.linkButton, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}
              onPress={() => router.replace('/onboarding/date')}
            >
              <Text style={styles.linkButtonText}>Continuer</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundSource} style={styles.container} resizeMode="cover">
      {store.isDarkMode && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)', zIndex: 0 }} pointerEvents="none" />
      )}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        enabled={Platform.OS !== 'web'} 
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 10 }]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.backBtn} onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else if (store.pseudo && store.age) {
                router.replace('/dashboard');
              } else {
                router.replace('/onboarding/avatar');
              }
            }}>
              <ArrowLeft color={theme.text} size={28} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.skipHeaderBtn,
                {
                  borderColor: theme.tint,
                  backgroundColor: store.isDarkMode ? 'rgba(42, 26, 26, 0.85)' : 'rgba(255, 255, 255, 0.92)',
                  opacity: pressed ? 0.8 : 1,
                }
              ]}
              onPress={() => router.replace('/dashboard')}
              accessibilityLabel="Se synchroniser plus tard en mode solo"
            >
              <Compass color={theme.tint} size={18} />
              <Text style={[styles.skipHeaderBtnText, { color: theme.tint }]}>
                Passer (Mode Solo) ➔
              </Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            <Animated.View entering={FadeInDown.duration(800)}>
              <Text style={[styles.title, { color: theme.text }]}>Synchronisation</Text>
              <Text style={[styles.subtitle, { color: theme.text }]}>
                Donne ton code à ton partenaire ou entre le sien pour lier vos téléphones.
              </Text>
            </Animated.View>

            {/* Mon Code */}
            <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.codeContainer}>
              <Pressable 
                style={[styles.codeBox, { borderColor: theme.tint, backgroundColor: theme.glassBackground }]}
                onPress={handleCopy}
              >
                {myCode ? (
                  <Text style={[styles.codeText, { color: theme.text }]}>{myCode}</Text>
                ) : (
                  <Text style={[styles.codeText, { color: theme.tabIconDefault, fontSize: 24 }]}>Génération…</Text>
                )}
                {copied ? <CheckCircle2 color="green" size={24} /> : <Copy color={theme.tint} size={24} />}
              </Pressable>
              <Pressable 
                style={[styles.shareButton, { backgroundColor: theme.gradientEnd }]} 
                onPress={handleShare}
              >
                <Share2 color="white" size={20} />
                <Text style={styles.shareText}>Partager mon code</Text>
              </Pressable>
            </Animated.View>

            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: theme.tint, opacity: 0.2 }]} />
              <Text style={[styles.orText, { color: theme.text }]}>OU</Text>
              <View style={[styles.line, { backgroundColor: theme.tint, opacity: 0.2 }]} />
            </View>

            {/* Code du partenaire */}
            <Animated.View entering={FadeInUp.duration(800).delay(400)}>
              <Text style={[styles.label, { color: theme.text }]}>Code de ton partenaire</Text>
              <TextInput 
                style={[styles.input, { color: theme.text, borderColor: theme.tint, backgroundColor: theme.glassBackground }]} 
                placeholder="XXXXXX"
                placeholderTextColor="#A99693"
                maxLength={6}
                autoCapitalize="characters"
                value={partnerCode}
                onChangeText={(t) => setPartnerCode(t.toUpperCase())}
                returnKeyType="done"
                onSubmitEditing={handleLink}
                onKeyPress={(e: any) => {
                  if (e.nativeEvent.key === 'Enter') handleLink();
                }}
              />
              <Pressable 
                style={({ pressed }) => [
                  styles.linkButton, 
                  { backgroundColor: partnerCode.length === 6 ? theme.tint : '#A99693', opacity: pressed ? 0.8 : 1 }
                ]} 
                onPress={handleLink}
                disabled={loading}
              >
                <Text style={styles.linkButtonText}>{loading ? 'Liaison en cours...' : 'Lier les comptes'}</Text>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  container: { flex: 1, width: '100%', backgroundColor: 'transparent' }, // Warm fallback: #FFF5F2
  safeBackgroundFallback: { backgroundColor: '#FFF5F2' },
  backgroundImage: { width: '100%', height: '100%' },
  keyboardView: { flex: 1, width: '100%', maxWidth: 500, alignSelf: 'center' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 14, justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, marginBottom: 8 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 20 },
  skipHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  skipHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  content: { flexGrow: 1, justifyContent: 'center', paddingBottom: 14 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, opacity: 0.7, textAlign: 'center', marginBottom: 14, lineHeight: 20 },

  hintText: { fontSize: 12, textAlign: 'center', marginBottom: 10, opacity: 0.8 },
  codeContainer: { alignItems: 'center', marginBottom: 12 },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderStyle: 'solid', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 18, marginBottom: 12 },
  codeText: { fontSize: 32, fontWeight: '900', letterSpacing: 6 },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 16, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8 },
  shareText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  line: { flex: 1, height: 1 },
  orText: { paddingHorizontal: 12, fontSize: 13, fontWeight: 'bold', opacity: 0.5 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  input: { borderWidth: 1, padding: 12, borderRadius: 14, fontSize: 22, textAlign: 'center', letterSpacing: 6, fontWeight: 'bold', marginBottom: 12, outlineStyle: 'none' as any },
  linkButton: { padding: 14, borderRadius: 14, alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8 },
  linkButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  skipCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  skipCardButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: { marginBottom: 14, padding: 12, borderRadius: 12, textAlign: 'center', lineHeight: 20 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  successContent: { flex: 1, justifyContent: 'center', padding: 20, width: '100%', maxWidth: 500, alignSelf: 'center' },
  successIconWrapper: { padding: 30, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 100, marginBottom: 30, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  successTitle: { fontSize: 36, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  successSubtitle: { fontSize: 18, opacity: 0.8, textAlign: 'center' },
  animationContainer: { height: 150, width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  avatarText: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  heartContainer: { position: 'absolute', width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  heartBurst: { position: 'absolute', width: '100%', height: '100%', borderRadius: 50, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 15 }
});
