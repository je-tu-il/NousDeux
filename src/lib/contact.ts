import { Linking } from 'react-native';
import { useToastStore } from '../store/toastStore';

export const CONTACT_EMAIL = 'nousdeux.contact.app@gmail.com';

/**
 * Ouvre le client de messagerie par défaut avec l'adresse de contact NousDeux.
 * En cas d'échec (absence de client email configuré sur l'appareil),
 * copie l'adresse dans le presse-papier et affiche un toast discret de 2s.
 */
export async function openContactEmail(subject = 'Contact NousDeux'): Promise<boolean> {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  const mailUrl = `mailto:${CONTACT_EMAIL}${query}`;

  try {
    const supported = await Linking.canOpenURL(mailUrl);
    if (supported) {
      await Linking.openURL(mailUrl);
      return true;
    }
  } catch {
    // Si la vérification ou l'ouverture échoue, fallback sur le presse-papier
  }

  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(CONTACT_EMAIL);
    useToastStore.getState().showToast('E-mail copié ! 📋');
  } catch {
    useToastStore.getState().showToast(CONTACT_EMAIL);
  }
  return false;
}
