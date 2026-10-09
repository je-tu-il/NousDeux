import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Linking,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LinearGradient } from 'expo-linear-gradient';

// Compare les versions sémantiques (ex: "1.0.0" vs "1.0.1")
export function isVersionOutdated(current: string, minRequired: string): boolean {
  if (!minRequired) return false;
  const currentParts = current.split('.').map((p) => parseInt(p, 10) || 0);
  const minParts = minRequired.split('.').map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(currentParts.length, minParts.length); i++) {
    const c = currentParts[i] ?? 0;
    const m = minParts[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.pixelthings.nousdeux';
const APP_STORE_URL = 'https://apps.apple.com/app/nousdeux/id6470000000';
const WEB_URL = 'https://nousdeux.app';

export default function ForceUpdateModal() {
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
  const [isOutdated, setIsOutdated] = useState(false);
  const [minVersion, setMinVersion] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsub = onSnapshot(
        doc(db, 'app_config', 'global'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const minReq = data?.minVersion || data?.minAppVersion;
            if (minReq && isVersionOutdated(currentVersion, String(minReq))) {
              setIsOutdated(true);
              setMinVersion(String(minReq));
              if (data?.updateMessage) setUpdateMessage(data.updateMessage);
            } else {
              setIsOutdated(false);
            }
          }
        },
        () => {
          // Fallback silencieux en cas d'erreur réseau
        }
      );
      return () => unsub();
    } catch {
      return undefined;
    }
  }, [currentVersion]);

  if (!isOutdated) return null;

  const handleOpenStore = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL(APP_STORE_URL).catch(() => Linking.openURL(WEB_URL));
    } else if (Platform.OS === 'android') {
      Linking.openURL(PLAY_STORE_URL).catch(() => Linking.openURL(WEB_URL));
    } else {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  return (
    <Modal visible={true} transparent={false} animationType="fade" onRequestClose={() => {}}>
      <LinearGradient colors={['#182333', '#0F1722']} style={styles.container}>
        <View style={styles.card}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="cover"
          />

          <View style={styles.badge}>
            <Text style={styles.badgeText}>MISE À JOUR OBLIGATOIRE</Text>
          </View>

          <Text style={styles.title}>Nouvelle version disponible</Text>

          <Text style={styles.message}>
            {updateMessage ||
              `Une mise à jour importante de NousDeux est nécessaire pour continuer à jouer ensemble en toute sécurité (version ${minVersion} requise, vous utilisez la v${currentVersion}).`}
          </Text>

          <Pressable style={styles.primaryButton} onPress={handleOpenStore}>
            <LinearGradient
              colors={['#FF9A8B', '#FF6A88']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.primaryButtonText}>
                {Platform.OS === 'ios'
                  ? "Mettre à jour sur l'App Store"
                  : Platform.OS === 'android'
                  ? 'Mettre à jour sur Google Play'
                  : 'Recharger la page'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => Linking.openURL(WEB_URL)}
          >
            <Text style={styles.secondaryButtonText}>Accéder à la version Web</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 154, 139, 0.35)',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 22,
    marginBottom: 16,
    shadowColor: '#FF6A88',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  badge: {
    backgroundColor: 'rgba(255, 106, 136, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 136, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 14,
  },
  badgeText: {
    color: '#FF9A8B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 26,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#FF6A88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
