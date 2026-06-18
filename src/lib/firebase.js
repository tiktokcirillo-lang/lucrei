import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Em produção usamos o próprio domínio como authDomain (via reverse proxy
// em vercel.json) para evitar o bloqueio de storage de terceiros do Chrome,
// que causa auth/internal-error quando o authDomain é um domínio diferente.
// Em localhost mantemos o domínio firebaseapp.com padrão.
const authDomain =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? window.location.hostname
    : "lucrei-13341.firebaseapp.com";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
