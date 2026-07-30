import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Lock, Unlock, CheckCircle2, Clock } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';

import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { db } from '../lib/firebase';
import {
  doc, getDoc, setDoc, onSnapshot,
  serverTimestamp, updateDoc, runTransaction,
} from 'firebase/firestore';
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

/**
 * Choisit la question du jour via une TRANSACTION Firestore.
 * Garantit que les deux utilisateurs voient la MÊME question
 * même s'ils chargent la page exactement en même temps.
 */
async function pickDailyQuestion(cId: string, slotKey: string): Promise<string> {
  return runTransaction(db, async (tx) => {
    const slotRef = doc(db, 'couples', cId, 'daily', slotKey);
    const slotDoc = await tx.get(slotRef);

    // Slot déjà créé → on réutilise la question existante (même pour les 2)
    if (slotDoc.exists()) return slotDoc.data().questionId as string;

    // Question planifiée → prioritaire, même pour tous les couples
    const scheduled = getScheduledQuestionId(slotKey);
    if (scheduled) {
      tx.set(slotRef, { questionId: scheduled, createdAt: new Date() });
      return scheduled;
    }

    // Fallback aléatoire non vu
    const progressRef = doc(db, 'couples', cId, 'progress', 'seen');
    const progressDoc = await tx.get(progressRef);
    const seenIds: string[] = progressDoc.exists() ? progressDoc.data().questionIds ?? [] : [];
    let unseen = getUnseen(seenIds);
    let newSeenIds = seenIds;
    if (unseen.length === 0) { unseen = [...QUESTIONS]; newSeenIds = []; }
    const picked = unseen[Math.floor(Math.random() * unseen.length)];
    tx.set(progressRef, { questionIds: [...newSeenIds, picked.id], updatedAt: new Date() });
    tx.set(slotRef, { questionId: picked.id, createdAt: new Date() });
    return picked.id;
  });
}

// ─── composant ───────────────────────────────────────────────────────────────

export default function Daylink() {
  const theme  = Colors.light;
  const store  = useOnboardingStore((s) => s);
  const myUid  = store.uid;
  const pseudo = store.pseudo ?? 'Moi';

  const slotKey = todayKey();

  const [question, setQuestion]             = useState<Question | null>(null);
  const [loadingQuestion, setLoading]       = useState(true);
  const [partnerUid, setPartnerUid]         = useState<string | null>(null);
  const [partnerPseudo, setPartnerPseudo]   = useState('Partenaire');

  // Ma réponse (texte tapé ou chargé depuis Firestore)
  const [myAnswer, setMyAnswer]             = useState('');
  const [isSubmitted, setIsSubmitted]       = useState(false);
  const [savingAnswer, setSavingAnswer]     = useState(false);

  // État partenaire (temps réel, toujours actif)
  const [partnerHasAnswered, setPartnerHasAnswered] = useState(false);
  const [partnerAnswer, setPartnerAnswer]           = useState<string | null>(null);

  // Ref pour accéder à isSubmitted dans le listener sans le recréer
  const isSubmittedRef = useRef(false);
  useEffect(() => { isSubmittedRef.current = isSubmitted; }, [isSubmitted]);

  // ── Chargement de la question ─────────────────────────────────────────────
  useEffect(() => {
    if (!myUid) return;
    const init = async () => {
      setLoading(true);
      const myDoc = await getDoc(doc(db, 'users', myUid));
      if (!myDoc.exists()) return;
      const pUid = myDoc.data().linkedTo as string | undefined;
      if (!pUid) return;
      setPartnerUid(pUid);

      const pDoc = await getDoc(doc(db, 'users', pUid));
      if (pDoc.exists()) setPartnerPseudo(pDoc.data().pseudo ?? 'Partenaire');

      const cId = coupleId(myUid, pUid);
      const questionId = await pickDailyQuestion(cId, slotKey);
      setQuestion(getById(questionId) ?? null);

      // Charger ma réponse existante
      const myAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', myUid));
      if (myAns.exists()) {
        setIsSubmitted(true);
        isSubmittedRef.current = true;
        setMyAnswer(myAns.data().text ?? '');
      }

      // Charger la réponse du partenaire si déjà envoyée
      const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', pUid));
      if (pAns.exists()) {
        setPartnerHasAnswered(true);
        if (isSubmittedRef.current) setPartnerAnswer(pAns.data().text ?? '');
      }

      setLoading(false);
    };
    init();
  }, [myUid]);

  // ── Listener partenaire — TOUJOURS actif (pas besoin que j'aie répondu) ──
  useEffect(() => {
    if (!myUid || !partnerUid) return;
    const cId = coupleId(myUid, partnerUid);
    const ref = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setPartnerHasAnswered(true);
        // On révèle le texte seulement si j'ai aussi répondu
        if (isSubmittedRef.current) {
          setPartnerAnswer(snap.data().text ?? '');
        }
      } else {
        setPartnerHasAnswered(false);
        setPartnerAnswer(null);
      }
    });
    return () => unsub();
  }, [myUid, partnerUid]);

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
      isSubmittedRef.current = true;

      // Si le partenaire a déjà répondu → révéler sa réponse + marquer bothAnswered
      if (partnerHasAnswered) {
        const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid));
        if (pAns.exists()) {
          setPartnerAnswer(pAns.data().text ?? '');
          await updateDoc(doc(db, 'couples', cId, 'daily', slotKey), { bothAnswered: true });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAnswer(false);
    }
  };

  // Quand le partenaire répond après moi → mettre à jour bothAnswered + révéler
  useEffect(() => {
    if (!partnerHasAnswered || !isSubmitted || !myUid || !partnerUid) return;
    const cId = coupleId(myUid, partnerUid);
    // Le listener a déjà mis à jour partnerAnswer via isSubmittedRef
    // On met à jour bothAnswered
    const pAnsRef = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);
    getDoc(pAnsRef).then((snap) => {
      if (snap.exists()) {
        setPartnerAnswer(snap.data().text ?? '');
        updateDoc(doc(db, 'couples', cId, 'daily', slotKey), { bothAnswered: true }).catch(() => {});
      }
    });
  }, [partnerHasAnswered, isSubmitted]);

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
        <Text style={{ color: theme.text, textAlign: 'center', opacity: 0.6 }}>
          Impossible de charger la question.{'\n'}Vérifie ta connexion.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Animated.View
        entering={FadeInUp.duration(800).springify()}
        layout={Layout.springify()}
        style={[styles.card, { borderColor: theme.cardBorder }]}
      >
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <Heart color="white" size={24} fill="white" />
          <Text style={styles.headerTitle}>Question du Jour</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* ── Indicateurs de statut (toujours visibles) ── */}
          <View style={styles.statusRow}>
            <View style={[styles.pill, isSubmitted ? styles.pillDone : styles.pillWaiting]}>
              {isSubmitted
                ? <CheckCircle2 color="#22c55e" size={14} />
                : <Clock color="#9CA3AF" size={14} />}
              <Text style={[styles.pillText, { color: isSubmitted ? '#22c55e' : '#9CA3AF' }]}>
                {pseudo} {isSubmitted ? '✓' : '...'}
              </Text>
            </View>

            <View style={[styles.pill, partnerHasAnswered ? styles.pillDone : styles.pillWaiting]}>
              {partnerHasAnswered
                ? <CheckCircle2 color="#22c55e" size={14} />
                : <Clock color="#9CA3AF" size={14} />}
              <Text style={[styles.pillText, { color: partnerHasAnswered ? '#22c55e' : '#9CA3AF' }]}>
                {partnerPseudo} {partnerHasAnswered ? '✓' : '...'}
              </Text>
            </View>
          </View>

          <Text style={[styles.question, { color: theme.text }]}>{question.text}</Text>

          {!isSubmitted ? (
            /* ── Formulaire de réponse ── */
            <Animated.View entering={FadeIn.delay(300)}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
                placeholder="Écris ce que tu ressens..."
                placeholderTextColor="#A99693"
                value={myAnswer}
                onChangeText={setMyAnswer}
                multiline
              />
              <Pressable
                style={({ pressed }) => [styles.button, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}
                onPress={handleSubmit}
                disabled={savingAnswer}
              >
                {savingAnswer
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.buttonText}>Envoyer avec amour 💌</Text>}
              </Pressable>
            </Animated.View>
          ) : (
            /* ── État soumis ── */
            <Animated.View entering={FadeIn} layout={Layout.springify()}>
              {/* Ma propre réponse (toujours visible) */}
              <View style={[styles.myAnswerBox, { borderColor: theme.tint }]}>
                <Text style={[styles.myAnswerLabel, { color: theme.tint }]}>Ta réponse 🔒</Text>
                <Text style={[styles.myAnswerText, { color: theme.text }]}>"{myAnswer}"</Text>
              </View>

              {/* Réponse du partenaire (visible quand les 2 ont répondu) */}
              {partnerAnswer !== null ? (
                <Animated.View
                  entering={FadeInUp.duration(600)}
                  style={styles.revealBox}
                >
                  <View style={styles.revealHeader}>
                    <Unlock color={theme.gradientEnd} size={18} />
                    <Text style={[styles.revealTitle, { color: theme.gradientEnd }]}>
                      {partnerPseudo} a répondu !
                    </Text>
                  </View>
                  <Text style={[styles.partnerText, { color: theme.text }]}>"{partnerAnswer}"</Text>
                </Animated.View>
              ) : (
                <View style={styles.waitingBox}>
                  <ActivityIndicator color={theme.tint} size="small" />
                  <Text style={{ color: '#A99693', fontSize: 14, fontStyle: 'italic' }}>
                    En attente de {partnerPseudo}...
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

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  card: {
    borderRadius: 24, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  headerGradient: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  content: { padding: 24 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 20, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillDone: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e' },
  pillWaiting: { backgroundColor: 'rgba(156,163,175,0.1)', borderColor: '#9CA3AF' },
  pillText: { fontSize: 12, fontWeight: '600' },
  question: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 28 },
  input: { borderWidth: 1.5, padding: 16, borderRadius: 16, minHeight: 120, fontSize: 16, marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.5)' },
  button: {
    padding: 18, borderRadius: 16, alignItems: 'center',
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  myAnswerBox: {
    borderWidth: 1.5, borderRadius: 16, padding: 16, marginBottom: 16,
    backgroundColor: 'rgba(255,154,139,0.06)',
  },
  myAnswerLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  myAnswerText: { fontSize: 16, fontStyle: 'italic', lineHeight: 24 },
  waitingBox: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  revealBox: {
    padding: 20, borderRadius: 16, borderLeftWidth: 4,
    borderLeftColor: '#FF6A88', backgroundColor: 'rgba(255,106,136,0.06)',
  },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  revealTitle: { fontSize: 16, fontWeight: 'bold' },
  partnerText: { fontSize: 18, fontStyle: 'italic', lineHeight: 26 },
});
