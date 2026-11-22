"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Clock, Search, RefreshCw, AlertTriangle, CheckCircle2, Filter,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LateReturnRow {
  institucion: string | null;
  departamento: string | null;
  nombre: string | null;
  run: string;
  period_label: string;
  dosimetro: string | null;
  fecha_lectura: string | null;
  alerta_dosis: boolean;
}

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DosimetryLateReturnsPage() {
  const [rows, setRows] = useState<LateReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [trimestreFilter, setTrimestreFilter] = useState("");
  const [deptoFilter, setDeptoFilter] = useState("");
  const [alertOnly, setAlertOnly] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/dosimetry/late-returns")
      .then(r => r.json())
      .then(d => { if (d.ok) setRows(d.rows); else setError("Error al cargar datos."); })
      .catch(() => setError("Error de conexión."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const trimestres = useMemo(() => [...new Set(rows.map(r => r.period_label))].sort((a, b) => b.localeCompare(a)), [rows]);
  const deptos = useMemo(() => [...new Set(rows.map(r => r.departamento ?? "").filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (alertOnly && !r.alerta_dosis) return false;
      if (trimestreFilter && r.period_label !== trimestreFilter) return false;
      if (deptoFilter && r.departamento !== deptoFilter) return false;
      if (q) {
        const ql = q.toLowerCase();
        const matches = (r.nombre ?? "").toLowerCase().includes(ql)
          || (r.run ?? "").toLowerCase().includes(ql)
          || (r.dosimetro ?? "").toLowerCase().includes(ql)
          || (r.departamento ?? "").toLowerCase().includes(ql);
        if (!matches) return false;
      }
      return true;
    });
  }, [rows, q, trimestreFilter, deptoFilter, alertOnly]);

  const conAlerta = rows.filter(r => r.alerta_dosis).length;
  const sinAlerta = rows.length - conAlerta;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Clock className="h-6 w-6 text-yellow-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Devueltos Fuera de Plazo</h1>
              <p className="text-sm text-gray-500">
                Dosímetros con fecha de lectura más de 45 días después del cierre del trimestre
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total fuera de plazo</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">{rows.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">tolerancia: 45 días post-trimestre</p>
          </div>
          <div className={`rounded-xl border p-4 ${conAlerta > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Con alerta de dosis</p>
            <p className={`mt-1 text-2xl font-bold flex items-center gap-1.5 ${conAlerta > 0 ? "text-red-700" : "text-gray-800"}`}>
              <AlertTriangle className={`h-5 w-5 ${conAlerta > 0 ? "text-red-500" : "text-gray-300"}`} />
              {conAlerta}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sin alerta de dosis</p>
            <p className="mt-1 text-2xl font-bold text-gray-800 flex items-center gap-1.5">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              {sinAlerta}
            </p>
          </div>
        </div>

        {/* Context note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800">
          <strong>Criterio:</strong> Un dosímetro se considera devuelto fuera de plazo si su fecha de proceso/lectura
          de laboratorio (<em>fecha_lectura</em>) supera en más de 45 días la fecha de cierre del trimestre correspondiente.
          Esta hoja replica la lógica de la planilla oficial <code className="font-mono text-xs bg-amber-100 px-1 rounded">Resumen-908.xlsm</code>.
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className={`${inp} pl-9`}
                placeholder="Nombre, RUN, código..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <select className={inp} value={trimestreFilter} onChange={e => setTrimestreFilter(e.target.value)}>
              <option value="">Todos los trimestres</option>
              {trimestres.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={inp} value={deptoFilter} onChange={e => setDeptoFilter(e.target.value)}>
              <option value="">Todos los departamentos</option>
              {deptos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alertOnly}
                onChange={e => setAlertOnly(e.target.checked)}
                className="rounded border-gray-300 text-red-500 focus:ring-red-300"
              />
              <span className="text-sm text-gray-600">Solo con alerta de dosis</span>
            </label>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando...</div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin dosímetros fuera de plazo</p>
            <p className="text-xs text-gray-400 mt-1">Todos los dosímetros fueron procesados en el plazo establecido</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Código Dosímetro</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">RUN</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Departamento</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Trimestre</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Fecha Lectura</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Alerta Dosis</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => (
                    <tr key={idx} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${r.alerta_dosis ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-800">{r.dosimetro ?? "—"}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.nombre ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.run}</td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-[160px] truncate">{r.departamento ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.period_label}</td>
                      <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">{r.fecha_lectura ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {r.alerta_dosis ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 text-xs px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> Alerta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>
            Decreto Supremo N°3/1985 MINSAL Art. 65-67 — Plazos y procedimientos para la devolución de dosímetros individuales.
            CCHEN ORD. sobre notificación de demoras en procesamiento dosimétrico.
            Planilla oficial del laboratorio de dosimetría (Resumen-908.xlsm) — hoja "Devueltos fuera de plazo".
            IAEA Safety Standards RS-G-1.3 (1999) — Monitoreo individual de dosis externa: registros y plazos.
          </p>
        </div>

      </div>
    </div>
  );
}
