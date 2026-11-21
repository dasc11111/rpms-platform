import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Catalogo parametrizable de radionuclidos (ver tabla "radionuclides" en
// api/init/route.ts). Permite listar todos o solo los activos, y actualizar
// sus parametros sin tocar codigo, habilitando la escalabilidad a futuros
// radionuclidos (Tc-99m, F-18, Ga-68, Lu-177, Y-90, Ra-223, Sm-153, I-123).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("active") === "true";
  const { rows } = onlyActive
  ? await sql`SELECT * FROM radionuclides WHERE active = true ORDER BY sort_order, code`
    : await sql`SELECT * FROM radionuclides ORDER BY sort_order, code`;
  return NextResponse.json({ rows });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const code = (body.code ?? "").toString().trim();
  if (!code) {
    return NextResponse.json({ error: "code es obligatorio" }, { status: 400 });
  }
  const { rows } = await sql`
  UPDATE radionuclides SET
  active = ${body.active ?? true},
  release_criteria_activity = ${body.release_criteria_activity ?? null},
  release_criteria_dose_rate_usvh = ${body.release_criteria_dose_rate_usvh ?? null},
  notes = ${body.notes ?? null},
  updated_at = now()
  WHERE code = ${code}
  RETURNING *
  `;
  if (!rows[0]) {
    return NextResponse.json({ error: "Radionúclido no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ row: rows[0] });
}
