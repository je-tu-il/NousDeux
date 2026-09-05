import { Colors } from '@/constants/Colors';
import { getCosmeticById, getCosmeticImage } from '@/data/cosmetics';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useRouter } from 'expo-router';
import { ArrowLeft, Palette } from 'lucide-react-native';
import { ImageBackground, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

export default function AvatarBuilderScreen() {
  const store = useOnboardingStore((state) => state);
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const theme = Colors[store.isDarkMode ? 'dark' : 'light'];
  const styles = getStyles(theme);

  return (
    <ImageBackground source={getCosmeticImage(getCosmeticById(store.selectedBackground), store.isDarkMode) || (store.isDarkMode ? require('../../assets/images/nousdeux_dark_background.png') : require('../../assets/images/nousdeux_warm_background.png'))} style={styles.container} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={theme.icon} size={28} />
          </Pressable>
          <Text style={styles.headerTitle}>Avatars HD</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Palette color="#FF9A8B" size={48} />
          </View>
          <Text style={styles.title}>Les Skins arrivent ! 🚀</Text>
          <Text style={styles.desc}>
            Nous préparons un tout nouveau système d'avatars en très haute résolution pour une prochaine mise à jour.{'\n\n'}
            Encore un peu de patience !
          </Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
  },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, paddingBottom: 100 },
  iconContainer: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
    shadowColor: '#FF9A8B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 5
  },
  title: { fontSize: 26, fontWeight: '900', color: theme.text, marginBottom: 15, textAlign: 'center' },
  desc: { fontSize: 16, color: theme.text, textAlign: 'center', lineHeight: 24, paddingHorizontal: 10, fontWeight: '500' },
});




