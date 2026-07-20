import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, Platform, ImageBackground, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowRight, ArrowLeft, ImagePlus } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function AvatarScreen() {
  const store = useOnboardingStore((state) => state);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const theme = Colors.light;

  const pickImage = async () => {
    // Demander la permission
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Désolé', "Nous avons besoin de la permission d'accès à tes photos pour cela.");
        return;
      }
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2, // Faible qualité pour que le Base64 soit léger
      base64: true, // Très important pour sauvegarder sans Storage
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      // Sauvegarder l'image au format data URI
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      if (store.uid && image) {
        await updateDoc(doc(db, "users", store.uid), {
          avatarUrl: image
        });
        store.setAvatar(image);
      }
      router.replace('/onboarding/sync');
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
    }
    setLoading(false);
  };

  const handleSkip = () => {
    router.replace('/onboarding/sync');
  };

  return (
    <ImageBackground source={require('../../../assets/images/bloomy_warm_background.png')} style={styles.container} resizeMode="cover">
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
                <Image source={{ uri: image }} style={styles.image} />
              ) : (
                <View style={[styles.placeholder, { backgroundColor: 'rgba(255,255,255,0.5)' }]}>
                  <ImagePlus color={theme.tint} size={40} />
                  <Text style={{ color: theme.tint, marginTop: 10, fontWeight: 'bold' }}>Choisir</Text>
                </View>
              )}
            </Pressable>
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

            {!image && (
              <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Text style={[styles.skipText, { color: theme.text }]}>Plus tard</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </View>
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
  skipText: { fontSize: 16, opacity: 0.6, fontWeight: '600', textDecorationLine: 'underline' }
});
