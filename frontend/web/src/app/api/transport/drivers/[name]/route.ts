import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTransportTables } from "@/lib/transport";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  await ensureTransportTables();
  const { name: nameParam } = await params;
  const name = decodeURIComponent(nameParam);

  const { rows } = await sql`
    SELECT id, transport_date, correlative_number, material_code, it_value
    FROM transport_shipments
    WHERE driver_name = ${name}
    ORDER BY transport_date DESC;
  `;

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, driver: null });
  }

  const { rows: driverRows } = await sql`SELECT name, company FROM transport_drivers WHERE name = ${name};`;
  const company = driverRows[0]?.company || null;

  const dates = rows.map((r: any) => r.transport_date).sort();
  const firstTransport = dates[0];
  const lastTransport = dates[dates.length - 1];

  const byYear: Record<string, number> = {};
  for (const r of rows as any[]) {
    const year = String(r.transport_date).slice(0, 4);
    byYear[year] = (byYear[year] || 0) + 1;
  }
  const years = Object.keys(byYear);
  const avgPerYear = years.length > 0 ? Math.round((rows.length / years.length) * 10) / 10 : 0;

  return NextResponse.json({
    ok: true,
    driver: {
      name,
      company,
      totalTransports: rows.length,
      firstTransport,
      lastTransport,
      avgPerYear,
      history: rows,
    },
  });
}
