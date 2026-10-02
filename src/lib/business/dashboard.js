import { getFixedCostsTotal } from "./calculatorFinancialAdapter";
import { calculatePortfolio } from "./portfolio";

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function volumeOf(product) {
  const volume = Number(product?.inputs?.volumeEstimado);
  return Number.isFinite(volume) && volume > 0 ? volume : 0;
}

function metricsOf(product) {
  return product?.calculation?.metrics ?? product?.results ?? {};
}

function hasProjection(product) {
  const metrics = metricsOf(product);
  return (
    product?.calculation?.valid === true &&
    volumeOf(product) > 0 &&
    finite(metrics.precoSugerido) &&
    finite(metrics.margemContribuicaoUnit ?? metrics.margemContribuicao)
  );
}

export function calculateDashboardStats(products = [], fixedCosts = 0) {
  if (!products.length) return null;

  const included = products.filter(hasProjection);
  const receitaEstimada = included.reduce(
    (total, product) => total + metricsOf(product).precoSugerido * volumeOf(product),
    0
  );
  const margemContribuicaoTotal = included.reduce((total, product) => {
    const metrics = metricsOf(product);
    return total + (metrics.margemContribuicaoUnit ?? metrics.margemContribuicao) * volumeOf(product);
  }, 0);
  const resultadoOperacionalEstimado =
    included.length > 0 ? margemContribuicaoTotal - fixedCosts : null;
  const margemContribuicaoPct =
    receitaEstimada > 0 ? (margemContribuicaoTotal / receitaEstimada) * 100 : null;
  const margemOperacionalEstimadaPct =
    receitaEstimada > 0 && resultadoOperacionalEstimado != null
      ? (resultadoOperacionalEstimado / receitaEstimada) * 100
      : null;

  return {
    receitaEstimada,
    margemContribuicaoTotal,
    resultadoOperacionalEstimado,
    margemOperacionalEstimadaPct,
    margemContribuicaoPct,
    pontoEquilibrioFaturamento:
      margemContribuicaoPct > 0 ? fixedCosts / (margemContribuicaoPct / 100) : null,
    totalProdutos: products.length,
    produtosIncluidos: included.length,
  };
}

export function generateAlerts(products = []) {
  const noVolume = products.filter((product) => volumeOf(product) === 0);
  const incomplete = products.filter(
    (product) => volumeOf(product) > 0 && !hasProjection(product)
  );
  const nonPositiveContribution = products.filter((product) => {
    const contribution = metricsOf(product).margemContribuicaoUnit;
    return volumeOf(product) > 0 && finite(contribution) && contribution <= 0;
  });
  const negativeOperational = products.filter((product) => {
    const result = metricsOf(product).resultadoOperacionalEstimadoUnit;
    return volumeOf(product) > 0 && finite(result) && result < 0;
  });

  return { noVolume, incomplete, nonPositiveContribution, negativeOperational };
}

export function generateChartData(products = []) {
  return products
    .filter(hasProjection)
    .map((product) => ({
      id: product.id,
      name:
        (product.name?.length > 13 ? `${product.name.slice(0, 13)}…` : product.name) || "—",
      margem: metricsOf(product).margemOperacionalEstimadaPct,
    }))
    .filter((item) => finite(item.margem))
    .sort((a, b) => b.margem - a.margem)
    .map((item) => ({ ...item, margem: Number(item.margem.toFixed(1)) }));
}

export function getTopProducts(products = []) {
  return products
    .filter(hasProjection)
    .map((product) => {
      const metrics = metricsOf(product);
      return {
        ...product,
        contribuicaoTotal:
          (metrics.margemContribuicaoUnit ?? metrics.margemContribuicao) * volumeOf(product),
      };
    })
    .sort((a, b) => b.contribuicaoTotal - a.contribuicaoTotal)
    .slice(0, 5);
}

export function calculatePortfolioDashboard({ products = [], company = {}, ingredients = [] } = {}) {
  const recalculatedProducts = calculatePortfolio(products, company, ingredients);
  return {
    products: recalculatedProducts,
    stats: calculateDashboardStats(recalculatedProducts, getFixedCostsTotal(company)),
    alerts: generateAlerts(recalculatedProducts),
    chartData: generateChartData(recalculatedProducts),
    topProducts: getTopProducts(recalculatedProducts),
  };
}
