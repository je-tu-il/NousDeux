import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ImageBackground,
  Platform,
  Pressable,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ScrollView,
  InputAccessoryView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useSegments } from 'expo-router';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp, withRepeat, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, CalendarDays, Loader2 } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, deleteField, writeBatch } from 'firebase/firestore';

export default function DateScreen() {
  const [day, setDay]     = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear]   = useState('');
  const [loading, setLoading]               = useState(false);
  const [waitingForPartner, setWaiting]     = useState(false);
  const [errorMessage, setError]            = useState('');
  const [success, setSuccess]               = useState(false);

  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const handleDayChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setDay(cleaned);
    if (cleaned.length === 2) {
      monthRef.current?.focus();
    }
  };

  const handleMonthChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setMonth(cleaned);
    if (cleaned.length === 2) {
      yearRef.current?.focus();
    }
  };

  const handleYearChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setYear(cleaned);
    if (cleaned.length === 4) {
      Keyboard.dismiss();
    }
  };

  // partnerUid stocké en state pour être accessible dans handleSubmit
  const [partnerUid, setPartnerUid] = useState<string | null>(null);

  const store    = useOnboardingStore((s) => s);
  const theme    = store.isDarkMode ? Colors.dark : Colors.light;
  const myUid    = store.uid;
  const segments = useSegments();
  const redirectGuardRef = useRef<string | null>(null);
  const spinAnim = useSharedValue(0);

  const redirectOnce = (route: '/dashboard' | '/onboarding/sync') => {
    const current = segments[segments.length - 1];
    if (current === route.split('/').pop()) return;
    if (redirectGuardRef.current === route) return;
    redirectGuardRef.current = route;
    router.replace(route);
  };

  const waitingRef = useRef(false);
  useEffect(() => { waitingRef.current = waitingForPartner; }, [waitingForPartner]);

  useEffect(() => {
    if (waitingForPartner) {
      spinAnim.value = withRepeat(withTiming(360, { duration: 1000 }), -1, false);
    }
  }, [waitingForPartner]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinAnim.value}deg` }],
  }));

  // ── Comparaison des deux dates proposées ─────────────────────────────────
  // Fonction partagée appelée depuis le listener ET depuis handleSubmit
  const compareProposals = async (myProposed: string, partnerProposed: string, pUid: string) => {
    if (myProposed === partnerProposed) {
      setSuccess(true);
      const batch = writeBatch(db);
      if (myUid) batch.update(doc(db, 'users', myUid), { coupleDate: myProposed, proposedDate: deleteField(), needsDate: deleteField(), dateMismatch: deleteField() });
      batch.update(doc(db, 'users', pUid), { coupleDate: myProposed, proposedDate: deleteField(), needsDate: deleteField(), dateMismatch: deleteField() });
      await batch.commit();
      setTimeout(() => redirectOnce('/dashboard'), 2000);
    } else {
      const batch = writeBatch(db);
      if (myUid) batch.update(doc(db, 'users', myUid), { proposedDate: deleteField(), dateMismatch: true });
      batch.update(doc(db, 'users', pUid), { proposedDate: deleteField(), dateMismatch: true });
      await batch.commit();
      setWaiting(false);
      waitingRef.current = false;
      setDay(''); setMonth(''); setYear('');
      setError("Ton partenaire n'a pas mis la même date !\nÊtes-vous sûrs de la date où vous vous êtes mis ensemble ?");
    }
  };

  // ── Listener Firebase — créé UNE SEULE fois (dépend uniquement de myUid) ──
  useEffect(() => {
    if (!myUid) { router.replace('/onboarding/login'); return; }

    let unsubPartner: (() => void) | undefined;
    let unsubMe: (() => void) | undefined;

    const setupListener = async () => {
      const myDoc = await getDoc(doc(db, 'users', myUid));
      if (!myDoc.exists()) return;
      const data = myDoc.data();
      const pUid = data.linkedTo as string | undefined;

      if (!pUid) { redirectOnce('/onboarding/sync'); return; }

      // Stocker partnerUid dans le state pour handleSubmit
      setPartnerUid(pUid);

      // Si coupleDate déjà présente → dashboard directement (pas de suppression!)
      if (data.coupleDate && !data.needsDate) { redirectOnce('/dashboard'); return; }

      if (data.dateMismatch) {
        setError("Ton partenaire n'a pas mis la même date !\nÊtes-vous sûrs de la date où vous vous êtes mis ensemble ?");
      }

      // Restauration de l'état "en attente" après un refresh
      if (data.proposedDate) {
        setWaiting(true);
        waitingRef.current = true;
        // Extraire JJ/MM/AAAA de la date ISO stockée
        const parts = (data.proposedDate as string).split('-');
        if (parts.length === 3) {
          setYear(parts[0]);
          setMonth(String(parseInt(parts[1], 10)));
          setDay(String(parseInt(parts[2], 10)));
        }
      }

      // Listener sur mon propre doc pour recevoir dateMismatch ou validation du partenaire
      unsubMe = onSnapshot(doc(db, 'users', myUid), (mySnap) => {
        if (!mySnap.exists()) return;
        const myData = mySnap.data();
        if (myData.coupleDate && !myData.needsDate) {
          setSuccess(true);
          setTimeout(() => redirectOnce('/dashboard'), 2000);
        } else if (myData.dateMismatch) {
          setWaiting(false);
          waitingRef.current = false;
          setDay(''); setMonth(''); setYear('');
          setError("Ton partenaire n'a pas mis la même date !\nÊtes-vous sûrs de la date où vous vous êtes mis ensemble ?");
        }
      });

      // Listener sur le doc du partenaire
      unsubPartner = onSnapshot(doc(db, 'users', pUid), async (partnerSnap) => {
        if (!partnerSnap.exists()) return;
        const pData = partnerSnap.data();

        // Cas 1 : partenaire a déjà une coupleDate → on la copie, on part
        // Cas 2 : partenaire a proposé une date et JE suis en attente
        if (waitingRef.current && pData.proposedDate) {
          const myLatest = await getDoc(doc(db, 'users', myUid));
          if (!myLatest.exists() || !myLatest.data().proposedDate) return;
          await compareProposals(myLatest.data().proposedDate, pData.proposedDate, pUid);
        }
      });
    };

    setupListener();
    return () => {
      if (unsubPartner) unsubPartner();
      if (unsubMe) unsubMe();
    };
  }, [myUid]);

  // ── Validation + soumission ───────────────────────────────────────────────
  const handleSubmit = async () => {
    Keyboard.dismiss();
    const dayNum   = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum  = parseInt(year, 10);

    if (!day || !month || !year || isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
      setError('Veuillez remplir tous les champs (JJ / MM / AAAA).'); return;
    }
    if (dayNum < 1 || dayNum > 31)    { setError('Le jour doit être entre 1 et 31.'); return; }
    if (monthNum < 1 || monthNum > 12) { setError('Le mois doit être entre 1 et 12.'); return; }
    if (yearNum < 1900 || yearNum > new Date().getFullYear()) {
      setError(`L'année doit être entre 1900 et ${new Date().getFullYear()}.`); return;
    }
    if (!myUid || !partnerUid) return;

    setLoading(true);
    setError('');
    try {
      const proposed = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;

      // 1. Écrire ma proposition et réinitialiser dateMismatch
      await updateDoc(doc(db, 'users', myUid), { proposedDate: proposed, dateMismatch: deleteField() });
      setWaiting(true);
      waitingRef.current = true;

      // 2. Vérifier IMMÉDIATEMENT si le partenaire a déjà proposé
      const partnerDoc = await getDoc(doc(db, 'users', partnerUid));
      if (partnerDoc.exists()) {
        const pData = partnerDoc.data();
        if (pData.proposedDate) {
          await compareProposals(proposed, pData.proposedDate, partnerUid);
        }
      }
    } catch (error: any) {
      setError(error.message);
      setWaiting(false);
      waitingRef.current = false;
    }
    setLoading(false);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={require('../../../assets/images/romantic_calendar_bg.png')}
      style={[styles.container, { backgroundColor: store.isDarkMode ? '#1A1514' : '#FFF5F2' }]}
      resizeMode="cover"
    >
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header avec bouton retour */}
              <View style={styles.header}>
                <Pressable
                  style={styles.backBtn}
                  onPress={() => {
                    Keyboard.dismiss();
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.replace('/onboarding/sync');
                    }
                  }}
                >
                  <ArrowLeft color={theme.text} size={28} />
                </Pressable>
              </View>

              <View style={styles.content}>
                <Animated.View entering={FadeInDown.duration(800)}>
                  <CalendarDays color={theme.tint} size={60} style={{ alignSelf: 'center', marginBottom: 20 }} />
                  <Text style={[styles.title, { color: theme.text }]}>La Date Importante</Text>
                  <Text style={[styles.subtitle, { color: theme.text }]}>
                    {waitingForPartner
                      ? 'En attente de la réponse de ton partenaire...'
                      : "À quand remonte votre mise en couple ? Vos réponses doivent correspondre !"}
                  </Text>
                </Animated.View>

                {!!errorMessage && (
                  <Animated.View entering={FadeInDown.duration(400)} style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </Animated.View>
                )}

                {!waitingForPartner ? (
                  <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.pickerContainer}>
                    <Text style={styles.inputInstructions}>Saisissez la date au format JJ / MM / AAAA</Text>
                    <View style={styles.pickersWrapper}>
                      <View style={styles.pickerCol}>
                        <Text style={styles.pickerLabel}>Jour</Text>
                        <TextInput
                          ref={dayRef}
                          style={styles.dateInput}
                          value={day}
                          onChangeText={handleDayChange}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="JJ"
                          placeholderTextColor="#C4A8A4"
                          returnKeyType="next"
                          onSubmitEditing={() => monthRef.current?.focus()}
                          inputAccessoryViewID="dateAccessory"
                        />
                      </View>
                      <View style={styles.pickerCol}>
                        <Text style={styles.pickerLabel}>Mois</Text>
                        <TextInput
                          ref={monthRef}
                          style={styles.dateInput}
                          value={month}
                          onChangeText={handleMonthChange}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="MM"
                          placeholderTextColor="#C4A8A4"
                          returnKeyType="next"
                          onSubmitEditing={() => yearRef.current?.focus()}
                          inputAccessoryViewID="dateAccessory"
                        />
                      </View>
                      <View style={styles.pickerCol}>
                        <Text style={styles.pickerLabel}>Année</Text>
                        <TextInput
                          ref={yearRef}
                          style={styles.dateInput}
                          value={year}
                          onChangeText={handleYearChange}
                          keyboardType="number-pad"
                          maxLength={4}
                          placeholder="AAAA"
                          placeholderTextColor="#C4A8A4"
                          returnKeyType="done"
                          onSubmitEditing={handleSubmit}
                          inputAccessoryViewID="dateAccessory"
                        />
                      </View>
                    </View>
                  </Animated.View>
                ) : success ? (
                  <Animated.View entering={FadeInUp.duration(800)} style={styles.waitingContainer}>
                    <Text style={{ fontSize: 60, marginBottom: 20 }}>✅</Text>
                    <Text style={styles.waitingText}>C'est la bonne date !</Text>
                  </Animated.View>
                ) : (
                  <Animated.View entering={FadeInUp.duration(800)} style={styles.waitingContainer}>
                    <Animated.View style={spinStyle}>
                      <Loader2 color={theme.tint} size={50} style={{ marginBottom: 20 }} />
                    </Animated.View>
                    <Text style={styles.waitingText}>Croisons les doigts ! 🤞</Text>
                    <Text style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginTop: 10 }}>
                      Date proposée : {day.padStart(2, '0')}/{month.padStart(2, '0')}/{year}
                    </Text>
                  </Animated.View>
                )}

                {!waitingForPartner && (
                  <Animated.View entering={FadeInUp.duration(800).delay(400)} style={styles.buttonContainer}>
                    <Pressable
                      style={({ pressed }) => [styles.button, { backgroundColor: theme.tint, opacity: pressed || loading ? 0.8 : 1 }]}
                      onPress={handleSubmit}
                      disabled={loading}
                    >
                      <Text style={styles.buttonText}>Confirmer</Text>
                      <ArrowRight color="white" size={24} />
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="dateAccessory">
          <View style={styles.accessoryBar}>
            <Pressable
              style={styles.accessoryBtn}
              onPress={() => Keyboard.dismiss()}
              hitSlop={10}
            >
              <Text style={styles.accessoryBtnText}>Fermer le clavier</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', minHeight: '100vh' as any },
  scrollView: { flex: 1, width: '100%' },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingTop: 10, marginBottom: 10 },
  backBtn: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.4)' },
  content: { flexGrow: 1, justifyContent: 'center', paddingBottom: 24 },
  title: { fontSize: 32, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.8, textAlign: 'center', marginBottom: 30, lineHeight: 24, fontWeight: '600' },
  pickerContainer: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 24, padding: 20, marginBottom: 30, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  inputInstructions: { textAlign: 'center', color: '#4A3B39', marginBottom: 15, fontWeight: '600', opacity: 0.8 },
  pickersWrapper: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  pickerCol: { flex: 1, alignItems: 'center' },
  pickerLabel: { fontSize: 14, fontWeight: 'bold', color: '#A99693', marginBottom: 10 },
  dateInput: {
    width: '100%',
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 15,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4A3B39',
    borderColor: '#FF9A8B',
    borderWidth: 1,
  },
  buttonContainer: { alignItems: 'center', marginTop: 10 },
  button: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 30, gap: 12, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  waitingContainer: { alignItems: 'center', padding: 40, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 24, marginBottom: 20 },
  waitingText: { fontSize: 18, fontWeight: 'bold', color: '#4A3B39' },
  errorBox: { backgroundColor: 'rgba(255,100,100,0.2)', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#FF6B6B' },
  errorText: { color: '#D32F2F', textAlign: 'center', fontWeight: 'bold', fontSize: 14 },
  accessoryBar: {
    height: 44,
    backgroundColor: '#F7F7F7',
    borderTopWidth: 1,
    borderTopColor: '#E2E2E2',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  accessoryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#FF6A88',
    borderRadius: 8,
  },
  accessoryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
