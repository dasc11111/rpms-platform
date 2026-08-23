import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";

export const dynamic = "force-dynamic";

interface Params {
    params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
    await ensureActivimetroQcTables();
    const id = Number(params.id);
    const { rows } = await sql`SELECT * FROM qc_activimetro_tests WHERE id = ${id}`;
    if (!rows[0]) {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const { rows: readingRows } = await sql`
        SELECT * FROM qc_activimetro_readings WHERE test_id = ${id} ORDER BY reading_index ASC
          `;
    return NextResponse.json({ test: rows[0], readings: readingRows });
}

export async function PUT(request: Request, { params }: Params) {
    await ensureActivimetroQcTables();
    const id = Number(params.id);
    const body = await request.json();

  const oprReviewedBy = body.oprReviewedBy ?? null;
    const observaciones = body.observaciones ?? null;
    const correctiveAction = body.correctiveAction ?? null;
    const resultStatusOverride = body.resultStatus ?? null;

  const { rows } = await sql`
      UPDATE qc_activimetro_tests SET
            opr_reviewed_by = COALESCE(${oprReviewedBy}, opr_reviewed_by),
                  observaciones = COALESCE(${observaciones}, observaciones),
                        corrective_action = COALESCE(${correctiveAction}, corrective_action),
                              result_status = COALESCE(${resultStatusOverride}, result_status),
                                    updated_at = now()
                                        WHERE id = ${id}
                                            RETURNING *
                                              `;

  if (!rows[0]) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
    return NextResponse.json({ test: rows[0] });
}

export async function DELETE(_request: Request, { params }: Params) {
    await ensureActivimetroQcTables();
    const id = Number(params.id);
    await sql`DELETE FROM qc_activimetro_tests WHERE id = ${id}`;
    return NextResponse.json({ success: true });
}
