// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA0seoE3isMGUlKK_DKYNDqII04SqZ_9WU",
  authDomain: "gamified-music-platform.firebaseapp.com",
  projectId: "gamified-music-platform",
  storageBucket: "gamified-music-platform.firebasestorage.app",
  messagingSenderId: "837290971658",
  appId: "1:837290971658:web:49f31a226a1c7b2e6285f3",
  measurementId: "G-59EDHEQ4PF"
};

const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
