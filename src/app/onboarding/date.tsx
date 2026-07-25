import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ImageBackground, Platform, Pressable, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp, withRepeat, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ArrowRight, CalendarDays, Loader2 } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, deleteField } from 'firebase/firestore';

export default function DateScreen() {
  // Toujours vide au démarrage — jamais pré-rempli depuis la mémoire
  // Le but : chaque fois qu'on arrive ici (nouveau couple ou re-pairing),
  // la personne doit saisir la date fraîchement.
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const theme = Colors.light;
  const store = useOnboardingStore((state) => state);
  const myUid = store.uid;
  const spinAnim = useSharedValue(0);

  useEffect(() => {
    if (waitingForPartner) {
      spinAnim.value = withRepeat(withTiming(360, { duration: 1000 }), -1, false);
    }
  }, [waitingForPartner]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinAnim.value}deg` }]
  }));

  useEffect(() => {
    if (!myUid) {
      router.replace('/onboarding/login');
      return;
    }

    let unsubPartner: any;

    const setupListener = async () => {
      const myDoc = await getDoc(doc(db, "users", myUid));
      if (!myDoc.exists()) return;
      const data = myDoc.data();
      const partnerUid = data.linkedTo;

      if (!partnerUid) {
        Alert.alert("Erreur", "Tu n'es lié à personne.");
        router.replace('/onboarding/sync');
        return;
      }

      // IMPORTANT : si coupleDate existe (reste d'un ancien couple),
      // on la supprime des deux côtés pour forcer un re-choix propre.
      // Cela arrive quand quelqu'un rejoint un compte qui avait déjà une date.
      if (data.coupleDate) {
        await updateDoc(doc(db, "users", myUid), {
          coupleDate: deleteField(),
          proposedDate: deleteField()
        });
      }

      // Même nettoyage côté partenaire
      const partnerDoc = await getDoc(doc(db, "users", partnerUid));
      if (partnerDoc.exists() && partnerDoc.data().coupleDate) {
        await updateDoc(doc(db, "users", partnerUid), {
          coupleDate: deleteField(),
          proposedDate: deleteField()
        });
      }

      // Écoute les changements du partenaire
      unsubPartner = onSnapshot(doc(db, "users", partnerUid), { includeMetadataChanges: true }, async (partnerSnap) => {
        if (!partnerSnap.exists()) return;
        // Ignorer les événements du cache
        if (partnerSnap.metadata.fromCache) return;

        const pData = partnerSnap.data();

        // Si la date officielle est fixée côté partenaire
        if (pData.coupleDate) {
          await updateDoc(doc(db, "users", myUid), { coupleDate: pData.coupleDate });
          Alert.alert(
            "Date récupérée",
            "Ton partenaire avait déjà validé une date, nous l'avons récupérée automatiquement !",
            [{ text: "OK", onPress: () => router.replace('/dashboard') }]
          );
          return;
        }

        // Si on attend et que le partenaire a aussi proposé
        if (waitingForPartner && pData.proposedDate) {
          const myLatestDoc = await getDoc(doc(db, "users", myUid));
          if (myLatestDoc.exists() && myLatestDoc.data().proposedDate) {
            const myProposed = myLatestDoc.data().proposedDate;

            if (myProposed === pData.proposedDate) {
              // VICTOIRE ! Dates identiques
              setSuccess(true);
              setTimeout(async () => {
                await updateDoc(doc(db, "users", myUid), {
                  coupleDate: myProposed,
                  proposedDate: deleteField()
                });
                router.replace('/dashboard');
              }, 2000);
            } else {
              // Dates différentes — on reset et on recommence
              setWaitingForPartner(false);
              // Nettoyer les propositions des deux côtés
              await updateDoc(doc(db, "users", myUid), { proposedDate: deleteField() });
              await updateDoc(doc(db, "users", partnerUid), { proposedDate: deleteField() });
              setErrorMessage("Ton partenaire n'a pas mis la même date !\nÊtes-vous sûrs de la date où vous vous êtes mis ensemble ?");
              // Reset des champs pour re-saisie
              setDay("");
              setMonth("");
              setYear("");
            }
          }
        }
      });
    };

    setupListener();

    return () => {
      if (unsubPartner) unsubPartner();
    };
  }, [waitingForPartner, myUid]);

  const handleSubmit = async () => {
    // Validation simple
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (!day || !month || !year || isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
      setErrorMessage("Veuillez remplir tous les champs (JJ / MM / AAAA).");
      return;
    }
    if (dayNum < 1 || dayNum > 31) {
      setErrorMessage("Le jour doit être entre 1 et 31.");
      return;
    }
    if (monthNum < 1 || monthNum > 12) {
      setErrorMessage("Le mois doit être entre 1 et 12.");
      return;
    }
    if (yearNum < 1900 || yearNum > new Date().getFullYear()) {
      setErrorMessage(`L'année doit être entre 1900 et ${new Date().getFullYear()}.`);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const formattedMonth = monthNum.toString().padStart(2, '0');
      const formattedDay = dayNum.toString().padStart(2, '0');
      const proposed = `${yearNum}-${formattedMonth}-${formattedDay}`;

      if (myUid) {
        await updateDoc(doc(db, "users", myUid), { proposedDate: proposed });
        setWaitingForPartner(true);
      }
    } catch (error: any) {
      Alert.alert("Erreur", error.message);
    }
    setLoading(false);
  };

  return (
    <ImageBackground source={require('../../../assets/images/romantic_calendar_bg.png')} style={styles.container} resizeMode="cover">
      <View style={styles.keyboardView}>
        <View style={styles.content}>

          <Animated.View entering={FadeInDown.duration(800)}>
            <CalendarDays color={theme.tint} size={60} style={{ alignSelf: 'center', marginBottom: 20 }} />
            <Text style={[styles.title, { color: theme.text }]}>La Date Importante</Text>
            <Text style={[styles.subtitle, { color: theme.text }]}>
              {waitingForPartner
                ? "En attente de la réponse de ton partenaire..."
                : "À quand remonte votre mise en couple ? Vos réponses doivent correspondre pour continuer !"}
            </Text>
          </Animated.View>

          {errorMessage ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </Animated.View>
          ) : null}

          {!waitingForPartner ? (
            <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.pickerContainer}>
              <Text style={styles.inputInstructions}>Saisissez la date au format JJ / MM / AAAA</Text>
              <View style={styles.pickersWrapper}>

                {/* Jour */}
                <View style={styles.pickerCol}>
                  <Text style={styles.pickerLabel}>Jour</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={day}
                    onChangeText={setDay}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="JJ"
                    placeholderTextColor="#C4A8A4"
                  />
                </View>

                {/* Mois */}
                <View style={styles.pickerCol}>
                  <Text style={styles.pickerLabel}>Mois</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={month}
                    onChangeText={setMonth}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor="#C4A8A4"
                  />
                </View>

                {/* Année */}
                <View style={styles.pickerCol}>
                  <Text style={styles.pickerLabel}>Année</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={year}
                    onChangeText={setYear}
                    keyboardType="numeric"
                    maxLength={4}
                    placeholder="AAAA"
                    placeholderTextColor="#C4A8A4"
                  />
                </View>
              </View>
            </Animated.View>
          ) : success ? (
            <Animated.View entering={FadeInUp.duration(800)} style={styles.waitingContainer}>
              <Animated.View entering={FadeInDown.duration(400).delay(300)}>
                <Text style={{ fontSize: 60, marginBottom: 20 }}>✅</Text>
              </Animated.View>
              <Text style={styles.waitingText}>C'est la bonne date !</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.duration(800)} style={styles.waitingContainer}>
              <Animated.View style={spinStyle}>
                <Loader2 color={theme.tint} size={50} style={{ marginBottom: 20 }} />
              </Animated.View>
              <Text style={styles.waitingText}>Croisons les doigts ! 🤞</Text>
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
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  keyboardView: { flex: 1, padding: 30, width: '100%', maxWidth: 500, alignSelf: 'center' },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.8, textAlign: 'center', marginBottom: 40, lineHeight: 24, fontWeight: '600' },
  pickerContainer: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 24, padding: 20, marginBottom: 40, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  inputInstructions: { textAlign: 'center', color: '#4A3B39', marginBottom: 15, fontWeight: '600', opacity: 0.8 },
  pickersWrapper: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  pickerCol: { flex: 1, alignItems: 'center' },
  pickerLabel: { fontSize: 14, fontWeight: 'bold', color: '#A99693', marginBottom: 10 },
  dateInput: { width: '100%', height: 60, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 15, textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#4A3B39', borderColor: '#FF9A8B', borderWidth: 1 },
  buttonContainer: { alignItems: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 40, borderRadius: 30, gap: 12, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  waitingContainer: { alignItems: 'center', padding: 40, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 24 },
  waitingText: { fontSize: 18, fontWeight: 'bold', color: '#4A3B39' },
  errorBox: { backgroundColor: 'rgba(255,100,100,0.2)', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#FF6B6B' },
  errorText: { color: '#D32F2F', textAlign: 'center', fontWeight: 'bold', fontSize: 14 }
});
