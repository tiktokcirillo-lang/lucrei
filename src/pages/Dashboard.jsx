import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart2,
  ClipboardList,
  DollarSign,
  Percent,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import SummaryCard from "../components/dashboard/SummaryCard";
import { usePortfolio } from "../hooks/usePortfolio";
import { calculatePortfolioDashboard } from "../lib/business/dashboard";
import { currency } from "../lib/formatters/currency";

function names(products) {
  return products.map((product) => product.name || "Produto sem nome").join(", ");
}

function Alert({ title, children, danger = false }) {
  const color = danger ? "#EF4444" : "#F59E0B";
  return (
    <div
      className="border rounded-xl px-4 py-3 flex items-start gap-3"
      style={{
        backgroundColor: danger ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
        borderColor: danger ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)",
      }}
    >
      <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color }} />
      <div>
        <p className="text-sm font-semibold" style={{ color }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: danger ? "#FCA5A5" : "#FDE68A" }}>
          {children}
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { rawProducts, company, ingredients, loading, loadError } = usePortfolio();
  const dashboard = useMemo(
    () => calculatePortfolioDashboard({ products: rawProducts, company, ingredients }),
    [rawProducts, company, ingredients]
  );
  const { products, stats, alerts, chartData, topProducts } = dashboard;
  const excluded = useMemo(() => {
    const byId = new Map();
    for (const product of [...alerts.noVolume, ...alerts.incomplete]) {
      byId.set(product.id, product);
    }
    return [...byId.values()];
  }, [alerts]);

  if (loadError) {
    return (
      <div role="alert" className="p-8 text-red-400">
        {loadError}{" "}
        <button className="underline" onClick={() => window.location.reload()}>Tentar novamente</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0F1A" }}>
        <p className="text-sm" style={{ color: "#475569" }}>Carregando...</p>
      </div>
    );
  }

  if (!rawProducts.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: "#0A0F1A" }}>
        <BarChart2 size={48} className="mb-4" style={{ color: "#1E293B" }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: "#F1F5F9" }}>Nenhum dado ainda</h2>
        <p className="text-sm mb-6 max-w-xs" style={{ color: "#64748B" }}>
          Cadastre seu primeiro produto na calculadora para ver os indicadores do negócio.
        </p>
        <button
          onClick={() => navigate("/calculadora")}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm transition"
          style={{ backgroundColor: "#10B981", color: "#fff" }}
        >
          Ir para a Calculadora
        </button>
      </div>
    );
  }

  const resultColor = (stats?.resultadoOperacionalEstimado ?? 0) < 0 ? "#EF4444" : "#3B82F6";

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: "#0A0F1A", minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "#F1F5F9" }}>Dashboard financeiro</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            Projeção mensal recalculada com os dados atuais, preços sugeridos e volumes estimados. Não representa vendas realizadas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Receita estimada" value={currency(stats?.receitaEstimada)} icon={DollarSign} color="#10B981" />
          <SummaryCard label="Margem de contribuição" value={currency(stats?.margemContribuicaoTotal)} icon={TrendingUp} color="#8B5CF6" />
          <SummaryCard label="Resultado operacional" value={currency(stats?.resultadoOperacionalEstimado)} icon={BarChart2} color={resultColor} />
          <SummaryCard
            label="Margem operacional"
            value={stats?.margemOperacionalEstimadaPct == null ? "—" : `${stats.margemOperacionalEstimadaPct.toFixed(1)}%`}
            icon={Percent}
            color={resultColor}
          />
        </div>

        {(alerts.noVolume.length > 0 || alerts.incomplete.length > 0 || alerts.nonPositiveContribution.length > 0 || alerts.negativeOperational.length > 0) && (
          <div className="flex flex-col gap-3 mb-8">
            {alerts.noVolume.length > 0 && (
              <Alert title="Volume não informado">
                {names(alerts.noVolume)} — fora da projeção até que o volume mensal seja informado.
              </Alert>
            )}
            {alerts.incomplete.length > 0 && (
              <Alert title="Cálculo incompleto">
                {names(alerts.incomplete)} — revise os dados na Calculadora.
              </Alert>
            )}
            {alerts.nonPositiveContribution.length > 0 && (
              <Alert title="Margem de contribuição não positiva" danger>
                {names(alerts.nonPositiveContribution)} — o preço não cobre os custos variáveis.
              </Alert>
            )}
            {alerts.negativeOperational.length > 0 && (
              <Alert title="Resultado operacional unitário negativo" danger>
                {names(alerts.negativeOperational)} — o preço não cobre o custo fixo rateado.
              </Alert>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl p-5" style={{ backgroundColor: "#0F1623" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748B" }}>Ponto de equilíbrio em faturamento</p>
            <p className="text-2xl font-bold mt-3" style={{ color: "#F1F5F9" }}>{currency(stats?.pontoEquilibrioFaturamento)}</p>
            <p className="text-xs mt-2" style={{ color: "#64748B" }}>
              Estimativa pelo mix dos {stats?.produtosIncluidos ?? 0} produtos incluídos e pela margem de contribuição consolidada.
            </p>
          </div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: "#0F1623" }}>
            <div className="flex items-center gap-2">
              <ClipboardList size={18} style={{ color: "#F59E0B" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748B" }}>Qualidade dos dados</p>
            </div>
            <p className="text-2xl font-bold mt-3" style={{ color: "#F1F5F9" }}>
              {stats?.produtosIncluidos ?? 0} de {stats?.totalProdutos ?? products.length}
            </p>
            <p className="text-xs mt-2" style={{ color: "#64748B" }}>
              produtos incluídos na projeção{excluded.length ? `; excluídos: ${names(excluded)}.` : "."}
            </p>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="rounded-2xl p-5 mb-8" style={{ backgroundColor: "#0F1623" }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: "#64748B" }}>
              Margem operacional estimada por produto
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 24, left: 0 }}>
                <CartesianGrid stroke="#1E293B" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" width={44} />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Margem operacional estimada"]}
                  contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #10B981", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94A3B8" }}
                  itemStyle={{ color: "#F1F5F9" }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="margem" radius={[4, 4, 0, 0]} fill="#10B981" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {topProducts.length > 0 && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: "#0F1623" }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#64748B" }}>
              Top 5 por contribuição mensal total
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1E293B" }}>
                    <th className="text-left py-2 pr-4 font-medium uppercase text-xs" style={{ color: "#64748B" }}>Produto</th>
                    <th className="text-right py-2 pr-4 font-medium uppercase text-xs" style={{ color: "#64748B" }}>Preço</th>
                    <th className="text-right py-2 pr-4 font-medium uppercase text-xs" style={{ color: "#64748B" }}>Volume</th>
                    <th className="text-right py-2 pr-4 font-medium uppercase text-xs" style={{ color: "#64748B" }}>MC/un.</th>
                    <th className="text-right py-2 font-medium uppercase text-xs" style={{ color: "#64748B" }}>Contribuição total</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product) => {
                    const metrics = product.calculation.metrics;
                    return (
                      <tr key={product.id} style={{ borderBottom: "1px solid #1E293B" }}>
                        <td className="py-3 pr-4 font-medium max-w-[160px] truncate" style={{ color: "#F1F5F9" }}>{product.name || "—"}</td>
                        <td className="py-3 pr-4 text-right" style={{ color: "#94A3B8" }}>{currency(metrics.precoSugerido)}</td>
                        <td className="py-3 pr-4 text-right" style={{ color: "#94A3B8" }}>{Number(product.inputs.volumeEstimado).toLocaleString("pt-BR")}</td>
                        <td className="py-3 pr-4 text-right" style={{ color: "#94A3B8" }}>{currency(metrics.margemContribuicaoUnit)}</td>
                        <td className="py-3 text-right font-semibold" style={{ color: "#10B981" }}>{currency(product.contribuicaoTotal)}</td>
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
