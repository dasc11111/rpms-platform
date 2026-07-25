import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows } = await sql`SELECT * FROM calibration_companies ORDER BY name ASC`;
  return NextResponse.json({ companies: rows });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const kind = body.kind || null;

const { rows: existing } = await sql`SELECT * FROM calibration_companies WHERE name = ${name}`;
  if (existing.length > 0) {
    return NextResponse.json({ company: existing[0], created: false });
  }

const { rows } = await sql`
INSERT INTO calibration_companies (name, kind) VALUES (${name}, ${kind})
RETURNING *
`;
  return NextResponse.json({ company: rows[0], created: true });
}
