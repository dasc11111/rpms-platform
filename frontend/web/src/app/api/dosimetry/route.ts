import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows } = await sql`
    SELECT worker_rut, worker_name, dosimeter_type, period, dose, status
    FROM dosimetry_readings
    ORDER BY period DESC, worker_name ASC
  `;
  return NextResponse.json({ readings: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];

  let inserted = 0;
  for (const r of rows) {
    const workerName = String(r.worker_name ?? r.worker ?? r.trabajador ?? "").trim();
    const period = String(r.period ?? r.periodo ?? "").trim();
    if (!workerName || !period) continue;

    const workerRut = String(r.worker_rut ?? r.rut ?? "").trim() || null;
    const dosimeterType = String(r.dosimeter_type ?? r.tipo ?? r.tipo_dosimetro ?? "").trim() || null;
    const dose = Number(r.dose ?? r.dosis ?? 0) || 0;
    const status = (String(r.status ?? r.estado ?? "read").trim().toLowerCase()) || "read";

    await sql`
      INSERT INTO dosimetry_readings (worker_rut, worker_name, dosimeter_type, period, dose, status)
      VALUES (${workerRut}, ${workerName}, ${dosimeterType}, ${period}, ${dose}, ${status})
      ON CONFLICT (worker_name, period, dosimeter_type) DO UPDATE SET
        dose = EXCLUDED.dose,
        status = EXCLUDED.status,
        worker_rut = EXCLUDED.worker_rut;
    `;
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted });
}
