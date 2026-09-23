import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
  { value: "mei", label: "MEI" },
  { value: "simples", label: "Simples Nacional" },
  { value: "presumido", label: "Lucro Presumido" },
  { value: "real", label: "Lucro Real" },
  { value: "unknown", label: "Ainda não sei" },
];

const FIXED_COST_FIELDS = [
  { key: "rent", label: "Aluguel" },
  { key: "employees", label: "Funcionários" },
  { key: "accountant", label: "Contador" },
  { key: "energy", label: "Energia/Água" },
  { key: "internet", label: "Internet/Telefone" },
  { key: "other", label: "Outros" },
];

function Section({ title, children }) {
  return (
    <div className="bg-[#0F1623] border border-[#1E293B] rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 bg-[#10B981] rounded-full" />
        <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
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

export default function Configuracoes() {
  const { user, logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    productType: "Produto Físico",
    salesChannel: "",
    taxRegime: "",
    effectiveTaxRatePct: "",
    fixedCosts: {
      rent: "",
      employees: "",
      accountant: "",
      energy: "",
      internet: "",
      other: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const c = data.company || {};
      setForm({
        companyName: c.name || "",
        productType: c.productType || "Produto Físico",
        salesChannel: c.salesChannel || "",
        taxRegime: c.taxRegime || "",
        effectiveTaxRatePct: c.effectiveTaxRatePct ?? "",
        fixedCosts: {
          rent: c.fixedCosts?.rent ?? "",
          employees: c.fixedCosts?.employees ?? "",
          accountant: c.fixedCosts?.accountant ?? "",
          energy: c.fixedCosts?.energy ?? "",
          internet: c.fixedCosts?.internet ?? "",
          other: c.fixedCosts?.other ?? "",
        },
      });
    });
  }, [user]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setCost(key, value) {
    setForm((f) => ({ ...f, fixedCosts: { ...f.fixedCosts, [key]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const costs = {};
      for (const { key } of FIXED_COST_FIELDS) {
        costs[key] = parseFloat(form.fixedCosts[key]) || 0;
      }
      const effectiveTaxRatePct =
        form.effectiveTaxRatePct === "" ? "" : parseFloat(form.effectiveTaxRatePct);
      await updateDoc(doc(db, "users", user.uid), {
        "company.name": form.companyName.trim(),
        "company.productType": form.productType,
        "company.salesChannel": form.salesChannel,
        "company.taxRegime": form.taxRegime,
        "company.effectiveTaxRatePct": effectiveTaxRatePct,
        "company.fixedCosts": costs,
      });
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full bg-[#0A0D14] border border-[#1E293B] text-[#F1F5F9] rounded-lg px-4 py-2.5 outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] placeholder-[#334155] text-sm transition-all duration-150";
  const selectCls =
    "w-full bg-[#0A0D14] border border-[#1E293B] text-[#F1F5F9] rounded-lg px-4 py-2.5 outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] text-sm transition-all duration-150";

  return (
    <div className="bg-[#060A12] min-h-screen p-4 md:p-8">
      <div className="max-w-xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Configurações</h1>
          <p className="text-[#64748B] text-sm mt-1">Gerencie os dados da sua empresa</p>
        </div>

        {/* Seção 1 — Dados da Empresa */}
        <Section title="Dados da Empresa">
          <Field label="Nome da empresa">
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => setField("companyName", e.target.value)}
              placeholder="Ex: Loja da Maria"
              className={inputCls}
            />
          </Field>

          <Field label="Tipo de produto">
            <select
              value={form.productType}
              onChange={(e) => setField("productType", e.target.value)}
              className={selectCls}
            >
              <option>Produto Físico</option>
              <option>Produto Digital</option>
              <option>Ambos</option>
            </select>
          </Field>

          <Field label="Canal principal de venda">
            <select
              value={form.salesChannel}
              onChange={(e) => setField("salesChannel", e.target.value)}
              className={selectCls}
            >
              <option value="">Selecione...</option>
              {SALES_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </Field>

          <Field label="Regime tributário">
            <select
              value={form.taxRegime}
              onChange={(e) => setField("taxRegime", e.target.value)}
              className={selectCls}
            >
              <option value="">Selecione...</option>
              {TAX_REGIMES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Alíquota efetiva sobre vendas (%)">
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.effectiveTaxRatePct}
                onChange={(e) => setField("effectiveTaxRatePct", e.target.value)}
                placeholder="Ex: 8,00"
                className={`${inputCls} pr-10`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] text-sm select-none pointer-events-none">
                %
              </span>
            </div>
            <p className="text-xs text-[#475569] mt-2 leading-relaxed">
              Informe a alíquota efetiva utilizada no seu negócio. Consulte seu contador caso
              tenha dúvida. O Lucrei não calcula tributos automaticamente.
            </p>
          </Field>
        </Section>

        {/* Seção 2 — Custos Fixos Mensais */}
        <Section title="Custos Fixos Mensais">
          {FIXED_COST_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <div className="flex items-center bg-[#0A0D14] border border-[#1E293B] rounded-lg overflow-hidden focus-within:border-[#10B981] focus-within:ring-1 focus-within:ring-[#10B981] transition-all duration-150">
                <span className="px-3 text-[#475569] text-sm select-none">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.fixedCosts[key]}
                  onChange={(e) => setCost(key, e.target.value)}
                  placeholder="0,00"
                  className="flex-1 bg-transparent text-[#F1F5F9] py-2.5 pr-4 outline-none placeholder-[#334155] text-sm"
                />
              </div>
            </Field>
          ))}
        </Section>

        {/* Seção 3 — Dados da Conta */}
        <Section title="Dados da Conta">
          <Field label="E-mail">
            <input
              type="text"
              value={user?.email || ""}
              readOnly
              className="w-full bg-[#0A0D14]/50 border border-[#1E293B] text-[#64748B] rounded-lg px-4 py-2.5 outline-none text-sm cursor-not-allowed"
            />
          </Field>
          <Field label="Nome">
            <input
              type="text"
              value={user?.displayName || ""}
              readOnly
              className="w-full bg-[#0A0D14]/50 border border-[#1E293B] text-[#64748B] rounded-lg px-4 py-2.5 outline-none text-sm cursor-not-allowed"
            />
          </Field>
          <button
            onClick={logout}
            className="mt-1 w-full py-2.5 rounded-xl bg-[#0A0D14] border border-[#1E293B] hover:border-[#10B981] text-[#94A3B8] hover:text-[#10B981] transition-all duration-150 text-sm font-medium"
          >
            Sair da conta
          </button>
        </Section>

        {/* Botão salvar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white font-semibold transition-all duration-150"
        >
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#10B981] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
            Configurações salvas com sucesso!
          </div>
        )}

      </div>
    </div>
  );
}
