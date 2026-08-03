import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  await ensureLinacTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  const { rows } = await sql`SELECT * FROM linac_units WHERE id = ${id}`;
  if (!rows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, unit: rows[0] });
}

export async function PATCH(request, { params }) {
  await ensureLinacTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = await request.json();
  const actorEmail = body.actorEmail || null;
  await sql`
    UPDATE linac_units SET
      brand = ${body.brand || null},
      model = ${body.model || null},
      manufacturer = ${body.manufacturer || null},
      manufacture_year = ${body.manufactureYear || null},
      install_year = ${body.installYear || null},
      serial_number = ${body.serialNumber || null},
      inventory_number = ${body.inventoryNumber || null},
      photon_energies = ${body.photonEnergies || null},
      electron_energies = ${body.electronEnergies || null},
      mlc_type = ${body.mlcType || null},
      epid = ${!!body.epid},
      cbct = ${!!body.cbct},
      record_verify_system = ${body.recordVerifySystem || null},
      tps_associated = ${body.tpsAssociated || null},
      room = ${body.room || null},
      operational_status = ${body.operationalStatus || "activo"},
      updated_at = now()
    WHERE id = ${id}
  `;
  await logLinacAudit("update_linac_unit", actorEmail, { id, changes: body });
  return NextResponse.json({ ok: true });
}
