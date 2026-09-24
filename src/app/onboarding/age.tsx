import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';

import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function AgeScreen() {
  const age = useOnboardingStore((state) => state.age);
  const setAge = useOnboardingStore((state) => state.setAge);
  const theme = Colors.light;

  useEffect(() => {
    if (!useOnboardingStore.getState().pseudo) {
      router.replace('/onboarding/pseudo');
    }
  }, []);

  const handleNext = async () => {
    const finalAge = age || "18";
    if (!age) setAge(finalAge);

    const { uid, pseudo } = useOnboardingStore.getState();
    if (uid) {
      setDoc(doc(db, "users", uid), {
        pseudo,
        age: finalAge
      }, { merge: true }).catch(error => {
        console.error("Erreur de sauvegarde :", error);
      });
    }

    router.push('/onboarding/avatar');
  };

  const ageOptions = Array.from({ length: 88 }, (_, i) => String(i + 13));

  return (
    <ImageBackground source={require('../../../assets/images/nousdeux_warm_background.png')} style={styles.container} resizeMode="cover">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        
        {/* Back Button */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/onboarding/pseudo');
            }
          }}>
            <ArrowLeft color={theme.text} size={28} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.duration(800)}>
            <Text style={[styles.title, { color: theme.text }]}>Quel âge as-tu ?</Text>
            <Text style={[styles.subtitle, { color: theme.text }]}>Pour adapter l'expérience.</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.pickerContainer}>
            <Picker
              selectedValue={age || "18"}
              onValueChange={(itemValue) => setAge(itemValue)}
              style={styles.picker}
            >
              {ageOptions.map((num) => (
                <Picker.Item key={num} label={num} value={num} color={theme.text} />
              ))}
            </Picker>
          </Animated.View>
        </View>

        {/* Floating Next Button */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.footer}>
          <Pressable 
            style={({ pressed }) => [styles.nextButton, { backgroundColor: theme.gradientEnd, opacity: pressed ? 0.8 : 1 }]} 
            onPress={handleNext}
          >
            <ArrowRight color="white" size={32} />
          </Pressable>
        </Animated.View>
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
  pickerContainer: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#FF9A8B', height: 200, justifyContent: 'center', zIndex: 100, elevation: 10 },
  picker: { width: 150, height: 200, alignSelf: 'center', backgroundColor: 'transparent', borderWidth: 0, zIndex: 100 },
  footer: { alignItems: 'center', paddingBottom: Platform.OS === 'web' ? 40 : 60 },
  nextButton: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 },
});

