/**
 * AvatarBuilder.tsx — Constructeur d'avatar pixel art interactif
 * Optimisé navigateur : lazy loading des sections, memo partout
 */

import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, FlatList, Platform,
} from 'react-native';
import Animated, {
  FadeIn, FadeInRight, Layout, useSharedValue,
  withSpring, useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronLeft, Lock, Palette, Shirt, Eye, Smile, Sparkles, Wand2 } from 'lucide-react-native';

import { Colors } from '../constants/Colors';
import PixelAvatar from './PixelAvatar';
import { useTopInset } from '@/hooks/useTopInset';
import {
  AvatarConfig, DEFAULT_AVATAR, SKIN_TONES, HAIR_COLORS,
  HAIRS, EYES, MOUTHS, OUTFITS, HATS, ACCESSORIES,
  AvatarPartData, getSkinColor, getHairColorValue,
} from '../data/avatarParts';
import { saveUserProfile, getUserProfile } from '../lib/economy';
import { useOnboardingStore } from '../store/onboardingStore';

// ─── Onglets de l'éditeur ────────────────────────────────────────────────────

type EditorTab = 'body' | 'hair' | 'eyes' | 'outfit' | 'extras';

const TABS: { id: EditorTab; label: string; icon: typeof Palette }[] = [
  { id: 'body',    label: 'Corps',  icon: Palette  },
  { id: 'hair',    label: 'Cheveux', icon: Sparkles },
  { id: 'eyes',    label: 'Yeux',   icon: Eye      },
  { id: 'outfit',  label: 'Tenue',  icon: Shirt    },
  { id: 'extras',  label: 'Extras', icon: Wand2    },
];

// ─── Swatchs de couleur ───────────────────────────────────────────────────────

const ColorSwatch = memo(function ColorSwatch({
  color, selected, onPress,
}: { color: string; selected: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => { scale.value = withSpring(1.2, { damping: 5 }, () => { scale.value = withSpring(1); }); onPress(); }}
    >
      <Animated.View style={[styles.swatch, { backgroundColor: color.startsWith('rainbow') ? '#FF9A8B' : color }, style]}>
        {selected && <Check color="white" size={14} strokeWidth={3} />}
        {color.startsWith('rainbow') && <Text style={{ fontSize: 10 }}>🌈</Text>}
      </Animated.View>
    </Pressable>
  );
});

// ─── Carte de pièce avatar ────────────────────────────────────────────────────

const PartCard = memo(function PartCard({
  part, selected, owned, onPress,
}: {
  part: AvatarPartData;
  selected: boolean;
  owned: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.partCard,
        owned && !selected && styles.partCardOwned,
        selected && styles.partCardSelected,
        !owned && styles.partCardLocked,
        { opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      {!owned && (
        <View style={styles.lockOverlay}>
          <Lock color="#A99693" size={16} />
          <Text style={styles.lockPrice}>{part.price}🌸</Text>
        </View>
      )}
      <Text style={styles.partName} numberOfLines={2}>{part.name}</Text>
      {selected && (
        <View style={styles.selectedCheck}>
          <Check color="white" size={12} strokeWidth={4} />
        </View>
      )}
    </Pressable>
  );
});

// ─── Composant principal ─────────────────────────────────────────────────────

interface AvatarBuilderProps {
  initialConfig?: Partial<AvatarConfig>;
  ownedParts?: string[];
  onSave?: (config: AvatarConfig) => void;
  onClose?: () => void;
  onPurchase?: (partId: string, price: number) => void;
  walletPetals?: number;
}

export default function AvatarBuilder({
  initialConfig = {},
  ownedParts = [],
  onSave,
  onClose,
  onPurchase,
  walletPetals = 0,
}: AvatarBuilderProps) {
  const topInset = useTopInset();
  const myUid = useOnboardingStore(s => s.uid);
  const [config, setConfig] = useState<AvatarConfig>({ ...DEFAULT_AVATAR, ...initialConfig });
  const [activeTab, setActiveTab] = useState<EditorTab>('body');

  const isOwned = useCallback((part: AvatarPartData) => {
    if (!part.price && !part.unlockStreak) return true;
    return ownedParts.includes(part.id);
  }, [ownedParts]);

  const update = useCallback((key: keyof AvatarConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  // Déterminer la partie active qui n'est pas possédée pour afficher le bouton d'achat
  const getSelectedLockedPart = () => {
    const checkLists = [HAIRS, EYES, MOUTHS, OUTFITS, HATS, ACCESSORIES];
    for (const list of checkLists) {
      for (const part of list) {
        if (config[part.category as keyof AvatarConfig] === part.id && !isOwned(part)) {
          return part;
        }
      }
    }
    return null;
  };
  const lockedPartToBuy = getSelectedLockedPart();

  // Sauvegarde automatique uniquement des parties possédées
  useEffect(() => {
    if (!myUid || lockedPartToBuy) return; // Ne pas sauvegarder si on preview un item verrouillé
    
    const handler = setTimeout(async () => {
      try {
        await saveUserProfile(myUid, { avatar: config });
        onSave?.(config);
      } catch (e) {
        console.error('[AvatarBuilder] save error', e);
      }
    }, 800);
    
    return () => clearTimeout(handler);
  }, [config, myUid, lockedPartToBuy, onSave]);

  // ── Rendu du contenu par onglet ─────────────────────────────────────────
  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'body':
        return (
          <Animated.View entering={FadeInRight.duration(250)} style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Couleur de peau</Text>
            <View style={styles.swatchRow}>
              {SKIN_TONES.map(s => (
                <ColorSwatch
                  key={s.id}
                  color={s.color}
                  selected={config.skin === s.id}
                  onPress={() => update('skin', s.id)}
                />
              ))}
            </View>
          </Animated.View>
        );

      case 'hair':
        return (
          <Animated.View entering={FadeInRight.duration(250)} style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Style de coiffure</Text>
            <View style={styles.partsGrid}>
              {HAIRS.map(part => (
                <PartCard
                  key={part.id}
                  part={part}
                  selected={config.hair === part.id}
                  owned={isOwned(part)}
                  onPress={() => update('hair', part.id)}
                />
              ))}
            </View>
            <Text style={styles.sectionTitle}>Couleur des cheveux</Text>
            <View style={styles.swatchRow}>
              {HAIR_COLORS.map(h => (
                <ColorSwatch
                  key={h.id}
                  color={h.color}
                  selected={config.hairColor === h.id}
                  onPress={() => update('hairColor', h.id)}
                />
              ))}
            </View>
          </Animated.View>
        );

      case 'eyes':
        return (
          <Animated.View entering={FadeInRight.duration(250)} style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Yeux</Text>
            <View style={styles.partsGrid}>
              {EYES.map(part => (
                <PartCard
                  key={part.id}
                  part={part}
                  selected={config.eyes === part.id}
                  owned={isOwned(part)}
                  onPress={() => update('eyes', part.id)}
                />
              ))}
            </View>
            <Text style={styles.sectionTitle}>Bouche</Text>
            <View style={styles.partsGrid}>
              {MOUTHS.map(part => (
                <PartCard
                  key={part.id}
                  part={part}
                  selected={config.mouth === part.id}
                  owned={isOwned(part)}
                  onPress={() => update('mouth', part.id)}
                />
              ))}
            </View>
          </Animated.View>
        );

      case 'outfit':
        return (
          <Animated.View entering={FadeInRight.duration(250)} style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Tenue</Text>
            <View style={styles.partsGrid}>
              {OUTFITS.map(part => (
                <PartCard
                  key={part.id}
                  part={part}
                  selected={config.outfit === part.id}
                  owned={isOwned(part)}
                  onPress={() => update('outfit', part.id)}
                />
              ))}
            </View>
          </Animated.View>
        );

      case 'extras':
        return (
          <Animated.View entering={FadeInRight.duration(250)} style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Chapeau & Accessoire tête</Text>
            <View style={styles.partsGrid}>
              {HATS.map(part => (
                <PartCard
                  key={part.id}
                  part={part}
                  selected={config.hat === part.id}
                  owned={isOwned(part)}
                  onPress={() => update('hat', part.id)}
                />
              ))}
            </View>
            <Text style={styles.sectionTitle}>Accessoire (main)</Text>
            <View style={styles.partsGrid}>
              {ACCESSORIES.map(part => (
                <PartCard
                  key={part.id}
                  part={part}
                  selected={config.accessory === part.id}
                  owned={isOwned(part)}
                  onPress={() => update('accessory', part.id)}
                />
              ))}
            </View>
          </Animated.View>
        );
    }
  }, [activeTab, config, isOwned, update]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#FF9A8B', '#FF6A88']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: topInset + 8 }]}
      >
        {onClose && (
          <Pressable onPress={onClose} style={styles.backBtn}>
            <ChevronLeft color="white" size={24} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>Mon Avatar</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Preview avatar */}
        <View style={styles.preview}>
          <View style={styles.previewBg}>
            <PixelAvatar config={config} size={120} showShadow />
          </View>
        </View>

        {/* Bouton d'achat pour l'item sélectionné non possédé */}
        {lockedPartToBuy && (
          <View style={styles.purchaseContainer}>
            <Text style={styles.purchaseText}>Aperçu : {lockedPartToBuy.name}</Text>
            <Pressable 
              style={[styles.purchaseBtn, walletPetals < (lockedPartToBuy.price || 0) && styles.purchaseBtnDisabled]}
              onPress={() => onPurchase?.(lockedPartToBuy.id, lockedPartToBuy.price || 0)}
              disabled={walletPetals < (lockedPartToBuy.price || 0)}
            >
              <Text style={styles.purchaseBtnText}>Acheter pour {lockedPartToBuy.price} 🌸</Text>
            </Pressable>
          </View>
        )}

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContainer}
        >
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Icon size={16} color={active ? '#FF6A88' : '#A99693'} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Contenu de l'onglet */}
        <ScrollView style={styles.editor} showsVerticalScrollIndicator={false}>
          {renderTabContent()}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn:      { padding: 4, marginRight: 8 },
  headerTitle:  { flex: 1, color: 'white', fontSize: 18, fontWeight: '800' },
  saveBtn:      { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  saveBtnText:  { color: 'white', fontWeight: '700', fontSize: 13 },

  content: { flex: 1 },
  preview: { alignItems: 'center', paddingVertical: 20 },
  previewBg: {
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,154,139,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,106,136,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseContainer: {
    padding: 12, alignItems: 'center', backgroundColor: '#FFF5F2'
  },
  purchaseText: { fontSize: 13, color: '#4A3B39', marginBottom: 6, fontWeight: '600' },
  purchaseBtn: {
    backgroundColor: '#FF6A88', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  purchaseBtnDisabled: { backgroundColor: '#FFD1DC' },
  purchaseBtnText: { color: 'white', fontWeight: 'bold' },

  tabsScroll:      { flexGrow: 0 },
  tabsContainer:   { paddingHorizontal: 16, gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(74,59,57,0.06)',
  },
  tabActive:     { backgroundColor: 'rgba(255,106,136,0.12)' },
  tabText:       { fontSize: 13, color: '#A99693', fontWeight: '600' },
  tabTextActive: { color: '#FF6A88', fontWeight: '700' },

  editor:      { flex: 1, paddingHorizontal: 16 },
  tabContent:  { paddingVertical: 16, gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#4A3B39', marginTop: 8, marginBottom: 4, letterSpacing: 0.5 },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,154,139,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
  },

  partsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  partCard: {
    width: 90, minHeight: 70,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: 'rgba(255,154,139,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  partCardOwned: {
    borderColor: '#22c55e', // green-500
  },
  partCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.07)',
    borderWidth: 2,
  },
  partCardLocked: {
    opacity: 0.55,
  },
  partName: { fontSize: 11, color: '#4A3B39', fontWeight: '600', textAlign: 'center' },
  selectedCheck: {
    position: 'absolute',
    top: 4, right: 4,
    width: 16, height: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center', justifyContent: 'center'
  },
  lockOverlay: {
    position: 'absolute',
    top: 4, right: 4,
    alignItems: 'center',
    gap: 1,
  },
  lockPrice: { fontSize: 9, color: '#A99693', fontWeight: '700' },
});
