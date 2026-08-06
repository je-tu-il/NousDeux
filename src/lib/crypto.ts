/**
 * Chiffrement AES-256-GCM côté client
 *
 * La clé est dérivée de façon DÉTERMINISTE depuis le coupleId + un salt fixe
 * via PBKDF2. Elle n'est jamais envoyée au serveur. Firebase ne voit que des
 * blobs chiffrés : { ciphertext, iv } — illisibles même par un admin.
 *
 * Compatible : Web (WebCrypto API) + React Native ≥ 0.72 (Hermes supporte WebCrypto).
 */

const SALT = 'bloomy-couple-salt-v1';
const ITERATIONS = 100_000;

// Cache en mémoire pour éviter de ré-dériver la clé à chaque appel
const keyCache = new Map<string, CryptoKey>();

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64, 12 bytes
}

/**
 * Dérive une clé AES-256-GCM depuis le coupleId.
 * Mémoïsée : la dérivation (PBKDF2 × 100k) ne se fait qu'une fois par coupleId.
 */
export async function deriveKey(coupleId: string): Promise<CryptoKey> {
  if (keyCache.has(coupleId)) return keyCache.get(coupleId)!;

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(coupleId + SALT),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(coupleId, key);
  return key;
}

/** Chiffre un texte en clair → payload base64 */
export async function encryptText(text: string, coupleId: string): Promise<EncryptedPayload> {
  const key = await deriveKey(coupleId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(text)
  );

  return {
    ciphertext: bufToBase64(ciphertextBuf),
    iv: bufToBase64(iv),
  };
}

/** Déchiffre un payload base64 → texte en clair */
export async function decryptText(payload: EncryptedPayload, coupleId: string): Promise<string> {
  const key = await deriveKey(coupleId);
  const iv = base64ToBuf(payload.iv);
  const ciphertext = base64ToBuf(payload.ciphertext);

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintextBuf);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str);
}

function base64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

// ── Compat legacy ─────────────────────────────────────────────────────────────
// Garde les anciens exports pour ne pas casser d'éventuels imports existants.
export interface EncryptedPayloadLegacy {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/** @deprecated Utilise encryptText / decryptText à la place */
export async function encryptPayload(payload: string, partnerPublicKeyPem: string): Promise<EncryptedPayloadLegacy> {
  const result = await encryptText(payload, partnerPublicKeyPem);
  return { ...result, authTag: '' };
}

/** @deprecated Utilise encryptText / decryptText à la place */
export async function decryptPayload(encrypted: EncryptedPayloadLegacy, partnerPublicKeyPem: string): Promise<string> {
  return decryptText({ ciphertext: encrypted.ciphertext, iv: encrypted.iv }, partnerPublicKeyPem);
}
