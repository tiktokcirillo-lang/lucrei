import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import SummaryCard from "../components/dashboard/SummaryCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { CLASS_BADGE, getMarginClass } from "../lib/business/classification";
import {
  calculateDashboardStats,
  generateAlerts,
  generateChartData,
  getTopProducts,
} from "../lib/business/dashboard";
import { currency } from "../lib/formatters/currency";
import { db } from "../lib/firebase";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, "users", user.uid, "products"),
      (snap) => {
        setProdutos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [user]);

  const stats = useMemo(() => calculateDashboardStats(produtos), [produtos]);
  const alerts = useMemo(() => generateAlerts(produtos), [produtos]);
  const chartData = useMemo(() => generateChartData(produtos), [produtos]);
  const top5 = useMemo(() => getTopProducts(produtos), [produtos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!produtos.length) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-bold text-white mb-2">Nenhum dado ainda</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Cadastre seu primeiro produto na calculadora para ver os indicadores do negócio.
        </p>
        <button
          onClick={() => navigate("/calculadora")}
          className="px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition"
        >
          Ir para a Calculadora
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-gray-400 text-sm mb-8">Visão geral do seu negócio</p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Faturamento Potencial", value: currency(stats.faturamento), icon: "💰" },
            { label: "Lucro Potencial", value: currency(stats.lucro), icon: "📈" },
            { label: "Margem Média", value: `${stats.margemMedia.toFixed(1)}%`, icon: "🎯" },
            { label: "Produtos Cadastrados", value: String(stats.total), icon: "📦" },
          ].map(({ label, value, icon }) => (
            <SummaryCard key={label} label={label} value={value} icon={icon} />
          ))}
        </div>

        {/* Alerts */}
        {(alerts.low.length > 0 || alerts.noVol.length > 0) && (
          <div className="flex flex-col gap-3 mb-8">
            {alerts.low.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="text-red-400 text-lg shrink-0">⚠️</span>
                <div>
                  <p className="text-red-400 text-sm font-semibold">Margem crítica</p>
                  <p className="text-red-300/70 text-xs mt-0.5">
                    {alerts.low.map((p) => p.name || "Produto").join(", ")} — margem real abaixo de 10%
                  </p>
                </div>
              </div>
            )}
            {alerts.noVol.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="text-yellow-400 text-lg shrink-0">📋</span>
                <div>
                  <p className="text-yellow-400 text-sm font-semibold">Volume não informado</p>
                  <p className="text-yellow-300/70 text-xs mt-0.5">
                    {alerts.noVol.map((p) => p.name || "Produto").join(", ")} — sem volume estimado, faturamento não calculado
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bar chart */}
        {chartData.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
              Margem Real por Produto
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 24, left: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  width={38}
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, "Margem Real"]}
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  itemStyle={{ color: "#f3f4f6" }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="margem" radius={[4, 4, 0, 0]} fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top 5 table */}
        {top5.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Top 5 por Margem de Contribuição
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 pr-4 font-medium">Produto</th>
                    <th className="text-right py-2 pr-4 font-medium">Preço</th>
                    <th className="text-right py-2 pr-4 font-medium">Margem</th>
                    <th className="text-right py-2 font-medium">Classe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {top5.map((p) => {
                    const r = p.results ?? {};
                    const cls = getMarginClass(r.margemReal ?? 0);
                    return (
                      <tr key={p.id}>
                        <td className="py-3 pr-4 text-white font-medium max-w-[140px] truncate">
                          {p.name || "—"}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-300">
                          {currency(r.precoSugerido)}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-300">
                          {r.margemReal != null ? `${r.margemReal.toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CLASS_BADGE[cls]}`}>
                            {cls}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
