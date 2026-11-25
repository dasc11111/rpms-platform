"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, Search } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  vigente:   { label: "Vigente",   cls: "bg-green-100 text-green-700",  icon: <CheckCircle size={12} /> },
  vencido:   { label: "Vencido",   cls: "bg-red-100 text-red-700",       icon: <XCircle size={12} /> },
  proximo:   { label: "Próximo",   cls: "bg-yellow-100 text-yellow-700", icon: <AlertCircle size={12} /> },
  pendiente: { label: "Pendiente", cls: "bg-gray-100 text-gray-600",     icon: <AlertCircle size={12} /> },
};

interface InstrumentValidation {
  id: number;
  instrument_code: string;
  instrument_name: string;
  instrument_type: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  calibration_date: string;
  expiry_date: string;
  calibration_lab: string;
  certificate_number: string;
  responsible: string;
  status: string;
  notes: string;
  linac_id: number;
}

export default function LinacInstrumentValidationPage() {
  const [items, setItems] = useState<InstrumentValidation[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [instrumentType, setInstrumentType] = useState("");

  async function fetchInstruments() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (instrumentType) params.set("instrumentType", instrumentType);
      const res = await fetch(`/api/linac/instrument-validation?${params}`);
      const data = await res.json();
      setItems(data.items ?? data.instruments ?? data.validations ?? data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInstruments(); }, [status, instrumentType]);

  const handleSearch = () => fetchInstruments();

  const filtered = items.filter(item => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return item.instrument_code?.toLowerCase().includes(ql) ||
      item.instrument_name?.toLowerCase().includes(ql) ||
      item.serial_number?.toLowerCase().includes(ql) ||
      item.manufacturer?.toLowerCase().includes(ql) ||
      item.model?.toLowerCase().includes(ql);
  });

  const instrumentTypes = [...new Set(items.map(i => i.instrument_type))].filter(Boolean);
  const stats = {
    total: items.length,
    vigentes: items.filter(i => i.status === "vigente").length,
    vencidos: items.filter(i => i.status === "vencido").length,
    proximos: items.filter(i => i.status === "proximo").length,
  };

  function daysUntilExpiry(expiry: string) {
    if (!expiry) return null;
    const diff = Math.round((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Validación de Instrumentos LINAC</h1>
        <p className="text-sm text-gray-500 mt-1">Calibraciones y certificados vigentes — IAEA TRS-374 · BIPM · ENAC</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total instrumentos</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Vigentes</p>
          <p className="text-2xl font-bold text-green-600">{stats.vigentes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Por vencer (≤30d)</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.proximos}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Vencidos</p>
          <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
        </div>
      </div>

      {/* Alert banner for expired/expiring */}
      {(stats.vencidos > 0 || stats.proximos > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-red-800">Atención requerida</p>
            <p className="text-xs text-red-700">
              {stats.vencidos > 0 && `${stats.vencidos} instrumento(s) con calibración vencida. `}
              {stats.proximos > 0 && `${stats.proximos} instrumento(s) por vencer en 30 días.`}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-gray-500 mb-1">Buscar código / nombre / serie</label>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Código, nombre, serie…" className={`${inp} pl-8`} />
            </div>
            <button onClick={handleSearch} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Buscar</button>
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs text-gray-500 mb-1">Tipo instrumento</label>
          <select value={instrumentType} onChange={e => setInstrumentType(e.target.value)} className={inp}>
            <option value="">Todos</option>
            {instrumentTypes.map(t => <option key={t} value={t}>{t}</option>)}
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

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-gray-400">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-gray-400">Sin instrumentos para los filtros seleccionados</div>
        ) : filtered.map(item => {
          const st = STATUS_MAP[item.status] ?? { label: item.status, cls: "bg-gray-100 text-gray-600", icon: null };
          const days = daysUntilExpiry(item.expiry_date);
          const daysColor = days === null ? "" : days < 0 ? "text-red-600" : days <= 30 ? "text-yellow-600" : "text-green-600";
          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.instrument_name}</p>
                  <p className="text-xs text-indigo-600 font-mono mt-0.5">{item.instrument_code}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>
                  {st.icon}{st.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                {item.manufacturer && <div><span className="text-gray-400">Fabricante</span><p className="font-medium">{item.manufacturer}</p></div>}
                {item.model && <div><span className="text-gray-400">Modelo</span><p className="font-medium">{item.model}</p></div>}
                {item.serial_number && <div><span className="text-gray-400">Serie</span><p className="font-medium font-mono">{item.serial_number}</p></div>}
                {item.instrument_type && <div><span className="text-gray-400">Tipo</span><p className="font-medium">{item.instrument_type}</p></div>}
                {item.calibration_date && <div><span className="text-gray-400">Calibrado</span><p className="font-medium">{new Date(item.calibration_date).toLocaleDateString("es-CL")}</p></div>}
                {item.expiry_date && (
                  <div>
                    <span className="text-gray-400">Vence</span>
                    <p className={`font-medium ${daysColor}`}>
                      {new Date(item.expiry_date).toLocaleDateString("es-CL")}
                      {days !== null && <span className="ml-1 text-xs">({days >= 0 ? `${days}d` : `vencido`})</span>}
                    </p>
                  </div>
                )}
              </div>
              {item.calibration_lab && (
                <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">Lab: {item.calibration_lab}
                  {item.certificate_number && <span className="ml-2 font-mono text-indigo-600">#{item.certificate_number}</span>}
                </p>
              )}
              {item.notes && <p className="text-xs text-gray-500 italic">{item.notes}</p>}
            </div>
          );
        })}
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — IAEA TRS-374 · ISO/IEC 17025 · D.S. 3/2010</p>
        <p className="text-xs text-blue-600">Los instrumentos de medición deben estar calibrados en laboratorios acreditados y con trazabilidad al BIPM. Las calibraciones vencidas impiden el uso del equipo.</p>
      </div>
    </div>
  );
}
