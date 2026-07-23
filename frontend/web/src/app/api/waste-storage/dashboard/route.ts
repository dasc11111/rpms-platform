import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { daysBetween, halfLivesElapsed, isReleaseEligible, daysUntilReleaseEligible } from "@/lib/waste";

export const dynamic = "force-dynamic";

// Panel de Decaimiento / Inventario: se recalcula automaticamente a partir
// del inventario actual (residuos con status != 'liberado'), sin necesidad
// de ingresar informacion adicional.
export async function GET() {
  const { rows } = await sql`
    SELECT w.*, r.half_life_days, l.name AS location_name
    FROM radioactive_waste_labels w
    LEFT JOIN radionuclides r ON r.code = w.radionuclide_code
    LEFT JOIN waste_storage_locations l ON l.id = w.storage_location_id
    WHERE w.status != 'liberado'
  `;

  const today = new Date().toISOString().slice(0, 10);
  let totalElapsed = 0;
  let liberablesAhora = 0;
  const proximos30: { id: number; label_number: string; dias_restantes: number }[] = [];
  const porUbicacionMap = new Map<string, number>();

  for (const row of rows as Record<string, unknown>[]) {
    const halfLifeDays = row.half_life_days !== null ? Number(row.half_life_days) : 0;
    const elapsedDays = daysBetween(String(row.entry_date), today);
    totalElapsed += elapsedDays;

    if (isReleaseEligible(halfLifeDays, elapsedDays)) {
      liberablesAhora++;
    } else {
      const daysLeft = daysUntilReleaseEligible(halfLifeDays, elapsedDays);
      if (daysLeft <= 30) {
        proximos30.push({
          id: row.id as number,
          label_number: String(row.label_number),
          dias_restantes: Math.round(daysLeft),
        });
      }
    }

    const locName = (row.location_name as string) ?? "Sin ubicación asignada";
    porUbicacionMap.set(locName, (porUbicacionMap.get(locName) ?? 0) + 1);
  }

  const { rows: movRows } = await sql`
    SELECT to_char(moved_at, 'YYYY-MM') AS ym, movement_type, COUNT(*)::int AS count
    FROM waste_inventory_movements
    GROUP BY ym, movement_type
    ORDER BY ym DESC
    LIMIT 60
  `;

  const totalEnAlmacenamiento = rows.length;
  const tiempoPromedioDias = totalEnAlmacenamiento > 0 ? totalElapsed / totalEnAlmacenamiento : 0;

  return NextResponse.json({
    totales: {
      totalEnAlmacenamiento,
      liberablesAhora,
      tiempoPromedioAlmacenamientoDias: Number(tiempoPromedioDias.toFixed(1)),
      proximos30Dias: proximos30.length,
    },
    porUbicacion: Array.from(porUbicacionMap.entries()).map(([location, count]) => ({ location, count })),
    proximosALiberar: proximos30.sort((a, b) => a.dias_restantes - b.dias_restantes).slice(0, 20),
    movimientosPorMes: movRows,
  });
}
