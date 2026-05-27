import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";

const CATEGORIES = ["Todos", "Precificação", "Impostos", "Gestão", "Vendas", "Empreendedorismo"];

function TypeBadge({ type }) {
  if (type === "video") {
    return (
      <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
        VIDEO
      </span>
    );
  }
  return (
    <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
      PDF
    </span>
  );
}

function ContentCard({ item }) {
  const hasCover = !!item.cover;

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden flex flex-col hover:ring-1 hover:ring-green-500/40 transition">
      {/* Cover */}
      <div className="relative w-full aspect-video">
        {hasCover ? (
          <img
            src={item.cover}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-900 to-gray-900 flex items-center justify-center">
            <span className="text-4xl opacity-40">🎓</span>
          </div>
        )}
        <TypeBadge type={item.type} />
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <p className="text-xs text-green-400 font-medium mb-1">{item.category}</p>
          <h3 className="text-sm font-semibold text-white leading-snug mb-1">{item.title}</h3>
          <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition"
        >
          {item.type === "video" ? "Assistir" : "Baixar"}
        </a>
      </div>
    </div>
  );
}

export default function Academia() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Todos");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "academy"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered =
    category === "Todos" ? items : items.filter((i) => i.category === category);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Carregando Academia...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Academia Lucrei 🎓</h1>
          <p className="text-gray-400 text-sm">Aprenda a precificar, lucrar e crescer</p>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                category === cat
                  ? "bg-green-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid or empty state */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4">🎓</span>
            <p className="text-gray-400 text-sm max-w-xs">
              Conteúdo em breve! Estamos preparando materiais exclusivos para você.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
