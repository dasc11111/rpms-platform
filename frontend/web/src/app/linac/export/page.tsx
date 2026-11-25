"use client";

import { useState } from "react";
import { Download, FileText, Table2, FileJson } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

const DATASETS = [
  {
    id: "qa_records",
    label: "Registros QA",
    icon: <FileText size={20} className="text-indigo-500" />,
    desc: "Registros de control de calidad con resultados, estados y observaciones",
    fields: ["id", "linac_id", "category", "fecha", "estado", "valor_medido", "tolerancia", "responsable"],
  },
  {
    id: "commissioning",
    label: "Datasets Comisionamiento",
    icon: <Table2 size={20} className="text-green-500" />,
    desc: "Datasets de comisionamiento por categoría y estado",
    fields: ["id", "linac_id", "category", "version", "status", "is_current", "created_at"],
  },
  {
    id: "baseline",
    label: "Datos Baseline",
    icon: <Table2 size={20} className="text-blue-500" />,
    desc: "Conjuntos de datos de referencia baseline vigentes e históricos",
    fields: ["id", "linac_id", "category", "measurement_type", "is_current", "promoted_at"],
  },
  {
    id: "beamdata",
    label: "Datos de Haz",
    icon: <FileJson size={20} className="text-purple-500" />,
    desc: "Librería de datos de haz — PDDs, perfiles, factores de campo",
    fields: ["id", "linac_id", "modality", "energy", "measurement_type", "field_size", "depth", "value", "unit"],
  },
  {
    id: "acceptance",
    label: "Pruebas de Aceptación",
    icon: <FileText size={20} className="text-orange-500" />,
    desc: "Resultados de pruebas de aceptación por protocolo y categoría",
    fields: ["id", "linac_id", "category", "test_name", "result", "status", "test_date", "responsible"],
  },
  {
    id: "instrument_validation",
    label: "Validación Instrumentos",
    icon: <FileText size={20} className="text-red-500" />,
    desc: "Calibraciones y certificados de instrumentos de medición",
    fields: ["id", "instrument_code", "instrument_name", "serial_number", "calibration_date", "expiry_date", "status"],
  },
];

const FORMATS = [
  { id: "csv",  label: "CSV",  icon: <Table2 size={18} />,   desc: "Compatible con Excel, R, Python" },
  { id: "xlsx", label: "XLSX", icon: <Table2 size={18} />,   desc: "Microsoft Excel nativo" },
];

export default function LinacExportPage() {
  const [dataset, setDataset] = useState("qa_records");
  const [format, setFormat] = useState("csv");
  const [linacId, setLinacId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleExport() {
    setLoading(true); setMsg("");
    try {
      const params = new URLSearchParams({ dataset, format });
      if (linacId) params.set("linacId", linacId);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      if (category) params.set("category", category);

      const res = await fetch(`/api/linac/export?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error ?? "Error al exportar");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const selectedDs = DATASETS.find(d => d.id === dataset);
      a.download = `linac_${dataset}_${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`✓ Exportación de "${selectedDs?.label}" descargada`);
    } finally {
      setLoading(false);
    }
  }

  const selectedDs = DATASETS.find(d => d.id === dataset);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Exportar Datos LINAC</h1>
        <p className="text-sm text-gray-500 mt-1">Exportación de registros de control de calidad, comisionamiento y datos de haz</p>
      </div>

      {/* Dataset selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">1. Seleccionar conjunto de datos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DATASETS.map(ds => (
            <button key={ds.id} onClick={() => setDataset(ds.id)}
              className={`flex items-start gap-3 p-3 rounded-lg border text-left transition ${
                dataset === ds.id ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
              }`}>
              <div className="mt-0.5">{ds.icon}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${dataset === ds.id ? "text-indigo-800" : "text-gray-800"}`}>{ds.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{ds.desc}</p>
              </div>
            </button>
          ))}
        </div>
        {selectedDs && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-semibold mb-1">Campos incluidos:</p>
            <div className="flex flex-wrap gap-1">
              {selectedDs.fields.map(f => (
                <span key={f} className="bg-white border border-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded font-mono">{f}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Format selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">2. Seleccionar formato</h2>
        <div className="flex gap-3">
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => setFormat(f.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border flex-1 transition ${
                format === f.id ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
              }`}>
              <span className={format === f.id ? "text-indigo-600" : "text-gray-500"}>{f.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${format === f.id ? "text-indigo-800" : "text-gray-800"}`}>{f.label}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm">3. Filtros opcionales</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">LINAC ID</label>
            <input value={linacId} onChange={e => setLinacId(e.target.value)} placeholder="Todos" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Categoría</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Todas" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className={inp} />
          </div>
        </div>
      </div>

      {/* Export button */}
      <div className="flex items-center gap-4">
        <button onClick={handleExport} disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50 text-sm">
          <Download size={18} />
          {loading ? "Generando…" : `Exportar como ${format.toUpperCase()}`}
        </button>
        {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{msg}</p>}
      </div>

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — D.S. 3/2010 · OIEA BSS · RG-DM-005</p>
        <p className="text-xs text-blue-600">Los registros exportados son documentos técnicos sujetos a trazabilidad. Conservar de acuerdo al plan de gestión documental del servicio.</p>
      </div>
    </div>
  );
}
