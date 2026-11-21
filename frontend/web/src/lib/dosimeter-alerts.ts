import { sql } from "@/lib/db";

export type DosimeterAlertSeverity = "alta" | "media" | "baja";

export type DosimeterAlert = {
  id: string;
  severity: DosimeterAlertSeverity;
  type: string;
  workerRut: string | null;
  workerName: string | null;
  title: string;
  description: string;
  href: string;
};

export const ALERT_SEVERITY_LABEL: Record<DosimeterAlertSeverity, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const ALERT_SEVERITY_CLASS: Record<DosimeterAlertSeverity, string> = {
  alta: "text-danger bg-danger-subtle",
  media: "text-warning bg-warning-subtle",
  baja: "text-muted-foreground bg-muted/40",
};

const SEVERITY_ORDER: Record<DosimeterAlertSeverity, number> = { alta: 0, media: 1, baja: 2 };

/**
 * Motor de alertas dosimetricas (Dosimetros - fase 3).
 *
 * Analiza automaticamente dosimetry_quarterly (reportes trimestrales
 * Hp10/Hp3/Hp0,07 ya importados en el modulo Dosimetria) junto con
 * workers y dosimeters (asignacion fisica) para detectar:
 *  - Aumento importante de dosis respecto del trimestre anterior.
 *  - Tendencia anual creciente de dosis acumulada.
 *  - Valores inusuales segun el nivel regulatorio (investigacion/intervencion).
 *  - Trabajadores activos sin reporte dosimetrico en el ultimo periodo.
 *  - Dosimetros fisicos sin devolucion (fuera de plazo).
 *
 * Si se entrega onlyRut, el resultado queda acotado a ese trabajador para
 * poder mostrarse en su ficha individual sin recalcular todo el universo.
 */
export async function computeDosimeterAlerts(onlyRut?: string): Promise<DosimeterAlert[]> {
  const alerts: DosimeterAlert[] = [];

  let quarterlyRows: any[] = [];
  try {
    const { rows } = onlyRut
      ? await sql`SELECT worker_rut, worker_name, year, quarter, period_label, dose_body, accum_year_body, level FROM dosimetry_quarterly WHERE worker_rut = ${onlyRut} ORDER BY year ASC, quarter ASC`
      : await sql`SELECT worker_rut, worker_name, year, quarter, period_label, dose_body, accum_year_body, level FROM dosimetry_quarterly ORDER BY year ASC, quarter ASC`;
    quarterlyRows = rows;
  } catch {
    quarterlyRows = [];
  }

  const byWorker = new Map<string, any[]>();
  let maxYear = 0;
  let maxQuarter = 0;
  for (const r of quarterlyRows) {
    const key = r.worker_rut;
    if (!byWorker.has(key)) byWorker.set(key, []);
    byWorker.get(key)!.push(r);
    if (r.year > maxYear || (r.year === maxYear && r.quarter > maxQuarter)) {
      maxYear = r.year;
      maxQuarter = r.quarter;
    }
  }

  for (const [rut, rows] of byWorker) {
    const name = rows[rows.length - 1]?.worker_name ?? rut;

    if (rows.length >= 2) {
      const last = rows[rows.length - 1];
      const prev = rows[rows.length - 2];
      const lastDose = Number(last.dose_body) || 0;
      const prevDose = Number(prev.dose_body) || 0;
      if (prevDose > 0 && lastDose >= prevDose * 1.5 && lastDose - prevDose >= 0.1) {
        const pct = Math.round(((lastDose - prevDose) / prevDose) * 100);
        alerts.push({
          id: `inc-${rut}-${last.period_label}`,
          severity: pct >= 100 ? "alta" : "media",
          type: "aumento_trimestral",
          workerRut: rut,
          workerName: name,
          title: `Aumento de dosis: ${name}`,
          description: `Dosis cuerpo entero ${last.period_label} (${lastDose.toFixed(2)} mSv) subio ${pct}% respecto de ${prev.period_label} (${prevDose.toFixed(2)} mSv).`,
          href: `/workers/${rut}`,
        });
      } else if (prevDose === 0 && lastDose >= 0.3) {
        alerts.push({
          id: `newdose-${rut}-${last.period_label}`,
          severity: "media",
          type: "aumento_trimestral",
          workerRut: rut,
          workerName: name,
          title: `Nueva dosis relevante: ${name}`,
          description: `Registro ${lastDose.toFixed(2)} mSv en ${last.period_label} sin dosis previa en ${prev.period_label}.`,
          href: `/workers/${rut}`,
        });
      }
    }

    const lastByYear = new Map<number, any>();
    for (const r of rows) lastByYear.set(r.year, r);
    const years = Array.from(lastByYear.keys()).sort((a, b) => a - b);
    if (years.length >= 2) {
      const lastY = years[years.length - 1]!;
      const prevY = years[years.length - 2]!;
      const lastRow = lastByYear.get(lastY);
      const prevRow = lastByYear.get(prevY);
      const lastVal = Number(lastRow?.accum_year_body) || 0;
      const prevVal = Number(prevRow?.accum_year_body) || 0;
      if (prevVal > 0 && lastVal > prevVal * 1.2) {
        alerts.push({
          id: `trend-${rut}-${lastY}`,
          severity: "media",
          type: "tendencia_anual",
          workerRut: rut,
          workerName: name,
          title: `Tendencia anual creciente: ${name}`,
          description: `Dosis acumulada ${lastY} (${lastVal.toFixed(2)} mSv) supera a ${prevY} (${prevVal.toFixed(2)} mSv).`,
          href: `/workers/${rut}`,
        });
      }
    }

    const last = rows[rows.length - 1];
    if (last.level === "intervencion") {
      alerts.push({
        id: `level-${rut}-${last.period_label}`,
        severity: "alta",
        type: "valor_inusual",
        workerRut: rut,
        workerName: name,
        title: `Nivel de intervencion: ${name}`,
        description: `Dosis cuerpo entero ${last.period_label}: ${Number(last.dose_body).toFixed(2)} mSv (>= 5 mSv trimestral).`,
        href: `/workers/${rut}`,
      });
    } else if (last.level === "investigacion") {
      alerts.push({
        id: `level-${rut}-${last.period_label}`,
        severity: "media",
        type: "valor_inusual",
        workerRut: rut,
        workerName: name,
        title: `Nivel de investigacion: ${name}`,
        description: `Dosis cuerpo entero ${last.period_label}: ${Number(last.dose_body).toFixed(2)} mSv (>= 1,6 mSv trimestral).`,
        href: `/workers/${rut}`,
      });
    }
  }

  if (!onlyRut && maxYear > 0) {
    const latestLabel =
      quarterlyRows.find((r) => r.year === maxYear && r.quarter === maxQuarter)?.period_label ?? `T${maxQuarter}-${maxYear}`;
    const { rows: activeWorkers } = await sql`SELECT rut, name FROM workers WHERE status <> 'inactive'`;
    for (const w of activeWorkers as any[]) {
      const rows = byWorker.get(w.rut);
      const hasLatest = rows?.some((r) => r.year === maxYear && r.quarter === maxQuarter);
      if (!hasLatest) {
        alerts.push({
          id: `missing-${w.rut}`,
          severity: "baja",
          type: "sin_reporte",
          workerRut: w.rut,
          workerName: w.name,
          title: `Sin reporte dosimetrico: ${w.name}`,
          description: `No registra lectura dosimetrica en el periodo ${latestLabel}.`,
          href: `/workers/${w.rut}`,
        });
      }
    }
  }

  try {
    const overdueQuery = onlyRut
      ? await sql`SELECT id, code, worker_rut, worker_name, estimated_return_date FROM dosimeters WHERE status = 'asignado' AND estimated_return_date IS NOT NULL AND estimated_return_date < CURRENT_DATE AND worker_rut = ${onlyRut}`
      : await sql`SELECT id, code, worker_rut, worker_name, estimated_return_date FROM dosimeters WHERE status = 'asignado' AND estimated_return_date IS NOT NULL AND estimated_return_date < CURRENT_DATE`;
    for (const d of overdueQuery.rows as any[]) {
      const days = Math.floor((Date.now() - new Date(d.estimated_return_date).getTime()) / 86400000);
      alerts.push({
        id: `overdue-${d.id}`,
        severity: days > 30 ? "alta" : "media",
        type: "sin_devolucion",
        workerRut: d.worker_rut,
        workerName: d.worker_name,
        title: `Dosimetro sin devolver: ${d.code}`,
        description: `Asignado a ${d.worker_name || "trabajador"}, ${days} dia(s) fuera de plazo.`,
        href: `/dosimeters`,
      });
    }
  } catch {
    // la tabla dosimeters puede no existir aun en algun entorno; se ignora en silencio
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return onlyRut ? alerts.filter((a) => a.workerRut === onlyRut) : alerts;
}
