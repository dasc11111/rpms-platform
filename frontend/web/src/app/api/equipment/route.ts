import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, name, type, model, serial_number, service, room,
             status, last_qa_date::text, next_qa_date::text,
             qa_frequency_months, last_maintenance_date::text,
             next_maintenance_date::text, notes
      FROM equipment
      ORDER BY name
    `;
    return NextResponse.json({ equipment: rows });
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
      INSERT INTO equipment (name, type, model, serial_number, service, room, status,
                             last_qa_date, next_qa_date, qa_frequency_months)
      VALUES (
        ${name}, ${type},
        ${body.model ? String(body.model) : null},
        ${body.serial_number ? String(body.serial_number) : null},
        ${body.service ? String(body.service) : null},
        ${body.room ? String(body.room) : null},
        ${String(body.status ?? "operational")},
        ${body.last_qa_date ? String(body.last_qa_date) : null},
        ${body.next_qa_date ? String(body.next_qa_date) : null},
        ${body.qa_frequency_months ? Number(body.qa_frequency_months) : 3}
      )
      RETURNING id, name, type, status
    `;
    return NextResponse.json({ equipment: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
