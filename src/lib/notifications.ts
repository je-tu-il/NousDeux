import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
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
