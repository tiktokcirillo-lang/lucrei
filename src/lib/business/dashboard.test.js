import { describe, expect, it } from "vitest";
import {
  calculateDashboardStats,
  generateAlerts,
  generateChartData,
  getTopProducts,
} from "./dashboard";

const products = [
  {
    id: "a",
    name: "Produto com margem alta",
    inputs: { volumeEstimado: "10" },
    results: { precoSugerido: 20, margemContribuicao: 8, margemReal: 40 },
  },
  {
    id: "b",
    name: "Produto B",
    inputs: { volumeEstimado: "5" },
    results: { precoSugerido: 10, margemContribuicao: 1, margemReal: 8 },
  },
];

describe("dashboard calculations", () => {
  it("calculates totals from estimated volume", () => {
    expect(calculateDashboardStats(products)).toEqual({
      faturamento: 250,
      lucro: 85,
      margemMedia: 24,
      total: 2,
    });
  });

  it("returns null when there are no products", () => {
    expect(calculateDashboardStats([])).toBeNull();
  });

  it("identifies low-margin and missing-volume products", () => {
    const alerts = generateAlerts([
      ...products,
      { id: "c", name: "Sem volume", inputs: {}, results: { margemReal: 20 } },
    ]);

    expect(alerts.low.map((product) => product.id)).toEqual(["b"]);
    expect(alerts.noVol.map((product) => product.id)).toEqual(["c"]);
  });

  it("sorts chart and ranking data without mutating the source", () => {
    const originalOrder = products.map((product) => product.id);
    expect(generateChartData(products).map((item) => item.margem)).toEqual([40, 8]);
    expect(getTopProducts(products).map((product) => product.id)).toEqual(["a", "b"]);
    expect(products.map((product) => product.id)).toEqual(originalOrder);
  });
});
