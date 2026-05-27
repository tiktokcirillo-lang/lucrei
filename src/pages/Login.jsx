import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Login() {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/");
  }, [user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 p-10 rounded-2xl flex flex-col items-center gap-6 shadow-xl">
        <h1 className="text-4xl font-bold text-white">Lucrei 💰</h1>
        <p className="text-gray-400 text-center max-w-xs">
          Precifique certo, lucre de verdade.
        </p>
        <button
          onClick={loginWithGoogle}
          className="flex items-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl hover:bg-gray-100 transition"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
          Entrar com Google
        </button>
      </div>
    </div>
  );
}
