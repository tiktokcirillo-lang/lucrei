import { calculateStatement } from "../lib/business/portfolio";
import { usePortfolio } from "../hooks/usePortfolio";





const FIXED_COST_LABELS = {
  rent: "Aluguel",
  employees: "Funcionários",
  accountant: "Contador",
  energy: "Energia / Água",
  internet: "Internet / Telefone",
  other: "Outros",
};



function currency(v) {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(v) {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(1) + "%";
}

function DreRow({ type, label, value, indent = 0 }) {
  const base = "flex items-center justify-between py-2.5 px-4";

  if (type === "result") {
    return (
      <div className={`${base} bg-[#0A0D14] border border-[#1E293B] rounded-lg my-1`}>
        <span className="text-sm font-bold text-[#F1F5F9]">{label}</span>
        <span className={`text-sm font-bold ${value >= 0 ? "text-[#F1F5F9]" : "text-[#EF4444]"}`}>
          {currency(value)}
        </span>
      </div>
    );
  }

  const textColor =
    type === "income" ? "text-[#10B981]" :
    type === "deduction" ? "text-[#EF4444]" :
    "text-[#475569]";

  return (
    <div
      className={base}
      style={indent ? { paddingLeft: `${1 + indent * 1.5}rem` } : undefined}
    >
      <span className={`text-sm ${textColor}`}>{label}</span>
      {value != null && (
        <span className={`text-sm font-medium ${textColor}`}>{currency(value)}</span>
      )}
    </div>
  );
}

export default function DRE() {


  const { produtos, company, loading, error } = usePortfolio();
  const fixedCosts = company.fixedCosts ?? {};




  const dre = calculateStatement(produtos, company);


  const marginBadge =
    dre.margemLiquida == null ? null :
    dre.margemLiquida > 20 ? "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30" :
    dre.margemLiquida >= 10 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
    "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30";



  if (error) return <div role="alert" className="p-8 text-red-400">{error} <a className="underline" href="/produtos">Ver produtos</a><button className="ml-4 underline" onClick={() => window.location.reload()}>Tentar novamente</button></div>;
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060A12] flex items-center justify-center">
        <p className="text-[#475569] text-sm">Carregando DRE...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#060A12] p-4 md:p-8 min-h-screen">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#F1F5F9]">DRE</h1>
            <p className="text-[#64748B] text-sm mt-1">Projeção do resultado mensal</p>
          </div>
          <div className="relative group">
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-[#0A0D14] border border-[#1E293B] text-[#64748B] text-sm font-medium cursor-not-allowed select-none transition-all duration-150"
            >
              Exportar PDF
            </button>
            <span className="absolute right-0 top-10 bg-[#0F1623] border border-[#1E293B] text-[#94A3B8] text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
              Em breve
            </span>
          </div>
        </div>

        <p className="text-slate-400 mb-6">Projeção mensal com preços sugeridos e volumes estimados. Não representa vendas realizadas.</p>
        {/* DRE table */}
        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-3 mb-6">
          <DreRow type="income" label="(+) Receita Bruta" value={dre.receitaBruta} />
          <DreRow type="deduction" label="(-) Deduções Fiscais" value={dre.deducoesFiscais} />
          <DreRow type="result" label="(=) Receita Líquida" value={dre.receitaLiquida} />

          <div className="my-2" />

          <DreRow type="deduction" label="(-) CMV Total" value={dre.cmvTotal} />
          <DreRow type="result" label="(=) Lucro Bruto" value={dre.lucroBruto} />

          <div className="my-2" />

          <DreRow type="deduction" label="(-) Despesas Operacionais" value={dre.despesasOp} />
          {Object.entries(fixedCosts)
            .filter(([, v]) => v > 0)
            .map(([key, val]) => (
              <DreRow
                key={key}
                type="sub"
                label={FIXED_COST_LABELS[key] ?? key}
                value={val}
                indent={1}
              />
            ))}

          <DreRow type="deduction" label="(-) Custos Variáveis Totais" value={dre.custosVariaveisTotal} />

          <div className="my-2" />

          <DreRow type="result" label="(=) Resultado Operacional Estimado" value={dre.lucroLiquido} />

          {marginBadge && (
            <div className="flex items-center justify-between px-4 pt-3 pb-1 border-t border-[#1E293B] mt-2">
              <span className="text-sm text-[#64748B]">(%) Margem Operacional Estimada</span>
              <span className={`text-sm font-bold px-3 py-0.5 rounded-full border ${marginBadge}`}>
                {pct(dre.margemLiquida)}
              </span>
            </div>
          )}
        </div>

        {/* Summary card */}
        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <p className="text-xs text-[#64748B] mb-1">Ponto de Equilíbrio (R$)</p>
            <p className="text-xl font-bold text-[#F1F5F9]">
              {dre.peReais != null ? currency(dre.peReais) : "—"}
            </p>
            <p className="text-xs text-[#475569] mt-0.5">receita mínima mensal</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-1">Ponto de Equilíbrio (un)</p>
            <p className="text-xl font-bold text-[#F1F5F9]">
              {dre.peUnidades != null ? `${dre.peUnidades} un` : "—"}
            </p>
            <p className="text-xs text-[#475569] mt-0.5">unidades mínimas/mês</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-1">Resultado operacional estimado</p>
            <p className={`text-xl font-bold ${dre.lucroLiquido >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
              {currency(dre.lucroLiquido)}
            </p>
            <p className="text-xs text-[#475569] mt-0.5">após impostos sobre vendas e custos</p>
          </div>
        </div>

      </div>
    </div>
  );
}
