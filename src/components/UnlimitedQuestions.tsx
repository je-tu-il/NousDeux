import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Infinity as InfinityIcon, Lock, Unlock, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getById, getUnseen, QUESTIONS } from '../data/questions';
import type { Question } from '../data/questions';

// ─── helpers ─────────────────────────────────────────────────────────────────

function coupleId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

function nowSlot(index: number): string {
  const d = new Date();
  const base = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return index === 0 ? `unlimited_${base}_0` : `unlimited_${base}_${index}`;
}

async function pickNextUnlimitedQuestion(cId: string, slot: string): Promise<string> {
  const progressSnap = await getDoc(doc(db, 'couples', cId, 'progress', 'seen'));
  const seenIds: string[] = progressSnap.exists() ? progressSnap.data().questionIds ?? [] : [];

  let unseen = getUnseen(seenIds);
  let newSeenIds = seenIds;

  if (unseen.length === 0) {
    // Toutes vues → on repart de zéro !
    unseen = [...QUESTIONS];
    newSeenIds = [];
  }

  const picked = unseen[Math.floor(Math.random() * unseen.length)];

  await setDoc(doc(db, 'couples', cId, 'progress', 'seen'), {
    questionIds: [...newSeenIds, picked.id],
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(db, 'couples', cId, 'daily', slot), {
    questionId: picked.id,
    createdAt: serverTimestamp(),
    mode: 'unlimited',
  });

  return picked.id;
}

// ─── composant ───────────────────────────────────────────────────────────────

export default function UnlimitedQuestions() {
  const theme = Colors.light;
  const myUid = useOnboardingStore((s) => s.uid);

  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [slotKey, setSlotKey] = useState(() => nowSlot(0));

  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);

  // ── Chargement d'un slot ──────────────────────────────────────────────────
  const loadSlot = useCallback(async (uid: string, pUid: string, slot: string) => {
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
      questionId = await pickNextUnlimitedQuestion(cId, slot);
    }

    setQuestion(getById(questionId) ?? null);

    // Ma réponse déjà envoyée ?
    const myAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', uid));
    if (myAns.exists()) {
      setIsSubmitted(true);
      setMyAnswer(myAns.data().text ?? '');
    }

    // Réponse du partenaire déjà là ?
    const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', pUid));
    if (pAns.exists()) {
      setPartnerAnswer(pAns.data().text ?? '');
    }

    setLoadingQuestion(false);
  }, []);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myUid) return;
    const init = async () => {
      const myDoc = await getDoc(doc(db, 'users', myUid));
      if (!myDoc.exists()) return;
      const pUid = myDoc.data().linkedTo as string | undefined;
      if (!pUid) return;
      setPartnerUid(pUid);
      await loadSlot(myUid, pUid, slotKey);
    };
    init();
  }, [myUid]);

  // ── Listener réponse partenaire ───────────────────────────────────────────
  useEffect(() => {
    if (!myUid || !partnerUid || !isSubmitted) return;
    const cId = coupleId(myUid, partnerUid);
    const ref = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setPartnerAnswer(snap.data().text ?? '');
    });
    return () => unsub();
  }, [myUid, partnerUid, isSubmitted, slotKey]);

  // ── Envoyer ma réponse ────────────────────────────────────────────────────
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
      console.error(e);
    } finally {
      setSavingAnswer(false);
    }
  };

  // ── Question suivante ─────────────────────────────────────────────────────
  const handleNext = async () => {
    if (!myUid || !partnerUid) return;
    setLoadingNext(true);
    const nextIdx = questionIndex + 1;
    const nextSlot = nowSlot(nextIdx);
    const cId = coupleId(myUid, partnerUid);
    await pickNextUnlimitedQuestion(cId, nextSlot);
    setQuestionIndex(nextIdx);
    setSlotKey(nextSlot);
    await loadSlot(myUid, partnerUid, nextSlot);
    setLoadingNext(false);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadingQuestion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.tint} size="large" />
        <Text style={{ color: theme.text, marginTop: 16, opacity: 0.6 }}>Chargement...</Text>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <Text style={{ color: theme.text, textAlign: 'center', fontSize: 16, opacity: 0.6 }}>
          Impossible de charger une question.{'\n'}Vérifie ta connexion.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={FadeInUp.duration(600).springify()}
          layout={Layout.springify()}
          style={[styles.card, { borderColor: theme.cardBorder }]}
        >
          {/* Header */}
          <LinearGradient
            colors={['#A855F7', '#EC4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <InfinityIcon color="white" size={24} />
            <Text style={styles.headerTitle}>Questions Illimitées</Text>
            {questionIndex > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>#{questionIndex + 1}</Text>
              </View>
            )}
          </LinearGradient>

          {/* Catégorie */}
          <View style={styles.categoryRow}>
            <Text style={[styles.categoryTag, { color: '#A855F7' }]}>
              {question.category.toUpperCase()}
            </Text>
          </View>

          <View style={styles.content}>
            <Text style={[styles.question, { color: theme.text }]}>{question.text}</Text>

            {!isSubmitted ? (
              <Animated.View entering={FadeIn.delay(200)}>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.05)' }]}
                  placeholder="Ta réponse..."
                  placeholderTextColor="#C4A8C4"
                  value={myAnswer}
                  onChangeText={setMyAnswer}
                  multiline
                />
                <Pressable
                  style={({ pressed }) => [styles.button, { backgroundColor: '#A855F7', opacity: pressed ? 0.8 : 1 }]}
                  onPress={handleSubmit}
                  disabled={savingAnswer}
                >
                  {savingAnswer
                    ? <ActivityIndicator color="white" />
                    : <Text style={styles.buttonText}>Envoyer 💜</Text>}
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} layout={Layout.springify()}>
                {/* Statut */}
                <View style={[styles.statusBox, { backgroundColor: 'rgba(168,85,247,0.08)' }]}>
                  <Lock color="#A855F7" size={18} />
                  <Text style={[styles.statusText, { color: '#A855F7' }]}>Ta réponse est scellée 🔒</Text>
                </View>

                {/* Réponse partenaire */}
                {partnerAnswer ? (
                  <Animated.View entering={FadeInUp.duration(500)} style={styles.revealBox}>
                    <View style={styles.revealHeader}>
                      <Unlock color="#EC4899" size={16} />
                      <Text style={[styles.revealTitle, { color: '#EC4899' }]}>Réponse dévoilée !</Text>
                    </View>
                    <Text style={[styles.partnerText, { color: theme.text }]}>"{partnerAnswer}"</Text>
                  </Animated.View>
                ) : (
                  <View style={styles.waitingBox}>
                    <ActivityIndicator color="#A855F7" size="small" />
                    <Text style={{ color: '#A99693', fontSize: 14, fontStyle: 'italic' }}>
                      Ton partenaire n'a pas encore répondu...
                    </Text>
                  </View>
                )}

                {/* Question suivante — accessible dès que j'ai répondu */}
                <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ marginTop: 16 }}>
                  <Pressable
                    style={({ pressed }) => [styles.nextButton, { opacity: pressed || loadingNext ? 0.8 : 1 }]}
                    onPress={handleNext}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: 24, borderWidth: 1, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  headerGradient: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  badge: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginLeft: 8 },
  badgeText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  categoryRow: { paddingHorizontal: 24, paddingTop: 16 },
  categoryTag: { fontSize: 11, fontWeight: '800', letterSpacing: 2, opacity: 0.7 },
  content: { padding: 24, paddingTop: 8 },
  question: { fontSize: 19, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 28 },
  input: { borderWidth: 1.5, padding: 16, borderRadius: 16, minHeight: 110, fontSize: 16, marginBottom: 16 },
  button: { padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  statusBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, gap: 8, marginBottom: 16 },
  statusText: { fontSize: 15, fontWeight: '600' },
  waitingBox: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  revealBox: { padding: 18, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#EC4899', backgroundColor: 'rgba(236,72,153,0.05)', marginBottom: 4 },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  revealTitle: { fontSize: 15, fontWeight: 'bold' },
  partnerText: { fontSize: 17, fontStyle: 'italic', lineHeight: 25 },
  nextButton: {
    flexDirection: 'row', padding: 16, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
  },
  nextButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
