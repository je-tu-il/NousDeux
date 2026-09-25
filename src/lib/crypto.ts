/**
 * Chiffrement AES-256-GCM côté client
 *
 * La clé est dérivée de façon DÉTERMINISTE depuis le coupleId + un salt fixe
 * via PBKDF2. Elle n'est jamais envoyée au serveur. Firebase ne voit que des
 * blobs chiffrés : { ciphertext, iv } — illisibles même par un admin.
 *
 * Compatible : Web (WebCrypto API) + React Native ≥ 0.72 (Hermes supporte WebCrypto).
 */

const SALT = 'nousdeux-couple-salt-v2';
const LEGACY_SALTS = ['bloomy-couple-salt-v1'];
const ITERATIONS = 100_000;

// Cache en mémoire pour éviter de ré-dériver la clé à chaque appel (clé = coupleId:::salt)
const keyCache = new Map<string, CryptoKey>();

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64, 12 bytes
}

/**
 * Dérive une clé AES-256-GCM depuis le coupleId et un salt.
 * Mémoïsée : la dérivation (PBKDF2 × 100k) ne se fait qu'une fois par coupleId + salt.
 */
export async function deriveKey(coupleId: string, customSalt: string = SALT): Promise<CryptoKey> {
  const cacheKey = `${coupleId}:::${customSalt}`;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey)!;

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(coupleId + customSalt),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
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

  keyCache.set(cacheKey, key);
  return key;
}

/** Chiffre un texte en clair → payload base64 */
export async function encryptText(text: string, coupleId: string): Promise<EncryptedPayload> {
  const key = await deriveKey(coupleId, SALT);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(text)
  );

  return {
    ciphertext: bufToBase64(ciphertextBuf),
    iv: bufToBase64(iv),
  };
}

/** Déchiffre un payload base64 → texte en clair avec rétrocompatibilité multi-salts et plain text */
export async function decryptText(payload: EncryptedPayload, coupleId: string): Promise<string> {
  if (!payload || !payload.ciphertext) return '';

  const saltsToTry = [SALT, ...LEGACY_SALTS];
  let lastError: any = null;

  for (const s of saltsToTry) {
    try {
      const key = await deriveKey(coupleId, s);
      const iv = base64ToBuf(payload.iv);
      const ciphertext = base64ToBuf(payload.ciphertext);

      if (iv && iv.length === 12 && ciphertext && ciphertext.length > 0) {
        const plaintextBuf = await crypto.subtle.decrypt(
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

  // Rétrocompatibilité : Ancien format prototype en simple base64 (atob)
  try {
    if (payload.ciphertext) {
      const decoded = atob(payload.ciphertext);
      if (decoded && /^[\x20-\x7E\u00A0-\uFFFF\r\n\t]+$/.test(decoded)) {
        return decoded;
      }
    }
  } catch {}

  // Rétrocompatibilité : Message en clair ou sans IV
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
