import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { listTestCatalog, ensurePetCtArchitectureTables, type PetCtTestCatalogEntry } from "@/lib/qc-petct-architecture-db";
import { listPetCtEquipment, ensurePetCtEquipmentTables } from "@/lib/qc-petct-equipment-db";
import { ensurePetTestsTables } from "@/lib/qc-petct-pet-tests-db";
import { ensureCtTestsTables } from "@/lib/qc-petct-ct-tests-db";
import { ensureJointTestsTables } from "@/lib/qc-petct-joint-tests-db";

export const dynamic = "force-dynamic";

/**
 * MODULO 4 - PET/CT - FASE H
 * Panel de cumplimiento de frecuencias (seccion 25 del prompt de mejora),
 * construido sobre el catalogo configurable de la Fase A (no sobre el
 * endpoint /due-status heredado de la Fase 22, que solo cubre las 2
 * pruebas originales y la tabla legacy qc_petct_tests / instruments).
 *
 * Para cada equipo PET/CT y cada prueba del catalogo que tenga una
 * frecuencia periodica (diaria/semanal/mensual/trimestral/anual) e
 * implementada (implemented = true), se calcula la fecha del ultimo
 * registro FINALIZADO (los borradores no cuentan como evidencia de
 * cumplimiento) entre las tres tablas de resultados (PET, CT e
 * interaccion PET/CT), y se compara contra la fecha limite esperada.
 *
 * Las frecuencias 'freq_acceptance' (una sola vez, al aceptar el equipo) y
 * 'freq_post_service' (se activan por un evento de servicio, seccion 26)
 * NO son periodicas por calendario y quedan fuera de este panel; ese
 * seguimiento se hace en /service-events.
 *
 * Si una prueba tiene mas de una frecuencia marcada, se usa la mas
 * exigente (el intervalo mas corto) como requisito vigente.
 */

type FrequencyFlag = "freq_daily" | "freq_weekly" | "freq_monthly" | "freq_quarterly" | "freq_annual";

const FREQUENCY_DAYS: Array<{ flag: FrequencyFlag; label: string; days: number }> = [
  { flag: "freq_daily", label: "Diaria", days: 1 },
  { flag: "freq_weekly", label: "Semanal", days: 7 },
  { flag: "freq_monthly", label: "Mensual", days: 30 },
  { flag: "freq_quarterly", label: "Trimestral", days: 91 },
  { flag: "freq_annual", label: "Anual", days: 365 },
];

type ComplianceStatus = "overdue" | "upcoming" | "ok" | "sin_registro";

type ComplianceRow = {
  equipment_id: number;
  equipment_label: string;
  test_code: string;
  test_name: string;
  modality: string;
  responsible_level: string;
  frequency_label: string;
  frequency_days: number;
  last_performed_at: string | null;
  next_due_date: string | null;
  days_until_due: number | null;
  status: ComplianceStatus;
};

function tightestFrequency(entry: PetCtTestCatalogEntry): { label: string; days: number } | null {
  let best: { label: string; days: number } | null = null;
  for (const f of FREQUENCY_DAYS) {
    if (entry[f.flag]) {
      if (!best || f.days < best.days) best = { label: f.label, days: f.days };
    }
  }
  return best;
}

export async function GET(request: NextRequest) {
  try {
    await Promise.all([
      ensurePetCtArchitectureTables(),
      ensurePetCtEquipmentTables(),
      ensurePetTestsTables(),
      ensureCtTestsTables(),
      ensureJointTestsTables(),
    ]);

    const { searchParams } = new URL(request.url);
    const equipmentIdParam = searchParams.get("equipment_id");

    const [catalog, equipmentAll] = await Promise.all([listTestCatalog(), listPetCtEquipment()]);
    const equipmentList = equipmentIdParam ? equipmentAll.filter((e) => String(e.id) === equipmentIdParam) : equipmentAll;

    const { rows: lastFinalized } = await sql`
      SELECT equipment_id, test_code, MAX(performed_at) AS last_performed_at
      FROM (
        SELECT equipment_id, test_code, performed_at FROM qc_petct_pet_tests WHERE is_finalized = true
        UNION ALL
        SELECT equipment_id, test_code, performed_at FROM qc_petct_ct_tests WHERE is_finalized = true
        UNION ALL
        SELECT equipment_id, test_code, performed_at FROM qc_petct_joint_tests WHERE is_finalized = true
      ) t
      WHERE equipment_id IS NOT NULL
      GROUP BY equipment_id, test_code;
    `;

    const lastMap = new Map<string, string>();
    for (const row of lastFinalized as Array<{ equipment_id: number; test_code: string; last_performed_at: string }>) {
      lastMap.set(`${row.equipment_id}:${row.test_code}`, row.last_performed_at);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows: ComplianceRow[] = [];

    for (const equipment of equipmentList) {
      const equipmentLabel = `${equipment.manufacturer ?? ""} ${equipment.model ?? ""} (${equipment.internal_code ?? "s/codigo"})`.trim();

      for (const entry of catalog) {
        if (!entry.implemented) continue;
        const freq = tightestFrequency(entry);
        if (!freq) continue;

        const key = `${equipment.id}:${entry.test_code}`;
        const lastPerformedAt = lastMap.get(key) ?? null;

        if (!lastPerformedAt) {
          rows.push({
            equipment_id: equipment.id,
            equipment_label: equipmentLabel,
            test_code: entry.test_code,
            test_name: entry.test_name,
            modality: entry.modality,
            responsible_level: entry.responsible_level,
            frequency_label: freq.label,
            frequency_days: freq.days,
            last_performed_at: null,
            next_due_date: null,
            days_until_due: null,
            status: "sin_registro",
          });
          continue;
        }

        const nextDueDate = new Date(lastPerformedAt);
        nextDueDate.setDate(nextDueDate.getDate() + freq.days);
        const diffDays = Math.round((nextDueDate.getTime() - today.getTime()) / 86400000);
        const warningWindowDays = Math.max(1, Math.round(freq.days * 0.15));

        const status: ComplianceStatus = diffDays < 0 ? "overdue" : diffDays <= warningWindowDays ? "upcoming" : "ok";

        rows.push({
          equipment_id: equipment.id,
          equipment_label: equipmentLabel,
          test_code: entry.test_code,
          test_name: entry.test_name,
          modality: entry.modality,
          responsible_level: entry.responsible_level,
          frequency_label: freq.label,
          frequency_days: freq.days,
          last_performed_at: lastPerformedAt,
          next_due_date: nextDueDate.toISOString().slice(0, 10),
          days_until_due: diffDays,
          status,
        });
      }
    }

    const statusOrder: Record<ComplianceStatus, number> = { overdue: 0, sin_registro: 1, upcoming: 2, ok: 3 };
    rows.sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        a.equipment_label.localeCompare(b.equipment_label) ||
        a.test_code.localeCompare(b.test_code)
    );

    const summary = {
      overdue: rows.filter((r) => r.status === "overdue").length,
      upcoming: rows.filter((r) => r.status === "upcoming").length,
      sin_registro: rows.filter((r) => r.status === "sin_registro").length,
      ok: rows.filter((r) => r.status === "ok").length,
    };

    return NextResponse.json({ rows, summary, checkedAt: today.toISOString().slice(0, 10) });
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/compliance:", error);
    return NextResponse.json({ error: "Error al calcular el panel de cumplimiento PET/CT" }, { status: 500 });
  }
}
