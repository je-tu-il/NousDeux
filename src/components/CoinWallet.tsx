import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface CoinWalletProps {
  petals: number;
  onPress?: () => void;
  size?: 'small' | 'medium';
  theme?: 'pink' | 'white' | 'gold';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CoinWallet({ petals, onPress, size = 'small', theme = 'pink' }: CoinWalletProps) {
  const [displayValue, setDisplayValue] = useState(petals);
  const scale = useSharedValue(1);

  // Animation compteur
  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    const diff = Math.abs(petals - displayValue);
    
    if (diff > 0) {
      const step = Math.ceil(diff / 10); // Plus la diff est grande, plus ça va vite
      interval = setInterval(() => {
        setDisplayValue((prev) => {
          if (prev < petals) return Math.min(prev + step, petals);
          if (prev > petals) return Math.max(prev - step, petals);
          return prev;
        });
      }, 16); // ~60fps
    }
    
    // Animation de rebond quand la valeur change
    scale.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 10, stiffness: 400 })
    );

    return () => clearInterval(interval);
  }, [petals, displayValue, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isMedium = size === 'medium';
  
  const getThemeColors = () => {
    if (theme === 'white') return ['#FFFFFF', '#F8F9FA'];
    if (theme === 'gold') return ['#FCD34D', '#F59E0B'];
    return ['#FF9A8B', '#FF6A88'];
  };

  const getTextColor = () => {
    if (theme === 'white') return '#FF6A88';
    if (theme === 'gold') return '#78350F';
    return '#FFFFFF';
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        styles.container,
        animatedStyle,
        isMedium && styles.containerMedium,
      ]}
    >
      <LinearGradient
        colors={getThemeColors() as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, isMedium && styles.gradientMedium]}
      >
        <Text style={[styles.text, isMedium && styles.textMedium, { color: getTextColor() }]}>
          {displayValue} 🌸
        </Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    shadowColor: '#FF9A8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  containerMedium: {
    borderRadius: 24,
  },
  gradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientMedium: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  textMedium: {
    fontSize: 18,
  },
});
