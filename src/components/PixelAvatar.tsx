import React, { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';

import { AvatarConfig, DEFAULT_AVATAR } from '../data/avatarParts';

interface PixelAvatarProps {
  config?: Partial<AvatarConfig>;
  size?: number;     
  showShadow?: boolean;
}

// ─── Dictionnaire des images HD ───────────────────────────────────────────────
// Si une image manque, on n'affiche rien (transparent)
const HD_ASSETS: Record<string, any> = {
  // Corps de base (incluant peau, yeux, bouche générés d'un coup)
  'skin_light': require('../../assets/avatars/hd/base_light.png'),
  'skin_brown': require('../../assets/avatars/hd/base_brown.png'),
  'skin_dark': require('../../assets/avatars/hd/base_brown.png'), // fallback temporaire

  // Cheveux
  'hair_long': require('../../assets/avatars/hd/hair_long.png'),

  // Tenues
  'outfit_suit': require('../../assets/avatars/hd/outfit_suit.png'),
  'outfit_xmas': require('../../assets/avatars/hd/outfit_xmas.png'),
  'outfit_dress': require('../../assets/avatars/hd/outfit_dress.png'),

  // Chapeaux
  'hat_frog': require('../../assets/avatars/hd/hat_frog.png'),
};

const HDAvatar = memo(function HDAvatar({
  config = {},
  size = 96,
  showShadow = true,
}: PixelAvatarProps) {
  const merged: AvatarConfig = { ...DEFAULT_AVATAR, ...config };
  
  // Dans le système HD, la taille est proportionnelle 1:1,5 (ex: 200x300)
  const height = size * 1.5; 

  return (
    <View style={{ width: size, height, position: 'relative' }}>
      {showShadow && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: size * 0.15,
            width: size * 0.7,
            height: size * 0.08,
            borderRadius: 100,
            backgroundColor: 'rgba(0,0,0,0.15)',
          }}
        />
      )}

      {/* 1. Base Body (Peau + Yeux + Bouche) */}
      {HD_ASSETS[merged.skin] && (
        <Image 
          source={HD_ASSETS[merged.skin]} 
          style={[styles.layer, { width: size, height }]} 
          resizeMode="contain"
        />
      )}

      {/* 2. Outfit */}
      {HD_ASSETS[merged.outfit] && (
        <Image 
          source={HD_ASSETS[merged.outfit]} 
          style={[styles.layer, { width: size, height }]} 
          resizeMode="contain"
        />
      )}

      {/* 3. Hair */}
      {HD_ASSETS[merged.hair] && (
        <Image 
          source={HD_ASSETS[merged.hair]} 
          style={[styles.layer, { width: size, height }]} 
          resizeMode="contain"
        />
      )}

      {/* 4. Hat */}
      {HD_ASSETS[merged.hat] && (
        <Image 
          source={HD_ASSETS[merged.hat]} 
          style={[styles.layer, { width: size, height }]} 
          resizeMode="contain"
        />
      )}
      
      {/* 5. Accessory */}
      {HD_ASSETS[merged.accessory] && (
        <Image 
          source={HD_ASSETS[merged.accessory]} 
          style={[styles.layer, { width: size, height }]} 
          resizeMode="contain"
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  }
});

export default HDAvatar;

// ─── Version miniature (pour profils, pills, etc.) ────────────────────────────

export const MiniAvatar = memo(function MiniAvatar({
  config,
  size = 40,
}: {
  config?: Partial<AvatarConfig>;
  size?: number;
}) {
  return <HDAvatar config={config} size={size} showShadow={false} />;
});
