"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { RefreshCw, Wrench, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

interface Maintenance {
  id: number; linac_id: number; maintenance_type: string; maintenance_date: string;
  duration_hours: number | null; cost: number | null; status: string | null;
  semaphore: string | null; engineer_name: string | null; engineer_rut: string | null;
  description: string | null; next_maintenance_date: string | null;
  observations: string | null;
}

const SEM_CFG: Record<string, { bg: string; label: string }> = {
  verde:   { bg: "bg-green-100 text-green-700",  label: "OK" },
  amarillo:{ bg: "bg-yellow-100 text-yellow-700", label: "Próximo" },
  naranja: { bg: "bg-orange-100 text-orange-700", label: "Urgente" },
  rojo:    { bg: "bg-red-100 text-red-700",       label: "Vencido" },
};

const MT_LABELS: Record<string, string> = {
  preventivo: "Preventivo", correctivo: "Correctivo", predictivo: "Predictivo",
  calibracion: "Calibración", verificacion: "Verificación",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtCost(c: number | null) {
  if (!c) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(c);
}

export default function LinacMaintenancePage() {
  const [records, setRecords] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filters, setFilters] = useState({ maintenanceType: "", status: "" });

  const fetchData = (f = filters) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (f.maintenanceType) p.set("maintenanceType", f.maintenanceType);
    if (f.status) p.set("status", f.status);
    fetch(`/api/linac/maintenance?${p}`)
      .then(r => r.json())
      .then(d => setRecords(d.records ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const totalCost = records.reduce((s, r) => s + (r.cost ?? 0), 0);
  const totalHrs = records.reduce((s, r) => s + (r.duration_hours ?? 0), 0);
  const urgent = records.filter(r => r.semaphore === "rojo" || r.semaphore === "naranja").length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100"><Wrench className="h-6 w-6 text-orange-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mantenimiento LINAC</h1>
              <p className="text-sm text-gray-500">Registros de mantenimiento preventivo, correctivo y calibraciones</p>
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {urgent > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 flex items-center gap-3 text-orange-700 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span><strong>{urgent}</strong> mantenimiento{urgent > 1 ? "s" : ""} urgente{urgent > 1 ? "s" : ""} o vencido{urgent > 1 ? "s" : ""}.</span>
          </div>
        )}

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total registros", value: records.length.toString(), color: "gray" },
            { label: "Horas totales", value: `${totalHrs.toFixed(1)} h`, color: "blue" },
            { label: "Costo total", value: fmtCost(totalCost), color: "purple" },
            { label: "Urgentes/Vencidos", value: urgent.toString(), color: urgent > 0 ? "red" : "green" },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <div className={`text-xl font-bold text-${t.color}-600`}>{t.value}</div>
              <div className="text-xs text-gray-400 mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-36">
            <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" value={filters.maintenanceType} onChange={e => { const f = { ...filters, maintenanceType: e.target.value }; setFilters(f); fetchData(f); }}>
              <option value="">Todos</option>
              {Object.entries(MT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-36">
            <label className="text-xs text-gray-500 mb-1 block">Estado</label>
            <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" value={filters.status} onChange={e => { const f = { ...filters, status: e.target.value }; setFilters(f); fetchData(f); }}>
              <option value="">Todos</option>
              <option value="completado">Completado</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En progreso</option>
            </select>
          </div>
        </div>

        {/* Records */}
        {loading && records.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Cargando…</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Sin registros de mantenimiento.</div>
        ) : (
          <div className="space-y-2">
            {records.map(rec => {
              const semCfg = SEM_CFG[rec.semaphore ?? ""] ?? { bg: "bg-gray-100 text-gray-600", label: rec.status ?? "—" };
              return (
                <div key={rec.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <button
                    onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${semCfg.bg}`}>{semCfg.label}</span>
                      <span className="font-semibold text-gray-800 truncate">{MT_LABELS[rec.maintenance_type] ?? rec.maintenance_type}</span>
                      {rec.engineer_name && <span className="text-xs text-gray-400 truncate">{rec.engineer_name}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0 ml-4">
                      <span>{fmtDate(rec.maintenance_date)}</span>
                      {rec.duration_hours && <span>{rec.duration_hours} h</span>}
                      {expanded === rec.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {expanded === rec.id && (
                    <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-gray-50 rounded-b-xl">
                      <div><div className="text-xs text-gray-400 mb-0.5">Próximo mantenimiento</div><div className="font-semibold">{fmtDate(rec.next_maintenance_date)}</div></div>
                      <div><div className="text-xs text-gray-400 mb-0.5">Costo</div><div>{fmtCost(rec.cost)}</div></div>
                      <div><div className="text-xs text-gray-400 mb-0.5">Duración</div><div>{rec.duration_hours != null ? `${rec.duration_hours} h` : "—"}</div></div>
                      <div><div className="text-xs text-gray-400 mb-0.5">Estado</div><div>{rec.status ?? "—"}</div></div>
                      {rec.description && <div className="sm:col-span-4"><div className="text-xs text-gray-400 mb-0.5">Descripción</div><div className="text-gray-700">{rec.description}</div></div>}
                      {rec.observations && <div className="sm:col-span-4"><div className="text-xs text-gray-400 mb-0.5">Observaciones</div><div className="text-gray-600">{rec.observations}</div></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>DS N°12/2010 MINSAL — Artículo 36: programa de mantenimiento de equipos de radioterapia. IAEA SRS No. 47 — Aspectos técnicos del mantenimiento de aceleradores lineales. AAPM TG-40 — Recomendaciones de control de calidad para aceleradores lineales médicos. CCHEN ORD sobre registros de mantenimiento de equipos con fuentes de radiación.</p>
        </div>
      </div>
    </div>
  );
}
