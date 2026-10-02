import {describe,it,expect} from 'vitest';
import {validateImage,validateReceipt} from '../server/receipts.js';
describe('scanner restrito a cupons',()=>{
 const image=Buffer.from([255,216,255,224]).toString('base64');
 it('aceita somente JPEG e recusa mensagens e prompts do cliente',()=>{
  expect(validateImage({image})).toBe(image);
  for(const body of [{image,messages:[]},{image:'abc'},{image:'x'.repeat(2800001)},{}])expect(()=>validateImage(body)).toThrow();
 });
 it('valida resposta e remove campos extras do modelo',()=>{
  const item={name:'Farinha',purchaseUnit:'kg',purchaseQty:1,purchasePrice:9,confidence:'high',script:'bad'};
  expect(validateReceipt({items:[item]}).items[0]).not.toHaveProperty('script');
  for(const value of [0,-1,'1'])expect(()=>validateReceipt({items:[{...item,purchaseQty:value}]})).toThrow();
  expect(()=>validateReceipt({items:[{...item,purchasePrice:-10}]})).toThrow();
 });
});
