import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTransportTables } from "@/lib/transport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureTransportTables();
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();

  const { rows } = search
    ? await sql`SELECT name FROM transport_oprs WHERE name ILIKE ${"%" + search + "%"} ORDER BY name LIMIT 20;`
    : await sql`SELECT name FROM transport_oprs ORDER BY name LIMIT 200;`;

  return NextResponse.json({ ok: true, oprs: rows });
}
