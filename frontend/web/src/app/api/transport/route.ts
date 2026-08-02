import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ensureTransportTables,
  computeShipmentAlerts,
  nextCorrelativeNumber,
  logTransportAudit,
} from "@/lib/transport";

export const dynamic = "force-dynamic";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function GET(request: Request) {
  await ensureTransportTables();
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const day = searchParams.get("day") || "";
  const month = searchParams.get("month") || "";
  const year = searchParams.get("year") || "";
  const material = searchParams.get("material") || "";
  const opr = (searchParams.get("opr") || "").trim();

  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (dateFrom) {
    conditions.push(`s.transport_date >= $${i++}`);
    values.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`s.transport_date <= $${i++}`);
    values.push(dateTo);
  }
  if (day) {
    conditions.push(`EXTRACT(DAY FROM s.transport_date) = $${i++}`);
    values.push(Number(day));
  }
  if (month) {
    conditions.push(`EXTRACT(MONTH FROM s.transport_date) = $${i++}`);
    values.push(Number(month));
  }
  if (year) {
    conditions.push(`EXTRACT(YEAR FROM s.transport_date) = $${i++}`);
    values.push(Number(year));
  }
  if (material) {
    conditions.push(`s.material_code = $${i++}`);
    values.push(material);
  }
  if (opr) {
    conditions.push(`s.opr_name ILIKE $${i++}`);
    values.push(`%${opr}%`);
  }
  if (search) {
    conditions.push(
      `(s.driver_name ILIKE $${i} OR s.opr_name ILIKE $${i} OR s.material_code ILIKE $${i} OR CAST(s.correlative_number AS TEXT) ILIKE $${i} OR CAST(s.it_value AS TEXT) ILIKE $${i} OR CAST(s.transport_date AS TEXT) ILIKE $${i})`
    );
    values.push(`%${search}%`);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT s.*,
      COALESCE(
        (SELECT json_agg(json_build_object('id', a.id, 'label', a.label, 'activityMci', a.activity_mci) ORDER BY a.id)
         FROM transport_i131_activities a WHERE a.shipment_id = s.id),
        '[]'
      ) AS i131_activities
    FROM transport_shipments s
    ${where}
    ORDER BY s.transport_date DESC, s.correlative_number DESC
    LIMIT 2000
  `;

  const { rows } = await sql.query(query, values);

  const shipments = rows.map((r: any) => {
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
  });

  return NextResponse.json({ ok: true, shipments });
}

export async function POST(request: Request) {
  await ensureTransportTables();
  const body = await request.json().catch(() => ({}));

  const transportDate = String(body.transportDate || "").trim();
  if (!transportDate) {
    return NextResponse.json({ error: "transportDate_required" }, { status: 400 });
  }
  const materialCode = String(body.materialCode || "").trim();
  if (!materialCode) {
    return NextResponse.json({ error: "materialCode_required" }, { status: 400 });
  }

  const correlativeNumber = body.correlativeNumber
    ? Number(body.correlativeNumber)
    : await nextCorrelativeNumber();

  const itValue = toNum(body.itValue);
  const doseContact = toNum(body.doseContact);
  const dose1m = toNum(body.dose1m);
  const doseVehicle = toNum(body.doseVehicle);
  const requestedActivityMci = toNum(body.requestedActivityMci);
  const driverName = body.driverName ? String(body.driverName).trim() : null;
  const oprName = body.oprName ? String(body.oprName).trim() : null;
  const signageDosimeter = Boolean(body.signageDosimeter);
  const signageRadiactivo7 = Boolean(body.signageRadiactivo7);
  const signageNu2915 = Boolean(body.signageNu2915);
  const notes = body.notes ? String(body.notes) : null;
  const actorEmail = body.actorEmail ? String(body.actorEmail) : null;
  const i131Activities: Array<{ label?: string; activityMci: number }> = Array.isArray(body.i131Activities)
    ? body.i131Activities
    : [];

  const { rows } = await sql`
    INSERT INTO transport_shipments (
      transport_date, correlative_number, it_value, dose_contact, dose_1m, dose_vehicle,
      material_code, requested_activity_mci, driver_name, opr_name,
      signage_dosimeter, signage_radiactivo7, signage_nu2915, notes, created_by
    ) VALUES (
      ${transportDate}, ${correlativeNumber}, ${itValue}, ${doseContact}, ${dose1m}, ${doseVehicle},
      ${materialCode}, ${requestedActivityMci}, ${driverName}, ${oprName},
      ${signageDosimeter}, ${signageRadiactivo7}, ${signageNu2915}, ${notes}, ${actorEmail}
    )
    RETURNING id;
  `;
  const shipmentId = rows[0]!.id;

  if (materialCode === "I131" && i131Activities.length > 0) {
    for (const act of i131Activities) {
      const activityMci = toNum(act.activityMci);
      if (activityMci === null) continue;
      await sql`
        INSERT INTO transport_i131_activities (shipment_id, label, activity_mci)
        VALUES (${shipmentId}, ${act.label || null}, ${activityMci});
      `;
    }
  }

  if (driverName) {
    await sql`
      INSERT INTO transport_drivers (name) VALUES (${driverName})
      ON CONFLICT (name) DO NOTHING;
    `;
  }
  if (oprName) {
    await sql`
      INSERT INTO transport_oprs (name) VALUES (${oprName})
      ON CONFLICT (name) DO NOTHING;
    `;
  }

  await logTransportAudit("create_shipment", actorEmail, {
    shipmentId,
    transportDate,
    correlativeNumber,
    materialCode,
  });

  return NextResponse.json({ ok: true, id: shipmentId });
}
