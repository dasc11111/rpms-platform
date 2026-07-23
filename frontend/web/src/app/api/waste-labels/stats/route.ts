import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Dashboard de Gestion de Residuos Radiactivos: se recalcula siempre en vivo
// (sin cache) a partir de la tabla radioactive_waste_labels, para que se
// actualice automaticamente cada vez que se genera un nuevo rotulo.
export async function GET() {
  const { rows: totals } = await sql`
  SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = 'almacenado')::int AS almacenados,
  COUNT(*) FILTER (WHERE status = 'liberado')::int AS liberados,
  COUNT(*) FILTER (WHERE status = 'pendiente')::int AS pendientes
  FROM radioactive_waste_labels
  `;

const { rows: porRadionuclido } = await sql`
SELECT radionuclide_code, COUNT(*)::int AS count
FROM radioactive_waste_labels GROUP BY radionuclide_code ORDER BY count DESC
`;

const { rows: porTipo } = await sql`
SELECT COALESCE(waste_type, 'Sin clasificar') AS waste_type, COUNT(*)::int AS count
FROM radioactive_waste_labels GROUP BY waste_type ORDER BY count DESC
`;

const { rows: porSala } = await sql`
SELECT sala, COUNT(*)::int AS count FROM radioactive_waste_labels GROUP BY sala ORDER BY count DESC
`;

const { rows: porServicio } = await sql`
SELECT service, COUNT(*)::int AS count FROM radioactive_waste_labels GROUP BY service ORDER BY count DESC
`;

const { rows: mensual } = await sql`
SELECT label_year AS year, EXTRACT(MONTH FROM generation_date)::int AS month, COUNT(*)::int AS count
FROM radioactive_waste_labels
GROUP BY label_year, EXTRACT(MONTH FROM generation_date)
ORDER BY year, month
`;

const { rows: anual } = await sql`
SELECT label_year AS year, COUNT(*)::int AS count FROM radioactive_waste_labels GROUP BY label_year ORDER BY year
`;

const { rows: tiempoPromedio } = await sql`
SELECT AVG(
EXTRACT(EPOCH FROM (CASE WHEN status = 'liberado' THEN updated_at ELSE now() END - entry_date)) / 86400
)::float AS avg_days
FROM radioactive_waste_labels
`;

// Proximos a cumplir tiempo de decaimiento / liberables: criterio estandar
// simplificado de 10 periodos de semidesintegracion del radionuclido.
const { rows: decayRows } = await sql`
SELECT w.id, w.label_number, w.entry_date, w.status, r.half_life_days,
EXTRACT(EPOCH FROM (now() - w.entry_date)) / 86400 AS elapsed_days
FROM radioactive_waste_labels w
JOIN radionuclides r ON r.code = w.radionuclide_code
WHERE w.status = 'almacenado'
`;

const proximosDecaimiento = decayRows.filter((r: Record<string, unknown>) => {
  const halfLife = Number(r.half_life_days);
  const elapsed = Number(r.elapsed_days);
  const halfLives = halfLife > 0 ? elapsed / halfLife : 0;
  return halfLives >= 8 && halfLives < 10;
});
  const liberables = decayRows.filter((r: Record<string, unknown>) => {
    const halfLife = Number(r.half_life_days);
    const elapsed = Number(r.elapsed_days);
    const halfLives = halfLife > 0 ? elapsed / halfLife : 0;
    return halfLives >= 10;
  });

function mapDecay(r: Record<string, unknown>) {
  return {
    id: r.id,
    label_number: r.label_number,
    elapsed_days: Number(r.elapsed_days),
    half_life_days: Number(r.half_life_days),
  };
}

return NextResponse.json({
  totals: {
    total: totals[0]?.total ?? 0,
    almacenados: totals[0]?.almacenados ?? 0,
    liberados: totals[0]?.liberados ?? 0,
    pendientes: totals[0]?.pendientes ?? 0,
    tiempoPromedioAlmacenamientoDias: tiempoPromedio[0]?.avg_days ? Number(tiempoPromedio[0].avg_days) : 0,
  },
  porRadionuclido,
  porTipo,
  porSala,
  porServicio,
  mensual,
  anual,
  proximosDecaimiento: proximosDecaimiento.map(mapDecay),
  liberables: liberables.map(mapDecay),
});
}
