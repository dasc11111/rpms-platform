import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS radiation_program_sections (
    id              SERIAL PRIMARY KEY,
    section_code    TEXT NOT NULL UNIQUE,
    section_number  TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    content         TEXT,
    responsible     TEXT,
    reviewer        TEXT,
    version         TEXT DEFAULT '1.0',
    status          TEXT DEFAULT 'draft',
    approval_date   DATE,
    next_review_date DATE,
    cchen_approved  BOOLEAN DEFAULT FALSE,
    cchen_ref       TEXT,
    observations    TEXT,
    document_path   TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`;

  const { rows } = await sql`SELECT COUNT(*) FROM radiation_program_sections WHERE active=TRUE`;
  if (Number(rows[0].count) === 0) {
    await sql`INSERT INTO radiation_program_sections
      (section_code,section_number,title,description,responsible,version,status,approval_date,next_review_date,cchen_approved,cchen_ref) VALUES
      ('PPR-01','1','Política de Protección Radiológica','Declaración de la política institucional de PR, compromisos y principios ALARA','Encargado PR','2.1','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P01'),
      ('PPR-02','2','Organización y Responsabilidades','Estructura organizacional del programa PR, roles, responsabilidades y autoridades','Encargado PR','2.0','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P02'),
      ('PPR-03','3','Identificación de Fuentes y Prácticas','Inventario de fuentes radiactivas, equipos generadores y prácticas reguladas','Encargado PR','2.1','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P03'),
      ('PPR-04','4','Clasificación y Señalización de Zonas','Criterios de clasificación de zonas controladas y supervisadas, señalética CCHEN','Encargado PR','1.3','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P04'),
      ('PPR-05','5','Programa de Vigilancia Radiológica','Monitoreo de dosis individuales (dosimetría TLD/OSL), monitoreo de área y contaminación','Encargado PR','2.0','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P05'),
      ('PPR-06','6','Límites de Dosis y Restricciones','Límites de dosis ocupacionales y al público, restricciones de dosis institucionales','Encargado PR','1.1','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P06'),
      ('PPR-07','7','Programa ALARA','Objetivos ALARA, revisión de dosis, investigación de dosis altas y mejora continua','Encargado PR','2.0','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P07'),
      ('PPR-08','8','Gestión de Equipos e Instrumentos','Control de calidad de equipos, calibración de instrumentos de medida de radiación','Encargado PR','1.4','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P08'),
      ('PPR-09','9','Gestión de Residuos Radiactivos','Clasificación, acondicionamiento, almacenamiento y disposición de residuos radiactivos','Encargado PR','1.2','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P09'),
      ('PPR-10','10','Transporte de Material Radiactivo','Requisitos para transporte conforme IAEA SSR-6 y reglamentación CCHEN','Encargado PR','1.0','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P10'),
      ('PPR-11','11','Capacitación y Entrenamiento','Plan de capacitación PR para TOE y personal de apoyo, registros y evaluación','Encargado PR','1.3','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P11'),
      ('PPR-12','12','Preparación y Respuesta a Emergencias','Plan de emergencias radiológicas, procedimientos de respuesta y comunicación','Encargado PR','2.0','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P12'),
      ('PPR-13','13','Gestión de Cambios al Programa','Procedimiento para control de cambios en instalaciones, equipos y procedimientos PR','Encargado PR','1.0','approved','2024-01-15','2026-01-15',TRUE,'CCHEN-INS-2019-0847-P13'),
      ('PPR-14','14','Auditorías e Inspecciones Internas','Plan de auditorías internas PR, lista de verificación y seguimiento de hallazgos','Encargado PR','1.0','under_review','2023-01-15','2025-01-15',FALSE,NULL),
      ('PPR-15','15','Registros e Informes','Sistema de registros PR, reportes periódicos a CCHEN, conservación de registros','Encargado PR','1.0','under_review','2023-01-15','2025-01-15',FALSE,NULL),
      ('PPR-16','16','Mejora Continua y Revisión del Programa','Revisión anual del programa, indicadores de desempeño y lecciones aprendidas','Encargado PR','1.0','draft',NULL,'2026-06-15',FALSE,NULL)
    `;
  }
}

function nextCode(existing: string[]): string {
  // codes are PPR-NN, find max
  const nums = existing.map(c => parseInt(c.split("-")[1] ?? "0")).filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `PPR-${String(next).padStart(2,"0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const cchen = sp.get("cchen");

    const { rows } = await sql`
      SELECT *,
        CASE WHEN next_review_date < NOW() AND status != 'obsolete' THEN TRUE ELSE FALSE END AS is_overdue
      FROM radiation_program_sections
      WHERE active=TRUE
        AND (${status}::text IS NULL OR status=${status})
        AND (${cchen}::text IS NULL OR cchen_approved::text=${cchen})
      ORDER BY section_number::int ASC NULLS LAST
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE active=TRUE) AS total,
        COUNT(*) FILTER (WHERE status='approved' AND active=TRUE) AS approved,
        COUNT(*) FILTER (WHERE status='under_review' AND active=TRUE) AS under_review,
        COUNT(*) FILTER (WHERE status='draft' AND active=TRUE) AS draft,
        COUNT(*) FILTER (WHERE status='obsolete' AND active=TRUE) AS obsolete,
        COUNT(*) FILTER (WHERE cchen_approved=TRUE AND active=TRUE) AS cchen_approved,
        COUNT(*) FILTER (WHERE next_review_date < NOW() AND status!='obsolete' AND active=TRUE) AS overdue_review,
        COUNT(*) FILTER (WHERE NOT cchen_approved AND status='approved' AND active=TRUE) AS pending_cchen
      FROM radiation_program_sections
    `;

    return NextResponse.json({ rows, stats: stats[0] });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const b = await req.json();
    const { rows: existing } = await sql`SELECT section_code FROM radiation_program_sections WHERE active=TRUE`;
    const code = b.section_code || nextCode(existing.map((r: { section_code: string }) => r.section_code));
    const { rows } = await sql`
      INSERT INTO radiation_program_sections
        (section_code,section_number,title,description,content,responsible,reviewer,version,status,
         approval_date,next_review_date,cchen_approved,cchen_ref,observations,document_path)
      VALUES (${code},${b.section_number??null},${b.title},${b.description??null},${b.content??null},
        ${b.responsible??null},${b.reviewer??null},${b.version??"1.0"},${b.status??"draft"},
        ${b.approval_date??null},${b.next_review_date??null},${b.cchen_approved??false},
        ${b.cchen_ref??null},${b.observations??null},${b.document_path??null})
      RETURNING *`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const fields = Object.entries(b).filter(([k]) => k !== "id");
    if (!fields.length) return NextResponse.json({ error: "no fields" }, { status: 400 });
    const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
    const vals = fields.map(([, v]) => v);
    const { rows } = await sql.unsafe(
      `UPDATE radiation_program_sections SET ${sets}, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [b.id, ...vals]
    );
    return NextResponse.json(rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql`UPDATE radiation_program_sections SET active=FALSE WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
