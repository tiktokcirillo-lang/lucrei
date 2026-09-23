import { describe, expect, it } from "vitest";
import { calculateFinancialCore } from "./financialCore";
import {
  buildFinancialCoreInput,
  buildFinancialResultsPayload,
  resolveEffectiveTaxRatePct,
  resolveProductTaxRateOverride,
} from "./calculatorFinancialAdapter";

const baseForm = {
  insumos: "20",
  embalagem: "3",
  freteEntrada: "2",
  freteSaida: "4",
  cac: "1",
  taxaPlataforma: "5",
  taxaGateway: "2",
  provisaoDevolucoes: "1",
  volumeEstimado: "100",
  margem: "20",
  effectiveTaxRatePctOverride: "",
  taxaImpostosOverride: "",
};

const company = {
  taxRegime: "simples",
  effectiveTaxRatePct: 8,
  fixedCosts: { rent: 1500, accountant: 500 },
};

describe("calculator financial adapter", () => {
  it("usa a alíquota efetiva cadastrada na empresa", () => {
    const input = buildFinancialCoreInput({ form: baseForm, company });

    expect(input.effectiveTaxRatePct).toBe(8);
    expect(calculateFinancialCore(input).metrics.effectiveTaxRatePct).toBe(8);
  });

  it("prioriza o override explícito do produto sobre a empresa", () => {
    const form = { ...baseForm, effectiveTaxRatePctOverride: "12" };

    expect(resolveEffectiveTaxRatePct({ productInputs: form, company })).toBe("12");
    expect(buildFinancialCoreInput({ form, company }).effectiveTaxRatePct).toBe("12");
  });

  it("mantém compatibilidade de leitura com taxaImpostosOverride", () => {
    const legacyInputs = { ...baseForm, taxaImpostosOverride: "9" };

    expect(resolveProductTaxRateOverride(legacyInputs)).toBe("9");
    expect(resolveEffectiveTaxRatePct({ productInputs: legacyInputs, company })).toBe("9");
  });

  it("prefere o campo novo quando os dois overrides existem", () => {
    expect(
      resolveProductTaxRateOverride({
        effectiveTaxRatePctOverride: "12",
        taxaImpostosOverride: "9",
      })
    ).toBe("12");
  });

  it("não cria fallback quando nenhuma alíquota foi informada", () => {
    const input = buildFinancialCoreInput({
      form: baseForm,
      company: { fixedCosts: {}, effectiveTaxRatePct: "" },
    });
    const result = calculateFinancialCore(input);

    expect(input.effectiveTaxRatePct).toBe("");
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "REQUIRED_VALUE", field: "effectiveTaxRatePct" })
    );
  });

  it("não transforma o regime Simples em uma alíquota automática", () => {
    expect(
      resolveEffectiveTaxRatePct({
        productInputs: baseForm,
        company: { taxRegime: "simples", effectiveTaxRatePct: "" },
      })
    ).toBe("");
  });

  it("mapeia os campos atuais para o contrato do Financial Core", () => {
    const input = buildFinancialCoreInput({ form: baseForm, company });

    expect(input).toEqual({
      cmv: 25,
      outrosCustosVariaveisMonetarios: 5,
      custosFixosMensais: 2000,
      volumeMensalEstimado: 100,
      effectiveTaxRatePct: 8,
      taxaVariavelPct: 8,
      margemOperacionalAlvoPct: "20",
    });
  });

  it("preserva aliases antigos coerentes com as métricas canônicas", () => {
    const { metrics } = calculateFinancialCore(
      buildFinancialCoreInput({ form: baseForm, company })
    );
    const payload = buildFinancialResultsPayload(metrics);

    expect(payload.financialCoreVersion).toBe(1);
    expect(payload.precoMinimo).toBe(metrics.precoMinimoOperacional);
    expect(payload.margemReal).toBe(metrics.margemOperacionalEstimadaPct);
    expect(payload.markup).toBe(metrics.markupSobreCustoTotal);
    expect(payload.margemContribuicao).toBe(metrics.margemContribuicaoUnit);
    expect(payload.pontoEquilibrio).toBe(metrics.pontoEquilibrioUnidades);
    expect(payload.cmv).toBe(metrics.cmvUnitario);
    expect(payload.custoVariavelR).toBe(metrics.outrosCustosVariaveisMonetariosUnit);
    expect(payload.custoFixoUnidade).toBe(metrics.custoFixoRateadoPorUnidade);
    expect(payload.ctu).toBe(metrics.custoTotalUnitarioEstimado);
    expect(payload.taxRatePct).toBe(metrics.effectiveTaxRatePct);
    expect(payload.precoPisoVariavel).toBe(metrics.precoPisoVariavel);
  });
});
