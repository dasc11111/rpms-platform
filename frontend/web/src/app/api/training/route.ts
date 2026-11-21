import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS training_courses (
      id SERIAL PRIMARY KEY,
      course_code VARCHAR(50) UNIQUE NOT NULL,
      course_name VARCHAR(300) NOT NULL,
      category VARCHAR(30) DEFAULT 'basic_rp',
      instructor VARCHAR(200),
      scheduled_date DATE NOT NULL,
      duration_hours NUMERIC(4,1) DEFAULT 1,
      status VARCHAR(20) DEFAULT 'scheduled',
      participants_registered INT DEFAULT 0,
      participants_attended INT DEFAULT 0,
      participants_passed INT DEFAULT 0,
      regulatory_basis VARCHAR(300),
      certificate_valid_months INT DEFAULT 12,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    const { rows } = status
      ? await sql`
          SELECT * FROM training_courses
          WHERE status = ${status}
          ORDER BY scheduled_date DESC LIMIT 200
        `
      : category
      ? await sql`
          SELECT * FROM training_courses
          WHERE category = ${category}
          ORDER BY scheduled_date DESC LIMIT 200
        `
      : await sql`
          SELECT * FROM training_courses
          ORDER BY
            CASE status WHEN 'in_progress' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
            scheduled_date DESC
          LIMIT 200
        `;

    // Summary stats
    const { rows: stats } = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COALESCE(SUM(duration_hours * participants_attended), 0)::float AS total_hours_delivered,
        COALESCE(SUM(participants_passed), 0)::int AS total_passed,
        COALESCE(SUM(participants_attended), 0)::int AS total_attended
      FROM training_courses
    `;

    return NextResponse.json({ courses: rows, stats: stats[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();

    const {
      course_code, course_name, category = "basic_rp", instructor,
      scheduled_date, duration_hours = 1, status = "scheduled",
      participants_registered = 0, participants_attended = 0, participants_passed = 0,
      regulatory_basis, certificate_valid_months = 12, notes,
    } = body;

    if (!course_code || !course_name || !scheduled_date) {
      return NextResponse.json({ error: "course_code, course_name y scheduled_date son obligatorios" }, { status: 400 });
    }

    const { rows } = await sql`
      INSERT INTO training_courses (
        course_code, course_name, category, instructor, scheduled_date,
        duration_hours, status, participants_registered, participants_attended,
        participants_passed, regulatory_basis, certificate_valid_months, notes
      ) VALUES (
        ${course_code}, ${course_name}, ${category}, ${instructor ?? null}, ${scheduled_date},
        ${duration_hours}, ${status}, ${participants_registered}, ${participants_attended},
        ${participants_passed}, ${regulatory_basis ?? null}, ${certificate_valid_months}, ${notes ?? null}
      )
      ON CONFLICT (course_code) DO UPDATE SET
        course_name = EXCLUDED.course_name,
        category = EXCLUDED.category,
        instructor = EXCLUDED.instructor,
        scheduled_date = EXCLUDED.scheduled_date,
        duration_hours = EXCLUDED.duration_hours,
        status = EXCLUDED.status,
        participants_registered = EXCLUDED.participants_registered,
        participants_attended = EXCLUDED.participants_attended,
        participants_passed = EXCLUDED.participants_passed,
        regulatory_basis = EXCLUDED.regulatory_basis,
        certificate_valid_months = EXCLUDED.certificate_valid_months,
        notes = EXCLUDED.notes
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, participants_attended, participants_passed } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const { rows } = await sql`
      UPDATE training_courses SET
        status = COALESCE(${status ?? null}, status),
        participants_attended = COALESCE(${participants_attended ?? null}, participants_attended),
        participants_passed = COALESCE(${participants_passed ?? null}, participants_passed)
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`DELETE FROM training_courses WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
