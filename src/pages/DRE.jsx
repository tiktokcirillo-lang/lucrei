import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const YEAR = new Date().getFullYear();
const PERIOD_OPTIONS = [
  ...MONTHS.map((m, i) => ({ label: `${m} ${YEAR}`, value: String(i) })),
  { label: `Anual ${YEAR}`, value: "anual" },
];

const FIXED_COST_LABELS = {
  rent: "Aluguel",
  employees: "Funcionários",
  accountant: "Contador",
  energy: "Energia / Água",
  internet: "Internet / Telefone",
  other: "Outros",
};

function n(v) {
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

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
  const { user } = useAuth();
  const [period, setPeriod] = useState("anual");
  const [produtos, setProdutos] = useState([]);
  const [fixedCosts, setFixedCosts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDocs(collection(db, "users", user.uid, "products")),
      getDoc(doc(db, "users", user.uid)),
    ]).then(([prodSnap, compSnap]) => {
      setProdutos(prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFixedCosts(compSnap.data()?.company?.fixedCosts ?? {});
      setLoading(false);
    });
  }, [user]);

  const dre = useMemo(() => {
    let receitaBruta = 0;
    let deducoesFiscais = 0;
    let cmvTotal = 0;
    let custosVariaveisTotal = 0;

    for (const p of produtos) {
      const r = p.results ?? {};
      const inp = p.inputs ?? {};
      const vol = n(inp.volumeEstimado);
      const preco = r.precoSugerido ?? 0;
      const taxRate = (r.taxRatePct ?? 0) / 100;
      const taxaVariavelPct =
        (n(inp.taxaPlataforma) + n(inp.taxaGateway) + n(inp.provisaoDevolucoes)) / 100;

      receitaBruta += preco * vol;
      deducoesFiscais += preco * taxRate * vol;
      cmvTotal += (r.cmv ?? 0) * vol;
      custosVariaveisTotal += (r.custoVariavelR ?? 0) * vol + preco * taxaVariavelPct * vol;
    }

    const receitaLiquida = receitaBruta - deducoesFiscais;
    const lucroBruto = receitaLiquida - cmvTotal;
    const despesasOp = Object.values(fixedCosts).reduce((a, b) => a + (b || 0), 0);
    const lucroLiquido = lucroBruto - despesasOp - custosVariaveisTotal;
    const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : null;
    const ebitda = lucroLiquido + deducoesFiscais;

    const contribTotal = receitaBruta - cmvTotal - custosVariaveisTotal - deducoesFiscais;
    const mcRatio = receitaBruta > 0 ? contribTotal / receitaBruta : 0;
    const peReais = mcRatio > 0 ? despesasOp / mcRatio : null;
    const totalVol = produtos.reduce((a, p) => a + n(p.inputs?.volumeEstimado), 0);
    const precoMedio = totalVol > 0 ? receitaBruta / totalVol : null;
    const peUnidades = peReais != null && precoMedio ? Math.ceil(peReais / precoMedio) : null;

    return {
      receitaBruta, deducoesFiscais, receitaLiquida,
      cmvTotal, lucroBruto,
      despesasOp, custosVariaveisTotal,
      lucroLiquido, margemLiquida,
      ebitda, peReais, peUnidades,
    };
  }, [produtos, fixedCosts]);

  const marginBadge =
    dre.margemLiquida == null ? null :
    dre.margemLiquida > 20 ? "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30" :
    dre.margemLiquida >= 10 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
    "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30";

  const selectedLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "";

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
            <p className="text-[#64748B] text-sm mt-1">Demonstração do Resultado do Exercício</p>
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

        {/* Period selector */}
        <div className="flex items-center gap-3 mb-6">
          <label className="text-xs font-medium text-[#64748B] uppercase tracking-wide shrink-0">Período</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-[#0A0D14] border border-[#1E293B] text-[#F1F5F9] text-sm rounded-lg px-3 py-2 outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all duration-150"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-xs text-[#475569] hidden sm:block">Exibindo: {selectedLabel}</span>
        </div>

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

          <DreRow type="result" label="(=) Lucro Líquido" value={dre.lucroLiquido} />

          {marginBadge && (
            <div className="flex items-center justify-between px-4 pt-3 pb-1 border-t border-[#1E293B] mt-2">
              <span className="text-sm text-[#64748B]">(%) Margem Líquida</span>
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
            <p className="text-xs text-[#64748B] mb-1">EBITDA Estimado</p>
            <p className={`text-xl font-bold ${dre.ebitda >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
              {currency(dre.ebitda)}
            </p>
            <p className="text-xs text-[#475569] mt-0.5">antes de impostos</p>
          </div>
        </div>

      </div>
    </div>
  );
}
