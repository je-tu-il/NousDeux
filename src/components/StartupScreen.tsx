import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

export default function StartupScreen({ error = false, onRetry }: { error?: boolean; onRetry?: () => void }) {
  return (
    <View style={styles.screen} accessibilityLabel="Chargement de NousDeux">
      <Image source={require('../../assets/images/optimized/brand-icon.png')} style={styles.logo} />
      <Text style={styles.name}>NousDeux</Text>
      <Text style={styles.caption}>{error ? 'La connexion prend plus de temps que prévu.' : 'Un petit moment, juste pour vous deux.'}</Text>
      {error ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonText}>Réessayer</Text>
        </Pressable>
      ) : <ActivityIndicator size="small" color="#AD485F" accessibilityLabel="Préparation de votre espace" />}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: '#FFF5F2', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 },
  logo: { width: 88, height: 88, borderRadius: 24 },
  name: { color: '#402B32', fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  caption: { color: '#79646A', fontSize: 15, textAlign: 'center', lineHeight: 23, maxWidth: 290 },
  button: { backgroundColor: '#AD485F', borderRadius: 16, minHeight: 48, paddingHorizontal: 28, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
