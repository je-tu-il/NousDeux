import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ImageBackground,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Sparkles, Smartphone, Check, Palette, ShoppingBag, HelpCircle } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { useTopInset } from '../hooks/useTopInset';
import { getCosmeticById, getCosmeticImage, WIDGETS, isOwned } from '../data/cosmetics';
import { WidgetSize, WidgetType, WidgetPlatform, WidgetPayload, getWidgetData, syncWidgetData, getWidgetTheme, requestPinWidget, isWidgetPinSupported } from '../lib/widgets';
import AdaptiveWidget from '../components/AdaptiveWidget';
import { getUserProfile, saveUserProfile, getInventory } from '../lib/economy';
import { sound } from '../lib/sound';
import { triggerHaptic } from '../lib/haptics';
import { useToastStore } from '../store/toastStore';

export default function WidgetsScreen() {
  const store = useOnboardingStore();
  const topInset = useTopInset();
  const { width: windowWidth } = useWindowDimensions();
  const theme = store.isDarkMode ? Colors.dark : Colors.light;

  const [widgetType, setWidgetType] = useState<WidgetType>('streak');
  const [widgetSize, setWidgetSize] = useState<WidgetSize>('medium');
  const [platform, setPlatform] = useState<WidgetPlatform>(Platform.OS === 'android' ? 'android' : 'ios');
  const [widgetData, setWidgetData] = useState<WidgetPayload | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);

  const bgCosmetic = store.selectedBackground ? getCosmeticById(store.selectedBackground) : null;
  const defaultBg = store.isDarkMode
    ? require('../../assets/images/nousdeux_dark_background.png')
    : require('../../assets/images/nousdeux_warm_background.png');
  const bgImage = getCosmeticImage(bgCosmetic, store.isDarkMode) || defaultBg;

  useEffect(() => {
    async function loadData() {
      const data = await getWidgetData();
      // Hydrate avec le store actuel
      data.userPseudo = store.pseudo || 'Moi';
      data.partnerPseudo = store.partnerPseudo || 'Mon Amour';
      data.userAvatar = store.avatar;
      data.partnerAvatar = store.partnerAvatar;
      data.themeId = store.selectedWidget || 'widget_default';
      setWidgetData(data);

      if (store.uid) {
        const profile = await getUserProfile(store.uid);
        setUserProfile(profile);

        if (store.partnerUid) {
          const cId = [store.uid, store.partnerUid].sort().join('_');
          const inv = await getInventory(cId).catch(() => null);
          setInventory(inv);
        }
      }
    }
    if (Platform.OS === 'web') {
      router.replace('/dashboard');
      return;
    }
    loadData();
  }, [store.uid, store.partnerUid, store.selectedWidget]);

  const handleSelectTheme = async (themeId: string) => {
    sound.pop();
    store.setSelectedWidget(themeId);
    if (widgetData) {
      const updated = { ...widgetData, themeId };
      setWidgetData(updated);
    }
    void syncWidgetData({ themeId });
    if (store.uid) {
      await saveUserProfile(store.uid, { selectedWidget: themeId });
    }
  };

  const handlePinWidget = async () => {
    sound.tap();
    triggerHaptic('light');

    if (Platform.OS === 'android') {
      try {
        const res = await requestPinWidget(widgetType);
        if (res) {
          sound.reward();
          triggerHaptic('success');
          useToastStore.getState().showToast('Demande envoyée ! Confirme sur ton écran d’accueil ✨');
        } else {
          useToastStore.getState().showToast('Maintiens l’écran d’accueil pour ajouter le widget');
        }
      } catch {
        useToastStore.getState().showToast('Consulte le guide ci-dessous pour l’ajouter manuellement');
      }
    } else {
      useToastStore.getState().showToast('Consulte les 3 étapes faciles ci-dessous pour iPhone');
    }
  };

  const currentTheme = getWidgetTheme(store.selectedWidget || 'widget_default');

  return (
    <ImageBackground
      source={bgImage}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Overlay lisibilité */}
      <View
        style={[
          styles.overlay,
          { backgroundColor: store.isDarkMode ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.18)' },
        ]}
      />

      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: topInset + 8 }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              sound.tap();
              router.canGoBack() ? router.back() : router.replace('/dashboard');
            }}
            style={[styles.backButton, { backgroundColor: theme.glassBackground }]}
          >
            <ArrowLeft color={theme.text} size={26} />
          </Pressable>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: theme.text }]}>Widgets Écran d’accueil</Text>
            <Text style={[styles.subtitle, { color: store.isDarkMode ? '#D4B8B4' : '#6B5B59' }]}>
              {Platform.OS === 'ios' ? 'iPhone • Personnalisable' : Platform.OS === 'android' ? 'Samsung & Android • Personnalisable' : 'iPhone & Samsung • Personnalisables'}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              sound.tap();
              router.push({ pathname: '/shop', params: { tab: 'widgets' } });
            }}
            style={[styles.shopButton, { backgroundColor: theme.tint }]}
          >
            <ShoppingBag color="white" size={18} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* APERÇU EN DIRECT DU WIDGET */}
        <View style={[styles.card, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder, alignItems: 'center' }]}>
          <View style={styles.previewHeaderRow}>
            <Sparkles color={theme.tint} size={18} />
            <Text style={[styles.previewTitle, { color: theme.text }]}>
              Aperçu en direct sur ton écran
            </Text>
          </View>

          {/* Sélecteur simple de prévisualisation : Série vs Question */}
          <View style={[styles.tabToggleRow, { width: '100%', marginBottom: 14 }]}>
            <Pressable
              onPress={() => {
                sound.tap();
                setWidgetType('streak');
              }}
              style={[
                styles.tabToggleBtn,
                widgetType === 'streak' && { backgroundColor: theme.tint },
              ]}
            >
              <Text
                style={[
                  styles.tabToggleText,
                  { color: widgetType === 'streak' ? 'white' : theme.text },
                ]}
              >
                🔥 Série de Jours
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                sound.tap();
                setWidgetType('question');
              }}
              style={[
                styles.tabToggleBtn,
                widgetType === 'question' && { backgroundColor: theme.tint },
              ]}
            >
              <Text
                style={[
                  styles.tabToggleText,
                  { color: widgetType === 'question' ? 'white' : theme.text },
                ]}
              >
                💬 Question du Jour
              </Text>
            </Pressable>
          </View>

          <View style={styles.widgetSimulatorFrame}>
            {widgetData && (
              <AdaptiveWidget
                type={widgetType}
                size={widgetSize}
                platform={platform}
                data={widgetData}
              />
            )}
          </View>

          <Text style={[styles.activeThemeText, { color: store.isDarkMode ? '#D4B8B4' : '#6B5B59' }]}>
            Style actif : <Text style={{ fontWeight: '800', color: theme.text }}>{currentTheme.name} {currentTheme.emoji}</Text>
          </Text>
        </View>

        {/* CHOISIR UN STYLE DE WIDGET DÉBLOQUÉ */}
        <View style={[styles.card, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Palette color={theme.tint} size={20} />
              <Text style={[styles.cardSectionTitle, { color: theme.text, marginBottom: 0 }]}>
                Styles Débloqués
              </Text>
            </View>

            <Pressable
              onPress={() => {
                sound.tap();
                router.push({ pathname: '/shop', params: { tab: 'widgets' } });
              }}
              style={styles.moreShopLink}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.tint }}>
                Boutique ›
              </Text>
            </Pressable>
          </View>

          <View style={styles.themeGrid}>
            {WIDGETS.map((item) => {
              const owned = isOwned(inventory, item, 0, {});
              const isEquipped = (store.selectedWidget || 'widget_default') === item.id;
              const widgetConf = getWidgetTheme(item.id);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (owned) {
                      void handleSelectTheme(item.id);
                    } else {
                      sound.tap();
                      router.push({ pathname: '/shop', params: { tab: 'widgets' } });
                    }
                  }}
                  style={[
                    styles.themeItemCard,
                    { borderColor: isEquipped ? '#4CAF50' : theme.cardBorder },
                    isEquipped && { borderWidth: 2.5, backgroundColor: 'rgba(76, 175, 80, 0.08)' },
                  ]}
                >
                  <View style={[styles.themeColorBubble, { backgroundColor: widgetConf.gradient[0] }]}>
                    <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.themeItemName, { color: theme.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.themeItemSub, { color: store.isDarkMode ? '#B8A4A0' : '#8A7A78' }]}>
                      {owned ? (isEquipped ? 'Équipé ✅' : 'Débloqué') : 'Verrouillé 🔒'}
                    </Text>
                  </View>

                  {isEquipped && (
                    <View style={styles.equippedBadge}>
                      <Check color="white" size={12} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* GUIDE D'INSTALLATION SUR L'ÉCRAN D'ACCUEIL */}
        <View style={[styles.card, { backgroundColor: theme.glassBackground, borderColor: theme.cardBorder }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <HelpCircle color={theme.tint} size={20} />
            <Text style={[styles.cardSectionTitle, { color: theme.text, marginBottom: 0 }]}>
              Comment l'ajouter sur mon téléphone ?
            </Text>
          </View>

          {/* Guide iPhone */}
          {(Platform.OS === 'ios' || Platform.OS === 'web') && (
            <View style={styles.tutorialBox}>
              <Text style={[styles.tutorialTitle, { color: theme.text }]}>
                🍏 Sur iPhone (iOS) :
              </Text>
              <Text style={[styles.tutorialStep, { color: store.isDarkMode ? '#E0D0CE' : '#5A4B49' }]}>
                1. Reste appuyé sur un espace vide de ton écran d'accueil jusqu'à ce que les icônes tremblent.
              </Text>
              <Text style={[styles.tutorialStep, { color: store.isDarkMode ? '#E0D0CE' : '#5A4B49' }]}>
                2. Touche le bouton « + » tout en haut à gauche.
              </Text>
              <Text style={[styles.tutorialStep, { color: store.isDarkMode ? '#E0D0CE' : '#5A4B49' }]}>
                3. Recherche « NousDeux », choisis ton format (1 case, rectangle ou 4 cases) et touche « Ajouter le widget ».
              </Text>
            </View>
          )}

          {/* Guide Samsung / Android */}
          {(Platform.OS === 'android' || Platform.OS === 'web') && (
            <View style={[styles.tutorialBox, Platform.OS === 'web' ? { marginTop: 10 } : null]}>
              <Text style={[styles.tutorialTitle, { color: theme.text }]}>
                🤖 Sur Samsung & Android :
              </Text>
              <Text style={[styles.tutorialStep, { color: store.isDarkMode ? '#E0D0CE' : '#5A4B49' }]}>
                1. Reste appuyé sur ton écran d'accueil et sélectionne « Widgets ».
              </Text>
              <Text style={[styles.tutorialStep, { color: store.isDarkMode ? '#E0D0CE' : '#5A4B49' }]}>
                2. Fais défiler jusqu'à « NousDeux ».
              </Text>
              <Text style={[styles.tutorialStep, { color: store.isDarkMode ? '#E0D0CE' : '#5A4B49' }]}>
                3. Maintiens ton doigt sur le widget et glisse-le sur ton écran. Tu peux ensuite le redimensionner à n'importe quelle taille !
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerContainer: {
    paddingHorizontal: 20,
    zIndex: 10,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  shopButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  cardSectionSub: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabToggleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  sizeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeToggleBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sizeToggleText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  platformToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  platformChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  widgetSimulatorFrame: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeThemeText: {
    fontSize: 13,
    marginTop: 12,
  },
  moreShopLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  themeGrid: {
    gap: 8,
  },
  themeItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  themeColorBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeItemName: {
    fontSize: 14,
    fontWeight: '800',
  },
  themeItemSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  equippedBadge: {
    backgroundColor: '#4CAF50',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialBox: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    padding: 12,
    borderRadius: 14,
    gap: 6,
  },
  tutorialTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  tutorialStep: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
});
