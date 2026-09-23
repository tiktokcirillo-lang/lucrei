import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc, collection, addDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { calculateFinancialCore } from "../lib/business/financialCore";
import {
  buildFinancialCoreInput,
  buildFinancialResultsPayload,
  getFixedCostsTotal,
  resolveProductTaxRateOverride,
} from "../lib/business/calculatorFinancialAdapter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FlaskConical, Save } from "lucide-react";

const TAX_LABELS = {
  mei: "MEI",
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  unknown: "Ainda não sei",
};

const FINANCIAL_FIELD_LABELS = {
  cmv: "CMV",
  outrosCustosVariaveisMonetarios: "outros custos variáveis monetários",
  custosFixosMensais: "custos fixos mensais",
  volumeMensalEstimado: "volume mensal estimado",
  effectiveTaxRatePct: "alíquota efetiva",
  taxaVariavelPct: "taxas variáveis sobre a venda",
  margemOperacionalAlvoPct: "margem operacional alvo",
  precoVenda: "preço de venda",
};

function getFinancialMessage(error) {
  if (error.code === "REQUIRED_VALUE" && error.field === "effectiveTaxRatePct") {
    return "Informe sua alíquota efetiva para calcular o preço corretamente.";
  }

  if (error.code === "REQUIRED_VALUE" && error.field === "margemOperacionalAlvoPct") {
    return "Informe a margem operacional alvo.";
  }

  const fieldLabel = FINANCIAL_FIELD_LABELS[error.field];
  return fieldLabel ? error.message.replace(error.field, fieldLabel) : error.message;
}

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
  const isPct = prefix === "%";
  return (
    <div className="relative">
      {!isPct && prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] text-sm font-medium select-none pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[#0A0D14] border border-[#1E293B] rounded-lg py-3 text-[#F1F5F9] text-sm placeholder-[#334155] focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all duration-150 ${
          !isPct && prefix ? "pl-10 pr-4" : isPct ? "pl-4 pr-8" : "px-4"
        }`}
      />
      {isPct && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] text-sm select-none pointer-events-none">
          %
        </span>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 bg-[#10B981] rounded-full" />
        <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadonlyRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-[#0A0D14] border border-[#1E293B] rounded-lg">
      <span className="text-xs text-[#64748B]">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-[#10B981]" : "text-[#94A3B8]"}`}>
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
      <div className="bg-[#0F1623] border border-[#1E293B] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-[#1E293B] flex items-center justify-between">
          <h2 className="text-[#F1F5F9] font-bold text-base truncate pr-3 flex items-center gap-2">
            <FlaskConical size={16} style={{ color: '#10B981' }} />
            Ficha Técnica{productName ? ` — ${productName}` : ""}
          </h2>
          <button onClick={onClose} className="text-[#475569] hover:text-[#F1F5F9] text-xl leading-none transition flex-shrink-0">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">
              Rendimento (unidades)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={rendimento}
              onChange={(e) => setRendimento(e.target.value)}
              className="w-full bg-[#0A0D14] border border-[#1E293B] text-[#F1F5F9] rounded-lg px-4 py-3 outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] text-sm transition-all duration-150"
              placeholder="Ex: 10"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Ingredientes da receita</span>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown((d) => !d)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 font-medium transition"
                >
                  + Adicionar
                </button>
                {showDropdown && (
                  <>
                    <div className="fixed inset-0 z-0" onClick={() => setShowDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 w-64 bg-[#0F1623] border border-[#1E293B] rounded-xl shadow-2xl z-10 max-h-48 overflow-y-auto">
                      {ingredients.length === 0 ? (
                        <p className="text-[#64748B] text-sm p-4 text-center">
                          Nenhum ingrediente cadastrado
                        </p>
                      ) : (
                        ingredients.map((ing) => (
                          <button
                            key={ing.id}
                            onClick={() => addItem(ing)}
                            className="w-full text-left px-4 py-2.5 text-sm text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F1F5F9] flex items-center justify-between transition"
                          >
                            <span className="truncate">{ing.name}</span>
                            <span className="text-xs text-[#475569] ml-2 flex-shrink-0">
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
              <div className="bg-[#0A0D14] border border-[#1E293B] rounded-xl p-6 text-center text-[#475569] text-sm">
                Nenhum ingrediente adicionado à receita
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recipeItems.map((item) => {
                  const itemCost = (parseFloat(item.qty) || 0) * (item.costPerBaseUnit || 0);
                  return (
                    <div key={item._key} className="bg-[#0A0D14] border border-[#1E293B] rounded-xl p-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[#F1F5F9] text-sm font-medium mb-2 truncate">{item.name}</p>
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
                            className="w-24 bg-[#0F1623] border border-[#1E293B] text-[#F1F5F9] text-sm rounded-lg px-3 py-1.5 outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all duration-150"
                            placeholder="Qtd"
                          />
                          <span className="text-[#475569] text-xs">{item.baseUnit}</span>
                          <span className="ml-auto text-[#10B981] text-sm font-semibold">
                            {itemCost > 0 ? currency(itemCost) : "—"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item._key)}
                        className="text-[#475569] hover:text-[#EF4444] transition p-1 flex-shrink-0"
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

        <div className="p-5 border-t border-[#1E293B]">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm text-[#64748B]">CMV total da receita</span>
            <span className="text-sm text-[#F1F5F9] font-semibold">{currency(totalCMV)}</span>
          </div>
          <div className="flex items-center justify-between bg-[#0F2820] border border-[#10B981]/30 rounded-xl px-4 py-3 mb-4">
            <span className="text-sm text-[#10B981] font-medium">CMV por unidade</span>
            <span className="text-xl font-bold text-[#10B981]">{currency(cmvPerUnit)}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#0A0D14] border border-[#1E293B] text-[#94A3B8] text-sm font-medium hover:border-[#334155] transition"
            >
              Cancelar
            </button>
            <button
              onClick={() => onApply(cmvPerUnit)}
              disabled={!cmvPerUnit || cmvPerUnit <= 0}
              className="flex-1 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white text-sm font-semibold transition"
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
  const productId = searchParams.get("id");
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
    effectiveTaxRatePctOverride: "",
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
    if (!productId) return;
    getDoc(doc(db, "users", user.uid, "products", productId)).then((snap) => {
      if (!snap.exists()) return;
      const inputs = snap.data().inputs;
      if (inputs) {
        setForm((current) => ({
          ...current,
          ...inputs,
          effectiveTaxRatePctOverride: resolveProductTaxRateOverride(inputs),
        }));
      }
      setEditMode(true);
      setEditId(productId);
    });
  }, [user, productId]);

  const taxRegime = companyData?.taxRegime || "unknown";

  const fixedCostsTotal = useMemo(() => getFixedCostsTotal(companyData), [companyData]);
  const financialCoreInput = useMemo(
    () => buildFinancialCoreInput({ form, company: companyData }),
    [form, companyData]
  );
  const financialResult = useMemo(
    () => calculateFinancialCore(financialCoreInput),
    [financialCoreInput]
  );
  const financialMetrics = financialResult.metrics;
  const financialErrors = financialResult.errors.map(getFinancialMessage);
  const financialWarnings = financialResult.warnings.map(getFinancialMessage);

  const cmv = financialCoreInput.cmv;
  const volume = financialCoreInput.volumeMensalEstimado;
  const {
    precoSugerido,
    precoMinimoOperacional,
    precoPisoVariavel,
    margemOperacionalEstimadaPct,
    markupSobreCustoTotal,
    margemContribuicaoUnit,
    pontoEquilibrioUnidades,
    custoFixoRateadoPorUnidade,
  } = financialMetrics;

  const chartData =
    financialResult.valid && precoSugerido > 0
      ? [
          {
            name: "Composição",
            CMV: (financialMetrics.cmvUnitario / precoSugerido) * 100,
            Variáveis:
              (financialMetrics.outrosCustosVariaveisMonetariosUnit / precoSugerido) * 100,
            Fixos: (financialMetrics.custoFixoRateadoPorUnidade / precoSugerido) * 100,
            "Taxas Venda": financialMetrics.taxaVariavelPct,
            Impostos: financialMetrics.effectiveTaxRatePct,
            "Resultado Operacional Alvo": financialMetrics.margemOperacionalEstimadaPct,
          },
        ]
      : [];

  const resultPayload = financialResult.valid
    ? buildFinancialResultsPayload(financialMetrics)
    : null;

  async function handleSave() {
    if (!financialResult.valid || !resultPayload) return;
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

  const metrics = [
    {
      label: "Preço Piso Variável",
      hint: "Não cobre custos fixos",
      value: precoPisoVariavel != null ? currency(precoPisoVariavel) : "—",
      color: "#64748B",
    },
    {
      label: "Preço Mínimo Operacional",
      hint: "Inclui o rateio dos fixos",
      value: precoMinimoOperacional != null ? currency(precoMinimoOperacional) : "—",
      color: "#64748B",
    },
    {
      label: "Margem Operacional Estimada",
      value:
        margemOperacionalEstimadaPct != null ? pct(margemOperacionalEstimadaPct) : "—",
      color: "#F59E0B",
    },
    {
      label: "Markup",
      value:
        markupSobreCustoTotal != null ? `${markupSobreCustoTotal.toFixed(2)}x` : "—",
      color: "#3B82F6",
    },
    {
      label: "Margem de Contribuição",
      value: margemContribuicaoUnit != null ? currency(margemContribuicaoUnit) : "—",
      color: "#10B981",
    },
    {
      label: "Ponto de Equilíbrio",
      value:
        pontoEquilibrioUnidades != null ? `${pontoEquilibrioUnidades} un/mês` : "—",
      color: "#8B5CF6",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1A] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#F1F5F9]">
            {editMode ? "Editar Produto" : "Calculadora"}
          </h1>
          <p className="text-[#64748B] text-sm mt-1">
            {editMode ? "Atualize os dados do produto" : "Calcule o preço ideal em tempo real"}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Results — first on mobile, right on desktop */}
          <div className="w-full lg:w-80 order-1 lg:order-2 lg:sticky lg:top-4">
            {/* Preço Sugerido */}
            <div className="bg-gradient-to-br from-[#0F2820] to-[#0A1F14] border border-[#10B981]/30 rounded-xl p-6 mb-4">
              <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-2">
                Preço Sugerido
              </p>
              <p className="text-4xl font-bold text-[#F1F5F9] mb-1">
                {precoSugerido != null ? currency(precoSugerido) : "—"}
              </p>
              <p className="text-[#64748B] text-sm">
                com {num(form.margem).toFixed(1)}% de margem operacional alvo
              </p>
            </div>

            {financialErrors.length > 0 && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 mb-4">
                <p className="text-[#EF4444] text-xs font-semibold uppercase tracking-wider mb-2">
                  Revise os dados
                </p>
                <ul className="flex flex-col gap-1.5">
                  {[...new Set(financialErrors)].map((message) => (
                    <li key={message} className="text-[#FCA5A5] text-xs leading-relaxed">
                      {message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {financialWarnings.length > 0 && (
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 mb-4">
                <p className="text-[#F59E0B] text-xs font-semibold uppercase tracking-wider mb-2">
                  Atenção
                </p>
                <ul className="flex flex-col gap-1.5">
                  {[...new Set(financialWarnings)].map((message) => (
                    <li key={message} className="text-[#FCD34D] text-xs leading-relaxed">
                      {message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Métricas secundárias */}
            <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-4 mb-4">
              {metrics.map((item, i) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between py-2.5 ${i < metrics.length - 1 ? "border-b border-[#1E293B]" : ""}`}
                >
                  <span className="pr-3">
                    <span className="block text-xs text-[#64748B]">{item.label}</span>
                    {item.hint && (
                      <span className="block text-[10px] text-[#475569] mt-0.5">
                        {item.hint}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Gráfico de composição */}
            {chartData.length > 0 && (
              <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#475569] mb-3">
                  Composição do Preço
                </p>
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
                        backgroundColor: "#1E293B",
                        border: "1px solid #10B981",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#94A3B8" }}
                      itemStyle={{ color: "#F1F5F9" }}
                    />
                    <Bar dataKey="CMV" stackId="a" fill="#EF4444" />
                    <Bar dataKey="Variáveis" stackId="a" fill="#F59E0B" />
                    <Bar dataKey="Fixos" stackId="a" fill="#3B82F6" />
                    <Bar dataKey="Taxas Venda" stackId="a" fill="#A855F7" />
                    <Bar dataKey="Impostos" stackId="a" fill="#8B5CF6" />
                    <Bar
                      dataKey="Resultado Operacional Alvo"
                      stackId="a"
                      fill="#10B981"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                  {[
                    { label: "CMV", color: "#EF4444" },
                    { label: "Variáveis", color: "#F59E0B" },
                    { label: "Fixos", color: "#3B82F6" },
                    { label: "Taxas Venda", color: "#A855F7" },
                    { label: "Impostos", color: "#8B5CF6" },
                    { label: "Resultado Operacional Alvo", color: "#10B981" },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs text-[#64748B]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botão salvar */}
            <button
              onClick={handleSave}
              disabled={saving || !financialResult.valid}
              className="w-full bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-150 flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {saving
                ? "Salvando..."
                : saved
                ? editMode ? "Produto atualizado!" : "Produto salvo!"
                : editMode ? "Atualizar Produto" : "Salvar Produto"}
            </button>
          </div>

          {/* Form — second on mobile, left on desktop */}
          <div className="flex-1 flex flex-col order-2 lg:order-1">
            <Section title="Identificação">
              <Field label="Nome do produto">
                <input
                  type="text"
                  value={form.productName}
                  onChange={(e) => setF("productName", e.target.value)}
                  placeholder="Ex: Bolo de pote 200g"
                  className="w-full bg-[#0A0D14] border border-[#1E293B] rounded-lg px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#334155] focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all duration-150"
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
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 font-medium transition w-fit"
              >
                <FlaskConical size={13} /> Montar Ficha Técnica
              </button>
              <Field label="Embalagem">
                <RInput prefix="R$" value={form.embalagem} onChange={(v) => setF("embalagem", v)} />
              </Field>
              <Field label="Frete de entrada">
                <RInput prefix="R$" value={form.freteEntrada} onChange={(v) => setF("freteEntrada", v)} />
              </Field>
              <div className="flex items-center justify-between pt-3 border-t border-[#1E293B]">
                <span className="text-xs text-[#64748B] uppercase tracking-wide">Subtotal CMV</span>
                <span className="text-sm font-semibold text-[#F1F5F9]">{currency(cmv)}</span>
              </div>
            </Section>

            <Section title="Custos Variáveis de Venda">
              <Field label="Taxa da plataforma (Mercado Livre, Shopee...)">
                <RInput prefix="%" value={form.taxaPlataforma} onChange={(v) => setF("taxaPlataforma", v)} />
              </Field>
              <Field label="Taxa do gateway de pagamento">
                <RInput prefix="%" value={form.taxaGateway} onChange={(v) => setF("taxaGateway", v)} />
              </Field>
              <Field label="Frete de saída (para o cliente)">
                <RInput prefix="R$" value={form.freteSaida} onChange={(v) => setF("freteSaida", v)} />
              </Field>
              <Field label="CAC unitário (custo de marketing por unidade)">
                <RInput prefix="R$" value={form.cac} onChange={(v) => setF("cac", v)} />
              </Field>
              <Field label="Provisão para devoluções">
                <RInput prefix="%" value={form.provisaoDevolucoes} onChange={(v) => setF("provisaoDevolucoes", v)} />
              </Field>
            </Section>

            <Section title="Custos Fixos Rateados">
              <Field label="Volume estimado de vendas / mês">
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.volumeEstimado}
                    onChange={(e) => setF("volumeEstimado", e.target.value)}
                    placeholder="Ex: 100"
                    className="w-full bg-[#0A0D14] border border-[#1E293B] rounded-lg pl-4 pr-12 py-3 text-[#F1F5F9] text-sm placeholder-[#334155] focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all duration-150"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] text-sm select-none pointer-events-none">
                    un
                  </span>
                </div>
              </Field>
              <ReadonlyRow label="Custo fixo mensal total" value={currency(fixedCostsTotal)} />
              <ReadonlyRow
                label="Custo fixo por unidade"
                value={
                  volume > 0 && custoFixoRateadoPorUnidade != null
                    ? currency(custoFixoRateadoPorUnidade)
                    : "—"
                }
                highlight
              />
            </Section>

            <Section title="Impostos">
              <ReadonlyRow label="Regime tributário" value={TAX_LABELS[taxRegime]} />
              <ReadonlyRow
                label="Alíquota efetiva da empresa"
                value={
                  companyData?.effectiveTaxRatePct !== "" &&
                  companyData?.effectiveTaxRatePct != null
                    ? pct(num(companyData.effectiveTaxRatePct))
                    : "Não informada"
                }
              />
              <Field label="Alíquota específica do produto (opcional)">
                <RInput
                  prefix="%"
                  value={form.effectiveTaxRatePctOverride}
                  onChange={(v) =>
                    setForm((current) => ({
                      ...current,
                      effectiveTaxRatePctOverride: v,
                      taxaImpostosOverride: "",
                    }))
                  }
                  placeholder={
                    companyData?.effectiveTaxRatePct !== "" &&
                    companyData?.effectiveTaxRatePct != null
                      ? `${num(companyData.effectiveTaxRatePct).toFixed(2)} (empresa)`
                      : "Informe aqui ou nas configurações"
                  }
                />
              </Field>
              <p className="text-xs text-[#475569]">
                A alíquota do produto tem prioridade sobre a alíquota da empresa. O regime
                tributário é apenas informativo e não gera uma taxa automática.
              </p>
            </Section>

            <Section title="Resultado Operacional">
              <Field label="Margem operacional alvo">
                <RInput prefix="%" value={form.margem} onChange={(v) => setF("margem", v)} placeholder="30" />
              </Field>
            </Section>
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
