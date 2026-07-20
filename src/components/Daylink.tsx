import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Lock, Unlock } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

import { encryptPayload, decryptPayload } from '../lib/crypto';
import { Colors } from '../constants/Colors';

// MOCK CONSTANTS
const MOCK_PARTNER_PUBLIC_KEY = "partner-pem-key-mock"; 
const MOCK_QUESTION_TEXT = "Quel est le souvenir le plus doux que tu gardes de notre première rencontre ?";

export default function Daylink() {
  const [answer, setAnswer] = useState("");
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const theme = Colors.light; // Utilisation du thème doux et chaleureux

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      // 1. Chiffrement
      const encrypted = await encryptPayload(answer, MOCK_PARTNER_PUBLIC_KEY);
      
      // 2. Sauvegarde (Simulée pour l'UI)
      await new Promise(r => setTimeout(r, 1000));
      setIsSubmitted(true);
      
      // 3. Révélation de la réponse partenaire (Simulation après 3 secondes)
      setTimeout(async () => {
         const mockPartnerEncrypted = await encryptPayload("J'ai tout de suite remarqué ton sourire et à quel point je me sentais bien avec toi...", MOCK_PARTNER_PUBLIC_KEY);
         const decrypted = await decryptPayload(mockPartnerEncrypted, MOCK_PARTNER_PUBLIC_KEY);
         setPartnerAnswer(decrypted);
      }, 3000);

    } catch (error) {
      console.error("Encryption Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Animated.View 
        entering={FadeInUp.duration(800).springify()} 
        layout={Layout.springify()}
        style={[styles.card, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder }]}
      >
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <Heart color="white" size={24} fill="white" />
          <Text style={styles.headerTitle}>Daylink</Text>
        </LinearGradient>

        <View style={styles.content}>
          <Text style={[styles.question, { color: theme.text }]}>{MOCK_QUESTION_TEXT}</Text>
          
          {!isSubmitted ? (
            <Animated.View entering={FadeIn.delay(300)}>
              <TextInput 
                style={[styles.input, { color: theme.text, borderColor: theme.tint, backgroundColor: 'rgba(255,255,255,0.5)' }]} 
                placeholder="Écris ce que tu ressens..." 
                placeholderTextColor="#A99693"
                value={answer}
                onChangeText={setAnswer}
                multiline
              />
              <Pressable 
                style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1, backgroundColor: theme.tint }]}
                onPress={handleSubmit} 
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Envoyer avec amour</Text>}
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} layout={Layout.springify()}>
              <View style={[styles.statusBox, { backgroundColor: 'rgba(255, 154, 139, 0.1)' }]}>
                <Lock color={theme.tint} size={20} />
                <Text style={[styles.statusText, { color: theme.tint }]}>Ta réponse est scellée 🔒</Text>
              </View>

              {partnerAnswer ? (
                <Animated.View entering={FadeInUp.duration(600)} style={[styles.revealBox, { backgroundColor: theme.background }]}>
                  <View style={styles.revealHeader}>
                     <Unlock color={theme.gradientEnd} size={18} />
                     <Text style={[styles.revealTitle, { color: theme.gradientEnd }]}>Réponse dévoilée !</Text>
                  </View>
                  <Text style={[styles.partnerText, { color: theme.text }]}>"{partnerAnswer}"</Text>
                </Animated.View>
              ) : (
                <View style={styles.waitingBox}>
                  <ActivityIndicator color={theme.tint} />
                  <Text style={[styles.waitingText, { color: '#A99693' }]}>En attente de ton partenaire...</Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    // Note: backdropFilter est une propriété web, on triche un peu avec rgba() pour le mobile
    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
  },
  headerGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  content: {
    padding: 24,
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 28,
  },
  input: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    minHeight: 120,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  waitingBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  waitingText: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  revealBox: {
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6A88',
  },
  revealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  revealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  partnerText: {
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 26,
  }
});
