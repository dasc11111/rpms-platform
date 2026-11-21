import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// ─── Schema ──────────────────────────────────────────────────────────────────
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS committee_meetings (
      id              SERIAL PRIMARY KEY,
      meeting_number  INTEGER,
      meeting_date    DATE        NOT NULL,
      meeting_type    TEXT        NOT NULL DEFAULT 'ordinary',
      location        TEXT,
      chair           TEXT,
      secretary       TEXT,
      attendees       TEXT,
      quorum          BOOLEAN     DEFAULT true,
      agenda          TEXT,
      resolutions     TEXT,
      next_meeting    DATE,
      status          TEXT        NOT NULL DEFAULT 'draft',
      document_ref    TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Seed initial data if empty
  const { rows: existing } = await sql`SELECT id FROM committee_meetings LIMIT 1`;
  if (existing.length === 0) {
    const y = new Date().getFullYear();
    await sql`
      INSERT INTO committee_meetings
        (meeting_number, meeting_date, meeting_type, location, chair, attendees, quorum,
         agenda, resolutions, status)
      VALUES
        (1, ${`${y}-03-15`}, 'ordinary', 'Sala de reuniones Radiofísica', 'Jefe Radiofísica',
         'Jefe Radiofísica, TM Protección Radiológica, Médico Nuclear, Físico Médico LINAC',
         true,
         'Revisión programa de protección radiológica; Informe dosis colectiva primer trimestre; Estado calibraciones',
         'Aprobación programa PR 2024; Implementar dosimetría adicional en área PET/CT; Revisar vigencia autorizaciones',
         'approved'),
        (2, ${`${y}-06-20`}, 'ordinary', 'Sala de reuniones Radiofísica', 'Jefe Radiofísica',
         'Jefe Radiofísica, TM Protección Radiológica, Médico Nuclear',
         true,
         'Revisión incidentes primer semestre; Capacitación pendiente personal nuevo; Vencimientos segundo semestre',
         'Capacitar 3 TM nuevos antes agosto; Renovar contrato dosimetría externa; Actualizar plan emergencia',
         'approved'),
        (3, ${`${y + 1}-01-10`}, 'ordinary', NULL, 'Jefe Radiofísica',
         NULL, true,
         'Planificación anual protección radiológica; Revisión presupuesto calibraciones; Objetivos programa ALARA',
         NULL,
         'draft')
    `;
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* table may already exist */ }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const year   = searchParams.get("year");
  const type   = searchParams.get("type");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  try {
    let rows;
    if (status && year && type) {
      ({ rows } = await sql`
        SELECT * FROM committee_meetings
        WHERE status = ${status}
          AND EXTRACT(YEAR FROM meeting_date) = ${parseInt(year)}
          AND meeting_type = ${type}
        ORDER BY meeting_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (status && year) {
      ({ rows } = await sql`
        SELECT * FROM committee_meetings
        WHERE status = ${status}
          AND EXTRACT(YEAR FROM meeting_date) = ${parseInt(year)}
        ORDER BY meeting_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (status && type) {
      ({ rows } = await sql`
        SELECT * FROM committee_meetings
        WHERE status = ${status} AND meeting_type = ${type}
        ORDER BY meeting_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (year && type) {
      ({ rows } = await sql`
        SELECT * FROM committee_meetings
        WHERE EXTRACT(YEAR FROM meeting_date) = ${parseInt(year)}
          AND meeting_type = ${type}
        ORDER BY meeting_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (status) {
      ({ rows } = await sql`
        SELECT * FROM committee_meetings
        WHERE status = ${status}
        ORDER BY meeting_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (year) {
      ({ rows } = await sql`
        SELECT * FROM committee_meetings
        WHERE EXTRACT(YEAR FROM meeting_date) = ${parseInt(year)}
        ORDER BY meeting_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (type) {
      ({ rows } = await sql`
        SELECT * FROM committee_meetings
        WHERE meeting_type = ${type}
        ORDER BY meeting_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else {
      ({ rows } = await sql`
        SELECT * FROM committee_meetings
        ORDER BY meeting_date DESC LIMIT ${limit} OFFSET ${offset}`);
    }

    // Stats
    const { rows: stats } = await sql`
      SELECT
        COUNT(*)                                           AS total,
        COUNT(*) FILTER (WHERE status = 'approved')       AS approved,
        COUNT(*) FILTER (WHERE status = 'draft')          AS draft,
        COUNT(*) FILTER (WHERE meeting_type = 'ordinary') AS ordinary,
        COUNT(*) FILTER (WHERE meeting_type = 'extraordinary') AS extraordinary,
        COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM meeting_date) = EXTRACT(YEAR FROM now())) AS this_year,
        MAX(meeting_date) AS last_meeting,
        MAX(next_meeting) AS next_scheduled
      FROM committee_meetings
    `;

    return NextResponse.json({ meetings: rows, stats: stats[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    const meeting_date = body.meeting_date;
    if (!meeting_date) {
      return NextResponse.json({ error: "meeting_date es obligatorio" }, { status: 400 });
    }

    // Auto-assign meeting number for the year
    const year = new Date(meeting_date).getFullYear();
    const { rows: last } = await sql`
      SELECT COALESCE(MAX(meeting_number), 0) AS max_num
      FROM committee_meetings
      WHERE EXTRACT(YEAR FROM meeting_date) = ${year}
    `;
    const meeting_number = (Number(last[0]?.max_num) || 0) + 1;

    const { rows } = await sql`
      INSERT INTO committee_meetings
        (meeting_number, meeting_date, meeting_type, location, chair, secretary,
         attendees, quorum, agenda, resolutions, next_meeting, status, document_ref, notes)
      VALUES
        (${meeting_number},
         ${meeting_date},
         ${body.meeting_type ?? "ordinary"},
         ${body.location ?? null},
         ${body.chair ?? null},
         ${body.secretary ?? null},
         ${body.attendees ?? null},
         ${body.quorum ?? true},
         ${body.agenda ?? null},
         ${body.resolutions ?? null},
         ${body.next_meeting ?? null},
         ${body.status ?? "draft"},
         ${body.document_ref ?? null},
         ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ meeting: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const allowed: Record<string, unknown> = {};
    const editable = ["meeting_date","meeting_type","location","chair","secretary",
      "attendees","quorum","agenda","resolutions","next_meeting","status","document_ref","notes"];
    for (const k of editable) {
      if (k in fields) allowed[k] = fields[k];
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    // Build dynamic SET clause
    const setClauses = Object.keys(allowed).map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = [id, ...Object.values(allowed)];
    const query = `UPDATE committee_meetings SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`;

    const { rows } = await sql.unsafe(query, values);
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ meeting: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`DELETE FROM committee_meetings WHERE id = ${parseInt(id)} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
