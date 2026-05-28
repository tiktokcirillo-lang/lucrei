import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import { auth, googleProvider, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log('Redirect login sucesso:', result.user.uid);
        }
      })
      .catch((error) => {
        console.error('Redirect error:', error);
      });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("UID:", firebaseUser.uid);
        setUser(firebaseUser);
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        setHasCompany(snap.exists() && !!snap.data()?.company);
      } else {
        setUser(null);
        setHasCompany(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = () => {
    return signInWithRedirect(auth, googleProvider);
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, hasCompany, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
