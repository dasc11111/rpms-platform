import { sql } from "@/lib/db";
import {
  ensurePetCtArchitectureTables,
  listTestCatalog,
  listServiceEvents,
  type PetCtTestCatalogEntry,
} from "@/lib/qc-petct-architecture-db";
import { ensurePetCtEquipmentTables, listPetCtEquipment } from "@/lib/qc-petct-equipment-db";
import { ensurePetTestsTables, listPetTests, type PetTestCode } from "@/lib/qc-petct-pet-tests-db";
import { ensureCtTestsTables, listCtTests, type CtTestCode } from "@/lib/qc-petct-ct-tests-db";
import { ensureJointTestsTables, listJointTests, type JointTestCode } from "@/lib/qc-petct-joint-tests-db";
import {
  getTrendMetricDefinition,
  extractMetricValue,
  buildTrendSeries,
  type TrendPoint,
} from "@/lib/qc-petct-trend";

/**
 * MODULO 4 - PET/CT - FASE M
 * Motor de inteligencia de alertas (seccion 29 del prompt de mejora).
 *
 * A diferencia del panel de cumplimiento (Fase H, solo vencimientos por
 * frecuencia) y del grafico de control (Fase K, solo estadistica del
 * proceso), este motor CRUZA todas las fuentes ya existentes del Modulo 4
 * para producir el listado unico de alertas que exige la seccion 29:
 * - Fuera de tolerancia: ultimo resultado finalizado con status "no_cumple".
 * - Cercano al limite: ultimo resultado con action_level "advertencia"
 *   (mismo criterio de margen ya calculado en qc-petct-calc.ts).
 * - Tendencia progresiva: regla de Westgard 2/2DE del motor de tendencia
 *   (Fase K) sobre el ultimo punto de la serie.
 * - Cambio brusco: ultimo punto de la serie fuera de control (> 3DE).
 * - Cambio vs. baseline: para las pruebas cuyo motor de calculo ya informa
 *   una desviacion explicita respecto del baseline vigente (PET-ESTAB,
 *   PET-SUV-CAL, PETCT-02), comparada contra la propia tolerancia que el
 *   usuario configuro para ese registro (no existe un limite universal de
 *   deriva, seccion 37).
 * - Prueba vencida / sin registro: mismo calculo de frecuencia que la
 *   Fase H, pero expresado como alerta accionable en vez de panel de
 *   estado.
 * - Post-servicio pendiente: eventos de servicio (Fase A, seccion 26) con
 *   pruebas requeridas que aun no figuran en tests_completed.
 *
 * Este motor NUNCA decide una accion clinica ni de mantenimiento (seccion
 * 30 no implementada aun): solo detecta y describe la condicion. La
 * "accion recomendada" formal queda para una fase posterior (motor de
 * decision).
 */

export type PetCtAlertSeverity = "alta" | "media" | "baja";

export type PetCtAlertType =
  | "fuera_de_tolerancia"
  | "cercano_al_limite"
  | "tendencia_progresiva"
  | "cambio_brusco"
  | "cambio_vs_baseline"
  | "prueba_vencida"
  | "prueba_sin_registro"
  | "post_servicio_pendiente";

export interface PetCtAlert {
  id: string;
  severity: PetCtAlertSeverity;
  type: PetCtAlertType;
  equipment_id: number | null;
  equipment_label: string;
  test_code: string | null;
  test_name: string | null;
  title: string;
  description: string;
  href: string;
}

export const PETCT_ALERT_SEVERITY_LABEL: Record<PetCtAlertSeverity, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const PETCT_ALERT_TYPE_LABEL: Record<PetCtAlertType, string> = {
  fuera_de_tolerancia: "Fuera de tolerancia",
  cercano_al_limite: "Cercano al limite",
  tendencia_progresiva: "Tendencia progresiva",
  cambio_brusco: "Cambio brusco",
  cambio_vs_baseline: "Cambio vs. baseline",
  prueba_vencida: "Prueba vencida",
  prueba_sin_registro: "Prueba sin registro",
  post_servicio_pendiente: "Post-servicio pendiente",
};

export const PETCT_ALERT_SEVERITY_CLASS: Record<PetCtAlertSeverity, string> = {
  alta: "bg-red-100 text-red-800 border-red-300",
  media: "bg-yellow-100 text-yellow-800 border-yellow-300",
  baja: "bg-gray-100 text-gray-600 border-gray-300",
};

const SEVERITY_ORDER: Record<PetCtAlertSeverity, number> = { alta: 0, media: 1, baja: 2 };

type FrequencyFlag = "freq_daily" | "freq_weekly" | "freq_monthly" | "freq_quarterly" | "freq_annual";

const FREQUENCY_DAYS: Array<{ flag: FrequencyFlag; label: string; days: number }> = [
  { flag: "freq_daily", label: "Diaria", days: 1 },
  { flag: "freq_weekly", label: "Semanal", days: 7 },
  { flag: "freq_monthly", label: "Mensual", days: 30 },
  { flag: "freq_quarterly", label: "Trimestral", days: 91 },
  { flag: "freq_annual", label: "Anual", days: 365 },
];

function tightestFrequency(entry: PetCtTestCatalogEntry): { label: string; days: number } | null {
  let best: { label: string; days: number } | null = null;
  for (const f of FREQUENCY_DAYS) {
    if (entry[f.flag]) {
      if (!best || f.days < best.days) best = { label: f.label, days: f.days };
    }
  }
  return best;
}

function hrefForModality(modality: string): string {
  if (modality === "PET") return "/quality-control/petct/pet-tests";
  if (modality === "CT") return "/quality-control/petct/ct-tests";
  return "/quality-control/petct/joint-tests";
}

/**
 * Extrae, si corresponde, la desviacion respecto del baseline vigente ya
 * calculada por el motor de qc-petct-calc.ts para esta prueba especifica.
 * No se generaliza a todas las pruebas porque no todas informan esta
 * comparacion (solo las que explicitamente la calculan segun el prompt).
 */
function extractBaselineDeviation(
  testCode: string,
  record: { calculated: Record<string, unknown>; raw_inputs: Record<string, unknown> }
): { magnitude: number; tolerance: number | null; unit: string } | null {
  if (testCode === "PET-ESTAB") {
    const v = record.calculated.percentDeviationFromBaseline;
    if (typeof v !== "number" || Number.isNaN(v)) return null;
    const tol = Number(record.raw_inputs.tolerancePercent);
    return { magnitude: Math.abs(v), tolerance: Number.isFinite(tol) ? tol : null, unit: "%" };
  }
  if (testCode === "PET-SUV-CAL") {
    const v = record.calculated.deltaFromBaselinePercent;
    if (typeof v !== "number" || Number.isNaN(v)) return null;
    const tol = Number(record.raw_inputs.tolerancePercent);
    return { magnitude: Math.abs(v), tolerance: Number.isFinite(tol) ? tol : null, unit: "%" };
  }
  if (testCode === "PETCT-02") {
    const delta = record.calculated.deltaFromBaselineMm as { max: number | null } | undefined;
    const v = delta?.max;
    if (typeof v !== "number" || Number.isNaN(v)) return null;
    const tol = Number(record.raw_inputs.toleranceMm);
    return { magnitude: Math.abs(v), tolerance: Number.isFinite(tol) ? tol : null, unit: "mm" };
  }
  return null;
}

/**
 * Calcula, para un equipo (o todos si no se especifica), el listado
 * completo de alertas del Modulo 4 PET/CT. Funcion con acceso a BD (no
 * pura), pensada para ser consumida por el endpoint /api/quality-control/petct/alerts.
 */
export async function computePetCtAlerts(equipmentId?: number): Promise<PetCtAlert[]> {
  await Promise.all([
    ensurePetCtArchitectureTables(),
    ensurePetCtEquipmentTables(),
    ensurePetTestsTables(),
    ensureCtTestsTables(),
    ensureJointTestsTables(),
  ]);

  const [catalog, equipmentAll, serviceEventsAll] = await Promise.all([
    listTestCatalog(),
    listPetCtEquipment(),
    listServiceEvents(),
  ]);

  const equipmentList = equipmentId
    ? (equipmentAll as any[]).filter((e) => e.id === equipmentId)
    : (equipmentAll as any[]);

  const alerts: PetCtAlert[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const equipment of equipmentList) {
    const equipmentLabel = `${equipment.manufacturer ?? ""} ${equipment.model ?? ""} (${equipment.internal_code ?? "s/codigo"})`.trim();

    for (const entry of catalog) {
      if (!entry.implemented) continue;
      if (entry.modality !== "PET" && entry.modality !== "CT" && entry.modality !== "PETCT") continue;
      // Las pruebas legacy (calibracion_cruzada, uniformidad_imagen) usan la
      // tabla original qc_petct_tests (Fase 22), fuera del alcance de este
      // motor, que solo cubre las tablas nuevas de las Fases B/C/D.
      if (entry.test_code === "calibracion_cruzada" || entry.test_code === "uniformidad_imagen") continue;

      let records: any[] = [];
      if (entry.modality === "PET") {
        records = await listPetTests({ equipment_id: equipment.id, test_code: entry.test_code as PetTestCode });
      } else if (entry.modality === "CT") {
        records = await listCtTests({ equipment_id: equipment.id, test_code: entry.test_code as CtTestCode });
      } else {
        records = await listJointTests({ equipment_id: equipment.id, test_code: entry.test_code as JointTestCode });
      }

      const finalized = records
        .filter((r) => r.is_finalized)
        .sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime());

      const freq = tightestFrequency(entry);

      if (finalized.length === 0) {
        if (freq) {
          alerts.push({
            id: `sinreg-${equipment.id}-${entry.test_code}`,
            severity: "baja",
            type: "prueba_sin_registro",
            equipment_id: equipment.id,
            equipment_label: equipmentLabel,
            test_code: entry.test_code,
            test_name: entry.test_name,
            title: `Sin registro: ${entry.test_name}`,
            description: `${equipmentLabel} no tiene ningun registro finalizado de ${entry.test_code} (frecuencia ${freq.label}).`,
            href: hrefForModality(entry.modality),
          });
        }
        continue;
      }

      const last = finalized[finalized.length - 1]!;

      if (freq) {
        const nextDue = new Date(last.performed_at);
        nextDue.setDate(nextDue.getDate() + freq.days);
        const diffDays = Math.round((nextDue.getTime() - today.getTime()) / 86400000);
        if (diffDays < 0) {
          alerts.push({
            id: `vencida-${equipment.id}-${entry.test_code}`,
            severity: diffDays < -freq.days ? "alta" : "media",
            type: "prueba_vencida",
            equipment_id: equipment.id,
            equipment_label: equipmentLabel,
            test_code: entry.test_code,
            test_name: entry.test_name,
            title: `Prueba vencida: ${entry.test_name}`,
            description: `${equipmentLabel}: el ultimo registro finalizado de ${entry.test_code} fue el ${new Date(last.performed_at).toLocaleDateString()}, vencio hace ${Math.abs(diffDays)} dia(s) (frecuencia ${freq.label}).`,
            href: hrefForModality(entry.modality),
          });
        }
      }

      if (last.status === "no_cumple") {
        alerts.push({
          id: `notol-${equipment.id}-${entry.test_code}-${last.id}`,
          severity: "alta",
          type: "fuera_de_tolerancia",
          equipment_id: equipment.id,
          equipment_label: equipmentLabel,
          test_code: entry.test_code,
          test_name: entry.test_name,
          title: `Fuera de tolerancia: ${entry.test_name}`,
          description: `${equipmentLabel}: el resultado del ${new Date(last.performed_at).toLocaleDateString()} de ${entry.test_code} no cumple la tolerancia configurada.`,
          href: hrefForModality(entry.modality),
        });
      } else if (last.action_level === "advertencia") {
        alerts.push({
          id: `cerca-${equipment.id}-${entry.test_code}-${last.id}`,
          severity: "media",
          type: "cercano_al_limite",
          equipment_id: equipment.id,
          equipment_label: equipmentLabel,
          test_code: entry.test_code,
          test_name: entry.test_name,
          title: `Cercano al limite: ${entry.test_name}`,
          description: `${equipmentLabel}: el resultado del ${new Date(last.performed_at).toLocaleDateString()} de ${entry.test_code} esta dentro de tolerancia pero cerca del limite (nivel de accion: advertencia).`,
          href: hrefForModality(entry.modality),
        });
      }

      const baselineCheck = extractBaselineDeviation(entry.test_code, last);
      if (baselineCheck && baselineCheck.tolerance && baselineCheck.tolerance > 0) {
        const fraction = baselineCheck.magnitude / baselineCheck.tolerance;
        if (fraction >= 0.5) {
          alerts.push({
            id: `baseline-${equipment.id}-${entry.test_code}-${last.id}`,
            severity: fraction >= 1 ? "alta" : "media",
            type: "cambio_vs_baseline",
            equipment_id: equipment.id,
            equipment_label: equipmentLabel,
            test_code: entry.test_code,
            test_name: entry.test_name,
            title: `Cambio vs. baseline: ${entry.test_name}`,
            description: `${equipmentLabel}: el resultado del ${new Date(last.performed_at).toLocaleDateString()} de ${entry.test_code} se desvia ${baselineCheck.magnitude.toFixed(2)} ${baselineCheck.unit} respecto del baseline vigente.`,
            href: hrefForModality(entry.modality),
          });
        }
      }

      const def = getTrendMetricDefinition(entry.test_code);
      if (def && finalized.length >= 3) {
        const points: TrendPoint[] = [];
        for (const r of finalized) {
          const value = extractMetricValue(def, r);
          if (value !== null) points.push({ record_id: r.id, performed_at: r.performed_at, value });
        }
        const series = buildTrendSeries(points);
        const lastPoint = series && series.points.length ? series.points[series.points.length - 1] : null;
        if (lastPoint) {
          if (lastPoint.status === "fuera_control_3de") {
            alerts.push({
              id: `brusco-${equipment.id}-${entry.test_code}-${lastPoint.record_id}`,
              severity: "alta",
              type: "cambio_brusco",
              equipment_id: equipment.id,
              equipment_label: equipmentLabel,
              test_code: entry.test_code,
              test_name: entry.test_name,
              title: `Cambio brusco: ${entry.test_name}`,
              description: `${equipmentLabel}: el ultimo resultado de ${entry.test_code} (${def.label} = ${lastPoint.value.toFixed(3)} ${def.unit}) esta fuera de control (mas de 3 DE respecto de la media historica).`,
              href: hrefForModality(entry.modality),
            });
          } else if (lastPoint.westgard_2_2de) {
            alerts.push({
              id: `tendencia-${equipment.id}-${entry.test_code}-${lastPoint.record_id}`,
              severity: "media",
              type: "tendencia_progresiva",
              equipment_id: equipment.id,
              equipment_label: equipmentLabel,
              test_code: entry.test_code,
              test_name: entry.test_name,
              title: `Tendencia progresiva: ${entry.test_name}`,
              description: `${equipmentLabel}: dos resultados consecutivos de ${entry.test_code} (${def.label}) superan 2 DE del mismo lado de la media historica (regla de Westgard 2/2DE).`,
              href: hrefForModality(entry.modality),
            });
          }
        }
      }
    }

    const pendingEvents = (serviceEventsAll as any[]).filter(
      (ev) => ev.equipment_id === equipment.id && ev.status !== "completado"
    );
    for (const ev of pendingEvents) {
      const required: string[] = Array.isArray(ev.tests_required) ? ev.tests_required : [];
      const completed: string[] = Array.isArray(ev.tests_completed) ? ev.tests_completed : [];
      const missing = required.filter((code) => !completed.includes(code));
      if (missing.length > 0) {
        alerts.push({
          id: `postserv-${ev.id}`,
          severity: "alta",
          type: "post_servicio_pendiente",
          equipment_id: equipment.id,
          equipment_label: equipmentLabel,
          test_code: null,
          test_name: null,
          title: `Post-servicio pendiente: ${equipmentLabel}`,
          description: `Evento de servicio del ${new Date(ev.service_date).toLocaleDateString()} (${ev.service_type}) tiene ${missing.length} prueba(s) pendiente(s): ${missing.join(", ")}.`,
          href: "/quality-control/petct/service-events",
        });
      }
    }
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return alerts;
}
