import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const equipment = searchParams.get("equipment");
  const passFilter = searchParams.get("status"); // "pass" | "fail" | null
  const type = searchParams.get("type");

  try {
    // Build query with conditional filters using template literal branches
    const rows = equipment && type
      ? (await sql`
          SELECT id, equipment_id, equipment_name, qc_type, performed_at::text,
                 performed_by, result, pass, notes, values_json,
                 next_due_at::text, created_at::text
          FROM qc_records
          WHERE equipment_id = ${equipment} AND qc_type = ${type}
          ORDER BY performed_at DESC LIMIT 200
        `).rows
      : equipment
      ? (await sql`
          SELECT id, equipment_id, equipment_name, qc_type, performed_at::text,
                 performed_by, result, pass, notes, values_json,
                 next_due_at::text, created_at::text
          FROM qc_records
          WHERE equipment_id = ${equipment}
          ORDER BY performed_at DESC LIMIT 200
        `).rows
      : type
      ? (await sql`
          SELECT id, equipment_id, equipment_name, qc_type, performed_at::text,
                 performed_by, result, pass, notes, values_json,
                 next_due_at::text, created_at::text
          FROM qc_records
          WHERE qc_type = ${type}
          ORDER BY performed_at DESC LIMIT 200
        `).rows
      : (await sql`
          SELECT id, equipment_id, equipment_name, qc_type, performed_at::text,
                 performed_by, result, pass, notes, values_json,
                 next_due_at::text, created_at::text
          FROM qc_records
          ORDER BY performed_at DESC LIMIT 200
        `).rows;

    const filtered = passFilter === "pass"
      ? rows.filter((r: { pass: boolean }) => r.pass)
      : passFilter === "fail"
      ? rows.filter((r: { pass: boolean }) => !r.pass)
      : rows;

    return NextResponse.json({ data: filtered });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      equipment_id: string;
      equipment_name: string;
      qc_type: string;
      performed_at?: string;
      performed_by: string;
      result?: string;
      pass?: boolean;
      notes?: string;
      values_json?: Record<string, unknown>;
      next_due_at?: string;
    };
    const {
      equipment_id,
      equipment_name,
      qc_type,
      performed_at,
      performed_by,
      result,
      notes,
      values_json,
      next_due_at,
    } = body;
    const passVal = body.pass ?? true;

    const r = await sql`
      INSERT INTO qc_records (
        equipment_id, equipment_name, qc_type, performed_at,
        performed_by, result, pass, notes, values_json, next_due_at
      ) VALUES (
        ${equipment_id}, ${equipment_name}, ${qc_type},
        ${performed_at ?? new Date().toISOString()},
        ${performed_by}, ${result ?? null}, ${passVal},
        ${notes ?? null}, ${values_json ? JSON.stringify(values_json) : null},
        ${next_due_at ?? null}
      )
      RETURNING id
    `;
    return NextResponse.json({ id: r.rows[0]!.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
