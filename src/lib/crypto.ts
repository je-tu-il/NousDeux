import { Platform } from 'react-native';

// MOCK CRYPTO FOR UI TESTING ON WEB
// react-native-quick-crypto uses native C++ (JSI) which crashes on Web.
// We use a simple base64 mock here so you can design and debug the UI in your browser.

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export async function encryptPayload(payload: string, partnerPublicKeyPem: string): Promise<EncryptedPayload> {
  // Fake encryption (Base64) for Web testing
  return {
    ciphertext: btoa(payload), // Simple base64 encode
    iv: "mock-iv-1234",
    authTag: "mock-auth-tag"
  };
}

export async function decryptPayload(encrypted: EncryptedPayload, partnerPublicKeyPem: string): Promise<string> {
  // Fake decryption
  return atob(encrypted.ciphertext);
}
