import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";

export const dynamic = "force-dynamic";

// Historial y Auditoria unificado del Motor Cientifico (seccion 45).
// Combina 3 fuentes YA existentes (no se crea una tabla nueva de auditoria paralela):
// linac_criteria_audit (cambios de criterios), linac_deviation_decisions (decisiones
// sobre desviaciones) y document_version_analysis (revisiones documentales).
export async function GET(request: Request) {
  await ensureScienceTables();
  const { searchParams } = new URL(request.url);
  const linacId = Number(searchParams.get("linacId") || 0);
  const limit = Number(searchParams.get("limit") || 200);

  const { rows: criteriaAudit } = await sql`
    SELECT a.id, a.criteria_id, a.action, a.actor, a.previous_data, a.new_data, a.reason, a.created_at,
           c.parameter_name, c.module
    FROM linac_criteria_audit a
    LEFT JOIN linac_technical_criteria c ON c.id = a.criteria_id
    WHERE (${linacId} = 0 OR c.linac_id = ${linacId} OR c.linac_id IS NULL)
    ORDER BY a.created_at DESC
    LIMIT ${limit};
  `;

  const { rows: decisions } = await sql`
    SELECT id, linac_id, source_module, source_record_id, parameter_name, measured_value,
           reference_value, deviation, decision, justification, decided_by, decided_at
    FROM linac_deviation_decisions
    WHERE (${linacId} = 0 OR linac_id = ${linacId})
    ORDER BY decided_at DESC
    LIMIT ${limit};
  `;

  const { rows: docReviews } = await sql`
    SELECT v.id, v.document_id, v.previous_document_id, v.changes_summary, v.status,
           v.reviewed_by, v.reviewed_at, v.decision, v.created_at, d.original_name AS document_name
    FROM document_version_analysis v
    LEFT JOIN documents d ON d.id = v.document_id
    WHERE v.reviewed_at IS NOT NULL
    ORDER BY v.reviewed_at DESC
    LIMIT ${limit};
  `;

  type Entry = {
    id: string;
    tipo: "criterio" | "decision" | "documento";
    fecha: string | null;
    actor: string | null;
    accion: string | null;
    detalle: string;
    valorAnterior: unknown;
    valorNuevo: unknown;
    motivo: string | null;
  };

  const entries: Entry[] = [];

  (criteriaAudit as any[]).forEach((r) => {
    entries.push({
      id: "criterio-" + r.id,
      tipo: "criterio",
      fecha: r.created_at,
      actor: r.actor,
      accion: r.action,
      detalle: "Criterio: " + (r.parameter_name || "-") + " (" + (r.module || "-") + ")",
      valorAnterior: r.previous_data,
      valorNuevo: r.new_data,
      motivo: r.reason,
    });
  });

  (decisions as any[]).forEach((r) => {
    entries.push({
      id: "decision-" + r.id,
      tipo: "decision",
      fecha: r.decided_at,
      actor: r.decided_by,
      accion: r.decision,
      detalle: "Desviacion: " + (r.parameter_name || "-") + " - medido " + (r.measured_value ?? "-") + " vs referencia " + (r.reference_value ?? "-"),
      valorAnterior: r.reference_value,
      valorNuevo: r.measured_value,
      motivo: r.justification,
    });
  });

  (docReviews as any[]).forEach((r) => {
    entries.push({
      id: "documento-" + r.id,
      tipo: "documento",
      fecha: r.reviewed_at,
      actor: r.reviewed_by,
      accion: r.decision || r.status,
      detalle: "Documento: " + (r.document_name || "Documento #" + r.document_id),
      valorAnterior: null,
      valorNuevo: r.changes_summary,
      motivo: null,
    });
  });

  entries.sort((a, b) => {
    const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
    const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json({ entries: entries.slice(0, limit), total: entries.length });
}
