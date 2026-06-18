import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { auth, googleProvider, db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    let unsubDoc = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        unsubDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (snap) => {
          setHasCompany(snap.exists() && !!snap.data()?.company);
          setLoading(false);
        });
      } else {
        setUser(null);
        setHasCompany(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      // Expõe o erro real em vez de descartá-lo silenciosamente.
      console.error("LOGIN ERROR:", err?.code, err?.message, err);
      const detail =
        err?.customData?._tokenResponse?.error_description ||
        err?.message ||
        String(err);
      alert(`Erro no login\ncode: ${err?.code || "?"}\n${detail}`);
      throw err;
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, hasCompany, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
