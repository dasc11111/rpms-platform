import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  daysBetween,
  decayFractionRemaining,
  halfLivesElapsed,
  daysUntilReleaseEligible,
  isReleaseEligible,
} from "@/lib/waste";

export const dynamic = "force-dynamic";

// Inventario actual de residuos radiactivos en almacenamiento temporal.
// Reutiliza el rotulo (radioactive_waste_labels) ya generado por Gestion de
// Residuos Radiactivos como unica fuente de datos: no se solicita ni se
// duplica ninguna informacion. Calcula automaticamente, para cada residuo,
// el tiempo transcurrido, la actividad actual estimada por decaimiento y si
// ya cumple el criterio de liberacion (por defecto 10 periodos de
// semidesintegracion).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeReleased = searchParams.get("includeReleased") === "true";
  const locationId = searchParams.get("location_id");

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (!includeReleased) {
    conditions.push("w.status != 'liberado'");
  }
  if (locationId) {
    params.push(Number(locationId));
    conditions.push(`w.storage_location_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT w.*, r.half_life_days, r.release_criteria_activity, l.name AS location_name
    FROM radioactive_waste_labels w
    LEFT JOIN radionuclides r ON r.code = w.radionuclide_code
    LEFT JOIN waste_storage_locations l ON l.id = w.storage_location_id
    ${where}
    ORDER BY w.entry_date ASC, w.id ASC
  `;
  const { rows } = await sql.query(query, params);

  const today = new Date().toISOString().slice(0, 10);
  const items = rows.map((row: Record<string, unknown>) => {
    const halfLifeDays = row.half_life_days !== null ? Number(row.half_life_days) : 0;
    const elapsedDays = daysBetween(String(row.entry_date), today);
    const halfLivesCount = halfLivesElapsed(halfLifeDays, elapsedDays);
    const baseActivity = row.actividad_estimada_residual !== null ? Number(row.actividad_estimada_residual) : null;
    const actividadActual = baseActivity !== null ? baseActivity * decayFractionRemaining(halfLifeDays, elapsedDays) : null;
    const daysLeft = daysUntilReleaseEligible(halfLifeDays, elapsedDays);
    const eligible = isReleaseEligible(halfLifeDays, elapsedDays);

    return {
      ...row,
      elapsed_days: Math.round(elapsedDays),
      half_lives_elapsed: Number(halfLivesCount.toFixed(2)),
      actividad_actual: actividadActual !== null ? Number(actividadActual.toFixed(3)) : null,
      days_until_release_eligible: Math.round(daysLeft),
      release_eligible: eligible,
    };
  });

  return NextResponse.json({ rows: items, total: items.length });
}
