import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { TrendingUp, Check } from "lucide-react";

const BENEFITS = [
  "Calculadora profissional de preços",
  "DRE e relatórios automáticos",
  "IA que lê seus cupons fiscais",
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function Login() {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Left panel — desktop only */}
      <div
        className="hidden lg:flex flex-col justify-between w-[55%] p-12"
        style={{ background: "linear-gradient(160deg, #0A0D14 0%, #0F1F2E 50%, #0A0D14 100%)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <TrendingUp size={20} className="text-green-400" />
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">Lucrei</span>
        </div>

        {/* Main copy */}
        <div className="max-w-md">
          <h1
            className="font-bold text-white leading-tight mb-6"
            style={{ fontSize: "48px", letterSpacing: "-1px" }}
          >
            Precifique com inteligência.{" "}
            <span className="text-green-400">Lucre com consistência.</span>
          </h1>
          <ul className="flex flex-col gap-4">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-green-400" strokeWidth={3} />
                </div>
                <span className="text-slate-300 text-[15px]">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-slate-600 text-sm">
          Usado por empreendedores em todo o Brasil
        </p>
      </div>

      {/* Right panel — login form */}
      <div
        className="flex flex-1 items-center justify-center p-6"
        style={{ background: "#0F1623" }}
      >
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <TrendingUp size={18} className="text-green-400" />
            </div>
            <span className="text-white font-bold text-xl">Lucrei</span>
          </div>

          <div
            className="rounded-2xl p-8"
            style={{ background: "#131C2B", border: "1px solid #1E293B" }}
          >
            <h2
              className="font-bold text-white mb-2"
              style={{ fontSize: "28px", letterSpacing: "-0.5px" }}
            >
              Bem-vindo
            </h2>
            <p className="text-slate-400 text-sm mb-8">
              Entre com sua conta Google para começar
            </p>

            <button
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold text-slate-200 transition-all duration-150"
              style={{
                background: "#0F1623",
                border: "1px solid #1E293B",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#10B981";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1E293B";
                e.currentTarget.style.color = "#e2e8f0";
              }}
            >
              <GoogleIcon />
              Continuar com Google
            </button>

            <p className="text-center text-slate-600 text-xs mt-6">
              Gratuito para sempre&nbsp;•&nbsp;Seus dados protegidos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
