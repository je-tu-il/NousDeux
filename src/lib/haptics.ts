import { Platform, Vibration } from 'react-native';

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'selection';

/**
 * Triggers cross-platform haptic micro-impulses:
 * - Native iOS/Android: expo-haptics (Impact / Notification / Selection) with Vibration fallback
 * - Web / Mobile Web: navigator.vibrate with specialized vibration pulses
 */
export async function triggerHaptic(type: HapticFeedbackType = 'light'): Promise<void> {
  // 1. Web & Mobile Web fallback via navigator.vibrate
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        switch (type) {
          case 'light':
          case 'selection':
            navigator.vibrate(12);
            break;
          case 'medium':
            navigator.vibrate(22);
            break;
          case 'heavy':
            navigator.vibrate(35);
            break;
          case 'success':
            navigator.vibrate([15, 30, 20]);
            break;
          case 'warning':
            navigator.vibrate([25, 40, 25]);
            break;
        }
      }
    } catch {}
    return;
  }

  // 2. Native iOS & Android via expo-haptics
  try {
    const Haptics = await import('expo-haptics');
    if (Haptics) {
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          return;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          return;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          return;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        case 'selection':
          await Haptics.selectionAsync();
          return;
      }
    }
  } catch {}

  // 3. Fallback to React Native Vibration API
  try {
    switch (type) {
      case 'light':
      case 'selection':
        Vibration.vibrate(12);
        break;
      case 'medium':
        Vibration.vibrate(25);
        break;
      case 'heavy':
        Vibration.vibrate(40);
        break;
      case 'success':
        Vibration.vibrate([0, 15, 30, 20]);
        break;
      case 'warning':
        Vibration.vibrate([0, 25, 40, 25]);
        break;
    }
  } catch {}
}
