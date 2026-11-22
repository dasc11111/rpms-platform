"use client";

export const dynamic = "force-dynamic";
import { useState } from "react";
import { Download, FileSpreadsheet, Filter } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300";

export default function ContaminationExportPage() {
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [filters, setFilters] = useState({ area: "", sala: "", radionuclido: "", estado: "", clasificacion: "", fechaDesde: "", fechaHasta: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  function setF(k: string, v: string) { setFilters(f => ({ ...f, [k]: v })); }

  async function handleExport() {
    setLoading(true); setMsg("");
    try {
      const params = new URLSearchParams({ format });
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/contamination/export?${params}`);
      if (!res.ok) { setMsg("Error al exportar"); return; }
      const blob = await res.blob();
      const ext = format === "xlsx" ? "xlsx" : "csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contaminacion_superficial_${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("✓ Archivo descargado correctamente");
    } catch {
      setMsg("Error inesperado al exportar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Exportar Contaminación Superficial</h1>
        <p className="text-sm text-gray-500 mt-1">Descarga los registros de control de contaminación en CSV o XLSX</p>
      </div>

      {/* Format selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><FileSpreadsheet size={18} /> Formato de exportación</h2>
        <div className="flex gap-3">
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition ${format === "xlsx" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <input type="radio" name="format" value="xlsx" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} className="sr-only" />
            XLSX (Excel)
          </label>
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition ${format === "csv" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <input type="radio" name="format" value="csv" checked={format === "csv"} onChange={() => setFormat("csv")} className="sr-only" />
            CSV
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Filter size={18} /> Filtros opcionales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Área</label>
            <input value={filters.area} onChange={e => setF("area", e.target.value)} placeholder="Medicina Nuclear…" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sala</label>
            <input value={filters.sala} onChange={e => setF("sala", e.target.value)} placeholder="Sala 1…" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Radionúclido</label>
            <input value={filters.radionuclido} onChange={e => setF("radionuclido", e.target.value)} placeholder="I131, TC99M…" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select value={filters.estado} onChange={e => setF("estado", e.target.value)} className={inp}>
              <option value="">Todos</option>
              <option value="normal">Normal</option>
              <option value="registro">Registro</option>
              <option value="investigacion">Investigación</option>
              <option value="intervencion">Intervención</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha desde</label>
            <input type="date" value={filters.fechaDesde} onChange={e => setF("fechaDesde", e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha hasta</label>
            <input type="date" value={filters.fechaHasta} onChange={e => setF("fechaHasta", e.target.value)} className={inp} />
          </div>
        </div>
      </div>

      {/* What's included */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="font-semibold text-orange-800 text-sm mb-2">El archivo incluye</p>
        <ul className="text-sm text-orange-700 space-y-1">
          <li>• Área, sala, dependencia, punto de medición y superficie</li>
          <li>• Radionúclido, instrumento, valor medido y unidad</li>
          <li>• Clasificación del nivel (normal / registro / investigación / intervención)</li>
          <li>• Fecha de medición, responsable, motivo y acciones correctivas</li>
          <li>• Estado del control y observaciones</li>
        </ul>
      </div>

      {/* Export button */}
      <button onClick={handleExport} disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 transition text-sm">
        <Download size={18} />
        {loading ? "Generando archivo…" : `Exportar como ${format.toUpperCase()}`}
      </button>

      {msg && (
        <div className={`rounded-xl p-3 text-sm font-medium text-center ${msg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg}
        </div>
      )}

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — DS 3/1985 MINSAL · IAEA GSR Part 3</p>
        <p className="text-xs text-blue-600">Los registros exportados forman parte del sistema de vigilancia radiológica y deben conservarse según los plazos establecidos por la normativa vigente.</p>
      </div>
    </div>
  );
}
