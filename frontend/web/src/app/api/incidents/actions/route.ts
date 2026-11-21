import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const incidentId = searchParams.get("incident_id");
  const status = searchParams.get("status");

  try {
    const rows = incidentId && status
      ? (await sql`
          SELECT id, incident_id, action_type, description, assigned_to,
                 due_date::text, completed_at::text, status, notes, created_at::text
          FROM incident_actions
          WHERE incident_id = ${incidentId} AND status = ${status}
          ORDER BY due_date ASC NULLS LAST
        `).rows
      : incidentId
      ? (await sql`
          SELECT id, incident_id, action_type, description, assigned_to,
                 due_date::text, completed_at::text, status, notes, created_at::text
          FROM incident_actions
          WHERE incident_id = ${incidentId}
          ORDER BY due_date ASC NULLS LAST
        `).rows
      : status
      ? (await sql`
          SELECT id, incident_id, action_type, description, assigned_to,
                 due_date::text, completed_at::text, status, notes, created_at::text
          FROM incident_actions
          WHERE status = ${status}
          ORDER BY due_date ASC NULLS LAST
        `).rows
      : (await sql`
          SELECT id, incident_id, action_type, description, assigned_to,
                 due_date::text, completed_at::text, status, notes, created_at::text
          FROM incident_actions
          ORDER BY due_date ASC NULLS LAST
          LIMIT 500
        `).rows;

    return NextResponse.json({ data: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      incident_id: number;
      action_type: string;
      description: string;
      assigned_to?: string;
      due_date?: string;
      notes?: string;
    };
    const { incident_id, action_type, description, assigned_to, due_date, notes } = body;

    const r = await sql`
      INSERT INTO incident_actions (
        incident_id, action_type, description, assigned_to, due_date, notes
      ) VALUES (
        ${incident_id}, ${action_type}, ${description},
        ${assigned_to ?? null}, ${due_date ?? null}, ${notes ?? null}
      )
      RETURNING id
    `;
    return NextResponse.json({ id: (r.rows[0] as { id: number }).id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: number;
      status?: string;
      completed_at?: string;
      notes?: string;
    };
    const { id, status, completed_at, notes } = body;

    if (status === "completed") {
      await sql`
        UPDATE incident_actions
        SET status = 'completed',
            completed_at = ${completed_at ?? new Date().toISOString()},
            notes = COALESCE(${notes ?? null}, notes)
        WHERE id = ${id}
      `;
    } else if (status) {
      await sql`
        UPDATE incident_actions
        SET status = ${status},
            notes = COALESCE(${notes ?? null}, notes)
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/incidents/actions?id=
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { rows } = await sql`DELETE FROM incident_actions WHERE id = ${Number(id)} RETURNING id`;
    if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ deleted: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
