const MONEY_FIELDS = [
  "cmv",
  "outrosCustosVariaveisMonetarios",
  "custosFixosMensais",
];

const PERCENTAGE_FIELDS = [
  "effectiveTaxRatePct",
  "taxaVariavelPct",
  "margemOperacionalAlvoPct",
];

function issue(code, field, message) {
  return { code, field, message };
}

function parseRequiredNumber(value, field, errors) {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    errors.push(issue("REQUIRED_VALUE", field, `${field} deve ser informado.`));
    return null;
  }

  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const parsed = typeof normalized === "number" ? normalized : Number(normalized);

  if (!Number.isFinite(parsed)) {
    errors.push(issue("INVALID_NUMBER", field, `${field} deve ser um número válido.`));
    return null;
  }

  return parsed;
}

function parseOptionalNumber(value, field, errors) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  return parseRequiredNumber(value, field, errors);
}

function addRangeErrors(values, errors) {
  for (const field of MONEY_FIELDS) {
    const value = values[field];
    if (value != null && value < 0) {
      errors.push(issue("NEGATIVE_MONEY", field, `${field} não pode ser negativo.`));
    }
  }

  if (values.precoVenda != null && values.precoVenda < 0) {
    errors.push(issue("NEGATIVE_MONEY", "precoVenda", "precoVenda não pode ser negativo."));
  }

  for (const field of PERCENTAGE_FIELDS) {
    const value = values[field];
    if (value != null && (value < 0 || value > 100)) {
      errors.push(
        issue("INVALID_PERCENTAGE", field, `${field} deve estar entre 0% e 100%.`)
      );
    }
  }

  if (values.volumeMensalEstimado != null && values.volumeMensalEstimado < 0) {
    errors.push(
      issue(
        "NEGATIVE_VOLUME",
        "volumeMensalEstimado",
        "volumeMensalEstimado não pode ser negativo."
      )
    );
  }

  if (
    values.volumeTotalMensalParaRateio != null &&
    values.volumeTotalMensalParaRateio < 0
  ) {
    errors.push(
      issue(
        "NEGATIVE_VOLUME",
        "volumeTotalMensalParaRateio",
        "volumeTotalMensalParaRateio não pode ser negativo."
      )
    );
  }
}

function emptyMetrics() {
  return {
    cmvUnitario: null,
    outrosCustosVariaveisMonetariosUnit: null,
    custosVariaveisMonetariosTotaisUnit: null,
    effectiveTaxRatePct: null,
    taxaVariavelPct: null,
    margemOperacionalAlvoPct: null,
    custosFixosMensais: null,
    volumeMensalEstimadoProduto: null,
    volumeTotalMensalParaRateio: null,
    fixedCostAllocationMethod: null,
    custoFixoRateadoPorUnidade: null,
    custoTotalUnitarioEstimado: null,
    precoSugerido: null,
    precoMinimoOperacional: null,
    precoPisoVariavel: null,
    precoVendaAvaliado: null,
    margemContribuicaoUnit: null,
    margemContribuicaoPct: null,
    resultadoOperacionalEstimadoUnit: null,
    margemOperacionalEstimadaPct: null,
    markupSobreCustoTotal: null,
    pontoEquilibrioUnidades: null,
    pontoEquilibrioFaturamento: null,
  };
}

/**
 * Calcula preços, margens e ponto de equilíbrio sem arredondar valores intermediários.
 * Todas as taxas de entrada e métricas percentuais de saída usam pontos percentuais
 * (por exemplo, 8 representa 8%). Se `precoVenda` não for informado, as margens são
 * avaliadas usando o preço sugerido.
 */
export function calculateFinancialCore(input = {}) {
  const errors = [];
  const warnings = [];
  const hasPortfolioAllocationVolume =
    input.volumeTotalMensalParaRateio != null &&
    !(typeof input.volumeTotalMensalParaRateio === "string" &&
      input.volumeTotalMensalParaRateio.trim() === "");
  const outrosCustosVariaveisMonetariosInput =
    input.outrosCustosVariaveisMonetarios ?? input.custosVariaveisMonetarios;
  const values = {
    cmv: parseRequiredNumber(input.cmv, "cmv", errors),
    outrosCustosVariaveisMonetarios: parseRequiredNumber(
      outrosCustosVariaveisMonetariosInput,
      "outrosCustosVariaveisMonetarios",
      errors
    ),
    custosFixosMensais: parseRequiredNumber(
      input.custosFixosMensais,
      "custosFixosMensais",
      errors
    ),
    volumeMensalEstimado: parseRequiredNumber(
      input.volumeMensalEstimado,
      "volumeMensalEstimado",
      errors
    ),
    volumeTotalMensalParaRateio: parseOptionalNumber(
      input.volumeTotalMensalParaRateio,
      "volumeTotalMensalParaRateio",
      errors
    ),
    effectiveTaxRatePct: parseRequiredNumber(
      input.effectiveTaxRatePct,
      "effectiveTaxRatePct",
      errors
    ),
    taxaVariavelPct: parseRequiredNumber(
      input.taxaVariavelPct,
      "taxaVariavelPct",
      errors
    ),
    margemOperacionalAlvoPct: parseRequiredNumber(
      input.margemOperacionalAlvoPct,
      "margemOperacionalAlvoPct",
      errors
    ),
    precoVenda: parseOptionalNumber(input.precoVenda, "precoVenda", errors),
  };

  addRangeErrors(values, errors);

  const usesLegacyFixedCostAllocationFallback = !hasPortfolioAllocationVolume;
  const volumeTotalMensalParaRateio = usesLegacyFixedCostAllocationFallback
    ? values.volumeMensalEstimado
    : values.volumeTotalMensalParaRateio;

  if (usesLegacyFixedCostAllocationFallback) {
    warnings.push(
      issue(
        "LEGACY_FIXED_COST_ALLOCATION_FALLBACK",
        "volumeTotalMensalParaRateio",
        "O volume total do portfólio não foi informado; foi usado o volume do produto como fallback legado."
      )
    );
  }

  if (
    values.custosFixosMensais > 0 &&
    volumeTotalMensalParaRateio != null &&
    volumeTotalMensalParaRateio <= 0
  ) {
    errors.push(
      issue(
        "TOTAL_VOLUME_REQUIRED_FOR_FIXED_COSTS",
        "volumeTotalMensalParaRateio",
        "O volume total mensal do portfólio deve ser maior que zero para ratear custos fixos."
      )
    );
  }

  if (
    volumeTotalMensalParaRateio != null &&
    values.volumeMensalEstimado != null &&
    volumeTotalMensalParaRateio >= 0 &&
    volumeTotalMensalParaRateio < values.volumeMensalEstimado
  ) {
    errors.push(
      issue(
        "TOTAL_VOLUME_BELOW_PRODUCT_VOLUME",
        "volumeTotalMensalParaRateio",
        "O volume total mensal do portfólio não pode ser menor que o volume do produto atual."
      )
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, metrics: emptyMetrics() };
  }

  const aliquotaImpostos = values.effectiveTaxRatePct / 100;
  const taxasVenda = values.taxaVariavelPct / 100;
  const margemOperacionalAlvo = values.margemOperacionalAlvoPct / 100;
  const percentualVendaTotal = aliquotaImpostos + taxasVenda;
  const denominadorSemMargem = 1 - percentualVendaTotal;
  const denominadorPrecoSugerido = denominadorSemMargem - margemOperacionalAlvo;

  if (denominadorSemMargem <= 0) {
    errors.push(
      issue(
        "NON_POSITIVE_VARIABLE_DENOMINATOR",
        "taxaVariavelPct",
        "A soma de impostos e taxas deve ser menor que 100%."
      )
    );
  }

  if (denominadorPrecoSugerido <= 0) {
    errors.push(
      issue(
        "NON_POSITIVE_TARGET_DENOMINATOR",
        "margemOperacionalAlvoPct",
        "A soma de impostos, taxas e margem operacional alvo deve ser menor que 100%."
      )
    );
  }

  const custosVariaveisMonetariosTotaisUnit =
    values.cmv + values.outrosCustosVariaveisMonetarios;
  const custoFixoRateadoPorUnidade =
    values.custosFixosMensais === 0
      ? 0
      : values.custosFixosMensais / volumeTotalMensalParaRateio;
  const custoTotalUnitarioEstimado =
    custosVariaveisMonetariosTotaisUnit + custoFixoRateadoPorUnidade;

  const precoPisoVariavel =
    denominadorSemMargem > 0
      ? custosVariaveisMonetariosTotaisUnit / denominadorSemMargem
      : null;
  const precoMinimoOperacional =
    denominadorSemMargem > 0
      ? custoTotalUnitarioEstimado / denominadorSemMargem
      : null;
  const precoSugerido =
    denominadorPrecoSugerido > 0
      ? custoTotalUnitarioEstimado / denominadorPrecoSugerido
      : null;
  const precoVendaAvaliado = values.precoVenda ?? precoSugerido;

  let margemContribuicaoUnit = null;
  let margemContribuicaoPct = null;
  let resultadoOperacionalEstimadoUnit = null;
  let margemOperacionalEstimadaPct = null;
  let markupSobreCustoTotal = null;
  let pontoEquilibrioUnidades = null;
  let pontoEquilibrioFaturamento = null;

  if (precoVendaAvaliado != null) {
    margemContribuicaoUnit =
      precoVendaAvaliado * denominadorSemMargem - custosVariaveisMonetariosTotaisUnit;
    resultadoOperacionalEstimadoUnit =
      margemContribuicaoUnit - custoFixoRateadoPorUnidade;

    if (precoVendaAvaliado > 0) {
      margemContribuicaoPct = (margemContribuicaoUnit / precoVendaAvaliado) * 100;
      margemOperacionalEstimadaPct =
        (resultadoOperacionalEstimadoUnit / precoVendaAvaliado) * 100;
    }

    if (custoTotalUnitarioEstimado > 0) {
      markupSobreCustoTotal = precoVendaAvaliado / custoTotalUnitarioEstimado;
    }

    if (margemContribuicaoUnit > 0) {
      pontoEquilibrioUnidades = Math.ceil(
        values.custosFixosMensais / margemContribuicaoUnit
      );

      if (margemContribuicaoPct > 0) {
        pontoEquilibrioFaturamento =
          values.custosFixosMensais / (margemContribuicaoPct / 100);
      }
    } else {
      errors.push(
        issue(
          "NON_POSITIVE_CONTRIBUTION_MARGIN",
          "precoVenda",
          "A margem de contribuição deve ser positiva para calcular o ponto de equilíbrio."
        )
      );
    }
  }

  if (
    precoVendaAvaliado != null &&
    precoPisoVariavel != null &&
    precoVendaAvaliado < precoPisoVariavel
  ) {
    warnings.push(
      issue(
        "PRICE_BELOW_VARIABLE_FLOOR",
        "precoVenda",
        "O preço avaliado não cobre todos os custos variáveis."
      )
    );
  } else if (
    precoVendaAvaliado != null &&
    precoMinimoOperacional != null &&
    precoVendaAvaliado < precoMinimoOperacional
  ) {
    warnings.push(
      issue(
        "PRICE_BELOW_OPERATIONAL_MINIMUM",
        "precoVenda",
        "O preço avaliado cobre os custos variáveis, mas não o custo fixo rateado."
      )
    );
  }

  const metrics = {
    cmvUnitario: values.cmv,
    outrosCustosVariaveisMonetariosUnit: values.outrosCustosVariaveisMonetarios,
    custosVariaveisMonetariosTotaisUnit,
    effectiveTaxRatePct: values.effectiveTaxRatePct,
    taxaVariavelPct: values.taxaVariavelPct,
    margemOperacionalAlvoPct: values.margemOperacionalAlvoPct,
    custosFixosMensais: values.custosFixosMensais,
    volumeMensalEstimadoProduto: values.volumeMensalEstimado,
    volumeTotalMensalParaRateio,
    fixedCostAllocationMethod: "unit_volume",
    custoFixoRateadoPorUnidade,
    custoTotalUnitarioEstimado,
    precoSugerido,
    precoMinimoOperacional,
    precoPisoVariavel,
    precoVendaAvaliado,
    margemContribuicaoUnit,
    margemContribuicaoPct,
    resultadoOperacionalEstimadoUnit,
    margemOperacionalEstimadaPct,
    markupSobreCustoTotal,
    pontoEquilibrioUnidades,
    pontoEquilibrioFaturamento,
  };

  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      metrics[key] = null;
    }
  }

  return { valid: errors.length === 0, errors, warnings, metrics };
}
