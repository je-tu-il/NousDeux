import React from 'react';
import { StyleSheet, View, ImageBackground, Platform, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import PileOuFaceQuestions from '../components/PileOuFaceQuestions';
import { Colors } from '../constants/Colors';

export default function PileOuFaceScreen() {
  const theme = Colors.light;

  return (
    <ImageBackground
      source={require('../../assets/images/romantic_calendar_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={theme.text} size={28} />
          </Pressable>
        </View>

        {/* Composant principal */}
        <PileOuFaceQuestions />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 20 : 50,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
  },
});
