// @vitest-environment jsdom
import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const state=vi.hoisted(()=>({user:{uid:"alice",email:"alice@example.test"},portfolio:{},setDoc:vi.fn(),getDoc:vi.fn(),addDoc:vi.fn(),updateDoc:vi.fn(),login:vi.fn(),pdfSave:vi.fn(),pdfText:vi.fn()}));
vi.mock('../src/hooks/usePortfolio',()=>({usePortfolio:()=>state.portfolio}));
vi.mock('../src/contexts/AuthContext',()=>({useAuth:()=>({user:state.user,loginWithGoogle:state.login,logout:vi.fn()})}));
vi.mock('../src/lib/firebase',()=>({db:{}}));
vi.mock('firebase/firestore',()=>({doc:(...args)=>args,collection:(...args)=>args,setDoc:state.setDoc,getDoc:state.getDoc,addDoc:state.addDoc,updateDoc:state.updateDoc,serverTimestamp:()=>123,onSnapshot:(_ref,cb)=>{cb({docs:[]});return ()=>{};}}));
vi.mock('recharts',()=>({BarChart:()=>null,Bar:()=>null,XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null,ResponsiveContainer:()=>null}));
vi.mock('jspdf',()=>({jsPDF:class { constructor(){return new Proxy({internal:{pageSize:{getWidth:()=>210,getHeight:()=>297}},save:state.pdfSave,text:state.pdfText},{get:(target,key)=>target[key]??(()=>{})});}}}));
import Calculadora from '../src/pages/Calculadora';
import Layout from '../src/components/Layout';
import Simulador from '../src/pages/Simulador';
import DRE from '../src/pages/DRE';
import Relatorios from '../src/pages/Relatorios';
import Login from '../src/pages/Login';
import Onboarding from '../src/pages/Onboarding';
import {calculatePortfolio} from '../src/lib/business/portfolio';
const company={effectiveTaxRatePct:10,fixedCosts:{rent:1000}};
const raw={id:'p',name:'Bolo',inputs:{productName:'Bolo',insumos:20,volumeEstimado:100,margem:30,recipe:{yield:'2',items:[{_key:'i',ingredientId:'i',name:'Farinha',qty:100,baseUnit:'g',costPerBaseUnit:0.4}]}}};
function mount(Component,path='/'){return render(<MemoryRouter initialEntries={[path]}><Component/></MemoryRouter>);}
beforeEach(()=>{
 vi.clearAllMocks();window.alert=vi.fn();
 state.portfolio={company,produtos:calculatePortfolio([raw],company),ingredients:[],loading:false,error:''};
 state.getDoc.mockResolvedValue({exists:()=>true,data:()=>raw});
 state.addDoc.mockResolvedValue({id:'new'});state.updateDoc.mockResolvedValue();state.login.mockResolvedValue();
});
afterEach(cleanup);
describe('Fluxos do piloto com serviços simulados',()=>{
 it('abre edição, restaura receita e salva ingredientes e rendimento',async()=>{
  mount(Calculadora,'/calculadora?id=p');
  await screen.findByText('Editar Produto');
  fireEvent.click(screen.getByRole('button',{name:/Ficha Técnica/i}));
  expect(await screen.findByText('Farinha')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Aplicar à Calculadora'}));
  fireEvent.click(screen.getByRole('button',{name:/Salvar|Atualizar Produto/i}));
  await waitFor(()=>expect(state.updateDoc).toHaveBeenCalled());
  expect(state.updateDoc.mock.calls[0][1].inputs.recipe).toEqual(raw.inputs.recipe);
 });
 it('não duplica um produto novo ao salvar novamente',async()=>{
  mount(Calculadora);
  // Volume is the required numeric input identified by its field container.
  const label=screen.getByText('Volume estimado de vendas / mês');
  fireEvent.change(label.parentElement.querySelector('input'),{target:{value:'100'}});
  fireEvent.click(screen.getByRole('button',{name:/Salvar|Atualizar Produto/i}));
  await waitFor(()=>expect(state.addDoc).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button',{name:/Salvo|Salvar|Atualizar Produto|Produto atualizado/i}));
  await waitFor(()=>expect(state.updateDoc).toHaveBeenCalledTimes(1));
 });
 it('informa erro ao salvar e permite tentar novamente',async()=>{
  state.updateDoc.mockRejectedValueOnce(new Error('offline'));
  mount(Calculadora,'/calculadora?id=p');await screen.findByText('Editar Produto');
  fireEvent.click(screen.getByRole('button',{name:/Salvar|Atualizar Produto/i}));
  await waitFor(()=>expect(window.alert).toHaveBeenCalled());
  expect(screen.getByRole('button',{name:/Salvar|Atualizar Produto/i}).disabled).toBe(false);
 });
 it('mostra todas as áreas no menu mobile',()=>{
  const {container}=mount(Layout);
  const nav=screen.getAllByRole('navigation')[1];
  for(const name of ['Ingredientes','Simulador','Relatórios','Academia']) expect([...nav.querySelectorAll('a')].some(a=>a.textContent===name)).toBe(true);
  expect(container.querySelector('main').className).toContain('min-w-0');
 });
 it('DRE não oferece períodos fictícios e identifica projeção',()=>{
  mount(DRE);expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.getByText(/Não representa vendas realizadas/)).toBeTruthy();
 });
 it('desconto zero preserva margem operacional de 30%',()=>{
  mount(Simulador);fireEvent.change(screen.getByRole('combobox'),{target:{value:'p'}});
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'0'}});
  const row=screen.getByText('Nova margem real').parentElement;
  expect(row.textContent).toContain('30.0%');
 });
 it('gera os dois relatórios PDF',()=>{
  mount(Relatorios);screen.getAllByRole('button',{name:'Gerar PDF'}).forEach(button=>fireEvent.click(button));
  expect(state.pdfSave).toHaveBeenCalledTimes(2);
  expect(state.pdfText).toHaveBeenCalledWith('Bolo',expect.any(Number),expect.any(Number));
 });
 it('mostra falha de leitura em vez de carregar para sempre',()=>{
  state.portfolio={...state.portfolio,error:'Falha de conexão'};mount(DRE);
  expect(screen.getByRole('alert').textContent).toContain('Falha de conexão');
 });
 it('cadastra negócio em três etapas sem substituir outros dados da conta',async()=>{
  mount(Onboarding);
  fireEvent.change(screen.getByPlaceholderText('Ex: Loja da Maria'),{target:{value:'Confeitaria'}});
  fireEvent.click(screen.getByRole('button',{name:'Loja física'}));
  fireEvent.click(screen.getByRole('button',{name:'Próximo'}));
  fireEvent.click(screen.getByRole('button',{name:/MEI/}));
  fireEvent.change(screen.getByPlaceholderText('Opcional'),{target:{value:'0'}});
  fireEvent.click(screen.getByRole('button',{name:'Próximo'}));
  fireEvent.click(screen.getByRole('button',{name:'Começar'}));
  await waitFor(()=>expect(state.setDoc).toHaveBeenCalled());
  expect(state.setDoc.mock.calls[0][1].company.name).toBe('Confeitaria');
  expect(state.setDoc.mock.calls[0][2]).toEqual({merge:true});
 });
 it('informa falha no login Google' ,async()=>{
  state.login.mockRejectedValue(new Error('popup blocked'));mount(Login);
  fireEvent.click(screen.getByRole('button',{name:'Continuar com Google'}));
  await waitFor(()=>expect(window.alert).toHaveBeenCalled());
 });
});
