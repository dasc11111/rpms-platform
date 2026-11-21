import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ensureNmIncidentsTables,
  logNmIncidentAudit,
} from "@/lib/nm-incidents";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureNmIncidentsTables();
    const sp = req.nextUrl.searchParams;

    const conditions: string[] = [];
    const params: unknown[] = [];

    const category = sp.get("category");
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    const severity = sp.get("severity");
    if (severity) {
      params.push(severity);
      conditions.push(`severity = $${params.length}`);
    }
    const status = sp.get("status");
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    const investigationStatus = sp.get("investigation_status");
    if (investigationStatus) {
      params.push(investigationStatus);
      conditions.push(`investigation_status = $${params.length}`);
    }
    const dateFrom = sp.get("dateFrom");
    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`event_date >= $${params.length}`);
    }
    const dateTo = sp.get("dateTo");
    if (dateTo) {
      params.push(dateTo);
      conditions.push(`event_date <= $${params.length}`);
    }
    const q = sp.get("q");
    if (q) {
      params.push(`%${q}%`);
      conditions.push(
        `(description ILIKE $${params.length} OR location ILIKE $${params.length} OR person_involved ILIKE $${params.length})`
      );
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await sql.unsafe(
      `SELECT * FROM nm_incidents ${where} ORDER BY event_date DESC, created_at DESC LIMIT 500`,
      params
    );

    // Stats
    const allRows = await sql`SELECT severity, status, investigation_status FROM nm_incidents`;
    const stats = {
      total: allRows.length,
      abiertos: allRows.filter((r) => r.status === "abierto").length,
      en_investigacion: allRows.filter((r) => r.investigation_status === "en_investigacion").length,
      cerrados: allRows.filter((r) => r.status === "cerrado").length,
      graves: allRows.filter((r) => r.severity === "grave").length,
    };

    return NextResponse.json({ data: rows, stats });
  } catch (err) {
    console.error("GET /api/incidents", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureNmIncidentsTables();
    const body = await req.json();

    const row = await sql`
      INSERT INTO nm_incidents (
        event_date, event_time, category, severity, is_near_miss,
        location, person_involved, description, immediate_actions,
        notification_status, notified_to, investigation_status,
        corrective_actions, responsible, documents_url, status
      ) VALUES (
        ${body.event_date}, ${body.event_time ?? null}, ${body.category}, ${body.severity},
        ${body.is_near_miss ?? false}, ${body.location ?? null},
        ${body.person_involved ?? null}, ${body.description},
        ${body.immediate_actions ?? null}, ${body.notification_status ?? "pendiente"},
        ${body.notified_to ?? null}, ${body.investigation_status ?? "abierto"},
        ${body.corrective_actions ?? null}, ${body.responsible ?? null},
        ${body.documents_url ?? null}, ${body.status ?? "abierto"}
      )
      RETURNING *
    `;

    await logNmIncidentAudit("create_incident", null, { id: row[0]?.id, category: body.category });
    return NextResponse.json({ data: row[0] }, { status: 201 });
  } catch (err) {
    console.error("POST /api/incidents", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureNmIncidentsTables();
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const allowed = [
      "event_date", "event_time", "category", "severity", "is_near_miss",
      "location", "person_involved", "description", "immediate_actions",
      "notification_status", "notified_to", "investigation_status",
      "corrective_actions", "responsible", "documents_url", "status",
    ];

    const setClauses: string[] = [];
    const params: unknown[] = [];

    for (const key of allowed) {
      if (key in fields) {
        params.push(fields[key]);
        setClauses.push(`${key} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    params.push(id);
    const row = await sql.unsafe(
      `UPDATE nm_incidents SET ${setClauses.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params
    );

    await logNmIncidentAudit("update_incident", null, { id, fields: Object.keys(fields) });
    return NextResponse.json({ data: row[0] });
  } catch (err) {
    console.error("PATCH /api/incidents", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
