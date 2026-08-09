import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

const DECISIONS = ["aprobar_actualizacion", "rechazar", "mantener_actual", "revisar_manual"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureScienceTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await request.json();
  const reviewedBy = (body.reviewedBy || "Usuario RPMS") as string;
  const changesSummary = (body.changesSummary ?? null) as string | null;
  const decision = body.decision as string;

  const { rows: existingRows } = await sql`SELECT * FROM document_version_analysis WHERE id = ${id}`;
  if (!existingRows[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (decision && !DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  const newStatus = decision ? "revisado" : existingRows[0].status;

  const { rows } = await sql`
    UPDATE document_version_analysis
    SET changes_summary = COALESCE(${changesSummary}, changes_summary),
        decision = COALESCE(${decision}, decision),
        status = ${newStatus},
        reviewed_by = ${reviewedBy},
        reviewed_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json({ analysis: rows[0] });
}
