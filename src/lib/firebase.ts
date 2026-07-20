// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDSLiuhXL7zQXq5F1nZbwBCFMYGxqoH_3I",
  authDomain: "bloum-5456e.firebaseapp.com",
  projectId: "bloum-5456e",
  storageBucket: "bloum-5456e.firebasestorage.app",
  messagingSenderId: "617698669043",
  appId: "1:617698669043:web:91becdd89b21ea38b6a286",
  measurementId: "G-FKHKGY2SDJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);