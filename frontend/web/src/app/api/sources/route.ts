import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);

  try {
    const { rows } = status
      ? await sql`
          SELECT * FROM radioactive_sources
          WHERE status = ${status}
          ORDER BY next_inventory_date ASC NULLS LAST
          LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM radioactive_sources
          ORDER BY next_inventory_date ASC NULLS LAST
          LIMIT ${limit}
        `;
    return NextResponse.json({ sources: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      source_code: string;
      isotope: string;
      half_life_days: number;
      activity_bq_initial: number;
      activity_reference_date: string;
      category_iaea?: number;
      manufacturer?: string;
      serial_number?: string;
      location?: string;
      status?: string;
      next_inventory_date?: string;
      notes?: string;
    };

    const { rows } = await sql`
      INSERT INTO radioactive_sources (
        source_code, isotope, half_life_days, activity_bq_initial, activity_reference_date,
        category_iaea, manufacturer, serial_number, location, status,
        next_inventory_date, notes
      ) VALUES (
        ${body.source_code}, ${body.isotope}, ${body.half_life_days},
        ${body.activity_bq_initial}, ${body.activity_reference_date},
        ${body.category_iaea ?? null}, ${body.manufacturer ?? null},
        ${body.serial_number ?? null}, ${body.location ?? null},
        ${body.status ?? "in_use"}, ${body.next_inventory_date ?? null},
        ${body.notes ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json({ source: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
