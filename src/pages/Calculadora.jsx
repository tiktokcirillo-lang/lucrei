import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc, collection, addDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const TAX_RATES = {
  mei: 0.05,
  simples: 0.08,
  presumido: 0.1133,
  real: 0.15,
  unknown: 0.10,
};

const TAX_LABELS = {
  mei: "MEI",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  unknown: "Estimativa padrão",
};

function num(s) {
  const n = parseFloat(String(s).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function currency(v) {
  if (!isFinite(v) || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(v) {
  if (!isFinite(v) || isNaN(v)) return "—";
  return v.toFixed(2) + "%";
}

function RInput({ prefix, value, onChange, placeholder = "0,00" }) {
  return (
    <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
      {prefix && (
        <span className="px-3 text-gray-500 text-sm select-none">{prefix}</span>
      )}
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

function Section({ title, children }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReadonlyRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded-lg">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-green-400" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

function FichaTecnicaModal({ productName, user, onClose, onApply }) {
  const [ingredients, setIngredients] = useState([]);
  const [rendimento, setRendimento] = useState("1");
  const [recipeItems, setRecipeItems] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, "users", user.uid, "ingredients"),
      (snap) => setIngredients(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  function addItem(ing) {
    setRecipeItems((prev) => [
      ...prev,
      {
        _key: Date.now() + Math.random(),
        name: ing.name,
        baseUnit: ing.baseUnit,
        costPerBaseUnit: ing.costPerBaseUnit,
        qty: "",
      },
    ]);
    setShowDropdown(false);
  }

  function removeItem(key) {
    setRecipeItems((prev) => prev.filter((i) => i._key !== key));
  }

  const totalCMV = recipeItems.reduce(
    (sum, item) => sum + (parseFloat(item.qty) || 0) * (item.costPerBaseUnit || 0),
    0
  );
  const rend = parseFloat(rendimento) || 1;
  const cmvPerUnit = rend > 0 ? totalCMV / rend : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-bold text-base truncate pr-3">
            🧪 Ficha Técnica{productName ? ` — ${productName}` : ""}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none transition flex-shrink-0">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Essa receita rende quantas unidades?
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={rendimento}
              onChange={(e) => setRendimento(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500 text-sm"
              placeholder="Ex: 10"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Ingredientes da receita</span>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown((d) => !d)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium transition"
                >
                  + Adicionar
                </button>
                {showDropdown && (
                  <>
                    <div className="fixed inset-0 z-0" onClick={() => setShowDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-10 max-h-48 overflow-y-auto">
                      {ingredients.length === 0 ? (
                        <p className="text-gray-400 text-sm p-4 text-center">
                          Nenhum ingrediente cadastrado
                        </p>
                      ) : (
                        ingredients.map((ing) => (
                          <button
                            key={ing.id}
                            onClick={() => addItem(ing)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-between transition"
                          >
                            <span className="truncate">{ing.name}</span>
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {ing.baseUnit}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {recipeItems.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
                Nenhum ingrediente adicionado à receita
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recipeItems.map((item) => {
                  const itemCost = (parseFloat(item.qty) || 0) * (item.costPerBaseUnit || 0);
                  return (
                    <div key={item._key} className="bg-gray-800 rounded-xl p-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium mb-2 truncate">{item.name}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.qty}
                            onChange={(e) =>
                              setRecipeItems((prev) =>
                                prev.map((i) =>
                                  i._key === item._key ? { ...i, qty: e.target.value } : i
                                )
                              )
                            }
                            className="w-24 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="Qtd"
                          />
                          <span className="text-gray-400 text-xs">{item.baseUnit}</span>
                          <span className="ml-auto text-green-400 text-sm font-semibold">
                            {itemCost > 0 ? currency(itemCost) : "—"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item._key)}
                        className="text-gray-500 hover:text-red-400 transition p-1 flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-gray-800">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm text-gray-400">CMV total da receita</span>
            <span className="text-sm text-white font-semibold">{currency(totalCMV)}</span>
          </div>
          <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 mb-4">
            <span className="text-sm text-green-400 font-medium">CMV por unidade</span>
            <span className="text-xl font-bold text-green-400">{currency(cmvPerUnit)}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition"
            >
              Cancelar
            </button>
            <button
              onClick={() => onApply(cmvPerUnit)}
              disabled={!cmvPerUnit || cmvPerUnit <= 0}
              className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold transition"
            >
              Aplicar à Calculadora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Calculadora() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showFichaTecnica, setShowFichaTecnica] = useState(false);

  const [form, setForm] = useState({
    productName: "",
    insumos: "",
    embalagem: "",
    freteEntrada: "",
    taxaPlataforma: "",
    taxaGateway: "",
    freteSaida: "",
    cac: "",
    provisaoDevolucoes: "",
    volumeEstimado: "",
    taxaImpostosOverride: "",
    margem: "30",
  });

  function setF(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setCompanyData(snap.data().company);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const id = searchParams.get("id");
    if (!id) return;
    getDoc(doc(db, "users", user.uid, "products", id)).then((snap) => {
      if (!snap.exists()) return;
      const inputs = snap.data().inputs;
      if (inputs) setForm(inputs);
      setEditMode(true);
      setEditId(id);
    });
  }, [user]);

  const taxRegime = companyData?.taxRegime || "unknown";
  const defaultTaxRate = TAX_RATES[taxRegime] ?? 0.10;
  const taxRate =
    form.taxaImpostosOverride !== ""
      ? num(form.taxaImpostosOverride) / 100
      : defaultTaxRate;

  const fixedCostsTotal = useMemo(() => {
    if (!companyData?.fixedCosts) return 0;
    return Object.values(companyData.fixedCosts).reduce((a, b) => a + (b || 0), 0);
  }, [companyData]);

  const cmv = num(form.insumos) + num(form.embalagem) + num(form.freteEntrada);
  const custoVariavelR = num(form.freteSaida) + num(form.cac);
  const taxaVariavelPct =
    (num(form.taxaPlataforma) + num(form.taxaGateway) + num(form.provisaoDevolucoes)) / 100;
  const volume = num(form.volumeEstimado);
  const custoFixoUnidade = volume > 0 ? fixedCostsTotal / volume : 0;
  const ctu = cmv + custoVariavelR + custoFixoUnidade;
  const margem = num(form.margem) / 100;

  const denomSugerido = 1 - taxRate - taxaVariavelPct - margem;
  const denomMinimo = 1 - taxRate - taxaVariavelPct;

  const precoSugerido = denomSugerido > 0 && ctu > 0 ? ctu / denomSugerido : null;
  const precoMinimo = denomMinimo > 0 && ctu > 0 ? ctu / denomMinimo : null;

  const margemReal =
    precoSugerido != null
      ? ((precoSugerido - ctu - precoSugerido * taxRate - precoSugerido * taxaVariavelPct) /
          precoSugerido) *
        100
      : null;

  const markup =
    precoSugerido != null && ctu > 0 ? precoSugerido / ctu : null;

  const margemContribuicao =
    precoSugerido != null
      ? precoSugerido * (1 - taxRate - taxaVariavelPct) - cmv - custoVariavelR
      : null;

  const pontoEquilibrio =
    margemContribuicao != null && margemContribuicao > 0
      ? Math.ceil(fixedCostsTotal / margemContribuicao)
      : null;

  const chartData =
    precoSugerido != null
      ? [
          {
            name: "Composição",
            CMV: (cmv / precoSugerido) * 100,
            Variáveis: (custoVariavelR / precoSugerido) * 100,
            Fixos: (custoFixoUnidade / precoSugerido) * 100,
            "Taxas Venda": taxaVariavelPct * 100,
            Impostos: taxRate * 100,
            Lucro: margem * 100,
          },
        ]
      : [];

  const resultPayload = {
    precoMinimo,
    precoSugerido,
    margemReal,
    markup,
    margemContribuicao,
    pontoEquilibrio,
    cmv,
    custoVariavelR,
    custoFixoUnidade,
    ctu,
    taxRatePct: taxRate * 100,
  };

  async function handleSave() {
    if (!precoSugerido) return;
    setSaving(true);
    try {
      if (editMode) {
        await updateDoc(doc(db, "users", user.uid, "products", editId), {
          name: form.productName.trim() || "Produto sem nome",
          inputs: { ...form },
          results: resultPayload,
        });
      } else {
        await addDoc(collection(db, "users", user.uid, "products"), {
          name: form.productName.trim() || "Produto sem nome",
          inputs: { ...form },
          results: resultPayload,
          createdAt: serverTimestamp(),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">
          {editMode ? "Editar Produto" : "Calculadora de Precificação"}
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          {editMode ? "Atualize os dados do produto e salve as alterações" : "Preencha os campos e veja o preço ideal em tempo real"}
        </p>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left — Form */}
          <div className="flex-1 flex flex-col gap-4">
            <Section title="Identificação">
              <Field label="Nome do produto">
                <input
                  type="text"
                  value={form.productName}
                  onChange={(e) => setF("productName", e.target.value)}
                  placeholder="Ex: Bolo de pote 200g"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-600 text-sm"
                />
              </Field>
            </Section>

            <Section title="CMV — Custo da Mercadoria Vendida">
              <Field label="Insumos / Ingredientes">
                <RInput prefix="R$" value={form.insumos} onChange={(v) => setF("insumos", v)} />
              </Field>
              <button
                type="button"
                onClick={() => setShowFichaTecnica(true)}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 font-medium transition w-fit"
              >
                🧪 Montar Ficha Técnica
              </button>
              <Field label="Embalagem">
                <RInput prefix="R$" value={form.embalagem} onChange={(v) => setF("embalagem", v)} />
              </Field>
              <Field label="Frete de entrada">
                <RInput
                  prefix="R$"
                  value={form.freteEntrada}
                  onChange={(v) => setF("freteEntrada", v)}
                />
              </Field>
              <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                <span className="text-sm text-gray-400">Subtotal CMV</span>
                <span className="text-sm font-semibold text-white">{currency(cmv)}</span>
              </div>
            </Section>

            <Section title="Custos Variáveis de Venda">
              <Field label="Taxa da plataforma (Mercado Livre, Shopee...)">
                <RInput
                  prefix="%"
                  value={form.taxaPlataforma}
                  onChange={(v) => setF("taxaPlataforma", v)}
                />
              </Field>
              <Field label="Taxa do gateway de pagamento">
                <RInput
                  prefix="%"
                  value={form.taxaGateway}
                  onChange={(v) => setF("taxaGateway", v)}
                />
              </Field>
              <Field label="Frete de saída (para o cliente)">
                <RInput
                  prefix="R$"
                  value={form.freteSaida}
                  onChange={(v) => setF("freteSaida", v)}
                />
              </Field>
              <Field label="CAC unitário (custo de marketing por unidade)">
                <RInput prefix="R$" value={form.cac} onChange={(v) => setF("cac", v)} />
              </Field>
              <Field label="Provisão para devoluções">
                <RInput
                  prefix="%"
                  value={form.provisaoDevolucoes}
                  onChange={(v) => setF("provisaoDevolucoes", v)}
                />
              </Field>
            </Section>

            <Section title="Custos Fixos Rateados">
              <Field label="Volume estimado de vendas / mês">
                <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.volumeEstimado}
                    onChange={(e) => setF("volumeEstimado", e.target.value)}
                    placeholder="Ex: 100"
                    className="flex-1 bg-transparent text-white py-2.5 px-3 outline-none placeholder-gray-600 text-sm"
                  />
                  <span className="px-3 text-gray-500 text-sm select-none">un</span>
                </div>
              </Field>
              <ReadonlyRow
                label="Custo fixo mensal total"
                value={currency(fixedCostsTotal)}
              />
              <ReadonlyRow
                label="Custo fixo por unidade"
                value={volume > 0 ? currency(custoFixoUnidade) : "—"}
                highlight
              />
            </Section>

            <Section title="Impostos">
              <ReadonlyRow label="Regime tributário" value={TAX_LABELS[taxRegime]} />
              <ReadonlyRow
                label="Alíquota padrão"
                value={`${(defaultTaxRate * 100).toFixed(2)}%`}
              />
              <Field label="Ajuste manual da alíquota (opcional)">
                <RInput
                  prefix="%"
                  value={form.taxaImpostosOverride}
                  onChange={(v) => setF("taxaImpostosOverride", v)}
                  placeholder={`${(defaultTaxRate * 100).toFixed(2)} (padrão)`}
                />
              </Field>
              <p className="text-xs text-gray-500">
                Deixe em branco para usar a alíquota padrão do seu regime.
              </p>
            </Section>

            <Section title="Margem de Lucro">
              <Field label="Margem desejada">
                <RInput
                  prefix="%"
                  value={form.margem}
                  onChange={(v) => setF("margem", v)}
                  placeholder="30"
                />
              </Field>
            </Section>
          </div>

          {/* Right — Results */}
          <div className="w-full lg:w-96 flex flex-col gap-4">
            <div className="bg-gray-900 rounded-2xl p-5 sticky top-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
                Resultados
              </h3>

              {/* Destaque: Preço Sugerido */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 mb-4 text-center">
                <p className="text-xs text-green-400 font-semibold uppercase tracking-wide mb-1">
                  Preço Sugerido
                </p>
                <p className="text-4xl font-bold text-green-400">
                  {precoSugerido != null ? currency(precoSugerido) : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  com {num(form.margem).toFixed(1)}% de margem
                </p>
              </div>

              <div className="flex flex-col divide-y divide-gray-800">
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-400">Preço Mínimo (margem 0)</span>
                  <span className="text-sm font-semibold text-white">
                    {precoMinimo != null ? currency(precoMinimo) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-400">Margem Real</span>
                  <span className="text-sm font-semibold text-white">
                    {margemReal != null ? pct(margemReal) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-400">Markup</span>
                  <span className="text-sm font-semibold text-white">
                    {markup != null ? `${markup.toFixed(2)}x` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-400">Margem de Contribuição</span>
                  <span className="text-sm font-semibold text-white">
                    {margemContribuicao != null ? currency(margemContribuicao) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-400">Ponto de Equilíbrio</span>
                  <span className="text-sm font-semibold text-white">
                    {pontoEquilibrio != null ? `${pontoEquilibrio} un/mês` : "—"}
                  </span>
                </div>
              </div>

              {/* Gráfico de composição */}
              {chartData.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs text-gray-400 font-medium mb-3">Composição do Preço</p>
                  <ResponsiveContainer width="100%" height={48}>
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                    >
                      <XAxis type="number" hide domain={[0, 100]} />
                      <YAxis type="category" hide />
                      <Tooltip
                        formatter={(v, name) => [`${v.toFixed(1)}%`, name]}
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#9ca3af" }}
                        itemStyle={{ color: "#f3f4f6" }}
                      />
                      <Bar dataKey="CMV" stackId="a" fill="#ef4444" />
                      <Bar dataKey="Variáveis" stackId="a" fill="#f97316" />
                      <Bar dataKey="Fixos" stackId="a" fill="#eab308" />
                      <Bar dataKey="Taxas Venda" stackId="a" fill="#8b5cf6" />
                      <Bar dataKey="Impostos" stackId="a" fill="#6b7280" />
                      <Bar
                        dataKey="Lucro"
                        stackId="a"
                        fill="#22c55e"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                    {[
                      { label: "CMV", color: "bg-red-500" },
                      { label: "Variáveis", color: "bg-orange-500" },
                      { label: "Fixos", color: "bg-yellow-500" },
                      { label: "Taxas venda", color: "bg-violet-500" },
                      { label: "Impostos", color: "bg-gray-500" },
                      { label: "Lucro", color: "bg-green-500" },
                    ].map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-xs text-gray-400">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || precoSugerido == null}
                className="w-full mt-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition text-sm"
              >
                {saving
                  ? "Salvando..."
                  : saved
                  ? editMode ? "Produto atualizado!" : "Produto salvo!"
                  : editMode ? "Salvar Alterações" : "Salvar Produto"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showFichaTecnica && (
        <FichaTecnicaModal
          productName={form.productName}
          user={user}
          onClose={() => setShowFichaTecnica(false)}
          onApply={(cmvPerUnit) => {
            setF("insumos", cmvPerUnit.toFixed(4));
            setShowFichaTecnica(false);
          }}
        />
      )}
    </div>
  );
}
