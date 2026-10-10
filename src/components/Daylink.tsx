import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CheckCircle2, Clock, Heart, Unlock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView, Modal, Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text, TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, Layout } from 'react-native-reanimated';
import { triggerHaptic } from '../lib/haptics';
import { sound } from '../lib/sound';

import {
    doc, getDoc,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Colors } from '../constants/Colors';
import type { Question } from '../data/questions';
import { getById, getUnseen, QUESTIONS } from '../data/questions';
import { getScheduledQuestionId } from '../data/scheduledQuestions';
import { decryptText, encryptText } from '../lib/crypto';
import { checkQuests, updateWalletStreak } from '../lib/economy';
import { auth, db } from '../lib/firebase';
import { useOnboardingStore } from '../store/onboardingStore';
import { syncWidgetData } from '../lib/widgets';
import { sendPartnerAnswerPush, triggerPartnerAnsweredNotification } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function coupleId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

async function pickDailyQuestion(cId: string, slotKey: string): Promise<string> {
  if (!cId) throw new Error('Missing coupleId');
  return runTransaction(db, async (tx) => {
    const slotRef = doc(db, 'couples', cId, 'daily', slotKey);
    const slotDoc = await tx.get(slotRef);

    if (slotDoc.exists()) {
      const cachedId = slotDoc.data().questionId as string;
      if (getById(cachedId)) return cachedId;
    }

    const scheduled = getScheduledQuestionId(slotKey);
    if (scheduled && getById(scheduled)) {
      const q = getById(scheduled)!;
      tx.set(slotRef, {
        questionId: scheduled,
        createdAt: new Date(),
        mode: 'daily',
        category: q.category || 'quotidien',
        questionCategory: q.category || 'quotidien',
      });
      return scheduled;
    }

    const progressRef = doc(db, 'couples', cId, 'progress', 'seen');
    const progressDoc = await tx.get(progressRef);
    const seenIds: string[] = progressDoc.exists() ? progressDoc.data().questionIds ?? [] : [];
    let unseen = getUnseen(seenIds);
    let newSeenIds = seenIds;
    if (unseen.length === 0) { unseen = [...QUESTIONS]; newSeenIds = []; }
    const picked = unseen[Math.floor(Math.random() * unseen.length)];
    tx.set(progressRef, { questionIds: [...newSeenIds, picked.id], updatedAt: new Date() });
    tx.set(slotRef, {
      questionId: picked.id,
      createdAt: new Date(),
      mode: 'daily',
      category: picked.category || 'quotidien',
      questionCategory: picked.category || 'quotidien',
    });
    return picked.id;
  });
}

/** Déchiffre une réponse Firestore. Gère la migration depuis les anciens formats. */
async function safeDecrypt(data: Record<string, any>, cId: string): Promise<string> {
  if (data.ciphertext && data.iv) {
    try {
      const decrypted = await decryptText({ ciphertext: data.ciphertext, iv: data.iv }, cId);
      if (decrypted && decrypted.trim().length > 0) {
        return decrypted.trim();
      }
    } catch (e) {
      console.warn('safeDecrypt decryptText error:', e);
    }
  }
  if (data.text && typeof data.text === 'string' && data.text.trim().length > 0) {
    return data.text.trim();
  }
  return '';
}

// ─── composant ───────────────────────────────────────────────────────────────

export default function Daylink() {
  const { width: windowWidth } = useWindowDimensions();
  const store  = useOnboardingStore((s) => s);
  const theme  = store.isDarkMode ? Colors.dark : Colors.light;
  const myUid  = store.uid;
  const pseudo = store.pseudo ?? 'Moi';

  const slotKey = todayKey();

  const [question, setQuestion]             = useState<Question | null>(null);
  const [loadingQuestion, setLoading]       = useState(true);
  const [loadError, setLoadError]           = useState<string | null>(null);
  const [needsPartner, setNeedsPartner]     = useState(false);
  const [partnerUid, setPartnerUid]         = useState<string | null>(null);
  const [partnerPseudo, setPartnerPseudo]   = useState('Partenaire');
  const [cId, setCId]                       = useState('');

  // Réponses — stockées chiffrées dans Firestore, lues en clair en local
  const [myAnswer, setMyAnswer]             = useState('');
  const [isSubmitted, setIsSubmitted]       = useState(false);
  const [savingAnswer, setSavingAnswer]     = useState(false);

  const [partnerHasAnswered, setPartnerHasAnswered] = useState(false);
  const [partnerAnswer, setPartnerAnswer]           = useState<string | null>(null);

  const isSubmittedRef = useRef(false);
  useEffect(() => { isSubmittedRef.current = isSubmitted; }, [isSubmitted]);

  // Modal & données de la veille (question et réponses de hier)
  const [showYesterdayModal, setShowYesterdayModal] = useState(false);
  const [yesterdayLoading, setYesterdayLoading] = useState(false);
  const [yesterdayData, setYesterdayData] = useState<{
    questionText: string | null;
    myAnswer: string | null;
    partnerAnswer: string | null;
    exists: boolean;
  } | null>(null);

  const loadYesterday = async () => {
    setShowYesterdayModal(true);
    if (!cId || !myUid) return;
    setYesterdayLoading(true);
    try {
      const yKey = yesterdayKey();
      const ySlotSnap = await getDoc(doc(db, 'couples', cId, 'daily', yKey));
      if (!ySlotSnap.exists()) {
        setYesterdayData({ questionText: null, myAnswer: null, partnerAnswer: null, exists: false });
        return;
      }
      const qId = ySlotSnap.data().questionId;
      const q = qId ? getById(qId) : null;
      const [myAnsDoc, pAnsDoc] = await Promise.all([
        getDoc(doc(db, 'couples', cId, 'daily', yKey, 'answers', myUid)),
        partnerUid ? getDoc(doc(db, 'couples', cId, 'daily', yKey, 'answers', partnerUid)) : Promise.resolve(null),
      ]);
      const myDecrypted = myAnsDoc.exists() ? await safeDecrypt(myAnsDoc.data(), cId) : null;
      const pDecrypted = pAnsDoc && pAnsDoc.exists() ? await safeDecrypt(pAnsDoc.data(), cId) : null;
      setYesterdayData({
        questionText: q?.text || 'Question du jour passée',
        myAnswer: myDecrypted,
        partnerAnswer: pDecrypted,
        exists: true,
      });
    } catch (e) {
      console.warn('Failed to load yesterday:', e);
    } finally {
      setYesterdayLoading(false);
    }
  };

  // Geste de swipe vers le haut pour valider sa réponse
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: any) => {
    touchStartY.current = e.nativeEvent.pageY;
  };
  const handleTouchEnd = (e: any) => {
    if (touchStartY.current !== null) {
      const deltaY = touchStartY.current - e.nativeEvent.pageY;
      if (deltaY > 50) {
        if (!isSubmitted && myAnswer.trim().length > 0 && !savingAnswer) {
          sound.pop();
          triggerHaptic('selection');
          handleSubmit();
        }
      }
    }
    touchStartY.current = null;
  };

  // ── Chargement de la question ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const firebaseUid = auth.currentUser?.uid;
      if (!firebaseUid) return;
      setLoading(true);
      setLoadError(null);
      setNeedsPartner(false);
      try {
        const myDocSnap = await getDoc(doc(db, 'users', firebaseUid));
        if (!myDocSnap.exists()) throw new Error('Profil utilisateur introuvable.');
        const pUid = myDocSnap.data().linkedTo as string | undefined;
        if (!pUid) {
          setNeedsPartner(true);
          setLoading(false);
          return;
        }
        setPartnerUid(pUid);

        const coupleKey = coupleId(firebaseUid, pUid);
        setCId(coupleKey);

        const reads = Promise.all([
          getDoc(doc(db, 'users', pUid)),
          pickDailyQuestion(coupleKey, slotKey),
          getDoc(doc(db, 'couples', coupleKey, 'daily', slotKey, 'answers', firebaseUid)),
          getDoc(doc(db, 'couples', coupleKey, 'daily', slotKey, 'answers', pUid)),
        ]);
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 8000);
        });
        const [pDoc, questionId, myAns, pAns] = await Promise.race([reads, timeout]);

        if (cancelled) return;
        if (pDoc.exists()) setPartnerPseudo(pDoc.data().pseudo ?? 'Partenaire');
        setQuestion(getById(questionId) ?? null);

        if (myAns.exists()) {
          const decryptedMy = await safeDecrypt(myAns.data(), coupleKey);
          if (decryptedMy && decryptedMy.length > 0) {
            setMyAnswer(decryptedMy);
            setIsSubmitted(true);
            isSubmittedRef.current = true;
            void checkQuests(coupleKey, 'question_answered', 1);
          }
        }

        if (pAns.exists()) {
          const decryptedPartner = await safeDecrypt(pAns.data(), coupleKey);
          if (decryptedPartner && decryptedPartner.length > 0) {
            setPartnerHasAnswered(true);
            if (isSubmittedRef.current) {
              setPartnerAnswer(decryptedPartner);
            }
          }
        }

        const currentQ = getById(questionId) ?? null;
        if (Platform.OS !== 'web' && currentQ) {
          void syncWidgetData({
            todayQuestion: currentQ.text,
            categoryName: currentQ.category,
            userAnswered: Boolean(myAns.exists()),
            partnerAnswered: Boolean(pAns.exists()),
            bothAnswered: Boolean(myAns.exists() && pAns.exists()),
          });
        }
      } catch (error) {
        if (!(error instanceof Error && error.message === 'TIMEOUT')) {
          console.warn('Daylink load failed:', error);
        }
        if (!cancelled) {
          const code = typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
          setLoadError(error instanceof Error && error.message === 'TIMEOUT'
            ? 'Le chargement prend trop de temps. Vérifie ta connexion puis réessaie.'
            : code === 'permission-denied'
              ? 'Accès Firestore refusé. Vérifie que ton compte est bien synchronisé puis réessaie.'
              : 'Impossible de charger la question du jour. Vérifie la synchronisation et réessaie.');
        }
      } finally {
        if (!cancelled && auth.currentUser) setLoading(false);
      }
    };
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoadError('Session expirée. Reconnecte-toi pour charger la question du jour.');
        setLoading(false);
        return;
      }
      void init();
    });
    return () => {
      cancelled = true;
      unsubscribeAuth();
    };
  }, [myUid]);

  // ── Listener partenaire — temps réel ─────────────────────────────────────
  useEffect(() => {
    if (!myUid || !partnerUid || !cId) return;
    const ref = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);
    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        const decrypted = await safeDecrypt(snap.data(), cId);
        if (decrypted && decrypted.length > 0) {
          const wasAnswered = partnerHasAnswered;
          setPartnerHasAnswered(true);
          if (isSubmittedRef.current) {
            setPartnerAnswer(decrypted);
          }
          if (!wasAnswered && Platform.OS !== 'web') {
            const notifKey = `nousdeux_notified_ans_${todayKey()}`;
            AsyncStorage.getItem(notifKey).then((already) => {
              if (!already) {
                AsyncStorage.setItem(notifKey, '1');
                void triggerPartnerAnsweredNotification(partnerPseudo);
              }
            }).catch(() => {});
          }
          if (Platform.OS !== 'web') {
            void syncWidgetData({
              partnerAnswered: true,
              bothAnswered: Boolean(isSubmittedRef.current),
            });
          }
        }
      } else {
        setPartnerHasAnswered(false);
        setPartnerAnswer(null);
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Daylink partner listener failed:', error);
      }
    });
    return () => unsub();
  }, [myUid, partnerUid, cId, partnerPseudo, partnerHasAnswered]);

  // ── Soumettre ma réponse — stockage chiffré temporaire ───────────────────
  const handleSubmit = async () => {
    const cleanAnswer = myAnswer.trim();
    if (!cleanAnswer || cleanAnswer.length === 0 || !myUid || !partnerUid || !question || !cId || savingAnswer || isSubmitted) return;
    setSavingAnswer(true);
    try {
      // Chiffrement avant envoi — admin ne peut pas lire
      let docData: Record<string, any> = { submittedAt: serverTimestamp() };
      try {
        const encrypted = await encryptText(cleanAnswer, cId);
        docData = { ...docData, ...encrypted };
      } catch (err) {
        console.warn('encryptText fallback in Daylink:', err);
        docData.text = cleanAnswer;
      }
      if (!docData.ciphertext) {
        docData.text = cleanAnswer;
      }

      await setDoc(
        doc(db, 'couples', cId, 'daily', slotKey, 'answers', myUid),
        docData
      );
      setMyAnswer(cleanAnswer);
      setIsSubmitted(true);
      isSubmittedRef.current = true;

      if (Platform.OS !== 'web') {
        void syncWidgetData({
          userAnswered: true,
          bothAnswered: Boolean(partnerHasAnswered),
        });
      }

      if (partnerUid) {
        void sendPartnerAnswerPush(partnerUid, store.pseudo || 'Ton partenaire');
      }

      if (partnerHasAnswered) {
        const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid));
        if (pAns.exists()) {
          const decryptedPartner = await safeDecrypt(pAns.data(), cId);
          if (decryptedPartner && decryptedPartner.length > 0) {
            checkQuests(cId, 'both_active', 1).catch(e => console.error(e));
            setPartnerAnswer(decryptedPartner);
            await updateDoc(doc(db, 'couples', cId, 'daily', slotKey), { bothAnswered: true });
            updateWalletStreak(cId).catch(console.error);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAnswer(false);
    }
  };

  // Quand le partenaire répond après moi → révéler + marquer bothAnswered
  useEffect(() => {
    if (!partnerHasAnswered || !isSubmitted || !myUid || !partnerUid || !cId) return;
    getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid)).then(async (snap) => {
      if (snap.exists()) {
        const decryptedPartner = await safeDecrypt(snap.data(), cId);
        if (decryptedPartner && decryptedPartner.length > 0) {
          setPartnerAnswer(decryptedPartner);
          updateDoc(doc(db, 'couples', cId, 'daily', slotKey), { bothAnswered: true }).then(() => {
            updateWalletStreak(cId).catch(console.error);
          }).catch(() => {});
        }
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
        <View style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Heart color={theme.tint} size={28} fill={theme.tint} />
        <Text style={{ color: theme.text, textAlign: 'center', opacity: 0.8 }}>
          {needsPartner
            ? 'Tu dois être synchronisé avec un partenaire pour répondre à la question du jour.'
            : `${loadError ?? 'Impossible de charger la question.'}`}
        </Text>
        <Pressable
          onPress={() => router.replace(needsPartner ? '/onboarding/sync' : '/daylink')}
          style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: theme.tint }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>{needsPartner ? 'Synchroniser mon couple' : 'Réessayer'}</Text>
        </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Animated.View
        entering={FadeInUp.duration(800).springify()}
        layout={Layout.springify()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      >
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <Heart color="white" size={24} fill="white" />
          <Text style={styles.headerTitle}>Question du Jour</Text>
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <View style={styles.statusRow}>
            <View style={[styles.pill, isSubmitted ? styles.pillDone : styles.pillWaiting]}>
              <Text
                style={[styles.pillText, { color: isSubmitted ? '#22c55e' : '#9CA3AF' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {pseudo}
              </Text>
              {isSubmitted
                ? <CheckCircle2 color="#22c55e" size={14} />
                : <Clock color="#9CA3AF" size={14} />}
            </View>

            <View style={[styles.pill, partnerHasAnswered ? styles.pillDone : styles.pillWaiting]}>
              <Text
                style={[styles.pillText, { color: partnerHasAnswered ? '#22c55e' : '#9CA3AF' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {partnerPseudo}
              </Text>
              {partnerHasAnswered
                ? <CheckCircle2 color="#22c55e" size={14} />
                : <Clock color="#9CA3AF" size={14} />}
            </View>
          </View>

          <Text style={[styles.question, { color: theme.text }]}>{question.text}</Text>

          {!isSubmitted ? (
            <Animated.View entering={FadeIn.delay(300)}>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    color: theme.text, 
                    borderColor: theme.tint,
                    backgroundColor: store.isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.02)',
                    textAlignVertical: 'top',
                  }
                ]}
                placeholder="Écris ce que tu ressens..."
                placeholderTextColor={store.isDarkMode ? '#A89997' : '#A99693'}
                value={myAnswer}
                onChangeText={setMyAnswer}
                multiline
                maxLength={2000}
                returnKeyType="send"
                submitBehavior="submit"
                onSubmitEditing={() => handleSubmit()}
                onKeyPress={(event: any) => {
                  if (event.nativeEvent.key === 'Enter' && !event.nativeEvent.shiftKey) {
                    event.preventDefault?.();
                    handleSubmit();
                  }
                }}
              />
              <Text style={{ textAlign: 'right', fontSize: 12, color: store.isDarkMode ? '#A89997' : '#A99693', marginTop: -14, marginBottom: 14, marginRight: 8 }}>
                {myAnswer.length} / 2000
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.tint, opacity: pressed || !myAnswer.trim() || savingAnswer ? 0.7 : 1 }
                ]}
                onPress={handleSubmit}
                disabled={!myAnswer.trim() || savingAnswer || isSubmitted}
              >
                {savingAnswer
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.buttonText}>Envoyer avec amour 💌</Text>}
              </Pressable>
              <Text style={{ textAlign: 'center', fontSize: 11, color: store.isDarkMode ? '#A89997' : '#8A7A78', marginTop: 8 }}>
                Glisse vers le haut 👆 ou appuie pour valider
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} layout={Layout.springify()}>
              {/* Ma réponse — toujours visible après soumission */}
              <View style={[
                styles.myAnswerBox, 
                { 
                  borderColor: theme.tint,
                  backgroundColor: store.isDarkMode ? 'rgba(255,154,139,0.12)' : 'rgba(255,154,139,0.06)'
                }
              ]}>
                <Text style={[styles.myAnswerLabel, { color: theme.tint }]}>Ta réponse 🔒</Text>
                <Text style={[styles.myAnswerText, { color: theme.text }]}>{myAnswer}</Text>
              </View>

              {/* Réponse du partenaire — visible quand les 2 ont répondu */}
              {partnerAnswer && partnerAnswer.trim().length > 0 ? (
                <Animated.View entering={FadeInUp.duration(600)} style={styles.revealBox}>
                  <View style={styles.revealHeader}>
                    <Unlock color={theme.gradientEnd} size={18} />
                    <Text style={[styles.revealTitle, { color: theme.gradientEnd }]} numberOfLines={1} ellipsizeMode="tail">
                      {partnerPseudo} a répondu !
                    </Text>
                  </View>
                  <Text style={[styles.partnerText, { color: theme.text }]}>{partnerAnswer}</Text>
                </Animated.View>
              ) : (
                <View style={styles.waitingBox}>
                  <ActivityIndicator color={theme.tint} size="small" />
                  <Text style={{ color: '#A99693', fontSize: 14, fontStyle: 'italic', flexShrink: 1 }} numberOfLines={2} ellipsizeMode="tail">
                    En attente de {partnerPseudo}...
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Bouton pour voir la question & réponses de la veille */}
          <Pressable
            onPress={() => {
              sound.tap();
              triggerHaptic('light');
              loadYesterday();
            }}
            style={[styles.yesterdayBtn, { borderColor: theme.tint, backgroundColor: store.isDarkMode ? 'rgba(255,154,139,0.1)' : 'rgba(255,154,139,0.08)' }]}
          >
            <Clock size={16} color={theme.tint} />
            <Text style={[styles.yesterdayBtnText, { color: theme.tint }]}>
              Voir la question et réponses d'hier
            </Text>
          </Pressable>
        </ScrollView>
      </Animated.View>

      {/* Modal Question et réponses de la veille */}
      <Modal visible={showYesterdayModal} transparent animationType="fade" onRequestClose={() => setShowYesterdayModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowYesterdayModal(false)}>
          <Pressable style={[styles.yesterdayModalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock color={theme.tint} size={20} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Hier ({yesterdayKey()})</Text>
              </View>
              <Pressable onPress={() => setShowYesterdayModal(false)} hitSlop={10}>
                <Text style={{ fontSize: 18, color: '#A99693', fontWeight: 'bold' }}>✕</Text>
              </Pressable>
            </View>

            {yesterdayLoading ? (
              <ActivityIndicator color={theme.tint} size="small" style={{ marginVertical: 30 }} />
            ) : !yesterdayData?.exists ? (
              <Text style={{ textAlign: 'center', color: '#A99693', marginVertical: 20 }}>
                Aucune question enregistrée pour la journée d'hier.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 14 }}>
                  {yesterdayData.questionText}
                </Text>

                <View style={[styles.yesterdayAnswerBox, { borderColor: theme.tint, backgroundColor: 'rgba(255,154,139,0.08)' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: theme.tint, marginBottom: 4 }}>
                    Ta réponse :
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.text, fontStyle: 'italic' }}>
                    {yesterdayData.myAnswer || 'Tu n’avais pas répondu.'}
                  </Text>
                </View>

                <View style={[styles.yesterdayAnswerBox, { borderColor: '#FF6A88', backgroundColor: 'rgba(255,106,136,0.08)' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FF6A88', marginBottom: 4 }}>
                    Réponse de {partnerPseudo} :
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.text, fontStyle: 'italic' }}>
                    {yesterdayData.partnerAnswer || `${partnerPseudo} n’avait pas répondu.`}
                  </Text>
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  noticeCard: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 14, padding: 24, borderRadius: 20, borderWidth: 1 },
  card: {
    borderRadius: 24, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
    flexShrink: 1,
    maxHeight: '100%',
  },
  headerGradient: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  content: { padding: 24, flexShrink: 1 },
  categoryLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 20, justifyContent: 'center', minWidth: 0 },
  pill: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillDone: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e' },
  pillWaiting: { backgroundColor: 'rgba(156,163,175,0.1)', borderColor: '#9CA3AF' },
  pillText: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '600' },
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
  yesterdayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  yesterdayBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  yesterdayModalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  yesterdayAnswerBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
});
