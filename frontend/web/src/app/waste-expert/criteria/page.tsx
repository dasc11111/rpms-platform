import { sql } from "@/lib/db";
import { ensureWasteReleaseCriteriaExpert } from "@/lib/waste-expert-db";
import { WasteReleaseCriteriaApp } from "@/components/waste-expert/waste-release-criteria-app";

export const dynamic = "force-dynamic";

// Secciones 27-28 del Prompt Maestro Definitivo
// Criterios de Liberación/Dispensa de Residuos Radiactivos.
// Distintos de los criterios de control de contaminación (waste_contamination_criteria).
// Valores consultados desde tabla configurada por jurisdicción/documento/radionúclido.
export default async function WasteReleaseCriteriaPage() {
  await ensureWasteReleaseCriteriaExpert();

  const { rows: criteria } = await sql`
    SELECT * FROM waste_release_criteria_expert
    ORDER BY jurisdiccion, documento_fuente, radionuclide_code NULLS LAST, parametro, id DESC
  `;

  const { rows: radionuclides } = await sql`
    SELECT code, name, symbol FROM radionuclides WHERE active = true ORDER BY sort_order, code
  `;

  const serialized = criteria.map((r: Record<string, unknown>) => ({
    ...r,
    fecha_vigencia_desde: r.fecha_vigencia_desde
      ? new Date(r.fecha_vigencia_desde).toISOString().slice(0, 10)
      : null,
    fecha_vigencia_hasta: r.fecha_vigencia_hasta
      ? new Date(r.fecha_vigencia_hasta).toISOString().slice(0, 10)
      : null,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }));

  return (
    <WasteReleaseCriteriaApp
      criteria={serialized as any}
      radionuclides={radionuclides as any}
    />
  );
}
