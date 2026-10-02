import { lazy, Suspense } from "react";
import { useLocation, BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthProvider";
import { useAuth } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";

function OnboardingGuard({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return children;
}

const Conta = lazy(() => import("./pages/Conta"));
const Legal = lazy(() => import("./pages/Legal"));

const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Calculadora = lazy(() => import("./pages/Calculadora"));
const Produtos = lazy(() => import("./pages/Produtos"));
const DRE = lazy(() => import("./pages/DRE"));
const Simulador = lazy(() => import("./pages/Simulador"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Academia = lazy(() => import("./pages/Academia"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Ingredientes = lazy(() => import("./pages/Ingredientes"));

const Fallback = (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="text-green-500 text-xl animate-pulse">Carregando...</div>
  </div>
);

function PrivateLayout() {
  return (
    <PrivateRoute>
      <Layout>
        <Outlet />
      </Layout>
    </PrivateRoute>
  );
}

function CalculatorRoute() {
  const location = useLocation();
  return <Calculadora key={location.search} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={Fallback}>
          <Routes>
            <Route path="/conta" element={<OnboardingGuard><Layout><Conta /></Layout></OnboardingGuard>} />
            <Route path="/privacidade" element={<Legal kind="privacy" />} />
            <Route path="/termos" element={<Legal kind="terms" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<OnboardingGuard><Onboarding /></OnboardingGuard>} />
            <Route element={<PrivateLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calculadora" element={<CalculatorRoute />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/dre" element={<DRE />} />
              <Route path="/simulador" element={<Simulador />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/academia" element={<Academia />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/ingredientes" element={<Ingredientes />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
