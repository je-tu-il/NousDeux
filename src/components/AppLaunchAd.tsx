import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart, Sparkles, X } from 'lucide-react-native';
import { GOOGLE_ADS_CONFIG, getInterstitialAdUnitId } from '../constants/ads';
import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';

// Flag en mémoire de session : affiche la publicité courte UNIQUEMENT une seule fois au lancement de l'application
let hasShownLaunchAdThisSession = false;

export default function AppLaunchAd() {
  const isDarkMode = useOnboardingStore((s) => s.isDarkMode);
  const theme = isDarkMode ? Colors.dark : Colors.light;

  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    if (!GOOGLE_ADS_CONFIG.enabled || hasShownLaunchAdThisSession) {
      return;
    }

    hasShownLaunchAdThisSession = true;

    // Tentative de chargement interstitiel natif (AdMob Mobile)
    let InterstitialAd: any = null;
    let AdEventType: any = null;
    try {
      const mobileAds = require('react-native-google-mobile-ads');
      InterstitialAd = mobileAds.InterstitialAd;
      AdEventType = mobileAds.AdEventType;
    } catch {
      InterstitialAd = null;
    }

    if (InterstitialAd && AdEventType && !GOOGLE_ADS_CONFIG.isTestMode) {
      try {
        const interstitial = InterstitialAd.createForAdRequest(getInterstitialAdUnitId(), {
          requestNonPersonalizedAdsOnly: true,
        });

        interstitial.addAdEventListener(AdEventType.LOADED, () => {
          interstitial.show();
        });

        interstitial.load();
        return;
      } catch (err) {
        console.warn('Native interstitial ad load failed, using fallback:', err);
      }
    }

    // Affichage court d'ouverture (mode test / web / dev)
    setVisible(true);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: 'rgba(255,106,136,0.3)' }]}>
          <Pressable style={styles.closeBtn} onPress={() => setVisible(false)}>
            <X color={theme.text} size={20} />
          </Pressable>

          <View style={styles.iconWrap}>
            <Heart color="#FF6A88" size={32} fill="#FF6A88" />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>NousDeux</Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.7 }]}>
            Bienvenue ! Annonce sponsorisée de démarrage
          </Text>

          <View style={styles.adBox}>
            <View style={styles.adTag}>
              <Text style={styles.adTagText}>PUBLICITÉ GOOGLE</Text>
            </View>
            <ActivityIndicator size="small" color="#FF6A88" style={{ marginVertical: 8 }} />
            <Text style={{ fontSize: 11, color: theme.text, opacity: 0.5, fontStyle: 'italic' }}>
              Format interstitiel court d'ouverture
            </Text>
          </View>

          <Pressable style={styles.actionBtn} onPress={() => setVisible(false)}>
            <Text style={styles.actionBtnText}>
              {secondsLeft > 0 ? `Passer (${secondsLeft}s)` : 'Accéder à NousDeux'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#FF6A88',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
    zIndex: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,106,136,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  adBox: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center',
    marginBottom: 16,
  },
  adTag: {
    backgroundColor: 'rgba(255,106,136,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF6A88',
  },
  actionBtn: {
    backgroundColor: '#FF6A88',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
