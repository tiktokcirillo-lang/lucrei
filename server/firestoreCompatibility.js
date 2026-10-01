const COMPANY_KEYS = [
  "name",
  "productType",
  "salesChannel",
  "taxRegime",
  "effectiveTaxRatePct",
  "fixedCosts",
];
const FIXED_COST_KEYS = ["rent", "employees", "accountant", "energy", "internet", "other"];
const PRODUCT_KEYS = ["name", "inputs", "results", "createdAt"];
const INPUT_KEYS = [
  "productName",
  "insumos",
  "embalagem",
  "freteEntrada",
  "taxaPlataforma",
  "taxaGateway",
  "freteSaida",
  "cac",
  "provisaoDevolucoes",
  "volumeEstimado",
  "effectiveTaxRatePctOverride",
  "taxaImpostosOverride",
  "margem",
  "recipe",
];
const INGREDIENT_KEYS = [
  "name",
  "purchaseUnit",
  "purchaseQty",
  "purchasePrice",
  "unitsPerPackage",
  "baseUnit",
  "costPerBaseUnit",
  "createdAt",
];
const PURCHASE_UNITS = ["kg", "g", "L", "ml", "unidade", "dúzia", "pacote", "caixa"];

function object(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function extraKeys(value, allowed) {
  return object(value) ? Object.keys(value).filter((key) => !allowed.includes(key)) : [];
}

function shortText(value, max) {
  return typeof value === "string" && value.length <= max;
}

function money(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
}

function numberInput(value) {
  return money(value) || (
    typeof value === "string" &&
    value.length <= 20 &&
    /^[0-9]*([.,][0-9]+)?$/.test(value)
  );
}

function add(condition, issues, code) {
  if (!condition) issues.push(code);
}

export function validateUserDocument(data) {
  const issues = [];
  add(object(data), issues, "document_not_map");
  if (!object(data)) return issues;
  const extra = extraKeys(data, ["company", "createdAt"]);
  if (extra.length) issues.push(`extra_user_fields:${extra.join(",")}`);
  const company = data.company;
  add(object(company), issues, "company_not_map");
  if (!object(company)) return issues;
  const companyExtra = extraKeys(company, COMPANY_KEYS);
  if (companyExtra.length) issues.push(`extra_company_fields:${companyExtra.join(",")}`);
  add(shortText(company.name, 160), issues, "invalid_company_name");
  add(shortText(company.productType, 80), issues, "invalid_product_type");
  add(shortText(company.salesChannel, 80), issues, "invalid_sales_channel");
  add(["mei", "simples", "presumido", "real", "unknown"].includes(company.taxRegime), issues, "invalid_tax_regime");
  add(company.effectiveTaxRatePct === "" || (money(company.effectiveTaxRatePct) && company.effectiveTaxRatePct < 100), issues, "invalid_tax_rate");
  add(object(company.fixedCosts), issues, "fixed_costs_not_map");
  if (object(company.fixedCosts)) {
    const costsExtra = extraKeys(company.fixedCosts, FIXED_COST_KEYS);
    if (costsExtra.length) issues.push(`extra_fixed_cost_fields:${costsExtra.join(",")}`);
    for (const key of FIXED_COST_KEYS) add(money(company.fixedCosts[key] ?? 0), issues, `invalid_fixed_cost:${key}`);
  }
  return issues;
}

function validateRecipe(recipe, issues) {
  if (recipe == null) return;
  add(object(recipe), issues, "recipe_not_map");
  if (!object(recipe)) return;
  const extra = extraKeys(recipe, ["yield", "items"]);
  if (extra.length) issues.push(`extra_recipe_fields:${extra.join(",")}`);
  add(numberInput(recipe.yield), issues, "invalid_recipe_yield");
  add(Array.isArray(recipe.items) && recipe.items.length <= 80, issues, "invalid_recipe_items");
}

export function validateProductDocument(data) {
  const issues = [];
  add(object(data), issues, "document_not_map");
  if (!object(data)) return issues;
  const extra = extraKeys(data, PRODUCT_KEYS);
  if (extra.length) issues.push(`extra_product_fields:${extra.join(",")}`);
  add(shortText(data.name, 160), issues, "invalid_product_name");
  add(object(data.inputs), issues, "inputs_not_map");
  if (object(data.inputs)) {
    const inputsExtra = extraKeys(data.inputs, INPUT_KEYS);
    if (inputsExtra.length) issues.push(`extra_input_fields:${inputsExtra.join(",")}`);
    add(shortText(data.inputs.productName ?? "", 160), issues, "invalid_input_product_name");
    for (const key of INPUT_KEYS.filter((key) => !["productName", "recipe"].includes(key))) {
      add(numberInput(data.inputs[key] ?? ""), issues, `invalid_input:${key}`);
    }
    validateRecipe(data.inputs.recipe, issues);
  }
  add(object(data.results) && Object.keys(data.results).length <= 60, issues, "invalid_results");
  return issues;
}

export function validateIngredientDocument(data) {
  const issues = [];
  add(object(data), issues, "document_not_map");
  if (!object(data)) return issues;
  const extra = extraKeys(data, INGREDIENT_KEYS);
  if (extra.length) issues.push(`extra_ingredient_fields:${extra.join(",")}`);
  add(shortText(data.name, 160), issues, "invalid_ingredient_name");
  add(PURCHASE_UNITS.includes(data.purchaseUnit), issues, "invalid_purchase_unit");
  add(money(data.purchaseQty) && data.purchaseQty > 0, issues, "invalid_purchase_qty");
  add(money(data.purchasePrice), issues, "invalid_purchase_price");
  add(data.unitsPerPackage == null || (money(data.unitsPerPackage) && data.unitsPerPackage > 0), issues, "invalid_units_per_package");
  add(["g", "ml", "unidade"].includes(data.baseUnit), issues, "invalid_base_unit");
  add(money(data.costPerBaseUnit), issues, "invalid_cost_per_base_unit");
  return issues;
}
