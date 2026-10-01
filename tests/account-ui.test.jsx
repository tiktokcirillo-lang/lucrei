// @vitest-environment jsdom
import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const mocks=vi.hoisted(()=>({api:vi.fn(),reauth:vi.fn(),user:{uid:'alice'},signOut:vi.fn()}));
vi.mock('../src/lib/accountApi',()=>({accountApi:mocks.api}));
vi.mock('../src/lib/firebase',()=>({auth:{currentUser:mocks.user,signOut:mocks.signOut},googleProvider:{}}));
vi.mock('firebase/auth',()=>({reauthenticateWithPopup:mocks.reauth}));
import Conta from '../src/pages/Conta';
beforeEach(()=>{vi.clearAllMocks();mocks.api.mockResolvedValue({enabled:false,plans:[],active:false,status:'none',used:0,limit:0,hasCustomer:false});});
afterEach(cleanup);
describe('conta e assinatura',()=>{
 it('não oferece cobrança enquanto planos estão desativados',async()=>{
  render(<Conta/>);expect(await screen.findByText('Planos ainda não disponíveis para contratação.')).toBeTruthy();expect(screen.queryByRole('button',{name:'Assinar'})).toBeNull();expect(screen.getByRole('button',{name:'Excluir permanentemente'}).disabled).toBe(true);
 });
 it('exige reautenticação antes de pedir exclusão ao servidor',async()=>{
  mocks.reauth.mockRejectedValue(new Error('Identidade não confirmada'));
  render(<Conta/>);await screen.findByText('Sem assinatura ativa');
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'EXCLUIR MINHA CONTA'}});fireEvent.click(screen.getByRole('button',{name:'Excluir permanentemente'}));
  await waitFor(()=>expect(mocks.reauth).toHaveBeenCalled());
  expect(await screen.findByRole('alert')).toBeTruthy();expect(mocks.api.mock.calls.some(c=>c[2]==='DELETE')).toBe(false);
 });
 it('apresenta falha de cobrança sem perder acesso às ações de dados',async()=>{
  mocks.api.mockRejectedValue(new Error('Serviço indisponível'));render(<Conta/>);
  expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.getByRole('button',{name:'Baixar meus dados'})).toBeTruthy();
 });
});
