import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const equipment = searchParams.get("equipment");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  try {
    let query = `
      SELECT id, equipment_id, equipment_name, qc_type, performed_at::text,
             performed_by, result, pass, notes, values_json,
             next_due_at::text, created_at::text
      FROM qc_records
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let idx = 1;

    if (equipment) {
      query += ` AND equipment_id = $${idx++}`;
      params.push(equipment);
    }
    if (status === "pass") {
      query += ` AND pass = true`;
    } else if (status === "fail") {
      query += ` AND pass = false`;
    }
    if (type) {
      query += ` AND qc_type = $${idx++}`;
      params.push(type);
    }

    query += ` ORDER BY performed_at DESC LIMIT 200`;

    const result = await sql.query(query, params);
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      equipment_id,
      equipment_name,
      qc_type,
      performed_at,
      performed_by,
      result,
      pass,
      notes,
      values_json,
      next_due_at,
    } = body;

    const r = await sql`
      INSERT INTO qc_records (
        equipment_id, equipment_name, qc_type, performed_at,
        performed_by, result, pass, notes, values_json, next_due_at
      ) VALUES (
        ${equipment_id}, ${equipment_name}, ${qc_type},
        ${performed_at ?? new Date().toISOString()},
        ${performed_by}, ${result}, ${pass ?? true},
        ${notes ?? null}, ${values_json ? JSON.stringify(values_json) : null},
        ${next_due_at ?? null}
      )
      RETURNING id
    `;
    return NextResponse.json({ id: r.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
