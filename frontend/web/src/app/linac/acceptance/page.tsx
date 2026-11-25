"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Plus } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  aprobado:    { label: "Aprobado",    cls: "bg-green-100 text-green-700",  icon: <CheckCircle size={12} /> },
  pendiente:   { label: "Pendiente",   cls: "bg-yellow-100 text-yellow-700", icon: <Clock size={12} /> },
  rechazado:   { label: "Rechazado",   cls: "bg-red-100 text-red-700",       icon: <XCircle size={12} /> },
  en_proceso:  { label: "En Proceso",  cls: "bg-blue-100 text-blue-700",     icon: <Clock size={12} /> },
  condicional: { label: "Condicional", cls: "bg-orange-100 text-orange-700", icon: <Clock size={12} /> },
};

const LINAC_CATEGORIES = ["dosimetria", "geometria", "dosis_profundidad", "perfiles", "mlc", "imrt", "sbrt", "verificacion_independiente", "otro"];

interface AcceptanceTest {
  id: number;
  linac_id: number;
  protocol_reference: string;
  category: string;
  test_name: string;
  expected_value: string;
  measured_value: string;
  tolerance: string;
  result: string;
  status: string;
  responsible: string;
  test_date: string;
  notes: string;
}

export default function LinacAcceptancePage() {
  const [items, setItems] = useState<AcceptanceTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    linacId: "1", protocolReference: "", category: "dosimetria", testName: "",
    expectedValue: "", measuredValue: "", tolerance: "", result: "",
    status: "pendiente", responsible: "",
    testDate: new Date().toISOString().slice(0, 10), notes: "",
  });

  async function fetchAcceptance() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (linacId) params.set("linacId", linacId);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      const res = await fetch(`/api/linac/acceptance?${params}`);
      const data = await res.json();
      setItems(data.items ?? data.tests ?? data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAcceptance(); }, [linacId, category, status]);

  async function handleCreate() {
    if (!form.testName || !form.category) { setMsg("Nombre y categoría son requeridos"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/linac/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linacId: Number(form.linacId), protocolReference: form.protocolReference,
          category: form.category, testName: form.testName,
          expectedValue: form.expectedValue, measuredValue: form.measuredValue,
          tolerance: form.tolerance, result: form.result, status: form.status,
          responsible: form.responsible, testDate: form.testDate, notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setMsg("✓ Prueba registrada");
      setShowForm(false);
      fetchAcceptance();
    } finally {
      setSaving(false);
    }
  }

  const stats = {
    total: items.length,
    aprobados: items.filter(i => i.status === "aprobado").length,
    pendientes: items.filter(i => i.status === "pendiente" || i.status === "en_proceso").length,
    rechazados: items.filter(i => i.status === "rechazado").length,
  };

  const pct = stats.total > 0 ? Math.round((stats.aprobados / stats.total) * 100) : 0;
  const pctColor = pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pruebas de Aceptación LINAC</h1>
          <p className="text-sm text-gray-500 mt-1">Resultados de pruebas de aceptación por protocolo — IAEA TRS-430 · AAPM TG-142</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          <Plus size={16} /> Nueva prueba
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total pruebas</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Aprobadas</p>
          <p className="text-2xl font-bold text-green-600">{stats.aprobados}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendientes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Rechazadas</p>
          <p className="text-2xl font-bold text-red-600">{stats.rechazados}</p>
        </div>
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Progreso de Aceptación</span>
            <span className="font-bold text-gray-900">{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className={`${pctColor} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[100px]">
          <label className="block text-xs text-gray-500 mb-1">LINAC ID</label>
          <input value={linacId} onChange={e => setLinacId(e.target.value)} className={inp} />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Categoría</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={inp}>
            <option value="">Todas</option>
            {LINAC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-gray-500 mb-1">Estado</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inp}>
            <option value="">Todos</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* New form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-indigo-800">Nueva prueba de aceptación</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: "linacId", label: "LINAC ID *", ph: "1" },
              { key: "testName", label: "Nombre prueba *", ph: "" },
              { key: "protocolReference", label: "Referencia protocolo", ph: "IAEA TRS-430 §4.2" },
              { key: "expectedValue", label: "Valor esperado", ph: "1.000" },
              { key: "measuredValue", label: "Valor medido", ph: "1.002" },
              { key: "tolerance", label: "Tolerancia", ph: "±2%" },
              { key: "result", label: "Resultado", ph: "PASS / FAIL" },
              { key: "responsible", label: "Responsable", ph: "" },
              { key: "testDate", label: "Fecha", ph: "", type: "date" },
              { key: "notes", label: "Notas", ph: "" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-gray-600 mb-1">{f.label}</label>
                <input type={f.type ?? "text"} value={(form as Record<string, string>)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.ph} className={inp} />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Categoría *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                {LINAC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{msg}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>
            <button onClick={() => setShowForm(false)} className="bg-white border border-gray-200 px-5 py-2 rounded-lg text-sm text-gray-600">Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prueba</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Esperado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Medido</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tolerancia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Resultado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin pruebas de aceptación registradas</td></tr>
              ) : items.map(item => {
                const st = STATUS_MAP[item.status] ?? { label: item.status, cls: "bg-gray-100 text-gray-600", icon: null };
                return (
                  <>
                    <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.test_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{item.category}</td>
                      <td className="px-4 py-3 font-mono text-sm">{item.expected_value || "—"}</td>
                      <td className="px-4 py-3 font-mono text-sm">{item.measured_value || "—"}</td>
                      <td className="px-4 py-3 text-xs text-orange-700 font-medium">{item.tolerance || "—"}</td>
                      <td className="px-4 py-3">
                        {item.result ? (
                          <span className={`text-xs font-bold ${item.result.toUpperCase() === "PASS" ? "text-green-600" : item.result.toUpperCase() === "FAIL" ? "text-red-600" : "text-gray-600"}`}>
                            {item.result.toUpperCase()}
                          </span>
                        ) : "—"}
                      </td>
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
                        <td colSpan={8} className="px-6 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {item.protocol_reference && <div><span className="text-xs text-gray-500">Protocolo</span><p className="font-medium text-xs">{item.protocol_reference}</p></div>}
                            {item.responsible && <div><span className="text-xs text-gray-500">Responsable</span><p>{item.responsible}</p></div>}
                            {item.test_date && <div><span className="text-xs text-gray-500">Fecha</span><p>{new Date(item.test_date).toLocaleDateString("es-CL")}</p></div>}
                            {item.notes && <div className="col-span-2"><span className="text-xs text-gray-500">Notas</span><p>{item.notes}</p></div>}
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
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — IAEA TRS-430 · AAPM TG-142 · IPEM Report 81</p>
        <p className="text-xs text-blue-600">Las pruebas de aceptación deben completarse antes del uso clínico del equipo y ser firmadas por el Físico Médico responsable.</p>
      </div>
    </div>
  );
}
