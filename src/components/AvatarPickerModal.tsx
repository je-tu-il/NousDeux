import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Camera, Image as ImageIcon, Trash2, X } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';
import { stripMetadataAndCompress } from '../lib/avatarPicker';

interface AvatarPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onPickGallery: () => void;
  onRemovePhoto?: () => void;
  onSelectDataUri?: (dataUri: string) => void;
  hasPhoto?: boolean;
}

const webFileInputStyle: any = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  zIndex: 10,
};

export default function AvatarPickerModal({
  visible,
  onClose,
  onTakePhoto,
  onPickGallery,
  onRemovePhoto,
  onSelectDataUri,
  hasPhoto = false,
}: AvatarPickerModalProps) {
  const isDark = useOnboardingStore((state) => state.isDarkMode);
  const theme = isDark ? Colors.dark : Colors.light;

  const handleWebFile = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const rawUri = ev.target?.result as string;
          const cleanDataUri = await stripMetadataAndCompress(rawUri, 256);
          if (onSelectDataUri) {
            onSelectDataUri(cleanDataUri);
          } else {
            onPickGallery();
          }
        } finally {
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop transparent pour fermer au tap à l'extérieur de la modale */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={FadeInUp.duration(250)}
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#221919' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Photo de profil</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <X size={20} color={theme.tabIconDefault} />
            </Pressable>
          </View>

          {/* Option: Prendre une photo */}
          <View style={styles.optionWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.optionRow,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
                pressed && styles.pressedOption,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  onClose();
                  onTakePhoto();
                }
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,106,136,0.15)' }]}>
                <Camera size={22} color="#FF6A88" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>Prendre une photo</Text>
                <Text style={[styles.optionSubtitle, { color: theme.tabIconDefault }]}>
                  Utiliser votre appareil photo
                </Text>
              </View>
            </Pressable>

            {Platform.OS === 'web' && (
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={webFileInputStyle}
                onChange={handleWebFile}
              />
            )}
          </View>

          {/* Option: Choisir dans la galerie */}
          <View style={styles.optionWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.optionRow,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
                pressed && styles.pressedOption,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  onClose();
                  onPickGallery();
                }
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <ImageIcon size={22} color="#3B82F6" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>Choisir dans la galerie</Text>
                <Text style={[styles.optionSubtitle, { color: theme.tabIconDefault }]}>
                  Sélectionner une photo existante
                </Text>
              </View>
            </Pressable>

            {Platform.OS === 'web' && (
              <input
                type="file"
                accept="image/*"
                style={webFileInputStyle}
                onChange={handleWebFile}
              />
            )}
          </View>

          {/* Option: Supprimer (si une photo existe) */}
          {hasPhoto && onRemovePhoto && (
            <Pressable
              style={({ pressed }) => [
                styles.optionRow,
                { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)' },
                pressed && styles.pressedOption,
              ]}
              onPress={() => {
                onClose();
                onRemovePhoto();
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Trash2 size={22} color="#EF4444" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: '#EF4444' }]}>Supprimer la photo</Text>
                <Text style={[styles.optionSubtitle, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>
                  Revenir à l'avatar par défaut
                </Text>
              </View>
            </Pressable>
          )}

          {/* Bouton Annuler */}
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>Annuler</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 20 : 16,
    paddingBottom: Platform.OS === 'web' ? 20 : 34,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
  },
  optionWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    gap: 14,
  },
  pressedOption: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
