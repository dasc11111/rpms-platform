"use client";


import { useState } from "react";
import { Download, FileText } from "lucide-react";

const inp = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

export default function DosimetryExportPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [quarter, setQuarter] = useState("");
  const [workerRut, setWorkerRut] = useState("");
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");

  const doExport = async () => {
    setExporting(true); setMsg("");
    const params = new URLSearchParams({ year });
    if (quarter) params.set("quarter", quarter);
    if (workerRut.trim()) params.set("workerRut", workerRut.trim());
    const r = await fetch(`/api/dosimetry/export/pdf?${params}`);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg((d as { error?: string }).error ?? "Error al exportar."); setExporting(false); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dosimetria_${year}${quarter ? `_T${quarter}` : ""}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("PDF exportado correctamente.");
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100"><Download className="h-6 w-6 text-blue-700" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exportar Informe de Dosis</h1>
            <p className="text-sm text-gray-500">Genera informe PDF de dosimetría para el período seleccionado</p>
          </div>
        </div>

        {msg && <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">{msg}</div>}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Parámetros de exportación</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-gray-500 mb-1 block">Año *</label>
              <select className={inp} value={year} onChange={e => setYear(e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Trimestre (opcional)</label>
              <select className={inp} value={quarter} onChange={e => setQuarter(e.target.value)}>
                <option value="">Año completo</option>
                <option value="1">T1</option>
                <option value="2">T2</option>
                <option value="3">T3</option>
                <option value="4">T4</option>
              </select>
            </div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">RUT trabajador (opcional, deja vacío para todos)</label>
              <input className={inp} value={workerRut} onChange={e => setWorkerRut(e.target.value)} placeholder="12.345.678-9" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-600">El informe PDF incluye:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Tabla de dosis individuales (Hp(10), Hp(3), Hp(0.07))</li>
              <li>Dosis acumuladas a 12 y 60 meses</li>
              <li>Semáforo de alerta por nivel de dosis</li>
              <li>Resumen estadístico del grupo</li>
              <li>Referencia a límites MINSAL / CCHEN</li>
            </ul>
          </div>

          <button onClick={doExport} disabled={exporting} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg">
            <FileText className="h-4 w-4" />{exporting ? "Generando PDF…" : "Exportar informe PDF"}
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-xs text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">Marco normativo</p>
          <p>DS N°133/1984 y DS N°95/2005 MINSAL — Obligatoriedad de emitir informes de dosis a trabajadores. CCHEN ORD sobre formato de registros dosimétricos. Límites: Hp(10) 20 mSv/año efectiva, Hp(3) 150 mSv/año cristalino, Hp(0.07) 500 mSv/año piel.</p>
        </div>
      </div>
    </div>
  );
}
