"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import {
  Package, Search, CheckCircle2, AlertTriangle, Plus, RefreshCw, X,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DosimeterInfo {
  unidad: string | null;
  worker_rut: string | null;
  worker_name: string | null;
  period_label: string | null;
}

interface ReturnRecord {
  id: number;
  dosimeter_code: string;
  unidad: string | null;
  worker_rut: string | null;
  worker_name: string | null;
  period_label: string | null;
  estado: string;
  observaciones: string | null;
  registered_by: string | null;
  registered_at: string;
}

const RETURN_STATUSES = [
  "Usado",
  "No usado",
  "Dañado",
  "Irradiado el dosimetro, no la persona",
];

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DosimetryReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [statuses, setStatuses] = useState<string[]>(RETURN_STATUSES);
  const [loading, setLoading] = useState(true);

  // Form state
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [info, setInfo] = useState<DosimeterInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [estado, setEstado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [registeredBy, setRegisteredBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Filter for history
  const [filterQ, setFilterQ] = useState("");

  const codeRef = useRef<HTMLInputElement>(null);

  const fetchHistory = () => {
    setLoading(true);
    fetch("/api/dosimetry/returns")
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setReturns(d.returns);
          if (d.statuses?.length) setStatuses(d.statuses);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHistory(); }, []);

  const lookupCode = async () => {
    if (!code.trim()) return;
    setLooking(true);
    setInfo(null);
    setNotFound(false);
    setSaved(false);
    setSaveError("");
    try {
      const res = await fetch(`/api/dosimetry/returns?code=${encodeURIComponent(code.trim())}`);
      const d = await res.json();
      if (d.ok && d.found) {
        setInfo(d.info);
      } else {
        setNotFound(true);
      }
    } finally {
      setLooking(false);
    }
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") lookupCode();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !estado) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/dosimetry/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dosimeter_code: code.trim(),
          estado,
          observaciones: observaciones || null,
          registered_by: registeredBy || null,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setSaved(true);
        setReturns(prev => [d.record, ...prev]);
        // Reset form
        setCode("");
        setInfo(null);
        setNotFound(false);
        setEstado("");
        setObservaciones("");
        setTimeout(() => { setSaved(false); codeRef.current?.focus(); }, 1500);
      } else {
        setSaveError(d.error ?? "Error al registrar.");
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredReturns = returns.filter(r => {
    if (!filterQ) return true;
    const ql = filterQ.toLowerCase();
    return (
      (r.dosimeter_code ?? "").toLowerCase().includes(ql) ||
      (r.worker_name ?? "").toLowerCase().includes(ql) ||
      (r.worker_rut ?? "").toLowerCase().includes(ql) ||
      (r.unidad ?? "").toLowerCase().includes(ql)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <Package className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lista de Devolución de Dosímetros</h1>
            <p className="text-sm text-gray-500">
              Hoja oficial de devolución — ingresa el código del dosímetro para registrar su estado
            </p>
          </div>
        </div>

        {/* Entry form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-500" /> Registrar Devolución
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Code lookup */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Código Dosímetro *</label>
              <div className="flex gap-2">
                <input
                  ref={codeRef}
                  className={inp + " flex-1"}
                  placeholder="Escanear o ingresar código (Enter para buscar)"
                  value={code}
                  onChange={e => { setCode(e.target.value); setInfo(null); setNotFound(false); }}
                  onKeyDown={handleCodeKeyDown}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={lookupCode}
                  disabled={!code.trim() || looking}
                  className="px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
                >
                  {looking ? "..." : <Search className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Auto-populated fields */}
            {info && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                  <CheckCircle2 className="h-4 w-4" /> Dosímetro encontrado
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-700">
                  <div><span className="text-gray-500">Nombre:</span> {info.worker_name ?? "—"}</div>
                  <div><span className="text-gray-500">RUN:</span> <span className="font-mono">{info.worker_rut ?? "—"}</span></div>
                  <div><span className="text-gray-500">Unidad:</span> {info.unidad ?? "—"}</div>
                  <div><span className="text-gray-500">Período:</span> {info.period_label ?? "—"}</div>
                </div>
              </div>
            )}
            {notFound && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Código no encontrado en los reportes trimestrales. Puede registrar de todas formas.
              </div>
            )}

            {/* Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Estado *</label>
                <select
                  className={inp}
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  required
                >
                  <option value="">Seleccionar estado...</option>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Registrado por</label>
                <input
                  className={inp}
                  placeholder="Nombre del operador"
                  value={registeredBy}
                  onChange={e => setRegisteredBy(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Observaciones</label>
                <input
                  className={inp}
                  placeholder="Opcional"
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!code.trim() || !estado || saving}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Registrar Devolución"}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Registrado exitosamente
                </span>
              )}
              {saveError && (
                <span className="flex items-center gap-1.5 text-sm text-red-600">
                  <X className="h-4 w-4" /> {saveError}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* History */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <span className="font-semibold text-sm text-gray-800">Historial de devoluciones (últimas 100)</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <input
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  placeholder="Buscar..."
                  value={filterQ}
                  onChange={e => setFilterQ(e.target.value)}
                />
              </div>
              <button onClick={fetchHistory} disabled={loading} className="text-gray-400 hover:text-gray-600">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Unidad</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Período</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Registrado</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Por</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                ) : filteredReturns.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin registros de devolución.</td></tr>
                ) : filteredReturns.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-800">{r.dosimeter_code}</td>
                    <td className="px-4 py-2.5 text-gray-900">{r.worker_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-[140px] truncate">{r.unidad ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.period_label ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{r.estado}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{fmtDateTime(r.registered_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.registered_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regulatory footer */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo aplicable</p>
          <p>
            Decreto Supremo N°3/1985 MINSAL Art. 65-67 — Obligatoriedad del registro de devolución de dosímetros individuales.
            CCHEN ORD. sobre registros dosimétricos de trabajadores POE.
            Planilla oficial del laboratorio de dosimetría (Resumen-908.xlsm) — hoja "Lista de devolución".
            DS N°594/1999 MINSAL — Control del estado de los elementos de protección y dosimetría personal.
          </p>
        </div>

      </div>
    </div>
  );
}
