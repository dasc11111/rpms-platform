import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// §64 — Exámenes Médicos Ocupacionales POE
// DS 594/1999 Arts. 68–71 — control médico a trabajadores ocupacionalmente expuestos
// CCHEN NS-06.0 — vigilancia médica como parte del programa PR
// Tipos: pre-ocupacional, periódico_anual, periódico_semestral, egreso, especial

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS medical_exams (
      id              SERIAL PRIMARY KEY,
      worker_id       INT,
      worker_name     TEXT NOT NULL,
      worker_rut      TEXT,
      worker_category TEXT DEFAULT 'A',
      service         TEXT,
      exam_type       TEXT NOT NULL DEFAULT 'periodico_anual',
      exam_date       DATE NOT NULL,
      next_exam_date  DATE,
      result          TEXT DEFAULT 'apto',
      result_details  TEXT,
      examiner        TEXT,
      institution     TEXT,
      observations    TEXT,
      status          TEXT NOT NULL DEFAULT 'scheduled',
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM medical_exams`;
  if (parseInt(count[0]?.count ?? "0") === 0) {
    const today = new Date();
    const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r.toISOString().split("T")[0]; };
    const subDays = (d: Date, n: number) => addDays(d, -n);

    await sql`
      INSERT INTO medical_exams (worker_name, worker_rut, worker_category, service, exam_type, exam_date, next_exam_date, result, examiner, institution, status)
      VALUES
        ('Ana García López',    '12.345.678-9', 'A', 'Medicina Nuclear',    'periodico_anual',      ${subDays(today,45)},  ${addDays(today,320)}, 'apto',           'Dr. Carlos Riquelme', 'Mutual de Seguridad CChC', 'completed'),
        ('Pedro Morales Vega',  '14.567.890-1', 'A', 'Medicina Nuclear',    'periodico_anual',      ${subDays(today,15)},  ${addDays(today,350)}, 'apto_con_obs',   'Dr. Carlos Riquelme', 'Mutual de Seguridad CChC', 'completed'),
        ('Carmen Núñez Soto',   '15.678.901-2', 'A', 'Radioterapia',        'periodico_semestral',  ${subDays(today,10)},  ${addDays(today,170)}, 'apto',           'Dr. Elena Fuentes',   'IST',                      'completed'),
        ('Jorge Valdés Ruiz',   '16.789.012-3', 'B', 'Radiodiagnóstico',    'periodico_anual',      ${subDays(today,5)},   ${addDays(today,360)}, 'apto',           'Dr. Carlos Riquelme', 'Mutual de Seguridad CChC', 'completed'),
        ('María Silva Torres',  '17.890.123-4', 'A', 'Medicina Nuclear',    'periodico_semestral',  ${addDays(today,10)},  null,                  null,             null,                  'IST',                      'scheduled'),
        ('Luis Pérez Moreno',   '18.901.234-5', 'A', 'Radioterapia',        'periodico_anual',      ${addDays(today,25)},  null,                  null,             null,                  'Mutual de Seguridad CChC', 'scheduled'),
        ('Rosa Muñoz Díaz',     '19.012.345-6', 'B', 'Radiodiagnóstico',    'periodico_anual',      ${subDays(today,400)}, ${subDays(today,35)},  'apto',           'Dr. Elena Fuentes',   'IST',                      'overdue'),
        ('Carlos Herrera Lara', '20.123.456-7', 'A', 'Protección Radiológica', 'periodico_anual',   ${subDays(today,380)}, ${subDays(today,15)},  'apto',           'Dr. Carlos Riquelme', 'Mutual de Seguridad CChC', 'overdue')
    `;
  }
}

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status") ?? "";
  const service  = searchParams.get("service") ?? "";
  const examType = searchParams.get("exam_type") ?? "";
  const category = searchParams.get("category") ?? "";

  // Auto-update overdue status
  await sql`
    UPDATE medical_exams
    SET status = 'overdue', updated_at = now()
    WHERE status = 'scheduled'
      AND exam_date < now()
      AND active = TRUE
  `;

  const rows = await sql`
    SELECT *,
      CASE
        WHEN status = 'overdue' OR (next_exam_date < now() AND status = 'completed') THEN 'overdue'
        WHEN exam_date BETWEEN now() AND now() + INTERVAL '30 days' AND status = 'scheduled' THEN 'upcoming'
        ELSE status
      END AS computed_status,
      CASE
        WHEN next_exam_date IS NOT NULL THEN
          (next_exam_date::date - CURRENT_DATE)
        ELSE NULL
      END AS days_until_next
    FROM medical_exams
    WHERE active = TRUE
      AND (${status} = '' OR status = ${status})
      AND (${service} = '' OR service ILIKE ${'%' + service + '%'})
      AND (${examType} = '' OR exam_type = ${examType})
      AND (${category} = '' OR worker_category = ${category})
    ORDER BY
      CASE WHEN status='overdue' THEN 0 WHEN status='scheduled' AND exam_date <= now()+INTERVAL '30 days' THEN 1 ELSE 2 END,
      exam_date ASC
  `;

  // Stats
  const stats = await sql`
    SELECT
      COUNT(*)::int                                     AS total,
      COUNT(*) FILTER (WHERE status='completed')::int      AS completed,
      COUNT(*) FILTER (WHERE status='scheduled')::int      AS scheduled,
      COUNT(*) FILTER (WHERE status='overdue'
        OR (next_exam_date < now() AND status='completed'))::int AS overdue,
      COUNT(*) FILTER (WHERE exam_date BETWEEN now() AND now()+INTERVAL '30 days'
        AND status='scheduled')::int AS upcoming_30d,
      COUNT(*) FILTER (WHERE result='apto_con_obs')::int   AS with_observations,
      COUNT(*) FILTER (WHERE result='no_apto')::int        AS not_fit
    FROM medical_exams
    WHERE active = TRUE
  `;

  return NextResponse.json({ rows, stats: stats[0] });
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();
  const { worker_name, worker_rut, worker_category, service, exam_type, exam_date, next_exam_date, result, result_details, examiner, institution, observations, status } = body;

  const inserted = await sql`
    INSERT INTO medical_exams (worker_name, worker_rut, worker_category, service, exam_type, exam_date, next_exam_date, result, result_details, examiner, institution, observations, status)
    VALUES (${worker_name}, ${worker_rut??null}, ${worker_category??'A'}, ${service??null}, ${exam_type??'periodico_anual'}, ${exam_date}, ${next_exam_date??null}, ${result??'pending'}, ${result_details??null}, ${examiner??null}, ${institution??null}, ${observations??null}, ${status??'scheduled'})
    RETURNING *
  `;
  return NextResponse.json(inserted[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["worker_name","worker_rut","worker_category","service","exam_type","exam_date","next_exam_date","result","result_details","examiner","institution","observations","status"];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in fields) { setClauses.push(`${key} = $${idx++}`); values.push(fields[key]); }
  }
  if (!setClauses.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  setClauses.push(`updated_at = now()`);
  values.push(id);

  const updated = await sql.unsafe(
    `UPDATE medical_exams SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return NextResponse.json(updated[0]);
}

export async function DELETE(req: NextRequest) {
  await ensureTable();
  const { id } = await req.json();
  await sql`UPDATE medical_exams SET active = FALSE WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
