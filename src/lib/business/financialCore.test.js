import { describe, expect, it } from "vitest";
import { calculateFinancialCore } from "./financialCore";

const baseInput = {
  cmv: 25,
  outrosCustosVariaveisMonetarios: 5,
  custosFixosMensais: 2000,
  volumeMensalEstimado: 100,
  effectiveTaxRatePct: 8,
  taxaVariavelPct: 8,
  margemOperacionalAlvoPct: 20,
};

function expectOnlyFiniteNumbersOrNull(metrics) {
  for (const value of Object.values(metrics)) {
    expect(value === null || Number.isFinite(value)).toBe(true);
  }
}

describe("calculateFinancialCore", () => {
  it("confirma o caso de referência e mantém custos fixos fora da contribuição", () => {
    const result = calculateFinancialCore(baseInput);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.metrics.custosVariaveisMonetariosTotaisUnit).toBeCloseTo(30);
    expect(result.metrics.custoFixoRateadoPorUnidade).toBeCloseTo(20);
    expect(result.metrics.custoTotalUnitarioEstimado).toBeCloseTo(50);
    expect(result.metrics.precoSugerido).toBeCloseTo(78.125);
    expect(result.metrics.precoMinimoOperacional).toBeCloseTo(59.5238095);
    expect(result.metrics.precoPisoVariavel).toBeCloseTo(35.7142857);
    expect(result.metrics.margemContribuicaoUnit).toBeCloseTo(35.625);
    expect(result.metrics.margemContribuicaoPct).toBeCloseTo(45.6);
    expect(result.metrics.resultadoOperacionalEstimadoUnit).toBeCloseTo(15.625);
    expect(result.metrics.margemOperacionalEstimadaPct).toBeCloseTo(20);
    expect(result.metrics.markupSobreCustoTotal).toBeCloseTo(1.5625);
    expect(result.metrics.pontoEquilibrioUnidades).toBe(57);
    expect(result.metrics.pontoEquilibrioFaturamento).toBeCloseTo(4385.964912);
  });

  it("calcula uma empresa sem custos fixos e aceita volume zero", () => {
    const result = calculateFinancialCore({
      ...baseInput,
      custosFixosMensais: 0,
      volumeMensalEstimado: 0,
    });

    expect(result.valid).toBe(true);
    expect(result.metrics.custoFixoRateadoPorUnidade).toBe(0);
    expect(result.metrics.custoTotalUnitarioEstimado).toBe(30);
    expect(result.metrics.pontoEquilibrioUnidades).toBe(0);
    expect(result.metrics.pontoEquilibrioFaturamento).toBe(0);
  });

  it("rateia custos fixos pelo volume mensal estimado", () => {
    const result = calculateFinancialCore({
      ...baseInput,
      custosFixosMensais: 900,
      volumeMensalEstimado: 300,
    });

    expect(result.valid).toBe(true);
    expect(result.metrics.custoFixoRateadoPorUnidade).toBeCloseTo(3);
    expect(result.metrics.custoTotalUnitarioEstimado).toBeCloseTo(33);
  });

  it("rejeita volume zero quando há custos fixos a ratear", () => {
    const result = calculateFinancialCore({ ...baseInput, volumeMensalEstimado: 0 });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain(
      "VOLUME_REQUIRED_FOR_FIXED_COSTS"
    );
    expectOnlyFiniteNumbersOrNull(result.metrics);
  });

  it("rejeita margem operacional alvo inviável", () => {
    const result = calculateFinancialCore({
      ...baseInput,
      margemOperacionalAlvoPct: 90,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain(
      "NON_POSITIVE_TARGET_DENOMINATOR"
    );
    expect(result.metrics.precoSugerido).toBeNull();
  });

  it("rejeita soma de impostos e taxas que inviabiliza qualquer preço", () => {
    const result = calculateFinancialCore({
      ...baseInput,
      effectiveTaxRatePct: 55,
      taxaVariavelPct: 45,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain(
      "NON_POSITIVE_VARIABLE_DENOMINATOR"
    );
    expect(result.metrics.precoPisoVariavel).toBeNull();
    expect(result.metrics.precoMinimoOperacional).toBeNull();
  });

  it("calcula margem de contribuição positiva a partir de um preço informado", () => {
    const result = calculateFinancialCore({
      ...baseInput,
      custosFixosMensais: 0,
      volumeMensalEstimado: 0,
      precoVenda: 50,
    });

    expect(result.valid).toBe(true);
    expect(result.metrics.margemContribuicaoUnit).toBeCloseTo(12);
    expect(result.metrics.margemContribuicaoPct).toBeCloseTo(24);
  });

  it("detecta margem de contribuição negativa e não calcula equilíbrio", () => {
    const result = calculateFinancialCore({ ...baseInput, precoVenda: 20 });

    expect(result.valid).toBe(false);
    expect(result.metrics.margemContribuicaoUnit).toBeCloseTo(-13.2);
    expect(result.metrics.pontoEquilibrioUnidades).toBeNull();
    expect(result.metrics.pontoEquilibrioFaturamento).toBeNull();
    expect(result.errors.map((error) => error.code)).toContain(
      "NON_POSITIVE_CONTRIBUTION_MARGIN"
    );
  });

  it("calcula o ponto de equilíbrio com arredondamento para cima", () => {
    const result = calculateFinancialCore({ ...baseInput, precoVenda: 80 });

    expect(result.valid).toBe(true);
    expect(result.metrics.margemContribuicaoUnit).toBeCloseTo(37.2);
    expect(result.metrics.pontoEquilibrioUnidades).toBe(54);
    expect(result.metrics.pontoEquilibrioFaturamento).toBeCloseTo(4301.075269);
  });

  it("trata valores monetários zero sem produzir NaN ou Infinity", () => {
    const result = calculateFinancialCore({
      cmv: 0,
      outrosCustosVariaveisMonetarios: 0,
      custosFixosMensais: 0,
      volumeMensalEstimado: 0,
      effectiveTaxRatePct: 0,
      taxaVariavelPct: 0,
      margemOperacionalAlvoPct: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.metrics.precoSugerido).toBe(0);
    expect(result.metrics.markupSobreCustoTotal).toBeNull();
    expect(result.errors.map((error) => error.code)).toContain(
      "NON_POSITIVE_CONTRIBUTION_MARGIN"
    );
    expectOnlyFiniteNumbersOrNull(result.metrics);
  });

  it("normaliza strings numéricas e vírgula decimal vindas dos formulários", () => {
    const result = calculateFinancialCore({
      cmv: "25,00",
      outrosCustosVariaveisMonetarios: "5",
      custosFixosMensais: "2000",
      volumeMensalEstimado: "100",
      effectiveTaxRatePct: "8",
      taxaVariavelPct: "8,0",
      margemOperacionalAlvoPct: "20",
    });

    expect(result.valid).toBe(true);
    expect(result.metrics.precoSugerido).toBeCloseTo(78.125);
  });

  it("rejeita campos obrigatórios vazios em vez de convertê-los silenciosamente para zero", () => {
    const result = calculateFinancialCore({
      ...baseInput,
      cmv: "",
      taxaVariavelPct: "   ",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.filter((error) => error.code === "REQUIRED_VALUE")).toHaveLength(2);
    expectOnlyFiniteNumbersOrNull(result.metrics);
  });

  it("rejeita valores monetários negativos", () => {
    const result = calculateFinancialCore({ ...baseInput, cmv: -1 });

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("NEGATIVE_MONEY");
  });

  it("avisa quando o preço cobre variáveis, mas não o custo fixo rateado", () => {
    const result = calculateFinancialCore({ ...baseInput, precoVenda: 50 });

    expect(result.valid).toBe(true);
    expect(result.metrics.margemContribuicaoUnit).toBeCloseTo(12);
    expect(result.metrics.resultadoOperacionalEstimadoUnit).toBeCloseTo(-8);
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "PRICE_BELOW_OPERATIONAL_MINIMUM"
    );
  });

  it("rejeita percentuais negativos ou acima de 100%", () => {
    const negative = calculateFinancialCore({ ...baseInput, taxaVariavelPct: -1 });
    const excessive = calculateFinancialCore({ ...baseInput, effectiveTaxRatePct: 101 });

    expect(negative.valid).toBe(false);
    expect(excessive.valid).toBe(false);
    expect(negative.errors.map((error) => error.code)).toContain("INVALID_PERCENTAGE");
    expect(excessive.errors.map((error) => error.code)).toContain("INVALID_PERCENTAGE");
  });

  it("garante que cenários inválidos nunca retornem NaN ou Infinity", () => {
    const scenarios = [
      { ...baseInput, cmv: "não é número" },
      { ...baseInput, volumeMensalEstimado: 0 },
      { ...baseInput, margemOperacionalAlvoPct: 100 },
      { ...baseInput, taxaVariavelPct: 99, effectiveTaxRatePct: 1 },
      { ...baseInput, precoVenda: 0 },
    ];

    for (const scenario of scenarios) {
      expectOnlyFiniteNumbersOrNull(calculateFinancialCore(scenario).metrics);
    }
  });
});
