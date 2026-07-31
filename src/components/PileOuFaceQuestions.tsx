import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  Pressable, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Split, Lock, Unlock,
  ChevronRight, CheckCircle2, Clock,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { db } from '../lib/firebase';
import {
  doc, getDoc, setDoc, onSnapshot,
  serverTimestamp, updateDoc, runTransaction,
} from 'firebase/firestore';
import { getPofById, getPofUnseen, POF_QUESTIONS } from '../data/pileouface';
import type { PileOuFaceQuestion } from '../data/pileouface';

function coupleId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

function nowSlot(index: number): string {
  const d = new Date();
  const base = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `pof_${base}_${index}`;
}

async function pickPofQuestion(cId: string, slot: string): Promise<string> {
  return runTransaction(db, async (tx) => {
    const slotRef     = doc(db, 'couples', cId, 'daily', slot);
    const progressRef = doc(db, 'couples', cId, 'progress', 'seen_pof');

    const slotDoc = await tx.get(slotRef);
    if (slotDoc.exists()) return slotDoc.data().questionId as string;

    const progressDoc = await tx.get(progressRef);
    const seenIds: string[] = progressDoc.exists() ? progressDoc.data().questionIds ?? [] : [];
    let unseen = getPofUnseen(seenIds);
    let newSeenIds = seenIds;
    if (unseen.length === 0) { unseen = [...POF_QUESTIONS]; newSeenIds = []; }
    const picked = unseen[Math.floor(Math.random() * unseen.length)];
    tx.set(progressRef, { questionIds: [...newSeenIds, picked.id], updatedAt: new Date() });
    tx.set(slotRef, { questionId: picked.id, createdAt: new Date(), mode: 'pof' });
    return picked.id;
  });
}

async function findCurrentIndex(uid: string, cId: string): Promise<number> {
  let idx = 0;
  while (idx < 200) {
    const slot = nowSlot(idx);
    const myAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', uid));
    if (!myAns.exists()) break;
    idx++;
  }
  return idx;
}

export default function PileOuFaceQuestions() {
  const store  = useOnboardingStore((s) => s);
  const myUid  = store.uid;
  const pseudo = store.pseudo ?? 'Moi';

  const [question, setQuestion]             = useState<PileOuFaceQuestion | null>(null);
  const [loadingQuestion, setLoading]       = useState(true);
  const [partnerUid, setPartnerUid]         = useState<string | null>(null);
  const [partnerPseudo, setPartnerPseudo]   = useState('Partenaire');

  const [questionIndex, setQuestionIndex]   = useState(0);
  const [slotKey, setSlotKey]               = useState('');

  const [myAnswer, setMyAnswer]             = useState<'A' | 'B' | null>(null);
  const [isSubmitted, setIsSubmitted]       = useState(false);
  const [savingAnswer, setSavingAnswer]     = useState(false);

  const [partnerHasAnswered, setPartnerHasAnswered] = useState(false);
  const [partnerAnswer, setPartnerAnswer]           = useState<'A' | 'B' | null>(null);

  const [loadingNext, setLoadingNext]       = useState(false);

  const isSubmittedRef = useRef(false);
  useEffect(() => { isSubmittedRef.current = isSubmitted; }, [isSubmitted]);

  const loadSlot = useCallback(async (uid: string, pUid: string, idx: number) => {
    setLoading(true);
    setMyAnswer(null);
    setPartnerAnswer(null);
    setPartnerHasAnswered(false);
    setIsSubmitted(false);
    isSubmittedRef.current = false;

    const cId = coupleId(uid, pUid);
    const slot = nowSlot(idx);
    setSlotKey(slot);
    setQuestionIndex(idx);

    const questionId = await pickPofQuestion(cId, slot);
    setQuestion(getPofById(questionId) ?? null);

    const myAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', uid));
    if (myAns.exists()) {
      setIsSubmitted(true);
      isSubmittedRef.current = true;
      setMyAnswer(myAns.data().choice as 'A' | 'B');
    }

    const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', pUid));
    if (pAns.exists()) {
      setPartnerHasAnswered(true);
      if (isSubmittedRef.current) setPartnerAnswer(pAns.data().choice as 'A' | 'B');
    }

    setLoading(false);
  }, []);

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
      const currentIdx = await findCurrentIndex(myUid, cId);
      await loadSlot(myUid, pUid, currentIdx);
    };
    init();
  }, [myUid]);

  useEffect(() => {
    if (!myUid || !partnerUid || !slotKey) return;
    const cId = coupleId(myUid, partnerUid);
    const ref = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setPartnerHasAnswered(true);
        if (isSubmittedRef.current) setPartnerAnswer(snap.data().choice as 'A' | 'B');
      } else {
        setPartnerHasAnswered(false);
        setPartnerAnswer(null);
      }
    });
    return () => unsub();
  }, [myUid, partnerUid, slotKey]);

  const handleSelect = async (choice: 'A' | 'B') => {
    if (!myUid || !partnerUid || !question || !slotKey) return;
    setSavingAnswer(true);
    setMyAnswer(choice);
    try {
      const cId = coupleId(myUid, partnerUid);
      await setDoc(
        doc(db, 'couples', cId, 'daily', slotKey, 'answers', myUid),
        { choice, submittedAt: serverTimestamp() }
      );
      setIsSubmitted(true);
      isSubmittedRef.current = true;

      if (partnerHasAnswered) {
        const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid));
        if (pAns.exists()) {
          setPartnerAnswer(pAns.data().choice as 'A' | 'B');
          await updateDoc(doc(db, 'couples', cId, 'daily', slotKey), { bothAnswered: true });
        }
      }
    } catch (e) {
      console.error(e);
      setMyAnswer(null);
    } finally {
      setSavingAnswer(false);
    }
  };

  useEffect(() => {
    if (!partnerHasAnswered || !isSubmitted || !myUid || !partnerUid || !slotKey) return;
    const cId = coupleId(myUid, partnerUid);
    getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid)).then((snap) => {
      if (snap.exists()) {
        setPartnerAnswer(snap.data().choice as 'A' | 'B');
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
        <ActivityIndicator color="#0EA5E9" size="large" />
        <Text style={{ color: '#4A3B39', marginTop: 16, opacity: 0.6 }}>Chargement...</Text>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <Text style={{ color: '#4A3B39', textAlign: 'center', opacity: 0.6 }}>
          Impossible de charger une question.
        </Text>
      </View>
    );
  }

  const bothAnswered = isSubmitted && partnerAnswer !== null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(600).springify()} layout={Layout.springify()} style={styles.card}>
          <LinearGradient colors={['#0EA5E9', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            <Split color="white" size={22} />
            <Text style={styles.headerTitle}>Pile ou Face</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Q.{questionIndex + 1}</Text>
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.statusRow}>
              <View style={[styles.pill, isSubmitted ? styles.pillDone : styles.pillWaiting]}>
                {isSubmitted ? <CheckCircle2 color="#22c55e" size={14} /> : <Clock color="#9CA3AF" size={14} />}
                <Text style={[styles.pillText, { color: isSubmitted ? '#22c55e' : '#9CA3AF' }]}>
                  {pseudo} {isSubmitted ? '✓' : '...'}
                </Text>
              </View>
              <View style={[styles.pill, partnerHasAnswered ? styles.pillDone : styles.pillWaiting]}>
                {partnerHasAnswered ? <CheckCircle2 color="#22c55e" size={14} /> : <Clock color="#9CA3AF" size={14} />}
                <Text style={[styles.pillText, { color: partnerHasAnswered ? '#22c55e' : '#9CA3AF' }]}>
                  {partnerPseudo} {partnerHasAnswered ? '✓' : '...'}
                </Text>
              </View>
            </View>

            <Text style={styles.question}>{question.question}</Text>

            {!isSubmitted ? (
              <Animated.View entering={FadeIn.delay(200)} style={styles.optionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.optionBtn, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => handleSelect('A')}
                  disabled={savingAnswer}
                >
                  <Text style={styles.optionBtnText}>{question.optionA}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.optionBtn, { opacity: pressed ? 0.8 : 1, backgroundColor: '#0EA5E9' }]}
                  onPress={() => handleSelect('B')}
                  disabled={savingAnswer}
                >
                  <Text style={styles.optionBtnText}>{question.optionB}</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} layout={Layout.springify()}>
                <View style={styles.myAnswerBox}>
                  <Text style={styles.myAnswerLabel}>Ta réponse 🔒</Text>
                  <Text style={styles.myAnswerText}>{myAnswer === 'A' ? question.optionA : question.optionB}</Text>
                </View>

                {partnerAnswer !== null ? (
                  <Animated.View entering={FadeInUp.duration(500)} style={styles.revealBox}>
                    <View style={styles.revealHeader}>
                      <Unlock color="#38BDF8" size={16} />
                      <Text style={styles.revealTitle}>{partnerPseudo} a répondu !</Text>
                    </View>
                    <Text style={styles.partnerText}>{partnerAnswer === 'A' ? question.optionA : question.optionB}</Text>
                  </Animated.View>
                ) : (
                  <View style={styles.waitingBox}>
                    <ActivityIndicator color="#0EA5E9" size="small" />
                    <Text style={{ color: '#A99693', fontSize: 14, fontStyle: 'italic' }}>
                      {partnerPseudo} n'a pas encore répondu...
                    </Text>
                  </View>
                )}

                <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ marginTop: 16 }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.nextButton,
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(14,165,233,0.25)', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.9)', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
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
  
  optionsRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  optionBtn: { flex: 1, backgroundColor: '#38BDF8', paddingVertical: 24, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, minHeight: 120 },
  optionBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center', lineHeight: 22 },

  myAnswerBox: { borderWidth: 1.5, borderColor: '#0EA5E9', borderRadius: 16, padding: 16, marginBottom: 16, backgroundColor: 'rgba(14,165,233,0.05)' },
  myAnswerLabel: { fontSize: 11, fontWeight: '800', color: '#0EA5E9', marginBottom: 6, letterSpacing: 0.5 },
  myAnswerText: { fontSize: 16, fontWeight: '700', color: '#4A3B39', lineHeight: 24, textAlign: 'center' },
  waitingBox: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  revealBox: { padding: 18, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.05)', marginBottom: 4 },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  revealTitle: { fontSize: 15, fontWeight: 'bold', color: '#0EA5E9' },
  partnerText: { fontSize: 17, fontWeight: '700', lineHeight: 25, color: '#4A3B39', textAlign: 'center' },
  
  nextButton: { flexDirection: 'row', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0EA5E9', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
  nextButtonDisabled: { backgroundColor: '#BAE6FD', shadowOpacity: 0 },
  nextButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
