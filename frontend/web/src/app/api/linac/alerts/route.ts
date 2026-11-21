import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureAlertsTables } from "@/lib/linac-alerts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureAlertsTables();
  const { searchParams } = new URL(request.url);
  const linacId = Number(searchParams.get("linacId") || 0);
  const moduleFilter = searchParams.get("module") || "";
  const status = searchParams.get("status") || "";
  const level = searchParams.get("level") || "";

  const params: unknown[] = [];
  const clauses: string[] = [];
  if (linacId) { params.push(linacId); clauses.push(`a.linac_id = $${params.length}`); }
  if (moduleFilter) { params.push(moduleFilter); clauses.push(`a.module = $${params.length}`); }
  if (status) { params.push(status); clauses.push(`a.status = $${params.length}`); }
  if (level) { params.push(level); clauses.push(`a.level = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await sql.query(
    `SELECT a.*, c.parameter_name AS criteria_parameter, c.source_name AS criteria_source
     FROM linac_scientific_alerts a
     LEFT JOIN linac_technical_criteria c ON c.id = a.criteria_id
     ${where}
     ORDER BY a.status = 'abierta' DESC, a.created_at DESC
     LIMIT 500`,
    params
  );

  return NextResponse.json({ alerts: rows });
}
