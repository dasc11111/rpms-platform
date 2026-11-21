import { sql } from "@/lib/db";

/**
 * Motor de sincronizacion automatica (Trabajadores - fase 5).
 *
 * Cada vez que se carga o edita un reporte trimestral de dosimetria
 * (importacion masiva o carga manual), esta funcion actualiza el campo
 * `annual_dose` del trabajador en la tabla `workers` para que el listado
 * principal y el dashboard siempre reflejen la dosis acumulada del año en
 * curso segun el ultimo trimestre informado en `dosimetry_quarterly`,
 * sin intervencion manual.
 */
export async function syncAnnualDoseForWorker(rut: string, year: number): Promise<boolean> {
  const { rows } = await sql`
    SELECT accum_year_body
    FROM dosimetry_quarterly
    WHERE worker_rut = ${rut} AND year = ${year}
    ORDER BY quarter DESC
    LIMIT 1
  `;
  if (rows.length === 0) return false;
  const value = Number((rows[0] as any).accum_year_body);
  if (!Number.isFinite(value)) return false;
  await sql`UPDATE workers SET annual_dose = ${value} WHERE rut = ${rut}`;
  return true;
}

/** Sincroniza la dosis anual de un conjunto de trabajadores (sin duplicados). */
export async function syncAnnualDoseForWorkers(ruts: Iterable<string>, year: number): Promise<number> {
  let synced = 0;
  for (const rut of new Set(ruts)) {
    const ok = await syncAnnualDoseForWorker(rut, year);
    if (ok) synced++;
  }
  return synced;
}
