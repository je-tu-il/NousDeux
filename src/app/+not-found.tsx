import React from 'react';
import { View, Text, StyleSheet, Pressable, ImageBackground, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Compass, Home, ArrowLeft } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { getCosmeticById, getCosmeticImage } from '../data/cosmetics';

export default function NotFoundScreen() {
  const store = useOnboardingStore();
  const isDark = store.isDarkMode;
  const theme = isDark ? Colors.dark : Colors.light;

  const bgCosmetic = store.selectedBackground ? getCosmeticById(store.selectedBackground) : null;
  const defaultBg = isDark
    ? require('../../assets/images/nousdeux_dark_background.png')
    : require('../../assets/images/nousdeux_warm_background.png');
  const bgImage = getCosmeticImage(bgCosmetic, isDark) ?? defaultBg;

  const handleGoHome = () => {
    if (store.pseudo && store.age) {
      router.replace('/dashboard');
    } else {
      router.replace('/onboarding/login');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Page introuvable', headerShown: false }} />
      <ImageBackground
        source={bgImage}
        style={[styles.container, { backgroundColor: isDark ? '#1A1514' : '#FFF5F2' }]}
        resizeMode="cover"
      >
        <View style={styles.safeArea}>
          <View style={styles.content}>
            {/* Compass / Lost icon with soft badge */}
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isDark ? 'rgba(255, 106, 136, 0.15)' : 'rgba(255, 154, 139, 0.25)',
                  borderColor: isDark ? 'rgba(255, 106, 136, 0.4)' : 'rgba(255, 154, 139, 0.5)',
                },
              ]}
            >
              <Compass color="#FF6A88" size={56} strokeWidth={1.8} />
            </View>

            {/* 404 Pill */}
            <View
              style={[
                styles.pill,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 106, 136, 0.25)',
                },
              ]}
            >
              <Text style={[styles.pillText, { color: isDark ? '#FF9A8B' : '#FF6A88' }]}>
                ERREUR 404
              </Text>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: isDark ? '#F3E8E2' : '#2D1515' }]}>
              Oups ! Page introuvable
            </Text>

            {/* Description */}
            <Text style={[styles.subtitle, { color: isDark ? '#D4B8B4' : '#6B5755' }]}>
              Il semble que vous vous soyez égarés en chemin... Cette page n'existe pas ou a été déplacée.
            </Text>

            {/* Return Button */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: '#FF6A88',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={handleGoHome}
            >
              <Home color="#FFFFFF" size={20} />
              <Text style={styles.buttonText}>Retourner à l'accueil</Text>
            </Pressable>

            {/* Back Button */}
            {router.canGoBack() && (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.7)',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                onPress={() => router.back()}
              >
                <ArrowLeft color={theme.text} size={18} />
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Page précédente</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: '100vh' as any,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 24 : 50,
    paddingHorizontal: 24,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    textAlign: 'center',
    padding: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {}),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF6A88',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: 320,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 18,
    shadowColor: '#FF6A88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    maxWidth: 280,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 12,
    width: '100%',
    maxWidth: 280,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
