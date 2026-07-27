import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Infinity as InfinityIcon, Lock, Unlock, ChevronRight, CheckCircle2, Clock } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc, runTransaction } from 'firebase/firestore';
import { getById, getUnseen, QUESTIONS } from '../data/questions';
import { updateStreak } from './Daylink';
import type { Question } from '../data/questions';

// ─── helpers ─────────────────────────────────────────────────────────────────

function coupleId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

function nowSlot(index: number): string {
  const d = new Date();
  const base = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `unlimited_${base}_${index}`;
}

/**
 * Sélectionne la question du slot en utilisant une TRANSACTION Firestore.
 * Garantit que les deux utilisateurs voient la même question même s'ils
 * chargent simultanément (plus de race condition).
 */
async function pickUnlimitedQuestion(cId: string, slot: string): Promise<string> {
  return runTransaction(db, async (tx) => {
    const slotRef     = doc(db, 'couples', cId, 'daily', slot);
    const progressRef = doc(db, 'couples', cId, 'progress', 'seen');

    const slotDoc = await tx.get(slotRef);
    if (slotDoc.exists()) return slotDoc.data().questionId as string;

    const progressDoc = await tx.get(progressRef);
    const seenIds: string[] = progressDoc.exists() ? progressDoc.data().questionIds ?? [] : [];

    let unseen = getUnseen(seenIds);
    let newSeenIds = seenIds;
    if (unseen.length === 0) { unseen = [...QUESTIONS]; newSeenIds = []; }

    const picked = unseen[Math.floor(Math.random() * unseen.length)];
    tx.set(progressRef, { questionIds: [...newSeenIds, picked.id], updatedAt: new Date() });
    tx.set(slotRef, { questionId: picked.id, createdAt: new Date(), mode: 'unlimited' });

    return picked.id;
  });
}

// ─── composant ───────────────────────────────────────────────────────────────

export default function UnlimitedQuestions() {
  const theme  = Colors.light;
  const store  = useOnboardingStore((s) => s);
  const myUid  = store.uid;
  const pseudo = store.pseudo ?? 'Moi';

  const [question, setQuestion]           = useState<Question | null>(null);
  const [loadingQuestion, setLoading]     = useState(true);
  const [partnerUid, setPartnerUid]       = useState<string | null>(null);
  const [partnerPseudo, setPartnerPseudo] = useState('Partenaire');

  const [questionIndex, setQuestionIndex] = useState(0);
  const [slotKey, setSlotKey]             = useState(() => nowSlot(0));

  const [myAnswer, setMyAnswer]           = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted]     = useState(false);
  const [savingAnswer, setSavingAnswer]   = useState(false);
  const [loadingNext, setLoadingNext]     = useState(false);

  // ── Chargement d'un slot ──────────────────────────────────────────────────
  const loadSlot = useCallback(async (uid: string, pUid: string, slot: string) => {
    setLoading(true);
    setMyAnswer('');
    setPartnerAnswer(null);
    setIsSubmitted(false);

    const cId = coupleId(uid, pUid);
    const questionId = await pickUnlimitedQuestion(cId, slot);
    setQuestion(getById(questionId) ?? null);

    const myAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', uid));
    if (myAns.exists()) { setIsSubmitted(true); setMyAnswer(myAns.data().text ?? ''); }

    const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', pUid));
    if (pAns.exists()) setPartnerAnswer(pAns.data().text ?? '');

    setLoading(false);
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
      const pDoc = await getDoc(doc(db, 'users', pUid));
      if (pDoc.exists()) setPartnerPseudo(pDoc.data().pseudo ?? 'Partenaire');
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

  // ── Soumettre ma réponse ──────────────────────────────────────────────────
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

      // Si le partenaire a déjà répondu → marquer bothAnswered + streak
      const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid));
      if (pAns.exists()) {
        await updateDoc(doc(db, 'couples', cId, 'daily', slotKey), { bothAnswered: true });
        await updateStreak(cId, slotKey);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAnswer(false);
    }
  };

  // ── Question suivante (bloquée tant que les 2 n'ont pas répondu) ──────────
  const handleNext = async () => {
    if (!myUid || !partnerUid || !partnerAnswer) return; // bloqué si partenaire pas répondu
    setLoadingNext(true);
    const nextIdx  = questionIndex + 1;
    const nextSlot = nowSlot(nextIdx);
    setQuestionIndex(nextIdx);
    setSlotKey(nextSlot);
    await loadSlot(myUid, partnerUid, nextSlot);
    setLoadingNext(false);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

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
        <Text style={{ color: '#4A3B39', textAlign: 'center', fontSize: 16, opacity: 0.6 }}>
          Impossible de charger une question.{'\n'}Vérifie ta connexion.
        </Text>
      </View>
    );
  }

  const bothAnswered = isSubmitted && partnerAnswer !== null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={FadeInUp.duration(600).springify()}
          layout={Layout.springify()}
          style={[styles.card, { borderColor: 'rgba(168,85,247,0.25)' }]}
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

          <View style={styles.content}>
            {/* Indicateurs de statut */}
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, isSubmitted
                ? { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22c55e' }
                : { backgroundColor: 'rgba(156,163,175,0.1)', borderColor: '#9CA3AF' }
              ]}>
                {isSubmitted
                  ? <CheckCircle2 color="#22c55e" size={14} />
                  : <Clock color="#9CA3AF" size={14} />}
                <Text style={[styles.statusPillText, { color: isSubmitted ? '#22c55e' : '#9CA3AF' }]}>
                  {isSubmitted ? `${pseudo} ✓` : `${pseudo}...`}
                </Text>
              </View>

              <View style={[styles.statusPill, partnerAnswer !== null
                ? { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22c55e' }
                : { backgroundColor: 'rgba(156,163,175,0.1)', borderColor: '#9CA3AF' }
              ]}>
                {partnerAnswer !== null
                  ? <CheckCircle2 color="#22c55e" size={14} />
                  : <Clock color="#9CA3AF" size={14} />}
                <Text style={[styles.statusPillText, { color: partnerAnswer !== null ? '#22c55e' : '#9CA3AF' }]}>
                  {partnerAnswer !== null ? `${partnerPseudo} ✓` : `${partnerPseudo}...`}
                </Text>
              </View>
            </View>

            {/* Catégorie */}
            <Text style={styles.categoryTag}>{question.category.toUpperCase()}</Text>

            <Text style={styles.question}>{question.text}</Text>

            {!isSubmitted ? (
              <Animated.View entering={FadeIn.delay(200)}>
                <TextInput
                  style={styles.input}
                  placeholder="Ta réponse..."
                  placeholderTextColor="#C4A8C4"
                  value={myAnswer}
                  onChangeText={setMyAnswer}
                  multiline
                />
                <Pressable
                  style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}
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
                {/* Statut scellé */}
                <View style={styles.sealedBox}>
                  <Lock color="#A855F7" size={18} />
                  <Text style={styles.sealedText}>Ta réponse est scellée 🔒</Text>
                </View>

                {/* Réponse partenaire (visible seulement quand les deux ont répondu) */}
                {partnerAnswer ? (
                  <Animated.View entering={FadeInUp.duration(500)} style={styles.revealBox}>
                    <View style={styles.revealHeader}>
                      <Unlock color="#EC4899" size={16} />
                      <Text style={styles.revealTitle}>{partnerPseudo} a répondu !</Text>
                    </View>
                    <Text style={styles.partnerText}>"{partnerAnswer}"</Text>
                  </Animated.View>
                ) : (
                  <View style={styles.waitingBox}>
                    <ActivityIndicator color="#A855F7" size="small" />
                    <Text style={{ color: '#A99693', fontSize: 14, fontStyle: 'italic' }}>
                      {partnerPseudo} n'a pas encore répondu...
                    </Text>
                  </View>
                )}

                {/* Question suivante — bloquée tant que les 2 n'ont pas répondu */}
                <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ marginTop: 16 }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.nextButton,
                      !bothAnswered && styles.nextButtonDisabled,
                      { opacity: pressed || loadingNext || !bothAnswered ? 0.5 : 1 },
                    ]}
                    onPress={handleNext}
                    disabled={loadingNext || !bothAnswered}
                  >
                    {loadingNext
                      ? <ActivityIndicator color="white" />
                      : (
                        <>
                          <Text style={styles.nextButtonText}>
                            {bothAnswered ? 'Question suivante' : `Attente de ${partnerPseudo}...`}
                          </Text>
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
  content: { padding: 24, paddingTop: 20 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 16, justifyContent: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  categoryTag: { fontSize: 11, fontWeight: '800', letterSpacing: 2, opacity: 0.5, color: '#A855F7', marginBottom: 8, textAlign: 'center' },
  question: { fontSize: 19, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 28, color: '#4A3B39' },
  input: { borderWidth: 1.5, borderColor: '#A855F7', padding: 16, borderRadius: 16, minHeight: 110, fontSize: 16, marginBottom: 16, backgroundColor: 'rgba(168,85,247,0.04)', color: '#4A3B39' },
  button: { padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#A855F7', shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  sealedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, gap: 8, marginBottom: 16, backgroundColor: 'rgba(168,85,247,0.08)' },
  sealedText: { fontSize: 15, fontWeight: '600', color: '#A855F7' },
  waitingBox: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  revealBox: { padding: 18, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#EC4899', backgroundColor: 'rgba(236,72,153,0.05)', marginBottom: 4 },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  revealTitle: { fontSize: 15, fontWeight: 'bold', color: '#EC4899' },
  partnerText: { fontSize: 17, fontStyle: 'italic', lineHeight: 25, color: '#4A3B39' },
  nextButton: {
    flexDirection: 'row', padding: 16, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
  },
  nextButtonDisabled: { backgroundColor: '#C4B5D4' },
  nextButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
