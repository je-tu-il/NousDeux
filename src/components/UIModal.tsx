import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  WifiOff,
  Lock,
  Link2Off,
  Coins,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  UserX,
  HeartOff,
} from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';

export type UIModalType =
  | 'network'
  | 'auth'
  | 'sync'
  | 'funds'
  | 'permission'
  | 'self_pairing'
  | 'already_linked'
  | 'error'
  | 'warning'
  | 'success'
  | 'info';

export interface UIModalProps {
  visible: boolean;
  onClose: () => void;
  type?: UIModalType;
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  cancelText?: string;
  showCancel?: boolean;
}

const DEFAULT_CONFIG: Record<
  UIModalType,
  {
    title: string;
    message: string;
    icon: (color: string) => React.ReactNode;
    color: string;
    bgColor: string;
  }
> = {
  network: {
    title: 'Problème de connexion',
    message: 'Impossible de joindre le serveur. Vérifie ta connexion internet puis réessaie.',
    icon: (c) => <WifiOff color={c} size={36} />,
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
  },
  auth: {
    title: 'Session expirée',
    message: 'Votre session a expiré ou la connexion a échoué. Veuillez vous reconnecter.',
    icon: (c) => <Lock color={c} size={36} />,
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
  },
  sync: {
    title: 'Code introuvable',
    message: "Ce code de synchronisation n'existe pas ou a expiré. Vérifie les 6 caractères avec ton partenaire.",
    icon: (c) => <Link2Off color={c} size={36} />,
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.12)',
  },
  funds: {
    title: 'Pétales insuffisantes',
    message: "Tu n'as pas assez de pétales 🌸 pour cet article. Réponds aux questions quotidiennes pour en gagner !",
    icon: (c) => <Coins color={c} size={36} />,
    color: '#EAB308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
  },
  permission: {
    title: 'Accès requis',
    message: "Nous avons besoin de cette autorisation pour continuer cette action.",
    icon: (c) => <AlertTriangle color={c} size={36} />,
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
  },
  self_pairing: {
    title: 'Code personnel',
    message: "Tu ne peux pas te synchroniser avec toi-même ! Ce code appartient à ton propre compte. Demande à ton partenaire de t'envoyer son propre code.",
    icon: (c) => <UserX color={c} size={36} />,
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
  },
  already_linked: {
    title: 'Partenaire indisponible',
    message: "Cette personne est déjà en couple avec un autre utilisateur. Les comptes ne peuvent pas être liés.",
    icon: (c) => <HeartOff color={c} size={36} />,
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
  },
  error: {
    title: 'Oups ! Une erreur est survenue',
    message: "Une erreur inattendue s'est produite. Merci de réessayer dans un instant.",
    icon: (c) => <AlertCircle color={c} size={36} />,
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
  },
  warning: {
    title: 'Attention',
    message: "Veuillez vérifier les informations saisies avant de continuer.",
    icon: (c) => <AlertTriangle color={c} size={36} />,
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
  },
  success: {
    title: 'Bravo !',
    message: 'Action effectuée avec succès.',
    icon: (c) => <CheckCircle2 color={c} size={36} />,
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
  },
  info: {
    title: 'Information',
    message: 'Voici une information utile pour votre expérience.',
    icon: (c) => <Info color={c} size={36} />,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
  },
};

export default function UIModal({
  visible,
  onClose,
  type = 'error',
  title,
  message,
  actionText = 'Compris',
  onAction,
  cancelText,
  showCancel = false,
}: UIModalProps) {
  const isDarkMode = useOnboardingStore((s) => s.isDarkMode);
  const theme = isDarkMode ? Colors.dark : Colors.light;

  const config = DEFAULT_CONFIG[type] || DEFAULT_CONFIG.error;
  const modalTitle = title || config.title;
  const modalMessage = message || config.message;

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode ? '#241B26' : '#FFFFFF',
                  borderColor: isDarkMode ? 'rgba(255,106,136,0.3)' : 'rgba(255,154,139,0.35)',
                },
              ]}
            >
              {/* Icon Container */}
              <View
                style={[
                  styles.iconWrapper,
                  { backgroundColor: config.bgColor, borderColor: `${config.color}33` },
                ]}
              >
                {config.icon(config.color)}
              </View>

              {/* Title */}
              <Text
                style={[
                  styles.title,
                  { color: isDarkMode ? '#F3E8E2' : '#2D1515' },
                ]}
              >
                {modalTitle}
              </Text>

              {/* Message */}
              <Text
                style={[
                  styles.message,
                  { color: isDarkMode ? '#D4B8B4' : '#6B5755' },
                ]}
              >
                {modalMessage}
              </Text>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                {showCancel && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      {
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    onPress={onClose}
                  >
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        { color: isDarkMode ? '#D4B8B4' : '#6B5755' },
                      ]}
                    >
                      {cancelText || 'Annuler'}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: config.color,
                      opacity: pressed ? 0.85 : 1,
                      flex: showCancel ? 1 : undefined,
                      minWidth: showCancel ? undefined : 160,
                    },
                  ]}
                  onPress={handleAction}
                >
                  <Text style={styles.primaryBtnText}>{actionText}</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}),
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  primaryBtn: {
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
