import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT * FROM shielding
      ORDER BY next_measurement_date ASC NULLS LAST, room
    `;
    return NextResponse.json({ shielding: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name: string;
      room: string;
      service?: string;
      material?: string;
      thickness_mm?: number;
      lead_equivalent_mm?: number;
      design_dose_rate_usv_h?: number;
      measured_dose_rate_usv_h?: number;
      last_measurement_date?: string;
      next_measurement_date?: string;
      status?: string;
      notes?: string;
    };

    const { rows } = await sql`
      INSERT INTO shielding (
        name, room, service, material, thickness_mm, lead_equivalent_mm,
        design_dose_rate_usv_h, measured_dose_rate_usv_h,
        last_measurement_date, next_measurement_date, status, notes
      ) VALUES (
        ${body.name}, ${body.room}, ${body.service ?? null},
        ${body.material ?? "Pb"}, ${body.thickness_mm ?? null},
        ${body.lead_equivalent_mm ?? null}, ${body.design_dose_rate_usv_h ?? null},
        ${body.measured_dose_rate_usv_h ?? null}, ${body.last_measurement_date ?? null},
        ${body.next_measurement_date ?? null}, ${body.status ?? "ok"}, ${body.notes ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json({ shielding: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id: number;
      measured_dose_rate_usv_h?: number;
      last_measurement_date?: string;
      next_measurement_date?: string;
      status?: string;
      notes?: string;
    };

    const { rows } = await sql`
      UPDATE shielding SET
        measured_dose_rate_usv_h = COALESCE(${body.measured_dose_rate_usv_h ?? null}, measured_dose_rate_usv_h),
        last_measurement_date = COALESCE(${body.last_measurement_date ?? null}::date, last_measurement_date),
        next_measurement_date = COALESCE(${body.next_measurement_date ?? null}::date, next_measurement_date),
        status = COALESCE(${body.status ?? null}, status),
        notes = COALESCE(${body.notes ?? null}, notes),
        updated_at = now()
      WHERE id = ${body.id}
      RETURNING *
    `;
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ shielding: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
