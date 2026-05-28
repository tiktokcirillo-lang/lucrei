import { useState, useEffect } from "react";
import heic2any from "heic2any";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

const PURCHASE_UNITS = ["kg", "g", "L", "ml", "unidade", "dúzia", "pacote", "caixa"];

function getBaseUnit(pu) {
  const map = { kg: "g", L: "ml", dúzia: "unidade", pacote: "unidade", caixa: "unidade" };
  return map[pu] ?? pu;
}

function convFactor(pu, unitsPerPkg) {
  if (pu === "kg" || pu === "L") return 1000;
  if (pu === "dúzia") return 12;
  if (pu === "pacote" || pu === "caixa") return parseFloat(unitsPerPkg) || 1;
  return 1;
}

function calcCostPerBase(price, qty, pu, unitsPerPkg) {
  const p = parseFloat(price) || 0;
  const q = parseFloat(qty) || 0;
  const f = convFactor(pu, unitsPerPkg);
  if (!q || !f) return 0;
  return p / (q * f);
}

function currency(v) {
  if (!isFinite(v) || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function costPerBaseLabel(v, unit) {
  if (!v || !isFinite(v) || isNaN(v)) return "—";
  let s;
  if (v < 0.001) s = v.toFixed(6);
  else if (v < 0.01) s = v.toFixed(5);
  else if (v < 0.1) s = v.toFixed(4);
  else s = v.toFixed(2);
  return `R$${s.replace(".", ",")} / ${unit}`;
}

const EMPTY_FORM = {
  name: "",
  purchaseUnit: "kg",
  purchaseQty: "1",
  purchasePrice: "",
  unitsPerPackage: "",
};

const CONFIDENCE_COLORS = {
  high: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-red-500/20 text-red-400",
};

function IngredientModal({ initial, editingId, onClose, onSave }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function setF(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const baseUnit = getBaseUnit(form.purchaseUnit);
  const needsPkg = form.purchaseUnit === "pacote" || form.purchaseUnit === "caixa";
  const preview = calcCostPerBase(form.purchasePrice, form.purchaseQty, form.purchaseUnit, form.unitsPerPackage);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.purchasePrice || !form.purchaseQty) return;
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      purchaseUnit: form.purchaseUnit,
      purchaseQty: parseFloat(form.purchaseQty),
      purchasePrice: parseFloat(form.purchasePrice),
      unitsPerPackage: needsPkg ? parseFloat(form.unitsPerPackage) || 1 : null,
      baseUnit,
      costPerBaseUnit: preview,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6">
        <h2 className="text-white font-bold text-lg mb-5">
          {editingId ? "Editar Ingrediente" : "Adicionar Ingrediente"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome</label>
            <input
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-600 text-sm"
              placeholder="Ex: Farinha de trigo"
              value={form.name}
              onChange={(e) => setF("name", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unidade de compra</label>
              <select
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-500 text-sm"
                value={form.purchaseUnit}
                onChange={(e) => setF("purchaseUnit", e.target.value)}
              >
                {PURCHASE_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Base: <span className="text-green-400 font-medium">{baseUnit}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Qtd comprada</label>
              <input
                type="number"
                min="0.001"
                step="any"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500 text-sm"
                placeholder="Ex: 1"
                value={form.purchaseQty}
                onChange={(e) => setF("purchaseQty", e.target.value)}
                required
              />
            </div>
          </div>

          {needsPkg && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Unidades no {form.purchaseUnit}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500 text-sm"
                placeholder="Ex: 10"
                value={form.unitsPerPackage}
                onChange={(e) => setF("unitsPerPackage", e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Preço de compra (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500 text-sm"
              placeholder="Ex: 5.00"
              value={form.purchasePrice}
              onChange={(e) => setF("purchasePrice", e.target.value)}
              required
            />
          </div>

          {preview > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Custo por unidade base</p>
              <p className="text-green-400 font-bold text-lg">
                {costPerBaseLabel(preview, baseUnit)}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold transition"
            >
              {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

async function compressImage(file) {
  console.log("Arquivo recebido:", file.name, file.type, file.size);

  let processedFile = file;

  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  console.log("É HEIC?", isHeic);

  if (isHeic) {
    try {
      console.log("Convertendo HEIC...");
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
      processedFile = Array.isArray(converted) ? converted[0] : converted;
      console.log("HEIC convertido:", processedFile.type, processedFile.size);
    } catch (heicErr) {
      console.error("Erro na conversão HEIC:", heicErr);
      throw new Error("Erro ao converter imagem HEIC");
    }
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const img = new Image();
    const url = URL.createObjectURL(processedFile);
    console.log("URL criada:", url);

    img.onload = () => {
      console.log("Imagem carregada:", img.width, "x", img.height);
      const maxWidth = 1024;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      console.log("Base64 gerado, tamanho:", base64.length);
      resolve(base64);
    };

    img.onerror = (e) => {
      console.error("Erro ao carregar imagem no canvas:", e);
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível carregar a imagem"));
    };

    img.src = url;
  });
}

function ScanModal({ onClose, onImport }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [converting, setConverting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setItems(null);
    setError(null);
    setImagePreview(URL.createObjectURL(file));
    setConverting(true);
    try {
      const compressed = await compressImage(file);
      setImageBase64(compressed);
    } catch (err) {
      setError(err.message);
    } finally {
      setConverting(false);
    }
  }

  async function analyze() {
    if (!imageBase64) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/anthropic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
                {
                  type: "text",
                  text: `Analise este cupom fiscal ou nota de compra brasileiro e extraia todos os itens alimentícios e de insumos. Para cada item retorne SOMENTE um JSON válido sem markdown, sem explicações, apenas o JSON puro no seguinte formato:\n{"items":[{"name":"nome limpo do produto em português","purchaseUnit":"kg|g|L|ml|unidade|dúzia|pacote","purchaseQty":número,"purchasePrice":número,"confidence":"high|medium|low"}]}\nInterprete abreviações comuns de cupons brasileiros. Se não conseguir determinar a unidade com certeza, use "unidade" e marque confidence como "low".`,
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        const errBody = await res.json();
        console.error("Anthropic API error:", errBody);
        throw new Error(errBody?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = data.content?.[0]?.text?.trim() || "";
      const jsonStr = raw.startsWith("{")
        ? raw
        : raw.match(/```(?:json)?\n?([\s\S]+?)\n?```/)?.[1] || raw;
      const parsed = JSON.parse(jsonStr);
      setItems(parsed.items.map((item, i) => ({ ...item, _id: i, _selected: true })));
    } catch (err) {
      console.error("Scan error:", err);
      setError(`Erro: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((item) => (item._id === id ? { ...item, [field]: value } : item))
    );
  }

  function toggleItem(id) {
    setItems((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, _selected: !item._selected } : item
      )
    );
  }

  function resetScan() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setItems(null);
    setImagePreview(null);
    setImageBase64(null);
    setError(null);
  }

  const selectedCount = items?.filter((i) => i._selected).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">📷 Escanear Cupom</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none transition"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {!items && (
            <>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="preview"
                  className="max-h-52 mx-auto rounded-xl object-contain"
                />
              )}

              <input
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                className="hidden"
                id="scan-camera-input"
                onChange={handleFile}
              />
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                id="scan-gallery-input"
                onChange={handleFile}
              />

              {!imagePreview && (
                <div className="text-center py-4">
                  <p className="text-4xl mb-3">🧾</p>
                  <p className="text-gray-400 text-sm">Selecione a foto do cupom fiscal</p>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <label
                  htmlFor="scan-camera-input"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl cursor-pointer font-semibold text-sm transition"
                >
                  📷 Tirar Foto
                </label>
                <label
                  htmlFor="scan-gallery-input"
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-xl cursor-pointer font-semibold text-sm transition"
                >
                  🖼️ Escolher Arquivo
                </label>
              </div>

              {imagePreview && (
                <button
                  onClick={analyze}
                  disabled={converting || analyzing || !imageBase64}
                  className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
                >
                  {converting ? "Convertendo imagem... ⏳" : analyzing ? "Analisando cupom... ⏳" : "Analisar Cupom"}
                </button>
              )}
              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}
            </>
          )}

          {items && (
            <>
              <p className="text-sm text-gray-400">
                {items.length} {items.length === 1 ? "item encontrado" : "itens encontrados"}.
                Selecione os que deseja importar:
              </p>
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div
                    key={item._id}
                    className={`bg-gray-800 rounded-xl p-4 border transition ${
                      item._selected ? "border-green-500/40" : "border-gray-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item._selected}
                        onChange={() => toggleItem(item._id)}
                        className="mt-1 w-4 h-4 accent-green-500 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <div className="flex items-center gap-2">
                          <input
                            value={item.name}
                            onChange={(e) => updateItem(item._id, "name", e.target.value)}
                            className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-green-500 min-w-0"
                          />
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              CONFIDENCE_COLORS[item.confidence] || CONFIDENCE_COLORS.low
                            }`}
                          >
                            {item.confidence}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={item.purchaseUnit}
                            onChange={(e) => updateItem(item._id, "purchaseUnit", e.target.value)}
                            className="bg-gray-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
                          >
                            {PURCHASE_UNITS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.purchaseQty}
                            onChange={(e) =>
                              updateItem(item._id, "purchaseQty", parseFloat(e.target.value) || 0)
                            }
                            className="bg-gray-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
                            placeholder="Qtd"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.purchasePrice}
                            onChange={(e) =>
                              updateItem(item._id, "purchasePrice", parseFloat(e.target.value) || 0)
                            }
                            className="bg-gray-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
                            placeholder="R$"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {items && (
          <div className="p-5 border-t border-gray-800 flex gap-3">
            <button
              onClick={resetScan}
              className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition"
            >
              Nova Análise
            </button>
            <button
              onClick={() => onImport(items.filter((i) => i._selected))}
              disabled={!selectedCount}
              className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold transition"
            >
              Importar ({selectedCount})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Ingredientes() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState([]);
  const [modal, setModal] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [showScan, setShowScan] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, "users", user.uid, "ingredients"),
      (snap) => setIngredients(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  async function saveIngredient(data) {
    if (editTarget) {
      await updateDoc(doc(db, "users", user.uid, "ingredients", editTarget.id), data);
    } else {
      await addDoc(collection(db, "users", user.uid, "ingredients"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
    setModal(null);
    setEditTarget(null);
  }

  async function handleDelete(id) {
    if (!window.confirm("Excluir este ingrediente?")) return;
    await deleteDoc(doc(db, "users", user.uid, "ingredients", id));
  }

  async function importFromScan(items) {
    for (const item of items) {
      const pu = item.purchaseUnit;
      const baseUnit = getBaseUnit(pu);
      const costPerBase = calcCostPerBase(item.purchasePrice, item.purchaseQty, pu, null);
      await addDoc(collection(db, "users", user.uid, "ingredients"), {
        name: item.name,
        purchaseUnit: pu,
        purchaseQty: parseFloat(item.purchaseQty) || 1,
        purchasePrice: parseFloat(item.purchasePrice) || 0,
        unitsPerPackage: null,
        baseUnit,
        costPerBaseUnit: costPerBase,
        createdAt: serverTimestamp(),
      });
    }
    setShowScan(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Ingredientes</h1>
            <p className="text-gray-400 text-sm mt-1">
              Gerencie insumos e calcule custos por unidade base
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowScan(true)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition"
            >
              📷 Escanear Cupom
            </button>
            <button
              onClick={() => { setEditTarget(null); setModal("form"); }}
              className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition"
            >
              + Adicionar Ingrediente
            </button>
          </div>
        </div>

        {ingredients.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <p className="text-5xl mb-4">🥕</p>
            <p className="font-medium text-gray-400 text-lg">Nenhum ingrediente cadastrado</p>
            <p className="text-sm mt-2">
              Adicione ingredientes ou escaneie um cupom para começar
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ingredients.map((ing) => (
              <div key={ing.id} className="bg-gray-900 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm leading-snug flex-1 pr-2">
                    {ing.name}
                  </h3>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditTarget(ing); setModal("form"); }}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(ing.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mb-1">
                  {currency(ing.purchasePrice)} / {ing.purchaseQty}{ing.purchaseUnit}
                </p>
                <p className="text-green-400 font-semibold text-sm">
                  {costPerBaseLabel(ing.costPerBaseUnit, ing.baseUnit)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === "form" && (
        <IngredientModal
          initial={
            editTarget
              ? {
                  name: editTarget.name,
                  purchaseUnit: editTarget.purchaseUnit,
                  purchaseQty: String(editTarget.purchaseQty),
                  purchasePrice: String(editTarget.purchasePrice),
                  unitsPerPackage: editTarget.unitsPerPackage
                    ? String(editTarget.unitsPerPackage)
                    : "",
                }
              : EMPTY_FORM
          }
          editingId={editTarget?.id}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSave={saveIngredient}
        />
      )}

      {showScan && (
        <ScanModal
          onClose={() => setShowScan(false)}
          onImport={importFromScan}
        />
      )}
    </div>
  );
}
