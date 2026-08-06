import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, Platform, ImageBackground, Alert, Image, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { router, Link } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { ArrowLeft, HeartCrack, Camera, Trash2, Copy, CheckCircle2, Check, LogOut, FileText, Shield } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, FadeOut } from 'react-native-reanimated';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion, setDoc, deleteField, collection, getDocs, writeBatch } from 'firebase/firestore';

// Durée du debounce pour pseudo/age (ms)
const DEBOUNCE_DELAY = 1000;

export default function SettingsScreen() {
  const theme = Colors.light;
  const store = useOnboardingStore((state) => state);

  const [pseudo, setPseudo] = useState(store.pseudo);
  const [age, setAge] = useState(store.age);
  const [avatar, setAvatar] = useState(store.avatar);
  const [loading, setLoading] = useState(false);

  // Indicateur de sauvegarde visible dans l'UI
  const [savedIndicator, setSavedIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [showDesyncModal, setShowDesyncModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isAlone, setIsAlone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ref pour le debounce pseudo/age
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Vérifier si l'utilisateur est seul ──────────────────────────────────
  useEffect(() => {
    const checkAlone = async () => {
      if (!store.uid) return;
      const myDoc = await getDoc(doc(db, 'users', store.uid));
      if (myDoc.exists()) {
        const linkedTo = myDoc.data().linkedTo;
        if (!linkedTo) {
          setIsAlone(true);
        } else {
          const partnerDoc = await getDoc(doc(db, 'users', linkedTo));
          if (!partnerDoc.exists() || partnerDoc.data().linkedTo !== store.uid) {
            setIsAlone(true);
          }
        }
      }
    };
    checkAlone();
  }, [store.uid]);

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
      Alert.alert('Erreur', err.message);
    }
  }, [store]);

  // ── Autosave pseudo avec debounce ────────────────────────────────────────
  const handlePseudoChange = (value: string) => {
    setPseudo(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!value.trim()) return;
    debounceTimer.current = setTimeout(() => {
      saveToFirebase({ pseudo: value.trim() });
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

  // ── Changer la photo — sauvegarde immédiate ──────────────────────────────
  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Désolé', "Nous avons besoin de la permission d'accès à tes photos.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const newAvatar = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setAvatar(newAvatar);
      // Sauvegarde immédiate de la photo sans debounce
      await saveToFirebase({ avatarUrl: newAvatar });
    }
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
          await updateDoc(doc(db, 'users', store.uid), {
            linkedTo: deleteField(),
            coupleDate: deleteField(),
            proposedDate: deleteField(),
            archivedPartners: arrayUnion(partnerUid),
          });
        } else {
          await updateDoc(doc(db, 'users', store.uid), {
            linkedTo: null, coupleDate: null, proposedDate: null,
          });
        }
        store.setSynced(false);
        store.setPartnerCode('');
        setShowDesyncModal(false);
        router.replace('/onboarding/sync');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
      setLoading(false);
    }
  };

  // ── Suppression du compte ────────────────────────────────────────────────
  const processDeleteAccount = async () => {
    setLoading(true);
    try {
      if (!store.uid) return;

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

      // 3. Supprimer le document utilisateur
      await deleteDoc(doc(db, 'users', store.uid));

      // 4. Réinitialiser le store local
      store.setUid(null);
      store.setPseudo('');
      store.setAge('');
      store.setAvatar(null);
      store.setSynced(false);
      store.setMyCode('');
      store.setPartnerCode('');
      store.clearPartnerCache();
      setShowDeleteModal(false);
      router.replace('/onboarding/login');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
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
      store.setMyCode(newCode);
      Alert.alert('Nouveau code généré', `Ton nouveau code de partage est : ${newCode}`);
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
    setLoading(false);
  };

  // ── Déconnexion (efface l'état local sans supprimer les données) ──────────
  const handleDisconnect = () => {
    Alert.alert(
      'Se déconnecter',
      'Tu seras renvoyé à l\'écran de connexion. Tes données sont conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: () => {
            store.setPseudo('');
            store.setAge('');
            store.setAvatar(null);
            store.setSynced(false);
            store.setMyCode('');
            store.setPartnerCode('');
            store.setUid('');
            router.replace('/onboarding/login');
          },
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ImageBackground source={require('../../assets/images/settings_bg.png')} style={styles.container} resizeMode="cover">
      <ScrollView style={styles.safeArea} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
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

        {/* Formulaire Profil */}
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Mon Profil</Text>

          <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.7)', borderColor: theme.cardBorder, alignItems: 'center' }]}>

            {/* Photo de profil — sauvegarde immédiate au changement */}
            <Pressable style={[styles.avatarWrapper, { borderColor: theme.tint }]} onPress={pickImage}>
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

            <View style={{ width: '100%', marginTop: 20 }}>

              {/* Pseudo — autosave après 1s sans frappe */}
              <Text style={[styles.label, { color: theme.text }]}>Pseudo</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: 'rgba(255,255,255,0.5)' }]}
                value={pseudo}
                onChangeText={handlePseudoChange}
                placeholder="Ton pseudo"
                placeholderTextColor="#A99693"
              />

              {/* Âge — autosave après 1s sans frappe */}
              <Text style={[styles.label, { color: theme.text }]}>Âge</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: 'rgba(255,255,255,0.5)' }]}
                value={age}
                onChangeText={handleAgeChange}
                keyboardType="numeric"
                placeholder="Ton âge"
                placeholderTextColor="#A99693"
              />

              {/* Plus de bouton "Enregistrer" — tout est autosavé */}

              {isAlone && (
                <Animated.View entering={FadeInUp} style={{ marginTop: 25, width: '100%', alignItems: 'center' }}>
                  {store.myCode ? (
                    <View style={styles.codeBox}>
                      <Text style={[styles.label, { color: theme.text, textAlign: 'center', marginBottom: 15 }]}>
                        Ton code de partage
                      </Text>
                      <Pressable
                        style={[styles.codeDisplay, { borderColor: theme.tint, backgroundColor: 'rgba(255,255,255,0.6)' }]}
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
                      style={({ pressed }) => [styles.actionButton, { backgroundColor: '#4A3B39', opacity: pressed || loading ? 0.8 : 1 }]}
                      onPress={generateNewCode}
                      disabled={loading}
                    >
                      <Text style={styles.actionButtonText}>Regénérer mon code de partage</Text>
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

        {/* Zone Danger */}
        <Animated.View entering={FadeInUp.duration(600).delay(300)} style={styles.section}>

          <Text style={[styles.sectionTitle, { color: 'red' }]}>Zone Danger</Text>

          <View style={[styles.card, { backgroundColor: 'rgba(255,200,200,0.7)', borderColor: 'red' }]}>

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

            <View style={styles.dangerItem}>
              <Text style={{ color: '#444', marginBottom: 15, textAlign: 'center' }}>
                Remettre toutes vos statistiques et défis à zéro. (À venir)
              </Text>
              <Pressable
                style={({ pressed }) => [styles.dangerButton, { backgroundColor: '#FFA500', opacity: pressed || loading ? 0.8 : 1 }]}
                onPress={() => Alert.alert('Info', "La réinitialisation des statistiques arrivera bientôt !")}
                disabled={loading}
              >
                <Trash2 color="white" size={20} />
                <Text style={styles.dangerButtonText}>Réinitialiser les stats</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

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
          <Link href="/terms" style={styles.legalLink}>
            <FileText color="#A99693" size={14} />
            <Text style={styles.legalLinkText}>Conditions Générales d'Utilisation</Text>
          </Link>
          <Link href="/privacy" style={styles.legalLink}>
            <Shield color="#A99693" size={14} />
            <Text style={styles.legalLinkText}>Politique de Confidentialité</Text>
          </Link>
          <Text style={{ color: '#C8B8B6', fontSize: 11, marginTop: 8 }}>Bloomy v1.0.0 — © 2026</Text>
        </Animated.View>
      </ScrollView>

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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  safeArea: { flex: 1, padding: 20, paddingTop: Platform.OS === 'web' ? 40 : 60, width: '100%', maxWidth: 500, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800' },
  saveIndicator: { width: 110, alignItems: 'flex-end' },
  saveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,154,139,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  saveChipText: { fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginLeft: 10 },
  card: { padding: 20, borderRadius: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 5 },
  input: { height: 50, borderRadius: 15, paddingHorizontal: 15, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: 'transparent' },
  avatarWrapper: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, overflow: 'visible', marginBottom: 6, position: 'relative' },
  avatarImage: { width: 110, height: 110, borderRadius: 55 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.5)' },
  cameraOverlay: { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  changePhotoText: { color: '#888', fontSize: 13, marginBottom: 6 },
  actionButton: { flexDirection: 'row', height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, paddingHorizontal: 20, width: '100%' },
  actionButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  dangerItem: { paddingVertical: 10 },
  divider: { height: 1, backgroundColor: 'rgba(255,0,0,0.1)', marginVertical: 15 },
  dangerButton: { flexDirection: 'row', height: 50, borderRadius: 25, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, width: '100%', maxWidth: 300, alignSelf: 'center' },
  dangerButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#FFF5F2', padding: 30, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#4A3B39', textAlign: 'center', marginBottom: 15 },
  modalText: { fontSize: 16, color: '#4A3B39', textAlign: 'center', marginBottom: 30, opacity: 0.8, lineHeight: 24 },
  modalActions: { flexDirection: 'row', gap: 15 },
  modalCancel: { flex: 1, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: 'bold', color: '#4A3B39' },
  modalConfirm: { flex: 1, height: 50, borderRadius: 25, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  modalConfirmText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  codeBox: { width: '100%', alignItems: 'center' },
  codeDisplay: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 2, borderStyle: 'dashed', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 20 },
  codeText: { fontSize: 32, fontWeight: '900', letterSpacing: 8 },
  disconnectButton: {
    flexDirection: 'row', height: 50, borderRadius: 25,
    backgroundColor: '#FF8C00',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3, shadowRadius: 10, width: '100%', maxWidth: 300, alignSelf: 'center',
  },
  disconnectText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  legalLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20 },
  legalLinkText: { color: '#A99693', fontSize: 13, fontWeight: '600' },
});
