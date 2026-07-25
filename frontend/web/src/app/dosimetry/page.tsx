import { Users, ShieldCheck, AlertTriangle, ShieldAlert, FileText, FileSpreadsheet, ClipboardCheck } from "lucide-react";
import { KPICard } from "@/components/dashboard/kpi-card";
import { DoseReportModal } from "@/components/dosimetry/dose-report-modal";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  worker_rut: string;
  worker_name: string;
  departamento: string | null;
  year: number;
  quarter: number;
  period_label: string;
  dose_body: string;
  dose_lens: string;
  dose_skin: string;
  accum_60m_body: string;
  level: string;
  source_document_id: number | null;
  blob_url: string | null;
};

type DocRow = {
  id: number;
  filename: string;
  blob_url: string;
  source_type: string;
  period_label: string | null;
  year: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  used_ocr: boolean;
  records_count: number;
  status: string;
};

const LEVEL_LABEL: Record<string, { label: string; className: string }> = {
  normal: { label: "Normal", className: "text-muted-foreground" },
  registro: { label: "Nivel de registro", className: "text-warning" },
  investigacion: { label: "Nivel de investigacion", className: "text-orange-500" },
  intervencion: { label: "Nivel de intervencion", className: "text-danger" },
};

async function getData(): Promise<Row[]> {
  try {
    await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS source_document_id INT`;
    const { rows } = await sql`
      SELECT q.worker_rut, q.worker_name, q.departamento, q.year, q.quarter, q.period_label,
             q.dose_body, q.dose_lens, q.dose_skin, q.accum_60m_body, q.level,
             q.source_document_id, d.blob_url
      FROM dosimetry_quarterly q
      LEFT JOIN dosimetry_documents d ON d.id = q.source_document_id
      ORDER BY q.year DESC, q.quarter DESC, q.worker_name ASC
    `;
    return rows as Row[];
  } catch {
    return [];
  }
}

async function getDocuments(): Promise<{ docs: DocRow[]; stats: { pdfCount: number; excelCount: number; recordsExtracted: number; pendingValidation: number } }> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS dosimetry_documents (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        blob_url TEXT,
        mime_type TEXT,
        size_bytes INT,
        file_hash TEXT UNIQUE,
        source_type TEXT DEFAULT 'pdf',
        provider TEXT,
        period_label TEXT,
        year INT,
        uploaded_by TEXT,
        uploaded_at TIMESTAMP DEFAULT now(),
        used_ocr BOOLEAN DEFAULT false,
        records_count INT DEFAULT 0,
        status TEXT DEFAULT 'processed'
      )
    `;
    const { rows } = await sql`
      SELECT id, filename, blob_url, source_type, period_label, year, uploaded_by, uploaded_at, used_ocr, records_count, status
      FROM dosimetry_documents
      ORDER BY uploaded_at DESC
      LIMIT 20
    `;
    const docs = rows as DocRow[];
    const pdfCount = docs.filter((d) => d.source_type === "pdf").length;
    const excelCount = docs.filter((d) => d.source_type === "xlsx" || d.source_type === "csv").length;
    const recordsExtracted = docs.reduce((acc, d) => acc + (Number(d.records_count) || 0), 0);
    const pendingValidation = docs.filter((d) => d.status === "pending").length;
    return { docs, stats: { pdfCount, excelCount, recordsExtracted, pendingValidation } };
  } catch {
    return { docs: [], stats: { pdfCount: 0, excelCount: 0, recordsExtracted: 0, pendingValidation: 0 } };
  }
}

export default async function DosimetryPage() {
  const all = await getData();
  const { docs, stats } = await getDocuments();

  const latest = all[0];
  const latestLabel = latest?.period_label ?? null;

  const countByLevel = (lvl: string) => all.filter((r) => r.level === lvl).length;
  const totalWorkers = new Set(all.map((r) => r.worker_rut)).size;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-1">Dosimetria</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        {latestLabel ? `Ultimo periodo cargado: ${latestLabel}` : "Sin datos cargados"} · Niveles de referencia (dosis cuerpo entero por trimestre): Registro ≥ 0,1 mSv · Investigacion ≥ 1,6 mSv · Intervencion ≥ 5 mSv
      </p>

      <DoseReportModal />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="Trabajadores monitoreados" value={totalWorkers} href="/dosimetry" icon={Users} />
        <KPICard label="Nivel de registro" value={countByLevel("registro")} href="/dosimetry" icon={ShieldCheck} tone="warning" />
        <KPICard label="Nivel de investigacion" value={countByLevel("investigacion")} href="/dosimetry" icon={AlertTriangle} tone="warning" />
        <KPICard label="Nivel de intervencion" value={countByLevel("intervencion")} href="/dosimetry" icon={ShieldAlert} tone="danger" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KPICard label="PDFs importados" value={stats.pdfCount} href="/dosimetry" icon={FileText} />
        <KPICard label="Excel/CSV importados" value={stats.excelCount} href="/dosimetry" icon={FileSpreadsheet} />
        <KPICard label="Registros extraidos" value={stats.recordsExtracted} href="/dosimetry" icon={ClipboardCheck} />
        <KPICard label="Pendientes de validacion" value={stats.pendingValidation} href="/dosimetry" icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mb-6 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">Departamento</th>
              <th className="px-3 py-2">Periodo</th>
              <th className="px-3 py-2 text-right">Cuerpo entero (mSv)</th>
              <th className="px-3 py-2 text-right">Cristalino (mSv)</th>
              <th className="px-3 py-2 text-right">Piel (mSv)</th>
              <th className="px-3 py-2 text-right">Acumulado 5 anos (mSv)</th>
              <th className="px-3 py-2">Nivel</th>
              <th className="px-3 py-2">Fuente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {all.map((r, i) => {
              const lv = LEVEL_LABEL[r.level] ?? { label: r.level, className: "text-muted-foreground" };
              return (
                <tr key={i} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{r.worker_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.departamento}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.period_label}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_body).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_lens).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_skin).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.accum_60m_body).toFixed(2)}</td>
                  <td className={`px-3 py-2.5 ${lv.className}`}>{lv.label}</td>
                  <td className="px-3 py-2.5">
                    {r.blob_url ? (
                      <a href={r.blob_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        Ver Reporte Fuente
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {all.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No hay lecturas dosimetricas cargadas todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Documentos importados</h2>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Archivo</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Periodo</th>
              <th className="px-3 py-2">Cargado por</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 text-right">Registros</th>
              <th className="px-3 py-2">OCR</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 font-medium">{d.filename}</td>
                <td className="px-3 py-2.5 text-muted-foreground uppercase">{d.source_type}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.period_label || "-"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.uploaded_by || "-"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{new Date(d.uploaded_at).toLocaleDateString("es-CL")}</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">{d.records_count}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.used_ocr ? "Si" : "No"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.status}</td>
                <td className="px-3 py-2.5">
                  {d.blob_url && (
                    <a href={d.blob_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      Ver Reporte Original
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No hay documentos importados todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
