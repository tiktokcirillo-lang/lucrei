import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

function getClass(margemReal) {
  if (margemReal >= 40) return "A";
  if (margemReal >= 20) return "B";
  return "C";
}

const CLASS_CONFIG = {
  A: {
    badge: "bg-green-500/20 text-green-400 border border-green-500/30",
    border: "border-green-500/40",
    label: "Classe A",
  },
  B: {
    badge: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    border: "border-yellow-500/40",
    label: "Classe B",
  },
  C: {
    badge: "bg-red-500/20 text-red-400 border border-red-500/30",
    border: "border-red-500/40",
    label: "Classe C",
  },
};

function currency(v) {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const FILTERS = ["Todos", "Classe A", "Classe B", "Classe C"];

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("Todos");

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "users", user.uid, "products"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setProdutos(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user]);

  async function handleDelete(id, name) {
    if (!window.confirm(`Excluir "${name}"? Essa ação não pode ser desfeita.`)) return;
    await deleteDoc(doc(db, "users", user.uid, "products", id));
  }

  const filtered = produtos.filter((p) => {
    if (filtro === "Todos") return true;
    const cls = getClass(p.results?.margemReal ?? 0);
    return filtro === `Classe ${cls}`;
  });

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Meus Produtos</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {loading ? "Carregando..." : `${produtos.length} produto${produtos.length !== 1 ? "s" : ""} cadastrado${produtos.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => navigate("/calculadora")}
            className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition"
          >
            + Novo Produto
          </button>
        </div>

        {/* Filtros */}
        {!loading && produtos.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  filtro === f
                    ? "bg-green-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-gray-500 text-sm">Carregando produtos...</div>
        )}

        {/* Empty state */}
        {!loading && produtos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-white mb-2">Nenhum produto ainda</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">
              Use a calculadora para precificar seu primeiro produto e salvá-lo aqui.
            </p>
            <button
              onClick={() => navigate("/calculadora")}
              className="px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition"
            >
              Ir para a Calculadora
            </button>
          </div>
        )}

        {/* Empty filtered state */}
        {!loading && produtos.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-gray-400 text-sm">Nenhum produto com {filtro} encontrado.</p>
            <button onClick={() => setFiltro("Todos")} className="mt-3 text-green-400 text-sm hover:underline">
              Ver todos
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((produto) => {
              const r = produto.results ?? {};
              const cls = getClass(r.margemReal ?? 0);
              const cfg = CLASS_CONFIG[cls];

              return (
                <div
                  key={produto.id}
                  className={`bg-gray-900 rounded-2xl p-5 border ${cfg.border} flex flex-col gap-4`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-white font-semibold text-base leading-tight flex-1">
                      {produto.name || "Produto sem nome"}
                    </h2>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Preço Sugerido */}
                  <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Preço Sugerido</p>
                    <p className="text-2xl font-bold text-green-400">
                      {currency(r.precoSugerido)}
                    </p>
                  </div>

                  {/* Indicadores */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-800 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">Margem Real</p>
                      <p className="text-sm font-semibold text-white">
                        {r.margemReal != null ? `${r.margemReal.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">Markup</p>
                      <p className="text-sm font-semibold text-white">
                        {r.markup != null ? `${r.markup.toFixed(2)}x` : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded-lg px-3 py-2 col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Margem de Contribuição</p>
                      <p className="text-sm font-semibold text-white">
                        {currency(r.margemContribuicao)}
                      </p>
                    </div>
                  </div>

                  {/* Data */}
                  <p className="text-xs text-gray-600">
                    Salvo em {formatDate(produto.createdAt)}
                  </p>

                  {/* Ações */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/calculadora?id=${produto.id}`)}
                      className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(produto.id, produto.name)}
                      className="flex-1 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
