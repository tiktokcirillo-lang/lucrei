function isProvided(value) {
  return value != null && !(typeof value === "string" && value.trim() === "");
}

function toNumber(value) {
  if (!isProvided(value)) return 0;
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const parsed = typeof normalized === "number" ? normalized : Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumFields(source, fields) {
  return fields.reduce((total, field) => total + toNumber(source?.[field]), 0);
}

export function resolveProductTaxRateOverride(productInputs = {}) {
  if (isProvided(productInputs.effectiveTaxRatePctOverride)) {
    return productInputs.effectiveTaxRatePctOverride;
  }

  if (isProvided(productInputs.taxaImpostosOverride)) {
    return productInputs.taxaImpostosOverride;
  }

  return "";
}

export function resolveEffectiveTaxRatePct({ productInputs = {}, company = {} } = {}) {
  const productOverride = resolveProductTaxRateOverride(productInputs);
  if (isProvided(productOverride)) return productOverride;
  if (isProvided(company?.effectiveTaxRatePct)) return company.effectiveTaxRatePct;
  return "";
}

export function getFixedCostsTotal(company = {}) {
  return Object.values(company?.fixedCosts ?? {}).reduce(
    (total, value) => total + toNumber(value),
    0
  );
}

export function getPortfolioAllocationContext({
  products = [],
  currentProductId = null,
  currentVolume = 0,
} = {}) {
  let otherProductsVolume = 0;
  let productsWithoutValidVolume = 0;

  for (const product of products) {
    if (currentProductId && product.id === currentProductId) continue;

    const volume = toNumber(product?.inputs?.volumeEstimado);
    if (volume > 0) {
      otherProductsVolume += volume;
    } else {
      productsWithoutValidVolume += 1;
    }
  }

  const parsedCurrentVolume = toNumber(currentVolume);

  return {
    volumeTotalMensalParaRateio:
      (parsedCurrentVolume > 0 ? parsedCurrentVolume : 0) + otherProductsVolume,
    otherProductsVolume,
    productsWithoutValidVolume,
    hasProductsWithoutValidVolume: productsWithoutValidVolume > 0,
  };
}

export function buildFinancialCoreInput({
  form = {},
  company = {},
  volumeTotalMensalParaRateio,
} = {}) {
  const input = {
    cmv: sumFields(form, ["insumos", "embalagem", "freteEntrada"]),
    outrosCustosVariaveisMonetarios: sumFields(form, ["freteSaida", "cac"]),
    custosFixosMensais: getFixedCostsTotal(company),
    volumeMensalEstimado: toNumber(form.volumeEstimado),
    effectiveTaxRatePct: resolveEffectiveTaxRatePct({
      productInputs: form,
      company,
    }),
    taxaVariavelPct: sumFields(form, [
      "taxaPlataforma",
      "taxaGateway",
      "provisaoDevolucoes",
    ]),
    margemOperacionalAlvoPct: form.margem,
  };

  if (isProvided(volumeTotalMensalParaRateio)) {
    input.volumeTotalMensalParaRateio = toNumber(volumeTotalMensalParaRateio);
  }

  return input;
}

export function buildProductInputsPayload(form = {}) {
  const canonicalInputs = { ...form };
  delete canonicalInputs.taxaImpostosOverride;
  return canonicalInputs;
}

export function buildFinancialResultsPayload(metrics) {
  return {
    ...metrics,
    financialCoreVersion: 2,
    precoSugerido: metrics.precoSugerido,
    precoMinimo: metrics.precoMinimoOperacional,
    margemReal: metrics.margemOperacionalEstimadaPct,
    markup: metrics.markupSobreCustoTotal,
    margemContribuicao: metrics.margemContribuicaoUnit,
    pontoEquilibrio: metrics.pontoEquilibrioUnidades,
    cmv: metrics.cmvUnitario,
    custoVariavelR: metrics.outrosCustosVariaveisMonetariosUnit,
    custoFixoUnidade: metrics.custoFixoRateadoPorUnidade,
    ctu: metrics.custoTotalUnitarioEstimado,
    taxRatePct: metrics.effectiveTaxRatePct,
  };
}
