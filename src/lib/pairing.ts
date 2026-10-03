import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Génère un code alphanumérique unique de 6 caractères majuscules
 */
export const generatePairingCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/**
 * Assure qu'un utilisateur possède un code de jumelage valide et synchronisé
 * dans 'users/{uid}' et 'pairing_codes/{code}'.
 */
export async function ensureUserPairingCode(uid: string, preferredCode?: string | null): Promise<string> {
  if (!uid) return preferredCode || generatePairingCode();

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.pairingCode && typeof data.pairingCode === 'string' && data.pairingCode.length === 6) {
        // Enregistrer également dans pairing_codes au cas où il manquerait
        await setDoc(doc(db, 'pairing_codes', data.pairingCode), {
          creatorUid: uid,
          createdAt: new Date(),
        }, { merge: true }).catch(() => {});
        return data.pairingCode;
      }
    }

    const codeToUse = (preferredCode && preferredCode.length === 6) ? preferredCode.toUpperCase() : generatePairingCode();

    // 1. Sauvegarder dans pairing_codes pour la recherche du partenaire
    await setDoc(doc(db, 'pairing_codes', codeToUse), {
      creatorUid: uid,
      createdAt: new Date(),
    }, { merge: true }).catch((err) => console.warn('Erreur setDoc pairing_codes:', err));

    // 2. Sauvegarder dans le document utilisateur (crée le doc s'il n'existe pas)
    await setDoc(userRef, {
      pairingCode: codeToUse,
    }, { merge: true }).catch((err) => console.warn('Erreur setDoc users:', err));

    return codeToUse;
  } catch (error) {
    console.warn('Erreur ensureUserPairingCode :', error);
    return preferredCode || generatePairingCode();
  }
}
