import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";
import { NextRequest } from "next/server";

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


export async function PATCH(request: NextRequest) {
  await ensureLinacTables();
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`
    UPDATE linac_units SET
      brand = COALESCE(${body.brand ?? null}, brand),
      model = COALESCE(${body.model ?? null}, model),
      manufacturer = COALESCE(${body.manufacturer ?? null}, manufacturer),
      manufacture_year = COALESCE(${body.manufactureYear ?? null}, manufacture_year),
      install_year = COALESCE(${body.installYear ?? null}, install_year),
      serial_number = COALESCE(${body.serialNumber ?? null}, serial_number),
      inventory_number = COALESCE(${body.inventoryNumber ?? null}, inventory_number),
      photon_energies = COALESCE(${body.photonEnergies ?? null}, photon_energies),
      electron_energies = COALESCE(${body.electronEnergies ?? null}, electron_energies),
      mlc_type = COALESCE(${body.mlcType ?? null}, mlc_type),
      epid = COALESCE(${body.epid != null ? !!body.epid : null}::boolean, epid),
      cbct = COALESCE(${body.cbct != null ? !!body.cbct : null}::boolean, cbct),
      record_verify_system = COALESCE(${body.recordVerifySystem ?? null}, record_verify_system),
      tps_associated = COALESCE(${body.tpsAssociated ?? null}, tps_associated),
      room = COALESCE(${body.room ?? null}, room),
      operational_status = COALESCE(${body.operationalStatus ?? null}, operational_status)
    WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Unidad LINAC no encontrada." }, { status: 404 });
  await logLinacAudit("update_linac_unit", body.actorEmail || null, { id });
  return NextResponse.json({ ok: true, unit: rows[0] });
}

export async function DELETE(request: NextRequest) {
  await ensureLinacTables();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "id es obligatorio." }, { status: 400 });
  const { rows } = await sql`UPDATE linac_units SET operational_status = 'eliminado' WHERE id = ${id} RETURNING id, brand, model`;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "Unidad LINAC no encontrada." }, { status: 404 });
  await logLinacAudit("delete_linac_unit", null, { id });
  return NextResponse.json({ ok: true, deleted: rows[0] });
}
