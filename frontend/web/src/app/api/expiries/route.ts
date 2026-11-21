import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ExpiryItem {
  id: string;
  module: string;
  category: string;
  title: string;
  detail: string;
  expiry_date: string;
  days_remaining: number;
  urgency: "overdue" | "critical" | "warning" | "upcoming";
  action_url: string;
  regulation?: string;
}

export async function GET() {
  const items: ExpiryItem[] = [];

  // Helper
  const addItems = (
    rows: { title: string; detail: string; expiry_date: string; days_remaining: number }[],
    module: string,
    category: string,
    action_url: string,
    regulation?: string
  ) => {
    for (const r of rows) {
      const days = Number(r.days_remaining);
      items.push({
        id: `${module}-${r.title}-${r.expiry_date}`,
        module,
        category,
        title: r.title,
        detail: r.detail,
        expiry_date: r.expiry_date,
        days_remaining: days,
        urgency:
          days < 0 ? "overdue" : days <= 7 ? "critical" : days <= 30 ? "warning" : "upcoming",
        action_url,
        regulation,
      });
    }
  };

  // 1. Autorizaciones de desempeño de trabajadores
  try {
    const { rows } = await sql`
      SELECT
        name AS title,
        COALESCE('Nº ' || authorization_number, 'Sin número') || ' · ' || COALESCE(service, 'Sin servicio') AS detail,
        authorization_expiry_date::text AS expiry_date,
        (authorization_expiry_date - CURRENT_DATE)::int AS days_remaining
      FROM workers
      WHERE status <> 'inactive'
        AND authorization_expiry_date IS NOT NULL
        AND authorization_expiry_date <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY authorization_expiry_date ASC
      LIMIT 20
    `;
    addItems(rows as any[], "Trabajadores", "Autorización desempeño", "/workers", "DS 3/1985 Art. 3 — CCHEN");
  } catch { /* table missing */ }

  // 2. Calibraciones de instrumentos
  try {
    const { rows } = await sql`
      SELECT
        name AS title,
        COALESCE(brand || ' ' || model, instrument_code, 'Código no registrado') AS detail,
        next_calibration_date::text AS expiry_date,
        (next_calibration_date - CURRENT_DATE)::int AS days_remaining
      FROM instruments
      WHERE next_calibration_date IS NOT NULL
        AND next_calibration_date <= CURRENT_DATE + INTERVAL '90 days'
        AND status <> 'decommissioned'
      ORDER BY next_calibration_date ASC
      LIMIT 20
    `;
    addItems(rows as any[], "Instrumentos", "Calibración", "/instruments/calibrations", "NS-06.0 §9");
  } catch { /* table missing */ }

  // 3. Mantenimientos de instrumentos
  try {
    const { rows } = await sql`
      SELECT
        name AS title,
        COALESCE(brand || ' ' || model, instrument_code, '') AS detail,
        next_maintenance_date::text AS expiry_date,
        (next_maintenance_date - CURRENT_DATE)::int AS days_remaining
      FROM instruments
      WHERE next_maintenance_date IS NOT NULL
        AND next_maintenance_date <= CURRENT_DATE + INTERVAL '90 days'
        AND status <> 'decommissioned'
      ORDER BY next_maintenance_date ASC
      LIMIT 15
    `;
    addItems(rows as any[], "Instrumentos", "Mantenimiento", "/instruments/maintenances", "NS-06.0 §9");
  } catch { /* table missing */ }

  // 4. Inventarios de fuentes radiactivas
  try {
    const { rows } = await sql`
      SELECT
        source_code || ' (' || isotope || ')' AS title,
        'Actividad: ' || ROUND(current_activity::numeric, 3) || ' ' || activity_unit AS detail,
        next_inventory_date::text AS expiry_date,
        (next_inventory_date - CURRENT_DATE)::int AS days_remaining
      FROM radioactive_sources
      WHERE status = 'in_use'
        AND next_inventory_date IS NOT NULL
        AND next_inventory_date <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY next_inventory_date ASC
      LIMIT 15
    `;
    addItems(rows as any[], "Fuentes", "Inventario", "/sources", "NS-06.0 §6 — IAEA");
  } catch { /* table missing */ }

  // 5. Simulacros de emergencia
  try {
    const { rows } = await sql`
      SELECT
        'Simulacro: ' || plan_name AS title,
        drill_type || ' · ' || COALESCE(responsible, '') AS detail,
        next_drill_date::text AS expiry_date,
        (next_drill_date - CURRENT_DATE)::int AS days_remaining
      FROM emergency_plans
      WHERE status = 'active'
        AND next_drill_date IS NOT NULL
        AND next_drill_date <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY next_drill_date ASC
      LIMIT 10
    `;
    addItems(rows as any[], "Emergencia", "Simulacro", "/emergency", "DS 3/1985 Art. 25 · NS-06.0");
  } catch { /* table missing */ }

  // 6. Requisitos de cumplimiento
  try {
    const { rows } = await sql`
      SELECT
        requirement AS title,
        regulation || ' · ' || COALESCE(owner, '') AS detail,
        next_review_date::text AS expiry_date,
        (next_review_date - CURRENT_DATE)::int AS days_remaining
      FROM compliance_requirements
      WHERE status NOT IN ('compliant', 'exempt')
        AND next_review_date IS NOT NULL
        AND next_review_date <= CURRENT_DATE + INTERVAL '90 days'
        AND priority IN ('critica', 'alta', 'critical', 'high')
      ORDER BY next_review_date ASC
      LIMIT 15
    `;
    addItems(rows as any[], "Cumplimiento", "Revisión requerida", "/compliance", "NS-06.0 CCHEN");
  } catch { /* table missing */ }

  // 7. Monitoreos de zona clasificada
  try {
    const { rows } = await sql`
      SELECT
        name AS title,
        zone_type || ' · ' || COALESCE(location, '') AS detail,
        next_survey_date::text AS expiry_date,
        (next_survey_date - CURRENT_DATE)::int AS days_remaining
      FROM classified_zones
      WHERE status = 'active'
        AND next_survey_date IS NOT NULL
        AND next_survey_date <= CURRENT_DATE + INTERVAL '60 days'
      ORDER BY next_survey_date ASC
      LIMIT 10
    `;
    addItems(rows as any[], "Zonas Clasificadas", "Monitoreo", "/classified-zones", "DS 3/1985 Art. 15");
  } catch { /* table missing */ }

  // 8. Capacitaciones de trabajadores
  try {
    const { rows } = await sql`
      SELECT
        worker_name || ' — ' || course_name AS title,
        COALESCE(course_type, '') || ' · ' || COALESCE(service, '') AS detail,
        expiry_date::text,
        (expiry_date - CURRENT_DATE)::int AS days_remaining
      FROM worker_trainings
      WHERE expiry_date IS NOT NULL
        AND expiry_date <= CURRENT_DATE + INTERVAL '60 days'
      ORDER BY expiry_date ASC
      LIMIT 15
    `;
    addItems(rows as any[], "Capacitación", "Certificación", "/training", "NS-04 CCHEN Art. 15");
  } catch { /* table missing */ }

  // Sort: overdue first, then by days_remaining ascending
  const urgencyOrder = { overdue: 0, critical: 1, warning: 2, upcoming: 3 };
  items.sort((a, b) => {
    const o = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (o !== 0) return o;
    return a.days_remaining - b.days_remaining;
  });

  const stats = {
    overdue: items.filter((i) => i.urgency === "overdue").length,
    critical: items.filter((i) => i.urgency === "critical").length,
    warning: items.filter((i) => i.urgency === "warning").length,
    upcoming: items.filter((i) => i.urgency === "upcoming").length,
    total: items.length,
  };

  return NextResponse.json({
    stats,
    items,
    generated_at: new Date().toISOString(),
  });
}
