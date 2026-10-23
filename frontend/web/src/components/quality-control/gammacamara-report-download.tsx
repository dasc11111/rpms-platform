"use client";

import { useState } from "react";

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

function eqLabel(eq: Equipment): string {
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/código"})`.trim();
}

export default function GammacamaraReportDownload({ equipment }: { equipment: Equipment[] }) {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const qs = equipmentId ? `?equipmentId=${equipmentId}` : "";
      const res = await fetch(`/api/quality-control/gammacamara/report${qs}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : "gammacamara-informe.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Error al generar informe: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-0.5";

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Informe Técnico PDF — Gammacámara</h1>
        <p className="text-xs text-muted-foreground">
          Genera un informe técnico completo por equipo: ficha técnica, historial de servicio,
          baseline vigente por parámetro y pruebas de control de calidad recientes.
          Referencia: IAEA TECDOC-602 / DS 133/1984 MINSAL.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4 bg-surface">
        <h2 className="text-sm font-semibold">Seleccionar equipo</h2>
        <div className="max-w-sm">
          <label className={labelCls}>Equipo</label>
          <select
            className={inputCls}
            value={equipmentId}
            onChange={e => setEquipmentId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Primer equipo disponible</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>{eqLabel(eq)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading}
            className="rounded bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generando PDF...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar informe PDF
              </>
            )}
          </button>
          <a
            href={`/api/quality-control/gammacamara/export/pdf${equipmentId ? `?equipment_id=${equipmentId}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-blue-600 bg-blue-50 px-5 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/40 flex items-center gap-2"
          >
            PDF (servidor)
          </a>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          <strong>PDF (servidor)</strong>: informe profesional landscape A4 con ficha técnica, cumplimiento de frecuencias, pruebas QC por tipo, baseline y alertas — IAEA TECDOC-602.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 bg-surface">
        <h2 className="text-sm font-semibold mb-2">Contenido del informe</h2>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Ficha técnica del equipo (fabricante, modelo, N/S, colimadores, cristal, campo de visión)</li>
          <li>Historial de eventos de servicio (últimos 20 registros)</li>
          <li>Baseline vigente por tipo de prueba, modo y parámetro</li>
          <li>Pruebas de control de calidad recientes (últimas 30, con estado aprobado/rechazado)</li>
        </ol>
      </div>
    </div>
  );
}
