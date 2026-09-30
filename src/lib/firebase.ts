// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  initializeAuth, 
  // @ts-ignore
  getReactNativePersistence 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Your web app's Firebase configuration
const firebaseConfig = {
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
  } catch (err) {
    try {
      firebaseAuth = getAuth(app);
    } catch (e) {
      console.warn('[Firebase] Fallback getAuth warning:', e);
      firebaseAuth = {
        currentUser: null,
        onAuthStateChanged: (cb: (user: any) => void) => {
          cb(null);
          return () => {};
        },
        signOut: async () => {},
      };
    }
  }
}

// Export Auth and Firestore
export const auth = firebaseAuth;
export const db = getFirestore(app);