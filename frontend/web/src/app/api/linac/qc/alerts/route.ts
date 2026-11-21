import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureQcExtendedTables, logQcAudit } from "@/lib/linac-qc";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
await ensureQcExtendedTables();
const { searchParams } = new URL(request.url);
const linacId = searchParams.get("linacId");
const status = searchParams.get("status");
const { rows } = await sql`
SELECT * FROM linac_qc_alerts
WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
AND (${status}::text IS NULL OR status = ${status}::text)
ORDER BY created_at DESC
LIMIT 500;
`;
return NextResponse.json({ ok: true, alerts: rows });
}

export async function PATCH(request: Request) {
await ensureQcExtendedTables();
const body = await request.json();
const { id, status, actorEmail } = body;
if (!id || !status) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
const resolvedAt = status === "resuelta" ? new Date().toISOString() : null;
const resolvedBy = status === "resuelta" ? actorEmail : null;
await sql`
UPDATE linac_qc_alerts
SET status = ${status}, resolved_at = ${resolvedAt}, resolved_by = ${resolvedBy}
WHERE id = ${id};
`;
await logQcAudit("update_linac_qc_alert", actorEmail, { id, status });
return NextResponse.json({ ok: true });
}
