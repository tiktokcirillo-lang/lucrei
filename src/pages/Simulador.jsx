import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
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
    <div className="flex items-center justify-between py-2.5 px-4 bg-gray-800 rounded-lg">
      <span className="text-sm text-gray-400">{label}</span>
      <span
        className={`text-sm font-semibold ${
          warn ? "text-red-400" : highlight ? "text-green-400" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RInput({ prefix, value, onChange, placeholder = "0,00" }) {
  return (
    <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
      {prefix && <span className="px-3 text-gray-500 text-sm select-none">{prefix}</span>}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-white py-2.5 px-3 outline-none placeholder-gray-600 text-sm"
      />
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
        <div className="bg-gray-900 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Produto
          </h3>
          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-500"
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
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Percentual de desconto
            </h3>
            <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
              <input
                type="number"
                min="0"
                max="60"
                value={desconto}
                onChange={(e) =>
                  setDesconto(Math.min(60, Math.max(0, n(e.target.value))))
                }
                className="w-14 bg-transparent text-white text-sm text-right py-1.5 pl-3 outline-none"
              />
              <span className="px-2 text-gray-500 text-sm">%</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={desconto}
            onChange={(e) => setDesconto(Number(e.target.value))}
            className="w-full accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0%</span>
            <span>30%</span>
            <span>60%</span>
          </div>
        </div>
      </div>

      <div className="lg:w-80">
        <div className="bg-gray-900 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Resultado
          </h3>
          {!produto ? (
            <p className="text-gray-600 text-sm text-center py-6">Selecione um produto</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alerta && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-2">
                  <p className="text-red-400 text-sm font-semibold">Margem crítica</p>
                  <p className="text-red-300/70 text-xs mt-0.5">
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
                  <div className="flex items-center justify-between py-2.5 px-4 bg-gray-800 rounded-lg">
                    <span className="text-sm text-gray-400">Impacto mensal</span>
                    <span
                      className={`text-sm font-bold ${
                        impacto != null && impacto >= 0 ? "text-green-400" : "text-red-400"
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
        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Produtos do Bundle
            </h3>
            <span className="text-xs text-gray-500">{selecionados.length}/3</span>
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
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition ${
                    selected
                      ? "border-green-500 bg-green-500/10"
                      : disabled
                      ? "border-gray-800 bg-gray-800/50 opacity-40 cursor-not-allowed"
                      : "border-gray-700 bg-gray-800 hover:border-gray-500"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      selected ? "text-green-400" : "text-white"
                    }`}
                  >
                    {p.name || "Produto sem nome"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {currency(p.results?.precoSugerido)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selecionados.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Preço do Bundle
            </h3>
            <RInput prefix="R$" value={precoBundle} onChange={setPrecoBundle} />
            <p className="text-xs text-gray-500 mt-2">
              Venda separada: {currency(precosSeparados)}
            </p>
          </div>
        )}
      </div>

      <div className="lg:w-80">
        <div className="bg-gray-900 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Resultado
          </h3>
          {selecionados.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">Selecione até 3 produtos</p>
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
              <div className="border-t border-gray-800 my-1 pt-1">
                <p className="text-xs text-gray-500 px-1 mb-2">Comparativo por transação</p>
                <div className="flex flex-col gap-2">
                  <ResultRow label="Vendendo separado" value={currency(lucroSeparado)} />
                  <ResultRow
                    label="Com bundle"
                    value={bundleMC != null ? currency(bundleMC) : "—"}
                  />
                  {diferenca != null && (
                    <div className="flex items-center justify-between py-2.5 px-4 bg-gray-800 rounded-lg">
                      <span className="text-sm text-gray-400">Diferença</span>
                      <span
                        className={`text-sm font-bold ${
                          diferenca >= 0 ? "text-green-400" : "text-red-400"
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
        <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Configuração
          </h3>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Produto âncora</label>
            <select
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-500"
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
            <label className="block text-sm text-gray-400 mb-1">Custo real do frete</label>
            <RInput prefix="R$" value={custoFrete} onChange={setCustoFrete} />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Valor mínimo do pedido para frete grátis
            </label>
            <RInput prefix="R$" value={minimoFrete} onChange={setMinimoFrete} />
          </div>
        </div>
      </div>

      <div className="lg:w-80">
        <div className="bg-gray-900 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Resultado
          </h3>
          {!produto ? (
            <p className="text-gray-600 text-sm text-center py-6">Selecione um produto âncora</p>
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
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <span className="text-xl shrink-0">{cobreaFrete ? "✅" : "❌"}</span>
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        cobreaFrete ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {cobreaFrete ? "Frete coberto pelo lucro" : "Lucro não cobre o frete"}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        cobreaFrete ? "text-green-300/70" : "text-red-300/70"
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
    <div className="bg-gray-950 p-4 md:p-8 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Simulador de Promoções</h1>
        <p className="text-gray-400 text-sm mb-8">
          Teste cenários antes de tomar decisões comerciais
        </p>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-8 w-fit">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                tab === i ? "bg-green-500 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Carregando produtos...</p>
        ) : produtos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-white font-semibold mb-1">Nenhum produto cadastrado</p>
            <p className="text-gray-400 text-sm">Cadastre produtos na Calculadora primeiro.</p>
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
