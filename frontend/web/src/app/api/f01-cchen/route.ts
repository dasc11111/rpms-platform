// §154 — Generador Formulario F-01 CCHEN
// Informe Anual de Protección Radiológica — Formulario Oficial CCHEN
// DS 3/1985 Arts. 50-52 · CCHEN NS-05.0 §10 · Circular CCHEN N°13
// Obligatorio para toda instalación con fuentes de radiación ionizante

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

// ─── Ensure tables ───────────────────────────────────────────────────────────

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS f01_reports (
      id               SERIAL PRIMARY KEY,
      report_year      INTEGER NOT NULL,
      status           VARCHAR(30) NOT NULL DEFAULT 'draft',
      -- Sección A: Identificación del titular
      titular_name     TEXT,
      titular_rut      VARCHAR(20),
      titular_address  TEXT,
      titular_phone    VARCHAR(30),
      titular_email    TEXT,
      encargado_name   TEXT,
      encargado_rut    VARCHAR(20),
      encargado_phone  VARCHAR(30),
      encargado_email  TEXT,
      instalacion_name TEXT,
      instalacion_type VARCHAR(60),
      instalacion_address TEXT,
      cchen_license_number VARCHAR(40),
      -- Sección B: Personal ocupacionalmente expuesto
      poe_total_count  INTEGER,
      poe_category_a   INTEGER,
      poe_category_b   INTEGER,
      poe_pregnant     INTEGER,
      poe_students     INTEGER,
      -- Sección C: Dosis colectiva e individual
      collective_dose_msv NUMERIC(10,3),
      max_individual_dose_msv NUMERIC(8,3),
      workers_above_limit INTEGER DEFAULT 0,
      workers_above_1msv  INTEGER DEFAULT 0,
      -- Sección D: Fuentes radiactivas
      sources_count    INTEGER,
      sources_description TEXT,
      -- Sección E: Equipos generadores de radiación
      generators_count INTEGER,
      generators_description TEXT,
      -- Sección F: Incidentes / accidentes
      incidents_count  INTEGER DEFAULT 0,
      incidents_description TEXT,
      -- Sección G: Residuos radiactivos
      waste_volume_L   NUMERIC(10,2),
      waste_activity_GBq NUMERIC(10,3),
      waste_disposal_method TEXT,
      -- Sección H: Monitoreo de área
      area_monitoring_points INTEGER,
      max_area_dose_rate_usvh NUMERIC(10,2),
      -- Metadatos
      submitted_date   DATE,
      cchen_reception_code VARCHAR(40),
      observations     TEXT,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(report_year)
    )
  `;

  // Check if demo data exists
  const { rowCount } = await sql`SELECT 1 FROM f01_reports LIMIT 1`;
  if (!rowCount) {
    const year = new Date().getFullYear() - 1; // Previous year (last submitted)
    await sql`
      INSERT INTO f01_reports (
        report_year, status,
        titular_name, titular_rut, titular_address, titular_phone, titular_email,
        encargado_name, encargado_rut, encargado_phone, encargado_email,
        instalacion_name, instalacion_type, instalacion_address, cchen_license_number,
        poe_total_count, poe_category_a, poe_category_b, poe_pregnant, poe_students,
        collective_dose_msv, max_individual_dose_msv, workers_above_limit, workers_above_1msv,
        sources_count, sources_description,
        generators_count, generators_description,
        incidents_count, incidents_description,
        waste_volume_L, waste_activity_GBq, waste_disposal_method,
        area_monitoring_points, max_area_dose_rate_usvh,
        submitted_date, cchen_reception_code
      ) VALUES (
        ${year}, 'submitted',
        'Hospital Dr. Hernán Henríquez Aravena', '61.606.001-5',
        'Manuel Montt 115, Temuco, Región de La Araucanía', '+56 45 2965800', 'contacto@hhha.cl',
        'TM. Diego Solís Catalán', '16.397.583-1', '+56 45 2965801', 'dosolis@hhha.cl',
        'Unidad de Medicina Nuclear y Radioterapia', 'Hospital Categoría A',
        'Manuel Montt 115, Temuco', 'CCHEN-2024-MN-0042',
        28, 20, 8, 1, 2,
        85.42, 12.3, 0, 4,
        6, 'Mo-99/Tc-99m (generador), I-131 (terapia), Ga-67, Tl-201, Lu-177, F-18 (PET)',
        3, 'Acelerador lineal VARIAN TrueBeam, PET-CT GE Discovery MI, TC Siemens SOMATOM',
        0, NULL,
        48.5, 125.0, 'Almacenamiento controlado hasta decaimiento; retiro CCHEN para Cs-137 antiguo',
        12, 2.3,
        ${year + '-03-15'}, 'CCHEN-${year}-R-00847'
      )
    `;

    // Current year draft
    const curYear = new Date().getFullYear();
    await sql`
      INSERT INTO f01_reports (
        report_year, status,
        titular_name, titular_rut, titular_address, titular_phone, titular_email,
        encargado_name, encargado_rut, encargado_phone, encargado_email,
        instalacion_name, instalacion_type, instalacion_address, cchen_license_number,
        poe_total_count, poe_category_a, poe_category_b, poe_pregnant, poe_students,
        collective_dose_msv, max_individual_dose_msv, workers_above_limit, workers_above_1msv,
        sources_count, generators_count,
        incidents_count, area_monitoring_points
      ) VALUES (
        ${curYear}, 'draft',
        'Hospital Dr. Hernán Henríquez Aravena', '61.606.001-5',
        'Manuel Montt 115, Temuco, Región de La Araucanía', '+56 45 2965800', 'contacto@hhha.cl',
        'TM. Diego Solís Catalán', '16.397.583-1', '+56 45 2965801', 'dosolis@hhha.cl',
        'Unidad de Medicina Nuclear y Radioterapia', 'Hospital Categoría A',
        'Manuel Montt 115, Temuco', 'CCHEN-2024-MN-0042',
        30, 22, 8, 1, 2,
        42.8, 9.7, 0, 2,
        6, 3,
        0, 12
      )
    `;
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");

  if (year) {
    const { rows } = await sql`
      SELECT * FROM f01_reports WHERE report_year = ${Number(year)}
    `;
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ report: rows[0] });
  }

  const { rows } = await sql`
    SELECT id, report_year, status, titular_name, instalacion_name,
           cchen_license_number, submitted_date, cchen_reception_code,
           poe_total_count, collective_dose_msv, max_individual_dose_msv,
           incidents_count, workers_above_limit, created_at, updated_at
    FROM f01_reports
    ORDER BY report_year DESC
  `;

  // Determine current deadline status
  const currentYear = new Date().getFullYear();
  const deadline = new Date(`${currentYear}-03-31`);
  const today = new Date();
  const daysToDeadline = Math.floor((deadline.getTime() - today.getTime()) / 86400000);
  const draftReport = rows.find(r => r.report_year === currentYear && r.status === 'draft');

  return NextResponse.json({
    reports: rows,
    deadline: {
      year: currentYear,
      date: `${currentYear}-03-31`,
      days_remaining: daysToDeadline,
      status: daysToDeadline < 0 ? 'overdue' : daysToDeadline < 30 ? 'urgent' : 'on_track',
      has_draft: !!draftReport,
    },
  });
}

// ─── POST: Create or upsert a report ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();
  const year = body.report_year ?? new Date().getFullYear();

  // Upsert
  const { rows } = await sql`
    INSERT INTO f01_reports (
      report_year, status,
      titular_name, titular_rut, titular_address, titular_phone, titular_email,
      encargado_name, encargado_rut, encargado_phone, encargado_email,
      instalacion_name, instalacion_type, instalacion_address, cchen_license_number,
      poe_total_count, poe_category_a, poe_category_b, poe_pregnant, poe_students,
      collective_dose_msv, max_individual_dose_msv, workers_above_limit, workers_above_1msv,
      sources_count, sources_description,
      generators_count, generators_description,
      incidents_count, incidents_description,
      waste_volume_L, waste_activity_GBq, waste_disposal_method,
      area_monitoring_points, max_area_dose_rate_usvh,
      observations
    ) VALUES (
      ${year}, ${'draft'},
      ${body.titular_name ?? null}, ${body.titular_rut ?? null},
      ${body.titular_address ?? null}, ${body.titular_phone ?? null}, ${body.titular_email ?? null},
      ${body.encargado_name ?? null}, ${body.encargado_rut ?? null},
      ${body.encargado_phone ?? null}, ${body.encargado_email ?? null},
      ${body.instalacion_name ?? null}, ${body.instalacion_type ?? null},
      ${body.instalacion_address ?? null}, ${body.cchen_license_number ?? null},
      ${body.poe_total_count ?? null}, ${body.poe_category_a ?? null},
      ${body.poe_category_b ?? null}, ${body.poe_pregnant ?? null}, ${body.poe_students ?? null},
      ${body.collective_dose_msv ?? null}, ${body.max_individual_dose_msv ?? null},
      ${body.workers_above_limit ?? 0}, ${body.workers_above_1msv ?? 0},
      ${body.sources_count ?? null}, ${body.sources_description ?? null},
      ${body.generators_count ?? null}, ${body.generators_description ?? null},
      ${body.incidents_count ?? 0}, ${body.incidents_description ?? null},
      ${body.waste_volume_L ?? null}, ${body.waste_activity_GBq ?? null},
      ${body.waste_disposal_method ?? null},
      ${body.area_monitoring_points ?? null}, ${body.max_area_dose_rate_usvh ?? null},
      ${body.observations ?? null}
    )
    ON CONFLICT (report_year) DO UPDATE SET
      titular_name = EXCLUDED.titular_name,
      titular_rut = EXCLUDED.titular_rut,
      titular_address = EXCLUDED.titular_address,
      titular_phone = EXCLUDED.titular_phone,
      titular_email = EXCLUDED.titular_email,
      encargado_name = EXCLUDED.encargado_name,
      encargado_rut = EXCLUDED.encargado_rut,
      encargado_phone = EXCLUDED.encargado_phone,
      encargado_email = EXCLUDED.encargado_email,
      instalacion_name = EXCLUDED.instalacion_name,
      instalacion_type = EXCLUDED.instalacion_type,
      instalacion_address = EXCLUDED.instalacion_address,
      cchen_license_number = EXCLUDED.cchen_license_number,
      poe_total_count = EXCLUDED.poe_total_count,
      poe_category_a = EXCLUDED.poe_category_a,
      poe_category_b = EXCLUDED.poe_category_b,
      poe_pregnant = EXCLUDED.poe_pregnant,
      poe_students = EXCLUDED.poe_students,
      collective_dose_msv = EXCLUDED.collective_dose_msv,
      max_individual_dose_msv = EXCLUDED.max_individual_dose_msv,
      workers_above_limit = EXCLUDED.workers_above_limit,
      workers_above_1msv = EXCLUDED.workers_above_1msv,
      sources_count = EXCLUDED.sources_count,
      sources_description = EXCLUDED.sources_description,
      generators_count = EXCLUDED.generators_count,
      generators_description = EXCLUDED.generators_description,
      incidents_count = EXCLUDED.incidents_count,
      incidents_description = EXCLUDED.incidents_description,
      waste_volume_L = EXCLUDED.waste_volume_L,
      waste_activity_GBq = EXCLUDED.waste_activity_GBq,
      waste_disposal_method = EXCLUDED.waste_disposal_method,
      area_monitoring_points = EXCLUDED.area_monitoring_points,
      max_area_dose_rate_usvh = EXCLUDED.max_area_dose_rate_usvh,
      observations = EXCLUDED.observations,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return NextResponse.json({ report: rows[0] }, { status: 201 });
}

// ─── PATCH: Update status / submission ───────────────────────────────────────

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();

  // Build dynamic SET clause
  const updates: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  if (body.status !== undefined) updates.push(`status = '${body.status}'`);
  if (body.submitted_date !== undefined) updates.push(`submitted_date = '${body.submitted_date}'`);
  if (body.cchen_reception_code !== undefined) updates.push(`cchen_reception_code = '${body.cchen_reception_code}'`);
  if (body.observations !== undefined) updates.push(`observations = '${body.observations?.replace(/'/g, "''")}'`);

  if (updates.length === 1) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await sql.query(
    `UPDATE f01_reports SET ${updates.join(", ")} WHERE id = $1`,
    [Number(id)]
  );

  const { rows } = await sql`SELECT * FROM f01_reports WHERE id = ${Number(id)}`;
  return NextResponse.json({ report: rows[0] });
}
