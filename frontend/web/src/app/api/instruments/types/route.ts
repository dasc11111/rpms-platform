import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { slugifyType } from "@/lib/instruments";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows } = await sql`SELECT * FROM instrument_types ORDER BY sort_order ASC, name ASC`;
  return NextResponse.json({ types: rows });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

const slug = slugifyType(name);
  const { rows: existing } = await sql`SELECT id FROM instrument_types WHERE name = ${name} OR slug = ${slug}`;
  if (existing.length > 0) {
    const { rows } = await sql`SELECT * FROM instrument_types WHERE id = ${existing[0]?.id}`;
    return NextResponse.json({ type: rows[0], created: false });
  }

const { rows: maxRows } = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM instrument_types`;
  const sortOrder = Number(maxRows[0]?.next ?? 1);

const { rows } = await sql`
INSERT INTO instrument_types (name, slug, sort_order) VALUES (${name}, ${slug}, ${sortOrder})
RETURNING *
`;
  return NextResponse.json({ type: rows[0], created: true });
}
