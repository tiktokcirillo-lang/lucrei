import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
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
    console.log("Auth getRedirectResult: start");
    getRedirectResult(auth)
      .then((result) => {
        console.log("Auth getRedirectResult: result", {
          hasResult: !!result,
          uid: result?.user?.uid ?? null,
        });
        if (result?.user) {
          alert(`REDIRECT OK: ${result.user.email}`);
          setUser(result.user);
        }
      })
      .catch((error) => {
        console.error("Redirect Error:", error);
        alert(`REDIRECT ERROR: ${error.message}`);
      });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth onAuthStateChanged:", {
        uid: firebaseUser?.uid ?? null,
        email: firebaseUser?.email ?? null,
      });
      if (firebaseUser) {
        alert(`AUTH OK: ${firebaseUser.email}`);
        console.log("UID:", firebaseUser.uid);
        setUser(firebaseUser);
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          alert(`DOC EXISTS: ${snap.exists()}`);
          if (snap.exists()) {
            alert(
              `COMPANY: ${
                snap.data()?.company
                  ? 'SIM'
                  : 'NAO'
              }`
            );
          }
          const hasCompanyValue =
            snap.exists() &&
            !!snap.data()?.company;

          alert(`HAS COMPANY: ${hasCompanyValue}`);
          setHasCompany(hasCompanyValue);
        } catch (error) {
          alert(
            `FIRESTORE ERROR: ${
              error.code || error.message
            }`
          );
          console.error(error);
          setHasCompany(false);
        }
      } else {
        alert('SEM USUARIO');
        setUser(null);
        setHasCompany(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    try {
      if (isIOS || isSafari) {
        console.log("Auth signInWithRedirect: start", {
          isIOS,
          isSafari,
          userAgent: navigator.userAgent,
        });
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/popup-blocked') {
        console.log("Auth signInWithRedirect: popup fallback", {
          errorCode: error.code,
          userAgent: navigator.userAgent,
        });
        await signInWithRedirect(auth, googleProvider);
      }
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
