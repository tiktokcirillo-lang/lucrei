import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Calculadora from "./pages/Calculadora";
import Produtos from "./pages/Produtos";
import DRE from "./pages/DRE";
import Simulador from "./pages/Simulador";
import Relatorios from "./pages/Relatorios";
import Academia from "./pages/Academia";

function Placeholder({ label }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 text-sm">{label} — em breve</p>
    </div>
  );
}

function PrivateLayout() {
  return (
    <PrivateRoute>
      <Layout>
        <Outlet />
      </Layout>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<PrivateLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calculadora" element={<Calculadora />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/dre" element={<DRE />} />
            <Route path="/simulador" element={<Simulador />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/academia" element={<Academia />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
