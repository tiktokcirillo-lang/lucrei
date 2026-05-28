import { getMarginClass } from "./classification";

export function calculateDashboardStats(produtos = []) {
  if (!produtos.length) return null;

  let faturamento = 0;
  let lucro = 0;
  let margemTotal = 0;

  for (const p of produtos) {
    const r = p.results ?? {};
    const vol = parseFloat(p.inputs?.volumeEstimado) || 0;
    faturamento += (r.precoSugerido ?? 0) * vol;
    lucro += (r.margemContribuicao ?? 0) * vol;
    margemTotal += r.margemReal ?? 0;
  }

  return {
    faturamento,
    lucro,
    margemMedia: margemTotal / produtos.length,
    total: produtos.length,
  };
}

export function generateAlerts(produtos = []) {
  return {
    low: produtos.filter((p) => (p.results?.margemReal ?? 0) < 10),
    noVol: produtos.filter((p) => !parseFloat(p.inputs?.volumeEstimado)),
  };
}

export function generateChartData(produtos = []) {
  return [...produtos]
    .filter((p) => p.results?.margemReal != null)
    .sort((a, b) => (b.results.margemReal ?? 0) - (a.results.margemReal ?? 0))
    .map((p) => ({
      name: (p.name?.length > 13 ? p.name.slice(0, 13) + "…" : p.name) || "—",
      margem: parseFloat((p.results.margemReal ?? 0).toFixed(1)),
      cls: getMarginClass(p.results.margemReal ?? 0),
    }));
}

export function getTopProducts(produtos = []) {
  return [...produtos]
    .sort((a, b) => (b.results?.margemContribuicao ?? 0) - (a.results?.margemContribuicao ?? 0))
    .slice(0, 5);
}
