"use client";
import { useEffect, useState } from "react";
import { History, ChevronDown, ChevronUp, RefreshCw, User, Clock } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

interface AuditEntry {
  id: number;
  created_at: string;
  actor_email: string;
  action: string;
  details: Record<string, unknown> | string;
}

const ACTION_COLORS: Record<string, string> = {
  create:   "bg-green-100 text-green-700",
  update:   "bg-blue-100 text-blue-700",
  delete:   "bg-red-100 text-red-700",
  approve:  "bg-purple-100 text-purple-700",
  export:   "bg-gray-100 text-gray-700",
  import:   "bg-yellow-100 text-yellow-700",
  promote:  "bg-indigo-100 text-indigo-700",
};

function actionColor(action: string) {
  for (const [key, cls] of Object.entries(ACTION_COLORS)) {
    if (action.toLowerCase().includes(key)) return cls;
  }
  return "bg-gray-100 text-gray-600";
}

export default function LinacHistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(100);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch(`/api/linac/history?limit=${limit}`);
      const data = await res.json();
      setEntries(data.history ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHistory(); }, [limit]);

  const filtered = entries.filter(e =>
    !search ||
    e.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
    e.action?.toLowerCase().includes(search.toLowerCase()) ||
    JSON.stringify(e.details ?? {}).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Auditoría LINAC</h1>
          <p className="text-sm text-gray-500 mt-1">Registro cronológico de todas las acciones realizadas en el módulo LINAC</p>
        </div>
        <button onClick={fetchHistory} disabled={loading}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total eventos</p>
          <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Filtrados</p>
          <p className="text-2xl font-bold text-indigo-600">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Usuarios únicos</p>
          <p className="text-2xl font-bold text-gray-700">{new Set(entries.map(e => e.actor_email)).size}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Período</p>
          <p className="text-sm font-bold text-gray-700">Últimos {limit} eventos</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Buscar en historial</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Acción, usuario, detalles…" className={inp} />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-gray-500 mb-1">Mostrar últimos</label>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} className={inp}>
            <option value={50}>50 eventos</option>
            <option value={100}>100 eventos</option>
            <option value={200}>200 eventos</option>
            <option value={500}>500 eventos</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando historial…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search ? `Sin coincidencias para "${search}"` : "Sin eventos en el historial"}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(e => {
              const details = typeof e.details === "string" ? JSON.parse(e.details || "{}") : (e.details ?? {});
              return (
                <div key={e.id}>
                  <div className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <div className="shrink-0">
                      <History size={16} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${actionColor(e.action)}`}>{e.action}</span>
                        <span className="text-sm text-gray-900 font-medium truncate">{details.module || details.measurementType || details.category || ""}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><User size={10} /> {e.actor_email || "sistema"}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(e.created_at).toLocaleString("es-CL")}</span>
                      </div>
                    </div>
                    {expanded === e.id ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                  </div>
                  {expanded === e.id && (
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                      <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap overflow-auto max-h-48 bg-white border border-gray-200 rounded-lg p-3">
                        {JSON.stringify(details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Trazabilidad — IAEA Safety Standards · DS 3/1985 MINSAL</p>
        <p className="text-xs text-blue-600">El registro de auditoría LINAC es un documento de trazabilidad obligatorio. Todos los eventos se registran automáticamente.</p>
      </div>
    </div>
  );
}
