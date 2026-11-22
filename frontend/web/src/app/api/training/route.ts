import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// §53 — Capacitación y Competencias en Protección Radiológica
// DS 3/1985 Art. 25 — IAEA GSG-7 — Capacitación anual obligatoria
// Áreas: protección radiológica, emergencias, calidad, seguridad, normativa

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS training_sessions (
      id              SERIAL PRIMARY KEY,
      session_code    VARCHAR(50) UNIQUE NOT NULL,
      title           TEXT NOT NULL,
      category        VARCHAR(50) NOT NULL DEFAULT 'radiation_protection',
      modality        VARCHAR(30) NOT NULL DEFAULT 'presential',
      trainer         TEXT,
      trainer_entity  TEXT,
      scope           TEXT,
      objectives      TEXT,
      content_summary TEXT,
      session_date    DATE,
      end_date        DATE,
      duration_hours  NUMERIC(5,1),
      location        TEXT,
      max_capacity    INT,
      attendees_count INT,
      pass_score      NUMERIC(4,1) DEFAULT 70,
      status          VARCHAR(30) NOT NULL DEFAULT 'planned',
      certification   BOOLEAN DEFAULT FALSE,
      cert_valid_months INT,
      references_norm TEXT,
      notes           TEXT,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS training_participants (
      id            SERIAL PRIMARY KEY,
      session_id    INT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
      worker_name   TEXT NOT NULL,
      rut           VARCHAR(20),
      role          TEXT,
      area          TEXT,
      attended      BOOLEAN DEFAULT TRUE,
      score         NUMERIC(5,2),
      passed        BOOLEAN,
      cert_issued   BOOLEAN DEFAULT FALSE,
      cert_expiry   DATE,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM training_sessions`;
  if (parseInt(count[0]?.count ?? "0") === 0) {
    await sql`
      INSERT INTO training_sessions (session_code, title, category, modality, trainer, trainer_entity, scope, objectives, content_summary, session_date, duration_hours, location, max_capacity, attendees_count, pass_score, status, certification, cert_valid_months, references_norm)
      VALUES
        ('CAP-PR-2025-001', 'Protección Radiológica Básica — Personal TOE', 'radiation_protection', 'presential',
         'Médico Nuclear', 'Departamento Protección Radiológica', 'Todo el personal expuesto a radiación ionizante',
         'Conocer principios ALARA, dosis límite y uso correcto de dosímetros',
         'Fundamentos radiación ionizante; principios justificación, optimización, limitación; dosis efectiva límite DS 3/1985; uso y cuidado dosímetros TLD/OSL; procedimientos emergencia',
         '2025-04-15', 8.0, 'Sala de Capacitación, Medicina Nuclear', 25, 22, 70, 'completed', TRUE, 12,
         'DS 3/1985 Art. 25; IAEA GSG-7; Ord. CCHEN 72/2020'),
        ('CAP-PR-2025-002', 'Manejo Seguro de Radiofármacos — Radiofarmacia', 'radiopharmacy', 'presential',
         'Químico Farmacéutico', 'Radiofarmacia Hospital', 'Personal de radiofarmacia y tecnólogos médicos',
         'Procedimientos seguros síntesis, control calidad y dispensación radiofármacos',
         'Radiofármacos diagnósticos y terapéuticos; reglas de oro protección; cabinas blindadas; medición actividad; gestión residuos líquidos radiactivos; registro de dosis trabajador',
         '2025-06-20', 16.0, 'Radiofarmacia, piso 3', 10, 9, 75, 'completed', TRUE, 12,
         'DS 3/1985 Art. 42; IAEA NSS No. 38-G; RS-G-1.5'),
        ('CAP-EM-2025-001', 'Respuesta a Emergencias Radiológicas', 'emergency', 'mixed',
         'Instructor CCHEN', 'CCHEN — Comisión Chilena de Energía Nuclear', 'Todo el personal del servicio',
         'Conocer el plan de emergencias radiológicas y ejecutar respuesta inicial correcta',
         'Plan de emergencia del servicio; derrames radiactivos: clasificación y respuesta; contaminación personal; alarmas y evacuación; cadena de comunicación; ejercicio simulacro',
         '2025-08-10', 4.0, 'Sala multipropósito + área práctica', 30, 28, 80, 'completed', FALSE, NULL,
         'DS 3/1985 Art. 50; IAEA EPR-Nuclear 2022; Plan de emergencia institucional'),
        ('CAP-CA-2026-001', 'Gestión de Calidad en Medicina Nuclear — ISO 9001:2015', 'quality', 'virtual',
         'Consultor Externo', 'Consultoría QMS Chile Ltda.', 'Personal técnico y administrativo',
         'Aplicar principios ISO 9001:2015 en procesos de medicina nuclear',
         'Fundamentos SGC ISO 9001:2015; control documentos y registros; no conformidades y acciones correctivas; auditorías internas; mejora continua',
         '2026-03-05', 8.0, 'Plataforma e-learning', 20, 15, 70, 'completed', TRUE, 24,
         'ISO 9001:2015; Ord. MINSAL 1092/2016'),
        ('CAP-PR-2026-001', 'Actualización Protección Radiológica — Nuevas normas CCHEN 2026', 'radiation_protection', 'presential',
         'Inspector CCHEN', 'Comisión Chilena de Energía Nuclear', 'Personal TOE y jefatura',
         'Actualizar conocimientos sobre cambios normativos y nuevos límites de dosis',
         'Cambios DS 3/1985 modificación 2025; nuevos límites cristalino (20 mSv); registro electrónico CCHEN; gestión embarazo trabajadoras expuestas; casos reales inspección',
         '2026-11-28', 6.0, 'Auditorio Hospital', 35, NULL, 70, 'planned', FALSE, NULL,
         'DS 3/1985 mod. 2025; IAEA GSR Part 3 2024; Circular CCHEN 15/2026')
    `;
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id       = searchParams.get("id");
    const category = searchParams.get("category");
    const status   = searchParams.get("status");
    const year     = searchParams.get("year");

    if (id) {
      const [session] = await sql`SELECT * FROM training_sessions WHERE id = ${id} AND active = TRUE`;
      if (!session) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      const participants = await sql`SELECT * FROM training_participants WHERE session_id = ${id} ORDER BY worker_name`;
      return NextResponse.json({ session, participants });
    }

    let sessions;
    if (category && status && year) {
      sessions = await sql`SELECT * FROM training_sessions WHERE active=TRUE AND category=${category} AND status=${status} AND EXTRACT(YEAR FROM session_date)=${year} ORDER BY session_date DESC`;
    } else if (category && status) {
      sessions = await sql`SELECT * FROM training_sessions WHERE active=TRUE AND category=${category} AND status=${status} ORDER BY session_date DESC`;
    } else if (category && year) {
      sessions = await sql`SELECT * FROM training_sessions WHERE active=TRUE AND category=${category} AND EXTRACT(YEAR FROM session_date)=${year} ORDER BY session_date DESC`;
    } else if (status && year) {
      sessions = await sql`SELECT * FROM training_sessions WHERE active=TRUE AND status=${status} AND EXTRACT(YEAR FROM session_date)=${year} ORDER BY session_date DESC`;
    } else if (category) {
      sessions = await sql`SELECT * FROM training_sessions WHERE active=TRUE AND category=${category} ORDER BY session_date DESC`;
    } else if (status) {
      sessions = await sql`SELECT * FROM training_sessions WHERE active=TRUE AND status=${status} ORDER BY session_date DESC`;
    } else if (year) {
      sessions = await sql`SELECT * FROM training_sessions WHERE active=TRUE AND EXTRACT(YEAR FROM session_date)=${year} ORDER BY session_date DESC`;
    } else {
      sessions = await sql`SELECT * FROM training_sessions WHERE active=TRUE ORDER BY session_date DESC`;
    }

    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE active)                                       AS total,
        COUNT(*) FILTER (WHERE active AND status='completed')                AS completed,
        COUNT(*) FILTER (WHERE active AND status='planned')                  AS planned,
        COUNT(*) FILTER (WHERE active AND status='in_progress')              AS in_progress,
        COUNT(*) FILTER (WHERE active AND status='cancelled')                AS cancelled,
        COALESCE(SUM(attendees_count) FILTER (WHERE active AND status='completed'), 0) AS total_attendees,
        COALESCE(SUM(duration_hours) FILTER (WHERE active AND status='completed'), 0)  AS total_hours,
        COUNT(*) FILTER (WHERE active AND status='planned' AND session_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS upcoming_30d
      FROM training_sessions
    `;

    const years = await sql`
      SELECT DISTINCT EXTRACT(YEAR FROM session_date)::INT AS y
      FROM training_sessions WHERE active=TRUE AND session_date IS NOT NULL
      ORDER BY y DESC
    `;

    return NextResponse.json({ sessions, stats, years: years.map((r: { y: number }) => r.y) });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const {
      session_code, title, category = "radiation_protection", modality = "presential",
      trainer, trainer_entity, scope, objectives, content_summary,
      session_date, end_date, duration_hours, location, max_capacity, attendees_count,
      pass_score = 70, status = "planned", certification = false, cert_valid_months,
      references_norm, notes
    } = body;

    if (!session_code || !title) return NextResponse.json({ error: "Código y título requeridos" }, { status: 400 });

    const [row] = await sql`
      INSERT INTO training_sessions (session_code, title, category, modality, trainer, trainer_entity, scope, objectives, content_summary, session_date, end_date, duration_hours, location, max_capacity, attendees_count, pass_score, status, certification, cert_valid_months, references_norm, notes)
      VALUES (${session_code}, ${title}, ${category}, ${modality}, ${trainer ?? null}, ${trainer_entity ?? null}, ${scope ?? null}, ${objectives ?? null}, ${content_summary ?? null}, ${session_date ?? null}, ${end_date ?? null}, ${duration_hours ?? null}, ${location ?? null}, ${max_capacity ?? null}, ${attendees_count ?? null}, ${pass_score}, ${status}, ${certification}, ${cert_valid_months ?? null}, ${references_norm ?? null}, ${notes ?? null})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const allowed = ["title","category","modality","trainer","trainer_entity","scope","objectives","content_summary","session_date","end_date","duration_hours","location","max_capacity","attendees_count","pass_score","status","certification","cert_valid_months","references_norm","notes"];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (!entries.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });

    const setClauses = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
    const values = [id, ...entries.map(([, v]) => v)];
    const rows = await sql.unsafe(`UPDATE training_sessions SET ${setClauses}, updated_at=now() WHERE id=$1 AND active=TRUE RETURNING *`, values);
    return NextResponse.json(rows[0] ?? null);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`UPDATE training_sessions SET active=FALSE, updated_at=now() WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Participants sub-resource
export async function PUT(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { session_id, worker_name, rut, role, area, attended = true, score, cert_expiry, notes } = body;
    if (!session_id || !worker_name) return NextResponse.json({ error: "session_id y worker_name requeridos" }, { status: 400 });

    const passed = score !== undefined && score !== null ? score >= 70 : null;
    const cert_issued = passed && (await sql`SELECT certification, cert_valid_months FROM training_sessions WHERE id=${session_id}`)[0]?.certification;

    const [row] = await sql`
      INSERT INTO training_participants (session_id, worker_name, rut, role, area, attended, score, passed, cert_issued, cert_expiry, notes)
      VALUES (${session_id}, ${worker_name}, ${rut ?? null}, ${role ?? null}, ${area ?? null}, ${attended}, ${score ?? null}, ${passed}, ${cert_issued ?? false}, ${cert_expiry ?? null}, ${notes ?? null})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
