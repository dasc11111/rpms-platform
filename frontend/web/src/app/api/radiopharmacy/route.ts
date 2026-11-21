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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, isotope, batch_number, supplier, activity_bq, calibration_datetime,
            expiry_datetime, volume_ml, status, service, notes } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const concentration = volume_ml && volume_ml > 0 ? activity_bq / volume_ml : null;

    const { rows } = await sql`
      UPDATE radiopharmaceuticals SET
        name                  = COALESCE(${name ?? null}, name),
        isotope               = COALESCE(${isotope ?? null}, isotope),
        batch_number          = COALESCE(${batch_number ?? null}, batch_number),
        supplier              = COALESCE(${supplier ?? null}, supplier),
        activity_bq           = COALESCE(${activity_bq ?? null}, activity_bq),
        calibration_datetime  = COALESCE(${calibration_datetime ?? null}::timestamptz, calibration_datetime),
        expiry_datetime       = COALESCE(${expiry_datetime ?? null}::timestamptz, expiry_datetime),
        volume_ml             = COALESCE(${volume_ml ?? null}, volume_ml),
        concentration_bq_ml   = COALESCE(${concentration}, concentration_bq_ml),
        status                = COALESCE(${status ?? null}, status),
        service               = COALESCE(${service ?? null}, service),
        notes                 = COALESCE(${notes ?? null}, notes),
        updated_at            = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    return NextResponse.json({ radiopharmaceutical: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await sql`UPDATE radiopharmaceuticals SET status = 'expired', updated_at = NOW() WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
