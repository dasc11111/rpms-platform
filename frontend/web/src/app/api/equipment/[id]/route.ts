/**
 * API de Equipos Radiológicos — PATCH / DELETE por ID
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { rows } = await sql`
      UPDATE radiology_equipment SET
        inventory_number = ${body.inventoryNumber ?? ""},
        service = ${body.service ?? ""},
        unit = ${body.unit ?? ""},
        location = ${body.location ?? ""},
        equipment_name = ${body.equipmentName ?? ""},
        brand = ${body.brand ?? ""},
        model = ${body.model ?? ""},
        equipment_serial_number = ${body.equipmentSerialNumber ?? ""},
        tube_serial_number = ${body.tubeSerialNumber ?? ""},
        resolution_number = ${body.resolutionNumber ?? ""},
        resolution_date = ${body.resolutionDate || null},
        authorization_status = ${body.authorizationStatus ?? "vigente"},
        observations = ${body.observations ?? ""},
        status = ${body.status ?? "operativo"},
        last_modified_by = ${body.lastModifiedBy ?? "Sistema"},
        documents = ${JSON.stringify(body.documents ?? [])}::jsonb,
        history = ${JSON.stringify(body.history ?? [])}::jsonb,
        alerts = ${JSON.stringify(body.alerts ?? [])}::jsonb,
        updated_at = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = rows[0] as Record<string, unknown>;
    return NextResponse.json({
      id: String(r.id),
      inventoryNumber: r.inventory_number ?? "",
      service: r.service ?? "",
      unit: r.unit ?? "",
      location: r.location ?? "",
      equipmentName: r.equipment_name ?? "",
      brand: r.brand ?? "",
      model: r.model ?? "",
      equipmentSerialNumber: r.equipment_serial_number ?? "",
      tubeSerialNumber: r.tube_serial_number ?? "",
      resolutionNumber: r.resolution_number ?? "",
      resolutionDate: r.resolution_date ? String(r.resolution_date).slice(0, 10) : "",
      authorizationStatus: r.authorization_status ?? "vigente",
      observations: r.observations ?? "",
      status: r.status ?? "operativo",
      lastModifiedBy: r.last_modified_by ?? "Sistema",
      documents: (r.documents as unknown[]) ?? [],
      history: (r.history as unknown[]) ?? [],
      alerts: (r.alerts as unknown[]) ?? [],
      createdAt: r.created_at ? String(r.created_at).slice(0, 10) : "",
      updatedAt: r.updated_at ? String(r.updated_at).slice(0, 10) : "",
    });
  } catch (err) {
    console.error("PATCH /api/equipment/[id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await sql`DELETE FROM radiology_equipment WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/equipment/[id]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
