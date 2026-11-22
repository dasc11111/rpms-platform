"use client";
import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Filter } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300";

type ExportFormat = "csv" | "xlsx" | "pdf";

export default function I131ExportPage() {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [filters, setFilters] = useState({
    paciente: "",
    run: "",
    radiofarmaco: "",
    medico_solicitante: "",
    procedencia: "",
    diagnostico: "",
    tipo_examen: "",
    fechaDesde: "",
    fechaHasta: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  function setF(k: string, v: string) { setFilters(f => ({ ...f, [k]: v })); }

  async function handleExport() {
    setLoading(true); setMsg("");
    try {
      const params = new URLSearchParams({ format });
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/i131/export?${params}`);
      if (!res.ok) { setMsg("Error al exportar. Verifique los filtros."); return; }
      const blob = await res.blob();
      const extMap: Record<ExportFormat, string> = { csv: "csv", xlsx: "xlsx", pdf: "pdf" };
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `i131_registros_${new Date().toISOString().slice(0, 10)}.${extMap[format]}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("✓ Archivo descargado correctamente");
    } catch {
      setMsg("Error inesperado al generar el archivo");
    } finally {
      setLoading(false);
    }
  }

  const formatOptions: { value: ExportFormat; label: string; icon: JSX.Element; desc: string }[] = [
    { value: "xlsx", label: "XLSX (Excel)", icon: <FileSpreadsheet size={18} />, desc: "Para análisis con tablas dinámicas" },
    { value: "csv", label: "CSV", icon: <FileText size={18} />, desc: "Compatible con cualquier sistema" },
    { value: "pdf", label: "PDF", icon: <FileText size={18} />, desc: "Para impresión y archivo físico" },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Exportar Registros I-131</h1>
        <p className="text-sm text-gray-500 mt-1">Genera un reporte de administraciones de I-131 en el formato requerido</p>
      </div>

      {/* Format selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><FileSpreadsheet size={18} /> Formato de exportación</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {formatOptions.map(opt => (
            <label key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${format === opt.value ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <input type="radio" name="format" value={opt.value} checked={format === opt.value}
                onChange={() => setFormat(opt.value)} className="sr-only" />
              <span className={format === opt.value ? "text-purple-600" : "text-gray-500"}>{opt.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${format === opt.value ? "text-purple-700" : "text-gray-700"}`}>{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Filter size={18} /> Filtros opcionales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nombre paciente</label>
            <input value={filters.paciente} onChange={e => setF("paciente", e.target.value)}
              placeholder="Apellido o nombre…" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">RUN paciente</label>
            <input value={filters.run} onChange={e => setF("run", e.target.value)}
              placeholder="12345678-9" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Radiofármaco</label>
            <input value={filters.radiofarmaco} onChange={e => setF("radiofarmaco", e.target.value)}
              placeholder="Na¹³¹I…" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Médico Nuclear</label>
            <input value={filters.medico_solicitante} onChange={e => setF("medico_solicitante", e.target.value)}
              placeholder="Dr/Dra…" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo de examen</label>
            <input value={filters.tipo_examen} onChange={e => setF("tipo_examen", e.target.value)}
              placeholder="Diagnóstico, terapia…" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Procedencia</label>
            <input value={filters.procedencia} onChange={e => setF("procedencia", e.target.value)}
              placeholder="Servicio de origen…" className={inp} />
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
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="font-semibold text-purple-800 text-sm mb-2">El reporte incluye</p>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• Identificación del paciente (nombre, RUN, ficha clínica)</li>
          <li>• Radiofármaco administrado, actividad (MBq), fecha y equipo</li>
          <li>• Médico Nuclear solicitante, procedencia y diagnóstico</li>
          <li>• Tipo de examen, protocolo y previsión</li>
          <li>• Notas y observaciones de cada administración</li>
        </ul>
      </div>

      {/* Export button */}
      <button onClick={handleExport} disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 transition text-sm">
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
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — DS 3/1985 MINSAL · CCHEN · Reglamento Medicina Nuclear</p>
        <p className="text-xs text-blue-600">Los registros de administración de I-131 son documentos oficiales auditables. Conservar según plazos establecidos por normativa CCHEN y MINSAL.</p>
      </div>
    </div>
  );
}
