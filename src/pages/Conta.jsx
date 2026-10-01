import { useEffect, useState } from "react";
import { reauthenticateWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { accountApi } from "../lib/accountApi";
export default function Conta() {
  const [billing, setBilling] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const load = () =>
    accountApi("/api/billing")
      .then(setBilling)
      .catch((e) => setError(e.message));
  useEffect(() => {
    let cancelled = false;
    accountApi("/api/billing")
      .then((d) => {
        if (!cancelled) setBilling(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function redirect(actionName, planId) {
    const { url } = await accountApi("/api/billing", {
      action: actionName,
      planId,
    });
    const destination = new URL(url);
    if (
      destination.protocol !== "https:" ||
      !["checkout.stripe.com", "billing.stripe.com"].includes(
        destination.hostname,
      )
    )
      throw new Error("Endereço de pagamento inválido.");
    window.location.assign(url);
  }
  async function exportData() {
    const data = await accountApi("/api/account");
    data.exportedAt = new Date().toISOString();
    data.data = {};
    let total = 0;
    for (const collection of [...data.collections, "usage"]) {
      data.data[collection] = [];
      let cursor = null;
      do {
        const page = await accountApi(
          `/api/account?collection=${collection}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        data.data[collection].push(...page.items);
        cursor = page.nextCursor;
        total += page.items.length;
        if (total > 20000)
          throw new Error(
            "Exportação muito grande. Entre em contato com o suporte para receber o arquivo completo.",
          );
      } while (cursor);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lucrei-meus-dados.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function remove() {
    if (confirmation !== "EXCLUIR MINHA CONTA") return;
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Entre novamente para continuar.");
    await reauthenticateWithPopup(auth.currentUser, googleProvider);
    await accountApi("/api/account", { confirmation }, "DELETE");
    localStorage.removeItem(`lucrei_export_history_${uid}`);
    await auth.signOut();
    window.location.assign("/login");
  }
  const button =
    "rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50";
  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto text-slate-200 space-y-6">
      <h1 className="text-2xl font-bold">Conta e assinatura</h1>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      <section className="rounded-xl bg-slate-900 p-5 space-y-3">
        <h2 className="font-semibold">Seu plano</h2>
        {!billing ? (
          <p>Carregando assinatura…</p>
        ) : (
          <>
            <p>
              {billing.active ? "Assinatura ativa" : "Sem assinatura ativa"}
            </p>
            <p>
              Leituras neste mês (UTC): {billing.used} / {billing.limit}. Cada
              tentativa enviada consome uma leitura.
            </p>
            {!billing.enabled && (
              <p>Planos ainda não disponíveis para contratação.</p>
            )}
            {billing.plans.map((plan) => (
              <div
                key={plan.id}
                className="border border-slate-700 rounded-lg p-3"
              >
                <p>
                  {plan.name} · {plan.scans} leituras/mês
                </p>
                <p>
                  {plan.amount == null
                    ? "Preço no checkout"
                    : new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: plan.currency,
                      }).format(plan.amount / 100)}{" "}
                  / {plan.intervalCount}{" "}
                  {plan.interval === "month"
                    ? "mês(es)"
                    : plan.interval === "year"
                      ? "ano(s)"
                      : plan.interval}
                </p>
                <button
                  className={button}
                  disabled={busy || billing.active}
                  onClick={() => action(() => redirect("checkout", plan.id))}
                >
                  Assinar
                </button>
              </div>
            ))}
            {billing.hasCustomer && (
              <button
                className={button}
                disabled={busy}
                onClick={() => action(() => redirect("portal"))}
              >
                Gerenciar assinatura
              </button>
            )}
          </>
        )}
        <button
          className="underline block"
          disabled={busy}
          onClick={() => action(load)}
        >
          Atualizar situação
        </button>
        <p className="text-sm text-slate-400">
          O acesso é atualizado após a confirmação do pagamento. No portal,
          consulte faturas, altere o pagamento ou solicite cancelamento.
        </p>
      </section>
      <section className="rounded-xl bg-slate-900 p-5 space-y-3">
        <h2 className="font-semibold">Seus dados</h2>
        <button
          className={button}
          disabled={busy}
          onClick={() => action(exportData)}
        >
          Baixar meus dados
        </button>
        <p className="text-sm">
          Exportação JSON dos cadastros, produtos, ingredientes, histórico
          disponível e uso. Não é uma cópia de segurança de todo o serviço.
        </p>
      </section>
      <section className="rounded-xl border border-red-900 p-5 space-y-3">
        <h2 className="font-semibold">Excluir conta</h2>
        <p>
          A exclusão remove os dados do app e cancela imediatamente as
          assinaturas, sem emitir reembolso automático. Exporte seus dados
          antes. Registros de faturamento e cópias de segurança seguem as
          condições de privacidade.
        </p>
        <label className="block">
          Digite EXCLUIR MINHA CONTA
          <input
            className="block w-full bg-slate-900 border border-slate-600 rounded p-2 mt-2"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button
          className="bg-red-700 rounded px-4 py-2 disabled:opacity-50"
          disabled={busy || confirmation !== "EXCLUIR MINHA CONTA"}
          onClick={() => action(remove)}
        >
          Excluir permanentemente
        </button>
      </section>
      <p>
        <a className="underline" href="/privacidade">
          Privacidade
        </a>{" "}
        ·{" "}
        <a className="underline" href="/termos">
          Termos
        </a>{" "}
        ·{" "}
        <a className="underline" href="mailto:ohrcreativehub@gmail.com">
          Falar com Ohr Creative Hub
        </a>
      </p>
    </div>
  );
}
