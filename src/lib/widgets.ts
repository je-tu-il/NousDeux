import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COSMETICS, Cosmetic } from '../data/cosmetics';

export type WidgetType = 'question' | 'streak';
export type WidgetSize = 'small' | 'medium' | 'large';
export type WidgetPlatform = 'ios' | 'android';

export interface WidgetPayload {
  streak: number;
  daysTogether: number;
  todayQuestion: string;
  categoryName: string;
  userAnswered: boolean;
  partnerAnswered: boolean;
  bothAnswered: boolean;
  userPseudo: string;
  partnerPseudo: string;
  userAvatar: string | null;
  partnerAvatar: string | null;
  themeId: string;
  themeName: string;
  gradientColors: [string, string];
  updatedAt: string;
}

export const WIDGET_STORAGE_KEY = 'nousdeux_widget_payload_v1';

/**
 * Thèmes de widgets avec dégradés et accents visuels adaptés
 */
export const WIDGET_THEMES: Record<string, {
  name: string;
  gradient: [string, string];
  textColor: string;
  accentColor: string;
  cardBg: string;
  emoji: string;
}> = {
  widget_default: {
    name: 'Classique Douceur',
    gradient: ['#FF9A8B', '#FF6A88'],
    textColor: '#FFFFFF',
    accentColor: '#FFE5E0',
    cardBg: 'rgba(255, 255, 255, 0.22)',
    emoji: '🌸',
  },
  widget_streak_7: {
    name: 'Cœur Passion',
    gradient: ['#FF416C', '#FF4B2B'],
    textColor: '#FFFFFF',
    accentColor: '#FFD2CC',
    cardBg: 'rgba(255, 255, 255, 0.2)',
    emoji: '❤️',
  },
  widget_streak_14: {
    name: 'Nuit Étoilée',
    gradient: ['#0f2027', '#203a43'],
    textColor: '#FFFFFF',
    accentColor: '#64B5F6',
    cardBg: 'rgba(255, 255, 255, 0.12)',
    emoji: '✨',
  },
  widget_streak_30: {
    name: 'Forêt Dorée',
    gradient: ['#11998e', '#38ef7d'],
    textColor: '#FFFFFF',
    accentColor: '#D4EDDA',
    cardBg: 'rgba(0, 0, 0, 0.18)',
    emoji: '🍃',
  },
  widget_shop_1: {
    name: 'Néon Cyberpunk',
    gradient: ['#8A2387', '#E94057'],
    textColor: '#FFFFFF',
    accentColor: '#00F2FE',
    cardBg: 'rgba(0, 0, 0, 0.25)',
    emoji: '⚡',
  },
  widget_shop_2: {
    name: 'Aurore Boréale',
    gradient: ['#43e97b', '#38f9d7'],
    textColor: '#1A365D',
    accentColor: '#065F46',
    cardBg: 'rgba(255, 255, 255, 0.35)',
    emoji: '🌌',
  },
  widget_shop_3: {
    name: 'Coucher de Soleil',
    gradient: ['#fa709a', '#fee140'],
    textColor: '#FFFFFF',
    accentColor: '#FFF3B0',
    cardBg: 'rgba(0, 0, 0, 0.15)',
    emoji: '🌅',
  },
  widget_shop_4: {
    name: 'Or Impérial',
    gradient: ['#232526', '#414345'],
    textColor: '#FFD700',
    accentColor: '#FFE57F',
    cardBg: 'rgba(255, 215, 0, 0.15)',
    emoji: '👑',
  },
  widget_shop_5: {
    name: 'Galaxie Pastel',
    gradient: ['#654ea3', '#eaafc8'],
    textColor: '#FFFFFF',
    accentColor: '#F3E8FF',
    cardBg: 'rgba(255, 255, 255, 0.2)',
    emoji: '🪐',
  },
};

export function getWidgetTheme(themeId: string = 'widget_default') {
  return WIDGET_THEMES[themeId] || WIDGET_THEMES.widget_default;
}

/**
 * Synchronise les données actuelles de l'application avec les widgets natifs (iOS / Android / Web)
 */
export async function syncWidgetData(payload: Partial<WidgetPayload>): Promise<void> {
  try {
    const existingRaw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    const existing: WidgetPayload = existingRaw ? JSON.parse(existingRaw) : {
      streak: 1,
      daysTogether: 1,
      todayQuestion: "Quelle est la plus belle chose que ton partenaire ait faite pour toi ?",
      categoryName: "Quotidien",
      userAnswered: false,
      partnerAnswered: false,
      bothAnswered: false,
      userPseudo: "Moi",
      partnerPseudo: "Mon Amour",
      userAvatar: null,
      partnerAvatar: null,
      themeId: "widget_default",
      themeName: "Classique Douceur",
      gradientColors: ["#FF9A8B", "#FF6A88"],
      updatedAt: new Date().toISOString(),
    };

    const merged: WidgetPayload = {
      ...existing,
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    const theme = getWidgetTheme(merged.themeId);
    merged.themeName = theme.name;
    merged.gradientColors = theme.gradient;

    // 1. Sauvegarde dans AsyncStorage
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(merged));

    // 2. Synchronisation web localStorage
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(merged));
    }

    // 3. Sur natif Android / iOS : transmission au stockage natif pour AppWidget / WidgetKit
    if (Platform.OS === 'android') {
      try {
        if (NativeModules.WidgetBridge?.updateWidgetData) {
          await NativeModules.WidgetBridge.updateWidgetData(JSON.stringify(merged));
        }
      } catch (bridgeErr) {
        console.warn('[Widgets] WidgetBridge.updateWidgetData failed:', bridgeErr);
      }
    } else if (Platform.OS === 'ios') {
      try {
        const { QuestionWidget } = require('../widgets/QuestionWidget');
        const { StreakWidget } = require('../widgets/StreakWidget');
        QuestionWidget.updateSnapshot(merged);
        StreakWidget.updateSnapshot(merged);
        QuestionWidget.reload();
        StreakWidget.reload();
      } catch (iosErr) {
        console.warn('[Widgets] iOS widget update error:', iosErr);
      }
      try {
        const { requireNativeModule } = require('expo');
        const ExpoWidgets = requireNativeModule('ExpoWidgets');
        if (ExpoWidgets?.reloadAllWidgets) {
          ExpoWidgets.reloadAllWidgets();
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[Widgets] syncWidgetData error:', err);
  }
}

/**
 * Vérifie si l'épinglage direct du widget à l'écran d'accueil est supporté (Android 8.0+)
 */
export async function isWidgetPinSupported(): Promise<boolean> {
  if (Platform.OS === 'android' && NativeModules.WidgetBridge?.isPinSupported) {
    try {
      return await NativeModules.WidgetBridge.isPinSupported();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Demande au système Android d'ajouter/épingler le widget directement à l'écran d'accueil
 */
export async function requestPinWidget(type: 'question' | 'streak' = 'streak'): Promise<boolean> {
  if (Platform.OS === 'android' && NativeModules.WidgetBridge?.requestPinWidget) {
    try {
      return await NativeModules.WidgetBridge.requestPinWidget(type);
    } catch (e) {
      console.warn('[Widgets] requestPinWidget error:', e);
      return false;
    }
  }
  return false;
}

/**
 * Récupère les données préparées pour le widget
 */
export async function getWidgetData(): Promise<WidgetPayload> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaultTheme = getWidgetTheme('widget_default');
  return {
    streak: 1,
    daysTogether: 1,
    todayQuestion: "Quel est ton plus beau souvenir avec ton partenaire ?",
    categoryName: "Amour & Romance",
    userAnswered: false,
    partnerAnswered: false,
    bothAnswered: false,
    userPseudo: "Moi",
    partnerPseudo: "Mon Amour",
    userAvatar: null,
    partnerAvatar: null,
    themeId: "widget_default",
    themeName: defaultTheme.name,
    gradientColors: defaultTheme.gradient,
    updatedAt: new Date().toISOString(),
  };
}
