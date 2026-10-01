import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ImageBackground, Platform, StyleSheet, useWindowDimensions, View, Pressable } from 'react-native';

import DaylinkComponent from '@/components/Daylink';
import { Colors } from '@/constants/Colors';
import { getCosmeticById, getCosmeticImage } from '@/data/cosmetics';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTopInset } from '@/hooks/useTopInset';

export default function DaylinkScreen() {
  const store = useOnboardingStore();
  const topInset = useTopInset();
  const { width: windowWidth } = useWindowDimensions();
  const bgSource = getCosmeticImage(getCosmeticById(store.selectedBackground), store.isDarkMode) || (store.isDarkMode ? require('../../assets/images/nousdeux_dark_background.png') : require('../../assets/images/nousdeux_warm_background.png'));

  return (
    <ImageBackground 
      source={bgSource} 
      style={styles.container as any}
      resizeMode="cover"
      imageStyle={{ objectPosition: windowWidth < 600 ? 'center bottom' : 'center' } as any}
    >
      <View style={[styles.safeArea, { paddingTop: topInset + 14, maxWidth: windowWidth >= 700 ? 680 : 500 }]}>
        {/* Header avec Bouton Retour */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }} style={styles.backBtn}>
            <ArrowLeft color={Colors.light.text} size={28} />
          </Pressable>
        </View>
        
        {/* Rendu du composant principal */}
        <DaylinkComponent />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    minHeight: Platform.OS === 'web' ? 700 : 0,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center'
  },
  headerRow: {
    paddingHorizontal: 20,
    zIndex: 10,
    marginBottom: -40, // Let the Daylink component slide up nicely
  },
  backBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    alignSelf: 'flex-start',
    overflow: 'hidden'
  }
});
