// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  connectAuthEmulator,
  initializeAuth, 
  // @ts-ignore
  getReactNativePersistence 
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Your web app's Firebase configuration
const useLocalEmulators = process.env.EXPO_PUBLIC_FIREBASE_EMULATORS === 'true';
const firebaseConfig = useLocalEmulators ? {
  apiKey: 'demo-api-key',
  authDomain: '127.0.0.1',
  projectId: 'demo-nousdeux',
  appId: 'demo-nousdeux-web',
} : {
  apiKey: "AIzaSyDSLiuhXL7zQXq5F1nZbwBCFMYGxqoH_3I",
  authDomain: "bloum-5456e.firebaseapp.com",
  projectId: "bloum-5456e",
  storageBucket: "bloum-5456e.firebasestorage.app",
  messagingSenderId: "617698669043",
  appId: "1:617698669043:web:91becdd89b21ea38b6a286",
  measurementId: "G-FKHKGY2SDJ"
};

// Initialize Firebase (safely reuse if already initialized)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence for React Native (iOS / Android) vs Web
let firebaseAuth: any;
if (Platform.OS === 'web') {
  firebaseAuth = getAuth(app);
} else {
  try {
    firebaseAuth = initializeAuth(app, {
      persistence: typeof getReactNativePersistence === 'function' ? getReactNativePersistence(AsyncStorage) : undefined,
    });
  } catch {
    // Reuse the real Auth singleton after Fast Refresh. Never substitute a fake
    // signed-out client: it would discard restored sessions without an error.
    firebaseAuth = getAuth(app);
  }
}

// Export Auth and Firestore
export const auth = firebaseAuth;
export const db = getFirestore(app);
if (useLocalEmulators) {
  const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
  // A demo project cannot address any production Firebase resources.
  try { connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true }); } catch {}
  try { connectFirestoreEmulator(db, host, 8080); } catch {}
}
