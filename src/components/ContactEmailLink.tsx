import React from 'react';
import { Pressable, Text, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { Mail } from 'lucide-react-native';
import { CONTACT_EMAIL, openContactEmail } from '../lib/contact';

interface Props {
  subject?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function ContactEmailLink({ subject, label, style }: Props) {
  return (
    <Pressable
      onPress={() => openContactEmail(subject)}
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && styles.pressed,
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Envoyer un email à ${CONTACT_EMAIL}`}
    >
      <View style={styles.iconCircle}>
        <Mail size={15} color="#FF6A88" />
      </View>
      <Text style={styles.emailText}>{label || CONTACT_EMAIL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 136, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 136, 0.35)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailText: {
    color: '#FF6A88',
    fontWeight: '700',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
