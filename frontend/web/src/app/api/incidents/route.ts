import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  try {
    const { rows } = status
      ? await sql`
          SELECT id, title, description, incident_date::text, service,
                 severity, status, reported_by, assigned_to, created_at::text
          FROM incidents
          WHERE status = ${status}
          ORDER BY incident_date DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, title, description, incident_date::text, service,
                 severity, status, reported_by, assigned_to, created_at::text
          FROM incidents
          ORDER BY incident_date DESC
          LIMIT ${limit}
        `;
    return NextResponse.json({ incidents: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const title = String(body.title ?? "").trim();
    const incidentDate = String(body.incident_date ?? new Date().toISOString().slice(0, 10));
    const severity = String(body.severity ?? "low");
    const status = String(body.status ?? "open");
    const service = body.service ? String(body.service) : null;
    const description = body.description ? String(body.description) : null;
    const reportedBy = body.reported_by ? String(body.reported_by) : null;

    if (!title) return NextResponse.json({ error: "title requerido" }, { status: 400 });

    const { rows } = await sql`
      INSERT INTO incidents (title, description, incident_date, service, severity, status, reported_by)
      VALUES (${title}, ${description}, ${incidentDate}::date, ${service}, ${severity}, ${status}, ${reportedBy})
      RETURNING id, title, incident_date::text, severity, status
    `;
    return NextResponse.json({ incident: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
