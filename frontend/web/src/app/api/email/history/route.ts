/**
 * GET /api/email/history
 * Historial de correos enviados desde RPMS
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  try {
    const { rows } = await sql`
      SELECT id, recipient, subject, template, status, message_id, error, sent_at
      FROM email_log
      ORDER BY sent_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
      FROM email_log
    `;

    return NextResponse.json({ history: rows, stats: stats[0] });
  } catch {
    return NextResponse.json({ history: [], stats: { total: 0, sent: 0, failed: 0 } });
  }
}
