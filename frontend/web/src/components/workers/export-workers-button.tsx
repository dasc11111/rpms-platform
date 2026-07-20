"use client";
import { useState } from "react";
import { Download, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { daysRemaining, getAuthStatus, AUTH_STATUS_LABEL } from "@/lib/authorization";

/**
 * Exportacion completa de trabajadores (XLSX o CSV), incluyendo Curso PR y
 * Autorizacion de Desempeno con los dias restantes y el estado calculados en
 * el momento de exportar. Usa "/api/workers?all=1" para no perder informacion
 * (incluye activos, suspendidos e inactivos). La libreria xlsx se carga de
 * forma diferida (dynamic import) solo cuando el usuario elige Excel, para no
 * afectar el tamaño del bundle inicial ni el rendimiento de la pagina.
 */

type ExportWorker = {
  rut: string;
  name: string;
  role: string | null;
  service: string | null;
  category: string | null;
  status: string;
  annual_dose: string | number;
  dv: string | null;
  sex: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  estamento: string | null;
  contract_type: string | null;
  unit: string | null;
  course_pr_completed: boolean;
  course_pr_date: string | null;
  authorization_number: string | null;
  authorization_issue_date: string | null;
  authorization_expiry_date: string | null;
  notes: string | null;
};

const HEADERS = [
  "RUT", "DV", "Nombre", "Cargo", "Servicio", "Unidad", "Estamento",
  "Calidad contractual", "Categoría ICRP", "Dosis anual (mSv)", "Sexo",
  "Fecha nacimiento", "Teléfono", "Correo electrónico", "Dirección", "Estado",
  "Curso PR", "Fecha Curso PR", "N° autorización", "Fecha emisión",
  "Fecha vencimiento", "Días restantes", "Estado autorización", "Observaciones",
];

function statusLabel(status: string): string {
  if (status === "active") return "Activa";
  if (status === "suspended") return "Suspendida";
  if (status === "inactive") return "Inactiva";
  return status;
}

function toRow(w: ExportWorker): (string | number)[] {
  const days = daysRemaining(w.authorization_expiry_date);
  const authStatus = getAuthStatus(days);
  return [
    w.rut ?? "", w.dv ?? "", w.name ?? "", w.role ?? "", w.service ?? "", w.unit ?? "",
    w.estamento ?? "", w.contract_type ?? "", w.category ?? "", Number(w.annual_dose ?? 0),
    w.sex ?? "", w.birth_date ?? "", w.phone ?? "", w.email ?? "", w.address ?? "",
    statusLabel(w.status),
    w.course_pr_completed ? "Sí" : "No", w.course_pr_date ?? "", w.authorization_number ?? "",
    w.authorization_issue_date ?? "", w.authorization_expiry_date ?? "",
    days === null ? "" : days, AUTH_STATUS_LABEL[authStatus], w.notes ?? "",
  ];
}

function toCsvValue(v: string | number): string {
  const s = String(v ?? "");
  if (/["\n,]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportWorkersButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"csv" | "xlsx" | null>(null);

  async function exportAs(format: "csv" | "xlsx") {
    setOpen(false);
    setLoading(format);
    try {
      const res = await fetch("/api/workers?all=1");
      const data = await res.json().catch(() => ({ workers: [] }));
      const workers: ExportWorker[] = data.workers || [];
      const rows = workers.map(toRow);
      const stamp = new Date().toISOString().slice(0, 10);

      if (format === "csv") {
        const csv = [HEADERS, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\r\n");
        downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `trabajadores-${stamp}.csv`);
      } else {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trabajadores");
        XLSX.writeFile(wb, `trabajadores-${stamp}.xlsx`);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading !== null}
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Exportar trabajadores
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <button
            type="button"
            onClick={() => exportAs("xlsx")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => exportAs("csv")}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs hover:bg-muted"
          >
            <FileText className="h-3.5 w-3.5" />
            CSV (.csv)
          </button>
        </div>
      )}
    </div>
  );
}
