import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, Platform, ImageBackground, Image } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowRight, ArrowLeft, ImagePlus, Trash2 } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteField } from 'firebase/firestore';
import UIModal, { UIModalType } from '@/components/UIModal';

export default function AvatarScreen() {
  const store = useOnboardingStore((state) => state);
  const [image, setImage] = useState<string | null>(store.avatar);
  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState<{
    visible: boolean;
    type?: UIModalType;
    title?: string;
    message?: string;
  }>({ visible: false });
  const theme = Colors.light;

  const compressImageToDataUri = async (uri: string, maxDim = 256): Promise<string> => {
    // Sur Web, utiliser HTML Canvas pour garantir une compression légère immédiate
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return new Promise((resolve) => {
        const img = new (window as any).Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          } else {
            resolve(uri);
          }
        };
        img.onerror = () => resolve(uri);
        img.src = uri;
      });
    }

    // Sur mobile natif (iOS / Android), utiliser ImageManipulator
    try {
      const ImageManipulator = await import('expo-image-manipulator');
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: maxDim, height: maxDim } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipResult.base64) {
        return `data:image/jpeg;base64,${manipResult.base64}`;
      }
    } catch (err) {
      console.warn('ImageManipulator error:', err);
    }
    return uri;
  };

  const pickImage = async () => {
    // Demander la permission
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setModalState({
          visible: true,
          type: 'permission',
          title: 'Accès requis',
          message: "Nous avons besoin de la permission d'accès à tes photos pour cela.",
        });
        return;
      }
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const rawUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      const compressed = await compressImageToDataUri(rawUri, 256);
      setImage(compressed);
    }
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
          toSave = await compressImageToDataUri(toSave, 256);
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
    <ImageBackground source={require('../../../assets/images/nousdeux_warm_background.png')} style={styles.container} resizeMode="cover">
      <View style={styles.keyboardView}>
        
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
          <Animated.View entering={FadeInDown.duration(800)}>
            <Text style={[styles.title, { color: theme.text }]}>Ta plus belle photo</Text>
            <Text style={[styles.subtitle, { color: theme.text }]}>
              Ajoute une photo pour que ton partenaire te reconnaisse du premier coup d'œil !
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.imageContainer}>
            <Pressable style={[styles.imageWrapper, { borderColor: theme.tint }]} onPress={pickImage}>
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

          <Animated.View entering={FadeInUp.duration(800).delay(400)} style={styles.buttonContainer}>
            <Pressable 
              style={({ pressed }) => [
                styles.button, 
                { backgroundColor: image ? theme.tint : 'rgba(255,255,255,0.4)', opacity: pressed || loading ? 0.8 : 1 }
              ]} 
              onPress={image ? handleNext : pickImage}
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
  keyboardView: { flex: 1, padding: 30, width: '100%', maxWidth: 500, alignSelf: 'center' },
  header: { paddingTop: Platform.OS === 'web' ? 20 : 50, zIndex: 10 },
  backBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 20, alignSelf: 'flex-start' },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.8, textAlign: 'center', marginBottom: 40, lineHeight: 24 },
  imageContainer: { alignItems: 'center', marginBottom: 50 },
  imageWrapper: { width: 180, height: 180, borderRadius: 90, borderWidth: 4, overflow: 'hidden', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  image: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  buttonContainer: { alignItems: 'center' },
  button: { width: '100%', flexDirection: 'row', padding: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  buttonText: { fontSize: 18, fontWeight: 'bold' },
  skipButton: { marginTop: 20, padding: 10 },
  skipText: { fontSize: 16, opacity: 0.6, fontWeight: '600', textDecorationLine: 'underline' },
  editBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, alignItems: 'center' },
  editBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  deletePhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20 },
  deletePhotoText: { color: '#E11D48', fontSize: 13, fontWeight: '600' },
});
