"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { RefreshCw, Zap, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

interface QCTest {
  id: number; linac_id: number; periodicity: string; test_name: string; test_date: string;
  obtained_value: string | null; expected_value: string | null; tolerance: string | null;
  unit: string | null; status: string; semaphore: string | null;
  modality: string | null; energy: string | null; responsible: string | null;
  observations: string | null; deviation_pct: number | null;
}

const SEM_CFG: Record<string, { bg: string; label: string }> = {
  verde:   { bg: "bg-green-100 text-green-700",  label: "Cumple" },
  amarillo:{ bg: "bg-yellow-100 text-yellow-700", label: "Alerta" },
  naranja: { bg: "bg-orange-100 text-orange-700", label: "Advertencia" },
  rojo:    { bg: "bg-red-100 text-red-700",       label: "No cumple" },
};

const PERIODICIDADES = ["diario", "semanal", "mensual", "trimestral", "semestral", "anual"];
const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LinacQCPage() {
  const [tests, setTests] = useState<QCTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filters, setFilters] = useState({ periodicity: "", semaphore: "" });

  const fetchData = (f = filters) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (f.periodicity) p.set("periodicity", f.periodicity);
    if (f.semaphore) p.set("semaphore", f.semaphore);
    fetch(`/api/linac/qc?${p}`)
      .then(r => r.json())
      .then(d => setTests(d.tests ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const noCompliant = tests.filter(t => t.semaphore === "rojo" || t.status === "no_cumple").length;
  const pct = tests.length > 0 ? Math.round((tests.filter(t => t.semaphore === "verde" || t.status === "cumple").length / tests.length) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100"><Zap className="h-6 w-6 text-indigo-700" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Control de Calidad LINAC</h1>
              <p className="text-sm text-gray-500">Registros de CC por periodicidad — TRS 398, IAEA TECDOC-1151, DS 12/2010</p>
            </div>
          </div>
          <button onClick={() => fetchData()} disabled={loading}><RefreshCw className={`h-5 w-5 text-gray-400 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {noCompliant > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3 text-red-700 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span><strong>{noCompliant}</strong> test{noCompliant > 1 ? "s" : ""} fuera de tolerancia.</span>
          </div>
        )}

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total registros", value: tests.length, color: "gray" },
            { label: "Conformidad", value: pct != null ? `${pct}%` : "—", color: pct != null && pct >= 90 ? "green" : pct != null && pct >= 75 ? "yellow" : "red" },
            { label: "Alertas (amarillo+)", value: tests.filter(t => ["amarillo","naranja"].includes(t.semaphore ?? "")).length, color: "yellow" },
            { label: "No conformes (rojo)", value: noCompliant, color: "red" },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold text-${t.color}-600`}>{t.value}</div>
              <div className="text-xs text-gray-400 mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-36">
            <label className="text-xs text-gray-500 mb-1 block">Periodicidad</label>
            <select className={inp} value={filters.periodicity} onChange={e => { const f = { ...filters, periodicity: e.target.value }; setFilters(f); fetchData(f); }}>
              <option value="">Todas</option>
              {PERIODICIDADES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-36">
            <label className="text-xs text-gray-500 mb-1 block">Semáforo</label>
            <select className={inp} value={filters.semaphore} onChange={e => { const f = { ...filters, semaphore: e.target.value }; setFilters(f); fetchData(f); }}>
              <option value="">Todos</option>
              {Object.entries(SEM_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* QC Tests */}
        {loading && tests.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Cargando…</div>
        ) : tests.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Sin registros de CC.</div>
        ) : (
          <div className="space-y-2">
            {tests.map(t => {
              const semCfg = SEM_CFG[t.semaphore ?? ""] ?? { bg: "bg-gray-100 text-gray-600", label: t.status };
              return (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <button
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${semCfg.bg}`}>{semCfg.label}</span>
                      <span className="font-semibold text-gray-800 truncate">{t.test_name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{t.periodicity}</span>
                      {t.modality && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t.modality}</span>}
                      {t.energy && <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">{t.energy}</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 shrink-0 ml-4">
                      <span>{fmtDate(t.test_date)}</span>
                      {expanded === t.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {expanded === t.id && (
                    <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-gray-50 rounded-b-xl">
                      <div><div className="text-xs text-gray-400 mb-0.5">Valor obtenido</div><div className="font-semibold">{t.obtained_value ?? "—"} {t.unit ?? ""}</div></div>
                      <div><div className="text-xs text-gray-400 mb-0.5">Valor esperado</div><div>{t.expected_value ?? "—"} {t.unit ?? ""}</div></div>
                      <div><div className="text-xs text-gray-400 mb-0.5">Tolerancia</div><div>{t.tolerance ?? "—"}</div></div>
                      <div><div className="text-xs text-gray-400 mb-0.5">Desviación</div><div className={t.deviation_pct != null && Math.abs(t.deviation_pct) > 2 ? "text-red-600 font-semibold" : ""}>{t.deviation_pct != null ? `${t.deviation_pct.toFixed(1)}%` : "—"}</div></div>
                      <div><div className="text-xs text-gray-400 mb-0.5">Responsable</div><div>{t.responsible ?? "—"}</div></div>
                      {t.observations && <div className="sm:col-span-3"><div className="text-xs text-gray-400 mb-0.5">Observaciones</div><div className="text-gray-600">{t.observations}</div></div>}
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
          <p>DS N°12/2010 MINSAL — Control de calidad de equipos de radioterapia. IAEA TRS No. 398 — Dosimetry of High-energy Photon Beams. IAEA TECDOC-1151 — Aspectos físicos del CC en radioterapia. AAPM TG-40, TG-142 — Programas de CC para aceleradores lineales. CCHEN ORD sobre requisitos de CC radiológico.</p>
        </div>
      </div>
    </div>
  );
}
