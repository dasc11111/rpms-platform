"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import {
  Activity, Search, Download, AlertTriangle, Users, TrendingUp, Filter,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnnualRow {
  institucion: string | null;
  departamento: string | null;
  nombre: string;
  run: string | null;
  tipod: string | null;
  anio: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  total: number;
  estado: "Activo" | "Inactivo";
}

// Annual dose limit per dosimeter type (mSv)
const ANNUAL_LIMIT: Record<string, number> = {
  "C.E.": 20,       // Cuerpo entero
  "EXTREMIDAD": 500, // Extremidades
};

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function limitPct(total: number, tipo: string | null): number {
  const lim = ANNUAL_LIMIT[tipo ?? ""] ?? 20;
  return (total / lim) * 100;
}

function doseColor(total: number, tipo: string | null): string {
  const pct = limitPct(total, tipo);
  if (pct >= 100) return "text-red-700 font-bold";
  if (pct >= 75) return "text-orange-600 font-semibold";
  if (pct >= 50) return "text-yellow-600 font-semibold";
  return "text-gray-800";
}

function doseBarColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 75) return "bg-orange-400";
  if (pct >= 50) return "bg-yellow-400";
  return "bg-green-400";
}

function fmtDose(v: number): string {
  if (v === 0) return "—";
  return v.toFixed(2);
}

function exportCSV(rows: AnnualRow[]) {
  const header = ["Institución","Departamento","Nombre","RUN","Tipo Dosímetro","Año","T1","T2","T3","T4","Total (mSv)","% Límite","Estado"];
  const lines = rows.map(r => [
    r.institucion ?? "",
    r.departamento ?? "",
    r.nombre,
    r.run ?? "",
    r.tipod ?? "",
    r.anio,
    r.t1.toFixed(2),
    r.t2.toFixed(2),
    r.t3.toFixed(2),
    r.t4.toFixed(2),
    r.total.toFixed(2),
    limitPct(r.total, r.tipod).toFixed(1) + "%",
    r.estado,
  ].join(";"));
  const blob = new Blob([[header.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resumen-anual-dosimetria.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DosimetryAnnualSummaryPage() {
  const [rows, setRows] = useState<AnnualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [tipoFilter, setTipoFilter] = useState("");
  const [deptoFilter, setDeptoFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [q, setQ] = useState("");
  const [alertOnly, setAlertOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/dosimetry/annual-summary")
      .then(r => r.json())
      .then(d => { if (d.ok) setRows(d.rows); else setError("Error al cargar datos."); })
      .catch(() => setError("Error de conexión."))
      .finally(() => setLoading(false));
  }, []);

  // Derived filter options
  const years = useMemo(() => [...new Set(rows.map(r => r.anio))].sort((a, b) => b - a), [rows]);
  const tipos = useMemo(() => [...new Set(rows.map(r => r.tipod ?? "").filter(Boolean))].sort(), [rows]);
  const deptos = useMemo(() => [...new Set(rows.map(r => r.departamento ?? "").filter(Boolean))].sort(), [rows]);

  // Apply filters
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (yearFilter && r.anio !== yearFilter) return false;
      if (tipoFilter && r.tipod !== tipoFilter) return false;
      if (deptoFilter && r.departamento !== deptoFilter) return false;
      if (estadoFilter && r.estado !== estadoFilter) return false;
      if (alertOnly && limitPct(r.total, r.tipod) < 50) return false;
      if (q) {
        const ql = q.toLowerCase();
        if (!(r.nombre.toLowerCase().includes(ql) || (r.run ?? "").toLowerCase().includes(ql) || (r.departamento ?? "").toLowerCase().includes(ql))) return false;
      }
      return true;
    });
  }, [rows, yearFilter, tipoFilter, deptoFilter, estadoFilter, alertOnly, q]);

  // KPIs
  const yearRows = rows.filter(r => r.anio === yearFilter);
  const exceeded = yearRows.filter(r => limitPct(r.total, r.tipod) >= 100).length;
  const nearLimit = yearRows.filter(r => { const p = limitPct(r.total, r.tipod); return p >= 75 && p < 100; }).length;
  const workers = new Set(yearRows.map(r => r.run ?? r.nombre)).size;
  const avgDoseCE = (() => {
    const ce = yearRows.filter(r => r.tipod === "C.E." && r.total > 0);
    if (!ce.length) return 0;
    return ce.reduce((s, r) => s + r.total, 0) / ce.length;
  })();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Activity className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Resumen Anual Dosimetría</h1>
              <p className="text-sm text-gray-500">
                Dosis acumulada por trabajador, tipo y trimestre — reporte oficial
              </p>
            </div>
          </div>
          <button
            onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trabajadores POE</p>
            <p className="mt-1 text-2xl font-bold text-gray-800 flex items-center gap-1.5">
              <Users className="h-5 w-5 text-blue-500" />{workers}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">año {yearFilter}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dosis media C.E.</p>
            <p className="mt-1 text-2xl font-bold text-gray-800 flex items-center gap-1.5">
              <TrendingUp className="h-5 w-5 text-indigo-500" />{avgDoseCE.toFixed(2)} mSv
            </p>
            <p className="text-xs text-gray-400 mt-0.5">límite 20 mSv/año</p>
          </div>
          <div className={`rounded-xl border p-4 ${nearLimit > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cerca del límite ≥75%</p>
            <p className={`mt-1 text-2xl font-bold flex items-center gap-1.5 ${nearLimit > 0 ? "text-orange-700" : "text-gray-800"}`}>
              <AlertTriangle className={`h-5 w-5 ${nearLimit > 0 ? "text-orange-500" : "text-gray-300"}`} />
              {nearLimit}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">trabajadores</p>
          </div>
          <div className={`rounded-xl border p-4 ${exceeded > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Superaron límite</p>
            <p className={`mt-1 text-2xl font-bold flex items-center gap-1.5 ${exceeded > 0 ? "text-red-700" : "text-gray-800"}`}>
              <AlertTriangle className={`h-5 w-5 ${exceeded > 0 ? "text-red-500" : "text-gray-300"}`} />
              {exceeded}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">trabajadores</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className={`${inp} pl-9`}
                placeholder="Nombre, RUN, depto..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <select className={inp} value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className={inp} value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={inp} value={deptoFilter} onChange={e => setDeptoFilter(e.target.value)}>
              <option value="">Todos los departamentos</option>
              {deptos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={inp} value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alertOnly}
                onChange={e => setAlertOnly(e.target.checked)}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-300"
              />
              <span className="text-sm text-gray-600">Solo alertas ≥50%</span>
            </label>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando resumen anual...</div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">{error}</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">{filtered.length} registros</span>
              <span className="text-xs text-gray-400">Límite C.E.: 20 mSv/año · Extremidades: 500 mSv/año (ICRP-103)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">RUN</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Departamento</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Tipo</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">T1</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">T2</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">T3</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">T4</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Total mSv</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide min-w-[120px]">% Límite</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-gray-400">No hay datos con los filtros aplicados.</td>
                    </tr>
                  ) : filtered.map((r, idx) => {
                    const pct = limitPct(r.total, r.tipod);
                    return (
                      <tr key={idx} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${pct >= 100 ? "bg-red-50" : pct >= 75 ? "bg-orange-50" : ""}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.nombre}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.run ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-600 max-w-[160px] truncate">{r.departamento ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-1.5 py-0.5 rounded">{r.tipod ?? "—"}</span>
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${doseColor(r.t1, r.tipod)}`}>{fmtDose(r.t1)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${doseColor(r.t2, r.tipod)}`}>{fmtDose(r.t2)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${doseColor(r.t3, r.tipod)}`}>{fmtDose(r.t3)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${doseColor(r.t4, r.tipod)}`}>{fmtDose(r.t4)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${doseColor(r.total, r.tipod)}`}>{r.total.toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
                              <div
                                className={`h-1.5 rounded-full ${doseBarColor(pct)}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs tabular-nums w-10 text-right ${pct >= 100 ? "text-red-700 font-bold" : pct >= 75 ? "text-orange-600 font-semibold" : "text-gray-500"}`}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.estado === "Activo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {r.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>
            Decreto Supremo N°3/1985 MINSAL Art. 60-62 — Límites de dosis para trabajadores ocupacionalmente expuestos (20 mSv/año C.E., 500 mSv extremidades).
            ICRP Publication 103 (2007) — Sistema de protección radiológica.
            IAEA Safety Standards GSR Part 3 (2014) — Requisitos generales de seguridad de radiación.
            DS N°594/1999 MINSAL — Condiciones sanitarias en los lugares de trabajo con radiaciones ionizantes.
            CCHEN ORD. sobre registros y reportes de dosis a trabajadores POE.
          </p>
        </div>

      </div>
    </div>
  );
}
