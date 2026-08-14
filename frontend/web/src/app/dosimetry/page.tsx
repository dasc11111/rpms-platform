import { Users, ShieldCheck, AlertTriangle, ShieldAlert, FileText, FileSpreadsheet, ClipboardCheck, Package, Search } from "lucide-react";
import Link from "next/link";
import { KPICard } from "@/components/dashboard/kpi-card";
import { LevelKpiCard } from "@/components/dosimetry/level-kpi-card";
import { DoseReportModal } from "@/components/dosimetry/dose-report-modal";
import { NotReturnedTable } from "@/components/dosimetry/not-returned-table";
import { QuarterlyTable } from "@/components/dosimetry/quarterly-table";
import { AnnualSummaryTable } from "@/components/dosimetry/annual-summary-table";
import { LateReturnsTable } from "@/components/dosimetry/late-returns-table";
import { sql } from "@/lib/db";
import {
  getAnnualSummary,
  getNotReturned,
  getLateReturns,
  DOSE_QUALITATIVE_CODES,
  DOSIMETER_KIND_CODES,
  RADIATION_CODES,
  ANNUAL_STATUS_CODES,
} from "@/lib/dosimetry";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
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

const TABS: { key: string; label: string }[] = [
  { key: "trimestre", label: "Reportes por trimestre" },
  { key: "anual", label: "Resumen anual" },
  { key: "no-devueltos", label: "No devueltos" },
  { key: "fuera-plazo", label: "Devueltos fuera de plazo" },
];

async function getData(): Promise<Row[]> {
  try {
    await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS source_document_id INT`;
    const { rows } = await sql`
      SELECT q.id, q.worker_rut, q.worker_name, q.departamento, q.year, q.quarter, q.period_label,
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

export default async function DosimetryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp?.tab && TABS.some((t) => t.key === sp.tab) ? sp.tab : "trimestre";

  let all: Row[] = [];
  let docs: DocRow[] = [];
  let stats = { pdfCount: 0, excelCount: 0, recordsExtracted: 0, pendingValidation: 0 };
  let annualRows: Awaited<ReturnType<typeof getAnnualSummary>> = [];
  let notReturnedRows: Awaited<ReturnType<typeof getNotReturned>> = [];
  let lateRows: Awaited<ReturnType<typeof getLateReturns>> = [];

  if (tab === "trimestre") {
    all = await getData();
    const docData = await getDocuments();
    docs = docData.docs;
    stats = docData.stats;
  } else if (tab === "anual") {
    try { annualRows = await getAnnualSummary(); } catch { annualRows = []; }
  } else if (tab === "no-devueltos") {
    try { notReturnedRows = await getNotReturned(); } catch { notReturnedRows = []; }
  } else if (tab === "fuera-plazo") {
    try { lateRows = await getLateReturns(); } catch { lateRows = []; }
  }

  const latest = all[0];
  const latestLabel = latest?.period_label ?? null;

  const countByLevel = (lvl: string) => all.filter((r) => r.level === lvl).length;
  const totalWorkers = new Set(all.map((r) => r.worker_rut)).size;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <h1 className="text-lg font-semibold mb-1">Dosimetria</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        {latestLabel ? `Ultimo periodo cargado: ${latestLabel}` : "Planilla oficial Resumen - 908.xlsm"} · Niveles de referencia (dosis cuerpo entero por trimestre): Registro ≥ 0,1 mSv · Investigacion ≥ 1,6 mSv · Intervencion ≥ 5 mSv
      </p>

      <DoseReportModal />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dosimetry?tab=${t.key}`}
            className={
              tab === t.key
                ? "border-b-2 border-accent px-3 py-2 text-xs font-medium text-foreground"
                : "border-b-2 border-transparent px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      <details className="mb-4 rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">Glosario de siglas (hoja &quot;siglas&quot; de la planilla oficial)</summary>
        <div className="mt-3 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-foreground">Codigos de dosis / estado del dosimetro</p>
            <ul className="space-y-1 text-muted-foreground">
              {Object.entries(DOSE_QUALITATIVE_CODES).map(([code, desc]) => (
                <li key={code}><span className="font-medium text-foreground">{code}</span>: {desc}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">Tipo de dosimetro</p>
            <ul className="space-y-1 text-muted-foreground">
              {Object.entries(DOSIMETER_KIND_CODES).map(([code, desc]) => (
                <li key={code}><span className="font-medium text-foreground">{code}</span>: {desc}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">Tipo de radiacion</p>
            <ul className="space-y-1 text-muted-foreground">
              {Object.entries(RADIATION_CODES).map(([code, desc]) => (
                <li key={code}><span className="font-medium text-foreground">{code}</span>: {desc}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">Estado anual del trabajador</p>
            <ul className="space-y-1 text-muted-foreground">
              {Object.entries(ANNUAL_STATUS_CODES).map(([code, desc]) => (
                <li key={code}><span className="font-medium text-foreground">{code}</span>: {desc}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      {tab === "trimestre" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <KPICard label="Trabajadores monitoreados" value={totalWorkers} href="/dosimetry" icon={Users} />
            <LevelKpiCard label="Nivel de registro" level="registro" rows={all} icon={ShieldCheck} tone="warning" />
            <LevelKpiCard label="Nivel de investigacion" level="investigacion" rows={all} icon={AlertTriangle} tone="warning" />
            <LevelKpiCard label="Nivel de intervencion" level="intervencion" rows={all} icon={ShieldAlert} tone="danger" />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <KPICard label="PDFs importados" value={stats.pdfCount} href="/dosimetry" icon={FileText} />
            <KPICard label="Excel/CSV importados" value={stats.excelCount} href="/dosimetry" icon={FileSpreadsheet} />
            <KPICard label="Registros extraidos" value={stats.recordsExtracted} href="/dosimetry" icon={ClipboardCheck} />
            <KPICard label="Pendientes de validacion" value={stats.pendingValidation} href="/dosimetry" icon={AlertTriangle} tone="warning" />
          </div>

          <div className="mb-6">
            <QuarterlyTable rows={all} />
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
        </>
      )}

      {tab === "anual" && <AnnualSummaryTable rows={annualRows} />}

      {tab === "no-devueltos" && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-2">
            <KPICard label="Pendientes de devolver" value={notReturnedRows.filter((r) => !r.extraviado).length} href="/dosimetry?tab=no-devueltos" icon={Package} tone="warning" />
            <KPICard label="Extraviados" value={notReturnedRows.filter((r) => r.extraviado).length} href="/dosimetry?tab=no-devueltos" icon={Search} tone="danger" />
          </div>
          <NotReturnedTable initialRows={notReturnedRows} />
        </div>
      )}

      {tab === "fuera-plazo" && <LateReturnsTable rows={lateRows} />}
    </div>
  );
}
