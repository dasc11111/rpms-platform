import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 200), 500);
  const { rows } = await sql`
    SELECT id, created_at, actor_email, action, details
    FROM audit_logs
    WHERE category = 'linac'
    ORDER BY created_at DESC
    LIMIT ${limit};
  `;
  return NextResponse.json({ ok: true, history: rows });
}
