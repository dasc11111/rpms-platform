import Link from "next/link";
import { sql } from "@/lib/db";
import { rutMatchKey } from "@/lib/rut";
import { CsvImport } from "@/components/import/csv-import";
import { WorkerFormModal } from "@/components/workers/worker-form-modal";
import { ExportWorkersButton } from "@/components/workers/export-workers-button";
import { WorkersTable, type WorkerRow } from "@/components/workers/workers-table";

export const dynamic = "force-dynamic";

async function ensureNameColumns() {
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_name_1 TEXT`;
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS last_name_2 TEXT`;
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS first_names TEXT`;
}

// Trae, para cada RUT (clave tolerante), si el trabajador tiene algun
// registro de dosimetria trimestral y si tiene el reporte del trimestre
// en curso, para poder filtrarlos en el listado (fase 4).
async function getDosimetryFlags(): Promise<{ any: Set<string>; current: Set<string> }> {
  try {
    const { rows } = await sql`SELECT worker_rut, year, quarter FROM dosimetry_quarterly`;
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    const any = new Set<string>();
    const current = new Set<string>();
    for (const r of rows as any[]) {
      const key = rutMatchKey(String(r.worker_rut ?? ""));
      if (!key) continue;
      any.add(key);
      if (Number(r.year) === year && Number(r.quarter) === quarter) current.add(key);
    }
    return { any, current };
  } catch {
    return { any: new Set(), current: new Set() };
  }
}

async function getWorkers(): Promise<WorkerRow[]> {
  try {
    await ensureNameColumns();
    const [{ rows }, flags] = await Promise.all([
      sql`
        SELECT rut, name, last_name_1, last_name_2, first_names, role, service, category, status, annual_dose,
               dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
               course_pr_completed, course_pr_date,
               authorization_number, authorization_issue_date, authorization_expiry_date, notes
        FROM workers
        WHERE status <> 'inactive'
        ORDER BY COALESCE(NULLIF(last_name_1, ''), name) ASC
      `,
      getDosimetryFlags(),
    ]);
    return rows.map((w: any) => {
      const key = rutMatchKey(String(w.rut ?? ""));
      return {
        ...w,
        has_dosimetry: flags.any.has(key),
        has_current_quarter: flags.current.has(key),
      };
    }) as WorkerRow[];
  } catch {
    return [];
  }
}

async function getInactiveCount(): Promise<number> {
  try {
    const { rows } = await sql`SELECT COUNT(*)::int AS count FROM workers WHERE status = 'inactive'`;
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export default async function WorkersPage() {
  const [workers, inactiveCount] = await Promise.all([getWorkers(), getInactiveCount()]);

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Trabajadores</h1>
        <Link
          href="/workers/inactive"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Ver trabajadores inactivos ({inactiveCount})
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <WorkerFormModal />
        <ExportWorkersButton />
      </div>
      <CsvImport
        endpoint="/api/workers"
        label="Importar CSV de trabajadores"
        hint="Columnas: rut, apellido_paterno, apellido_materno, nombres, cargo, servicio, categoria, estado, dosis_anual"
      />
      <WorkersTable workers={workers} />
    </div>
  );
}
