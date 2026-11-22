"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle, Search, RefreshCw, Package, Filter, CheckCircle2, XCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotReturnedRow {
  dosimetro: string | null;
  institucion: string | null;
  unidad: string | null;
  nombrepart: string;
  dcto: string | null;
  tipod: string | null;
  trimestre_d: string;
  extraviado: boolean;
}

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DosimetryNotReturnedPage() {
  const [rows, setRows] = useState<NotReturnedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [trimestreFilter, setTrimestreFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [showExtraviados, setShowExtraviados] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/dosimetry/not-returned")
      .then(r => r.json())
      .then(d => { if (d.ok) setRows(d.rows); else setError("Error al cargar datos."); })
      .catch(() => setError("Error de conexión."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const trimestres = useMemo(() => [...new Set(rows.map(r => r.trimestre_d))].sort((a, b) => b.localeCompare(a)), [rows]);
  const tipos = useMemo(() => [...new Set(rows.map(r => r.tipod ?? "").filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (!showExtraviados && r.extraviado) return false;
      if (trimestreFilter && r.trimestre_d !== trimestreFilter) return false;
      if (tipoFilter && r.tipod !== tipoFilter) return false;
      if (q) {
        const ql = q.toLowerCase();
        const matches = (r.nombrepart ?? "").toLowerCase().includes(ql)
          || (r.dosimetro ?? "").toLowerCase().includes(ql)
          || (r.dcto ?? "").toLowerCase().includes(ql)
          || (r.unidad ?? "").toLowerCase().includes(ql);
        if (!matches) return false;
      }
      return true;
    });
  }, [rows, q, trimestreFilter, tipoFilter, showExtraviados]);

  const extraviados = rows.filter(r => r.extraviado).length;
  const pendientes = rows.filter(r => !r.extraviado).length;

  const toggleExtraviado = async (dosimetro: string | null, trimestre: string, current: boolean) => {
    if (!dosimetro) return;
    const key = `${dosimetro}-${trimestre}`;
    setToggling(key);
    try {
      const res = await fetch("/api/dosimetry/not-returned", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dosimetro, periodLabel: trimestre, extraviado: !current }),
      });
      if (res.ok) {
        setRows(prev => prev.map(r =>
          r.dosimetro === dosimetro && r.trimestre_d === trimestre
            ? { ...r, extraviado: !current }
            : r
        ));
      }
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dosímetros No Devueltos</h1>
              <p className="text-sm text-gray-500">Dosímetros informados en trimestre sin registro de devolución</p>
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
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total no devueltos</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">{rows.length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${pendientes > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pendientes</p>
            <p className={`mt-1 text-2xl font-bold ${pendientes > 0 ? "text-orange-700" : "text-gray-800"}`}>{pendientes}</p>
            <p className="text-xs text-gray-400 mt-0.5">sin marcar como extraviados</p>
          </div>
          <div className={`rounded-xl border p-4 ${extraviados > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Extraviados</p>
            <p className={`mt-1 text-2xl font-bold ${extraviados > 0 ? "text-red-700" : "text-gray-800"}`}>{extraviados}</p>
            <p className="text-xs text-gray-400 mt-0.5">marcados como perdidos</p>
          </div>
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
            <select className={inp} value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showExtraviados}
                onChange={e => setShowExtraviados(e.target.checked)}
                className="rounded border-gray-300 text-blue-500 focus:ring-blue-300"
              />
              <span className="text-sm text-gray-600">Mostrar extraviados</span>
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
            <Package className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin dosímetros pendientes</p>
            <p className="text-xs text-gray-400 mt-1">Todos los dosímetros han sido devueltos o marcados</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">{filtered.length} dosímetro{filtered.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Código Dosímetro</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">RUN</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Unidad</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Trimestre</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => {
                    const key = `${r.dosimetro}-${r.trimestre_d}`;
                    const isToggling = toggling === key;
                    return (
                      <tr key={idx} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${r.extraviado ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-800">{r.dosimetro ?? "—"}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{r.nombrepart}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.dcto ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-600 max-w-[140px] truncate">{r.unidad ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-1.5 py-0.5 rounded">{r.tipod ?? "—"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{r.trimestre_d}</td>
                        <td className="px-4 py-2.5">
                          {r.extraviado ? (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 text-xs px-2 py-0.5 rounded-full">
                              <XCircle className="h-3 w-3" /> Extraviado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 text-xs px-2 py-0.5 rounded-full">
                              <AlertTriangle className="h-3 w-3" /> Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => toggleExtraviado(r.dosimetro, r.trimestre_d, r.extraviado)}
                            disabled={isToggling}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                              r.extraviado
                                ? "border-gray-200 text-gray-600 hover:bg-gray-50"
                                : "border-red-200 text-red-700 hover:bg-red-50"
                            }`}
                          >
                            {isToggling ? "..." : r.extraviado ? (
                              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Desmarcar</span>
                            ) : (
                              <span className="flex items-center gap-1"><XCircle className="h-3 w-3" />Marcar extraviado</span>
                            )}
                          </button>
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
            Decreto Supremo N°3/1985 MINSAL Art. 65-67 — Obligatoriedad de uso y devolución de dosímetros individuales.
            CCHEN ORD. sobre registros de dosimetría personal de trabajadores ocupacionalmente expuestos.
            DS N°594/1999 MINSAL — Procedimientos de control dosimétrico en instalaciones con radiación ionizante.
            IAEA Safety Standards RS-G-1.3 (1999) — Dosimetría individual para radiación externa.
          </p>
        </div>

      </div>
    </div>
  );
}
