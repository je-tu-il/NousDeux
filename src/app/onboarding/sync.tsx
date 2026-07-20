import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ImageBackground, Share, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/Colors';
import Animated, { FadeInDown, FadeInUp, ZoomIn, useSharedValue, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated';
import { ArrowLeft, Copy, Share2, CheckCircle2, HeartHandshake } from 'lucide-react-native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, deleteField } from 'firebase/firestore';

const generateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function SyncScreen() {
  const [partnerCode, setPartnerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);

  const myCode = useOnboardingStore((state) => state.myCode);
  const myAvatar = useOnboardingStore((state) => state.avatar);
  const setMyCode = useOnboardingStore((state) => state.setMyCode);
  const setSynced = useOnboardingStore((state) => state.setSynced);
  const theme = Colors.light;

  const isLinking = React.useRef(false);

  useEffect(() => {
    const state = useOnboardingStore.getState();
    if (!state.uid || !state.pseudo) {
      router.replace('/onboarding/login');
      return;
    } else if (!state.age) {
      router.replace('/onboarding/age');
      return;
    } else if (!myCode) {
      const code = generateCode();
      setMyCode(code);
      setDoc(doc(db, "pairing_codes", code), {
        creatorUid: state.uid,
        createdAt: new Date()
      }).catch(err => console.error(err));
    }

    // Écoute en temps réel si quelqu'un se lie à nous
    const unsub = onSnapshot(doc(db, "users", state.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Si on est lié, on déclenche le succès (sauf si c'est nous qui initions le lien pour éviter les race conditions)
        if (data.linkedTo && !success && !isLinking.current) {
          const partnerDoc = await getDoc(doc(db, "users", data.linkedTo));
          let pName = "ton partenaire";
          let pAvatar = null;
          if (partnerDoc.exists()) {
            pName = partnerDoc.data().pseudo;
            pAvatar = partnerDoc.data().avatarUrl || null;
          }
          setPartnerName(pName);
          setPartnerAvatar(pAvatar);
          setSuccess(true);
        }
      }
    });

    return () => unsub();
  }, [myCode, success]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      const shareUrl = Platform.OS === 'web' 
        ? `${window.location.origin}/onboarding/sync?code=${myCode}`
        : `bloomy://sync?code=${myCode}`;

      await Share.share({
        message: `Rejoins-moi sur Bloomy ! Clique sur ce lien pour lier nos comptes : ${shareUrl}`,
      });
    } catch (error: any) {
      Alert.alert(error.message);
    }
  };

  const handleLink = async () => {
    const codeToSearch = partnerCode.trim().toUpperCase();
    if (codeToSearch.length === 6 && !loading) {
      isLinking.current = true;
      setLoading(true);
      try {
        const state = useOnboardingStore.getState();
        const myUid = state.uid;

        if (!myUid) {
          Alert.alert("Erreur", "Vous n'êtes pas connecté.");
          setLoading(false);
          isLinking.current = false;
          return;
        }

        // 1. Chercher le code avec timeout pour éviter les blocages réseau
        const fetchCode = getDoc(doc(db, "pairing_codes", codeToSearch));
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout réseau Firebase")), 5000));
        const codeDoc = await Promise.race([fetchCode, timeout]) as any;

        if (!codeDoc.exists()) {
          Alert.alert("Erreur", "Ce code n'existe pas ou a expiré.");
          setLoading(false);
          isLinking.current = false;
          return;
        }

        const partnerUid = codeDoc.data().creatorUid;
        if (partnerUid === myUid) {
          Alert.alert("Erreur", "Tu ne peux pas te synchroniser avec toi-même !");
          setLoading(false);
          isLinking.current = false;
          return;
        }

        // 2. Lier les comptes et forcer le passage par la page date avec reset total
        await updateDoc(doc(db, "users", myUid!), { 
          linkedTo: partnerUid,
          coupleDate: deleteField(),
          proposedDate: deleteField()
        });
        await updateDoc(doc(db, "users", partnerUid), { 
          linkedTo: myUid,
          coupleDate: deleteField(),
          proposedDate: deleteField()
        });

        // Succès garanti APRÈS la confirmation du serveur !
        const partnerDocFetched = await getDoc(doc(db, "users", partnerUid));
        if (partnerDocFetched.exists()) {
          setPartnerName(partnerDocFetched.data().pseudo);
          setPartnerAvatar(partnerDocFetched.data().avatarUrl || null);
          setSuccess(true);
        }

      } catch (error: any) {
        Alert.alert("Erreur de connexion", error.message + "\nAssurez-vous que Firestore est bien activé et en mode test.");
        setLoading(false);
        isLinking.current = false;
      }
    } else if (codeToSearch.length !== 6) {
      Alert.alert("Erreur", "Le code doit faire exactement 6 caractères.");
    }
  };

  if (success) {
    return (
      <ImageBackground source={require('../../../assets/images/bloomy_warm_background.png')} style={styles.container} resizeMode="cover">
        <View style={[styles.successContent, { flex: 1, justifyContent: 'center', padding: 20 }]}>
          <Animated.View entering={ZoomIn.duration(800)} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 40, gap: 15 }}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.tint, position: 'relative', left: 0 }]}>
              {myAvatar ? (
                <Image source={{ uri: myAvatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.avatarText}>{useOnboardingStore.getState().pseudo?.charAt(0) || "M"}</Text>
              )}
            </View>
            
            <HeartHandshake color={theme.gradientEnd} size={50} />
            
            <View style={[styles.avatarCircle, { backgroundColor: theme.gradientEnd, position: 'relative', right: 0 }]}>
              {partnerAvatar ? (
                <Image source={{ uri: partnerAvatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.avatarText}>{partnerName?.charAt(0) || "P"}</Text>
              )}
            </View>
          </Animated.View>

          <Animated.Text entering={FadeInUp.delay(600).duration(800)} style={[styles.successTitle, { color: theme.text }]}>
            Synchronisé !
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(800).duration(800)} style={[styles.successSubtitle, { color: theme.text }]}>
            Ton compte est maintenant lié à {partnerName} ❤️
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(1500).duration(800)} style={{ marginTop: 40, width: '100%' }}>
            <Pressable 
              style={({ pressed }) => [styles.linkButton, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}
              onPress={() => router.replace('/onboarding/date')}
            >
              <Text style={styles.linkButtonText}>Continuer</Text>
            </Pressable>
          </Animated.View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require('../../../assets/images/bloomy_warm_background.png')} style={styles.container} resizeMode="cover">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/onboarding/age');
            }
          }}>
            <ArrowLeft color={theme.text} size={28} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.duration(800)}>
            <Text style={[styles.title, { color: theme.text }]}>Synchronisation</Text>
            <Text style={[styles.subtitle, { color: theme.text }]}>
              Donne ton code à ton partenaire ou entre le sien pour lier vos téléphones.
            </Text>
          </Animated.View>

          {/* Mon Code */}
          <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.codeContainer}>
            <Pressable 
              style={[styles.codeBox, { borderColor: theme.tint, backgroundColor: 'rgba(255,255,255,0.6)' }]}
              onPress={handleCopy}
            >
              <Text style={[styles.codeText, { color: theme.text }]}>{myCode}</Text>
              {copied ? <CheckCircle2 color="green" size={24} /> : <Copy color={theme.tint} size={24} />}
            </Pressable>
            <Pressable 
              style={[styles.shareButton, { backgroundColor: theme.gradientEnd }]} 
              onPress={handleShare}
            >
              <Share2 color="white" size={20} />
              <Text style={styles.shareText}>Partager mon code</Text>
            </Pressable>
          </Animated.View>

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: theme.tint, opacity: 0.2 }]} />
            <Text style={[styles.orText, { color: theme.text }]}>OU</Text>
            <View style={[styles.line, { backgroundColor: theme.tint, opacity: 0.2 }]} />
          </View>

          {/* Code du partenaire */}
          <Animated.View entering={FadeInUp.duration(800).delay(400)}>
            <Text style={[styles.label, { color: theme.text }]}>Code de ton partenaire</Text>
            <TextInput 
              style={[styles.input, { color: theme.text, borderColor: theme.tint, backgroundColor: 'rgba(255,255,255,0.6)' }]} 
              placeholder="XXXXXX"
              placeholderTextColor="#A99693"
              maxLength={6}
              autoCapitalize="characters"
              value={partnerCode}
              onChangeText={(t) => setPartnerCode(t.toUpperCase())}
            />
            
            <Pressable 
              style={({ pressed }) => [
                styles.linkButton, 
                { backgroundColor: partnerCode.length === 6 ? theme.tint : '#A99693', opacity: pressed ? 0.8 : 1 }
              ]} 
              onPress={handleLink}
              disabled={partnerCode.length !== 6}
            >
              <Text style={styles.linkButtonText}>Lier les comptes</Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', overflow: 'hidden' },
  keyboardView: { flex: 1, padding: 30, width: '100%', maxWidth: 500, alignSelf: 'center' },
  header: { paddingTop: Platform.OS === 'web' ? 20 : 50, zIndex: 10 },
  backBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 20, alignSelf: 'flex-start' },
  content: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.7, textAlign: 'center', marginBottom: 40, lineHeight: 24 },
  codeContainer: { alignItems: 'center', marginBottom: 20 },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 2, borderStyle: 'dashed', paddingHorizontal: 30, paddingVertical: 20, borderRadius: 20, marginBottom: 20 },
  codeText: { fontSize: 36, fontWeight: '900', letterSpacing: 8 },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 20, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  shareText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  line: { flex: 1, height: 1 },
  orText: { paddingHorizontal: 15, fontSize: 14, fontWeight: 'bold', opacity: 0.5 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1, padding: 16, borderRadius: 16, fontSize: 24, textAlign: 'center', letterSpacing: 6, fontWeight: 'bold', marginBottom: 20, outlineStyle: 'none' as any },
  linkButton: { padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  linkButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  successContent: { flex: 1, justifyContent: 'center', padding: 20, width: '100%', maxWidth: 500, alignSelf: 'center' },
  successIconWrapper: { padding: 30, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 100, marginBottom: 30, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  successTitle: { fontSize: 36, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  successSubtitle: { fontSize: 18, opacity: 0.8, textAlign: 'center' },
  animationContainer: { height: 150, width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  avatarText: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  heartContainer: { position: 'absolute', width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  heartBurst: { position: 'absolute', width: '100%', height: '100%', borderRadius: 50, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 15 }
});
