import React, { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Film, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { GOOGLE_ADS_CONFIG, getRewardedAdUnitId } from '../constants/ads';
import { awardBonusPetals } from '../lib/economy';
import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';

interface RewardedAdButtonProps {
  coupleId?: string | null;
  onRewardEarned?: (petals: number) => void;
}

export default function RewardedAdButton({ coupleId, onRewardEarned }: RewardedAdButtonProps) {
  const isDarkMode = useOnboardingStore((s) => s.isDarkMode);
  const theme = isDarkMode ? Colors.dark : Colors.light;

  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState<'watching' | 'success'>('watching');

  if (!GOOGLE_ADS_CONFIG.enabled || !coupleId) {
    return null;
  }

  const handlePress = async () => {
    if (isLoading) return;
    setIsLoading(true);

    // Tentative chargement natif Mobile (AdMob Rewarded)
    let RewardedAd: any = null;
    let RewardedAdEventType: any = null;
    try {
      const mobileAds = require('react-native-google-mobile-ads');
      RewardedAd = mobileAds.RewardedAd;
      RewardedAdEventType = mobileAds.RewardedAdEventType;
    } catch {
      RewardedAd = null;
    }

    if (RewardedAd && RewardedAdEventType && !GOOGLE_ADS_CONFIG.isTestMode) {
      try {
        const rewarded = RewardedAd.createForAdRequest(getRewardedAdUnitId(), {
          requestNonPersonalizedAdsOnly: true,
        });

        rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
          setIsLoading(false);
          rewarded.show();
        });

        rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
          const petals = GOOGLE_ADS_CONFIG.rewardPetalsAmount;
          await awardBonusPetals(coupleId, petals);
          if (onRewardEarned) onRewardEarned(petals);
          setModalStep('success');
          setModalVisible(true);
        });

        rewarded.load();
        return;
      } catch (err) {
        console.warn('Native rewarded ad error, falling back to test flow:', err);
      }
    }

    // Flux de test & Web (simulation pédagogique et propre)
    setModalStep('watching');
    setModalVisible(true);
    setIsLoading(false);

    // Simulation de 2 secondes de pub vidéo de test
    setTimeout(async () => {
      const petals = GOOGLE_ADS_CONFIG.rewardPetalsAmount;
      try {
        await awardBonusPetals(coupleId, petals);
        if (onRewardEarned) onRewardEarned(petals);
      } catch (e) {
        console.error('Error awarding petals:', e);
      }
      setModalStep('success');
    }, 2000);
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.cardContainer, { opacity: pressed || isLoading ? 0.85 : 1 }]}
        onPress={handlePress}
        disabled={isLoading}
      >
        <LinearGradient
          colors={isDarkMode ? ['#3D1E2A', '#24141E'] : ['#FFF5F5', '#FFE8EC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderColor: isDarkMode ? 'rgba(255,106,136,0.3)' : 'rgba(255,106,136,0.2)' }]}
        >
          <View style={styles.iconCircle}>
            <Film color="#FF6A88" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.title, { color: theme.text }]}>Obtenir des pétales gratuits</Text>
              <Sparkles color="#F59E0B" size={14} />
            </View>
            <Text style={[styles.subtitle, { color: theme.text, opacity: 0.65 }]}>
              Regarder une courte vidéo sponsorisée
            </Text>
          </View>
          <View style={styles.rewardBadge}>
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.rewardText}>+{GOOGLE_ADS_CONFIG.rewardPetalsAmount} 🌸</Text>
            )}
          </View>
        </LinearGradient>
      </Pressable>

      {/* Modal de visionnage / succès */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: 'rgba(255,106,136,0.25)' }]}>
            {modalStep === 'watching' ? (
              <View style={{ alignItems: 'center', padding: 10 }}>
                <ActivityIndicator size="large" color="#FF6A88" style={{ marginBottom: 16 }} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Lecture de l'annonce...</Text>
                <Text style={[styles.modalDesc, { color: theme.text, opacity: 0.7 }]}>
                  Merci de soutenir l'application !
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', padding: 10 }}>
                <CheckCircle2 color="#22c55e" size={48} style={{ marginBottom: 12 }} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Félicitations !</Text>
                <Text style={[styles.modalDesc, { color: theme.text, opacity: 0.85, marginBottom: 16 }]}>
                  Vous avez gagné <Text style={{ fontWeight: 'bold', color: '#FF6A88' }}>+{GOOGLE_ADS_CONFIG.rewardPetalsAmount} pétales 🌸</Text> pour votre couple !
                </Text>
                <Pressable
                  style={styles.confirmBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.confirmBtnText}>Super ! Merci 💖</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,106,136,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  rewardBadge: {
    backgroundColor: '#FF6A88',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#FF6A88',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmBtn: {
    backgroundColor: '#FF6A88',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
