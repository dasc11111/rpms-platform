import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);

  try {
    const { rows } = status
      ? await sql`
          SELECT * FROM radiopharmaceuticals
          WHERE status = ${status}
          ORDER BY expiry_datetime ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM radiopharmaceuticals
          ORDER BY expiry_datetime ASC
          LIMIT ${limit}
        `;
    return NextResponse.json({ radiopharmaceuticals: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name: string;
      isotope: string;
      half_life_days: number;
      batch_number: string;
      supplier?: string;
      activity_bq: number;
      calibration_datetime: string;
      expiry_datetime: string;
      volume_ml?: number;
      status?: string;
      service?: string;
      notes?: string;
    };

    const concentration =
      body.volume_ml && body.volume_ml > 0 ? body.activity_bq / body.volume_ml : null;

    const { rows } = await sql`
      INSERT INTO radiopharmaceuticals (
        name, isotope, half_life_days, batch_number, supplier,
        activity_bq, calibration_datetime, expiry_datetime,
        volume_ml, concentration_bq_ml, status, service, notes
      ) VALUES (
        ${body.name}, ${body.isotope}, ${body.half_life_days},
        ${body.batch_number}, ${body.supplier ?? null},
        ${body.activity_bq}, ${body.calibration_datetime}, ${body.expiry_datetime},
        ${body.volume_ml ?? null}, ${concentration},
        ${body.status ?? "active"}, ${body.service ?? null}, ${body.notes ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json({ radiopharmaceutical: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
