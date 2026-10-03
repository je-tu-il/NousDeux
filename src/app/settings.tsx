import { Colors } from '@/constants/Colors';
import { getCosmeticById, getCosmeticImage } from '@/data/cosmetics';
import { auth, db } from '@/lib/firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import * as ImagePicker from 'expo-image-picker';
import { Link, router } from 'expo-router';
import { arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { deleteUser, GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup, signOut } from 'firebase/auth';
import { ArrowLeft, Camera, Check, CheckCircle2, Copy, FileText, HeartCrack, LogOut, Mail, Shield, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { isUserAdmin } from '@/constants/admins';
import UIModal, { UIModalType } from '@/components/UIModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import AvatarPickerModal from '@/components/AvatarPickerModal';
import { takePhotoWithCamera, pickImageFromGallery } from '@/lib/avatarPicker';
import { useTopInset } from '@/hooks/useTopInset';

// Durée du debounce pour pseudo/age (ms)
const DEBOUNCE_DELAY = 1000;
const MAX_PSEUDO_LENGTH = 18;

export default function SettingsScreen() {
  const store = useOnboardingStore((state) => state);
  const { width: windowWidth } = useWindowDimensions();
  const topInset = useTopInset();
  // ✅ FIX CRITIQUE : utiliser le bon thème selon isDarkMode
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const styles = getStyles(theme, windowWidth);

  const [pseudo, setPseudo] = useState(store.pseudo.slice(0, MAX_PSEUDO_LENGTH));
  const [age, setAge] = useState(store.age);
  const [avatar, setAvatar] = useState(store.avatar);
  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type?: UIModalType;
    title?: string;
    message?: string;
  }>({ visible: false });

  // Indicateur de sauvegarde visible dans l'UI
  const [savedIndicator, setSavedIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [showDesyncModal, setShowDesyncModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isAlone, setIsAlone] = useState(!store.uid || !store.partnerUid);
  const [copied, setCopied] = useState(false);
  const [authUid, setAuthUid] = useState(auth.currentUser?.uid ?? null);
  const [authReady, setAuthReady] = useState(Boolean(auth.currentUser));

  // Ref pour le debounce pseudo/age
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onAuthStateChanged(auth, user => {
    setAuthUid(user?.uid ?? null);
    setAuthReady(true);
  }), []);

  useEffect(() => {
    if (!store.uid) return;
    const unsub = onSnapshot(doc(db, 'users', store.uid), (docSnap) => {
      if (docSnap.exists()) {
        const uData = docSnap.data();
        const linkedTo = uData.linkedTo;
        setIsAlone(typeof linkedTo !== 'string' || linkedTo.length === 0);
        if (uData.pairingCode && store.myCode !== uData.pairingCode) {
          store.setMyCode(uData.pairingCode);
        }
      } else {
        setIsAlone(true);
      }
    }, () => {
      // En cas d'erreur réseau transitoire, fallback sur le cache Zustand
      setIsAlone(!store.partnerUid);
    });
    return () => unsub();
  }, [store.uid, store.partnerUid, store.myCode]);

  // ── Sauvegarder dans Firebase (réutilisable) ─────────────────────────────
  const saveToFirebase = useCallback(async (fields: { pseudo?: string; age?: string; avatarUrl?: string | null }) => {
    if (!store.uid) return;
    setSavedIndicator('saving');
    try {
      await updateDoc(doc(db, 'users', store.uid), fields);
      if (fields.pseudo !== undefined) store.setPseudo(fields.pseudo);
      if (fields.age !== undefined) store.setAge(fields.age);
      if (fields.avatarUrl !== undefined) store.setAvatar(fields.avatarUrl ?? null);
      setSavedIndicator('saved');
      setTimeout(() => setSavedIndicator('idle'), 2000);
    } catch (err: any) {
      setSavedIndicator('idle');
      setModalState({
        visible: true,
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: err.message || 'Impossible d\'enregistrer les modifications.',
      });
    }
  }, [store]);

  // ── Autosave pseudo avec debounce ────────────────────────────────────────
  const handlePseudoChange = (value: string) => {
    const limitedValue = value.slice(0, MAX_PSEUDO_LENGTH);
    setPseudo(limitedValue);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!limitedValue.trim()) return;
    debounceTimer.current = setTimeout(() => {
      saveToFirebase({ pseudo: limitedValue.trim() });
    }, DEBOUNCE_DELAY);
  };

  // ── Autosave age avec debounce ───────────────────────────────────────────
  const handleAgeChange = (value: string) => {
    setAge(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!value.trim()) return;
    debounceTimer.current = setTimeout(() => {
      saveToFirebase({ age: value.trim() });
    }, DEBOUNCE_DELAY);
  };

  const submitPseudo = () => {
    Keyboard.dismiss();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (pseudo.trim()) {
      saveToFirebase({ pseudo: pseudo.trim() });
    }
  };

  const submitAge = () => {
    Keyboard.dismiss();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (age.trim()) {
      saveToFirebase({ age: age.trim() });
    }
  };

  // ── Changer la photo — appareil photo ou galerie avec suppression des métadonnées ────────
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  const handlePhotoPicked = async (cleanDataUri: string) => {
    setAvatar(cleanDataUri);
    await saveToFirebase({ avatarUrl: cleanDataUri });
  };

  const handleTakePhoto = async () => {
    const res = await takePhotoWithCamera();
    if (!res.success) {
      if (res.permissionDenied) {
        setModalState({
          visible: true,
          type: 'permission',
          title: 'Accès appareil photo requis',
          message: "Nous avons besoin de la permission d'accès à votre appareil photo pour vous prendre en photo.",
        });
      }
      return;
    }
    await handlePhotoPicked(res.dataUri);
  };

  const handlePickGallery = async () => {
    const res = await pickImageFromGallery();
    if (!res.success) {
      if (res.permissionDenied) {
        setModalState({
          visible: true,
          type: 'permission',
          title: 'Accès photos requis',
          message: "Nous avons besoin de la permission d'accès à vos photos pour changer votre photo de profil.",
        });
      }
      return;
    }
    await handlePhotoPicked(res.dataUri);
  };

  const handleRemoveAvatar = async () => {
    setAvatar(null);
    store.setAvatar(null);
    await saveToFirebase({ avatarUrl: null });
  };

  // ── Désynchronisation ────────────────────────────────────────────────────
  const processDesync = async () => {
    setLoading(true);
    try {
      if (!store.uid) return;
      const myDoc = await getDoc(doc(db, 'users', store.uid));
      if (myDoc.exists()) {
        const data = myDoc.data();
        const partnerUid = data.linkedTo;

        if (partnerUid) {
          const partnerDoc = await getDoc(doc(db, 'users', partnerUid));
          const leaveBatch = writeBatch(db);
          const previousLinkedAt = data.linkedAt || null;
          leaveBatch.update(doc(db, 'users', store.uid), {
            linkedTo: deleteField(),
            linkedAt: deleteField(),
            previousLinkedAt,
            lastPartner: partnerUid,
            lastPartnerAt: new Date().toISOString(),
            coupleDate: deleteField(),
            proposedDate: deleteField(),
            needsDate: deleteField(),
            archivedPartners: arrayUnion(partnerUid),
          });
          if (partnerDoc.exists() && partnerDoc.data().linkedTo === store.uid) {
            leaveBatch.update(doc(db, 'users', partnerUid), {
              linkedTo: deleteField(),
              linkedAt: deleteField(),
              previousLinkedAt: partnerDoc.data().linkedAt || previousLinkedAt,
              lastPartner: store.uid,
              lastPartnerAt: new Date().toISOString(),
              coupleDate: deleteField(),
              proposedDate: deleteField(),
              needsDate: deleteField(),
              archivedPartners: arrayUnion(store.uid),
            });
          }
          await leaveBatch.commit();
        } else {
          await updateDoc(doc(db, 'users', store.uid), {
            linkedTo: null, coupleDate: null, proposedDate: null,
          });
        }
        store.setSynced(false);
        store.setPartnerCode('');
        store.clearPartnerCache();
        setShowDesyncModal(false);
        router.replace('/dashboard');
      }
    } catch (error: any) {
      setModalState({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Impossible de vous désynchroniser pour le moment.',
      });
      setLoading(false);
    }
  };

  // ── Suppression du compte ────────────────────────────────────────────────
  const processDeleteAccount = async () => {
    setLoading(true);
    try {
      if (!store.uid) {
        setShowDeleteModal(false);
        router.replace('/onboarding/login');
        return;
      }
      const firebaseUser = auth.currentUser;
      const lastSignIn = firebaseUser?.metadata.lastSignInTime
        ? Date.parse(firebaseUser.metadata.lastSignInTime)
        : 0;
      const recentLogin = lastSignIn > Date.now() - 5 * 60 * 1000;
      if (firebaseUser?.providerData.some(provider => provider.providerId === 'google.com') && !recentLogin) {
        await reauthenticateWithPopup(firebaseUser, new GoogleAuthProvider());
      }

      // 1. Récupérer le partnerUid avant suppression
      const myDoc = await getDoc(doc(db, 'users', store.uid));
      const partnerUid = myDoc.exists() ? myDoc.data().linkedTo : null;

      // 2. Supprimer toutes les données du couple (droit à l'oubli RGPD)
      if (partnerUid) {
        const coupleKey = [store.uid, partnerUid].sort().join('_');
        const coupleRef = doc(db, 'couples', coupleKey);

        // Supprimer les sous-collections connues par batch
        const subcollections = ['daily', 'progress'];
        for (const sub of subcollections) {
          const subCol = collection(db, 'couples', coupleKey, sub);
          const snap = await getDocs(subCol);
          if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
        await deleteDoc(coupleRef);
      }

      // 3. Désolidariser le partenaire et supprimer le profil courant
      // dans la même opération atomique.
      const deleteBatch = writeBatch(db);
      if (partnerUid) {
        const partnerDoc = await getDoc(doc(db, 'users', partnerUid));
        if (partnerDoc.exists() && partnerDoc.data().linkedTo === store.uid) {
          deleteBatch.update(doc(db, 'users', partnerUid), {
            linkedTo: deleteField(),
            coupleDate: deleteField(),
            proposedDate: deleteField(),
          });
        }
      }
      deleteBatch.delete(doc(db, 'users', store.uid));
      deleteBatch.delete(doc(db, 'userProfiles', store.uid));
      if (store.myCode) {
        deleteBatch.delete(doc(db, 'pairing_codes', store.myCode));
      }
      await deleteBatch.commit();

      if (Platform.OS !== 'web') {
        try {
          const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
          await GoogleSignin.signOut().catch(() => {});
        } catch {}
      }

      if (firebaseUser) {
        await deleteUser(firebaseUser).catch(async () => {
          await signOut(auth).catch(() => {});
        });
      }
      await signOut(auth).catch(() => {});

      // 4. Réinitialiser le store local
      store.resetSession();
      setShowDeleteModal(false);
      router.replace('/onboarding/login');
    } catch (error: any) {
      if (error?.code === 'auth/requires-recent-login') {
        setModalState({
          visible: true,
          type: 'auth',
          title: 'Confirmation requise',
          message: 'Google doit confirmer ton identité avant la suppression. Déconnecte-toi puis reconnecte-toi, et recommence.',
        });
      } else {
        setModalState({
          visible: true,
          type: 'error',
          title: 'Erreur',
          message: error.message || 'Une erreur est survenue lors de la suppression.',
        });
      }
      setLoading(false);
    }
  };

  const generateNewCode = async () => {
    if (!store.uid) return;
    setLoading(true);
    try {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await setDoc(doc(db, 'pairing_codes', newCode), {
        creatorUid: store.uid,
        createdAt: new Date(),
      });
      await setDoc(doc(db, 'users', store.uid), {
        pairingCode: newCode,
      }, { merge: true });
      store.setMyCode(newCode);
      setModalState({
        visible: true,
        type: 'success',
        title: 'Nouveau code généré',
        message: `Ton nouveau code de partage est : ${newCode}`,
      });
    } catch (err: any) {
      setModalState({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: err.message || 'Impossible de générer un nouveau code.',
      });
    }
    setLoading(false);
  };

  // ── Déconnexion (efface l'état local sans supprimer les données) ──────────
  const handleDisconnect = () => setShowDisconnectModal(true);

  const disconnect = async () => {
      try {
        if (Platform.OS !== 'web') {
          try {
            const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
            await GoogleSignin.signOut().catch(() => {});
          } catch {}
        }
        await signOut(auth);
      } catch (error: any) {
        setModalState({
          visible: true,
          type: 'error',
          title: 'Erreur de déconnexion',
          message: error?.message ?? 'Impossible de se déconnecter.',
        });
        return;
      }
      store.resetSession();
      router.replace('/onboarding/login');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const bgCosmetic = store.selectedBackground ? getCosmeticById(store.selectedBackground) : null;
  const defaultBg = store.isDarkMode
    ? require('../../assets/images/nousdeux_dark_background.png')
    : require('../../assets/images/nousdeux_warm_background.png');
  const bgImage = getCosmeticImage(bgCosmetic, store.isDarkMode) || defaultBg;

  return (
    <ImageBackground source={bgImage} style={styles.container} resizeMode="cover" imageStyle={{ objectPosition: windowWidth < 600 ? 'center bottom' : 'center' } as any}>

      {/* Overlay pour lisibilité en dark mode */}
      {store.isDarkMode && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)', zIndex: 0 }} pointerEvents="none" />
      )}
      <View style={{ flex: 1 }}>
        {/* Header fixé au-dessus du scroll avec topInset */}
        <View style={[styles.headerFixedContainer, { paddingTop: topInset + 8 }]}>
          <View style={styles.header}>
            <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')} style={styles.backButton}>
              <ArrowLeft color={theme.text} size={28} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>Paramètres</Text>

            {/* Indicateur de sauvegarde */}
            <View style={styles.saveIndicator}>
              {savedIndicator === 'saving' && (
                <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.saveChip}>
                  <ActivityIndicator size="small" color={theme.tint} />
                  <Text style={[styles.saveChipText, { color: theme.tint }]}>Sauvegarde...</Text>
                </Animated.View>
              )}
              {savedIndicator === 'saved' && (
                <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.saveChip, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                  <Check color="#22c55e" size={16} />
                  <Text style={[styles.saveChipText, { color: '#22c55e' }]}>Sauvegardé</Text>
                </Animated.View>
              )}
            </View>
          </View>
        </View>

        <ScrollView style={styles.safeArea} contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }} showsVerticalScrollIndicator={false}>

          {/* Formulaire Profil */}
          <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Mon Profil</Text>

            <View style={[styles.card, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder, alignItems: 'center' }]}>

              {/* Photo de profil — avec choix appareil photo / galerie / suppression */}
              <Pressable style={[styles.avatarWrapper, { borderColor: theme.tint }]} onPress={() => setAvatarPickerVisible(true)}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Camera color={theme.tint} size={30} />
                </View>
              )}
              {/* Badge "modifier" */}
              <View style={[styles.cameraOverlay, { backgroundColor: theme.tint }]}>
                <Camera color="white" size={14} />
              </View>
            </Pressable>
            <Text style={styles.changePhotoText}>Appuie pour changer</Text>

            {auth.currentUser?.email && (
              <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: store.isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }}>
                <Text style={{ fontSize: 12, color: theme.tabIconDefault }}>Compte Google : <Text style={{ fontWeight: '600', color: theme.text }}>{auth.currentUser.email}</Text></Text>
              </View>
            )}

            <View style={{ width: '100%', marginTop: 20 }}>

              {/* Pseudo — autosave après 1s sans frappe */}
              <Text style={[styles.label, { color: theme.text }]}>Pseudo</Text>
              <TextInput
                style={styles.input}
                value={pseudo}
                onChangeText={handlePseudoChange}
                maxLength={MAX_PSEUDO_LENGTH}
                placeholder="Ton pseudo"
                placeholderTextColor={theme.tabIconDefault}
                returnKeyType="done"
                onSubmitEditing={submitPseudo}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Enter') {
                    submitPseudo();
                  }
                }}
              />
              <Text style={[styles.inputHint, { color: theme.tabIconDefault }]}>
                {pseudo.length}/{MAX_PSEUDO_LENGTH} caractères maximum
              </Text>

              {/* Âge — autosave après 1s sans frappe */}
              <Text style={[styles.label, { color: theme.text }]}>Âge</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={handleAgeChange}
                keyboardType="numeric"
                placeholder="Ton âge"
                placeholderTextColor={theme.tabIconDefault}
                returnKeyType="done"
                onSubmitEditing={submitAge}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Enter') {
                    submitAge();
                  }
                }}
              />

              {isAlone && (
                <Animated.View entering={FadeInUp} style={{ marginTop: 25, width: '100%', alignItems: 'center' }}>
                  {store.myCode ? (
                    <View style={styles.codeBox}>
                      <Text style={[styles.label, { color: theme.text, textAlign: 'center', marginBottom: 15 }]}>
                        Ton code de partage
                      </Text>
                      <Pressable
                        style={[styles.codeDisplay, { borderColor: theme.tint, backgroundColor: theme.glassBackground }]}
                        onPress={async () => {
                          const Clipboard = await import('expo-clipboard');
                          await Clipboard.setStringAsync(store.myCode!);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        <Text style={[styles.codeText, { color: theme.text }]}>{store.myCode}</Text>
                        {copied ? <CheckCircle2 color="green" size={24} /> : <Copy color={theme.tint} size={24} />}
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.card, opacity: pressed || loading ? 0.8 : 1 }]}
                      onPress={generateNewCode}
                      disabled={loading}
                    >
                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Régénérer mon code de partage</Text>
                    </Pressable>
                  )}
                </Animated.View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Déconnexion */}
        <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.disconnectButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleDisconnect}
          >
            <LogOut color="white" size={20} />
            <Text style={styles.disconnectText}>Se déconnecter</Text>
          </Pressable>
        </Animated.View>

        {/* Préférences */}
        <Animated.View entering={FadeInUp.duration(600).delay(240)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Préférences</Text>
          <View style={[styles.card, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder, gap: 15 }]}>
            
            {/* Dark Mode Toggle — animé */}
            <DarkModeToggle isDark={store.isDarkMode} onToggle={() => store.setDarkMode(!store.isDarkMode)} theme={theme} styles={styles} />

            {/* Admin Panel Link - Only visible to admins */}
            {(isUserAdmin(authUid) || isUserAdmin(store.uid)) && (
              <>
                <View style={styles.divider} />
                <Link href="/admin" asChild>
                  <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.supportIcon, { backgroundColor: 'rgba(234,179,8,0.15)' }]}>
                        <Text style={{ fontSize: 20 }}>⚙️</Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Panel Administrateur</Text>
                    </View>
                    <Text style={{ color: '#C4B4B2', fontSize: 18 }}>›</Text>
                  </Pressable>
                </Link>
              </>
            )}

          </View>
        </Animated.View>

        {/* Contact & Support */}
        <Animated.View entering={FadeInUp.duration(600).delay(280)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Support</Text>
          <View style={[styles.card, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder, gap: 12 }]}>
            <Link href="/contact" asChild>
              <Pressable style={styles.supportRow}>
                <View style={[styles.supportIcon, { backgroundColor: 'rgba(255,154,139,0.15)' }]}>
                  <Mail color={theme.tint} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.supportTitle, { color: theme.text }]}>Formulaire de contact</Text>
                  <Text style={styles.supportSub}>Bug, suggestion, question…</Text>
                </View>
                <Text style={{ color: '#C4B4B2', fontSize: 18 }}>›</Text>
              </Pressable>
            </Link>
          </View>
        </Animated.View>

        {/* Zone Danger */}
        <Animated.View entering={FadeInUp.duration(600).delay(300)} style={styles.section}>

          <Text style={[styles.sectionTitle, { color: 'red' }]}>Zone Danger</Text>

          <View style={[styles.card, { backgroundColor: 'rgba(255,200,200,0.7)', borderColor: 'red' }]}>

            {!isAlone && (
              <>
                <View style={styles.dangerItem}>
                  <Text style={{ color: '#444', marginBottom: 15, textAlign: 'center' }}>
                    En quittant le couple, vous serez désynchronisés. Ton partenaire sera archivé pour conserver vos succès.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.dangerButton, { opacity: pressed || loading ? 0.8 : 1 }]}
                    onPress={() => setShowDesyncModal(true)}
                    disabled={loading}
                  >
                    <HeartCrack color="white" size={20} />
                    <Text style={styles.dangerButtonText}>Quitter le couple</Text>
                  </Pressable>
                </View>
                <View style={styles.divider} />
              </>
            )}

            <View style={styles.dangerItem}>
              <Text style={{ color: '#444', marginBottom: 15, textAlign: 'center' }}>
                Cette action supprimera définitivement toutes tes données personnelles et tes réponses (conformément au RGPD).
              </Text>
              <Pressable
                style={({ pressed }) => [styles.dangerButton, { backgroundColor: '#8B0000', opacity: pressed || loading ? 0.8 : 1 }]}
                onPress={() => setShowDeleteModal(true)}
                disabled={loading}
              >
                <Trash2 color="white" size={20} />
                <Text style={styles.dangerButtonText}>Supprimer le compte</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Liens légaux */}
        <Animated.View entering={FadeInUp.duration(600).delay(400)} style={[styles.section, { alignItems: 'center', gap: 12 }]}>
          <Text style={{ color: '#A99693', fontSize: 12, marginBottom: 4 }}>Informations légales</Text>
            <Link href="/terms" style={[styles.legalLink, { backgroundColor: theme.glassBackground }]}>
              <FileText color={theme.text} size={14} />
              <Text style={[styles.legalLinkText, { color: theme.text }]}>Conditions Générales d’Utilisation</Text>
            </Link>
            <Link href="/privacy" style={[styles.legalLink, { backgroundColor: theme.glassBackground }]}>
              <Shield color={theme.text} size={14} />
              <Text style={[styles.legalLinkText, { color: theme.text }]}>Politique de Confidentialité</Text>
            </Link>
          <View style={{
            backgroundColor: store.isDarkMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.65)',
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: store.isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 154, 139, 0.25)',
            marginTop: 10,
          }}>
            <Text style={{ color: store.isDarkMode ? '#D4B8B4' : '#6B5B59', fontSize: 11, fontWeight: '600' }}>NousDeux v1.0.0 — © 2026</Text>
          </View>
        </Animated.View>
      </ScrollView>
      </View>

      <AvatarPickerModal
        visible={avatarPickerVisible}
        onClose={() => setAvatarPickerVisible(false)}
        onTakePhoto={handleTakePhoto}
        onPickGallery={handlePickGallery}
        onRemovePhoto={avatar ? handleRemoveAvatar : undefined}
        onSelectDataUri={handlePhotoPicked}
        hasPhoto={!!avatar}
      />

      {/* Modal Désynchronisation */}
      <Modal visible={showDisconnectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInUp.duration(300)} style={styles.modalContent}>
            <LogOut color={theme.tint} size={44} style={{ alignSelf: 'center', marginBottom: 15 }} />
            <Text style={styles.modalTitle}>Se déconnecter</Text>
            <Text style={styles.modalText}>Tes données sont conservées. Tu seras renvoyé à l’écran de connexion.</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowDisconnectModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={() => { setShowDisconnectModal(false); void disconnect(); }}>
                <Text style={styles.modalConfirmText}>Déconnecter</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal Désynchronisation */}
      <Modal visible={showDesyncModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInUp.duration(300)} style={styles.modalContent}>
            <HeartCrack color="#FF3B30" size={50} style={{ alignSelf: 'center', marginBottom: 15 }} />
            <Text style={styles.modalTitle}>Quitter le couple</Text>
            <Text style={styles.modalText}>
              Es-tu sûr de vouloir te désynchroniser ? Ton ancien partenaire sera archivé et vos données communes préservées, mais vous ne serez plus liés.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowDesyncModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={processDesync}>
                <Text style={styles.modalConfirmText}>Oui, quitter</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal Suppression Compte */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInUp.duration(300)} style={styles.modalContent}>
            <Trash2 color="#8B0000" size={50} style={{ alignSelf: 'center', marginBottom: 15 }} />
            <Text style={styles.modalTitle}>Supprimer le compte</Text>
            <Text style={styles.modalText}>
              Attention, cette action est irréversible. Ton compte et toutes tes données personnelles seront supprimés définitivement.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowDeleteModal(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: '#8B0000' }]} onPress={processDeleteAccount}>
                <Text style={styles.modalConfirmText}>Supprimer</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

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

// ── Composant Toggle Dark Mode Animé ─────────────────────────────────────────
function DarkModeToggle({ isDark, onToggle, theme, styles }: { isDark: boolean; onToggle: () => void; theme: any; styles: any }) {
  const thumbX = useSharedValue(isDark ? 20 : 0);

  useEffect(() => {
    thumbX.value = withTiming(isDark ? 20 : 0, {
      duration: 250,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [isDark]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[styles.supportIcon, { backgroundColor: isDark ? 'rgba(255,184,173,0.15)' : 'rgba(59,130,246,0.15)' }]}>
          <Text style={{ fontSize: 20 }}>{isDark ? '🌙' : '☀️'}</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Mode Sombre</Text>
      </View>
      <Pressable
        onPress={onToggle}
        style={{
          width: 52,
          height: 30,
          borderRadius: 15,
          backgroundColor: isDark ? '#FF9A8B' : '#E5E7EB',
          padding: 2,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: 'white',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 3,
            },
            thumbStyle,
          ]}
        />
      </Pressable>
    </View>
  );
}

// ── Styles adaptés au thème ───────────────────────────────────────────────────
const getStyles = (theme: any, windowWidth: number = 400) => StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', minHeight: '100vh' as any, backgroundColor: 'transparent' },
  bgImage: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  headerFixedContainer: {
    width: '100%',
    maxWidth: windowWidth >= 700 ? 680 : 500,
    alignSelf: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 10, width: '100%', maxWidth: windowWidth >= 700 ? 680 : 500, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.glassBackground, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800' },
  saveIndicator: { width: 110, alignItems: 'flex-end' },
  saveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,154,139,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  saveChipText: { fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginLeft: 10 },
  card: { padding: 20, borderRadius: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 5 },
  input: {
    height: 50,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.glassBackground,
    color: theme.text,
  },
  inputHint: { alignSelf: 'flex-end', fontSize: 12, marginTop: -14, marginBottom: 14 },
  avatarWrapper: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, overflow: 'visible', marginBottom: 6, position: 'relative' },
  avatarImage: { width: 110, height: 110, borderRadius: 55 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.glassBackground },
  cameraOverlay: { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  changePhotoText: { color: theme.tabIconDefault, fontSize: 13, marginBottom: 6 },
  actionButton: { flexDirection: 'row', height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, paddingHorizontal: 20, width: '100%' },
  actionButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  dangerItem: { paddingVertical: 10 },
  divider: { height: 1, backgroundColor: 'rgba(255,0,0,0.1)', marginVertical: 15 },
  dangerButton: { flexDirection: 'row', height: 50, borderRadius: 25, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, width: '100%', maxWidth: 300, alignSelf: 'center' },
  dangerButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: theme.card, padding: 30, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: theme.text, textAlign: 'center', marginBottom: 15 },
  modalText: { fontSize: 16, color: theme.text, textAlign: 'center', marginBottom: 30, opacity: 0.8, lineHeight: 24 },
  modalActions: { flexDirection: 'row', gap: 15 },
  modalCancel: { flex: 1, height: 50, borderRadius: 25, backgroundColor: theme.glassBackground, justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: 'bold', color: theme.text },
  modalConfirm: { flex: 1, height: 50, borderRadius: 25, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  modalConfirmText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  codeBox: { width: '100%', alignItems: 'center' },
  codeDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, borderWidth: 1.5, borderStyle: 'solid', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 20, maxWidth: '100%' },
  codeText: { fontSize: 26, fontWeight: '900', letterSpacing: 6, textAlign: 'center' },
  disconnectButton: {
    flexDirection: 'row', height: 50, borderRadius: 25,
    backgroundColor: '#FF8C00',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3, shadowRadius: 10, width: '100%', maxWidth: 300, alignSelf: 'center',
  },
  disconnectText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  legalLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  legalLinkText: { fontSize: 13, fontWeight: '600' },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 10 },
  supportIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  supportTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  supportSub: { fontSize: 13, color: theme.tabIconDefault },
});
