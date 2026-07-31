import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Infinity as InfinityIcon, Lock, Unlock,
  ChevronRight, CheckCircle2, Clock, Split
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { db } from '../lib/firebase';
import {
  doc, getDoc, setDoc, onSnapshot,
  serverTimestamp, updateDoc, runTransaction,
} from 'firebase/firestore';

import { QUESTIONS } from '../data/questions';
import { POF_QUESTIONS } from '../data/pileouface';
import type { Question } from '../data/questions';
import type { PileOuFaceQuestion } from '../data/pileouface';

type AnyQuestion = Question | PileOuFaceQuestion;

function isPof(q: AnyQuestion): q is PileOuFaceQuestion {
  return 'optionA' in q;
}

function getQuestionById(id: string): AnyQuestion | null {
  const q1 = QUESTIONS.find(q => q.id === id);
  if (q1) return q1;
  const q2 = POF_QUESTIONS.find(q => q.id === id);
  if (q2) return q2;
  return null;
}

function coupleId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

function nowSlot(index: number, categoryFilter?: string): string {
  const d = new Date();
  const base = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cat = categoryFilter ? categoryFilter : 'all';
  return `unlimited_${base}_${cat}_${index}`;
}

async function pickUnlimitedQuestion(cId: string, slot: string, categoryFilter?: string): Promise<string> {
  return runTransaction(db, async (tx) => {
    const slotRef     = doc(db, 'couples', cId, 'daily', slot);
    const progressRef = doc(db, 'couples', cId, 'progress', 'seen');

    const slotDoc = await tx.get(slotRef);
    if (slotDoc.exists()) return slotDoc.data().questionId as string;

    const progressDoc = await tx.get(progressRef);
    const seenIds: string[] = progressDoc.exists() ? progressDoc.data().questionIds ?? [] : [];

    let available: AnyQuestion[] = [];
    if (!categoryFilter) {
      available = [...QUESTIONS, ...POF_QUESTIONS];
    } else if (categoryFilter === 'pile_ou_face') {
      available = [...POF_QUESTIONS];
    } else {
      available = QUESTIONS.filter(q => (q as Question).category === categoryFilter);
    }

    let unseen = available.filter(q => !seenIds.includes(q.id));
    let newSeenIds = seenIds;

    if (unseen.length === 0) {
      unseen = [...available];
      newSeenIds = seenIds.filter(id => !available.some(q => q.id === id)); // Reset just this category
    }

    if (unseen.length === 0) {
      unseen = [...QUESTIONS]; // Fallback ultime
      newSeenIds = [];
    }

    const picked = unseen[Math.floor(Math.random() * unseen.length)];
    tx.set(progressRef, { questionIds: [...newSeenIds, picked.id], updatedAt: new Date() });
    tx.set(slotRef, { questionId: picked.id, createdAt: new Date(), mode: 'unlimited', category: categoryFilter || 'all' });
    return picked.id;
  });
}

async function findCurrentIndex(uid: string, cId: string, categoryFilter?: string): Promise<number> {
  let idx = 0;
  while (idx < 200) {
    const slot = nowSlot(idx, categoryFilter);
    const myAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', uid));
    if (!myAns.exists()) break;
    idx++;
  }
  return idx;
}

export default function UnlimitedQuestions({ categoryFilter }: { categoryFilter?: string }) {
  const theme  = Colors.light;
  const store  = useOnboardingStore((s) => s);
  const myUid  = store.uid;
  const pseudo = store.pseudo ?? 'Moi';

  const [question, setQuestion]             = useState<AnyQuestion | null>(null);
  const [loadingQuestion, setLoading]       = useState(true);
  const [partnerUid, setPartnerUid]         = useState<string | null>(null);
  const [partnerPseudo, setPartnerPseudo]   = useState('Partenaire');

  const [questionIndex, setQuestionIndex]   = useState(0);
  const [slotKey, setSlotKey]               = useState('');

  // Ma réponse
  const [myAnswer, setMyAnswer]             = useState('');
  const [isSubmitted, setIsSubmitted]       = useState(false);
  const [savingAnswer, setSavingAnswer]     = useState(false);

  // État partenaire (temps réel)
  const [partnerHasAnswered, setPartnerHasAnswered] = useState(false);
  const [partnerAnswer, setPartnerAnswer]           = useState<string | null>(null);

  const [loadingNext, setLoadingNext]       = useState(false);

  const isSubmittedRef = useRef(false);
  useEffect(() => { isSubmittedRef.current = isSubmitted; }, [isSubmitted]);

  const loadSlot = useCallback(async (uid: string, pUid: string, idx: number) => {
    setLoading(true);
    setMyAnswer('');
    setPartnerAnswer(null);
    setPartnerHasAnswered(false);
    setIsSubmitted(false);
    isSubmittedRef.current = false;

    const cId = coupleId(uid, pUid);
    const slot = nowSlot(idx, categoryFilter);
    setSlotKey(slot);
    setQuestionIndex(idx);

    const questionId = await pickUnlimitedQuestion(cId, slot, categoryFilter);
    setQuestion(getQuestionById(questionId));

    const myAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', uid));
    if (myAns.exists()) {
      setIsSubmitted(true);
      isSubmittedRef.current = true;
      setMyAnswer(myAns.data().text ?? myAns.data().choice ?? '');
    }

    const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', pUid));
    if (pAns.exists()) {
      setPartnerHasAnswered(true);
      if (isSubmittedRef.current) setPartnerAnswer(pAns.data().text ?? pAns.data().choice ?? '');
    }

    setLoading(false);
  }, [categoryFilter]);

  useEffect(() => {
    if (!myUid) return;
    const init = async () => {
      const myDoc = await getDoc(doc(db, 'users', myUid));
      if (!myDoc.exists()) return;
      const pUid = myDoc.data().linkedTo as string | undefined;
      if (!pUid) return;
      setPartnerUid(pUid);
      const pDoc = await getDoc(doc(db, 'users', pUid));
      if (pDoc.exists()) setPartnerPseudo(pDoc.data().pseudo ?? 'Partenaire');

      const cId = coupleId(myUid, pUid);
      const currentIdx = await findCurrentIndex(myUid, cId, categoryFilter);
      await loadSlot(myUid, pUid, currentIdx);
    };
    init();
  }, [myUid, categoryFilter, loadSlot]);

  useEffect(() => {
    if (!myUid || !partnerUid || !slotKey) return;
    const cId = coupleId(myUid, partnerUid);
    const ref = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setPartnerHasAnswered(true);
        if (isSubmittedRef.current) setPartnerAnswer(snap.data().text ?? snap.data().choice ?? '');
      } else {
        setPartnerHasAnswered(false);
        setPartnerAnswer(null);
      }
    });
    return () => unsub();
  }, [myUid, partnerUid, slotKey]);

  const handleSubmit = async (choice?: string) => {
    const finalAnswer = choice || myAnswer;
    if (!finalAnswer.trim() || !myUid || !partnerUid || !question || !slotKey) return;
    
    setSavingAnswer(true);
    if (choice) setMyAnswer(choice);

    try {
      const cId = coupleId(myUid, partnerUid);
      const dataPayload = question && isPof(question) ? { choice: finalAnswer, submittedAt: serverTimestamp() } : { text: finalAnswer.trim(), submittedAt: serverTimestamp() };
      await setDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', myUid), dataPayload);
      setIsSubmitted(true);
      isSubmittedRef.current = true;

      if (partnerHasAnswered) {
        const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid));
        if (pAns.exists()) {
          setPartnerAnswer(pAns.data().text ?? pAns.data().choice ?? '');
          await updateDoc(doc(db, 'couples', cId, 'daily', slotKey), { bothAnswered: true });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAnswer(false);
    }
  };

  useEffect(() => {
    if (!partnerHasAnswered || !isSubmitted || !myUid || !partnerUid || !slotKey) return;
    const cId = coupleId(myUid, partnerUid);
    getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid)).then((snap) => {
      if (snap.exists()) {
        setPartnerAnswer(snap.data().text ?? snap.data().choice ?? '');
        updateDoc(doc(db, 'couples', cId, 'daily', slotKey), { bothAnswered: true }).catch(() => {});
      }
    });
  }, [partnerHasAnswered, isSubmitted]);

  const handleNext = async () => {
    if (!myUid || !partnerUid || !partnerAnswer) return;
    setLoadingNext(true);
    const nextIdx = questionIndex + 1;
    await loadSlot(myUid, partnerUid, nextIdx);
    setLoadingNext(false);
  };

  if (loadingQuestion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#A855F7" size="large" />
        <Text style={{ color: '#4A3B39', marginTop: 16, opacity: 0.6 }}>Chargement...</Text>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <Text style={{ color: '#4A3B39', textAlign: 'center', opacity: 0.6 }}>Impossible de charger une question.</Text>
      </View>
    );
  }

  const bothAnswered = isSubmitted && partnerAnswer !== null;
  const isPofQuestion = isPof(question);

  const getPofText = (ans: string) => {
    if (!isPofQuestion) return ans;
    return ans === 'A' ? question.optionA : question.optionB;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(600).springify()} layout={Layout.springify()} style={styles.card}>
          <LinearGradient colors={isPofQuestion ? ['#0EA5E9', '#38BDF8'] : ['#A855F7', '#D946EF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            {isPofQuestion ? <Split color="white" size={22} /> : <InfinityIcon color="white" size={22} />}
            <Text style={styles.headerTitle}>{categoryFilter ? categoryFilter.toUpperCase() : 'ILLIMITÉ'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Q.{questionIndex + 1}</Text>
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.statusRow}>
              <View style={[styles.pill, isSubmitted ? styles.pillDone : styles.pillWaiting]}>
                {isSubmitted ? <CheckCircle2 color="#22c55e" size={14} /> : <Clock color="#9CA3AF" size={14} />}
                <Text style={[styles.pillText, { color: isSubmitted ? '#22c55e' : '#9CA3AF' }]}>{pseudo} {isSubmitted ? '✓' : '...'}</Text>
              </View>
              <View style={[styles.pill, partnerHasAnswered ? styles.pillDone : styles.pillWaiting]}>
                {partnerHasAnswered ? <CheckCircle2 color="#22c55e" size={14} /> : <Clock color="#9CA3AF" size={14} />}
                <Text style={[styles.pillText, { color: partnerHasAnswered ? '#22c55e' : '#9CA3AF' }]}>{partnerPseudo} {partnerHasAnswered ? '✓' : '...'}</Text>
              </View>
            </View>

            <Text style={styles.question}>{isPofQuestion ? question.question : question.text}</Text>

            {!isSubmitted ? (
              <Animated.View entering={FadeIn.delay(200)}>
                {isPofQuestion ? (
                  <View style={styles.optionsRow}>
                    <Pressable style={({ pressed }) => [styles.optionBtn, { opacity: pressed ? 0.8 : 1 }]} onPress={() => handleSubmit('A')} disabled={savingAnswer}>
                      <Text style={styles.optionBtnText}>{question.optionA}</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.optionBtn, { opacity: pressed ? 0.8 : 1, backgroundColor: '#0EA5E9' }]} onPress={() => handleSubmit('B')} disabled={savingAnswer}>
                      <Text style={styles.optionBtnText}>{question.optionB}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={[styles.input, { borderColor: theme.cardBorder, color: theme.text, backgroundColor: 'rgba(0,0,0,0.02)' }]}
                      placeholder="Ta réponse..."
                      placeholderTextColor="#A99693"
                      value={myAnswer}
                      onChangeText={setMyAnswer}
                      multiline
                      maxLength={500}
                    />
                    <Pressable
                      style={({ pressed }) => [styles.submitButton, { opacity: pressed || !myAnswer.trim() || savingAnswer ? 0.7 : 1 }]}
                      onPress={() => handleSubmit()}
                      disabled={!myAnswer.trim() || savingAnswer}
                    >
                      {savingAnswer ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>Valider ma réponse</Text>}
                    </Pressable>
                  </>
                )}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} layout={Layout.springify()}>
                <View style={[styles.myAnswerBox, isPofQuestion && { borderColor: '#0EA5E9', backgroundColor: 'rgba(14,165,233,0.05)' }]}>
                  <Text style={[styles.myAnswerLabel, isPofQuestion && { color: '#0EA5E9' }]}>Ta réponse 🔒</Text>
                  <Text style={styles.myAnswerText}>{getPofText(myAnswer)}</Text>
                </View>

                {partnerAnswer !== null ? (
                  <Animated.View entering={FadeInUp.duration(500)} style={[styles.revealBox, isPofQuestion && { borderLeftColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.05)' }]}>
                    <View style={styles.revealHeader}>
                      <Unlock color={isPofQuestion ? '#38BDF8' : '#D946EF'} size={16} />
                      <Text style={[styles.revealTitle, isPofQuestion && { color: '#0EA5E9' }]}>{partnerPseudo} a répondu !</Text>
                    </View>
                    <Text style={styles.partnerText}>{getPofText(partnerAnswer)}</Text>
                  </Animated.View>
                ) : (
                  <View style={styles.waitingBox}>
                    <ActivityIndicator color={isPofQuestion ? '#0EA5E9' : '#A855F7'} size="small" />
                    <Text style={{ color: '#A99693', fontSize: 14, fontStyle: 'italic' }}>{partnerPseudo} n'a pas encore répondu...</Text>
                  </View>
                )}

                <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ marginTop: 16 }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.nextButton,
                      isPofQuestion && { backgroundColor: '#0EA5E9', shadowColor: '#0EA5E9' },
                      !bothAnswered && styles.nextButtonDisabled,
                      { opacity: pressed || loadingNext || !bothAnswered ? 0.55 : 1 },
                    ]}
                    onPress={handleNext}
                    disabled={loadingNext || !bothAnswered}
                  >
                    {loadingNext ? <ActivityIndicator color="white" /> : (
                      <>
                        <Text style={styles.nextButtonText}>{bothAnswered ? 'Question suivante' : `En attente de ${partnerPseudo}...`}</Text>
                        {bothAnswered && <ChevronRight color="white" size={20} />}
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
  card: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.95)', shadowColor: '#A855F7', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  headerGradient: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  badge: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginLeft: 8 },
  badgeText: { color: 'white', fontWeight: '900', fontSize: 14 },
  content: { padding: 24, paddingTop: 20 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 16, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillDone: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e' },
  pillWaiting: { backgroundColor: 'rgba(156,163,175,0.1)', borderColor: '#9CA3AF' },
  pillText: { fontSize: 12, fontWeight: '600' },
  question: { fontSize: 19, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 28, color: '#4A3B39' },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, textAlignVertical: 'top', marginBottom: 16, lineHeight: 24 },
  submitButton: { backgroundColor: '#A855F7', padding: 16, borderRadius: 16, alignItems: 'center' },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  
  optionsRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  optionBtn: { flex: 1, backgroundColor: '#38BDF8', paddingVertical: 24, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, minHeight: 120 },
  optionBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center', lineHeight: 22 },

  myAnswerBox: { borderWidth: 1.5, borderColor: '#A855F7', borderRadius: 16, padding: 16, marginBottom: 16, backgroundColor: 'rgba(168,85,247,0.05)' },
  myAnswerLabel: { fontSize: 11, fontWeight: '800', color: '#A855F7', marginBottom: 6, letterSpacing: 0.5 },
  myAnswerText: { fontSize: 16, fontWeight: '700', color: '#4A3B39', lineHeight: 24, textAlign: 'center' },
  waitingBox: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  revealBox: { padding: 18, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#D946EF', backgroundColor: 'rgba(217,70,239,0.05)', marginBottom: 4 },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  revealTitle: { fontSize: 15, fontWeight: 'bold', color: '#A855F7' },
  partnerText: { fontSize: 17, fontWeight: '700', lineHeight: 25, color: '#4A3B39', textAlign: 'center' },
  nextButton: { flexDirection: 'row', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#A855F7', shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
  nextButtonDisabled: { backgroundColor: '#E9D5FF', shadowOpacity: 0 },
  nextButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
