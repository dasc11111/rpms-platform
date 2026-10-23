/**
 * API de Equipos Radiológicos — DS 133/1984 MINSAL
 * Gestión de equipos generadores de radiación ionizante
 * con estado de autorización SEREMI y documentación asociada.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS radiology_equipment (
      id SERIAL PRIMARY KEY,
      inventory_number TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      equipment_name TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      equipment_serial_number TEXT NOT NULL DEFAULT '',
      tube_serial_number TEXT NOT NULL DEFAULT '',
      resolution_number TEXT NOT NULL DEFAULT '',
      resolution_date DATE,
      authorization_status TEXT NOT NULL DEFAULT 'vigente',
      observations TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'operativo',
      last_modified_by TEXT NOT NULL DEFAULT 'Sistema',
      documents JSONB NOT NULL DEFAULT '[]',
      history JSONB NOT NULL DEFAULT '[]',
      alerts JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function rowToEquipment(r: Record<string, unknown>) {
  return {
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
  };
}

export async function GET() {
  try {
    await ensureTable();
    const { rows } = await sql`
      SELECT * FROM radiology_equipment
      ORDER BY service ASC, equipment_name ASC
      LIMIT 2000
    `;
    return NextResponse.json(rows.map(rowToEquipment));
  } catch (err) {
    console.error("GET /api/equipment", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();

    const { rows } = await sql`
      INSERT INTO radiology_equipment (
        inventory_number, service, unit, location,
        equipment_name, brand, model,
        equipment_serial_number, tube_serial_number,
        resolution_number, resolution_date,
        authorization_status, observations, status,
        last_modified_by, documents, history, alerts
      ) VALUES (
        ${body.inventoryNumber ?? ""},
        ${body.service ?? ""},
        ${body.unit ?? ""},
        ${body.location ?? ""},
        ${body.equipmentName ?? ""},
        ${body.brand ?? ""},
        ${body.model ?? ""},
        ${body.equipmentSerialNumber ?? ""},
        ${body.tubeSerialNumber ?? ""},
        ${body.resolutionNumber ?? ""},
        ${body.resolutionDate || null},
        ${body.authorizationStatus ?? "vigente"},
        ${body.observations ?? ""},
        ${body.status ?? "operativo"},
        ${body.lastModifiedBy ?? "Sistema"},
        ${JSON.stringify(body.documents ?? [])}::jsonb,
        ${JSON.stringify(body.history ?? [])}::jsonb,
        ${JSON.stringify(body.alerts ?? [])}::jsonb
      )
      RETURNING *
    `;
    return NextResponse.json(rowToEquipment(rows[0] as Record<string, unknown>), { status: 201 });
  } catch (err) {
    console.error("POST /api/equipment", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
