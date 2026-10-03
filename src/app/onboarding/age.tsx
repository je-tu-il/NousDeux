import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useTopInset } from '@/hooks/useTopInset';

export default function AgeScreen() {
  const store = useOnboardingStore();
  const age = store.age;
  const setAge = store.setAge;
  const theme = store.isDarkMode ? Colors.dark : Colors.light;
  const topInset = useTopInset();

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
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS !== 'web'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 10 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
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
            <Animated.View entering={FadeInDown.duration(600)}>
              <Text style={[styles.title, { color: theme.text }]}>Quel âge as-tu ?</Text>
              <Text style={[styles.subtitle, { color: theme.text }]}>Pour adapter l'expérience.</Text>
            </Animated.View>

            <Animated.View 
              entering={FadeInUp.duration(600).delay(150)} 
              style={[
                styles.pickerContainer, 
                { 
                  backgroundColor: store.isDarkMode ? 'rgba(35, 28, 27, 0.85)' : 'rgba(255,255,255,0.85)', 
                  borderColor: theme.tint 
                }
              ]}
            >
              <Picker
                selectedValue={age || "18"}
                onValueChange={(itemValue) => setAge(itemValue)}
                style={styles.picker}
                itemStyle={[styles.pickerItem, { color: theme.text }]}
                dropdownIconColor={theme.tint}
              >
                {ageOptions.map((num) => (
                  <Picker.Item 
                    key={num} 
                    label={num} 
                    value={num} 
                    color={theme.text} 
                    style={styles.pickerItem} 
                  />
                ))}
              </Picker>
            </Animated.View>
          </View>

          {/* Floating Next Button */}
          <View style={styles.footer}>
            <Animated.View entering={FadeInUp.duration(300)}>
              <Pressable 
                style={({ pressed }) => [styles.nextButton, { backgroundColor: theme.gradientEnd, opacity: pressed ? 0.8 : 1 }]} 
                onPress={handleNext}
              >
                <ArrowRight color="white" size={32} />
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: { flex: 1, justifyContent: 'center', marginVertical: 30 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center', marginBottom: 30 },
  pickerContainer: { 
    borderRadius: 20, 
    overflow: 'hidden', 
    borderWidth: 2, 
    height: Platform.OS === 'web' ? 64 : 200, 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 100, 
    elevation: 10,
    maxWidth: 320,
    width: '100%',
    alignSelf: 'center',
  },
  picker: { 
    width: Platform.OS === 'web' ? '100%' : (Platform.OS === 'android' ? '100%' : 160), 
    height: Platform.OS === 'web' ? 56 : 200, 
    alignSelf: 'center', 
    backgroundColor: 'transparent', 
    borderWidth: 0, 
    zIndex: 100 
  },
  pickerItem: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
  footer: { alignItems: 'center', marginTop: 20 },
  nextButton: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 },
});
