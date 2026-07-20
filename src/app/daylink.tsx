import React from 'react';
import { StyleSheet, ImageBackground, View, Platform } from 'react-native';
import { Link } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import DaylinkComponent from '@/components/Daylink';
import { Colors } from '@/constants/Colors';

export default function DaylinkScreen() {
  return (
    <ImageBackground 
      source={require('../../assets/images/bloomy_warm_background.png')} 
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.safeArea}>
        {/* Header avec Bouton Retour */}
        <View style={styles.headerRow}>
          <Link href="/dashboard" style={styles.backBtn}>
            <ArrowLeft color={Colors.light.text} size={28} />
          </Link>
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
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 40 : 60,
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
