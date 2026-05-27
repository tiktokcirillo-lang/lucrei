import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

const SALES_CHANNELS = [
  "Loja física",
  "E-commerce próprio",
  "Marketplace (ML, Shopee...)",
  "iFood/Delivery",
  "Redes sociais",
  "Outro",
];

const TAX_REGIMES = [
  { value: "mei", label: "MEI", description: "Microempreendedor Individual — faturamento até R$ 81mil/ano" },
  { value: "simples", label: "Simples Nacional", description: "Pequenas empresas com tributação simplificada" },
  { value: "presumido", label: "Lucro Presumido", description: "Imposto calculado sobre uma margem presumida" },
  { value: "real", label: "Lucro Real", description: "Imposto calculado sobre o lucro contábil real" },
  { value: "unknown", label: "Ainda não sei", description: "Usaremos uma estimativa padrão para você" },
];

const FIXED_COST_FIELDS = [
  { key: "rent", label: "Aluguel" },
  { key: "employees", label: "Funcionários" },
  { key: "accountant", label: "Contador" },
  { key: "energy", label: "Energia/Água" },
  { key: "internet", label: "Internet/Telefone" },
  { key: "other", label: "Outros" },
];

function Stepper({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              n === step
                ? "bg-green-500 text-white"
                : n < step
                ? "bg-green-800 text-green-300"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            {n}
          </div>
          {n < 3 && (
            <div className={`w-10 h-0.5 ${n < step ? "bg-green-700" : "bg-gray-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    productType: "Produto Físico",
    salesChannel: "",
    taxRegime: "",
    fixedCosts: {
      rent: "",
      employees: "",
      accountant: "",
      energy: "",
      internet: "",
      other: "",
    },
  });

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setCost(key, value) {
    setForm((f) => ({ ...f, fixedCosts: { ...f.fixedCosts, [key]: value } }));
  }

  function canAdvance() {
    if (step === 1) return form.companyName.trim() !== "" && form.salesChannel !== "";
    if (step === 2) return form.taxRegime !== "";
    return true;
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const costs = {};
      for (const { key } of FIXED_COST_FIELDS) {
        costs[key] = parseFloat(form.fixedCosts[key]) || 0;
      }

      await setDoc(doc(db, "users", user.uid), {
        company: {
          name: form.companyName.trim(),
          productType: form.productType,
          salesChannel: form.salesChannel,
          taxRegime: form.taxRegime,
          fixedCosts: costs,
        },
        createdAt: serverTimestamp(),
      });

      navigate("/");
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Lucrei 💰</h1>
        <p className="text-gray-400 text-center mb-8">Vamos configurar o seu negócio</p>

        <Stepper step={step} />

        <div className="bg-gray-900 rounded-2xl p-8">
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-semibold text-white">Sobre o negócio</h2>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome da empresa *</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setField("companyName", e.target.value)}
                  placeholder="Ex: Loja da Maria"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Tipo de produto</label>
                <select
                  value={form.productType}
                  onChange={(e) => setField("productType", e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option>Produto Físico</option>
                  <option>Produto Digital</option>
                  <option>Ambos</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Canal principal de venda *</label>
                <div className="grid grid-cols-2 gap-2">
                  {SALES_CHANNELS.map((channel) => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => setField("salesChannel", channel)}
                      className={`text-sm px-3 py-2.5 rounded-lg border transition-colors text-left ${
                        form.salesChannel === channel
                          ? "border-green-500 bg-green-500/10 text-green-400"
                          : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-semibold text-white">Regime tributário</h2>
              <div className="flex flex-col gap-3">
                {TAX_REGIMES.map((regime) => (
                  <button
                    key={regime.value}
                    type="button"
                    onClick={() => setField("taxRegime", regime.value)}
                    className={`text-left px-4 py-3.5 rounded-xl border transition-colors ${
                      form.taxRegime === regime.value
                        ? "border-green-500 bg-green-500/10"
                        : "border-gray-700 bg-gray-800 hover:border-gray-500"
                    }`}
                  >
                    <p className={`font-semibold text-sm ${form.taxRegime === regime.value ? "text-green-400" : "text-white"}`}>
                      {regime.label}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">{regime.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-semibold text-white">Custos fixos mensais</h2>
              <p className="text-gray-400 text-sm -mt-2">Todos os campos são opcionais. Deixe 0 se não se aplicar.</p>
              <div className="flex flex-col gap-3">
                {FIXED_COST_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm text-gray-400 mb-1">{label}</label>
                    <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
                      <span className="px-3 text-gray-500 text-sm select-none">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.fixedCosts[key]}
                        onChange={(e) => setCost(key, e.target.value)}
                        placeholder="0,00"
                        className="flex-1 bg-transparent text-white py-2.5 pr-4 outline-none placeholder-gray-600 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition text-sm font-medium"
              >
                Voltar
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition text-sm"
              >
                Próximo
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white font-semibold transition text-sm"
              >
                {saving ? "Salvando..." : "Começar 🚀"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
