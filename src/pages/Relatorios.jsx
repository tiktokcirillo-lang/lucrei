import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { jsPDF } from "jspdf";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

function n(v) {
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

function fmtR(v) {
  if (v == null || !isFinite(v)) return "—";
  return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtPct(v) {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(1) + "%";
}

function getClass(margemReal) {
  if (margemReal >= 40) return "A";
  if (margemReal >= 20) return "B";
  return "C";
}

const FIXED_COST_LABELS = {
  rent: "Aluguel",
  employees: "Funcionários",
  accountant: "Contador",
  energy: "Energia / Água",
  internet: "Internet / Telefone",
  other: "Outros",
};

const HISTORY_KEY = "lucrei_export_history";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushHistory(entry) {
  const list = loadHistory();
  list.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
  return list.slice(0, 10);
}

export default function Relatorios() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [fixedCosts, setFixedCosts] = useState({});
  const [companyName, setCompanyName] = useState("Minha Empresa");
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(loadHistory);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDocs(collection(db, "users", user.uid, "products")),
      getDoc(doc(db, "users", user.uid)),
    ]).then(([prodSnap, compSnap]) => {
      setProdutos(prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const company = compSnap.data()?.company ?? {};
      setFixedCosts(company.fixedCosts ?? {});
      setCompanyName(company.name || "Minha Empresa");
      setLoading(false);
    });
  }, [user]);

  const dre = useMemo(() => {
    let receitaBruta = 0, deducoesFiscais = 0, cmvTotal = 0, custosVariaveisTotal = 0;
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
      cmvTotal, lucroBruto, despesasOp, custosVariaveisTotal,
      lucroLiquido, margemLiquida, ebitda, peReais, peUnidades,
    };
  }, [produtos, fixedCosts]);

  function addToHistory(name) {
    setHistory(pushHistory({ name, date: new Date().toISOString() }));
  }

  function gerarPdfMargem() {
    const pdf = new jsPDF();
    const now = new Date().toLocaleDateString("pt-BR");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(20, 20, 20);
    pdf.text(companyName, 14, 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("Relatorio de Margem por Produto", 14, 28);
    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 130);
    pdf.text("Gerado em: " + now, 14, 34);

    // Table header
    const cols = ["Produto", "Preco Sug.", "CMV", "Margem %", "Markup", "Classe"];
    const colX = [14, 74, 104, 132, 158, 182];
    let y = 47;

    pdf.setFillColor(34, 197, 94);
    pdf.rect(14, y - 5, 182, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    cols.forEach((col, i) => pdf.text(col, colX[i], y));

    y += 9;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(40, 40, 40);

    for (const p of produtos) {
      if (y > 272) {
        pdf.addPage();
        y = 20;
      }
      const r = p.results ?? {};
      const margem = r.margemReal ?? 0;
      const row = [
        (p.inputs?.nome ?? "—").substring(0, 22),
        r.precoSugerido != null ? fmtR(r.precoSugerido) : "—",
        r.cmv != null ? fmtR(r.cmv) : "—",
        fmtPct(margem),
        r.markup != null ? r.markup.toFixed(1) + "x" : "—",
        getClass(margem),
      ];
      row.forEach((cell, i) => pdf.text(cell, colX[i], y));
      pdf.setDrawColor(220, 220, 220);
      pdf.line(14, y + 2, 196, y + 2);
      y += 8;
    }

    if (produtos.length === 0) {
      pdf.setTextColor(150, 150, 150);
      pdf.text("Nenhum produto cadastrado.", 14, y);
    }

    pdf.setFontSize(7);
    pdf.setTextColor(170, 170, 170);
    pdf.text("Gerado pelo Lucrei", 14, 290);

    pdf.save("margem-por-produto.pdf");
    addToHistory("Relatório de Margem por Produto");
  }

  function gerarPdfDRE() {
    const pdf = new jsPDF();
    const now = new Date().toLocaleDateString("pt-BR");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(20, 20, 20);
    pdf.text(companyName, 14, 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("DRE - Demonstracao do Resultado do Exercicio", 14, 28);
    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 130);
    pdf.text("Gerado em: " + now, 14, 34);

    const dreRows = [
      { label: "(+) Receita Bruta", val: fmtR(dre.receitaBruta), bold: false },
      { label: "(-) Deducoes Fiscais", val: fmtR(dre.deducoesFiscais), bold: false },
      { label: "(=) Receita Liquida", val: fmtR(dre.receitaLiquida), bold: true },
      { label: "(-) CMV Total", val: fmtR(dre.cmvTotal), bold: false },
      { label: "(=) Lucro Bruto", val: fmtR(dre.lucroBruto), bold: true },
      { label: "(-) Despesas Operacionais", val: fmtR(dre.despesasOp), bold: false },
      ...Object.entries(fixedCosts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({
          label: "   " + (FIXED_COST_LABELS[k] ?? k),
          val: fmtR(v),
          bold: false,
          sub: true,
        })),
      { label: "(-) Custos Variaveis Totais", val: fmtR(dre.custosVariaveisTotal), bold: false },
      { label: "(=) Lucro Liquido", val: fmtR(dre.lucroLiquido), bold: true },
      { label: "(%) Margem Liquida", val: fmtPct(dre.margemLiquida), bold: false },
      { label: "EBITDA Estimado", val: fmtR(dre.ebitda), bold: false },
      { label: "Ponto de Equilibrio (R$)", val: dre.peReais != null ? fmtR(dre.peReais) : "—", bold: false },
      { label: "Ponto de Equilibrio (un)", val: dre.peUnidades != null ? dre.peUnidades + " un" : "—", bold: false },
    ];

    let y = 46;
    for (const row of dreRows) {
      if (row.bold) {
        pdf.setFillColor(240, 240, 240);
        pdf.rect(14, y - 5, 182, 8, "F");
      }
      pdf.setFont("helvetica", row.bold ? "bold" : "normal");
      pdf.setFontSize(row.sub ? 8 : 9);
      pdf.setTextColor(40, 40, 40);
      pdf.text(row.label, 16, y);
      pdf.text(row.val, 194, y, { align: "right" });
      pdf.setDrawColor(220, 220, 220);
      pdf.line(14, y + 2, 196, y + 2);
      y += row.bold ? 10 : 8;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(170, 170, 170);
    pdf.text("Gerado pelo Lucrei", 14, 290);

    pdf.save("dre-mensal.pdf");
    addToHistory("DRE Mensal");
  }

  function fmtHistDate(iso) {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Carregando relatórios...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 p-4 md:p-8 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Relatórios</h1>
          <p className="text-gray-400 text-sm">Exporte e analise seus dados</p>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-4 mb-8">
          {/* Card 1 — Margem por Produto */}
          <div className="bg-gray-900 rounded-2xl p-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="text-2xl mt-0.5">📈</span>
              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  Relatório de Margem por Produto
                </p>
                <p className="text-xs text-gray-400">
                  Visão completa da margem, markup e classificação ABC de todos os produtos
                </p>
              </div>
            </div>
            <button
              onClick={gerarPdfMargem}
              className="shrink-0 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition"
            >
              Gerar PDF
            </button>
          </div>

          {/* Card 2 — DRE */}
          <div className="bg-gray-900 rounded-2xl p-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="text-2xl mt-0.5">📊</span>
              <div>
                <p className="text-sm font-semibold text-white mb-1">DRE Mensal</p>
                <p className="text-xs text-gray-400">
                  Demonstração do Resultado do Exercício com todos os indicadores
                </p>
              </div>
            </div>
            <button
              onClick={gerarPdfDRE}
              className="shrink-0 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition"
            >
              Gerar PDF
            </button>
          </div>

          {/* Card 3 — Email */}
          <div className="bg-gray-900 rounded-2xl p-5">
            <div className="flex items-start gap-4 mb-4">
              <span className="text-2xl mt-0.5">📧</span>
              <div>
                <p className="text-sm font-semibold text-white mb-1">Enviar por Email</p>
                <p className="text-xs text-gray-400">
                  Receba o relatório completo no seu Gmail
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={user?.email ?? ""}
                readOnly
                className="flex-1 bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-2 outline-none"
              />
              <div className="relative group">
                <button
                  disabled
                  className="px-4 py-2 bg-gray-700 text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed select-none"
                >
                  Enviar
                </button>
                <span className="absolute right-0 top-10 bg-gray-700 text-gray-200 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                  Em breve — integração Gmail em desenvolvimento
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Export history */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Histórico de exports</h2>
          {history.length === 0 ? (
            <p className="text-xs text-gray-600">Nenhum PDF gerado ainda.</p>
          ) : (
            <div className="bg-gray-900 rounded-2xl divide-y divide-gray-800">
              {history.map((entry, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-white">{entry.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtHistDate(entry.date)}</p>
                  </div>
                  <button
                    disabled
                    className="text-xs text-gray-600 px-3 py-1.5 rounded-lg bg-gray-800 cursor-not-allowed select-none"
                  >
                    Baixar novamente
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
