import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ImageBackground, Platform, Pressable, Image, Modal } from 'react-native';
import { Link, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { CalendarHeart, MessageCircleHeart, Trophy, Settings, X, HeartHandshake } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown, withRepeat, withSequence, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useOnboardingStore } from '@/store/onboardingStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export default function DashboardScreen() {
  const theme = Colors.light;
  const store = useOnboardingStore((state) => state);
  const [partner, setPartner] = useState<{pseudo: string, avatarUrl?: string, coupleDate?: string} | null>(null);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  // isLoading = true bloque tous les redirects jusqu'à ce que Firebase réponde
  // Cela empêche le flash Dashboard → Date → Dashboard
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

    const unsub = onSnapshot(doc(db, "users", store.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Route guards — seulement après que Firebase a répondu (isLoading = true encore)
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

        const partnerDoc = await getDoc(doc(db, "users", data.linkedTo));
        if (partnerDoc.exists()) {
          const pData = partnerDoc.data();
          if (pData.linkedTo === store.uid) {
            setPartner({
              pseudo: pData.pseudo,
              avatarUrl: pData.avatarUrl,
              coupleDate: data.coupleDate
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
      // Firebase a répondu → on peut afficher le dashboard
      setIsLoading(false);
    });

    return () => unsub();
  }, [store.uid]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }]
  }));

  // Format date
  const formattedDate = partner?.coupleDate ? new Date(partner.coupleDate).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  }) : "Date non définie";

  // Écran de chargement silencieux — aucune redirection prématurée
  if (isLoading) {
    return (
      <ImageBackground source={require('../../assets/images/romantic_calendar_bg.png')} style={styles.container} resizeMode="cover">
        <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
          {/* Loader discret pour éviter l'écran blanc */}
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require('../../assets/images/romantic_calendar_bg.png')} style={styles.container} resizeMode="cover">
      <View style={styles.safeArea}>
        
        {/* Header - Clickable for Profile */}
        <Animated.View entering={FadeInUp.duration(600)}>
          <Pressable style={styles.header} onPress={() => setShowProfile(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {store.avatar ? (
                <Image source={{ uri: store.avatar }} style={styles.userAvatar} />
              ) : (
                <View style={[styles.userAvatar, { backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 24 }}>{store.pseudo?.charAt(0) || "M"}</Text>
                </View>
              )}
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Text style={[styles.welcome, { color: theme.text }]} numberOfLines={1}>Bonjour {store.pseudo} !</Text>
                {partner ? (
                  <View style={styles.partnerBadge}>
                    {partner.avatarUrl ? (
                      <Image source={{ uri: partner.avatarUrl }} style={styles.partnerAvatar} />
                    ) : (
                      <View style={[styles.partnerAvatar, { backgroundColor: theme.gradientEnd, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{partner.pseudo?.charAt(0) || "P"}</Text>
                      </View>
                    )}
                    <Text style={styles.partnerText} numberOfLines={1}>En couple avec {partner.pseudo}</Text>
                  </View>
                ) : partnerLeft ? (
                  <View style={styles.partnerBadge}>
                    <Text style={[styles.partnerText, { color: '#FF3B30', fontStyle: 'italic' }]} numberOfLines={1}>Ton partenaire t'a quitté 💔</Text>
                  </View>
                ) : (
                  <Text style={[styles.streak, { color: theme.gradientEnd }]}>Prêt à jouer ?</Text>
                )}
              </View>
            </View>
            
            <Link href="/settings" asChild>
              <Pressable style={styles.settingsButton}>
                <Settings color={theme.icon} size={28} />
              </Pressable>
            </Link>
          </Pressable>
        </Animated.View>

        {/* Main Grid */}
        <View style={styles.grid}>
          {/* Daylink Button */}
          <Animated.View entering={FadeInUp.delay(200).duration(600)}>
            <Link href="/daylink" style={[styles.mainCard, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder }]}>
              <Animated.View style={[styles.iconWrapper, { backgroundColor: theme.tint }, pulseStyle]}>
                <CalendarHeart color="white" size={32} />
              </Animated.View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Question du Jour</Text>
              <Text style={[styles.cardDesc, { color: theme.text }]}>À découvrir...</Text>
            </Link>
          </Animated.View>

          <View style={styles.row}>
             {/* Games (Locked) */}
            <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.halfCardWrapper}>
              <View style={[styles.smallCard, { backgroundColor: 'rgba(255,255,255,0.4)', borderColor: theme.cardBorder }]}>
                <MessageCircleHeart color={theme.tabIconDefault} size={28} />
                <Text style={[styles.smallCardTitle, { color: theme.text }]}>Modes de Jeux</Text>
                <Text style={[styles.lockText, { color: theme.tabIconDefault }]}>Bientôt</Text>
              </View>
            </Animated.View>

             {/* Défis (Locked) */}
            <Animated.View entering={FadeInUp.delay(400).duration(600)} style={styles.halfCardWrapper}>
              <View style={[styles.smallCard, { backgroundColor: 'rgba(255,255,255,0.4)', borderColor: theme.cardBorder }]}>
                <Trophy color={theme.tabIconDefault} size={28} />
                <Text style={[styles.smallCardTitle, { color: theme.text }]}>Défis</Text>
                <Text style={[styles.lockText, { color: theme.tabIconDefault }]}>Bientôt</Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* Modal Profil */}
      <Modal visible={showProfile} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.modalContent}>
            
            <Pressable style={styles.closeBtn} onPress={() => setShowProfile(false)}>
              <X color="#A99693" size={24} />
            </Pressable>

            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              {store.avatar ? (
                <Image source={{ uri: store.avatar }} style={styles.modalAvatar} />
              ) : (
                <View style={[styles.modalAvatar, { backgroundColor: theme.tint, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 36 }}>{store.pseudo?.charAt(0) || "M"}</Text>
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
        </View>
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
  row: { flexDirection: 'row', gap: 20 },
  halfCardWrapper: { flex: 1 },
  smallCard: { padding: 20, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 12, height: 140 },
  smallCardTitle: { fontSize: 16, fontWeight: '600' },
  lockText: { fontSize: 12, fontStyle: 'italic', opacity: 0.8 },
  settingsButton: { padding: 10 },

  // Modal Profil
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#FFF5F2', padding: 30, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, position: 'relative' },
  closeBtn: { position: 'absolute', top: 10, right: 10, padding: 15, zIndex: 10 },
  modalAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: 'white', overflow: 'hidden' },
  modalPseudo: { fontSize: 28, fontWeight: '900', color: '#4A3B39', textAlign: 'center', marginBottom: 5 },
  modalAge: { fontSize: 16, color: '#A99693', textAlign: 'center', marginBottom: 30, fontWeight: 'bold' },
  modalPartnerBox: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: 20, alignItems: 'center' },
  modalPartnerText: { fontSize: 18, color: '#4A3B39', textAlign: 'center', marginBottom: 5 },
  modalDateText: { fontSize: 14, color: '#A99693', textAlign: 'center', fontStyle: 'italic' }
});
