import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureAlertsTables } from "@/lib/linac-alerts";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureAlertsTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await request.json();
  const action = body.action as string;
  const actor = (body.actor || "Usuario RPMS") as string;

  if (action === "reconocer") {
    const { rows } = await sql`
      UPDATE linac_scientific_alerts
      SET status = 'en_revision', acknowledged_by = ${actor}, acknowledged_at = now()
      WHERE id = ${id} RETURNING *;
    `;
    return NextResponse.json({ alert: rows[0] || null });
  }

  if (action === "cerrar") {
    const notes = (body.notes || null) as string | null;
    const { rows } = await sql`
      UPDATE linac_scientific_alerts
      SET status = 'cerrada', resolution_notes = ${notes}, acknowledged_by = ${actor}, acknowledged_at = now()
      WHERE id = ${id} RETURNING *;
    `;
    return NextResponse.json({ alert: rows[0] || null });
  }

  if (action === "reabrir") {
    const { rows } = await sql`
      UPDATE linac_scientific_alerts
      SET status = 'abierta', acknowledged_by = ${actor}, acknowledged_at = now()
      WHERE id = ${id} RETURNING *;
    `;
    return NextResponse.json({ alert: rows[0] || null });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
