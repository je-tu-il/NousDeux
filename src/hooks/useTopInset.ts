import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * useTopInset hook
 * Computes a reliable top inset across iOS, Android, and Web.
 * On Android, takes Math.max of insets.top and StatusBar.currentHeight (defaulting to 24),
 * ensuring content never collides with status bar clock or camera cutouts in translucent mode.
 */
export function useTopInset(extraPadding: number = 0): number {
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'android') {
    const androidStatus = Math.max(insets.top || 0, StatusBar.currentHeight ?? 0, 38);
    return androidStatus + extraPadding;
  }

  if (Platform.OS === 'ios') {
    return Math.max(insets.top || 0, 44) + extraPadding;
  }

  // Web / fallback
  return (insets.top || 0) + extraPadding;
}

export default useTopInset;
