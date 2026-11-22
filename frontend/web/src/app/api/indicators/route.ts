import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §75 — Indicadores de Desempeño del Programa PR
// NS-06.0 §8.4: El programa PR debe definir indicadores de desempeño cuantificables
// y hacer seguimiento periódico para verificar la eficacia del programa.

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

interface Indicator {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  target: number;
  target_direction: "lower_better" | "higher_better" | "range";
  target_min?: number;
  target_max?: number;
  current_value: number;
  previous_value?: number;
  trend: "up" | "down" | "stable";
  status: "green" | "yellow" | "red";
  ns_reference: string;
}

async function computeIndicators(): Promise<Indicator[]> {
  const indicators: Indicator[] = [];

  // ── 1. Dosis promedio POE (mSv/año anualizado) ──────────────────────────
  const avgDose = await safeQuery(async () => {
    const year = new Date().getFullYear();
    const { rows } = await sql.unsafe(
      `SELECT COALESCE(ROUND(SUM(effective_dose_msv)::numeric / NULLIF(COUNT(DISTINCT worker_id),0), 2), 0)::float AS avg
       FROM dosimetry_records WHERE EXTRACT(YEAR FROM period_start) = $1`,
      [year]
    );
    return parseFloat(rows[0]?.avg ?? "0");
  }, 0);

  const prevDose = await safeQuery(async () => {
    const year = new Date().getFullYear() - 1;
    const { rows } = await sql.unsafe(
      `SELECT COALESCE(ROUND(SUM(effective_dose_msv)::numeric / NULLIF(COUNT(DISTINCT worker_id),0), 2), 0)::float AS avg
       FROM dosimetry_records WHERE EXTRACT(YEAR FROM period_start) = $1`,
      [year]
    );
    return parseFloat(rows[0]?.avg ?? "0");
  }, 0);

  indicators.push({
    id: "avg_dose_poe",
    category: "Dosimetría",
    name: "Dosis efectiva promedio POE",
    description: "Dosis efectiva promedio anual de los trabajadores ocupacionalmente expuestos",
    unit: "mSv/año",
    target: 5,
    target_direction: "lower_better",
    current_value: avgDose,
    previous_value: prevDose,
    trend: avgDose <= prevDose ? "down" : "up",
    status: avgDose <= 5 ? "green" : avgDose <= 15 ? "yellow" : "red",
    ns_reference: "DS 3/1985 Art. 8 — Límite 20 mSv/año",
  });

  // ── 2. POE con dosis > 15 mSv ───────────────────────────────────────────
  const over15 = await safeQuery(async () => {
    const year = new Date().getFullYear();
    const { rows } = await sql.unsafe(
      `SELECT COUNT(DISTINCT worker_id)::int AS n FROM dosimetry_records
       WHERE EXTRACT(YEAR FROM period_start) = $1
         AND effective_dose_msv > 15`,
      [year]
    );
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  indicators.push({
    id: "poe_over_15msv",
    category: "Dosimetría",
    name: "POE con dosis > 15 mSv",
    description: "Trabajadores que superan el nivel de acción DS 3/1985",
    unit: "personas",
    target: 0,
    target_direction: "lower_better",
    current_value: over15,
    trend: over15 === 0 ? "stable" : "up",
    status: over15 === 0 ? "green" : over15 <= 2 ? "yellow" : "red",
    ns_reference: "DS 3/1985 Art. 8 — Nivel de investigación",
  });

  // ── 3. % POE con dosimetría al día ─────────────────────────────────────
  const dosimetryRate = await safeQuery(async () => {
    const year = new Date().getFullYear();
    const { rows: total } = await sql`SELECT COUNT(*)::int AS n FROM workers WHERE active=true AND poe_category IS NOT NULL`;
    const { rows: conDos } = await sql.unsafe(
      `SELECT COUNT(DISTINCT worker_id)::int AS n FROM dosimetry_records
       WHERE EXTRACT(YEAR FROM period_start) = $1`,
      [year]
    );
    const t = parseInt(total[0]?.n ?? "0", 10);
    const d = parseInt(conDos[0]?.n ?? "0", 10);
    return t > 0 ? Math.round(d / t * 100) : 100;
  }, 100);

  indicators.push({
    id: "dosimetry_coverage",
    category: "Dosimetría",
    name: "Cobertura dosimétrica POE",
    description: "Porcentaje de trabajadores POE con registro dosimétrico en el año",
    unit: "%",
    target: 100,
    target_direction: "higher_better",
    current_value: dosimetryRate,
    trend: dosimetryRate >= 100 ? "stable" : "down",
    status: dosimetryRate >= 100 ? "green" : dosimetryRate >= 90 ? "yellow" : "red",
    ns_reference: "NS-06.0 §4.3 — Dosimetría personal obligatoria",
  });

  // ── 4. Instrumentos con calibración vigente ─────────────────────────────
  const calibRate = await safeQuery(async () => {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE calibration_due_date >= CURRENT_DATE OR calibration_due_date IS NULL)::int AS ok,
        COUNT(*)::int AS total
      FROM instruments WHERE active=true`;
    const ok = rows[0]?.ok ?? 0;
    const total = rows[0]?.total ?? 1;
    return total > 0 ? Math.round(ok / total * 100) : 100;
  }, 100);

  indicators.push({
    id: "instrument_calibration",
    category: "Instrumentación",
    name: "Instrumentos con calibración vigente",
    description: "Porcentaje de instrumentos de medición con calibración al día",
    unit: "%",
    target: 100,
    target_direction: "higher_better",
    current_value: calibRate,
    trend: calibRate >= 100 ? "stable" : "down",
    status: calibRate >= 100 ? "green" : calibRate >= 90 ? "yellow" : "red",
    ns_reference: "NS-06.0 §5.2 — Instrumentación calibrada",
  });

  // ── 5. % POE capacitado en PR año actual ───────────────────────────────
  const trainingRate = await safeQuery(async () => {
    const year = new Date().getFullYear();
    const { rows: poe } = await sql`SELECT COUNT(*)::int AS n FROM workers WHERE active=true AND poe_category IS NOT NULL`;
    const { rows: trained } = await sql.unsafe(
      `SELECT COUNT(DISTINCT worker_id)::int AS n FROM training_records
       WHERE EXTRACT(YEAR FROM start_date) = $1`,
      [year]
    );
    const p = parseInt(poe[0]?.n ?? "0", 10);
    const t = parseInt(trained[0]?.n ?? "0", 10);
    return p > 0 ? Math.round(t / p * 100) : 100;
  }, 0);

  indicators.push({
    id: "training_coverage",
    category: "Capacitación",
    name: "Cobertura capacitación PR",
    description: "Porcentaje del personal POE con capacitación en protección radiológica en el año",
    unit: "%",
    target: 80,
    target_direction: "higher_better",
    current_value: trainingRate,
    trend: trainingRate >= 80 ? "stable" : "down",
    status: trainingRate >= 80 ? "green" : trainingRate >= 60 ? "yellow" : "red",
    ns_reference: "NS-06.0 §6.1 — Capacitación anual POE",
  });

  // ── 6. Sesiones Comité PR (mínimo 4/año) ───────────────────────────────
  const committeeSessions = await safeQuery(async () => {
    const year = new Date().getFullYear();
    const { rows } = await sql.unsafe(
      `SELECT COUNT(*)::int AS n FROM committee_meetings WHERE EXTRACT(YEAR FROM meeting_date) = $1`,
      [year]
    );
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  indicators.push({
    id: "committee_sessions",
    category: "Comité PR",
    name: "Sesiones Comité PR realizadas",
    description: "Número de sesiones del Comité de Protección Radiológica en el año",
    unit: "sesiones",
    target: 4,
    target_direction: "higher_better",
    current_value: committeeSessions,
    trend: committeeSessions >= 4 ? "stable" : "down",
    status: committeeSessions >= 4 ? "green" : committeeSessions >= 2 ? "yellow" : "red",
    ns_reference: "NS-06.0 §7.1 — Mínimo 4 sesiones anuales",
  });

  // ── 7. No conformidades CAPA abiertas ─────────────────────────────────
  const openCapa = await safeQuery(async () => {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM capa_records WHERE status IN ('open','in_progress')`;
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  const overdueCapa = await safeQuery(async () => {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM capa_records
      WHERE due_date < CURRENT_DATE AND status NOT IN ('closed','cancelled')`;
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  indicators.push({
    id: "open_capa",
    category: "Calidad",
    name: "CAPA abiertas",
    description: "No conformidades y acciones correctivas pendientes de cierre",
    unit: "registros",
    target: 0,
    target_direction: "lower_better",
    current_value: openCapa,
    trend: openCapa === 0 ? "stable" : overdueCapa > 0 ? "up" : "stable",
    status: openCapa === 0 ? "green" : overdueCapa > 0 ? "red" : "yellow",
    ns_reference: "NS-06.0 §8.3 — Seguimiento CAPA",
  });

  // ── 8. Documentos con revisión vencida ─────────────────────────────────
  const docsOverdue = await safeQuery(async () => {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM pr_documents
      WHERE next_review_date < CURRENT_DATE AND status NOT IN ('obsolete','draft')`;
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  indicators.push({
    id: "docs_overdue",
    category: "Documentación",
    name: "Documentos con revisión vencida",
    description: "Documentos PR cuya fecha de revisión periódica está vencida",
    unit: "documentos",
    target: 0,
    target_direction: "lower_better",
    current_value: docsOverdue,
    trend: docsOverdue === 0 ? "stable" : "up",
    status: docsOverdue === 0 ? "green" : docsOverdue <= 3 ? "yellow" : "red",
    ns_reference: "NS-06.0 §4.1 — Documentación vigente",
  });

  // ── 9. Incidentes radiológicos (año actual) ─────────────────────────────
  const incidents = await safeQuery(async () => {
    const year = new Date().getFullYear();
    const { rows } = await sql.unsafe(
      `SELECT COUNT(*)::int AS n FROM incidents WHERE EXTRACT(YEAR FROM incident_date) = $1`,
      [year]
    );
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  const prevIncidents = await safeQuery(async () => {
    const year = new Date().getFullYear() - 1;
    const { rows } = await sql.unsafe(
      `SELECT COUNT(*)::int AS n FROM incidents WHERE EXTRACT(YEAR FROM incident_date) = $1`,
      [year]
    );
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  indicators.push({
    id: "incidents_count",
    category: "Seguridad",
    name: "Incidentes radiológicos (año)",
    description: "Número total de incidentes radiológicos notificados en el año",
    unit: "incidentes",
    target: 0,
    target_direction: "lower_better",
    current_value: incidents,
    previous_value: prevIncidents,
    trend: incidents < prevIncidents ? "down" : incidents > prevIncidents ? "up" : "stable",
    status: incidents === 0 ? "green" : incidents <= 2 ? "yellow" : "red",
    ns_reference: "NS-06.0 §9.1 — Notificación de incidentes",
  });

  // ── 10. Autorizaciones CCHEN vencidas ──────────────────────────────────
  const licenseExpired = await safeQuery(async () => {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM licenses WHERE expiry_date < CURRENT_DATE AND active=true`;
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  indicators.push({
    id: "license_expired",
    category: "Normativa",
    name: "Autorizaciones CCHEN vencidas",
    description: "Autorizaciones o licencias CCHEN con fecha de vencimiento superada",
    unit: "autorizaciones",
    target: 0,
    target_direction: "lower_better",
    current_value: licenseExpired,
    trend: licenseExpired === 0 ? "stable" : "up",
    status: licenseExpired === 0 ? "green" : "red",
    ns_reference: "DS 3/1985 — Autorización CCHEN obligatoria",
  });

  // ── 11. Proveedores con auth CCHEN vencida ─────────────────────────────
  const vendorsExpired = await safeQuery(async () => {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM vendors
      WHERE cchen_authorized=true AND cchen_expiry_date < CURRENT_DATE AND active=true`;
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  indicators.push({
    id: "vendors_cchen_expired",
    category: "Proveedores",
    name: "Proveedores CCHEN vencidos",
    description: "Proveedores con autorización CCHEN vencida que prestan servicios",
    unit: "proveedores",
    target: 0,
    target_direction: "lower_better",
    current_value: vendorsExpired,
    trend: vendorsExpired === 0 ? "stable" : "up",
    status: vendorsExpired === 0 ? "green" : "red",
    ns_reference: "NS-06.0 §5.3 — Proveedores autorizados",
  });

  // ── 12. Monitoreos de área realizados (mes actual) ─────────────────────
  const areaMonitorings = await safeQuery(async () => {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n FROM env_monitoring_records
      WHERE EXTRACT(YEAR FROM measurement_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM measurement_date) = EXTRACT(MONTH FROM CURRENT_DATE)`;
    return parseInt(rows[0]?.n ?? "0", 10);
  }, 0);

  indicators.push({
    id: "area_monitoring_monthly",
    category: "Monitoreo",
    name: "Monitoreos de área (mes actual)",
    description: "Número de monitoreos de radiación de área realizados en el mes en curso",
    unit: "mediciones",
    target: 10,
    target_direction: "higher_better",
    current_value: areaMonitorings,
    trend: areaMonitorings >= 10 ? "stable" : "down",
    status: areaMonitorings >= 10 ? "green" : areaMonitorings >= 5 ? "yellow" : "red",
    ns_reference: "NS-06.0 §4.4 — Monitoreo periódico de área",
  });

  return indicators;
}

export async function GET() {
  try {
    const indicators = await computeIndicators();

    // Categorize
    const categories = [...new Set(indicators.map(i => i.category))];
    const green = indicators.filter(i => i.status === "green").length;
    const yellow = indicators.filter(i => i.status === "yellow").length;
    const red = indicators.filter(i => i.status === "red").length;
    const score = Math.round(
      (green * 100 + yellow * 60) / (indicators.length * 100) * 100
    );

    return NextResponse.json({
      indicators,
      categories,
      summary: { total: indicators.length, green, yellow, red, score },
      computed_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
