import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureLinacTables();
  const { rows } = await sql`SELECT * FROM linac_units ORDER BY id ASC`;
  return NextResponse.json({ ok: true, units: rows });
}

export async function POST(request: Request) {
  await ensureLinacTables();
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  const { rows } = await sql`
    INSERT INTO linac_units (
      brand, model, manufacturer, manufacture_year, install_year, serial_number,
      inventory_number, photon_energies, electron_energies, mlc_type, epid, cbct,
      record_verify_system, tps_associated, room, operational_status
    ) VALUES (
      ${body.brand || null}, ${body.model || null}, ${body.manufacturer || null},
      ${body.manufactureYear || null}, ${body.installYear || null}, ${body.serialNumber || null},
      ${body.inventoryNumber || null}, ${body.photonEnergies || null}, ${body.electronEnergies || null},
      ${body.mlcType || null}, ${!!body.epid}, ${!!body.cbct},
      ${body.recordVerifySystem || null}, ${body.tpsAssociated || null}, ${body.room || null},
      ${body.operationalStatus || "activo"}
    )
    RETURNING id;
  `;
  await logLinacAudit("create_linac_unit", actorEmail, { id: rows[0]!.id, brand: body.brand, model: body.model });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}
