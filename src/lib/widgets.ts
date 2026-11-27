import { Platform, NativeModules } from 'react-native';
import { useOnboardingStore } from '../store/onboardingStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COSMETICS, Cosmetic } from '../data/cosmetics';
import { getScheduledQuestionId, getDailyQuestionForDate } from '../data/scheduledQuestions';
import { getById } from '../data/questions';

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
  localDate?: string;
  ownerUid?: string | null;
}

export const WIDGET_STORAGE_KEY = 'nousdeux_widget_payload_v1';

/**
 * Th�mes de widgets avec d�grad�s et accents visuels adapt�s
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
    emoji: '??',
  },
  widget_streak_7: {
    name: 'Cour Passion',
    gradient: ['#FF416C', '#FF4B2B'],
    textColor: '#FFFFFF',
    accentColor: '#FFD2CC',
    cardBg: 'rgba(255, 255, 255, 0.2)',
    emoji: '??',
  },
  widget_streak_14: {
    name: 'Nuit �toil�e',
    gradient: ['#0f2027', '#203a43'],
    textColor: '#FFFFFF',
    accentColor: '#64B5F6',
    cardBg: 'rgba(255, 255, 255, 0.12)',
    emoji: '?',
  },
  widget_streak_30: {
    name: 'For�t Dor�e',
    gradient: ['#11998e', '#38ef7d'],
    textColor: '#FFFFFF',
    accentColor: '#D4EDDA',
    cardBg: 'rgba(0, 0, 0, 0.18)',
    emoji: '??',
  },
  widget_shop_1: {
    name: 'N�on Cyberpunk',
    gradient: ['#8A2387', '#E94057'],
    textColor: '#FFFFFF',
    accentColor: '#00F2FE',
    cardBg: 'rgba(0, 0, 0, 0.25)',
    emoji: '?',
  },
  widget_shop_2: {
    name: 'Aurore Bor�ale',
    gradient: ['#43e97b', '#38f9d7'],
    textColor: '#1A365D',
    accentColor: '#065F46',
    cardBg: 'rgba(255, 255, 255, 0.35)',
    emoji: '??',
  },
  widget_shop_3: {
    name: 'Coucher de Soleil',
    gradient: ['#fa709a', '#fee140'],
    textColor: '#FFFFFF',
    accentColor: '#FFF3B0',
    cardBg: 'rgba(0, 0, 0, 0.15)',
    emoji: '??',
  },
  widget_shop_4: {
    name: 'Or Imp�rial',
    gradient: ['#232526', '#414345'],
    textColor: '#FFD700',
    accentColor: '#FFE57F',
    cardBg: 'rgba(255, 215, 0, 0.15)',
    emoji: '??',
  },
  widget_shop_5: {
    name: 'Galaxie Pastel',
    gradient: ['#654ea3', '#eaafc8'],
    textColor: '#FFFFFF',
    accentColor: '#F3E8FF',
    cardBg: 'rgba(255, 255, 255, 0.2)',
    emoji: '??',
  },
};

export function getWidgetTheme(themeId: string = 'widget_default') {
  return WIDGET_THEMES[themeId] || WIDGET_THEMES.widget_default;
}

/**
 * Synchronise les donn�es actuelles de l'application avec les widgets natifs (iOS / Android / Web)
 */
let pendingWidgetSync: Promise<void> = Promise.resolve();

export function syncWidgetData(payload: Partial<WidgetPayload>): Promise<void> {
  const ownerUid = useOnboardingStore.getState().uid;
  pendingWidgetSync = pendingWidgetSync.then(async () => {
    if (useOnboardingStore.getState().uid !== ownerUid) return;
    await persistWidgetData(payload, ownerUid);
  });
  return pendingWidgetSync;
}

async function persistWidgetData(payload: Partial<WidgetPayload>, ownerUid: WidgetPayload['ownerUid']): Promise<void> {
  try {
    const existingRaw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayQ = getDailyQuestionForDate(todayKey);

    const defaultQuestion = todayQ.text;
    const defaultCategory = todayQ.category;

    const previous = existingRaw ? JSON.parse(existingRaw) : null;
    const existing: WidgetPayload = previous && previous.ownerUid === ownerUid ? previous : {
      streak: 0,
      daysTogether: 0,
      todayQuestion: defaultQuestion,
      categoryName: defaultCategory,
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
      localDate: todayKey,
      ownerUid,
    };

    // D�tection automatique du changement de jour ou question vide
    const isNewDay = Boolean(existing.updatedAt && (existing.localDate || new Date(existing.updatedAt).toLocaleDateString('en-CA')) !== todayKey);
    if (isNewDay) {
      existing.userAnswered = false;
      existing.partnerAnswered = false;
      existing.bothAnswered = false;
    }
    if (!payload.todayQuestion && (isNewDay || !existing.todayQuestion || existing.todayQuestion.startsWith('Ouvrez NousDeux'))) {
      existing.todayQuestion = todayQ.text;
      existing.categoryName = todayQ.category;
    }

    const merged: WidgetPayload = {
      ...existing,
      ...payload,
      updatedAt: new Date().toISOString(),
      localDate: todayKey,
      ownerUid,
    };

    const theme = getWidgetTheme(merged.themeId);
    merged.themeName = theme.name;
    merged.gradientColors = theme.gradient;

    // 1. Sauvegarde dans AsyncStorage
    if (useOnboardingStore.getState().uid !== ownerUid) return;
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(merged));
    if (useOnboardingStore.getState().uid !== ownerUid) return;

    // 2. Synchronisation web localStorage
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(merged));
    }

    // 3. Sur natif Android / iOS : transmission au stockage natif pour AppWidget / WidgetKit
    if (Platform.OS === 'android') {
      try {
        const { requireNativeModule } = require('expo');
        const ExpoWidgets = requireNativeModule('ExpoWidgets');
        if (ExpoWidgets?.updateWidgetData) {
          await ExpoWidgets.updateWidgetData(JSON.stringify(merged));
        } else if (ExpoWidgets?.updateWidgetProps) {
          await ExpoWidgets.updateWidgetProps('QuestionWidget', merged);
          await ExpoWidgets.updateWidgetProps('StreakWidget', merged);
        }
      } catch (expoErr) {
        // Fallback to NativeModules.WidgetBridge below
      }
      try {
        if (NativeModules.WidgetBridge?.updateWidgetData) {
          await NativeModules.WidgetBridge.updateWidgetData(JSON.stringify(merged));
        }
      } catch (bridgeErr) {
        console.warn('[Widgets] WidgetBridge.updateWidgetData fallback error:', bridgeErr);
      }
    } else if (Platform.OS === 'ios') {
      try {
        const { requireNativeModule } = require('expo');
        const ExpoWidgets = requireNativeModule('ExpoWidgets');
        if (ExpoWidgets?.updateWidgetData) {
          ExpoWidgets.updateWidgetData(JSON.stringify(merged));
        }
        if (ExpoWidgets?.updateWidgetProps) {
          ExpoWidgets.updateWidgetProps('QuestionWidget', merged);
          ExpoWidgets.updateWidgetProps('StreakWidget', merged);
        }
        if (ExpoWidgets?.reloadAllWidgets) {
          ExpoWidgets.reloadAllWidgets();
        }
      } catch (nativeErr) {
        console.warn('[Widgets] ExpoWidgets native module update error:', nativeErr);
      }
      try {
        const { QuestionWidget } = require('../widgets/QuestionWidget');
        const { StreakWidget } = require('../widgets/StreakWidget');
        QuestionWidget.updateSnapshot(merged);
        StreakWidget.updateSnapshot(merged);
        QuestionWidget.reload();
        StreakWidget.reload();
      } catch (iosErr) {
        // Handled by direct ExpoWidgets.updateWidgetData/updateWidgetProps
      }
    }
  } catch (err) {
    console.warn('[Widgets] syncWidgetData error:', err);
  }
}

/**
 * V�rifie si l'�pinglage direct du widget � l'�cran d'accueil est support� (Android 8.0+)
 */
export async function isWidgetPinSupported(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const { requireNativeModule } = require('expo');
      const ExpoWidgets = requireNativeModule('ExpoWidgets');
      if (ExpoWidgets?.isPinSupported) {
        return await ExpoWidgets.isPinSupported();
      }
    } catch {}
    if (NativeModules.WidgetBridge?.isPinSupported) {
      try {
        return await NativeModules.WidgetBridge.isPinSupported();
      } catch {}
    }
  }
  return false;
}

/**
 * Demande au syst�me Android d'ajouter/�pingler le widget directement � l'�cran d'accueil
 */
export async function requestPinWidget(type: 'question' | 'streak' = 'streak'): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const { requireNativeModule } = require('expo');
      const ExpoWidgets = requireNativeModule('ExpoWidgets');
      if (ExpoWidgets?.requestPinWidget) {
        return await ExpoWidgets.requestPinWidget(type);
      }
    } catch {}
    if (NativeModules.WidgetBridge?.requestPinWidget) {
      try {
        return await NativeModules.WidgetBridge.requestPinWidget(type);
      } catch (e) {
        console.warn('[Widgets] requestPinWidget error:', e);
      }
    }
  }
  return false;
}

/**
 * R�cup�re les donn�es pr�par�es pour le widget
 */
export async function getWidgetData(): Promise<WidgetPayload> {
  const d = new Date();
  const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayQ = getDailyQuestionForDate(todayKey);

  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.ownerUid !== useOnboardingStore.getState().uid) throw new Error('Different widget owner');
      const savedDate = parsed.localDate || new Date(parsed.updatedAt).toLocaleDateString('en-CA');
      if (savedDate !== todayKey) {
        parsed.todayQuestion = todayQ.text;
        parsed.categoryName = todayQ.category;
        parsed.userAnswered = false;
        parsed.partnerAnswered = false;
        parsed.bothAnswered = false;
      }
      if ((!parsed.todayQuestion || parsed.todayQuestion.startsWith('Quelle est la plus belle') || parsed.todayQuestion.startsWith('Quel est ton plus') || parsed.todayQuestion.startsWith('Ouvrez NousDeux'))) {
        parsed.todayQuestion = todayQ.text;
        parsed.categoryName = todayQ.category;
      }
      return parsed;
    }
  } catch {}

  const defaultTheme = getWidgetTheme('widget_default');
  return {
    streak: 0,
    daysTogether: 0,
    todayQuestion: todayQ.text,
    categoryName: todayQ.category,
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
