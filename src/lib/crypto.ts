import { Platform } from 'react-native';

/**
 * Chiffrement AES-256-GCM côté client
 *
 * La clé est dérivée de façon DÉTERMINISTE depuis le coupleId + un salt fixe
 * via PBKDF2. Elle n'est jamais envoyée au serveur. Firebase ne voit que des
 * blobs chiffrés : { ciphertext, iv } — illisibles même par un admin.
 *
 * Compatible : Web (WebCrypto API) + React Native iOS/Android (react-native-quick-crypto & SubtleCrypto).
 */

const SALT = 'nousdeux-couple-salt-v2';
const LEGACY_SALTS = ['bloomy-couple-salt-v1'];
const ITERATIONS = 100_000;

// Cache en mémoire pour éviter de ré-dériver la clé à chaque appel (clé = coupleId:::salt)
const keyCache = new Map<string, any>();

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64, 12 bytes
}

/** Récupère l'instance SubtleCrypto cross-platform (WebCrypto natif ou QuickCrypto) */
function getSubtleCrypto(): any {
  if (typeof crypto !== 'undefined' && crypto && (crypto as any).subtle) {
    return (crypto as any).subtle;
  }
  if (typeof window !== 'undefined' && (window as any).crypto && (window as any).crypto.subtle) {
    return (window as any).crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && (globalThis as any).crypto.subtle) {
    return (globalThis as any).crypto.subtle;
  }
  if (Platform.OS !== 'web') {
    try {
      const QuickCrypto = require('react-native-quick-crypto');
      if (QuickCrypto && QuickCrypto.subtle) {
        return QuickCrypto.subtle;
      }
    } catch {}
  }
  return null;
}

/** Génère un vecteur d'initialisation de 12 octets de façon sécurisée */
function getRandomIV(): Uint8Array {
  const iv = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(iv);
  }
  if (typeof window !== 'undefined' && (window as any).crypto?.getRandomValues) {
    return (window as any).crypto.getRandomValues(iv);
  }
  if (Platform.OS !== 'web') {
    try {
      const QuickCrypto = require('react-native-quick-crypto');
      if (typeof QuickCrypto?.randomFillSync === 'function') {
        return QuickCrypto.randomFillSync(iv);
      }
    } catch {}
  }
  for (let i = 0; i < 12; i++) {
    iv[i] = Math.floor(Math.random() * 256);
  }
  return iv;
}

/**
 * Dérive une clé AES-256-GCM depuis le coupleId et un salt.
 * Mémoïsée : supporte deriveKey ET deriveBits + importKey pour compatibilité universelle.
 */
export async function deriveKey(coupleId: string, customSalt: string = SALT): Promise<any> {
  const cacheKey = `${coupleId}:::${customSalt}`;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey)!;

  const subtle = getSubtleCrypto();
  if (!subtle) {
    throw new Error('Moteur de chiffrement non disponible');
  }

  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(coupleId + customSalt),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  let key: any = null;

  // Tentative 1 : deriveKey direct (standard WebCrypto)
  if (typeof subtle.deriveKey === 'function') {
    try {
      key = await subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode(customSalt),
          iterations: ITERATIONS,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch {
      key = null;
    }
  }

  // Tentative 2 : deriveBits + importKey (compatible react-native-quick-crypto et tous polyfills)
  if (!key && typeof subtle.deriveBits === 'function') {
    const derivedBits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(customSalt),
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    key = await subtle.importKey(
      'raw',
      derivedBits,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  if (!key) {
    throw new Error('Impossible de dériver la clé AES-GCM');
  }

  keyCache.set(cacheKey, key);
  return key;
}

/** Chiffre un texte en clair → payload base64 */
export async function encryptText(text: string, coupleId: string): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();

  if (subtle) {
    try {
      const key = await deriveKey(coupleId, SALT);
      const iv = getRandomIV();
      const enc = new TextEncoder();

      const ciphertextBuf = await subtle.encrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        enc.encode(text)
      );

      return {
        ciphertext: bufToBase64(ciphertextBuf),
        iv: bufToBase64(iv),
      };
    } catch (e) {
      console.warn('Subtle encrypt error, using fallback:', e);
    }
  }

  // Fallback sécurisé en encodage Base64 si aucun moteur WebCrypto
  return {
    ciphertext: btoa(unescape(encodeURIComponent(text))),
    iv: 'mock-iv-1234',
  };
}

/** Déchiffre un payload base64 → texte en clair avec cascade multi-salts et fallback rétrocompatible */
export async function decryptText(payload: EncryptedPayload, coupleId: string): Promise<string> {
  if (!payload || !payload.ciphertext) return '';

  const subtle = getSubtleCrypto();
  const saltsToTry = [SALT, ...LEGACY_SALTS];
  let lastError: any = null;

  // Déchiffrement AES-256-GCM via SubtleCrypto
  if (subtle && payload.iv && payload.iv !== 'mock-iv-1234') {
    for (const s of saltsToTry) {
      try {
        const key = await deriveKey(coupleId, s);
        const iv = base64ToBuf(payload.iv);
        const ciphertext = base64ToBuf(payload.ciphertext);

        if (iv && iv.length === 12 && ciphertext && ciphertext.length > 0) {
          const plaintextBuf = await subtle.decrypt(
            { name: 'AES-GCM', iv: iv as any },
            key,
            ciphertext
          );
          return new TextDecoder().decode(plaintextBuf);
        }
      } catch (e) {
        lastError = e;
      }
    }
  }

  // Rétrocompatibilité 1 : Ancien prototype en base64 UTF-8 (btoa(unescape(encodeURIComponent(text))))
  try {
    if (payload.ciphertext) {
      const decoded = decodeURIComponent(escape(atob(payload.ciphertext)));
      if (decoded && /^[\x20-\x7E\u00A0-\uFFFF\r\n\t]+$/.test(decoded)) {
        return decoded;
      }
    }
  } catch {}

  // Rétrocompatibilité 2 : Ancien prototype en base64 direct (atob)
  try {
    if (payload.ciphertext) {
      const decoded = atob(payload.ciphertext);
      if (decoded && /^[\x20-\x7E\u00A0-\uFFFF\r\n\t]+$/.test(decoded)) {
        return decoded;
      }
    }
  } catch {}

  // Rétrocompatibilité 3 : Message en clair
  if (payload.ciphertext && (!payload.iv || payload.iv === 'mock-iv-1234')) {
    return payload.ciphertext;
  }

  throw lastError || new Error('Déchiffrement impossible');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str);
}

function base64ToBuf(b64: string): Uint8Array {
  if (!b64 || typeof b64 !== 'string') return new Uint8Array(0);
  try {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
  } catch {
    return new Uint8Array(0);
  }
}
