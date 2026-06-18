import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "lucrei-13341.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// App Check com reCAPTCHA v3 — exigido pelo enforcement ativo no console.
// Sem isto, todas as requisições chegam sem token e o login é rejeitado
// com auth/internal-error. A chave do site precisa ter lucrei-alpha.vercel.app
// nos domínios autorizados do reCAPTCHA.
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6LcxCictAAAAACp012lv0cXt3QVbRCG1nLu7pU7t"),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
