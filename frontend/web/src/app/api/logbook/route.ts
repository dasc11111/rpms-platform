import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS operational_logbook (
      id SERIAL PRIMARY KEY,
      entry_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      zone_name VARCHAR(200),
      event_type VARCHAR(50) NOT NULL DEFAULT 'otro',
      description TEXT NOT NULL,
      reported_by VARCHAR(200) NOT NULL,
      supervisor VARCHAR(200),
      corrective_action TEXT,
      follow_up_required BOOLEAN DEFAULT FALSE,
      follow_up_date DATE,
      status VARCHAR(20) DEFAULT 'open',
      closed_at TIMESTAMPTZ,
      closed_by VARCHAR(200),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const zone = searchParams.get("zone");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const date = searchParams.get("date"); // YYYY-MM-DD
    const summary = searchParams.get("summary") === "1";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);

    if (summary) {
      const { rows: stats } = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
          COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_count,
          COUNT(*) FILTER (WHERE follow_up_required = TRUE AND status != 'closed')::int AS follow_up_pending,
          COUNT(*) FILTER (WHERE follow_up_required = TRUE AND follow_up_date < CURRENT_DATE AND status != 'closed')::int AS follow_up_overdue,
          COUNT(*) FILTER (WHERE entry_datetime >= NOW() - INTERVAL '30 days')::int AS last_30_days,
          COUNT(*) FILTER (WHERE entry_datetime >= CURRENT_DATE)::int AS today_count
        FROM operational_logbook
      `;
      const { rows: by_type } = await sql`
        SELECT event_type, COUNT(*)::int AS count
        FROM operational_logbook
        WHERE entry_datetime >= NOW() - INTERVAL '90 days'
        GROUP BY event_type ORDER BY count DESC
      `;
      return NextResponse.json({ stats: stats[0], by_type });
    }

    const { rows } = await sql`
      SELECT * FROM operational_logbook
      WHERE (${zone}::text IS NULL OR zone_name ILIKE ${'%' + (zone ?? '') + '%'})
        AND (${status}::text IS NULL OR status = ${status})
        AND (${type}::text IS NULL OR event_type = ${type})
        AND (${date}::text IS NULL OR entry_datetime::date = ${date}::date)
      ORDER BY entry_datetime DESC
      LIMIT ${limit}
    `;
    return NextResponse.json({ entries: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json() as {
      entry_datetime?: string;
      zone_name?: string;
      event_type: string;
      description: string;
      reported_by: string;
      supervisor?: string;
      corrective_action?: string;
      follow_up_required?: boolean;
      follow_up_date?: string;
      status?: string;
      notes?: string;
    };
    if (!body.description?.trim() || !body.reported_by?.trim()) {
      return NextResponse.json({ error: "description y reported_by son requeridos" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO operational_logbook (
        entry_datetime, zone_name, event_type, description, reported_by,
        supervisor, corrective_action, follow_up_required, follow_up_date, status, notes
      ) VALUES (
        ${body.entry_datetime ?? null} , ${body.zone_name ?? null},
        ${body.event_type ?? 'otro'}, ${body.description}, ${body.reported_by},
        ${body.supervisor ?? null}, ${body.corrective_action ?? null},
        ${body.follow_up_required ?? false}, ${body.follow_up_date ?? null},
        ${body.status ?? 'open'}, ${body.notes ?? null}
      ) RETURNING *
    `;
    return NextResponse.json({ entry: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json() as {
      id: number;
      zone_name?: string;
      event_type?: string;
      description?: string;
      reported_by?: string;
      supervisor?: string;
      corrective_action?: string;
      follow_up_required?: boolean;
      follow_up_date?: string | null;
      status?: string;
      closed_by?: string;
      notes?: string;
    };
    if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const closedAt = body.status === "closed" ? new Date().toISOString() : null;

    const { rows } = await sql`
      UPDATE operational_logbook SET
        zone_name = COALESCE(${body.zone_name ?? null}, zone_name),
        event_type = COALESCE(${body.event_type ?? null}, event_type),
        description = COALESCE(${body.description ?? null}, description),
        reported_by = COALESCE(${body.reported_by ?? null}, reported_by),
        supervisor = COALESCE(${body.supervisor ?? null}, supervisor),
        corrective_action = COALESCE(${body.corrective_action ?? null}, corrective_action),
        follow_up_required = COALESCE(${body.follow_up_required ?? null}, follow_up_required),
        follow_up_date = COALESCE(${body.follow_up_date ?? null}, follow_up_date),
        status = COALESCE(${body.status ?? null}, status),
        closed_at = CASE WHEN ${body.status ?? null} = 'closed' THEN ${closedAt} ELSE closed_at END,
        closed_by = COALESCE(${body.closed_by ?? null}, closed_by),
        notes = COALESCE(${body.notes ?? null}, notes)
      WHERE id = ${body.id}
      RETURNING *
    `;
    if (!rows.length) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ entry: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`DELETE FROM operational_logbook WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
