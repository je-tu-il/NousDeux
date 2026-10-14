import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useOnboardingStore } from '@/store/onboardingStore';
import { syncWidgetData } from './widgets';

export const NOTIFICATION_KEYS = [
  'daily-question',
  'daily-wheel',
  'daily-quest',
  'daily-streak',
  'solo-invite',
  'solo-questions',
  'solo-profile',
] as const;

export const KEY_WHEEL_CLAIMED_DATE = '@nousdeux_wheel_claimed_date';
export const KEY_QUESTION_ANSWERED_DATE = '@nousdeux_question_answered_date';
export const KEY_BOTH_ANSWERED_DATE = '@nousdeux_both_answered_date';
export const KEY_PARTNER_NOTIFIED_DATE = '@nousdeux_partner_answered_notified_date';
export const BACKGROUND_PARTNER_SYNC_TASK = 'nousdeux-background-partner-sync';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function getLocalDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('daily-reminders', {
    name: 'Rappels NousDeux',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: '#FF9A8B',
  });
  await Notifications.setNotificationChannelAsync('partner-alerts', {
    name: 'Réponses Partenaire',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF4B2B',
    sound: 'default',
  });
}

/**
 * Enregistre et persiste le token de notification push Expo pour l'utilisateur
 */
export async function registerPushTokenForUser(userId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !userId) return null;
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return null;

    await configureAndroidChannel();

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: 'eb65fdb1-87cc-4806-bcf1-7eddb1372f3b',
    });
    const token = tokenResponse.data;
    if (token) {
      await updateDoc(doc(db, 'users', userId), {
        expoPushToken: token,
      }).catch(() => {});
      return token;
    }
  } catch (err) {
    // Expected on sideloaded iOS without APNs entitlement
    console.warn('[Notifications] registerPushToken info (sideloaded iOS uses background fetch fallback):', err);
  }
  return null;
}

/**
 * Envoie une notification push au partenaire quand l'utilisateur répond à la question du jour
 */
export async function sendPartnerAnswerPush(partnerUid: string, userPseudo: string): Promise<void> {
  if (!partnerUid) return;
  try {
    const partnerDoc = await getDoc(doc(db, 'users', partnerUid));
    if (!partnerDoc.exists()) return;
    const token = partnerDoc.data()?.expoPushToken as string | undefined;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title: '💌 Ton amour a répondu !',
        body: `${userPseudo || 'Ton partenaire'} vient de répondre à la question du jour ! Découvre sa réponse ✨`,
        channelId: 'partner-alerts',
        data: { url: '/dashboard' },
      }),
    });
  } catch (err) {
    console.warn('[Notifications] sendPartnerAnswerPush error:', err);
  }
}

/**
 * Déclenche une notification locale immédiate quand la réponse du partenaire est détectée
 */
export async function triggerPartnerAnsweredNotification(partnerPseudo: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await configureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💌 Ton amour a répondu !',
        body: `${partnerPseudo || 'Ton partenaire'} vient de répondre à la question du jour ! Découvre sa réponse ✨`,
        data: { url: '/dashboard' },
        sound: 'default',
        channelId: 'partner-alerts',
      } as any,
      trigger: null,
    });
  } catch (err) {
    console.warn('[Notifications] triggerPartnerAnsweredNotification error:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// État dynamique du jour : roulette & question du jour
// ─────────────────────────────────────────────────────────────────────────────

export async function isRouletteClaimedToday(uid?: string): Promise<boolean> {
  try {
    const today = getLocalDateKey();
    const stored = await AsyncStorage.getItem(KEY_WHEEL_CLAIMED_DATE);
    if (stored === today) return true;

    const userUid = uid || useOnboardingStore.getState().uid;
    const partnerUid = useOnboardingStore.getState().partnerUid;
    if (userUid && partnerUid) {
      const cId = [userUid, partnerUid].sort().join('_');
      const { getCachedWallet, getWallet } = await import('./economy');
      const wallet = getCachedWallet(cId) || await getWallet(cId).catch(() => null);
      if (wallet?.dailyClaims?.[userUid] === today) {
        await AsyncStorage.setItem(KEY_WHEEL_CLAIMED_DATE, today);
        return true;
      }
    }
  } catch {}
  return false;
}

export async function markRouletteClaimedToday(uid?: string): Promise<void> {
  try {
    const today = getLocalDateKey();
    await AsyncStorage.setItem(KEY_WHEEL_CLAIMED_DATE, today);
    await cancelRouletteReminder();
  } catch {}
}

export async function isQuestionAnsweredToday(uid?: string): Promise<boolean> {
  try {
    const today = getLocalDateKey();
    const stored = await AsyncStorage.getItem(KEY_QUESTION_ANSWERED_DATE);
    if (stored === today) return true;
  } catch {}
  return false;
}

export async function markQuestionAnsweredToday(uid?: string, slotKey?: string): Promise<void> {
  try {
    const key = slotKey || getLocalDateKey();
    await AsyncStorage.setItem(KEY_QUESTION_ANSWERED_DATE, key);
    await cancelDailyQuestionReminder();
  } catch {}
}

export async function isBothAnsweredToday(): Promise<boolean> {
  try {
    const today = getLocalDateKey();
    const stored = await AsyncStorage.getItem(KEY_BOTH_ANSWERED_DATE);
    if (stored === today) return true;
  } catch {}
  return false;
}

export async function markBothAnsweredToday(slotKey?: string): Promise<void> {
  try {
    const key = slotKey || getLocalDateKey();
    await AsyncStorage.setItem(KEY_BOTH_ANSWERED_DATE, key);
    await cancelStreakReminder();
  } catch {}
}

export async function cancelRouletteReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.identifier.startsWith('nousdeux-daily-wheel-today') || notif.identifier === 'nousdeux-daily-wheel') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch {}
}

export async function cancelDailyQuestionReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.identifier.startsWith('nousdeux-daily-question-today') || notif.identifier === 'nousdeux-daily-question') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch {}
}

export async function cancelStreakReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.identifier.startsWith('nousdeux-daily-streak-today') || notif.identifier === 'nousdeux-daily-streak') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch {}
}

/**
 * Planification intelligente et adaptative des rappels :
 * - Ne rappelle PAS la roulette si elle a déjà été tournée aujourd'hui.
 * - Ne rappelle PAS la question du jour si elle a déjà été répondue aujourd'hui.
 * - Ne rappelle PAS la flamme si les deux ont déjà validé la journée.
 * - Planifie les prochains jours pour garantir les rappels quotidiens sans doublon passé.
 */
export async function scheduleDailyReminders(): Promise<void> {
  if (Platform.OS === 'web') return;

  const current = await Notifications.getPermissionsAsync();
  const permissions = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permissions.granted) return;

  await configureAndroidChannel();

  // Annuler les notifications planifiées antérieures de NousDeux
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of existing) {
      if (notif.identifier.startsWith('nousdeux-')) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch {}

  const store = useOnboardingStore.getState();
  const isCouple = Boolean(store.isSynced && store.partnerUid);

  const wheelDone = await isRouletteClaimedToday(store.uid);
  const questionDone = await isQuestionAnsweredToday(store.uid);
  const bothDone = await isBothAnsweredToday();

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const reminders = isCouple
    ? [
        {
          key: 'daily-question',
          hour: 19,
          minute: 0,
          title: 'Question du jour 💖',
          body: 'Votre question en amoureux vous attend. Répondez ensemble pour faire grandir votre flamme !',
          alreadyDoneToday: questionDone,
        },
        {
          key: 'daily-wheel',
          hour: 20,
          minute: 0,
          title: 'Roue de la complicité 🎡',
          body: 'Faites tourner la roue pour remporter des pétales et des gages mignons ou coquins !',
          alreadyDoneToday: wheelDone,
        },
        {
          key: 'daily-quest',
          hour: 21,
          minute: 0,
          title: 'Quête en duo 🏆',
          body: 'Une récompense vous attend peut-être dans vos défis de couple.',
          alreadyDoneToday: false,
        },
        {
          key: 'daily-streak',
          hour: 22,
          minute: 0,
          title: 'Attention à votre flamme 🔥',
          body: 'Pensez à répondre avant minuit pour conserver votre série de jours consécutifs !',
          alreadyDoneToday: bothDone,
        },
      ]
    : [
        {
          key: 'solo-invite',
          hour: 18,
          minute: 0,
          title: 'Invitez votre moitié 💌',
          body: 'Partagez votre code NousDeux pour débloquer les questions du jour et la roue de la complicité !',
          alreadyDoneToday: false,
        },
        {
          key: 'solo-questions',
          hour: 20,
          minute: 0,
          title: 'Questions à volonté 💭',
          body: 'Explorez nos centaines de questions pour découvrir des thèmes profonds ou amusants.',
          alreadyDoneToday: false,
        },
        {
          key: 'solo-profile',
          hour: 21,
          minute: 0,
          title: 'Personnalisez votre profil 🌸',
          body: 'Choisissez votre avatar et vos cosmétiques en attendant de synchroniser votre moitié !',
          alreadyDoneToday: false,
        },
      ];

  for (const reminder of reminders) {
    // 1. Aujourd'hui (Jour 0) : programmer UNIQUEMENT si non encore réalisé ET que l'heure n'est pas passée
    const isPastToday = currentHour > reminder.hour || (currentHour === reminder.hour && currentMinute >= reminder.minute);
    if (!reminder.alreadyDoneToday && !isPastToday) {
      const todayTarget = new Date();
      todayTarget.setHours(reminder.hour, reminder.minute, 0, 0);

      await Notifications.scheduleNotificationAsync({
        identifier: `nousdeux-${reminder.key}-today`,
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { url: '/dashboard', reminder: reminder.key },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: todayTarget,
          channelId: 'daily-reminders',
        } as any,
      }).catch(() => {});
    }

    // 2. Jours futurs (J+1 à J+7) : planifier à l'avance pour assurer les notifications même sans ouverture quotidienne
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + dayOffset);
      futureDate.setHours(reminder.hour, reminder.minute, 0, 0);

      await Notifications.scheduleNotificationAsync({
        identifier: `nousdeux-${reminder.key}-day-${dayOffset}`,
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { url: '/dashboard', reminder: reminder.key },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: futureDate,
          channelId: 'daily-reminders',
        } as any,
      }).catch(() => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vérification active et tâche en arrière-plan pour le partenaire
// ─────────────────────────────────────────────────────────────────────────────

export async function checkPartnerAnswerAndSync(): Promise<boolean> {
  const store = useOnboardingStore.getState();
  const myUid = store.uid;
  const partnerUid = store.partnerUid;
  const partnerPseudo = store.partnerPseudo || 'Ton amour';

  if (!myUid || !partnerUid) return false;
  const coupleId = [myUid, partnerUid].sort().join('_');

  const today = getLocalDateKey();
  try {
    const pAns = await getDoc(doc(db, 'couples', coupleId, 'daily', today, 'answers', partnerUid));
    if (pAns.exists()) {
      const lastNotified = await AsyncStorage.getItem(KEY_PARTNER_NOTIFIED_DATE);
      if (lastNotified !== today) {
        await AsyncStorage.setItem(KEY_PARTNER_NOTIFIED_DATE, today);
        await triggerPartnerAnsweredNotification(partnerPseudo);
      }
      await syncWidgetData({ partnerAnswered: true });

      const myAns = await getDoc(doc(db, 'couples', coupleId, 'daily', today, 'answers', myUid));
      if (myAns.exists()) {
        await markBothAnsweredToday(today);
        await syncWidgetData({ bothAnswered: true });
      }
      return true;
    }
  } catch (err) {
    console.warn('[Notifications] checkPartnerAnswerAndSync error:', err);
  }
  return false;
}

// Enregistrement de la tâche en arrière-plan (Background Fetch)
if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(BACKGROUND_PARTNER_SYNC_TASK, async () => {
      try {
        const foundNewAnswer = await checkPartnerAnswerAndSync();
        return foundNewAnswer
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch (err) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  } catch (e) {
    console.warn('[Notifications] TaskManager defineTask warning:', e);
  }
}

export async function initBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_PARTNER_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_PARTNER_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes minimum
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (e) {
    console.warn('[Notifications] initBackgroundSync error:', e);
  }
}
