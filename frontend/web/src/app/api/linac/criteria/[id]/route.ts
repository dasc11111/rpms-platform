import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureScienceTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { rows } = await sql`
    SELECT c.*, d.original_name AS document_name, d.doc_code AS document_code, d.blob_url AS document_url
    FROM linac_technical_criteria c
    LEFT JOIN documents d ON d.id = c.document_id
    WHERE c.id = ${id}
  `;
  const criteria = rows[0];
  if (!criteria) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { rows: auditRows } = await sql`
    SELECT * FROM linac_criteria_audit WHERE criteria_id = ${id} ORDER BY created_at DESC
  `;

  const { rows: versionRows } = await sql`
    SELECT id, status, value, updated_at FROM linac_technical_criteria
    WHERE previous_version_id = ${id} OR id = (SELECT previous_version_id FROM linac_technical_criteria WHERE id = ${id})
  `;

  return NextResponse.json({ criteria, audit: auditRows, versions: versionRows });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureScienceTables();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await request.json();
  const action = body.action as string;
  const actor = (body.actor || "Usuario RPMS") as string;
  const reason = (body.reason || "") as string;

  const { rows: existingRows } = await sql`SELECT * FROM linac_technical_criteria WHERE id = ${id}`;
  const existing = existingRows[0];
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "aprobar") {
    if (existing.status !== "propuesto") {
      return NextResponse.json({ error: "invalid_state" }, { status: 400 });
    }
    // Historizar la version activa previa del mismo parametro/modulo/equipo, si existe.
    await sql`
      UPDATE linac_technical_criteria
      SET status = 'historico', updated_at = now()
      WHERE status = 'activo' AND module = ${existing.module}
        AND parameter_name = ${existing.parameter_name}
        AND (linac_id = ${existing.linac_id} OR (linac_id IS NULL AND ${existing.linac_id} IS NULL))
        AND id != ${id}
    `;

    const { rows } = await sql`
      UPDATE linac_technical_criteria
      SET status = 'activo', validated_by = ${actor}, validated_at = now(), validation_notes = ${reason}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    await sql`
      INSERT INTO linac_criteria_audit (criteria_id, action, actor, previous_data, new_data, reason)
      VALUES (${id}, 'aprobado', ${actor}, ${JSON.stringify(existing)}::jsonb, ${JSON.stringify(rows[0])}::jsonb, ${reason})
    `;
    return NextResponse.json({ criteria: rows[0] });
  }

  if (action === "rechazar") {
    const { rows } = await sql`
      UPDATE linac_technical_criteria
      SET status = 'rechazado', validated_by = ${actor}, validated_at = now(), validation_notes = ${reason}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    await sql`
      INSERT INTO linac_criteria_audit (criteria_id, action, actor, previous_data, new_data, reason)
      VALUES (${id}, 'rechazado', ${actor}, ${JSON.stringify(existing)}::jsonb, ${JSON.stringify(rows[0])}::jsonb, ${reason})
    `;
    return NextResponse.json({ criteria: rows[0] });
  }

  if (action === "modificar") {
    if (existing.status !== "propuesto") {
      return NextResponse.json({ error: "invalid_state" }, { status: 400 });
    }
    const u = body.updates || {};
    const { rows } = await sql`
      UPDATE linac_technical_criteria
      SET value = ${u.value ?? existing.value},
          unit = ${u.unit ?? existing.unit},
          tolerance = ${u.tolerance ?? existing.tolerance},
          action_limit = ${u.actionLimit ?? existing.action_limit},
          investigation_limit = ${u.investigationLimit ?? existing.investigation_limit},
          critical_limit = ${u.criticalLimit ?? existing.critical_limit},
          fragment_text = ${u.fragmentText ?? existing.fragment_text},
          updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    await sql`
      INSERT INTO linac_criteria_audit (criteria_id, action, actor, previous_data, new_data, reason)
      VALUES (${id}, 'modificado', ${actor}, ${JSON.stringify(existing)}::jsonb, ${JSON.stringify(rows[0])}::jsonb, ${reason})
    `;
    return NextResponse.json({ criteria: rows[0] });
  }

  if (action === "nueva_version") {
    if (existing.status !== "activo") {
      return NextResponse.json({ error: "invalid_state" }, { status: 400 });
    }
    const u = body.updates || {};
    const { rows } = await sql`
      INSERT INTO linac_technical_criteria (
        parameter_name, module, linac_id, value, unit, tolerance, action_limit,
        investigation_limit, critical_limit, source_level, source_name, document_id,
        document_version, page, chapter, section, table_ref, fragment_text,
        status, previous_version_id, proposed_by
      ) VALUES (
        ${existing.parameter_name}, ${existing.module}, ${existing.linac_id},
        ${u.value ?? existing.value}, ${u.unit ?? existing.unit}, ${u.tolerance ?? existing.tolerance},
        ${u.actionLimit ?? existing.action_limit}, ${u.investigationLimit ?? existing.investigation_limit},
        ${u.criticalLimit ?? existing.critical_limit}, ${u.sourceLevel ?? existing.source_level},
        ${u.sourceName ?? existing.source_name}, ${u.documentId ?? existing.document_id},
        ${u.documentVersion ?? existing.document_version}, ${u.page ?? existing.page},
        ${u.chapter ?? existing.chapter}, ${u.section ?? existing.section},
        ${u.tableRef ?? existing.table_ref}, ${u.fragmentText ?? existing.fragment_text},
        'propuesto', ${id}, ${actor}
      )
      RETURNING *
    `;
    const created: any = rows[0];
    if (!created) {
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }
    await sql`
      INSERT INTO linac_criteria_audit (criteria_id, action, actor, previous_data, new_data, reason)
      VALUES (${created.id}, 'nueva_version', ${actor}, ${JSON.stringify(existing)}::jsonb, ${JSON.stringify(created)}::jsonb, ${reason})
    `;
    return NextResponse.json({ criteria: created });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
