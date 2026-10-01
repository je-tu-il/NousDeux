import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const MAX_PSEUDO_LENGTH = 18;

export default function PseudoScreen() {
  const storePseudo = useOnboardingStore((state) => state.pseudo);
  const setPseudo = useOnboardingStore((state) => state.setPseudo);
  const [localPseudo, setLocalPseudo] = useState(storePseudo);
  const theme = Colors.light;

  const handleNext = () => {
    const trimmed = localPseudo.trim();
    if (trimmed.length > 1 && trimmed.length <= MAX_PSEUDO_LENGTH) {
      setPseudo(trimmed);
      const uid = useOnboardingStore.getState().uid;
      if (uid) {
        setDoc(doc(db, 'users', uid), { pseudo: trimmed }, { merge: true }).catch((error) => {
          console.error("Erreur d'enregistrement du pseudo :", error);
        });
      }
      router.push('/onboarding/age');
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/onboarding/login');
    }
  };

  return (
    <ImageBackground source={require('../../../assets/images/nousdeux_warm_background.png')} style={styles.container} resizeMode="cover">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        {/* Back Button */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <ArrowLeft color={theme.text} size={28} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.duration(800)}>
            <Text style={[styles.title, { color: theme.text }]}>Comment t'appelles-tu ?</Text>
            <Text style={[styles.subtitle, { color: theme.text }]}>Ton partenaire verra ce prénom.</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.inputContainer}>
            <TextInput 
              style={[styles.input, { color: theme.text, borderColor: theme.tint, backgroundColor: 'rgba(255,255,255,0.6)' }]} 
              placeholder="Ton prénom"
              placeholderTextColor="#A99693"
              value={localPseudo.slice(0, MAX_PSEUDO_LENGTH)}
              onChangeText={(value) => setLocalPseudo(value.slice(0, MAX_PSEUDO_LENGTH))}
              maxLength={MAX_PSEUDO_LENGTH}
              onSubmitEditing={handleNext}
              onKeyPress={(e: any) => {
                if (e.nativeEvent.key === 'Enter') handleNext();
              }}
              returnKeyType="done"
              autoFocus
            />
            <Text style={[styles.limitText, { color: theme.text }]}>
              {Math.min(localPseudo.length, MAX_PSEUDO_LENGTH)}/{MAX_PSEUDO_LENGTH} caractères maximum
            </Text>
          </Animated.View>

        </View>

        {/* Floating Next Button */}
        {localPseudo.trim().length > 1 && (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.footer}>
            <Pressable 
              style={({ pressed }) => [styles.nextButton, { backgroundColor: theme.gradientEnd, opacity: pressed ? 0.8 : 1 }]} 
              onPress={handleNext}
            >
              <ArrowRight color="white" size={32} />
            </Pressable>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', overflow: 'hidden' },
  keyboardView: { flex: 1, padding: 30, width: '100%', maxWidth: 500, alignSelf: 'center' },
  header: { paddingTop: Platform.OS === 'web' ? 20 : 50, zIndex: 10 },
  backBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 20, alignSelf: 'flex-start' },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center', marginBottom: 40 },
  inputContainer: { alignItems: 'center' },
  input: { width: '100%', borderWidth: 2, padding: 20, borderRadius: 20, fontSize: 24, textAlign: 'center', fontWeight: 'bold' },
  limitText: { alignSelf: 'flex-end', marginTop: 8, fontSize: 12, opacity: 0.65 },
  footer: { alignItems: 'center', paddingBottom: Platform.OS === 'web' ? 40 : 60 },
  nextButton: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 },
});

