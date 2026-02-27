import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:  "AIzaSyC-DeN0kPonjC3LSwMPAvgy-KzaH3AN-qQ",
  authDomain: "deardiaryapp-3c86c.firebaseapp.com",
  projectId: "deardiaryapp-3c86c",
  storageBucket: "deardiaryapp-3c86c.firebasestorage.app",
  messagingSenderId: "138714408969",
  appId: "1:138714408969:web:f4a220f880978389dcb0d8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);