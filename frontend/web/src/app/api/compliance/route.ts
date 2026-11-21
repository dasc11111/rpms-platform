import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const regulation = searchParams.get("regulation");

  try {
    const rows = status
      ? (await sql`
          SELECT id, requirement, regulation, owner, service,
                 frequency_months, last_review_date::text, next_review_date::text,
                 status, notes, created_at::text, updated_at::text
          FROM compliance_requirements
          WHERE status = ${status}
          ORDER BY next_review_date ASC NULLS LAST
        `).rows
      : regulation
      ? (await sql`
          SELECT id, requirement, regulation, owner, service,
                 frequency_months, last_review_date::text, next_review_date::text,
                 status, notes, created_at::text, updated_at::text
          FROM compliance_requirements
          WHERE regulation ILIKE ${"%" + regulation + "%"}
          ORDER BY next_review_date ASC NULLS LAST
        `).rows
      : (await sql`
          SELECT id, requirement, regulation, owner, service,
                 frequency_months, last_review_date::text, next_review_date::text,
                 status, notes, created_at::text, updated_at::text
          FROM compliance_requirements
          ORDER BY
            CASE status WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END,
            next_review_date ASC NULLS LAST
        `).rows;

    return NextResponse.json({ data: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      requirement: string;
      regulation: string;
      owner?: string;
      service?: string;
      frequency_months?: number;
      last_review_date?: string;
      next_review_date?: string;
      status?: string;
      notes?: string;
    };
    const {
      requirement, regulation, owner, service,
      frequency_months, last_review_date, next_review_date,
      status, notes,
    } = body;

    const r = await sql`
      INSERT INTO compliance_requirements (
        requirement, regulation, owner, service,
        frequency_months, last_review_date, next_review_date, status, notes
      ) VALUES (
        ${requirement}, ${regulation}, ${owner ?? null}, ${service ?? null},
        ${frequency_months ?? null}, ${last_review_date ?? null},
        ${next_review_date ?? null}, ${status ?? "pending"}, ${notes ?? null}
      )
      RETURNING id
    `;
    return NextResponse.json({ id: (r.rows[0] as { id: number }).id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: number;
      status?: string;
      last_review_date?: string;
      next_review_date?: string;
      notes?: string;
    };
    const { id, status, last_review_date, next_review_date, notes } = body;

    await sql`
      UPDATE compliance_requirements
      SET
        status = COALESCE(${status ?? null}, status),
        last_review_date = COALESCE(${last_review_date ?? null}::date, last_review_date),
        next_review_date = COALESCE(${next_review_date ?? null}::date, next_review_date),
        notes = COALESCE(${notes ?? null}, notes),
        updated_at = now()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
