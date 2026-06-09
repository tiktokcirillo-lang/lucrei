import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { CheckCircle2, XCircle, Target } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

const TABS = ["Desconto", "Bundle", "Frete Grátis"];

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

function ResultRow({ label, value, highlight, warn }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-4 bg-[#0A0D14] border border-[#1E293B] rounded-lg">
      <span className="text-sm text-[#64748B]">{label}</span>
      <span
        className={`text-sm font-semibold ${
          warn ? "text-[#EF4444]" : highlight ? "text-[#10B981]" : "text-[#F1F5F9]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RInput({ prefix, value, onChange, placeholder = "0,00" }) {
  return (
    <div className="flex items-center bg-[#0A0D14] border border-[#1E293B] rounded-lg overflow-hidden focus-within:border-[#10B981] focus-within:ring-1 focus-within:ring-[#10B981] transition-all duration-150">
      {prefix && <span className="px-3 text-[#475569] text-sm select-none">{prefix}</span>}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[#F1F5F9] py-2.5 px-3 outline-none placeholder-[#334155] text-sm"
      />
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 bg-[#10B981] rounded-full" />
      <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">{title}</h3>
    </div>
  );
}

// ─── Tab 1 — Desconto ───────────────────────────────────────────────────────

function TabDesconto({ produtos }) {
  const [produtoId, setProdutoId] = useState("");
  const [desconto, setDesconto] = useState(10);

  const produto = produtos.find((p) => p.id === produtoId);
  const r = produto?.results ?? {};
  const inp = produto?.inputs ?? {};

  const taxRate = (r.taxRatePct ?? 0) / 100;
  const taxaVariavelPct =
    (n(inp.taxaPlataforma) + n(inp.taxaGateway) + n(inp.provisaoDevolucoes)) / 100;
  const precoComDesconto = (r.precoSugerido ?? 0) * (1 - desconto / 100);
  const novaMC = produto
    ? precoComDesconto * (1 - taxRate - taxaVariavelPct) - (r.cmv ?? 0) - (r.custoVariavelR ?? 0)
    : null;
  const novaMargemPct =
    produto && precoComDesconto > 0 ? (novaMC / precoComDesconto) * 100 : null;
  const vol = n(inp.volumeEstimado);
  const lucroOriginal = (r.margemContribuicao ?? 0) * vol;
  const novoLucro = novaMC != null ? novaMC * vol : null;
  const impacto = novoLucro != null ? novoLucro - lucroOriginal : null;
  const alerta = novaMargemPct != null && novaMargemPct < 10;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 flex flex-col gap-5">
        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5">
          <SectionHeader title="Produto" />
          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            className="w-full bg-[#0A0D14] border border-[#1E293B] text-[#F1F5F9] text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all duration-150"
          >
            <option value="">Selecione um produto...</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Produto sem nome"}
              </option>
            ))}
          </select>

          {produto && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "Preço atual", value: currency(r.precoSugerido) },
                { label: "Margem atual", value: pct(r.margemReal) },
                { label: "MC atual", value: currency(r.margemContribuicao) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#0A0D14] border border-[#1E293B] rounded-lg p-3">
                  <p className="text-xs text-[#475569] mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-[#F1F5F9]">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#10B981] rounded-full" />
              <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
                Percentual de desconto
              </h3>
            </div>
            <div className="flex items-center bg-[#0A0D14] border border-[#1E293B] rounded-lg overflow-hidden focus-within:border-[#10B981] focus-within:ring-1 focus-within:ring-[#10B981] transition-all duration-150">
              <input
                type="number"
                min="0"
                max="60"
                value={desconto}
                onChange={(e) =>
                  setDesconto(Math.min(60, Math.max(0, n(e.target.value))))
                }
                className="w-14 bg-transparent text-[#F1F5F9] text-sm text-right py-1.5 pl-3 outline-none"
              />
              <span className="px-2 text-[#475569] text-sm">%</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={desconto}
            onChange={(e) => setDesconto(Number(e.target.value))}
            className="w-full accent-[#10B981]"
          />
          <div className="flex justify-between text-xs text-[#334155] mt-1">
            <span>0%</span>
            <span>30%</span>
            <span>60%</span>
          </div>
        </div>
      </div>

      <div className="lg:w-80">
        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5">
          <SectionHeader title="Resultado" />
          {!produto ? (
            <p className="text-[#334155] text-sm text-center py-6">Selecione um produto</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alerta && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 mb-2">
                  <p className="text-[#EF4444] text-sm font-semibold">Margem crítica</p>
                  <p className="text-[#EF4444]/70 text-xs mt-0.5">
                    Nova margem abaixo de 10% — risco de prejuízo
                  </p>
                </div>
              )}
              <ResultRow
                label="Preço com desconto"
                value={currency(precoComDesconto)}
                highlight
              />
              <ResultRow
                label="Nova margem real"
                value={pct(novaMargemPct)}
                warn={alerta}
              />
              <ResultRow
                label="Nova MC unitária"
                value={currency(novaMC)}
                warn={novaMC != null && novaMC < 0}
              />
              {vol > 0 && (
                <>
                  <ResultRow label="Lucro mensal original" value={currency(lucroOriginal)} />
                  <ResultRow
                    label="Novo lucro mensal"
                    value={currency(novoLucro)}
                    warn={novoLucro != null && novoLucro < 0}
                  />
                  <div className="flex items-center justify-between py-2.5 px-4 bg-[#0A0D14] border border-[#1E293B] rounded-lg">
                    <span className="text-sm text-[#64748B]">Impacto mensal</span>
                    <span
                      className={`text-sm font-bold ${
                        impacto != null && impacto >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                      }`}
                    >
                      {impacto != null
                        ? `${impacto >= 0 ? "+" : ""}${currency(impacto)}`
                        : "—"}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2 — Bundle ─────────────────────────────────────────────────────────

function TabBundle({ produtos }) {
  const [selecionados, setSelecionados] = useState([]);
  const [precoBundle, setPrecoBundle] = useState("");

  function toggleProduto(id) {
    setSelecionados((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const produtosBundle = selecionados
    .map((id) => produtos.find((p) => p.id === id))
    .filter(Boolean);

  const bundleCMV = produtosBundle.reduce((a, p) => a + (p.results?.cmv ?? 0), 0);
  const bundleCTU = produtosBundle.reduce((a, p) => a + (p.results?.ctu ?? 0), 0);
  const bundleVariavel = produtosBundle.reduce(
    (a, p) => a + (p.results?.cmv ?? 0) + (p.results?.custoVariavelR ?? 0),
    0
  );
  const preco = n(precoBundle);
  const bundleMargemPct = preco > 0 ? ((preco - bundleCTU) / preco) * 100 : null;
  const bundleMC = preco > 0 ? preco - bundleVariavel : null;
  const precosSeparados = produtosBundle.reduce(
    (a, p) => a + (p.results?.precoSugerido ?? 0),
    0
  );
  const lucroSeparado = produtosBundle.reduce(
    (a, p) => a + (p.results?.margemContribuicao ?? 0),
    0
  );
  const diferenca = bundleMC != null ? bundleMC - lucroSeparado : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 flex flex-col gap-5">
        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-[#10B981] rounded-full" />
              <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
                Produtos do Bundle
              </h3>
            </div>
            <span className="text-xs text-[#475569]">{selecionados.length}/3</span>
          </div>
          <div className="flex flex-col gap-2">
            {produtos.map((p) => {
              const selected = selecionados.includes(p.id);
              const disabled = !selected && selecionados.length >= 3;
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProduto(p.id)}
                  disabled={disabled}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                    selected
                      ? "border-[#10B981] bg-[#10B981]/10"
                      : disabled
                      ? "border-[#1E293B] bg-[#0A0D14]/50 opacity-40 cursor-not-allowed"
                      : "border-[#1E293B] bg-[#0A0D14] hover:border-[#10B981] hover:text-[#10B981]"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      selected ? "text-[#10B981]" : "text-[#F1F5F9]"
                    }`}
                  >
                    {p.name || "Produto sem nome"}
                  </span>
                  <span className="text-xs text-[#64748B]">
                    {currency(p.results?.precoSugerido)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selecionados.length > 0 && (
          <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5">
            <SectionHeader title="Preço do Bundle" />
            <RInput prefix="R$" value={precoBundle} onChange={setPrecoBundle} />
            <p className="text-xs text-[#475569] mt-2">
              Venda separada: {currency(precosSeparados)}
            </p>
          </div>
        )}
      </div>

      <div className="lg:w-80">
        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5">
          <SectionHeader title="Resultado" />
          {selecionados.length === 0 ? (
            <p className="text-[#334155] text-sm text-center py-6">Selecione até 3 produtos</p>
          ) : (
            <div className="flex flex-col gap-2">
              <ResultRow label="CMV total do bundle" value={currency(bundleCMV)} />
              <ResultRow
                label="Margem do bundle"
                value={bundleMargemPct != null ? pct(bundleMargemPct) : "—"}
                warn={bundleMargemPct != null && bundleMargemPct < 10}
              />
              <ResultRow
                label="MC do bundle"
                value={bundleMC != null ? currency(bundleMC) : "—"}
                highlight={bundleMC != null && bundleMC > 0}
              />
              <div className="border-t border-[#1E293B] my-1 pt-1">
                <p className="text-xs text-[#475569] px-1 mb-2">Comparativo por transação</p>
                <div className="flex flex-col gap-2">
                  <ResultRow label="Vendendo separado" value={currency(lucroSeparado)} />
                  <ResultRow
                    label="Com bundle"
                    value={bundleMC != null ? currency(bundleMC) : "—"}
                  />
                  {diferenca != null && (
                    <div className="flex items-center justify-between py-2.5 px-4 bg-[#0A0D14] border border-[#1E293B] rounded-lg">
                      <span className="text-sm text-[#64748B]">Diferença</span>
                      <span
                        className={`text-sm font-bold ${
                          diferenca >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                        }`}
                      >
                        {diferenca >= 0 ? "+" : ""}
                        {currency(diferenca)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3 — Frete Grátis ───────────────────────────────────────────────────

function TabFreteGratis({ produtos }) {
  const [produtoId, setProdutoId] = useState("");
  const [custoFrete, setCustoFrete] = useState("");
  const [minimoFrete, setMinimoFrete] = useState("");

  const produto = produtos.find((p) => p.id === produtoId);
  const preco = produto?.results?.precoSugerido ?? 0;
  const mc = produto?.results?.margemContribuicao ?? 0;
  const custoF = n(custoFrete);
  const minimoF = n(minimoFrete);

  const totalUnidades = preco > 0 && minimoF > 0 ? Math.ceil(minimoF / preco) : null;
  const unidadesExtras = totalUnidades != null ? Math.max(0, totalUnidades - 1) : null;
  const lucroExtra = unidadesExtras != null ? mc * unidadesExtras : null;
  const cobreaFrete = lucroExtra != null && custoF > 0 ? lucroExtra >= custoF : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1">
        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5 flex flex-col gap-4">
          <SectionHeader title="Configuração" />

          <div>
            <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">
              Produto âncora
            </label>
            <select
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="w-full bg-[#0A0D14] border border-[#1E293B] text-[#F1F5F9] text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all duration-150"
            >
              <option value="">Selecione um produto...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || "Produto sem nome"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">
              Custo real do frete
            </label>
            <RInput prefix="R$" value={custoFrete} onChange={setCustoFrete} />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">
              Valor mínimo para frete grátis
            </label>
            <RInput prefix="R$" value={minimoFrete} onChange={setMinimoFrete} />
          </div>
        </div>
      </div>

      <div className="lg:w-80">
        <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-5">
          <SectionHeader title="Resultado" />
          {!produto ? (
            <p className="text-[#334155] text-sm text-center py-6">Selecione um produto âncora</p>
          ) : (
            <div className="flex flex-col gap-2">
              <ResultRow label="Preço do produto âncora" value={currency(preco)} />
              <ResultRow
                label="Unidades extras necessárias"
                value={unidadesExtras != null ? `${unidadesExtras} un` : "—"}
              />
              <ResultRow
                label="Lucro extra gerado"
                value={lucroExtra != null ? currency(lucroExtra) : "—"}
                highlight={lucroExtra != null && lucroExtra > 0}
              />
              <ResultRow
                label="Custo do frete"
                value={custoF > 0 ? currency(custoF) : "—"}
              />

              {cobreaFrete != null && (
                <div
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border mt-1 ${
                    cobreaFrete
                      ? "bg-[#10B981]/10 border-[#10B981]/30"
                      : "bg-[#EF4444]/10 border-[#EF4444]/30"
                  }`}
                >
                  {cobreaFrete
                    ? <CheckCircle2 size={20} className="shrink-0 mt-0.5 text-[#10B981]" />
                    : <XCircle size={20} className="shrink-0 mt-0.5 text-[#EF4444]" />
                  }
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        cobreaFrete ? "text-[#10B981]" : "text-[#EF4444]"
                      }`}
                    >
                      {cobreaFrete ? "Frete coberto pelo lucro" : "Lucro não cobre o frete"}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        cobreaFrete ? "text-[#10B981]/70" : "text-[#EF4444]/70"
                      }`}
                    >
                      {cobreaFrete
                        ? `Sobra ${currency((lucroExtra ?? 0) - custoF)} após cobrir o frete`
                        : `Falta ${currency(custoF - (lucroExtra ?? 0))} para cobrir o frete`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Simulador() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, "users", user.uid, "products")).then((snap) => {
      setProdutos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  return (
    <div className="bg-[#060A12] p-4 md:p-8 min-h-screen">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Simulador de Promoções</h1>
          <p className="text-[#64748B] text-sm mt-1">Teste cenários antes de tomar decisões</p>
        </div>

        {/* Tabs — pill style igual aos filtros de Produtos */}
        <div className="flex gap-2 mb-8">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all duration-150 ${
                tab === i
                  ? "bg-[#10B981] text-white"
                  : "bg-[#0F1623] border border-[#1E293B] text-[#64748B] hover:border-[#10B981] hover:text-[#10B981]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-[#475569] text-sm">Carregando produtos...</p>
        ) : produtos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-[#0F1623] border border-[#1E293B] rounded-2xl flex items-center justify-center mb-4">
              <Target size={28} className="text-[#334155]" />
            </div>
            <p className="text-[#94A3B8] font-semibold mb-1">Nenhum produto cadastrado</p>
            <p className="text-[#475569] text-sm">Cadastre produtos na Calculadora primeiro.</p>
          </div>
        ) : (
          <>
            {tab === 0 && <TabDesconto produtos={produtos} />}
            {tab === 1 && <TabBundle produtos={produtos} />}
            {tab === 2 && <TabFreteGratis produtos={produtos} />}
          </>
        )}
      </div>
    </div>
  );
}
