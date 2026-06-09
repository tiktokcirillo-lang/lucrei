import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import SummaryCard from "../components/dashboard/SummaryCard";
import { TrendingUp, DollarSign, Percent, Package, BarChart2, AlertTriangle, ClipboardList } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { getMarginClass } from "../lib/business/classification";
import {
  calculateDashboardStats,
  generateAlerts,
  generateChartData,
  getTopProducts,
} from "../lib/business/dashboard";
import { currency } from "../lib/formatters/currency";
import { db } from "../lib/firebase";

const CLASS_BADGE_STYLE = {
  A: { backgroundColor: '#0F2820', color: '#10B981' },
  B: { backgroundColor: '#1C1A0F', color: '#F59E0B' },
  C: { backgroundColor: '#1F0F0F', color: '#EF4444' },
};

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0F1A' }}>
        <p className="text-sm" style={{ color: '#475569' }}>Carregando...</p>
      </div>
    );
  }

  if (!produtos.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: '#0A0F1A' }}>
        <BarChart2 size={48} className="mb-4" style={{ color: '#1E293B' }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: '#F1F5F9' }}>Nenhum dado ainda</h2>
        <p className="text-sm mb-6 max-w-xs" style={{ color: '#475569' }}>
          Cadastre seu primeiro produto na calculadora para ver os indicadores do negócio.
        </p>
        <button
          onClick={() => navigate("/calculadora")}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm transition"
          style={{ backgroundColor: '#10B981', color: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#059669')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#10B981')}
        >
          Ir para a Calculadora
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: '#0A0F1A', minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#F1F5F9' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Visão geral do seu negócio</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Faturamento" value={currency(stats.faturamento)} icon={DollarSign} color="#10B981" />
          <SummaryCard label="Lucro" value={currency(stats.lucro)} icon={TrendingUp} color="#3B82F6" />
          <SummaryCard label="Margem Média" value={`${stats.margemMedia.toFixed(1)}%`} icon={Percent} color="#F59E0B" />
          <SummaryCard label="Produtos" value={String(stats.total)} icon={Package} color="#8B5CF6" />
        </div>

        {/* Alerts */}
        {(alerts.low.length > 0 || alerts.noVol.length > 0) && (
          <div className="flex flex-col gap-3 mb-8">
            {alerts.low.length > 0 && (
              <div className="border rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
                <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Margem crítica</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(252,165,165,0.7)' }}>
                    {alerts.low.map((p) => p.name || "Produto").join(", ")} — margem real abaixo de 10%
                  </p>
                </div>
              </div>
            )}
            {alerts.noVol.length > 0 && (
              <div className="border rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' }}>
                <ClipboardList size={18} className="shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#F59E0B' }}>Volume não informado</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(253,230,138,0.7)' }}>
                    {alerts.noVol.map((p) => p.name || "Produto").join(", ")} — sem volume estimado, faturamento não calculado
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bar chart */}
        {chartData.length > 0 && (
          <div className="rounded-2xl p-5 mb-8" style={{ backgroundColor: '#0F1623' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: '#475569' }}>
              Margem Real por Produto
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 24, left: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  width={38}
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, "Margem Real"]}
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid #10B981',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#94A3B8' }}
                  itemStyle={{ color: '#F1F5F9' }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar
                  dataKey="margem"
                  radius={[4, 4, 0, 0]}
                  fill="#10B981"
                  fillOpacity={0.8}
                  activeBar={{ fill: '#10B981', fillOpacity: 1 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top 5 table */}
        {top5.length > 0 && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#0F1623' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#475569' }}>
              Top 5 por Margem de Contribuição
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B' }}>
                    <th className="text-left py-2 pr-4 font-medium uppercase" style={{ color: '#475569', fontSize: '11px' }}>Produto</th>
                    <th className="text-right py-2 pr-4 font-medium uppercase" style={{ color: '#475569', fontSize: '11px' }}>Preço</th>
                    <th className="text-right py-2 pr-4 font-medium uppercase" style={{ color: '#475569', fontSize: '11px' }}>Margem</th>
                    <th className="text-right py-2 font-medium uppercase" style={{ color: '#475569', fontSize: '11px' }}>Classe</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map((p) => {
                    const r = p.results ?? {};
                    const cls = getMarginClass(r.margemReal ?? 0);
                    return (
                      <tr
                        key={p.id}
                        style={{ borderBottom: '1px solid #1E293B' }}
                        className="transition-colors duration-150"
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0F1623')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td className="py-3 pr-4 font-medium max-w-[140px] truncate" style={{ color: '#F1F5F9' }}>
                          {p.name || "—"}
                        </td>
                        <td className="py-3 pr-4 text-right" style={{ color: '#94A3B8' }}>
                          {currency(r.precoSugerido)}
                        </td>
                        <td className="py-3 pr-4 text-right" style={{ color: '#94A3B8' }}>
                          {r.margemReal != null ? `${r.margemReal.toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={CLASS_BADGE_STYLE[cls]}
                          >
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
