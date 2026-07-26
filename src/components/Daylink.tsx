import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Lock, Unlock, RefreshCw, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getById, getUnseen, QUESTIONS } from '../data/questions';
import { getScheduledQuestionId } from '../data/scheduledQuestions';
import type { Question } from '../data/questions';

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function coupleId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/** Sélectionne la question du jour :
 *  1. Si une question est planifiée pour cette date → l'utilise (même pour tous les couples)
 *  2. Sinon → choisit une question aléatoire non encore vue par ce couple
 */
async function pickDailyQuestion(
  cId: string,
  slotKey: string,
): Promise<string> {
  // Priorité aux questions planifiées globalement
  const scheduled = getScheduledQuestionId(slotKey);
  if (scheduled) {
    await setDoc(doc(db, 'couples', cId, 'daily', slotKey), {
      questionId: scheduled,
      createdAt: serverTimestamp(),
    });
    return scheduled;
  }

  // Fallback : question aléatoire non vue pour ce couple
  const progressSnap = await getDoc(doc(db, 'couples', cId, 'progress', 'seen'));
  const seenIds: string[] = progressSnap.exists() ? progressSnap.data().questionIds ?? [] : [];

  let unseen = getUnseen(seenIds);
  let newSeenIds = seenIds;

  if (unseen.length === 0) {
    // Toutes vues → repart de zéro
    unseen = [...QUESTIONS];
    newSeenIds = [];
  }

  const picked = unseen[Math.floor(Math.random() * unseen.length)];

  await setDoc(doc(db, 'couples', cId, 'progress', 'seen'), {
    questionIds: [...newSeenIds, picked.id],
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'couples', cId, 'daily', slotKey), {
    questionId: picked.id,
    createdAt: serverTimestamp(),
  });

  return picked.id;
}

// ─── composant ───────────────────────────────────────────────────────────────

export default function Daylink() {
  const theme = Colors.light;
  const myUid = useOnboardingStore((s) => s.uid);

  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);

  // slotKey = clé unique pour ce "slot" de question (date + index pour l'illimité)
  const [slotKey, setSlotKey] = useState(() => todayKey());
  const [questionIndex, setQuestionIndex] = useState(0); // incrémenté à chaque "Suivante"

  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);

  // ── Charger la question du slot courant ────────────────────────────────────
  const loadQuestion = useCallback(async (uid: string, pUid: string, slot: string) => {
    setLoadingQuestion(true);
    setMyAnswer('');
    setPartnerAnswer(null);
    setIsSubmitted(false);

    const cId = coupleId(uid, pUid);
    const dayRef = doc(db, 'couples', cId, 'daily', slot);
    const daySnap = await getDoc(dayRef);

    let questionId: string;

    if (daySnap.exists()) {
      questionId = daySnap.data().questionId;
    } else {
      questionId = await pickDailyQuestion(cId, slot);
    }

    const q = getById(questionId);
    setQuestion(q ?? null);

    // Vérifier si l'utilisateur a déjà répondu à ce slot
    const answerRef = doc(db, 'couples', cId, 'daily', slot, 'answers', uid);
    const myAnswerSnap = await getDoc(answerRef);
    if (myAnswerSnap.exists()) {
      setIsSubmitted(true);
      setMyAnswer(myAnswerSnap.data().text ?? '');
    }

    // Vérifier si le partenaire a déjà répondu
    const partnerAnswerRef = doc(db, 'couples', cId, 'daily', slot, 'answers', pUid);
    const partnerAnswerSnap = await getDoc(partnerAnswerRef);
    if (partnerAnswerSnap.exists()) {
      setPartnerAnswer(partnerAnswerSnap.data().text ?? '');
    }

    setLoadingQuestion(false);
  }, []);

  // ── Init : récupérer partenaire + charger la 1ère question ────────────────
  useEffect(() => {
    if (!myUid) return;

    const init = async () => {
      const myDoc = await getDoc(doc(db, 'users', myUid));
      if (!myDoc.exists()) return;
      const pUid = myDoc.data().linkedTo as string | undefined;
      if (!pUid) return;
      setPartnerUid(pUid);
      await loadQuestion(myUid, pUid, slotKey);
    };

    init();
  }, [myUid]); // seulement au mount

  // ── Écouter la réponse du partenaire en temps réel ────────────────────────
  useEffect(() => {
    if (!myUid || !partnerUid || !isSubmitted) return;

    const cId = coupleId(myUid, partnerUid);
    const partnerAnswerRef = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);

    const unsub = onSnapshot(partnerAnswerRef, (snap) => {
      if (snap.exists()) {
        setPartnerAnswer(snap.data().text ?? '');
      }
    });

    return () => unsub();
  }, [myUid, partnerUid, isSubmitted, slotKey]);

  // ── Soumettre ma réponse ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!myAnswer.trim() || !myUid || !partnerUid || !question) return;
    setSavingAnswer(true);
    try {
      const cId = coupleId(myUid, partnerUid);
      await setDoc(
        doc(db, 'couples', cId, 'daily', slotKey, 'answers', myUid),
        { text: myAnswer.trim(), submittedAt: serverTimestamp() }
      );
      setIsSubmitted(true);
    } catch (e) {
      console.error('Erreur envoi réponse :', e);
    } finally {
      setSavingAnswer(false);
    }
  };

  // ── Passer à la question suivante (mode illimité) ──────────────────────────
  const handleNextQuestion = async () => {
    if (!myUid || !partnerUid) return;
    setLoadingNext(true);

    const nextIndex = questionIndex + 1;
    // Nouvelle clé = date + index, ex: "2026-07-25_1", "2026-07-25_2"...
    const nextSlot = nextIndex === 0 ? todayKey() : `${todayKey()}_${nextIndex}`;

    const cId = coupleId(myUid, partnerUid);
    // Créer le slot pour la prochaine question (force un nouveau tirage)
    const nextQuestionId = await pickNextQuestion(cId, nextSlot);

    setQuestionIndex(nextIndex);
    setSlotKey(nextSlot);
    await loadQuestion(myUid, partnerUid, nextSlot);
    setLoadingNext(false);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadingQuestion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.tint} size="large" />
        <Text style={{ color: theme.text, marginTop: 16, opacity: 0.6 }}>
          Chargement de la question...
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
          {questionIndex > 0 && (
            <View style={styles.questionBadge}>
              <Text style={styles.questionBadgeText}>#{questionIndex + 1}</Text>
            </View>
          )}
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
                  : <Text style={styles.buttonText}>Envoyer avec amour 💌</Text>}
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} layout={Layout.springify()}>
              <View style={[styles.statusBox, { backgroundColor: 'rgba(255, 154, 139, 0.1)' }]}>
                <Lock color={theme.tint} size={20} />
                <Text style={[styles.statusText, { color: theme.tint }]}>
                  Ta réponse est scellée 🔒
                </Text>
              </View>

              {/* Réponse du partenaire — s'affiche quand dispo */}
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
                  <ActivityIndicator color={theme.tint} size="small" />
                  <Text style={[styles.waitingText, { color: '#A99693' }]}>
                    En attente de ton partenaire...
                  </Text>
                </View>
              )}

              {/* Bouton "Question suivante" — accessible dès que MOI j'ai répondu */}
              <Animated.View entering={FadeInUp.delay(300).duration(600)} style={{ marginTop: 16 }}>
                <Pressable
                  style={({ pressed }) => [styles.nextButton, { opacity: pressed || loadingNext ? 0.8 : 1, backgroundColor: theme.gradientEnd }]}
                  onPress={handleNextQuestion}
                  disabled={loadingNext}
                >
                  {loadingNext
                    ? <ActivityIndicator color="white" />
                    : (
                      <>
                        <Text style={styles.nextButtonText}>Question suivante</Text>
                        <ChevronRight color="white" size={20} />
                      </>
                    )}
                </Pressable>
              </Animated.View>
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
    borderRadius: 24, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  headerGradient: {
    padding: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  questionBadge: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginLeft: 8 },
  questionBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
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
  revealBox: { padding: 20, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#FF6A88', marginBottom: 4 },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  revealTitle: { fontSize: 16, fontWeight: 'bold' },
  partnerText: { fontSize: 18, fontStyle: 'italic', lineHeight: 26 },
  nextButton: {
    flexDirection: 'row', padding: 16, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', gap: 8,
    shadowColor: '#FF6A88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  nextButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
