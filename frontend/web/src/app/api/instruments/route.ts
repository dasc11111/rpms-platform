import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, name, type, serial_number, model,
             last_calibration_date::text, next_calibration_date::text,
             calibration_frequency_months, status, certificate_number, notes
      FROM instruments
      ORDER BY next_calibration_date ASC NULLS LAST
    `;
    return NextResponse.json({ instruments: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const type = String(body.type ?? "").trim();
    if (!name || !type) return NextResponse.json({ error: "name y type requeridos" }, { status: 400 });

    const { rows } = await sql`
      INSERT INTO instruments (name, type, serial_number, model,
                               last_calibration_date, next_calibration_date,
                               calibration_frequency_months, status, certificate_number)
      VALUES (
        ${name}, ${type},
        ${body.serial_number ? String(body.serial_number) : null},
        ${body.model ? String(body.model) : null},
        ${body.last_calibration_date ? String(body.last_calibration_date) : null},
        ${body.next_calibration_date ? String(body.next_calibration_date) : null},
        ${body.calibration_frequency_months ? Number(body.calibration_frequency_months) : 12},
        ${String(body.status ?? "ok")},
        ${body.certificate_number ? String(body.certificate_number) : null}
      )
      RETURNING id, name, type, status
    `;
    return NextResponse.json({ instrument: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
