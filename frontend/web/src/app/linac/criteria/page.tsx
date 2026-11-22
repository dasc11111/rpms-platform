"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Search } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  aprobado:   { label: "Aprobado",   cls: "bg-green-100 text-green-700",  icon: <CheckCircle size={12} /> },
  pendiente:  { label: "Pendiente",  cls: "bg-yellow-100 text-yellow-700", icon: <Clock size={12} /> },
  rechazado:  { label: "Rechazado",  cls: "bg-red-100 text-red-700",       icon: <XCircle size={12} /> },
  vigente:    { label: "Vigente",    cls: "bg-blue-100 text-blue-700",     icon: <CheckCircle size={12} /> },
};

interface Criterion {
  id: number;
  linac_id: number;
  document_reference: string;
  category: string;
  parameter: string;
  tolerance: string;
  action_level: string;
  status: string;
  source: string;
  notes: string;
  created_at: string;
}

export default function LinacCriteriaPage() {
  const [items, setItems] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  async function fetchCriteria() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (linacId) params.set("linacId", linacId);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      const res = await fetch(`/api/linac/criteria?${params}`);
      const data = await res.json();
      setItems(data.items ?? data.criteria ?? data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCriteria(); }, [linacId, category, status]);

  const filtered = items.filter(item => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return item.parameter?.toLowerCase().includes(ql) ||
      item.document_reference?.toLowerCase().includes(ql) ||
      item.category?.toLowerCase().includes(ql) ||
      item.notes?.toLowerCase().includes(ql);
  });

  const categories = [...new Set(items.map(i => i.category))].filter(Boolean);
  const stats = {
    total: items.length,
    aprobados: items.filter(i => i.status === "aprobado" || i.status === "vigente").length,
    pendientes: items.filter(i => i.status === "pendiente").length,
    categorias: categories.length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Criterios Técnicos LINAC</h1>
        <p className="text-sm text-gray-500 mt-1">Criterios de tolerancia y niveles de acción — IPEM Report 81 · AAPM TG-142 · IAEA Safety Report 38</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total criterios</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Aprobados/Vigentes</p>
          <p className="text-2xl font-bold text-green-600">{stats.aprobados}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendientes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Categorías</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.categorias}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[100px]">
          <label className="block text-xs text-gray-500 mb-1">LINAC ID</label>
          <input value={linacId} onChange={e => setLinacId(e.target.value)} className={inp} />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs text-gray-500 mb-1">Categoría</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={inp}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-gray-500 mb-1">Estado</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inp}>
            <option value="">Todos</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Buscar parámetro / referencia</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className={`${inp} pl-8`} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Parámetro</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tolerancia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nivel acción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Referencia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No hay criterios para los filtros seleccionados</td></tr>
              ) : filtered.map(item => {
                const st = STATUS_MAP[item.status] ?? { label: item.status, cls: "bg-gray-100 text-gray-600", icon: null };
                return (
                  <>
                    <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.parameter}</td>
                      <td className="px-4 py-3 text-gray-600">{item.category}</td>
                      <td className="px-4 py-3 font-mono text-indigo-700 font-semibold">{item.tolerance}</td>
                      <td className="px-4 py-3 font-mono text-orange-600">{item.action_level}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{item.document_reference}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>
                          {st.icon}{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {expanded === item.id && (
                      <tr key={`exp-${item.id}`} className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            {item.source && <div><span className="text-xs text-gray-500">Fuente</span><p className="font-medium">{item.source}</p></div>}
                            {item.notes && <div className="col-span-2"><span className="text-xs text-gray-500">Notas</span><p>{item.notes}</p></div>}
                            <div><span className="text-xs text-gray-500">Registrado</span><p>{item.created_at ? new Date(item.created_at).toLocaleDateString("es-CL") : "—"}</p></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — AAPM TG-142 · IPEM Report 81 · IAEA Safety Report 38</p>
        <p className="text-xs text-blue-600">Los criterios de tolerancia deben estar basados en protocolos internacionales vigentes y aprobados por el Físico Médico responsable del servicio.</p>
      </div>
    </div>
  );
}
