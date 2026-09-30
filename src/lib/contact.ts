import { Linking, Alert } from 'react-native';

export const CONTACT_EMAIL = 'nousdeux.app.contact@gmail.com';

/**
 * Ouvre le client de messagerie par défaut avec l'adresse de contact NousDeux.
 * En cas d'échec (absence de client email configuré sur l'appareil),
 * copie l'adresse dans le presse-papier et affiche une alerte d'information.
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
    Alert.alert(
      'Email copié',
      `L'adresse ${CONTACT_EMAIL} a été copiée dans votre presse-papier.`
    );
  } catch {
    Alert.alert('Contact', `Contactez-nous à l'adresse : ${CONTACT_EMAIL}`);
  }
  return false;
}
