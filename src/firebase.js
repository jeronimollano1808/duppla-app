import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAll_znaCE0lQO2eyVf_1-vpJvfDg2ALuE",
  authDomain: "dupplafitness.firebaseapp.com",
  projectId: "dupplafitness",
  storageBucket: "dupplafitness.firebasestorage.app",
  messagingSenderId: "324586851417",
  appId: "1:324586851417:web:ab0b979ff1fa36e7cb7548"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
