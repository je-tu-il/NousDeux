import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useOnboardingStore } from '@/store/onboardingStore';

export const NOTIFICATION_KEYS = [
  'daily-question',
  'daily-wheel',
  'daily-quest',
  'daily-streak',
  'solo-invite',
  'solo-questions',
  'solo-profile',
] as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
    console.warn('[Notifications] registerPushToken error:', err);
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
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[Notifications] triggerPartnerAnsweredNotification error:', err);
  }
}

export async function scheduleDailyReminders(): Promise<void> {
  if (Platform.OS === 'web') return;

  const current = await Notifications.getPermissionsAsync();
  const permissions = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permissions.granted) return;

  await configureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const store = useOnboardingStore.getState();
  const isCouple = Boolean(store.isSynced && store.partnerUid);

  const reminders = isCouple
    ? [
        { key: 'daily-question', hour: 19, title: 'Question du jour 💖', body: 'Votre question en amoureux vous attend. Répondez ensemble pour faire grandir votre flamme !' },
        { key: 'daily-wheel', hour: 20, title: 'Roue de la complicité 🎡', body: 'Faites tourner la roue pour remporter des pétales et des gages mignons ou coquins !' },
        { key: 'daily-quest', hour: 21, title: 'Quête en duo 🏆', body: 'Une récompense vous attend peut-être dans vos défis de couple.' },
        { key: 'daily-streak', hour: 22, title: 'Attention à votre flamme 🔥', body: 'Pensez à répondre avant minuit pour conserver votre série de jours consécutifs !' },
      ]
    : [
        { key: 'solo-invite', hour: 18, title: 'Invitez votre moitié 💌', body: 'Partagez votre code NousDeux pour débloquer les questions du jour et la roue de la complicité !' },
        { key: 'solo-questions', hour: 20, title: 'Questions à volonté 💭', body: 'Explorez nos centaines de questions pour découvrir des thèmes profonds ou amusants.' },
        { key: 'solo-profile', hour: 21, title: 'Personnalisez votre profil 🌸', body: 'Choisissez votre avatar et vos cosmétiques en attendant de synchroniser votre moitié !' },
      ];

  await Promise.all(reminders.map((reminder) => Notifications.scheduleNotificationAsync({
    identifier: `nousdeux-${reminder.key}`,
    content: {
      title: reminder.title,
      body: reminder.body,
      data: { url: '/dashboard', reminder: reminder.key },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminder.hour,
      minute: 0,
      channelId: 'daily-reminders',
    },
  })));
}
