import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureRadioterapiaTables();
  const { rows } = await sql`
    SELECT * FROM audit_logs WHERE category = 'radioterapia' ORDER BY id DESC LIMIT 200
  `;
  return NextResponse.json({ ok: true, history: rows });
}
