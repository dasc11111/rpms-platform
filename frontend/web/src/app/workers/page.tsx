import Link from "next/link";
import { sql } from "@/lib/db";
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

async function getWorkers(): Promise<WorkerRow[]> {
  try {
    await ensureNameColumns();
    const { rows } = await sql`
      SELECT rut, name, last_name_1, last_name_2, first_names, role, service, category, status, annual_dose,
        dv, sex, address, phone, email, birth_date, estamento, contract_type, unit,
        course_pr_completed, course_pr_date,
        authorization_number, authorization_issue_date, authorization_expiry_date, notes
      FROM workers
      WHERE status <> 'inactive'
      ORDER BY COALESCE(NULLIF(last_name_1, ''), name) ASC
    `;
    return rows as WorkerRow[];
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
