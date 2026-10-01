import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { calculatePortfolio } from '../lib/business/portfolio';

export function usePortfolio() {
  const { user } = useAuth();
  const [state, setState] = useState({});
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const receive = (key, value) => setState(previous => ({...(previous.uid === uid ? previous : {}), uid, [key]: value}));
    const fail = () => receive('error', 'Não foi possível carregar os dados. Confira a conexão e recarregue a página.');
    const stops = [
      onSnapshot(doc(db, 'users', uid), snap => receive('company', snap.data()?.company ?? {}), fail),
      onSnapshot(collection(db, 'users', uid, 'products'), snap => receive('products', snap.docs.map(d => ({...d.data(),id:d.id}))), fail),
      onSnapshot(collection(db, 'users', uid, 'ingredients'), snap => receive('ingredients', snap.docs.map(d => ({...d.data(),id:d.id}))), fail),
    ];
    return () => stops.forEach(stop => stop());
  }, [user]);
  const ready = state.uid === user?.uid && state.products && state.company && state.ingredients;
  const produtos = useMemo(() => ready ? calculatePortfolio(state.products,state.company,state.ingredients) : [], [ready,state]);
  const invalid = produtos.some(p => !p.calculation.valid);
  const currentState = state.uid === user?.uid ? state : {};
  const calculationError = invalid ? 'Há produtos com dados inválidos. Corrija-os na Calculadora antes de usar as projeções.' : '';
  return {
    produtos,
    rawProducts: currentState.products ?? [],
    ingredients: currentState.ingredients ?? [],
    company: currentState.company ?? {},
    loading: !ready && !state.error,
    loadError: currentState.error ?? '',
    calculationError,
    error: currentState.error || calculationError,
  };
}
