import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

function getClass(margemReal) {
  if (margemReal >= 40) return "A";
  if (margemReal >= 20) return "B";
  return "C";
}

function formatCurrency(v) {
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
  const [filter, setFilter] = useState("Todos");

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
    if (filter === "Todos") return true;
    const r = p.results ?? {};
    const cls = getClass(r.margemReal ?? 0);
    return filter === `Classe ${cls}`;
  });

  return (
    <div className="min-h-screen bg-[#060A12] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F1F5F9]">Produtos</h1>
            <p className="text-[#64748B] text-sm mt-1">
              {loading
                ? "Carregando..."
                : `${produtos.length} produto${produtos.length !== 1 ? "s" : ""} cadastrado${produtos.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => navigate("/calculadora")}
            className="flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 text-sm"
          >
            <Plus size={16} />
            Novo Produto
          </button>
        </div>

        {/* Filtros */}
        {!loading && produtos.length > 0 && (
          <div className="flex gap-2 mb-6">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all duration-150 ${
                  filter === f
                    ? "bg-[#10B981] text-white"
                    : "bg-[#0F1623] border border-[#1E293B] text-[#64748B] hover:border-[#10B981] hover:text-[#10B981]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-[#475569] text-sm">Carregando produtos...</div>
        )}

        {/* Empty state */}
        {!loading && produtos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-[#0F1623] border border-[#1E293B] rounded-2xl flex items-center justify-center mb-4">
              <Package size={28} className="text-[#334155]" />
            </div>
            <h3 className="text-[#94A3B8] font-semibold mb-1">Nenhum produto ainda</h3>
            <p className="text-[#475569] text-sm mb-6">Precifique seu primeiro produto e salve aqui</p>
            <button
              onClick={() => navigate("/calculadora")}
              className="flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-150 text-sm"
            >
              <Plus size={16} />
              Calcular primeiro produto
            </button>
          </div>
        )}

        {/* Empty filtered state */}
        {!loading && produtos.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[#475569] text-sm">Nenhum produto com {filter} encontrado.</p>
            <button onClick={() => setFilter("Todos")} className="mt-3 text-[#10B981] text-sm hover:underline">
              Ver todos
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((produto) => {
              const r = produto.results ?? {};
              const classe = getClass(r.margemReal ?? 0);

              return (
                <div
                  key={produto.id}
                  className="bg-[#0F1623] border border-[#1E293B] rounded-xl overflow-hidden hover:border-[#2D3748] transition-all duration-200 group"
                >
                  {/* Barra de cor por classe ABC */}
                  <div className={`h-1 w-full ${
                    classe === "A" ? "bg-[#10B981]" :
                    classe === "B" ? "bg-[#F59E0B]" :
                    "bg-[#EF4444]"
                  }`} />

                  <div className="p-5">
                    {/* Header do card */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#F1F5F9] truncate">
                          {produto.name || "Produto sem nome"}
                        </h3>
                        <p className="text-xs text-[#475569] mt-0.5">{formatDate(produto.createdAt)}</p>
                      </div>
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
                        classe === "A" ? "bg-[#0F2820] text-[#10B981]" :
                        classe === "B" ? "bg-[#1C1A0F] text-[#F59E0B]" :
                        "bg-[#1F0F0F] text-[#EF4444]"
                      }`}>
                        {classe}
                      </span>
                    </div>

                    {/* Preço em destaque */}
                    <div className="mb-4">
                      <p className="text-xs text-[#475569] uppercase tracking-wide mb-1">Preço Sugerido</p>
                      <p className="text-2xl font-bold text-[#F1F5F9]">{formatCurrency(r.precoSugerido)}</p>
                    </div>

                    {/* Métricas em grid 2x2 */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { label: "Margem", value: r.margemReal != null ? `${r.margemReal.toFixed(1)}%` : "—", color: "#F59E0B" },
                        { label: "Markup", value: r.markup != null ? `${r.markup.toFixed(2)}x` : "—", color: "#3B82F6" },
                        { label: "MC", value: formatCurrency(r.margemContribuicao), color: "#10B981" },
                        { label: "CMV", value: formatCurrency(r.totalCmv ?? r.cmvTotal), color: "#64748B" },
                      ].map((m) => (
                        <div key={m.label} className="bg-[#0A0D14] rounded-lg p-2.5">
                          <p className="text-[10px] text-[#475569] uppercase tracking-wide">{m.label}</p>
                          <p className="text-sm font-semibold mt-0.5" style={{ color: m.color }}>{m.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/calculadora?id=${produto.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#0A0D14] hover:bg-[#1E293B] border border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] text-xs font-medium py-2 rounded-lg transition-all duration-150"
                      >
                        <Pencil size={12} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(produto.id, produto.name)}
                        className="flex items-center justify-center gap-1.5 bg-[#0A0D14] hover:bg-[#1F0F0F] border border-[#1E293B] hover:border-[#EF4444] text-[#475569] hover:text-[#EF4444] text-xs font-medium py-2 px-3 rounded-lg transition-all duration-150"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
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
