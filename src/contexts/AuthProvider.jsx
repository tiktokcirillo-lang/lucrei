import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, googleProvider, db } from "../lib/firebase";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [error, setError] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    let unsubscribeFromUser = null;

    const unsubscribeFromAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setError(false);
      unsubscribeFromUser?.();
      unsubscribeFromUser = null;

      if (!firebaseUser) {
        setUser(null);
        setHasCompany(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setHasCompany(false);
      setUser(firebaseUser);
      unsubscribeFromUser = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snapshot) => {
          setHasCompany(snapshot.exists() && Boolean(snapshot.data()?.company));
          setLoading(false);
        },
        () => {
          setError(true);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeFromAuth();
      unsubscribeFromUser?.();
    };
  }, []);

  if (error) return <div role="alert" className="p-8 text-red-400">Não foi possível carregar sua conta. <button onClick={() => window.location.reload()}>Tentar novamente</button></div>;

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, hasCompany, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
