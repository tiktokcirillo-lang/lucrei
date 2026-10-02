import { describe, expect, it } from "vitest";
import {
  calculateDashboardStats,
  calculatePortfolioDashboard,
  generateAlerts,
  generateChartData,
  getTopProducts,
} from "./dashboard";

const company = { effectiveTaxRatePct: 0, fixedCosts: { rent: 2000 } };

function product(id, volume = 100, overrides = {}) {
  return {
    id,
    name: `Produto ${id}`,
    inputs: {
      insumos: 20,
      embalagem: 0,
      freteEntrada: 0,
      freteSaida: 0,
      cac: 0,
      taxaPlataforma: 0,
      taxaGateway: 0,
      provisaoDevolucoes: 0,
      volumeEstimado: volume,
      margem: 20,
      ...overrides,
    },
    results: { precoSugerido: 999999, margemContribuicao: 999999 },
  };
}

describe("dashboard calculations", () => {
  it("recalculates the current portfolio and ignores stale saved results", () => {
    const dashboard = calculatePortfolioDashboard({
      products: [product("a"), product("b")],
      company,
    });

    expect(dashboard.stats.receitaEstimada).toBeCloseTo(7500);
    expect(dashboard.stats.margemContribuicaoTotal).toBeCloseTo(3500);
    expect(dashboard.stats.resultadoOperacionalEstimado).toBeCloseTo(1500);
    expect(dashboard.stats.margemOperacionalEstimadaPct).toBeCloseTo(20);
  });

  it("subtracts monthly fixed costs once, not once per product", () => {
    const dashboard = calculatePortfolioDashboard({
      products: [product("a"), product("b")],
      company,
    });
    expect(dashboard.stats.resultadoOperacionalEstimado).toBeCloseTo(
      dashboard.stats.margemContribuicaoTotal - 2000
    );
  });

  it("uses consolidated revenue weighting instead of an average of percentages", () => {
    const dashboard = calculatePortfolioDashboard({
      products: [product("a", 200, { margem: 10 }), product("b", 20, { insumos: 80, margem: 35 })],
      company,
    });
    const expected =
      (dashboard.stats.resultadoOperacionalEstimado / dashboard.stats.receitaEstimada) * 100;
    const simpleAverage =
      dashboard.products.reduce(
        (sum, item) => sum + item.results.margemOperacionalEstimadaPct,
        0
      ) / dashboard.products.length;

    expect(dashboard.stats.margemOperacionalEstimadaPct).toBeCloseTo(expected);
    expect(dashboard.stats.margemOperacionalEstimadaPct).not.toBeCloseTo(simpleAverage);
  });

  it("excludes products without volume and reports data quality", () => {
    const dashboard = calculatePortfolioDashboard({
      products: [product("a"), product("without-volume", 0)],
      company,
    });

    expect(dashboard.stats.produtosIncluidos).toBe(1);
    expect(dashboard.alerts.noVolume.map((item) => item.id)).toEqual(["without-volume"]);
    expect(dashboard.chartData.map((item) => item.id)).toEqual(["a"]);
  });

  it("reports incomplete and non-positive projections objectively", () => {
    const products = [
      {
        id: "invalid",
        inputs: { volumeEstimado: 10 },
        calculation: {
          valid: false,
          metrics: { margemContribuicaoUnit: -2, resultadoOperacionalEstimadoUnit: -4 },
        },
        results: {},
      },
    ];
    const alerts = generateAlerts(products);

    expect(alerts.incomplete.map((item) => item.id)).toEqual(["invalid"]);
    expect(alerts.nonPositiveContribution.map((item) => item.id)).toEqual(["invalid"]);
    expect(alerts.negativeOperational.map((item) => item.id)).toEqual(["invalid"]);
  });

  it("ranks by total contribution and does not mutate the source", () => {
    const dashboard = calculatePortfolioDashboard({
      products: [product("a", 100), product("b", 20, { insumos: 80 })],
      company,
    });
    const originalOrder = dashboard.products.map((item) => item.id);

    expect(getTopProducts(dashboard.products)[0].id).toBe("a");
    expect(generateChartData(dashboard.products)).toHaveLength(2);
    expect(dashboard.products.map((item) => item.id)).toEqual(originalOrder);
  });

  it("returns null only when there are no products", () => {
    expect(calculateDashboardStats([])).toBeNull();
  });
});
