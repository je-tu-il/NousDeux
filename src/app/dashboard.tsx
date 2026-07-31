import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ImageBackground, Platform, Pressable, Image, Modal, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { CalendarHeart, MessageCircleHeart, Trophy, Settings, X, HeartHandshake, Infinity as InfinityIcon, Split, Heart, Smile, Brain, Flame, Home, MessageCircle, Rocket, Camera, Star, Coffee } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown, withRepeat, withSequence, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import StreakCalendar from '@/components/StreakCalendar';

type PartnerData = { pseudo: string; avatarUrl?: string; coupleDate?: string; age?: string; coupleId?: string };

export default function DashboardScreen() {
  const theme = Colors.light;
  const store = useOnboardingStore((state) => state);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);
  // isLoading bloque les redirects jusqu'à la réponse Firebase (évite le flash)
  const [isLoading, setIsLoading] = useState(true);
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1500 }), withTiming(1, { duration: 1500 })),
      -1,
      true
    );

    if (!store.uid) {
      setIsLoading(false);
      router.replace('/onboarding/login');
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', store.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        if (!data.linkedTo) {
          setIsLoading(false);
          router.replace('/onboarding/sync');
          return;
        }
        if (!data.coupleDate) {
          setIsLoading(false);
          router.replace('/onboarding/date');
          return;
        }

        const partnerDoc = await getDoc(doc(db, 'users', data.linkedTo));
        if (partnerDoc.exists()) {
          const pData = partnerDoc.data();
          if (pData.linkedTo === store.uid) {
            setPartner({
              pseudo: pData.pseudo,
              avatarUrl: pData.avatarUrl,
              coupleDate: data.coupleDate,
              age: pData.age,
              coupleId: [store.uid!, data.linkedTo].sort().join('_'),
            });
            setPartnerLeft(false);
          } else {
            setPartner(null);
            setPartnerLeft(true);
          }
        } else {
          setPartner(null);
          setPartnerLeft(true);
        }
      } else {
        setPartner(null);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, [store.uid]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const formattedDate = partner?.coupleDate
    ? new Date(partner.coupleDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date non définie';

  if (isLoading) {
    return (
      <ImageBackground source={require('../../assets/images/romantic_calendar_bg.png')} style={styles.container} resizeMode="cover">
        <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]} />
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require('../../assets/images/romantic_calendar_bg.png')} style={styles.container} resizeMode="cover">
      <ScrollView style={styles.safeArea} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <Animated.View entering={FadeInUp.duration(600)}>
          <View style={styles.header}>

            {/* Mon avatar + nom → ouvre mon profil */}
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => setShowMyProfile(true)}>
              {store.avatar ? (
                <Image source={{ uri: store.avatar }} style={styles.userAvatar} />
              ) : (
                <View style={[styles.userAvatar, { backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 24 }}>{store.pseudo?.charAt(0) || 'M'}</Text>
                </View>
              )}
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Text style={[styles.welcome, { color: theme.text }]} numberOfLines={1}>Bonjour {store.pseudo} !</Text>

                {partner ? (
                  // Badge partenaire cliquable → ouvre son profil
                  <Pressable
                    style={styles.partnerBadge}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setShowPartnerProfile(true);
                    }}
                  >
                    {partner.avatarUrl ? (
                      <Image source={{ uri: partner.avatarUrl }} style={styles.partnerAvatar} />
                    ) : (
                      <View style={[styles.partnerAvatar, { backgroundColor: theme.gradientEnd, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{partner.pseudo?.charAt(0) || 'P'}</Text>
                      </View>
                    )}
                    <Text style={styles.partnerText} numberOfLines={1}>En couple avec {partner.pseudo} 💕</Text>
                  </Pressable>
                ) : partnerLeft ? (
                  <View style={styles.partnerBadge}>
                    <Text style={[styles.partnerText, { color: '#FF3B30', fontStyle: 'italic' }]} numberOfLines={1}>Ton partenaire t'a quitté 💔</Text>
                  </View>
                ) : (
                  <Text style={[styles.streak, { color: theme.gradientEnd }]}>Prêt à jouer ?</Text>
                )}
              </View>
            </Pressable>

            <Link href="/settings" asChild>
              <Pressable style={styles.settingsButton}>
                <Settings color={theme.icon} size={28} />
              </Pressable>
            </Link>
          </View>
        </Animated.View>

        {/* Streak + calendrier — cliquable pour ouvrir le calendrier complet */}
        {partner?.coupleId && (
          <Animated.View entering={FadeInUp.delay(150).duration(600)}>
            <Link href="/calendar" asChild>
              <Pressable>
                <StreakCalendar coupleId={partner.coupleId} />
              </Pressable>
            </Link>
          </Animated.View>
        )}

        {/* Main Grid */}
        <View style={styles.grid}>
          <Animated.View entering={FadeInUp.delay(200).duration(600)}>
            <Link href="/daylink" style={[styles.mainCard, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder }]}>
              <Animated.View style={[styles.iconWrapper, { backgroundColor: theme.tint }, pulseStyle]}>
                <CalendarHeart color="white" size={32} />
              </Animated.View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Question du Jour</Text>
              <Text style={[styles.cardDesc, { color: theme.text }]}>La même pour vous deux chaque jour !</Text>
            </Link>
          </Animated.View>

          {/* Nouveau : Questions Illimitées */}
          <Animated.View entering={FadeInUp.delay(300).duration(600)}>
            <Link href="/unlimited" style={[styles.mainCard, { backgroundColor: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.25)' }]}>
              <View style={[styles.iconWrapper, { backgroundColor: '#A855F7' }]}>
                <InfinityIcon color="white" size={32} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Questions Illimitées</Text>
              <Text style={[styles.cardDesc, { color: theme.text }]}>Répondez à autant de questions que vous voulez 💫</Text>
            </Link>
          </Animated.View>

          {/* Titre Thèmes */}
          <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thèmes Spécifiques</Text>
          </Animated.View>

          <View style={styles.categoryGrid}>
            {[
              { id: 'amour', title: 'Amour', icon: <Heart color="#EF4444" size={24} />, bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
              { id: 'fun', title: 'Fun', icon: <Smile color="#F59E0B" size={24} />, bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
              { id: 'profond', title: 'Profond', icon: <Brain color="#3B82F6" size={24} />, bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
              { id: 'intime', title: 'Intime', icon: <Flame color="#EC4899" size={24} />, bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.3)' },
              { id: 'pile_ou_face', title: 'Tu préfères', icon: <Split color="#0EA5E9" size={24} />, bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.3)' },
              { id: 'famille', title: 'Famille', icon: <Home color="#10B981" size={24} />, bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
              { id: 'debat', title: 'Débat', icon: <MessageCircle color="#8B5CF6" size={24} />, bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' },
              { id: 'futur', title: 'Futur', icon: <Rocket color="#6366F1" size={24} />, bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)' },
              { id: 'souvenir', title: 'Souvenir', icon: <Camera color="#14B8A6" size={24} />, bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.3)' },
              { id: 'reve', title: 'Rêve', icon: <Star color="#FCD34D" size={24} />, bg: 'rgba(252,211,77,0.1)', border: 'rgba(252,211,77,0.3)' },
              { id: 'quotidien', title: 'Quotidien', icon: <Coffee color="#A8A29E" size={24} />, bg: 'rgba(168,162,158,0.1)', border: 'rgba(168,162,158,0.3)' },
              { id: 'defi', title: 'Défi', icon: <Trophy color="#F97316" size={24} />, bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
            ].map((cat, index) => (
              <Animated.View key={cat.id} entering={FadeInUp.delay(450 + index * 50).duration(500)} style={styles.categoryCardWrapper}>
                <Link href={`/unlimited?category=${cat.id}`} style={[styles.categoryCard, { backgroundColor: cat.bg, borderColor: cat.border }]}>
                  {cat.icon}
                  <Text style={styles.categoryCardTitle}>{cat.title}</Text>
                </Link>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ── Modal Mon Profil ───────────────────────────────────────────────── */}
      <Modal visible={showMyProfile} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMyProfile(false)}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.modalContent}>
            <Pressable style={styles.closeBtn} onPress={() => setShowMyProfile(false)}>
              <X color="#A99693" size={24} />
            </Pressable>

            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              {store.avatar ? (
                <Image source={{ uri: store.avatar }} style={styles.modalAvatar} />
              ) : (
                <View style={[styles.modalAvatar, { backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 36 }}>{store.pseudo?.charAt(0) || 'M'}</Text>
                </View>
              )}
            </View>

            <Text style={styles.modalPseudo}>{store.pseudo}</Text>
            <Text style={styles.modalAge}>{store.age} ans</Text>

            {partner && (
              <View style={styles.modalPartnerBox}>
                <HeartHandshake color={theme.gradientEnd} size={30} style={{ alignSelf: 'center', marginBottom: 10 }} />
                <Text style={styles.modalPartnerText}>En couple avec <Text style={{ fontWeight: 'bold' }}>{partner.pseudo}</Text></Text>
                <Text style={styles.modalDateText}>Depuis le {formattedDate}</Text>
              </View>
            )}
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── Modal Profil Partenaire ────────────────────────────────────────── */}
      <Modal visible={showPartnerProfile} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowPartnerProfile(false)}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.modalContent}>
            <Pressable style={styles.closeBtn} onPress={() => setShowPartnerProfile(false)}>
              <X color="#A99693" size={24} />
            </Pressable>

            {partner && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  {partner.avatarUrl ? (
                    <Image source={{ uri: partner.avatarUrl }} style={styles.modalAvatar} />
                  ) : (
                    <View style={[styles.modalAvatar, { backgroundColor: theme.gradientEnd, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 36 }}>{partner.pseudo?.charAt(0) || 'P'}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.modalPseudo}>{partner.pseudo}</Text>
                {partner.age && <Text style={styles.modalAge}>{partner.age} ans</Text>}

                <View style={styles.modalPartnerBox}>
                  <HeartHandshake color={theme.tint} size={30} style={{ alignSelf: 'center', marginBottom: 10 }} />
                  <Text style={styles.modalPartnerText}>Ensemble depuis le</Text>
                  <Text style={[styles.modalDateText, { fontSize: 16, fontWeight: '700', color: theme.tint, marginTop: 4 }]}>
                    {formattedDate} ❤️
                  </Text>
                </View>
              </>
            )}
          </Animated.View>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', overflow: 'hidden' },
  safeArea: { flex: 1, padding: 20, paddingTop: Platform.OS === 'web' ? 40 : 60, width: '100%', maxWidth: 500, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  userAvatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: 'white', overflow: 'hidden' },
  welcome: { fontSize: 28, fontWeight: '900', marginBottom: 6 },
  streak: { fontSize: 16, fontWeight: 'bold' },
  partnerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  partnerAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, overflow: 'hidden' },
  partnerText: { fontSize: 14, fontWeight: '700', color: '#4A3B39' },
  grid: { flex: 1, gap: 20 },
  mainCard: { padding: 24, borderRadius: 24, borderWidth: 1, alignItems: 'center', shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  iconWrapper: { padding: 20, borderRadius: 24, marginBottom: 16, shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  cardDesc: { fontSize: 16, opacity: 0.7 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  halfCardWrapper: { flex: 1 },
  smallCard: { padding: 20, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8, height: 130, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  smallCardTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  lockText: { fontSize: 13, fontWeight: 'bold', opacity: 0.8 },
  
  sectionHeader: { marginTop: 10, marginBottom: 15, paddingHorizontal: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#4A3B39' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  categoryCardWrapper: { width: '48%', marginBottom: 12 },
  categoryCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  categoryCardTitle: { fontSize: 15, fontWeight: '700', color: '#4A3B39' },
  settingsButton: { padding: 10 },
  // Modaux
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#FFF5F2', padding: 30, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, position: 'relative' },
  closeBtn: { position: 'absolute', top: 10, right: 10, padding: 15, zIndex: 10 },
  modalAvatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: 'white', overflow: 'hidden' },
  modalPseudo: { fontSize: 28, fontWeight: '900', color: '#4A3B39', textAlign: 'center', marginBottom: 5 },
  modalAge: { fontSize: 16, color: '#A99693', textAlign: 'center', marginBottom: 30, fontWeight: 'bold' },
  modalPartnerBox: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: 20, alignItems: 'center' },
  modalPartnerText: { fontSize: 18, color: '#4A3B39', textAlign: 'center', marginBottom: 5 },
  modalDateText: { fontSize: 14, color: '#A99693', textAlign: 'center', fontStyle: 'italic' },
});
