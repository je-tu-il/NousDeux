import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { HeartHandshake } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';

export default function PairingScreen() {
  const [code, setCode] = useState("");
  const [myCode, setMyCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const theme = Colors.light;

  const handleGenerateCode = async () => {
    setLoading(true);
    try {
      // Simulation of API call to api/generate_code
      await new Promise(r => setTimeout(r, 1000));
      setMyCode("A1B2C3");
    } finally {
      setLoading(false);
    }
  };

  const handlePair = async () => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      // Simulation of API call to api/pair
      await new Promise(r => setTimeout(r, 1500));
      // Routing to the Home Screen
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={require('../../assets/images/bloomy_warm_background.png')} style={styles.container} resizeMode="cover">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <Animated.View entering={FadeInUp.duration(800).springify()} style={[styles.card, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder }]}>
          
          <LinearGradient colors={[theme.gradientStart, theme.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            <HeartHandshake color="white" size={28} />
            <Text style={styles.headerTitle}>Connexion Bloomy</Text>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={[styles.subtitle, { color: theme.text }]}>Liez vos téléphones pour commencer votre rituel.</Text>
            
            {/* Generate Code Section */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Option 1: Partage ton code</Text>
              {myCode ? (
                <View style={[styles.codeBox, { borderColor: theme.tint }]}>
                  <Text style={[styles.myCodeText, { color: theme.tint }]}>{myCode}</Text>
                </View>
              ) : (
                <Pressable style={({ pressed }) => [styles.outlineButton, { borderColor: theme.tint, opacity: pressed ? 0.7 : 1 }]} onPress={handleGenerateCode} disabled={loading}>
                  {loading && !myCode ? <ActivityIndicator color={theme.tint} /> : <Text style={[styles.outlineButtonText, { color: theme.tint }]}>Générer mon code</Text>}
                </Pressable>
              )}
            </View>

            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: theme.cardBorder }]} />
              <Text style={[styles.orText, { color: theme.text }]}>OU</Text>
              <View style={[styles.line, { backgroundColor: theme.cardBorder }]} />
            </View>

            {/* Enter Code Section */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Option 2: Utilise le code de ton partenaire</Text>
              <TextInput 
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: 'rgba(255,255,255,0.6)' }]} 
                placeholder="Ex: A1B2C3"
                placeholderTextColor="#A99693"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
              />
              <Pressable style={({ pressed }) => [styles.button, { backgroundColor: theme.gradientStart, opacity: pressed || code.length < 6 ? 0.7 : 1 }]} onPress={handlePair} disabled={loading || code.length < 6}>
                {loading && code.length >= 6 ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Se Connecter</Text>}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  keyboardView: { flex: 1, justifyContent: 'center', padding: 20, width: '100%', maxWidth: 500, alignSelf: 'center' },
  card: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, backgroundColor: 'rgba(255, 255, 255, 0.8)' },
  headerGradient: { padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  content: { padding: 24 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  section: { marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  outlineButton: { borderWidth: 2, padding: 16, borderRadius: 16, alignItems: 'center' },
  outlineButtonText: { fontSize: 16, fontWeight: 'bold' },
  codeBox: { borderWidth: 2, borderStyle: 'dashed', padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  myCodeText: { fontSize: 28, fontWeight: '900', letterSpacing: 6 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1 },
  orText: { paddingHorizontal: 10, fontSize: 14, fontWeight: 'bold', opacity: 0.5 },
  input: { borderWidth: 1, padding: 16, borderRadius: 16, fontSize: 20, textAlign: 'center', letterSpacing: 4, fontWeight: 'bold', marginBottom: 16 },
  button: { padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
