import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
  { icon: "🏠", label: "Dashboard", path: "/" },
  { icon: "🧮", label: "Calculadora", path: "/calculadora" },
  { icon: "📦", label: "Produtos", path: "/produtos" },
  { icon: "📊", label: "DRE", path: "/dre" },
  { icon: "🎯", label: "Simulador", path: "/simulador" },
  { icon: "🎓", label: "Academia", path: "/academia" },
];

function NavItem({ item, compact }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) =>
        compact
          ? `flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium transition ${
              isActive ? "text-green-400" : "text-gray-500"
            }`
          : `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition ${
              isActive
                ? "bg-green-500/10 text-green-400"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`
      }
    >
      <span className={compact ? "text-xl leading-none" : "text-base"}>{item.icon}</span>
      {!compact && item.label}
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
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top header */}
      <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
        <span className="text-white font-bold text-lg">Lucrei 💰</span>
        <div className="flex items-center gap-3">
          {user?.photoURL && (
            <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
          )}
          <span className="text-sm text-gray-300 hidden sm:block max-w-[120px] truncate">
            {user?.displayName?.split(" ")[0]}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="flex flex-1 pt-14">
        {/* Sidebar — desktop only */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-14 bottom-0 w-56 bg-gray-900 border-r border-gray-800 py-3 z-20">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} compact={false} />
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:ml-56 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-gray-900 border-t border-gray-800 flex">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.path} item={item} compact={true} />
        ))}
      </nav>
    </div>
  );
}
