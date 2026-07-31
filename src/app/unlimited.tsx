import React from 'react';
import { StyleSheet, ImageBackground, View, Platform } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import UnlimitedQuestions from '@/components/UnlimitedQuestions';
import { Colors } from '@/constants/Colors';

export default function UnlimitedScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  
  return (
    <ImageBackground
      source={require('../../assets/images/bloomy_warm_background.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Link href="/dashboard" style={styles.backBtn}>
            <ArrowLeft color={Colors.light.text} size={28} />
          </Link>
        </View>

        <UnlimitedQuestions categoryFilter={category} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', overflow: 'hidden' },
  safeArea: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 40 : 60,
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
