import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { CheckCircle2 } from 'lucide-react-native';
import { useToastStore } from '../store/toastStore';

export default function FloatingToast() {
  const visible = useToastStore((s) => s.visible);
  const message = useToastStore((s) => s.message);

  if (!visible || !message) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        entering={FadeInUp.duration(250)}
        exiting={FadeOutDown.duration(200)}
        style={styles.toast}
      >
        <CheckCircle2 color="#22c55e" size={18} />
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E1B1B',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
