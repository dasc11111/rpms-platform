import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workerRut = searchParams.get("worker_rut");
  const status = searchParams.get("status");

  try {
    const { rows } = workerRut
      ? await sql`
          SELECT d.*, w.name AS worker_name_ref
          FROM dosimeters d
          LEFT JOIN workers w ON w.rut = d.worker_rut
          WHERE d.worker_rut = ${workerRut}
          ORDER BY d.issued_at DESC
        `
      : status
        ? await sql`
            SELECT d.*, w.name AS worker_name_ref
            FROM dosimeters d
            LEFT JOIN workers w ON w.rut = d.worker_rut
            WHERE d.status = ${status}
            ORDER BY d.issued_at DESC
            LIMIT 200
          `
        : await sql`
            SELECT d.*, w.name AS worker_name_ref
            FROM dosimeters d
            LEFT JOIN workers w ON w.rut = d.worker_rut
            ORDER BY d.issued_at DESC
            LIMIT 200
          `;
    return NextResponse.json({ dosimeters: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      worker_rut: string;
      worker_name?: string;
      dosimeter_type?: string;
      serial_code?: string;
      issued_at?: string;
      notes?: string;
    };

    const { rows } = await sql`
      INSERT INTO dosimeters (worker_rut, worker_name, dosimeter_type, serial_code, issued_at, notes)
      VALUES (
        ${body.worker_rut}, ${body.worker_name ?? null},
        ${body.dosimeter_type ?? "TLD"}, ${body.serial_code ?? null},
        ${body.issued_at ?? null}, ${body.notes ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json({ dosimeter: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id: number;
      status: "active" | "returned" | "lost" | "damaged";
      returned_at?: string;
      notes?: string;
    };

    const { rows } = await sql`
      UPDATE dosimeters SET
        status = ${body.status},
        returned_at = COALESCE(${body.returned_at ?? null}::date, returned_at),
        notes = COALESCE(${body.notes ?? null}, notes),
        updated_at = now()
      WHERE id = ${body.id}
      RETURNING *
    `;
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ dosimeter: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
