import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

let tablesReady = false;
async function ensurePetctTables() {
  if (tablesReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS petct_examinations (
      id SERIAL PRIMARY KEY,
      patient_id TEXT NOT NULL,
      patient_name TEXT,
      radiopharmaceutical TEXT NOT NULL,
      radionuclide TEXT NOT NULL,
      administered_mbq NUMERIC(10,2) NOT NULL,
      patient_weight_kg NUMERIC(6,2),
      injection_datetime TIMESTAMPTZ NOT NULL,
      uptake_minutes INTEGER NOT NULL DEFAULT 60,
      exam_start TIMESTAMPTZ,
      exam_end TIMESTAMPTZ,
      state TEXT NOT NULL DEFAULT 'programado',
      operator TEXT NOT NULL,
      prescribing_physician TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS petct_qc_daily (
      id SERIAL PRIMARY KEY,
      qc_date DATE NOT NULL UNIQUE,
      phantom_type TEXT NOT NULL DEFAULT 'Ge-68/Ga-68',
      uniformity_pass BOOLEAN NOT NULL DEFAULT TRUE,
      count_rate_mcps NUMERIC(8,3),
      image_quality_pass BOOLEAN NOT NULL DEFAULT TRUE,
      comments TEXT,
      performed_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  tablesReady = true;
}

export async function GET(req: NextRequest) {
  await ensurePetctTables();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const state = searchParams.get("state") ?? "";
  const date = searchParams.get("date") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);
  const type = searchParams.get("type") ?? "exams";

  // Single exam by ID
  if (id) {
    try {
      const rows = await sql.query(`SELECT * FROM petct_examinations WHERE id = $1`, [id]);
      if (rows.rowCount === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      return NextResponse.json({ data: rows.rows[0] });
    } catch (err) {
      console.error("[petct GET id]", err);
      return NextResponse.json({ error: "Error al obtener examen" }, { status: 500 });
    }
  }

  try {
    if (type === "qc") {
      const qcRows = await sql.query(
        `SELECT * FROM petct_qc_daily ORDER BY qc_date DESC LIMIT $1`,
        [limit]
      );
      return NextResponse.json({ data: qcRows.rows, total: qcRows.rowCount ?? 0 });
    }
    let query = `SELECT * FROM petct_examinations WHERE 1=1`;
    const params: (string | number)[] = [];
    let i = 1;
    if (state) { query += ` AND state = $${i++}`; params.push(state); }
    if (date) { query += ` AND DATE(injection_datetime) = $${i++}`; params.push(date); }
    query += ` ORDER BY injection_datetime DESC LIMIT $${i}`;
    params.push(limit);
    const rows = await sql.query(query, params);
    return NextResponse.json({ data: rows.rows, total: rows.rowCount ?? 0 });
  } catch (err) {
    console.error("[petct GET]", err);
    return NextResponse.json({ error: "Error al obtener datos PET/CT" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensurePetctTables();
  try {
    const body = await req.json();
    const { type = "exam" } = body;
    if (type === "qc") {
      const { qc_date, phantom_type, uniformity_pass, count_rate_mcps,
        image_quality_pass, comments, performed_by } = body;
      const res = await sql.query(
        `INSERT INTO petct_qc_daily
        (qc_date, phantom_type, uniformity_pass, count_rate_mcps, image_quality_pass, comments, performed_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (qc_date) DO UPDATE SET
        phantom_type=EXCLUDED.phantom_type,
        uniformity_pass=EXCLUDED.uniformity_pass,
        count_rate_mcps=EXCLUDED.count_rate_mcps,
        image_quality_pass=EXCLUDED.image_quality_pass,
        comments=EXCLUDED.comments,
        performed_by=EXCLUDED.performed_by
        RETURNING *`,
        [qc_date, phantom_type ?? "Ge-68/Ga-68", uniformity_pass, count_rate_mcps ?? null,
         image_quality_pass, comments ?? null, performed_by]
      );
      return NextResponse.json({ data: res.rows[0] }, { status: 201 });
    }
    const {
      patient_id, patient_name, radiopharmaceutical, radionuclide,
      administered_mbq, patient_weight_kg, injection_datetime,
      uptake_minutes, operator, prescribing_physician, notes,
    } = body;
    const res = await sql.query(
      `INSERT INTO petct_examinations
      (patient_id, patient_name, radiopharmaceutical, radionuclide,
       administered_mbq, patient_weight_kg, injection_datetime,
       uptake_minutes, operator, prescribing_physician, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [patient_id, patient_name ?? null, radiopharmaceutical, radionuclide,
       administered_mbq, patient_weight_kg ?? null, injection_datetime,
       uptake_minutes ?? 60, operator, prescribing_physician, notes ?? null]
    );
    return NextResponse.json({ data: res.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[petct POST]", err);
    return NextResponse.json({ error: "Error al crear registro PET/CT" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await ensurePetctTables();
  try {
    const { id, state, exam_start, exam_end, notes } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const updates: string[] = ["updated_at = NOW()"];
    const params: (string | null)[] = [];
    let i = 1;
    if (state) { updates.push(`state = $${i++}`); params.push(state); }
    if (exam_start) { updates.push(`exam_start = $${i++}`); params.push(exam_start); }
    if (exam_end) { updates.push(`exam_end = $${i++}`); params.push(exam_end); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); params.push(notes); }
    params.push(id);
    const res = await sql.query(
      `UPDATE petct_examinations SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    if (res.rowCount === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error("[petct PATCH]", err);
    return NextResponse.json({ error: "Error al actualizar registro PET/CT" }, { status: 500 });
  }
}
