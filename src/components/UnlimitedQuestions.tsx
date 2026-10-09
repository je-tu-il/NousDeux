import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
    Brain,
    Camera,
    CheckCircle2,
    ChevronRight,
    Clock,
    Flame,
    Heart,
    Home,
    Infinity as InfinityIcon,
    MessageCircle, Rocket, Star, Coffee,
    Smile,
    Split,
    Unlock
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView, Modal, Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text, TextInput,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, Layout } from 'react-native-reanimated';

import {
    deleteDoc,
    doc, getDoc,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    increment,
    arrayUnion,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Colors } from '../constants/Colors';
import { auth, db } from '../lib/firebase';
import { useOnboardingStore } from '../store/onboardingStore';

import type { PileOuFaceQuestion } from '../data/pileouface';
import { POF_QUESTIONS } from '../data/pileouface';
import type { Question } from '../data/questions';
import { QUESTIONS } from '../data/questions';
import { decryptText, encryptText } from '../lib/crypto';
import { checkQuests, updateWalletStreak } from '../lib/economy';
import { sound } from '../lib/sound';
import { triggerHaptic } from '../lib/haptics';

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

function indexKey(uid: string, categoryFilter?: string): string {
  return `currentIndex_${uid}_${categoryFilter ?? 'all'}`;
}

const CATEGORY_RARITY_WEIGHTS: Record<string, number> = {
  amour: 4,
  fun: 4,
  profond: 4,
  intime: 3,
  pile_ou_face: 3,
  famille: 3,
  debat: 3,
  futur: 2,
  souvenir: 2,
  reve: 1,
  quotidien: 1,
  defi: 1,
};

async function pickUnlimitedQuestion(cId: string, slot: string, categoryFilter?: string): Promise<string> {
  if (!cId) throw new Error('Missing coupleId');
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
      newSeenIds = seenIds.filter(id => !available.some(q => q.id === id));
    }
    if (unseen.length === 0) {
      unseen = [...QUESTIONS];
      newSeenIds = [];
    }

    let picked: AnyQuestion;
    if (!categoryFilter) {
      const byCat: Record<string, AnyQuestion[]> = {};
      for (const q of unseen) {
        const cat = isPof(q) ? 'pile_ou_face' : (q as Question).category;
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(q);
      }
      const catsWithQuestions = Object.keys(byCat);
      const totalWeight = catsWithQuestions.reduce((sum, cat) => sum + (CATEGORY_RARITY_WEIGHTS[cat] || 2), 0);
      let rand = Math.random() * totalWeight;
      let chosenCat = catsWithQuestions[0];
      for (const cat of catsWithQuestions) {
        const weight = CATEGORY_RARITY_WEIGHTS[cat] || 2;
        if (rand < weight) {
          chosenCat = cat;
          break;
        }
        rand -= weight;
      }
      const pool = byCat[chosenCat] || unseen;
      picked = pool[Math.floor(Math.random() * pool.length)];
    } else {
      picked = unseen[Math.floor(Math.random() * unseen.length)];
    }

    const pickedCategory = isPof(picked) ? 'pile_ou_face' : (picked as Question).category;
    tx.set(progressRef, { questionIds: [...newSeenIds, picked.id], updatedAt: new Date() });
    tx.set(slotRef, {
      questionId: picked.id,
      createdAt: new Date(),
      mode: 'unlimited',
      category: categoryFilter || pickedCategory,
      questionCategory: pickedCategory,
    });
    return picked.id;
  });
}

async function readCurrentIndex(cId: string, uid: string, categoryFilter?: string): Promise<number> {
  if (!cId) throw new Error('Missing coupleId');
  const snap = await getDoc(doc(db, 'couples', cId, 'progress', 'indexes'));
  if (snap.exists()) return snap.data()[indexKey(uid, categoryFilter)] ?? 0;
  return 0;
}

async function saveCurrentIndex(cId: string, uid: string, index: number, categoryFilter?: string): Promise<void> {
  if (!cId) throw new Error('Missing coupleId');
  await setDoc(doc(db, 'couples', cId, 'progress', 'indexes'), { [indexKey(uid, categoryFilter)]: index }, { merge: true });
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
      console.warn('Unlimited safeDecrypt error:', e);
    }
  }
  const fallback = data.text ?? data.choice;
  if (fallback && typeof fallback === 'string' && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return '';
}

/**
 * Efface les réponses des deux partenaires (appelé quand les 2 ont avancé).
 */
async function deleteSlotAnswers(cId: string, slot: string, myUid: string, pUid: string): Promise<void> {
  if (!cId) throw new Error('Missing coupleId');
  await Promise.all([
    deleteDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', myUid)).catch(() => {}),
    deleteDoc(doc(db, 'couples', cId, 'daily', slot, 'answers', pUid)).catch(() => {}),
  ]);
}

const CATEGORY_NAMES: Record<string, string> = {
  amour: 'Amour',
  fun: 'Fun',
  profond: 'Profond',
  intime: 'Intime',
  pile_ou_face: 'Tu préfères',
  famille: 'Famille',
  debat: 'Débat',
  futur: 'Futur',
  souvenir: 'Souvenir',
  reve: 'Rêve',
  quotidien: 'Quotidien',
  defi: 'Défi',
};

const CATEGORY_REQUIREMENTS: Record<string, string | null> = {
  amour: null,
  fun: 'fun',
  profond: 'profond',
  intime: 'intime',
  pile_ou_face: 'pile_ou_face',
  famille: 'famille',
  debat: 'debat',
  futur: 'futur',
  souvenir: 'souvenir',
  reve: 'reve',
  quotidien: 'quotidien',
  defi: 'defi',
};

async function completeUnlimitedQuestion(
  cId: string,
  slot: string,
  category: string | undefined,
  uid: string,
  partnerUid: string
): Promise<{ justReachedTen?: boolean; unlockedCategory?: string } | void> {
  if (!cId) throw new Error('Missing coupleId');
  const slotRef = doc(db, 'couples', cId, 'daily', slot);
  const walletRef = doc(db, `couples/${cId}/economy/wallet`);
  const myAnswerRef = doc(db, 'couples', cId, 'daily', slot, 'answers', uid);
  const partnerAnswerRef = doc(db, 'couples', cId, 'daily', slot, 'answers', partnerUid);

  return await runTransaction(db, async (tx) => {
    const slotSnap = await tx.get(slotRef);
    const myAnswer = await tx.get(myAnswerRef);
    const partnerAnswer = await tx.get(partnerAnswerRef);
    // Les deux partenaires DOIVENT avoir répondu pour que la question soit validée
    if (!slotSnap.exists() || !myAnswer.exists() || !partnerAnswer.exists()) return;

    const slotData = slotSnap.data();
    if (slotData.bothAnswered === true) return;

    // Résolution précise et infaillible de la catégorie
    let resolvedCategory = (category && category !== 'all') ? category : undefined;
    if (!resolvedCategory && slotData.questionCategory && slotData.questionCategory !== 'all') {
      resolvedCategory = slotData.questionCategory;
    }
    if (!resolvedCategory && slotData.category && slotData.category !== 'all') {
      resolvedCategory = slotData.category;
    }
    if (!resolvedCategory && slotData.questionId) {
      const q = getQuestionById(slotData.questionId);
      if (q) {
        resolvedCategory = isPof(q) ? 'pile_ou_face' : q.category;
      } else if (slotData.questionId.startsWith('pof_')) {
        resolvedCategory = 'pile_ou_face';
      } else {
        const match = slotData.questionId.match(/^q_gen_([a-z_]+)_\d+$/);
        if (match) resolvedCategory = match[1];
      }
    }

    let walletSnap: any = null;
    if (resolvedCategory) {
      walletSnap = await tx.get(walletRef);
    }

    tx.update(slotRef, {
      bothAnswered: true,
      hasAnswer: true,
      countedForStats: true,
      category: resolvedCategory || slotData.category || 'all',
      questionCategory: resolvedCategory || slotData.questionCategory || null,
    });

    let justReachedTen = false;

    if (resolvedCategory) {
      const currentStats = walletSnap?.exists() ? (walletSnap.data().unlimitedStats || {}) : {};
      const currentCount = currentStats[resolvedCategory] || 0;
      const newCount = currentCount + 1;
      tx.set(walletRef, {
        unlimitedStats: {
          ...currentStats,
          [resolvedCategory]: newCount,
        }
      }, { merge: true });

      if (newCount === 10) {
        justReachedTen = true;
      }
    }

    return { justReachedTen, unlockedCategory: resolvedCategory };
  });
}

export default function UnlimitedQuestions({ categoryFilter }: { categoryFilter?: string }) {
  const store  = useOnboardingStore((s) => s);
  const theme  = store.isDarkMode ? Colors.dark : Colors.light;
  const styles = getStyles(theme);
  const myUid  = store.uid;
  const pseudo = store.pseudo ?? 'Moi';

  const [question, setQuestion]             = useState<AnyQuestion | null>(null);
  const [loadingQuestion, setLoading]       = useState(true);
  const [loadError, setLoadError]           = useState<string | null>(null);
  const [needsPartner, setNeedsPartner]     = useState(false);
  const [partnerUid, setPartnerUid]         = useState<string | null>(null);
  const [partnerPseudo, setPartnerPseudo]   = useState('Partenaire');
  const [cId, setCId]                       = useState('');

  const [questionIndex, setQuestionIndex]   = useState(0);
  const [slotKey, setSlotKey]               = useState('');

  // Réponses — chiffrées dans Firestore, affichées en clair en local
  const [myAnswer, setMyAnswer]             = useState('');
  const [isSubmitted, setIsSubmitted]       = useState(false);
  const [savingAnswer, setSavingAnswer]     = useState(false);

  const [partnerHasAnswered, setPartnerHasAnswered] = useState(false);
  const [partnerAnswer, setPartnerAnswer]           = useState<string | null>(null);

  const [loadingNext, setLoadingNext]       = useState(false);

  // Vrai quand le partenaire a déjà cliqué "Suivante" pour ce slot
  const [partnerMovedToNext, setPartnerMovedToNext] = useState(false);
  const [celebration, setCelebration]               = useState<{ categoryName: string } | null>(null);

  const isSubmittedRef = useRef(false);
  useEffect(() => { isSubmittedRef.current = isSubmitted; }, [isSubmitted]);

  // Geste de swipe vers le haut pour valider sa réponse ou passer à la question suivante
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: any) => {
    touchStartY.current = e.nativeEvent.pageY;
  };
  const handleTouchEnd = (e: any) => {
    if (touchStartY.current !== null) {
      const deltaY = touchStartY.current - e.nativeEvent.pageY;
      if (deltaY > 50) {
        if (!isSubmitted && myAnswer.trim().length > 0 && !savingAnswer) {
          triggerHaptic('selection');
          handleSubmit();
        } else if (isSubmitted && !loadingNext) {
          triggerHaptic('selection');
          handleNext();
        }
      }
    }
    touchStartY.current = null;
  };

  const loadSlot = useCallback(async (uid: string, pUid: string, coupleKey: string, idx: number) => {
    setLoading(true);
    setLoadError(null);
    setMyAnswer('');
    setPartnerAnswer(null);
    setPartnerHasAnswered(false);
    setIsSubmitted(false);
    isSubmittedRef.current = false;

    const slot = nowSlot(idx, categoryFilter);
    setSlotKey(slot);
    setQuestionIndex(idx);
    setPartnerMovedToNext(false);

    // Paralléliser : question + réponses existantes
    try {
      const reads = Promise.all([
        pickUnlimitedQuestion(coupleKey, slot, categoryFilter),
        getDoc(doc(db, 'couples', coupleKey, 'daily', slot, 'answers', uid)),
        getDoc(doc(db, 'couples', coupleKey, 'daily', slot, 'answers', pUid)),
      ]);
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 8000);
      });
      const [questionId, myAns, pAns] = await Promise.race([reads, timeout]);

      setQuestion(getQuestionById(questionId));

      if (myAns.exists()) {
        setIsSubmitted(true);
        isSubmittedRef.current = true;
        setMyAnswer(await safeDecrypt(myAns.data(), coupleKey));
      }

      if (pAns.exists()) {
        const data = pAns.data();
        setPartnerHasAnswered(true);
        if (data.movedToNext) {
          setPartnerMovedToNext(true);
        }
        if (isSubmittedRef.current) {
          setPartnerAnswer(await safeDecrypt(data, coupleKey));
        }
      }
    } catch (error) {
      console.error('Unlimited question load failed:', error);
      setQuestion(null);
      setLoadError(error instanceof Error && error.message === 'TIMEOUT'
        ? 'Le chargement prend trop de temps. Vérifie ta connexion puis réessaie.'
        : 'Impossible de charger cette question. Vérifie la synchronisation et réessaie.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const firebaseUid = auth.currentUser?.uid;
      if (!firebaseUid) return;
      setLoadError(null);
      try {
        const myDoc = await getDoc(doc(db, 'users', firebaseUid));
        if (!myDoc.exists()) throw new Error('Profil utilisateur introuvable.');
        const pUid = myDoc.data().linkedTo as string | undefined;
        if (!pUid) {
          if (!cancelled) {
            setNeedsPartner(true);
            setLoading(false);
          }
          return;
        }
        setPartnerUid(pUid);

        const coupleKey = coupleId(firebaseUid, pUid);
        setCId(coupleKey);

        // --- VÉRIFICATION DE VERROUILLAGE DES THÈMES ---
        if (categoryFilter) {
          const req = CATEGORY_REQUIREMENTS[categoryFilter];
          if (req) {
            const walletSnap = await getDoc(doc(db, 'couples', coupleKey, 'economy', 'wallet'));
            const reqCount = walletSnap.exists() ? (walletSnap.data().unlimitedStats?.[req] || 0) : 0;
            if (reqCount < 10) {
              Alert.alert("Thème verrouillé", `Répondez ensemble à 10 questions de ce thème en mode Illimité pour le débloquer ! (${reqCount}/10)`);
              router.replace('/dashboard');
              return;
            }
          }
        }
        // ------------------------------------------------
        // ------------------------------------------------

        const [pDoc, currentIdx] = await Promise.all([
          getDoc(doc(db, 'users', pUid)),
          readCurrentIndex(coupleKey, firebaseUid, categoryFilter),
        ]);

        if (cancelled) return;
        if (pDoc.exists()) setPartnerPseudo(pDoc.data().pseudo ?? 'Partenaire');
        await loadSlot(firebaseUid, pUid, coupleKey, currentIdx);
      } catch (error) {
        console.error('Unlimited init failed:', error);
        if (!cancelled) {
          const code = typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
          setLoadError(code === 'permission-denied'
            ? 'Accès Firestore refusé. Vérifie que ton compte est bien synchronisé puis réessaie.'
            : 'Impossible de charger les questions. Vérifie la synchronisation et réessaie.');
          setLoading(false);
        }
      }
    };
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoadError('Session expirée. Reconnecte-toi pour accéder aux catégories.');
        setLoading(false);
        return;
      }
      void init();
    });
    return () => {
      cancelled = true;
      unsubscribeAuth();
    };
  }, [myUid, categoryFilter, loadSlot]);

  // ── Listener partenaire ─────────────────────────────────────────────────
  useEffect(() => {
    if (!myUid || !partnerUid || !slotKey || !cId) return;
    const ref = doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid);
    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Le partenaire a avancé à la question suivante
        if (data.movedToNext) {
          setPartnerMovedToNext(true);
          const decrypted = await safeDecrypt(data, cId);
          if (decrypted && decrypted.length > 0) {
            setPartnerHasAnswered(true);
            setPartnerAnswer(decrypted);
          }
          return;
        }
        const decrypted = await safeDecrypt(data, cId);
        if (decrypted && decrypted.length > 0) {
          setPartnerHasAnswered(true);
          if (isSubmittedRef.current) {
            setPartnerAnswer(decrypted);
            const resolvedCat = categoryFilter || (question && isPof(question) ? 'pile_ou_face' : (question as Question)?.category);
            void completeUnlimitedQuestion(cId, slotKey, resolvedCat, myUid, partnerUid).then((res) => {
              if (res && res.justReachedTen && res.unlockedCategory) {
                setCelebration({
                  categoryName: CATEGORY_NAMES[res.unlockedCategory] || res.unlockedCategory,
                });
              }
            }).catch(() => {});
            updateWalletStreak(cId).catch(console.error);
          }
        }
      } else {
        setPartnerHasAnswered(false);
        setPartnerAnswer(null);
        setPartnerMovedToNext(false);
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Unlimited partner listener failed:', error);
      }
    });
    return () => unsub();
  }, [myUid, partnerUid, slotKey, cId, question, categoryFilter]);

  // ── Soumettre ma réponse — stockage chiffré temporaire ───────────────────
  const handleSubmit = async (choice?: string) => {
    const finalAnswer = (choice || myAnswer).trim();
    if (!finalAnswer || finalAnswer.length === 0 || !myUid || !partnerUid || !question || !slotKey || !cId || savingAnswer || isSubmitted) return;

    if (choice) sound.pop();
    else sound.tap();

    setSavingAnswer(true);
    if (choice) setMyAnswer(choice);
    else setMyAnswer(finalAnswer);

    try {
      // Chiffrement AES-GCM avant envoi
      let docData: Record<string, any> = {
        submittedAt: serverTimestamp(),
      };
      try {
        const encrypted = await encryptText(finalAnswer, cId);
        docData = { ...docData, ...encrypted };
      } catch (err) {
        console.warn('encryptText fallback in UnlimitedQuestions:', err);
        docData.text = finalAnswer;
      }
      if (!docData.ciphertext) {
        docData.text = finalAnswer;
      }
      if (choice) {
        docData.choice = choice;
      }

      await setDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', myUid), docData);
      setIsSubmitted(true);
      isSubmittedRef.current = true;
      void checkQuests(cId, 'question_answered', 1);
      void checkQuests(cId, 'bonus_question', 1);

      const resolvedCat = categoryFilter || (question && isPof(question) ? 'pile_ou_face' : (question as Question)?.category);

      const pAns = await getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid));
      if (pAns.exists()) {
        setPartnerHasAnswered(true);
        const decryptedPartner = await safeDecrypt(pAns.data(), cId);
        if (decryptedPartner && decryptedPartner.length > 0) {
          setPartnerAnswer(decryptedPartner);
          sound.success();
        }
        const res = await completeUnlimitedQuestion(cId, slotKey, resolvedCat, myUid, partnerUid);
        if (res && typeof res === 'object' && res.justReachedTen && res.unlockedCategory) {
          sound.reward();
          setCelebration({
            categoryName: CATEGORY_NAMES[res.unlockedCategory] || res.unlockedCategory,
          });
        }
        updateWalletStreak(cId).catch(console.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAnswer(false);
    }
  };

  useEffect(() => {
    if (!partnerHasAnswered || !isSubmitted || !myUid || !partnerUid || !slotKey || !cId) return;
    getDoc(doc(db, 'couples', cId, 'daily', slotKey, 'answers', partnerUid)).then(async (snap) => {
      if (snap.exists()) {
        const decryptedPartner = await safeDecrypt(snap.data(), cId);
        if (decryptedPartner && decryptedPartner.length > 0) {
          setPartnerAnswer(decryptedPartner);
          sound.success();
          const resolvedCat = categoryFilter || (question && isPof(question) ? 'pile_ou_face' : (question as Question)?.category);
          const res = await completeUnlimitedQuestion(cId, slotKey, resolvedCat, myUid, partnerUid).catch(() => {});
          if (res && typeof res === 'object' && res.justReachedTen && res.unlockedCategory) {
            sound.reward();
            setCelebration({
              categoryName: CATEGORY_NAMES[res.unlockedCategory] || res.unlockedCategory,
            });
          }
          updateWalletStreak(cId).catch(console.error);
        }
      }
    });
  }, [partnerHasAnswered, isSubmitted, question, categoryFilter]);

  // ── Question suivante — stockage provisoire avec flag movedToNext ────────
  const handleNext = async () => {
    if (!myUid || !partnerUid || !cId) return;
    sound.pop();
    setLoadingNext(true);

    const myAnsRef = doc(db, 'couples', cId, 'daily', slotKey, 'answers', myUid);

    // Si le partenaire a déjà marqué movedToNext → les 2 ont avancé → on supprime
    if (partnerMovedToNext) {
      await deleteSlotAnswers(cId, slotKey, myUid, partnerUid);
    } else {
      // Sinon, marquer seulement MON doc — le partenaire verra le flag via onSnapshot
      try {
        await updateDoc(myAnsRef, { movedToNext: true });
      } catch {
        // Si mon doc n'existe pas encore (cas rare), on le crée
        await setDoc(myAnsRef, { movedToNext: true }, { merge: true });
      }
    }

    const nextIdx = questionIndex + 1;
    await saveCurrentIndex(cId, myUid, nextIdx, categoryFilter);
    await loadSlot(myUid, partnerUid, cId, nextIdx);
    setLoadingNext(false);
  };

  if (loadingQuestion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#A855F7" size="large" />
        <Text style={{ color: theme.text, marginTop: 16, opacity: 0.75 }}>Chargement...</Text>
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
              ? 'Tu dois être synchronisé avec un partenaire pour accéder aux questions.'
              : `${loadError ?? 'Impossible de charger les questions. Vérifie la synchronisation et réessaie.'}`}
          </Text>
          <Pressable
            onPress={() => router.replace(needsPartner ? '/onboarding/sync' : (categoryFilter ? `/unlimited?category=${encodeURIComponent(categoryFilter)}` : '/unlimited'))}
            style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: theme.tint }}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>
              {needsPartner ? 'Synchroniser mon couple' : 'Réessayer'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const bothAnswered = isSubmitted && partnerAnswer !== null;
  const isPofQuestion = isPof(question);

  const getPofText = (ans: string) => {
    if (!isPofQuestion) return ans;
    return ans === 'A' ? question.optionA : question.optionB;
  };

  const getCategoryInfo = (cat: string | undefined) => {
    switch (cat) {
      case 'amour': return { colors: ['#EF4444', '#FCA5A5'], icon: <Heart color="white" size={22} />, title: 'AMOUR' };
      case 'fun': return { colors: ['#F59E0B', '#FCD34D'], icon: <Smile color="white" size={22} />, title: 'FUN' };
      case 'profond': return { colors: ['#3B82F6', '#93C5FD'], icon: <Brain color="white" size={22} />, title: 'PROFOND' };
      case 'intime': return { colors: ['#BE185D', '#F472B6'], icon: <Flame color="white" size={22} />, title: 'INTIME' };
      case 'pile_ou_face': return { colors: ['#0EA5E9', '#7DD3FC'], icon: <Split color="white" size={22} />, title: 'TU PRÉFÈRES' };
      case 'famille': return { colors: ['#10B981', '#6EE7B7'], icon: <Home color="white" size={22} />, title: 'FAMILLE' };
      case 'debat': return { colors: ['#8B5CF6', '#C4B5FD'], icon: <MessageCircle color="white" size={22} />, title: 'DÉBAT' };
      case 'futur': return { colors: ['#6366F1', '#A5B4FC'], icon: <Rocket color="white" size={22} />, title: 'FUTUR' };
      case 'souvenir': return { colors: ['#14B8A6', '#5EEAD4'], icon: <Camera color="white" size={22} />, title: 'SOUVENIR' };
      case 'reve': return { colors: ['#EAB308', '#FDE68A'], icon: <Star color="white" size={22} />, title: 'RÊVE' };
      case 'quotidien': return { colors: ['#78716C', '#D6D3D1'], icon: <Coffee color="white" size={22} />, title: 'QUOTIDIEN' };
      case 'defi': return { colors: ['#EA580C', '#FDBA74'], icon: <Rocket color="white" size={22} />, title: 'DÉFI' };
      default: return { colors: ['#A855F7', '#D946EF'], icon: <InfinityIcon color="white" size={22} />, title: 'ILLIMITÉ' };
    }
  };

  const displayedCategory = categoryFilter ? (isPofQuestion ? 'pile_ou_face' : categoryFilter) : undefined;
  const catInfo = getCategoryInfo(displayedCategory);
  const currentQuestionCat = isPofQuestion ? 'pile_ou_face' : (question as Question).category;
  const currentQuestionCatInfo = getCategoryInfo(currentQuestionCat);

  const headerColors = categoryFilter
    ? (catInfo.colors as [string, string])
    : (['#A855F7', '#D946EF'] as [string, string]);

  const headerIcon = categoryFilter
    ? catInfo.icon
    : <InfinityIcon color="white" size={22} />;

  const headerTitle = categoryFilter
    ? catInfo.title
    : `ILLIMITÉ · ${currentQuestionCatInfo.title}`;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={FadeInUp.duration(600).springify()}
          layout={Layout.springify()}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={styles.card}
        >
          <LinearGradient colors={headerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            {headerIcon}
            <Text style={styles.headerTitle}>{headerTitle}</Text>
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
                    <Pressable style={({ pressed }) => [styles.optionBtn, { opacity: pressed || savingAnswer || isSubmitted ? 0.7 : 1 }]} onPress={() => handleSubmit('A')} disabled={savingAnswer || isSubmitted}>
                      <Text style={styles.optionBtnText}>{question.optionA}</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.optionBtn, { opacity: pressed || savingAnswer || isSubmitted ? 0.7 : 1, backgroundColor: '#0EA5E9' }]} onPress={() => handleSubmit('B')} disabled={savingAnswer || isSubmitted}>
                      <Text style={styles.optionBtnText}>{question.optionB}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={[styles.input, { borderColor: '#E9D5FF', color: theme.text, backgroundColor: store.isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.02)' }]}
                      placeholder="Ta réponse..."
                      placeholderTextColor="#A99693"
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
                    <Text style={{ textAlign: 'right', fontSize: 12, color: '#A99693', marginTop: -14, marginBottom: 14, marginRight: 8 }}>
                      {myAnswer.length} / 2000
                    </Text>
                    <Pressable
                      style={({ pressed }) => [styles.submitButton, { backgroundColor: catInfo.colors[0], opacity: pressed || !myAnswer.trim() || savingAnswer || isSubmitted ? 0.7 : 1 }]}
                      onPress={() => handleSubmit()}
                      disabled={!myAnswer.trim() || savingAnswer || isSubmitted}
                    >
                      {savingAnswer ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>Valider ma réponse</Text>}
                    </Pressable>
                  </>
                )}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} layout={Layout.springify()}>
                {/* Ma réponse — chiffrée en Firestore, affichée ici */}
                <View style={[styles.myAnswerBox, isPofQuestion && { borderColor: '#0EA5E9', backgroundColor: 'rgba(14,165,233,0.05)' }]}>
                  <Text style={[styles.myAnswerLabel, isPofQuestion && { color: '#0EA5E9' }]}>Ta réponse 🔒</Text>
                  <Text style={styles.myAnswerText}>{getPofText(myAnswer)}</Text>
                </View>

                {/* Réponse partenaire — visible quand les 2 ont répondu */}
                {partnerAnswer !== null ? (
                  <Animated.View entering={FadeInUp.duration(500)} style={[styles.revealBox, isPofQuestion && { borderLeftColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.05)' }]}>
                    <View style={styles.revealHeader}>
                      <Unlock color={isPofQuestion ? '#38BDF8' : '#D946EF'} size={16} />
                      <Text style={[styles.revealTitle, isPofQuestion && { color: '#0EA5E9' }]}>{partnerPseudo} a répondu !</Text>
                    </View>
                    <Text style={styles.partnerText}>{getPofText(partnerAnswer)}</Text>
                  </Animated.View>
                ) : partnerMovedToNext ? (
                  // Partenaire déjà à la question suivante mais sans réponse reçue
                  <Animated.View entering={FadeInUp.duration(400)} style={[styles.movedOnBox]}>
                    <Text style={styles.movedOnEmoji}>👟</Text>
                    <Text style={styles.movedOnTitle}>{partnerPseudo} est déjà à la suivante !</Text>
                    <Text style={styles.movedOnSub}>Avance pour rejoindre {partnerPseudo}.</Text>
                  </Animated.View>
                ) : (
                  <View style={styles.waitingBox}>
                    <ActivityIndicator color={isPofQuestion ? '#0EA5E9' : '#A855F7'} size="small" />
                    <Text style={{ color: '#A99693', fontSize: 14, fontStyle: 'italic' }}>{partnerPseudo} n’a pas encore répondu...</Text>
                  </View>
                )}

                {/* Si le partenaire est déjà à la suivante ET qu'on a sa réponse, afficher aussi le bandeau indicatif sous la réponse */}
                {partnerMovedToNext && partnerAnswer !== null && (
                  <Animated.View entering={FadeInUp.duration(400)} style={[styles.movedOnBox, { marginTop: 12 }]}>
                    <Text style={styles.movedOnEmoji}>👟</Text>
                    <Text style={styles.movedOnTitle}>{partnerPseudo} est déjà à la suivante !</Text>
                    <Text style={styles.movedOnSub}>Avance pour rejoindre {partnerPseudo}.</Text>
                  </Animated.View>
                )}

                {/* Bouton suivant — n'apparaît que quand les 2 ont répondu */}
                <Animated.View entering={FadeInUp.delay(300).duration(500)} style={{ marginTop: 16 }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.nextButton,
                      isPofQuestion && { backgroundColor: '#0EA5E9', shadowColor: '#0EA5E9' },
                      (!bothAnswered && !partnerMovedToNext) && styles.nextButtonDisabled,
                      { opacity: pressed || loadingNext || (!bothAnswered && !partnerMovedToNext) ? 0.55 : 1 },
                    ]}
                    onPress={handleNext}
                    disabled={loadingNext || (!bothAnswered && !partnerMovedToNext)}
                  >
                    {loadingNext ? <ActivityIndicator color="white" /> : (
                      <>
                        <Text style={styles.nextButtonText}>
                          {partnerMovedToNext
                            ? `Rejoindre ${partnerPseudo}`
                            : bothAnswered
                              ? 'Question suivante'
                              : `En attente de ${partnerPseudo}...`}
                        </Text>
                        {bothAnswered && !partnerMovedToNext && <ChevronRight color="white" size={20} />}
                      </>
                    )}
                  </Pressable>
                </Animated.View>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Modal Célébration Déblocage de Catégorie */}
      <Modal visible={!!celebration} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInUp.duration(350)} style={styles.modalContent}>
            <Text style={{ fontSize: 50, textAlign: 'center', marginBottom: 12 }}>🎉</Text>
            <Text style={styles.modalTitle}>Thème Débloqué !</Text>
            <Text style={styles.modalText}>
              Vous avez répondu ensemble à 10 questions du thème <Text style={{ fontWeight: 'bold' }}>{celebration?.categoryName}</Text> !
            </Text>
            <View style={styles.unlockedBadge}>
              <Text style={styles.unlockedBadgeText}>
                ✨ Le thème « {celebration?.categoryName} » est maintenant débloqué sur votre accueil !
              </Text>
            </View>
            <Pressable style={styles.modalConfirmBtn} onPress={() => setCelebration(null)}>
              <Text style={styles.modalConfirmBtnText}>Génial ! 🚀</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: typeof Colors.light | typeof Colors.dark) => StyleSheet.create({
  container: { flex: 1 },
  noticeCard: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 14, padding: 24, borderRadius: 20, borderWidth: 1 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)', overflow: 'hidden', backgroundColor: theme.card, shadowColor: '#A855F7', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
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
  question: { fontSize: 19, fontWeight: '600', textAlign: 'center', marginBottom: 24, lineHeight: 28, color: theme.text },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, textAlignVertical: 'top', marginBottom: 16, lineHeight: 24 },
  submitButton: { backgroundColor: '#A855F7', padding: 16, borderRadius: 16, alignItems: 'center' },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  optionsRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  optionBtn: { flex: 1, backgroundColor: '#38BDF8', paddingVertical: 24, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, minHeight: 120 },
  optionBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center', lineHeight: 22 },
  myAnswerBox: { borderWidth: 1.5, borderColor: '#A855F7', borderRadius: 16, padding: 16, marginBottom: 16, backgroundColor: 'rgba(168,85,247,0.05)' },
  myAnswerLabel: { fontSize: 11, fontWeight: '800', color: '#A855F7', marginBottom: 6, letterSpacing: 0.5 },
  myAnswerText: { fontSize: 16, fontWeight: '700', color: theme.text, lineHeight: 24, textAlign: 'center' },
  waitingBox: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  revealBox: { padding: 18, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#D946EF', backgroundColor: 'rgba(217,70,239,0.05)', marginBottom: 4 },
  revealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  revealTitle: { fontSize: 15, fontWeight: 'bold', color: '#A855F7' },
  partnerText: { fontSize: 17, fontWeight: '700', lineHeight: 25, color: theme.text, textAlign: 'center' },
  nextButton: { flexDirection: 'row', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#A855F7', shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
  nextButtonDisabled: { backgroundColor: '#E9D5FF', shadowOpacity: 0 },
  nextButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  movedOnBox: { alignItems: 'center', gap: 6, paddingVertical: 20, paddingHorizontal: 16, backgroundColor: 'rgba(168,85,247,0.06)', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.2)', borderStyle: 'solid', marginBottom: 4 },
  movedOnEmoji: { fontSize: 28 },
  movedOnTitle: { fontSize: 15, fontWeight: '700', color: '#A855F7', textAlign: 'center' },
  movedOnSub: { fontSize: 12, color: '#A99693', fontStyle: 'italic', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 360, backgroundColor: theme.card, borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#A855F7', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text, marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, color: theme.text, opacity: 0.85, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  unlockedBadge: { backgroundColor: 'rgba(168,85,247,0.12)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)', marginBottom: 20, width: '100%' },
  unlockedBadgeText: { color: '#A855F7', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  modalConfirmBtn: { backgroundColor: '#A855F7', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 18, width: '100%', alignItems: 'center' },
  modalConfirmBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },
});
