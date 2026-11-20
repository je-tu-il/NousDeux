import { Platform } from 'react-native';
import { GoogleAuthProvider, OAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, type User } from 'firebase/auth';
import * as Crypto from 'expo-crypto';
import { collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export async function confirmAccountIdentity(user: User) {
  const signedInAt = Date.parse(user.metadata.lastSignInTime || '');
  if (signedInAt > Date.now() - 4 * 60 * 1000) return;
  const isApple = user.providerData.some((provider) => provider.providerId === 'apple.com');
  if (Platform.OS === 'web') {
    await reauthenticateWithPopup(user, isApple ? new OAuthProvider('apple.com') : new GoogleAuthProvider());
  } else if (isApple && Platform.OS === 'ios') {
    const Apple = await import('expo-apple-authentication');
    const rawNonce = Crypto.randomUUID();
    const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const result = await Apple.signInAsync({ nonce, requestedScopes: [] });
    if (!result.identityToken) throw new Error('Apple n’a pas confirmé ton identité.');
    await reauthenticateWithCredential(user, new OAuthProvider('apple.com').credential({ idToken: result.identityToken, rawNonce }));
  } else {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId: '617698669043-fjlmaj3eja7tenr5ov2kcbdol76ped0g.apps.googleusercontent.com',
      iosClientId: '617698669043-ioqqer8rkgih638t0a2b4d7j1sthg4un.apps.googleusercontent.com',
    });
    const result = await GoogleSignin.signIn();
    if (result.type !== 'success' || !result.data.idToken) throw new Error('La confirmation a été annulée.');
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(result.data.idToken));
  }
}

/** Delete child answers before their parent; Firestore never cascades deletions. */
export async function deleteCoupleData(coupleId: string) {
  for (const name of ['daily', 'progress', 'quests', 'economy', 'inventory', 'messages']) {
    const snapshot = await getDocs(collection(db, 'couples', coupleId, name));
    for (const item of snapshot.docs) {
      if (name === 'daily') {
        const answers = await getDocs(collection(item.ref, 'answers'));
        for (let offset = 0; offset < answers.docs.length; offset += 400) {
          const batch = writeBatch(db);
          answers.docs.slice(offset, offset + 400).forEach((answer) => batch.delete(answer.ref));
          await batch.commit();
        }
      }
    }
    for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
      const batch = writeBatch(db);
      snapshot.docs.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'couples', coupleId));
}
