import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, Platform, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowRight, ArrowLeft, ImagePlus, Trash2 } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteField } from 'firebase/firestore';
import UIModal, { UIModalType } from '@/components/UIModal';
import AvatarPickerModal from '@/components/AvatarPickerModal';
import { takePhotoWithCamera, pickImageFromGallery, stripMetadataAndCompress } from '@/lib/avatarPicker';
import { useTopInset } from '@/hooks/useTopInset';

export default function AvatarScreen() {
  const store = useOnboardingStore((state) => state);
  const [image, setImage] = useState<string | null>(store.avatar);
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const topInset = useTopInset();
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type?: UIModalType;
    title?: string;
    message?: string;
  }>({ visible: false });
  const theme = Colors.light;

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
    setImage(res.dataUri);
  };

  const handlePickGallery = async () => {
    const res = await pickImageFromGallery();
    if (!res.success) {
      if (res.permissionDenied) {
        setModalState({
          visible: true,
          type: 'permission',
          title: 'Accès photos requis',
          message: "Nous avons besoin de la permission d'accès à tes photos pour cela.",
        });
      }
      return;
    }
    setImage(res.dataUri);
  };

  const handleRemovePhoto = async () => {
    setImage(null);
    store.setAvatar(null);
    if (store.uid) {
      try {
        await setDoc(doc(db, "users", store.uid), {
          avatarUrl: deleteField(),
          avatar: deleteField()
        }, { merge: true });
        await setDoc(doc(db, "userProfiles", store.uid), {
          avatar: deleteField()
        }, { merge: true });
      } catch {}
    }
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      if (store.uid && image) {
        let toSave = image;
        if (toSave.length > 300000) {
          toSave = await stripMetadataAndCompress(toSave, 256);
        }
        if (toSave.length > 800000) {
          throw new Error("Cette photo est trop volumineuse pour être enregistrée. Choisis une autre image.");
        }
        await setDoc(doc(db, "users", store.uid), {
          avatarUrl: toSave
        }, { merge: true });
        store.setAvatar(toSave);
      }
      router.replace('/onboarding/sync');
    } catch (error: any) {
      setModalState({
        visible: true,
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Impossible d\'enregistrer la photo.',
      });
    }
    setLoading(false);
  };

  const handleSkip = () => {
    router.replace('/onboarding/sync');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 10 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Back Button */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/onboarding/age');
            }
          }}>
            <ArrowLeft color={theme.text} size={28} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.duration(600)}>
            <Text style={[styles.title, { color: theme.text }]}>Ta plus belle photo</Text>
            <Text style={[styles.subtitle, { color: theme.text }]}>
              Ajoute une photo pour que ton partenaire te reconnaisse du premier coup d'œil !
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(600).delay(150)} style={styles.imageContainer}>
            <Pressable style={[styles.imageWrapper, { borderColor: theme.tint }]} onPress={() => setPickerVisible(true)}>
              {image ? (
                <>
                  <Image source={{ uri: image }} style={styles.image} />
                  <View style={styles.editBadge}>
                    <Text style={styles.editBadgeText}>Modifier</Text>
                  </View>
                </>
              ) : (
                <View style={[styles.placeholder, { backgroundColor: 'rgba(255,255,255,0.5)' }]}>
                  <ImagePlus color={theme.tint} size={40} />
                  <Text style={{ color: theme.tint, marginTop: 10, fontWeight: 'bold' }}>Clique pour ajouter</Text>
                </View>
              )}
            </Pressable>

            {image && (
              <Pressable style={styles.deletePhotoBtn} onPress={handleRemovePhoto}>
                <Trash2 size={16} color="#E11D48" />
                <Text style={styles.deletePhotoText}>Supprimer la photo</Text>
              </Pressable>
            )}
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(600).delay(300)} style={styles.buttonContainer}>
            <Pressable 
              style={({ pressed }) => [
                styles.button, 
                { backgroundColor: image ? theme.tint : 'rgba(255,255,255,0.4)', opacity: pressed || loading ? 0.8 : 1 }
              ]} 
              onPress={image ? handleNext : () => setPickerVisible(true)}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: image ? 'white' : theme.text }]}>
                {image ? "Continuer" : "Choisir une photo"}
              </Text>
              {image && <ArrowRight color="white" size={24} />}
            </Pressable>

            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <Text style={[styles.skipText, { color: theme.text }]}>Plus tard</Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>

      <AvatarPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onTakePhoto={handleTakePhoto}
        onPickGallery={handlePickGallery}
        onRemovePhoto={image ? handleRemovePhoto : undefined}
        onSelectDataUri={(dataUri) => setImage(dataUri)}
        hasPhoto={!!image}
      />

      <UIModal
        visible={modalState.visible}
        onClose={() => setModalState({ visible: false })}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'web' ? 30 : 50,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  header: { zIndex: 10 },
  backBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 20, alignSelf: 'flex-start' },
  content: { flex: 1, justifyContent: 'center', marginVertical: 20 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  imageContainer: { alignItems: 'center', marginBottom: 30 },
  imageWrapper: { width: 170, height: 170, borderRadius: 85, borderWidth: 4, overflow: 'hidden', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  image: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  buttonContainer: { alignItems: 'center' },
  button: { width: '100%', flexDirection: 'row', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  buttonText: { fontSize: 18, fontWeight: 'bold' },
  skipButton: { marginTop: 15, padding: 10 },
  skipText: { fontSize: 16, opacity: 0.6, fontWeight: '600', textDecorationLine: 'underline' },
  editBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, alignItems: 'center' },
  editBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  deletePhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20 },
  deletePhotoText: { color: '#E11D48', fontSize: 13, fontWeight: '600' },
});
