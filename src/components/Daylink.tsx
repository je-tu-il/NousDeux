import React, { useState, useEffect, useCallback } from 'react';
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

/**
 * Sélectionne la question du jour (identique pour tous les couples ce jour-là).
 * Utilise une question planifiée si disponible, sinon aléatoire non vue.
 * Utilise setDoc avec merge:false pour éviter que deux utilisateurs
 * choisissent des questions différentes en même temps.
 */
async function pickDailyQuestion(cId: string, slotKey: string): Promise<string> {
  // 1. Priorité aux questions planifiées (même pour tous)
  const scheduled = getScheduledQuestionId(slotKey);
  if (scheduled) {
    // setDoc idempotent : si le doc existe déjà, on lit la valeur existante
    const existing = await getDoc(doc(db, 'couples', cId, 'daily', slotKey));
    if (existing.exists()) return existing.data().questionId;
    await setDoc(doc(db, 'couples', cId, 'daily', slotKey), {
      questionId: scheduled,
      createdAt: new Date(),
    });
    return scheduled;
  }

  // 2. Fallback : aléatoire non vue — vérifier d'abord si un autre utilisateur a déjà créé le slot
  const existing = await getDoc(doc(db, 'couples', cId, 'daily', slotKey));
  if (existing.exists()) return existing.data().questionId;

  const progressSnap = await getDoc(doc(db, 'couples', cId, 'progress', 'seen'));
  const seenIds: string[] = progressSnap.exists() ? progressSnap.data().questionIds ?? [] : [];
  let unseen = getUnseen(seenIds);
  let newSeenIds = seenIds;
  if (unseen.length === 0) { unseen = [...QUESTIONS]; newSeenIds = []; }

  const picked = unseen[Math.floor(Math.random() * unseen.length)];
  await setDoc(doc(db, 'couples', cId, 'progress', 'seen'), {
    questionIds: [...newSeenIds, picked.id],
    updatedAt: new Date(),
  });
  await setDoc(doc(db, 'couples', cId, 'daily', slotKey), {
    questionId: picked.id,
    createdAt: new Date(),
  });
  return picked.id;
}

// ─── composant ───────────────────────────────────────────────────────────────

export default function Daylink() {
  const theme  = Colors.light;
  const store  = useOnboardingStore((s) => s);
  const myUid  = store.uid;
  const pseudo = store.pseudo ?? 'Moi';

  const slotKey = todayKey();

  const [question, setQuestion]         = useState<Question | null>(null);
  const [loadingQuestion, setLoading]   = useState(true);
  const [partnerUid, setPartnerUid]     = useState<string | null>(null);
  const [partnerPseudo, setPartnerPseudo] = useState('Partenaire');

  const [myAnswer, setMyAnswer]           = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted]     = useState(false);
  const [savingAnswer, setSavingAnswer]   = useState(false);

  // ── Chargement ────────────────────────────────────────────────────────────
  const loadQuestion = useCallback(async (uid: string, pUid: string) => {
    setLoading(true);
    const cId = coupleId(uid, pUid);
    const questionId = await pickDailyQuestion(cId, slotKey);
    setQuestion(getById(questionId) ?? null);

    const myAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', uid));
    if (myAns.exists()) { setIsSubmitted(true); setMyAnswer(myAns.data().text ?? ''); }

    const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', pUid));
    if (pAns.exists()) setPartnerAnswer(pAns.data().text ?? '');

    setLoading(false);
  }, [slotKey]);

  // ── Init ──────────────────────────────────────────────────────────────────
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

      await loadQuestion(myUid, pUid);
    };
    init();
  }, [myUid]);

  // ── Listener réponse partenaire (temps réel) ──────────────────────────────
  useEffect(() => {
    if (!myUid || !partnerUid || !isSubmitted) return;
    const cId = coupleId(myUid, partnerUid);
    const ref = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setPartnerAnswer(snap.data().text ?? '');
    });
    return () => unsub();
  }, [myUid, partnerUid, isSubmitted]);

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

      // Vérifier si le partenaire a déjà répondu → marquer les deux
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

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadingQuestion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.tint} size="large" />
        <Text style={{ color: theme.text, marginTop: 16, opacity: 0.6 }}>Chargement de la question...</Text>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <Text style={{ color: theme.text, textAlign: 'center', fontSize: 16, opacity: 0.6 }}>
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
              <View style={[styles.sealedBox, { backgroundColor: 'rgba(255,154,139,0.1)' }]}>
                <Lock color={theme.tint} size={18} />
                <Text style={[styles.sealedText, { color: theme.tint }]}>Ta réponse est scellée 🔒</Text>
              </View>

              {partnerAnswer ? (
                <Animated.View
                  entering={FadeInUp.duration(600)}
                  style={[styles.revealBox, { backgroundColor: theme.background }]}
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
              {/* Pas de bouton "Question suivante" ici — c'est la question du JOUR */}
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ── Helper streak (appelé depuis Daylink ET UnlimitedQuestions) ──────────────
export async function updateStreak(cId: string, slotKey: string) {
  try {
    const statsRef = doc(db, 'couples', cId, 'stats', 'streak');
    const statsSnap = await getDoc(statsRef);
    const today = slotKey.substring(0, 10); // YYYY-MM-DD

    let currentStreak = 1;
    if (statsSnap.exists()) {
      const data = statsSnap.data();
      const lastDate = data.lastActiveDate as string | undefined;
      if (lastDate) {
        const last = new Date(lastDate);
        const todayDate = new Date(today);
        const diffMs = todayDate.getTime() - last.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 1) currentStreak = (data.currentStreak ?? 0) + 1;
        else if (diffDays === 0) return; // Déjà compté aujourd'hui
        // diffDays > 1 → streak cassé → reset à 1
      }
    }

    await setDoc(statsRef, { currentStreak, lastActiveDate: today }, { merge: true });
  } catch (e) {
    console.error('updateStreak:', e);
  }
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
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  question: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 28 },
  input: { borderWidth: 1, padding: 16, borderRadius: 16, minHeight: 120, fontSize: 16, marginBottom: 20 },
  button: {
    padding: 18, borderRadius: 16, alignItems: 'center',
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  sealedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, gap: 8, marginBottom: 16 },
  sealedText: { fontSize: 15, fontWeight: '600' },
  waitingBox: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  revealBox: { padding: 20, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#FF6A88', marginBottom: 4 },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  revealTitle: { fontSize: 16, fontWeight: 'bold' },
  partnerText: { fontSize: 18, fontStyle: 'italic', lineHeight: 26 },
});
