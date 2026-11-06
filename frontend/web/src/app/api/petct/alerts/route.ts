import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  calcDecay,
  doseRateAt1m_usvh,
  DOSE_RELEASE_THRESHOLD_USVH,
  HALF_LIFE_MINUTES,
  type PetctRadionuclide,
} from "@/lib/petct";

export const dynamic = "force-dynamic";

// Fase 23D — API de alertas PET/CT.
// Detecta condiciones de riesgo radiológico y operativo en tiempo real:
//   1. Uptake overdue: paciente en sala de espera con captación vencida.
//   2. Alta retrasada: paciente completado con tasa de dosis aún sobre umbral.
//   3. Examen no iniciado: examen programado que debería haber iniciado.
//   4. QC fallido reciente: control de calidad con resultado negativo en <24 h.
// DS 133/1984 Art. 22-26, IAEA HHS No. 1, CCHEN.

export type AlertSeverity = "critical" | "warning" | "info";

export interface PetctAlert {
  id: string;
  severity: AlertSeverity;
  type:
    | "uptake_overdue"
    | "discharge_overdue"
    | "exam_not_started"
    | "qc_failure";
  exam_id?: string;
  patient_id?: string;
  patient_name?: string | null;
  radiopharmaceutical?: string;
  message: string;
  detail: string;
  since_minutes: number;
  created_at: string;
}

export async function GET() {
  try {
    const now = new Date();
    const alerts: PetctAlert[] = [];

    // ── 1. Uptake overdue (en_espera, captación vencida > 15 min de margen) ──
    const { rows: waitingRows } = await sql.query(`
      SELECT id, patient_id, patient_name, radiopharmaceutical, radionuclide,
             administered_mbq, injection_datetime, uptake_minutes, state
      FROM petct_examinations
      WHERE state = 'en_espera'
    `);

    for (const r of waitingRows) {
      const injTime = new Date(r.injection_datetime as string).getTime();
      const elapsedMin = (now.getTime() - injTime) / 60_000;
      const overdue = elapsedMin - Number(r.uptake_minutes);
      if (overdue > 15) {
        const severity: AlertSeverity = overdue > 60 ? "critical" : "warning";
        alerts.push({
          id: `uptake_overdue_${r.id}`,
          severity,
          type: "uptake_overdue",
          exam_id: String(r.id),
          patient_id: String(r.patient_id),
          patient_name: r.patient_name as string | null,
          radiopharmaceutical: r.radiopharmaceutical as string,
          message: `Captación vencida: ${r.patient_id}`,
          detail: `Tiempo de captación (${r.uptake_minutes} min) superado por ${Math.round(overdue)} min. Revisar disponibilidad de equipo PET/CT.`,
          since_minutes: Math.round(overdue),
          created_at: now.toISOString(),
        });
      }
    }

    // ── 2. Alta retrasada (completado, tasa de dosis aún sobre umbral) ─────────
    const { rows: completedRows } = await sql.query(`
      SELECT id, patient_id, patient_name, radiopharmaceutical, radionuclide,
             administered_mbq, injection_datetime, exam_end, state
      FROM petct_examinations
      WHERE state = 'completado'
        AND exam_end >= NOW() - INTERVAL '8 hours'
    `);

    for (const r of completedRows) {
      const injTime = new Date(r.injection_datetime as string).getTime();
      const elapsedMin = (now.getTime() - injTime) / 60_000;
      const nuclide = r.radionuclide as PetctRadionuclide;
      if (!HALF_LIFE_MINUTES[nuclide]) continue;
      const currentMbq = calcDecay(Number(r.administered_mbq), elapsedMin, nuclide);
      const doseRate = doseRateAt1m_usvh(currentMbq);
      if (doseRate > DOSE_RELEASE_THRESHOLD_USVH) {
        const examEndTime = r.exam_end ? new Date(r.exam_end as string).getTime() : now.getTime();
        const sinceMin = (now.getTime() - examEndTime) / 60_000;
        alerts.push({
          id: `discharge_overdue_${r.id}`,
          severity: "critical",
          type: "discharge_overdue",
          exam_id: String(r.id),
          patient_id: String(r.patient_id),
          patient_name: r.patient_name as string | null,
          radiopharmaceutical: r.radiopharmaceutical as string,
          message: `Alta retrasada: ${r.patient_id} — ${doseRate.toFixed(1)} µSv/h`,
          detail: `Examen completado pero tasa de dosis a 1 m (${doseRate.toFixed(1)} µSv/h) supera umbral de alta (${DOSE_RELEASE_THRESHOLD_USVH} µSv/h). Mantener en área controlada. DS 133/1984 Art. 22.`,
          since_minutes: Math.round(sinceMin),
          created_at: now.toISOString(),
        });
      }
    }

    // ── 3. Examen no iniciado (programado, >90 min después de injection_datetime) ─
    const { rows: scheduledRows } = await sql.query(`
      SELECT id, patient_id, patient_name, radiopharmaceutical, injection_datetime
      FROM petct_examinations
      WHERE state = 'programado'
        AND injection_datetime < NOW() - INTERVAL '90 minutes'
        AND injection_datetime >= NOW() - INTERVAL '24 hours'
    `);

    for (const r of scheduledRows) {
      const injTime = new Date(r.injection_datetime as string).getTime();
      const overdueMin = (now.getTime() - injTime) / 60_000 - 90;
      alerts.push({
        id: `not_started_${r.id}`,
        severity: "warning",
        type: "exam_not_started",
        exam_id: String(r.id),
        patient_id: String(r.patient_id),
        patient_name: r.patient_name as string | null,
        radiopharmaceutical: r.radiopharmaceutical as string,
        message: `Examen no iniciado: ${r.patient_id}`,
        detail: `El examen debería haber iniciado hace ${Math.round(overdueMin)} min. Verificar estado del paciente y flujo de trabajo.`,
        since_minutes: Math.round(overdueMin),
        created_at: now.toISOString(),
      });
    }

    // ── 4. QC fallido reciente (<24 h) ────────────────────────────────────────
    const { rows: qcRows } = await sql.query(`
      SELECT id, qc_date, phantom_type, uniformity_pass, image_quality_pass, performed_by
      FROM petct_qc_daily
      WHERE (uniformity_pass = false OR image_quality_pass = false)
        AND qc_date >= CURRENT_DATE - INTERVAL '1 day'
    `);

    for (const r of qcRows) {
      const failures = [];
      if (!r.uniformity_pass) failures.push("uniformidad");
      if (!r.image_quality_pass) failures.push("calidad de imagen");
      alerts.push({
        id: `qc_failure_${r.id}`,
        severity: "critical",
        type: "qc_failure",
        message: `QC fallido — ${new Date(r.qc_date as string).toLocaleDateString("es-CL")}`,
        detail: `Control de calidad diario con falla en: ${failures.join(", ")}. Fantoma: ${r.phantom_type}. Operador: ${r.performed_by}. IAEA HHS No. 1 §4.2.`,
        since_minutes: 0,
        created_at: now.toISOString(),
      });
    }

    // Ordenar: critical primero, luego por since_minutes desc
    alerts.sort((a, b) => {
      const sevOrder = { critical: 0, warning: 1, info: 2 };
      if (sevOrder[a.severity] !== sevOrder[b.severity]) {
        return sevOrder[a.severity] - sevOrder[b.severity];
      }
      return b.since_minutes - a.since_minutes;
    });

    return NextResponse.json({ alerts, total: alerts.length, generated_at: now.toISOString() });
  } catch (err) {
    console.error("[petct/alerts GET]", err);
    return NextResponse.json({ error: "Error al calcular alertas PET/CT" }, { status: 500 });
  }
}
