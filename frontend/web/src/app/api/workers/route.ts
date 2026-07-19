import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows } = await sql`
    SELECT rut, name, role, service, category, status, annual_dose
    FROM workers
    ORDER BY name ASC
  `;
  return NextResponse.json({ workers: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];

  let inserted = 0;
  for (const r of rows) {
    const rut = String(r.rut ?? "").trim();
    const name = String(r.name ?? r.nombre ?? "").trim();
    if (!rut || !name) continue;

    const role = String(r.role ?? r.cargo ?? "").trim() || null;
    const service = String(r.service ?? r.servicio ?? "").trim() || null;
    const category = String(r.category ?? r.categoria ?? "").trim() || null;
    const status = (String(r.status ?? r.estado ?? "active").trim().toLowerCase()) || "active";
    const annualDose = Number(r.annual_dose ?? r.annualDose ?? r.dosis_anual ?? 0) || 0;

    await sql`
      INSERT INTO workers (rut, name, role, service, category, status, annual_dose)
      VALUES (${rut}, ${name}, ${role}, ${service}, ${category}, ${status}, ${annualDose})
      ON CONFLICT (rut) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        service = EXCLUDED.service,
        category = EXCLUDED.category,
        status = EXCLUDED.status,
        annual_dose = EXCLUDED.annual_dose;
    `;
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted });
}
