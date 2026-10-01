import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ImageBackground, Platform, StyleSheet, useWindowDimensions, View, Pressable } from 'react-native';

import UnlimitedQuestions from '@/components/UnlimitedQuestions';
import { Colors } from '@/constants/Colors';
import { getCosmeticById, getCosmeticImage } from '@/data/cosmetics';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTopInset } from '@/hooks/useTopInset';

export default function UnlimitedScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const categoryFilter = Array.isArray(category) ? category[0] : category;
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
      <View style={[styles.safeArea as any, { paddingTop: topInset + 14, maxWidth: windowWidth >= 700 ? 680 : 500 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }} style={styles.backBtn as any}>
            <ArrowLeft color={Colors.light.text} size={28} />
          </Pressable>
        </View>

        <UnlimitedQuestions categoryFilter={categoryFilter} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', minHeight: Platform.OS === 'web' ? 700 : 0, overflow: 'hidden', backgroundColor: 'transparent' },
  safeArea: {
    flex: 1,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  headerRow: {
    zIndex: 10,
    marginBottom: 16,
  },
  backBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
});
