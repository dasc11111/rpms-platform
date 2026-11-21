import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const report: Record<string, unknown> = { year, generated_at: new Date().toISOString() };

  // 1. DATOS DE LA INSTITUCIÓN (settings)
  try {
    const { rows } = await sql`SELECT * FROM institution_settings LIMIT 1`;
    report.institution = rows[0] ?? null;
  } catch { report.institution = null; }

  // 2. PERSONAL OCUPACIONALMENTE EXPUESTO (POE)
  try {
    const { rows: workers } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS total_active,
        COUNT(*) FILTER (WHERE status = 'active' AND authorization_number IS NOT NULL) AS authorized,
        COUNT(*) FILTER (
          WHERE status = 'active'
          AND authorization_expiry_date IS NOT NULL
          AND authorization_expiry_date < CURRENT_DATE
        ) AS expired_auth,
        COUNT(*) FILTER (WHERE status = 'inactive') AS total_inactive
      FROM workers
    `;
    report.poe = workers[0];

    // Top dose workers
    const { rows: topDose } = await sql`
      SELECT w.name, w.rut, w.role,
        ROUND(SUM(COALESCE(dr.dose_whole_body_msv, 0))::numeric, 2) AS heff_msv
      FROM workers w
      JOIN dosimetry_records dr ON dr.worker_id = w.id AND dr.year = ${year}
      WHERE w.status <> 'inactive'
      GROUP BY w.name, w.rut, w.role
      HAVING SUM(COALESCE(dr.dose_whole_body_msv, 0)) > 0
      ORDER BY heff_msv DESC
      LIMIT 10
    `;
    report.top_dose_workers = topDose;
  } catch {
    report.poe = null;
    report.top_dose_workers = [];
  }

  // 3. DOSIMETRÍA RESUMEN ANUAL
  try {
    const { rows: doseStats } = await sql`
      SELECT
        COUNT(DISTINCT worker_id) AS workers_monitored,
        ROUND(AVG(dose_whole_body_msv)::numeric, 3) AS avg_heff_msv,
        ROUND(MAX(dose_whole_body_msv)::numeric, 3) AS max_heff_msv,
        COUNT(*) FILTER (WHERE dose_whole_body_msv >= 20) AS exceeded_annual_limit,
        COUNT(*) FILTER (WHERE dose_whole_body_msv >= 15 AND dose_whole_body_msv < 20) AS investigation_level,
        COUNT(*) AS total_records
      FROM dosimetry_records
      WHERE year = ${year}
    `;
    report.dosimetry = doseStats[0];
  } catch { report.dosimetry = null; }

  // 4. FUENTES RADIACTIVAS
  try {
    const { rows: sources } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'in_use') AS in_use,
        COUNT(*) FILTER (WHERE status = 'stored') AS stored,
        COUNT(*) FILTER (WHERE status = 'decommissioned') AS decommissioned,
        COUNT(*) FILTER (WHERE status = 'transferred') AS transferred,
        COUNT(DISTINCT isotope) AS isotopes_count
      FROM radioactive_sources
    `;
    report.sources = sources[0];

    // List of active sources
    const { rows: sourceList } = await sql`
      SELECT source_code, isotope, activity_gbq, activity_date::text,
        manufacturer, serial_number, status, location
      FROM radioactive_sources
      WHERE status IN ('in_use', 'stored')
      ORDER BY isotope, source_code
    `;
    report.source_inventory = sourceList;
  } catch {
    report.sources = null;
    report.source_inventory = [];
  }

  // 5. RESIDUOS RADIACTIVOS
  try {
    const { rows: waste } = await sql`
      SELECT
        COUNT(*) AS total_packages,
        COUNT(*) FILTER (WHERE category = 'exempt') AS exempt,
        COUNT(*) FILTER (WHERE category = 'llw') AS llw_bbna,
        COUNT(*) FILTER (WHERE category = 'ilw') AS ilw_mbna,
        COUNT(*) FILTER (WHERE category = 'hlw') AS hlw_abna,
        COUNT(*) FILTER (WHERE status = 'authorized') AS authorized,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_auth,
        COUNT(*) FILTER (WHERE disposal_date::date BETWEEN
          make_date(${year}, 1, 1) AND make_date(${year}, 12, 31)) AS disposed_this_year
      FROM waste_items
    `;
    report.waste = waste[0];
  } catch { report.waste = null; }

  // 6. INCIDENTES INES
  try {
    const { rows: incidents } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE ines_level = 0) AS ines_0,
        COUNT(*) FILTER (WHERE ines_level = 1) AS ines_1,
        COUNT(*) FILTER (WHERE ines_level >= 2) AS ines_gte2,
        COUNT(*) FILTER (WHERE status = 'closed') AS closed,
        COUNT(*) FILTER (WHERE status <> 'closed') AS open
      FROM incidents
      WHERE incident_date::date BETWEEN
        make_date(${year}, 1, 1) AND make_date(${year}, 12, 31)
    `;
    report.incidents = incidents[0];
  } catch { report.incidents = null; }

  // 7. EQUIPOS Y CALIBRACIONES
  try {
    const { rows: equipStats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'operational') AS operational,
        COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance,
        COUNT(*) FILTER (WHERE status = 'decommissioned') AS decommissioned
      FROM equipment
    `;
    const { rows: instrStats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'calibrated') AS calibrated,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired_cal
      FROM instruments
    `;
    report.equipment = equipStats[0];
    report.instruments = instrStats[0];
  } catch {
    report.equipment = null;
    report.instruments = null;
  }

  // 8. CUMPLIMIENTO NS-06.0
  try {
    const { rows: compStats } = await sql`
      SELECT
        COUNT(*) AS total_requirements,
        COUNT(*) FILTER (WHERE status = 'compliant') AS compliant,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'overdue') AS overdue,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'compliant')::float / NULLIF(COUNT(*), 0) * 100)::numeric,
          1
        ) AS compliance_pct
      FROM compliance_requirements
    `;
    report.compliance = compStats[0];
  } catch { report.compliance = null; }

  // 9. TRANSPORTE
  try {
    const { rows: transportStats } = await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE transport_date::date BETWEEN make_date(${year}, 1, 1) AND make_date(${year}, 12, 31)
        ) AS shipments_this_year,
        COUNT(DISTINCT carrier) AS carriers,
        COUNT(DISTINCT radionuclide) AS radionuclides
      FROM transport_shipments
    `;
    report.transport = transportStats[0];
  } catch { report.transport = null; }

  // 10. CAPACITACIÓN
  try {
    const { rows: trainStats } = await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE training_date::date BETWEEN make_date(${year}, 1, 1) AND make_date(${year}, 12, 31)
        ) AS sessions_this_year,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_renewals
      FROM training_records
    `;
    report.training = trainStats[0];
  } catch { report.training = null; }

  return NextResponse.json(report);
}
