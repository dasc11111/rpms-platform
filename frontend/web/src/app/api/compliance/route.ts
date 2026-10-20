import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureComplianceTables, type ComplianceFormInput } from "@/lib/compliance";

export const dynamic = "force-dynamic";

// GET /api/compliance?category=&status=&priority=&limit=
export async function GET(req: NextRequest) {
  try {
    await ensureComplianceTables();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") ?? "";
    const status = searchParams.get("status") ?? "";
    const priority = searchParams.get("priority") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10), 500);

    let query = "SELECT * FROM compliance_requirements WHERE TRUE";
    const params: unknown[] = [];
    let idx = 1;
    if (category) { query += " AND category = $" + idx++; params.push(category); }
    if (status) { query += " AND status = $" + idx++; params.push(status); }
    if (priority) { query += " AND priority = $" + idx++; params.push(priority); }
    query += " ORDER BY CASE priority WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, next_review_date ASC NULLS LAST LIMIT $" + idx;
    params.push(limit);

    const { rows } = await sql.query(query, params);

    const { rows: stats } = await sql`
      SELECT status, COUNT(*) AS n FROM compliance_requirements GROUP BY status
    `;

    return NextResponse.json({ data: rows, stats, total: rows.length });
  } catch (err) {
    console.error("[compliance GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/compliance
export async function POST(req: NextRequest) {
  try {
    await ensureComplianceTables();
    const body: ComplianceFormInput = await req.json();

    const { rows } = await sql`
      INSERT INTO compliance_requirements
        (code, requirement, regulation, article_ref, category, priority, owner,
         review_frequency, last_review_date, next_review_date, status,
         evidence_description, notes)
      VALUES
        (${body.code}, ${body.requirement}, ${body.regulation},
         ${body.article_ref ?? null}, ${body.category}, ${body.priority},
         ${body.owner}, ${body.review_frequency},
         ${body.last_review_date ?? null}, ${body.next_review_date ?? null},
         ${body.status}, ${body.evidence_description ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[compliance POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/compliance?id=
export async function PATCH(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const body: Partial<ComplianceFormInput> & { status?: string } = await req.json();

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: (keyof ComplianceFormInput)[] = [
      "requirement", "regulation", "article_ref", "category", "priority",
      "owner", "review_frequency", "last_review_date", "next_review_date",
      "status", "evidence_description", "notes",
    ];
    for (const f of fields) {
      if (f in body) { sets.push(f + " = $" + idx++); params.push((body as Record<string, unknown>)[f] ?? null); }
    }
    if (sets.length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    sets.push("updated_at = NOW()");
    params.push(id);

    const { rows } = await sql.query(
      "UPDATE compliance_requirements SET " + sets.join(", ") + " WHERE id = $" + idx + " RETURNING *",
      params
    );
    if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[compliance PATCH]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
