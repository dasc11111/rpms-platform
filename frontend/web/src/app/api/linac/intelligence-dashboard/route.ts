import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";
import { ensureAlertsTables } from "@/lib/linac-alerts";

export const dynamic = "force-dynamic";

// Dashboard Cientifico "INTELIGENCIA TECNICA" (seccion 47 de la especificacion Fase 6).
// Agrega unicamente datos ya existentes y validados; no calcula ni infiere criterios nuevos.

export async function GET(request: Request) {
  await ensureScienceTables();
  await ensureAlertsTables();
  const { searchParams } = new URL(request.url);
  const linacId = Number(searchParams.get("linacId") || 0);
  if (!linacId) {
    return NextResponse.json({ error: "linacId_required" }, { status: 400 });
  }

  const { rows: criteriaRows } = await sql`
    SELECT status, count(*)::int AS n FROM linac_technical_criteria
    WHERE linac_id = ${linacId} OR linac_id IS NULL
    GROUP BY status;
  `;
  const criterios: Record<string, number> = { propuesto: 0, activo: 0, rechazado: 0, historico: 0 };
  criteriaRows.forEach((r: any) => { criterios[r.status] = r.n; });

  const { rows: alertRows } = await sql`
    SELECT level, status, count(*)::int AS n FROM linac_scientific_alerts
    WHERE linac_id = ${linacId}
    GROUP BY level, status;
  `;
  const alertas = {
    porNivel: { normal: 0, atencion: 0, investigacion: 0, critica: 0 } as Record<string, number>,
    abiertas: 0,
    enRevision: 0,
    cerradas: 0,
  };
  alertRows.forEach((r: any) => {
    alertas.porNivel[r.level] = (alertas.porNivel[r.level] || 0) + r.n;
    if (r.status === "abierta") alertas.abiertas += r.n;
    else if (r.status === "en_revision") alertas.enRevision += r.n;
    else if (r.status === "cerrada") alertas.cerradas += r.n;
  });

  const { rows: decisionRows } = await sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE decided_at > now() - interval '7 days')::int AS ultimos7dias
    FROM linac_deviation_decisions WHERE linac_id = ${linacId};
  `;
  const decisiones = decisionRows[0] || { total: 0, ultimos7dias: 0 };

  const { rows: qcRows } = await sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE test_date > now() - interval '90 days')::int AS ultimos90dias
    FROM linac_qc_tests WHERE linac_id = ${linacId};
  `;
  const qc = qcRows[0] || { total: 0, ultimos90dias: 0 };

  const { rows: rootRows } = await sql`
    SELECT id FROM document_categories
    WHERE upper(trim(name)) = 'MEDICINA NUCLEAR' AND parent_id IS NULL
    LIMIT 1;
  `;
  let documentos: Record<string, number> = { vigente: 0, proxima_revision: 0, requiere_revision: 0, obsoleto: 0, historico: 0 };
  let documentosPendientesAnalisis = 0;
  if (rootRows[0]) {
    const rootId = rootRows[0].id;
    const { rows: docStatusRows } = await sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM document_categories WHERE id = ${rootId}
        UNION ALL
        SELECT c.id FROM document_categories c JOIN subtree s ON c.parent_id = s.id
      )
      SELECT doc_status, count(*)::int AS n FROM documents
      WHERE category_id IN (SELECT id FROM subtree)
      GROUP BY doc_status;
    `;
    docStatusRows.forEach((r: any) => { documentos[r.doc_status] = r.n; });

    const { rows: pendRows } = await sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM document_categories WHERE id = ${rootId}
        UNION ALL
        SELECT c.id FROM document_categories c JOIN subtree s ON c.parent_id = s.id
      )
      SELECT count(*)::int AS n FROM document_version_analysis a
      JOIN documents d ON d.id = a.document_id
      WHERE a.status = 'pendiente' AND d.category_id IN (SELECT id FROM subtree);
    `;
    documentosPendientesAnalisis = pendRows[0] ? pendRows[0].n : 0;
  }

  return NextResponse.json({
    linacId,
    criterios,
    alertas,
    decisiones,
    qc,
    documentos,
    documentosPendientesAnalisis,
    generadoEl: new Date().toISOString(),
  });
}
