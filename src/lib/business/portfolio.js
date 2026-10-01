import { calculateFinancialCore } from './financialCore';
import { buildFinancialCoreInput, buildFinancialResultsPayload, getFixedCostsTotal } from './calculatorFinancialAdapter';

export function calculatePortfolio(products, company, ingredients = []) {
  const volume = products.reduce((sum, p) => sum + Math.max(0, Number(p.inputs?.volumeEstimado) || 0), 0);
  return products.map(p => {
    const inputs = { ...p.inputs };
    if (inputs.recipe?.items?.length) {
      inputs.insumos = recipeCost(inputs.recipe, ingredients);
    }
    const calculation = calculateFinancialCore(buildFinancialCoreInput({form: inputs, company, volumeTotalMensalParaRateio: volume}));
    return {...p, inputs, calculation, results: calculation.valid ? buildFinancialResultsPayload(calculation.metrics) : {}};
  });
}

export function calculateStatement(products, company) {
  let receitaBruta = 0, deducoesFiscais = 0, cmvTotal = 0, custosVariaveisTotal = 0;
  for (const p of products) {
    const r = p.results;
    const vol = Number(p.inputs?.volumeEstimado) || 0;
    receitaBruta += (r.precoSugerido || 0) * vol;
    deducoesFiscais += (r.precoSugerido || 0) * (r.taxRatePct || 0) / 100 * vol;
    cmvTotal += (r.cmv || 0) * vol;
    custosVariaveisTotal += ((r.custoVariavelR || 0) + (r.precoSugerido || 0) * (r.taxaVariavelPct || 0) / 100) * vol;
  }
  const despesasOp = getFixedCostsTotal(company);
  const receitaLiquida = receitaBruta - deducoesFiscais;
  const lucroBruto = receitaLiquida - cmvTotal;
  const contribution = lucroBruto - custosVariaveisTotal;
  const lucroLiquido = contribution - despesasOp;
  const peReais = contribution > 0 ? despesasOp * receitaBruta / contribution : null;
  const vol = products.reduce((sum,p) => sum + (Number(p.inputs?.volumeEstimado) || 0),0);
  return {receitaBruta, deducoesFiscais, cmvTotal, custosVariaveisTotal, despesasOp, receitaLiquida, lucroBruto, lucroLiquido,
    margemLiquida: receitaBruta > 0 ? lucroLiquido / receitaBruta * 100 : null,
    peReais, peUnidades: peReais != null && receitaBruta > 0 ? Math.ceil(peReais * vol / receitaBruta) : null};
}

export function calculateBundle(products, price) {
  const separate = products.reduce((s,p) => s + (p.results.precoSugerido || 0),0);
  const costs = products.reduce((s,p) => s + p.results.cmv + p.results.custoVariavelR,0);
  const fixed = products.reduce((s,p) => s + p.results.custoFixoUnidade,0);
  const rate = separate > 0 ? products.reduce((s,p) => s + p.results.precoSugerido * (p.results.taxRatePct + p.results.taxaVariavelPct) / 100,0) / separate : 0;
  const contribution = price * (1-rate) - costs;
  return {contribution, margin: price > 0 ? (contribution-fixed)/price*100 : null};
}

export function recipeCost(recipe, ingredients = []) {
  if (!(Number(recipe.yield) > 0)) return NaN;
  return recipe.items.reduce((sum, item) => {
    const ingredient = ingredients.find(i => i.id === item.ingredientId && (!item.baseUnit || i.baseUnit === item.baseUnit));
    const cost = Number(ingredient?.costPerBaseUnit ?? item.costPerBaseUnit);
    const qty = Number(item.qty);
    if (cost < 0 || qty <= 0) return NaN;
    return sum + qty * cost;
  }, 0) / Number(recipe.yield);
}

export function calculateDiscount(product, discount) {
  const r = product.results;
  return calculateFinancialCore({
    cmv:r.cmv, outrosCustosVariaveisMonetarios:r.custoVariavelR,
    custosFixosMensais:r.custosFixosMensais, volumeMensalEstimado:product.inputs.volumeEstimado,
    volumeTotalMensalParaRateio:r.volumeTotalMensalParaRateio,
    effectiveTaxRatePct:r.taxRatePct,taxaVariavelPct:r.taxaVariavelPct,
    margemOperacionalAlvoPct:product.inputs.margem,
    precoVenda:r.precoSugerido*(1-discount/100),
  }).metrics;
}
