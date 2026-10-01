/**
 * contact.tsx — Formulaire de contact NousDeux
 * Stocke les messages dans Firestore (contacts/{id})
 * Whitelist dans _layout.tsx pour accès sans connexion
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  ScrollView, Platform, ImageBackground, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Send, CheckCircle2, Mail, MessageSquare, User } from 'lucide-react-native';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useOnboardingStore } from '../store/onboardingStore';
import { ContactEmailLink } from '../components/ContactEmailLink';
import { useTopInset } from '@/hooks/useTopInset';

type ContactCategory = 'bug' | 'suggestion' | 'account' | 'other';

const CATEGORIES: { id: ContactCategory; label: string; emoji: string }[] = [
  { id: 'bug',        label: 'Bug / Problème',   emoji: '🐛' },
  { id: 'suggestion', label: 'Suggestion',        emoji: '💡' },
  { id: 'account',   label: 'Mon compte',         emoji: '👤' },
  { id: 'other',     label: 'Autre',              emoji: '💬' },
];

export default function ContactScreen() {
  const store = useOnboardingStore(s => s);
  const topInset = useTopInset();

  const [name,     setName]     = useState(store.pseudo || '');
  const [email,    setEmail]    = useState('');
  const [category, setCategory] = useState<ContactCategory>('bug');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  const isValid = name.trim().length > 0
    && email.includes('@')
    && message.trim().length >= 10;

  const handleSend = async () => {
    if (!isValid || sending) return;
    setSending(true);

    try {
      await addDoc(collection(db, 'contacts'), {
        name:       name.trim(),
        email:      email.trim().toLowerCase(),
        category,
        message:    message.trim(),
        uid:        store.uid ?? null,
        pseudo:     store.pseudo ?? null,
        status:     'unread',          // unread | read | replied
        reply:      null,
        createdAt:  serverTimestamp(),
        repliedAt:  null,
        platform:   Platform.OS,
      });

      setSent(true);
    } catch (e) {
      console.error('[Contact]', e);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message. Réessaie plus tard.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#FF9A8B', '#FF6A88']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: topInset + 8 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="white" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Nous contacter</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {sent ? (
          /* ── Confirmation ── */
          <Animated.View entering={FadeInUp.duration(500)} style={styles.successBox}>
            <CheckCircle2 color="#22c55e" size={56} />
            <Text style={styles.successTitle}>Message envoyé ! 🎉</Text>
            <Text style={styles.successSub}>
              Nous répondrons à{'\n'}<Text style={{ fontWeight: '700' }}>{email}</Text>{'\n'}dans les plus brefs délais.
            </Text>
            <Pressable style={styles.backHome} onPress={() => router.back()}>
              <Text style={styles.backHomeText}>Retour</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInUp.duration(400)} style={styles.intro}>
              <Text style={styles.introTitle}>Une question ? Un problème ?</Text>
              <Text style={styles.introSub}>On te répond directement par email.</Text>
            </Animated.View>

            {/* Catégorie */}
            <Animated.View entering={FadeInUp.delay(80).duration(400)} style={styles.section}>
              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(cat => (
                  <Pressable
                    key={cat.id}
                    style={[styles.catChip, category === cat.id && styles.catChipActive]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.catLabel, category === cat.id && styles.catLabelActive]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* Nom */}
            <Animated.View entering={FadeInUp.delay(120).duration(400)} style={styles.section}>
              <Text style={styles.label}>Ton prénom</Text>
              <View style={styles.inputRow}>
                <User color="#A99693" size={18} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Prénom"
                  placeholderTextColor="#C4B4B2"
                  autoCapitalize="words"
                />
              </View>
            </Animated.View>

            {/* Email */}
            <Animated.View entering={FadeInUp.delay(160).duration(400)} style={styles.section}>
              <Text style={styles.label}>Ton email (pour recevoir la réponse)</Text>
              <View style={styles.inputRow}>
                <Mail color="#A99693" size={18} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="toi@exemple.com"
                  placeholderTextColor="#C4B4B2"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </Animated.View>

            {/* Message */}
            <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
              <Text style={styles.label}>Message <Text style={styles.minChars}>(min. 10 caractères)</Text></Text>
              <View style={styles.inputRow}>
                <MessageSquare color="#A99693" size={18} style={{ alignSelf: 'flex-start', marginTop: 3 }} />
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Décris ton problème ou ta suggestion..."
                  placeholderTextColor="#C4B4B2"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>
              <Text style={styles.charCount}>{message.length} / 1000</Text>
            </Animated.View>

            {/* Bouton envoi */}
            <Animated.View entering={FadeInUp.delay(240).duration(400)} style={{ marginTop: 8 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  { opacity: pressed || !isValid ? 0.6 : 1 },
                ]}
                onPress={handleSend}
                disabled={!isValid || sending}
              >
                <LinearGradient
                  colors={isValid ? ['#FF9A8B', '#FF3366'] : ['#C4B4B2', '#A99693']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.sendGradient}
                >
                  {sending
                    ? <ActivityIndicator color="white" />
                    : <>
                        <Send color="white" size={18} />
                        <Text style={styles.sendText}>Envoyer le message</Text>
                      </>}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Contact direct email */}
            <Animated.View entering={FadeInUp.delay(280).duration(400)} style={styles.directContactBox}>
              <Text style={styles.directContactLabel}>Tu préfères nous écrire directement ?</Text>
              <ContactEmailLink subject="Contact direct NousDeux" />
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FFF5F2' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    gap: 12,
  },
  backBtn:      { padding: 4 },
  headerTitle:  { color: 'white', fontSize: 18, fontWeight: '800', flex: 1 },

  scroll:        { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60, maxWidth: 500, width: '100%', alignSelf: 'center' },

  intro:        { marginBottom: 24 },
  introTitle:   { fontSize: 22, fontWeight: '900', color: '#4A3B39', marginBottom: 4 },
  introSub:     { fontSize: 14, color: '#A99693' },

  section:      { marginBottom: 20 },
  label:        { fontSize: 13, fontWeight: '700', color: '#4A3B39', marginBottom: 8, letterSpacing: 0.3 },
  minChars:     { fontWeight: '400', color: '#A99693' },

  catGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 14, borderWidth: 1.5,
    backgroundColor: 'white',
    borderColor: 'rgba(255,154,139,0.25)',
  },
  catChipActive:  { borderColor: '#FF9A8B', backgroundColor: 'rgba(255,154,139,0.1)' },
  catEmoji:       { fontSize: 16 },
  catLabel:       { fontSize: 13, fontWeight: '600', color: '#A99693' },
  catLabelActive: { color: '#FF6A88' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'white', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1.5, borderColor: 'rgba(255,154,139,0.2)',
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  input: {
    flex: 1, fontSize: 15, color: '#4A3B39',
    paddingVertical: 12,
  },
  textarea: { minHeight: 110, paddingTop: 12 },
  charCount: { fontSize: 11, color: '#C4B4B2', textAlign: 'right', marginTop: 4 },

  sendBtn:      { borderRadius: 16, overflow: 'hidden', shadowColor: '#FF6A88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  sendGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  sendText:     { color: 'white', fontSize: 16, fontWeight: '800' },

  successBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 60 },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#4A3B39', textAlign: 'center' },
  successSub:   { fontSize: 15, color: '#A99693', textAlign: 'center', lineHeight: 24 },
  backHome:     { marginTop: 16, backgroundColor: 'rgba(255,154,139,0.15)', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20 },
  backHomeText: { color: '#FF6A88', fontWeight: '700', fontSize: 15 },
  directContactBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.25)',
    alignItems: 'center',
  },
  directContactLabel: {
    fontSize: 13,
    color: '#6B5B59',
    fontWeight: '600',
    marginBottom: 4,
  },
});
