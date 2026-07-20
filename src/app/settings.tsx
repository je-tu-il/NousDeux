import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, Platform, ImageBackground, Alert, Image, ScrollView, Modal } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { ArrowLeft, Save, HeartCrack, Camera, Trash2, Copy, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, FadeOut } from 'react-native-reanimated';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion, setDoc, deleteField } from 'firebase/firestore';

export default function SettingsScreen() {
  const theme = Colors.light;
  const store = useOnboardingStore((state) => state);
  
  const [pseudo, setPseudo] = useState(store.pseudo);
  const [age, setAge] = useState(store.age);
  const [avatar, setAvatar] = useState(store.avatar);
  const [loading, setLoading] = useState(false);
  
  const [showDesyncModal, setShowDesyncModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isAlone, setIsAlone] = useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    const checkAlone = async () => {
      if (!store.uid) return;
      const myDoc = await getDoc(doc(db, "users", store.uid));
      if (myDoc.exists()) {
        const linkedTo = myDoc.data().linkedTo;
        if (!linkedTo) {
          setIsAlone(true);
        } else {
          const partnerDoc = await getDoc(doc(db, "users", linkedTo));
          if (!partnerDoc.exists() || partnerDoc.data().linkedTo !== store.uid) {
            setIsAlone(true);
          }
        }
      }
    };
    checkAlone();
  }, [store.uid]);

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Désolé', "Nous avons besoin de la permission d'accès à tes photos.");
        return;
      }
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      setAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    if (!pseudo.trim() || !age.trim()) return;
    setLoading(true);
    try {
      if (store.uid) {
        await updateDoc(doc(db, "users", store.uid), {
          pseudo: pseudo.trim(),
          age: age.trim(),
          avatarUrl: avatar
        });
      }
      store.setPseudo(pseudo.trim());
      store.setAge(age.trim());
      store.setAvatar(avatar);
      Alert.alert("Succès", "Ton profil a bien été mis à jour.");
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
    }
    setLoading(false);
  };

  const processDesync = async () => {
    setLoading(true);
    try {
      if (!store.uid) return;

      const myDoc = await getDoc(doc(db, "users", store.uid));
      if (myDoc.exists()) {
        const data = myDoc.data();
        const partnerUid = data.linkedTo;

        // 1. Enlever le lien chez moi et archiver
        if (partnerUid) {
          await updateDoc(doc(db, "users", store.uid), { 
            linkedTo: deleteField(),
            coupleDate: deleteField(),
            proposedDate: deleteField(),
            archivedPartners: arrayUnion(partnerUid)
          });
        } else {
          // Sécurité au cas où il n'y a pas de partenaire
          await updateDoc(doc(db, "users", store.uid), { 
            linkedTo: null,
            coupleDate: null,
            proposedDate: null
          });
        }

        // 3. Mettre à jour l'état local
        store.setSynced(false);
        store.setPartnerCode("");
        setShowDesyncModal(false);
        router.replace('/onboarding/sync');
      }
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
      setLoading(false);
    }
  };

  const processDeleteAccount = async () => {
    setLoading(true);
    try {
      if (!store.uid) return;

      const myDoc = await getDoc(doc(db, "users", store.uid));
      if (myDoc.exists()) {
        const data = myDoc.data();
        const partnerUid = data.linkedTo;

        // On ne supprime plus le lien chez l'autre automatiquement, 
        // pour qu'il puisse voir qu'il est seul et quitter lui-même.

        // On supprime le doc utilisateur
        await deleteDoc(doc(db, "users", store.uid));

        // On reset le store
        store.setUid(null);
        store.setPseudo("");
        store.setAge("");
        store.setAvatar(null);
        store.setSynced(false);
        store.setMyCode("");
        store.setPartnerCode("");
        
        setShowDeleteModal(false);
        router.replace('/onboarding/login');
      }
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
      setLoading(false);
    }
  };

  const generateNewCode = async () => {
    if (!store.uid) return;
    setLoading(true);
    try {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await setDoc(doc(db, "pairing_codes", newCode), {
        creatorUid: store.uid,
        createdAt: new Date()
      });
      store.setMyCode(newCode);
      Alert.alert("Nouveau code généré", `Ton nouveau code de partage est : ${newCode}`);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Erreur", err.message);
    }
    setLoading(false);
  };

  return (
    <ImageBackground source={require('../../assets/images/settings_bg.png')} style={styles.container} resizeMode="cover">
      <ScrollView style={styles.safeArea} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={theme.text} size={28} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Paramètres</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Formulaire Profil */}
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Mon Profil</Text>
          
          <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.7)', borderColor: theme.cardBorder, alignItems: 'center' }]}>
            
            <Pressable style={[styles.avatarWrapper, { borderColor: theme.tint }]} onPress={pickImage}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Camera color={theme.tint} size={30} />
                </View>
              )}
            </Pressable>
            <Text style={styles.changePhotoText}>Changer de photo</Text>

            <View style={{ width: '100%', marginTop: 20 }}>
              <Text style={[styles.label, { color: theme.text }]}>Pseudo</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: 'rgba(255,255,255,0.5)' }]}
                value={pseudo}
                onChangeText={setPseudo}
                placeholder="Ton pseudo"
              />

              <Text style={[styles.label, { color: theme.text }]}>Âge</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: 'rgba(255,255,255,0.5)' }]}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                placeholder="Ton âge"
              />

              <Pressable 
                style={({ pressed }) => [styles.saveButton, { backgroundColor: theme.tint, opacity: pressed || loading ? 0.8 : 1 }]} 
                onPress={handleSave}
                disabled={loading}
              >
                <Save color="white" size={20} />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </Pressable>

              {isAlone && (
                <Animated.View entering={FadeInUp} style={{ marginTop: 25, width: '100%', alignItems: 'center' }}>
                  {store.myCode ? (
                    <View style={styles.codeBox}>
                      <Text style={[styles.label, { color: theme.text, textAlign: 'center', marginBottom: 15 }]}>Ton nouveau code de partage</Text>
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
                      style={({ pressed }) => [styles.saveButton, { backgroundColor: '#4A3B39', opacity: pressed || loading ? 0.8 : 1, width: '100%' }]} 
                      onPress={generateNewCode}
                      disabled={loading}
                    >
                      <Text style={[styles.saveButtonText, { color: 'white' }]}>Regénérer mon code de partage</Text>
                    </Pressable>
                  )}
                </Animated.View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Zone Danger */}
        <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: 'red' }]}>Zone Danger</Text>
          
          <View style={[styles.card, { backgroundColor: 'rgba(255,200,200,0.7)', borderColor: 'red' }]}>
            
            {/* Quitter le couple */}
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

            {/* Réinitialiser les stats */}
            <View style={styles.dangerItem}>
              <Text style={{ color: '#444', marginBottom: 15, textAlign: 'center' }}>
                Remettre toutes vos statistiques et défis à zéro. (À venir)
              </Text>
              <Pressable 
                style={({ pressed }) => [styles.dangerButton, { backgroundColor: '#FFA500', opacity: pressed || loading ? 0.8 : 1 }]} 
                onPress={() => Alert.alert("Info", "La réinitialisation des statistiques arrivera bientôt !")}
                disabled={loading}
              >
                <Trash2 color="white" size={20} />
                <Text style={styles.dangerButtonText}>Réinitialiser les stats</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            {/* Supprimer le compte */}
            <View style={styles.dangerItem}>
              <Text style={{ color: '#444', marginBottom: 15, textAlign: 'center' }}>
                Cette action supprimera définitivement toutes tes données personnelles.
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
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginLeft: 10 },
  card: { padding: 20, borderRadius: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 5 },
  input: { height: 50, borderRadius: 15, paddingHorizontal: 15, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: 'transparent' },
  avatarWrapper: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, overflow: 'hidden', marginBottom: 10 },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.5)' },
  changePhotoText: { color: '#888', fontSize: 14, textDecorationLine: 'underline', marginBottom: 10 },
  saveButton: { flexDirection: 'row', height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  dangerItem: { paddingVertical: 10 },
  divider: { height: 1, backgroundColor: 'rgba(255,0,0,0.1)', marginVertical: 15 },
  dangerButton: { flexDirection: 'row', height: 50, borderRadius: 25, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, width: '100%', maxWidth: 300, alignSelf: 'center' },
  dangerButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  
  // Modal Styles
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
  codeText: { fontSize: 32, fontWeight: '900', letterSpacing: 8 }
});
