import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Lock, Unlock, RefreshCw } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getById, getUnseen } from '../data/questions';
import type { Question } from '../data/questions';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Retourne la date du jour en format "YYYY-MM-DD" (heure locale) */
function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Génère un ID de couple stable à partir de 2 UIDs (trié alphabétiquement) */
function coupleId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

// ─── composant ───────────────────────────────────────────────────────────────

export default function Daylink() {
  const theme = Colors.light;
  const myUid = useOnboardingStore((s) => s.uid);

  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);

  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);

  const dateKey = todayKey();

  // ── 1. Charger le partenaire + la question du jour ─────────────────────────
  useEffect(() => {
    if (!myUid) return;

    const loadEverything = async () => {
      setLoadingQuestion(true);

      // Récupérer mon partenaire
      const myDoc = await getDoc(doc(db, 'users', myUid));
      if (!myDoc.exists()) return;
      const pUid = myDoc.data().linkedTo as string | undefined;
      if (!pUid) return;
      setPartnerUid(pUid);

      const cId = coupleId(myUid, pUid);

      // Récupérer ou créer la question du jour pour ce couple
      const dayRef = doc(db, 'couples', cId, 'daily', dateKey);
      const daySnap = await getDoc(dayRef);

      let questionId: string;

      if (daySnap.exists()) {
        // Question déjà attribuée pour aujourd'hui
        questionId = daySnap.data().questionId;
      } else {
        // Sélectionner une nouvelle question non vue par ce couple
        const progressSnap = await getDoc(doc(db, 'couples', cId, 'progress', 'seen'));
        const seenIds: string[] = progressSnap.exists()
          ? progressSnap.data().questionIds ?? []
          : [];

        const unseen = getUnseen(seenIds);

        if (unseen.length === 0) {
          // Toutes les questions ont été vues — on repart de zéro !
          const { QUESTIONS } = await import('../data/questions');
          const randomQ = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
          questionId = randomQ.id;
          // Reset le suivi pour ce couple
          await setDoc(doc(db, 'couples', cId, 'progress', 'seen'), {
            questionIds: [questionId],
            updatedAt: serverTimestamp(),
          });
        } else {
          // Choisir une question aléatoire parmi les non-vues
          const picked = unseen[Math.floor(Math.random() * unseen.length)];
          questionId = picked.id;
          // Marquer comme vue
          await setDoc(doc(db, 'couples', cId, 'progress', 'seen'), {
            questionIds: [...seenIds, questionId],
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }

        // Enregistrer la question du jour pour ce couple
        await setDoc(dayRef, {
          questionId,
          createdAt: serverTimestamp(),
        });
      }

      // Charger la question depuis le fichier local
      const q = getById(questionId);
      setQuestion(q ?? null);

      // Vérifier si on a déjà répondu aujourd'hui
      const answerRef = doc(db, 'couples', cId, 'daily', dateKey, 'answers', myUid);
      const myAnswerSnap = await getDoc(answerRef);
      if (myAnswerSnap.exists()) {
        setIsSubmitted(true);
        setAlreadyAnswered(true);
        setMyAnswer(myAnswerSnap.data().text ?? '');
      }

      setLoadingQuestion(false);
    };

    loadEverything();
  }, [myUid, dateKey]);

  // ── 2. Écouter la réponse du partenaire en temps réel ─────────────────────
  useEffect(() => {
    if (!myUid || !partnerUid || !isSubmitted) return;

    const cId = coupleId(myUid, partnerUid);
    const partnerAnswerRef = doc(db, 'couples', cId, 'daily', dateKey, 'answers', partnerUid);

    const unsub = onSnapshot(partnerAnswerRef, (snap) => {
      if (snap.exists()) {
        setPartnerAnswer(snap.data().text ?? '');
      }
    });

    return () => unsub();
  }, [myUid, partnerUid, isSubmitted, dateKey]);

  // ── 3. Soumettre ma réponse ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!myAnswer.trim() || !myUid || !partnerUid || !question) return;
    setSavingAnswer(true);
    try {
      const cId = coupleId(myUid, partnerUid);
      await setDoc(
        doc(db, 'couples', cId, 'daily', dateKey, 'answers', myUid),
        { text: myAnswer.trim(), submittedAt: serverTimestamp() }
      );
      setIsSubmitted(true);
    } catch (e) {
      console.error('Erreur envoi réponse :', e);
    } finally {
      setSavingAnswer(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadingQuestion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.tint} size="large" />
        <Text style={{ color: theme.text, marginTop: 16, opacity: 0.6 }}>
          Chargement de la question du jour...
        </Text>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <RefreshCw color={theme.tint} size={40} />
        <Text style={{ color: theme.text, marginTop: 16, textAlign: 'center', fontSize: 16 }}>
          Impossible de charger la question.{'\n'}Vérifie ta connexion et réessaie.
        </Text>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Question du Jour</Text>
        </LinearGradient>

        <View style={styles.content}>
          <Text style={[styles.question, { color: theme.text }]}>{question.text}</Text>

          {!isSubmitted ? (
            <Animated.View entering={FadeIn.delay(300)}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.tint, backgroundColor: 'rgba(255,255,255,0.5)' }]}
                placeholder="Écris ce que tu ressens..."
                placeholderTextColor="#A99693"
                value={myAnswer}
                onChangeText={setMyAnswer}
                multiline
              />
              <Pressable
                style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1, backgroundColor: theme.tint }]}
                onPress={handleSubmit}
                disabled={savingAnswer}
              >
                {savingAnswer
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.buttonText}>Envoyer avec amour 💌</Text>
                }
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} layout={Layout.springify()}>
              <View style={[styles.statusBox, { backgroundColor: 'rgba(255, 154, 139, 0.1)' }]}>
                <Lock color={theme.tint} size={20} />
                <Text style={[styles.statusText, { color: theme.tint }]}>
                  {alreadyAnswered ? 'Tu as déjà répondu aujourd\'hui 🔒' : 'Ta réponse est scellée 🔒'}
                </Text>
              </View>

              {partnerAnswer ? (
                <Animated.View
                  entering={FadeInUp.duration(600)}
                  style={[styles.revealBox, { backgroundColor: theme.background }]}
                >
                  <View style={styles.revealHeader}>
                    <Unlock color={theme.gradientEnd} size={18} />
                    <Text style={[styles.revealTitle, { color: theme.gradientEnd }]}>Réponse dévoilée !</Text>
                  </View>
                  <Text style={[styles.partnerText, { color: theme.text }]}>"{partnerAnswer}"</Text>
                </Animated.View>
              ) : (
                <View style={styles.waitingBox}>
                  <ActivityIndicator color={theme.tint} />
                  <Text style={[styles.waitingText, { color: '#A99693' }]}>
                    En attente de ton partenaire...
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  headerGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  content: { padding: 24 },
  question: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 28 },
  input: { borderWidth: 1, padding: 16, borderRadius: 16, minHeight: 120, fontSize: 16, marginBottom: 20 },
  button: {
    padding: 18, borderRadius: 16, alignItems: 'center',
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  statusBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 16, gap: 8, marginBottom: 20,
  },
  statusText: { fontSize: 16, fontWeight: '600' },
  waitingBox: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  waitingText: { fontSize: 15, fontStyle: 'italic' },
  revealBox: { padding: 20, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#FF6A88' },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  revealTitle: { fontSize: 16, fontWeight: 'bold' },
  partnerText: { fontSize: 18, fontStyle: 'italic', lineHeight: 26 },
});
