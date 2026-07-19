import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rut = String(body.rut ?? "").trim();
  if (!rut) return NextResponse.json({ ok: false, error: "RUT requerido." }, { status: 400 });

  await sql`UPDATE workers SET status = 'inactive', updated_at = now() WHERE rut = ${rut}`;
  return NextResponse.json({ ok: true });
}
