import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_KEYS = [
  'daily-question',
  'daily-wheel',
  'daily-quest',
  'daily-streak',
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

  const reminders = [
    { key: NOTIFICATION_KEYS[0], hour: 19, title: 'Question du jour', body: 'Votre question vous attend. Gardez votre serie en vie !' },
    { key: NOTIFICATION_KEYS[1], hour: 20, title: 'Roulette quotidienne', body: 'La roulette du jour est disponible.' },
    { key: NOTIFICATION_KEYS[2], hour: 21, title: 'Quete terminee', body: 'Une recompense vous attend peut-etre dans vos quetes.' },
    { key: NOTIFICATION_KEYS[3], hour: 22, title: 'Attention a votre serie', body: 'Pensez a repondre avant minuit pour ne pas perdre votre streak.' },
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
