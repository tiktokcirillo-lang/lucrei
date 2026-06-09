import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  Calculator,
  Carrot,
  Package,
  BarChart2,
  Target,
  FileText,
  GraduationCap,
  Settings,
  TrendingUp,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calculator, label: "Calculadora", path: "/calculadora" },
  { icon: Carrot, label: "Ingredientes", path: "/ingredientes" },
  { icon: Package, label: "Produtos", path: "/produtos" },
  { icon: BarChart2, label: "DRE", path: "/dre" },
  { icon: Target, label: "Simulador", path: "/simulador" },
  { icon: FileText, label: "Relatórios", path: "/relatorios" },
  { icon: GraduationCap, label: "Academia", path: "/academia" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

const BOTTOM_NAV = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calculator, label: "Calculadora", path: "/calculadora" },
  { icon: Package, label: "Produtos", path: "/produtos" },
  { icon: BarChart2, label: "DRE", path: "/dre" },
  { icon: Settings, label: "Config", path: "/configuracoes" },
];

function SidebarItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? "text-[#10B981]"
            : "text-[#64748B] hover:bg-[#0F1623] hover:text-[#94A3B8]"
        }`
      }
      style={({ isActive }) =>
        isActive
          ? {
              background: "#0F2820",
              borderLeft: "2px solid #10B981",
              paddingLeft: "10px",
            }
          : {}
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={16}
            strokeWidth={1.75}
            className={isActive ? "text-[#10B981]" : "text-[#475569]"}
          />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function BottomNavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center flex-1 py-2 gap-1 transition-all duration-150 ${
          isActive ? "text-[#10B981]" : "text-[#475569]"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={isActive ? 2 : 1.75} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0D14" }}>
      {/* Sidebar — desktop */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-20"
        style={{
          width: "240px",
          background: "#0A0D14",
          borderRight: "1px solid #1E293B",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <TrendingUp size={20} className="text-green-400" strokeWidth={2} />
          <span className="text-white font-bold text-xl tracking-tight">Lucrei</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.path} item={item} />
          ))}
        </nav>

        {/* User footer */}
        <div
          className="px-3 py-4 mx-2 mb-3 rounded-xl flex items-center gap-3"
          style={{ background: "#0F1623", border: "1px solid #1E293B" }}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user?.displayName?.split(" ")[0] ?? "Usuário"}
            </p>
            <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-all duration-150"
          >
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 lg:ml-[240px] pb-16 lg:pb-0">{children}</main>

      {/* Bottom nav — mobile */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 flex"
        style={{ background: "#0A0D14", borderTop: "1px solid #1E293B" }}
      >
        {BOTTOM_NAV.map((item) => (
          <BottomNavItem key={item.path} item={item} />
        ))}
      </nav>
    </div>
  );
}
