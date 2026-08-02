import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTransportTables, computeShipmentAlerts, logTransportAudit } from "@/lib/transport";

export const dynamic = "force-dynamic";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

async function loadShipment(id: number) {
  const { rows } = await sql`
    SELECT s.*,
      COALESCE(
        (SELECT json_agg(json_build_object('id', a.id, 'label', a.label, 'activityMci', a.activity_mci) ORDER BY a.id)
         FROM transport_i131_activities a WHERE a.shipment_id = s.id),
        '[]'
      ) AS i131_activities
    FROM transport_shipments s
    WHERE s.id = ${id};
  `;
  const r = rows[0];
  if (!r) return null;
  const alerts = computeShipmentAlerts({
    dose_1m: toNum(r.dose_1m),
    dose_vehicle: toNum(r.dose_vehicle),
    signage_dosimeter: r.signage_dosimeter,
    signage_radiactivo7: r.signage_radiactivo7,
    signage_nu2915: r.signage_nu2915,
    driver_name: r.driver_name,
    opr_name: r.opr_name,
  });
  return {
    id: r.id,
    transportDate: r.transport_date,
    correlativeNumber: r.correlative_number,
    itValue: toNum(r.it_value),
    doseContact: toNum(r.dose_contact),
    dose1m: toNum(r.dose_1m),
    doseVehicle: toNum(r.dose_vehicle),
    materialCode: r.material_code,
    requestedActivityMci: toNum(r.requested_activity_mci),
    i131Activities: (r.i131_activities || []).map((a: any) => ({
      id: a.id,
      label: a.label,
      activityMci: toNum(a.activityMci),
    })),
    driverName: r.driver_name,
    oprName: r.opr_name,
    signageDosimeter: r.signage_dosimeter,
    signageRadiactivo7: r.signage_radiactivo7,
    signageNu2915: r.signage_nu2915,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    alerts,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureTransportTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const shipment = await loadShipment(id);
  if (!shipment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, shipment });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureTransportTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const existing = await loadShipment(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const actorEmail = body.actorEmail ? String(body.actorEmail) : null;

  const correlativeNumber = body.correlativeNumber !== undefined ? Number(body.correlativeNumber) : existing.correlativeNumber;
  const itValue = body.itValue !== undefined ? toNum(body.itValue) : existing.itValue;
  const doseContact = body.doseContact !== undefined ? toNum(body.doseContact) : existing.doseContact;
  const dose1m = body.dose1m !== undefined ? toNum(body.dose1m) : existing.dose1m;
  const doseVehicle = body.doseVehicle !== undefined ? toNum(body.doseVehicle) : existing.doseVehicle;
  const materialCode = body.materialCode !== undefined ? String(body.materialCode) : existing.materialCode;
  const requestedActivityMci = body.requestedActivityMci !== undefined ? toNum(body.requestedActivityMci) : existing.requestedActivityMci;
  const driverName = body.driverName !== undefined ? (body.driverName ? String(body.driverName).trim() : null) : existing.driverName;
  const oprName = body.oprName !== undefined ? (body.oprName ? String(body.oprName).trim() : null) : existing.oprName;
  const signageDosimeter = body.signageDosimeter !== undefined ? Boolean(body.signageDosimeter) : existing.signageDosimeter;
  const signageRadiactivo7 = body.signageRadiactivo7 !== undefined ? Boolean(body.signageRadiactivo7) : existing.signageRadiactivo7;
  const signageNu2915 = body.signageNu2915 !== undefined ? Boolean(body.signageNu2915) : existing.signageNu2915;
  const notes = body.notes !== undefined ? String(body.notes || "") : existing.notes;

  await sql`
    UPDATE transport_shipments SET
      correlative_number = ${correlativeNumber},
      it_value = ${itValue},
      dose_contact = ${doseContact},
      dose_1m = ${dose1m},
      dose_vehicle = ${doseVehicle},
      material_code = ${materialCode},
      requested_activity_mci = ${requestedActivityMci},
      driver_name = ${driverName},
      opr_name = ${oprName},
      signage_dosimeter = ${signageDosimeter},
      signage_radiactivo7 = ${signageRadiactivo7},
      signage_nu2915 = ${signageNu2915},
      notes = ${notes},
      updated_at = now()
    WHERE id = ${id};
  `;

  if (Array.isArray(body.i131Activities)) {
    await sql`DELETE FROM transport_i131_activities WHERE shipment_id = ${id};`;
    for (const act of body.i131Activities) {
      const activityMci = toNum(act.activityMci);
      if (activityMci === null) continue;
      await sql`
        INSERT INTO transport_i131_activities (shipment_id, label, activity_mci)
        VALUES (${id}, ${act.label || null}, ${activityMci});
      `;
    }
  }

  if (driverName) {
    await sql`INSERT INTO transport_drivers (name) VALUES (${driverName}) ON CONFLICT (name) DO NOTHING;`;
  }
  if (oprName) {
    await sql`INSERT INTO transport_oprs (name) VALUES (${oprName}) ON CONFLICT (name) DO NOTHING;`;
  }

  await logTransportAudit("update_shipment", actorEmail, { shipmentId: id, before: existing, afterPatch: body });

  const updated = await loadShipment(id);
  return NextResponse.json({ ok: true, shipment: updated });
}
