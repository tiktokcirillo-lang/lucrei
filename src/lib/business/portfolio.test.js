import {describe,it,expect} from 'vitest';
import {calculatePortfolio,calculateStatement,calculateBundle} from './portfolio';
import {calculateDashboardStats} from './dashboard';
const company={effectiveTaxRatePct:10,fixedCosts:{rent:1000}};
const product={id:'a',inputs:{insumos:20,volumeEstimado:100,margem:30,taxaGateway:5}};
describe('Projeções integradas',()=>{
 it('desconta fixos e mantém dashboard e DRE iguais',()=>{
  const products=calculatePortfolio([product],company);
  const statement=calculateStatement(products,company);
  expect(calculateDashboardStats(products,1000).resultadoOperacionalEstimado).toBeCloseTo(statement.lucroLiquido);
  expect(statement.lucroLiquido).toBeCloseTo(statement.receitaBruta*0.3);
 });
 it('recalcula todos os preços quando o portfólio ou a empresa muda',()=>{
  const one=calculatePortfolio([product],company)[0];
  const two=calculatePortfolio([product,{...product,id:'b'}],company)[0];
  expect(two.results.custoFixoUnidade).toBe(5);
  expect(two.results.precoSugerido).toBeLessThan(one.results.precoSugerido);
  expect(calculatePortfolio([product],{...company,fixedCosts:{rent:2000}})[0].results.precoSugerido).toBeGreaterThan(one.results.precoSugerido);
 });
 it('combo sem desconto preserva contribuição e margem incluindo impostos e taxas',()=>{
  const products=calculatePortfolio([product,{...product,id:'b'}],company);
  const price=products.reduce((s,p)=>s+p.results.precoSugerido,0);
  const bundle=calculateBundle(products,price);
  expect(bundle.contribution).toBeCloseTo(products.reduce((s,p)=>s+p.results.margemContribuicao,0));
  expect(bundle.margin).toBeCloseTo(30);
 });
 it('atualiza custo da receita com ingrediente atual, preservando último custo se excluído',()=>{
  const p={...product,inputs:{...product.inputs,recipe:{yield:2,items:[{ingredientId:'flour',qty:100,costPerBaseUnit:0.1}]}}};
  expect(calculatePortfolio([p],company,[{id:'flour',costPerBaseUnit:0.2}])[0].results.cmv).toBe(10);
  expect(calculatePortfolio([p],company,[])[0].results.cmv).toBe(5);
 });
 it('recusa custo malformado ou negativo',()=>{
  for(const insumos of ['abc',-1]) expect(calculatePortfolio([{...product,inputs:{...product.inputs,insumos}}],company)[0].calculation.valid).toBe(false);
 });
});
