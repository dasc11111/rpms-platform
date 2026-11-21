/**
 * GET  /api/settings/institution  — devuelve datos del establecimiento
 * POST /api/settings/institution  — actualiza/crea datos del establecimiento
 *
 * Tabla institution_settings (clave única: id=1)
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS institution_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL DEFAULT '',
      rut TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      commune TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      director TEXT NOT NULL DEFAULT '',
      opr_name TEXT NOT NULL DEFAULT '',
      opr_phone TEXT NOT NULL DEFAULT '',
      cchen_code TEXT NOT NULL DEFAULT '',
      seremi_code TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function GET() {
  try {
    await ensureTable();
    const { rows } = await sql`SELECT * FROM institution_settings WHERE id = 1 LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({});
    const r = rows[0] as Record<string, unknown>;
    return NextResponse.json({
      name: r.name, rut: r.rut, address: r.address, commune: r.commune,
      region: r.region, phone: r.phone, email: r.email, director: r.director,
      opr_name: r.opr_name, opr_phone: r.opr_phone,
      cchen_code: r.cchen_code, seremi_code: r.seremi_code,
    });
  } catch (err) {
    console.error("GET /api/settings/institution", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const b = await req.json();
    await sql`
      INSERT INTO institution_settings (
        id, name, rut, address, commune, region, phone, email,
        director, opr_name, opr_phone, cchen_code, seremi_code, updated_at
      ) VALUES (
        1,
        ${b.name ?? ""}, ${b.rut ?? ""}, ${b.address ?? ""},
        ${b.commune ?? ""}, ${b.region ?? ""}, ${b.phone ?? ""},
        ${b.email ?? ""}, ${b.director ?? ""},
        ${b.opr_name ?? ""}, ${b.opr_phone ?? ""},
        ${b.cchen_code ?? ""}, ${b.seremi_code ?? ""},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, rut = EXCLUDED.rut, address = EXCLUDED.address,
        commune = EXCLUDED.commune, region = EXCLUDED.region, phone = EXCLUDED.phone,
        email = EXCLUDED.email, director = EXCLUDED.director,
        opr_name = EXCLUDED.opr_name, opr_phone = EXCLUDED.opr_phone,
        cchen_code = EXCLUDED.cchen_code, seremi_code = EXCLUDED.seremi_code,
        updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/settings/institution", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
