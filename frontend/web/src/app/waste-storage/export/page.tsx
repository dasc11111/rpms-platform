"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Package, MapPin, ArrowLeftRight } from "lucide-react";

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300";

type Dataset = "inventory" | "movements" | "locations";
type ExportFormat = "csv" | "xlsx";

interface DatasetOption {
  value: Dataset;
  label: string;
  icon: JSX.Element;
  desc: string;
  includes: string[];
}

const DATASETS: DatasetOption[] = [
  {
    value: "inventory",
    label: "Inventario actual",
    icon: <Package size={18} />,
    desc: "Residuos actualmente en almacenamiento temporal",
    includes: [
      "Código e identificación del residuo",
      "Radionúclido, actividad y fecha de referencia",
      "Ubicación en almacenamiento",
      "Estado, proveedor y propietario",
      "Fecha de ingreso y vencimiento estimado",
    ],
  },
  {
    value: "movements",
    label: "Historial de movimientos",
    icon: <ArrowLeftRight size={18} />,
    desc: "Todos los movimientos de entrada, salida y transferencia",
    includes: [
      "Tipo de movimiento (entrada / salida / transferencia)",
      "Residuo involucrado y actividad en el momento",
      "Fecha, hora y responsable",
      "Ubicación origen y destino",
      "Notas del movimiento",
    ],
  },
  {
    value: "locations",
    label: "Catálogo de ubicaciones",
    icon: <MapPin size={18} />,
    desc: "Todas las ubicaciones de almacenamiento registradas",
    includes: [
      "Código y nombre de la ubicación",
      "Capacidad máxima (en recipientes)",
      "Descripción y observaciones",
      "Estado (activa / inactiva)",
    ],
  },
];

export default function WasteStorageExportPage() {
  const [dataset, setDataset] = useState<Dataset>("inventory");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleExport() {
    setLoading(true); setMsg("");
    try {
      const params = new URLSearchParams({ dataset, format });
      const res = await fetch(`/api/waste-storage/export?${params}`);
      if (!res.ok) { setMsg("Error al generar el archivo"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const labelMap: Record<Dataset, string> = { inventory: "inventario", movements: "movimientos", locations: "ubicaciones" };
      a.download = `residuos_${labelMap[dataset]}_${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("✓ Archivo descargado correctamente");
    } catch {
      setMsg("Error inesperado al exportar");
    } finally {
      setLoading(false);
    }
  }

  const selectedDs = DATASETS.find(d => d.value === dataset)!;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Exportar Almacenamiento de Residuos</h1>
        <p className="text-sm text-muted-foreground mt-1">Descarga datos del inventario, movimientos o ubicaciones en formato CSV o Excel</p>
      </div>

      {/* Dataset selector */}
      <div className="bg-background rounded-xl border border-border p-5 space-y-4">
        <h2 className="font-semibold text-foreground">¿Qué datos exportar?</h2>
        <div className="space-y-3">
          {DATASETS.map(ds => (
            <label key={ds.value}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition ${dataset === ds.value ? "border-green-500 bg-green-50" : "border-border hover:bg-muted/50"}`}>
              <input type="radio" name="dataset" value={ds.value} checked={dataset === ds.value}
                onChange={() => setDataset(ds.value)} className="sr-only" />
              <span className={`mt-0.5 ${dataset === ds.value ? "text-green-600" : "text-muted-foreground"}`}>{ds.icon}</span>
              <div>
                <p className={`font-semibold text-sm ${dataset === ds.value ? "text-green-700" : "text-foreground/80"}`}>{ds.label}</p>
                <p className="text-xs text-muted-foreground">{ds.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Format selector */}
      <div className="bg-background rounded-xl border border-border p-5 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2"><FileSpreadsheet size={18} /> Formato</h2>
        <div className="flex gap-3">
          {(["xlsx", "csv"] as ExportFormat[]).map(f => (
            <label key={f}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition ${format === f ? "border-green-500 bg-green-50 text-green-700" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
              {f === "xlsx" ? "XLSX (Excel)" : "CSV"}
            </label>
          ))}
        </div>
      </div>

      {/* What's included */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="font-semibold text-green-800 text-sm mb-2">El archivo de {selectedDs.label} incluye</p>
        <ul className="text-sm text-green-700 space-y-1">
          {selectedDs.includes.map((item, i) => <li key={i}>• {item}</li>)}
        </ul>
      </div>

      {/* Export button */}
      <button onClick={handleExport} disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition text-sm">
        <Download size={18} />
        {loading ? "Generando archivo…" : `Exportar ${selectedDs.label} como ${format.toUpperCase()}`}
      </button>

      {msg && (
        <div className={`rounded-xl p-3 text-sm font-medium text-center ${msg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg}
        </div>
      )}

      {/* Regulatory footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Marco Normativo — DS 3/1985 MINSAL · CCHEN · IAEA SSG-45</p>
        <p className="text-xs text-blue-600">El inventario de residuos radiactivos en almacenamiento temporal debe reportarse periódicamente a la autoridad reguladora (CCHEN). Conservar los registros según los plazos establecidos.</p>
      </div>
    </div>
  );
}
