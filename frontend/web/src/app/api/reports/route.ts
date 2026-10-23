import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeCount(query: () => Promise<{ count: string }[]>): Promise<number> {
  try {
    const rows = await query();
    return parseInt(rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    // Gather KPIs from all modules (gracefully handle missing tables)
    const [
      workers,
      dosimetryAlerts,
      i131ThisMonth,
      incidentsOpen,
      incidentsGrave,
      complianceOk,
      compliancePendiente,
      complianceVencido,
      instruments,
      wastePending,
      equipmentVencido,
      equipmentProximo,
      qcPetctVencidas,
      qcActivimetroVencidas,
      qcGammacamaraVencidas,
      qcSpectVencidas,
    ] = await Promise.all([
      // Workers
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM workers WHERE status = 'activo'`),
      // Dosimetry alerts (instruments not returned or overdue)
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM dosimeter_assignments WHERE returned_at IS NULL AND due_date < CURRENT_DATE`),
      // I-131 this month
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM i131_administrations WHERE admin_year = EXTRACT(YEAR FROM NOW()) AND admin_month = EXTRACT(MONTH FROM NOW())`),
      // Incidents open
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM nm_incidents WHERE status = 'abierto'`),
      // Incidents grave open
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM nm_incidents WHERE severity = 'grave' AND status = 'abierto'`),
      // Compliance ok
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'ok'`),
      // Compliance pendiente
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'pendiente'`),
      // Compliance vencido
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'vencido'`),
      // Instruments with overdue calibration (via calibrations join)
      safeCount(() => sql`
        SELECT COUNT(*)::text as count FROM instruments i
        WHERE i.status = 'operativo'
          AND NOT EXISTS (
            SELECT 1 FROM calibrations c
            WHERE c.instrument_id = i.id
              AND c.expiry_date >= CURRENT_DATE
          )
      `),
      // Waste pending (state = 'en_almacenamiento' is the in-storage state)
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM waste_records WHERE state = 'en_almacenamiento'`),
      // Radiology equipment with expired authorization (DS 133/1984)
      safeCount(() => sql`
        SELECT COUNT(*)::text as count FROM radiology_equipment
        WHERE status = 'activo'
          AND authorization_expiry_date IS NOT NULL
          AND authorization_expiry_date < CURRENT_DATE
      `),
      // Radiology equipment with authorization expiring within 90 days
      safeCount(() => sql`
        SELECT COUNT(*)::text as count FROM radiology_equipment
        WHERE status = 'activo'
          AND authorization_expiry_date IS NOT NULL
          AND authorization_expiry_date >= CURRENT_DATE
          AND authorization_expiry_date < CURRENT_DATE + INTERVAL '90 days'
      `),
      // QC PET/CT overdue — union of the three real sub-tables (pet/ct/joint), is_finalized = true
      safeCount(() => sql`
        WITH all_tests AS (
          SELECT equipment_id, test_code AS test_type, performed_at
          FROM qc_petct_pet_tests WHERE is_finalized = true
          UNION ALL
          SELECT equipment_id, test_code, performed_at
          FROM qc_petct_ct_tests WHERE is_finalized = true
          UNION ALL
          SELECT equipment_id, test_code, performed_at
          FROM qc_petct_joint_tests WHERE is_finalized = true
        ),
        latest AS (
          SELECT equipment_id, test_type, MAX(performed_at) AS last_performed
          FROM all_tests GROUP BY equipment_id, test_type
        )
        SELECT COUNT(*)::text AS count
        FROM latest l
        JOIN qc_petct_tolerances t ON t.test_type = l.test_type AND t.active = true
        WHERE t.frequency_days IS NOT NULL
          AND (l.last_performed + (t.frequency_days * INTERVAL '1 day')) < NOW()
      `),
      // QC Activímetro overdue — uses qc_activimetro_tests with instrument_id/test_type/test_date
      safeCount(() => sql`
        WITH latest AS (
          SELECT instrument_id, test_type, MAX(test_date) AS last_test_date
          FROM qc_activimetro_tests
          WHERE instrument_id IS NOT NULL
          GROUP BY instrument_id, test_type
        )
        SELECT COUNT(*)::text AS count
        FROM latest l
        JOIN qc_activimetro_tolerances t ON t.test_type = l.test_type AND t.active = true
        WHERE t.frequency_days IS NOT NULL
          AND (l.last_test_date + (t.frequency_days * INTERVAL '1 day')) < NOW()
      `),
      // QC Gammacamara overdue (latest per instrument+test_type+test_mode past frequency)
      safeCount(() => sql`
        WITH latest AS (
          SELECT r.instrument_id, r.test_type, r.test_mode, MAX(r.test_date) AS last_test_date
          FROM qc_gammacamara_tests r
          WHERE r.instrument_id IS NOT NULL
          GROUP BY r.instrument_id, r.test_type, r.test_mode
        )
        SELECT COUNT(*)::text AS count
        FROM latest l
        JOIN qc_gammacamara_tolerances t ON t.test_type = l.test_type AND t.test_mode = l.test_mode AND t.active = true
        WHERE t.frequency_days IS NOT NULL
          AND (l.last_test_date + (t.frequency_days * INTERVAL '1 day')) < NOW()
      `),
      // QC SPECT overdue (latest per instrument+test_type past frequency)
      safeCount(() => sql`
        WITH latest AS (
          SELECT r.instrument_id, r.test_type, MAX(r.test_date) AS last_test_date
          FROM qc_spect_tests r
          WHERE r.instrument_id IS NOT NULL
          GROUP BY r.instrument_id, r.test_type
        )
        SELECT COUNT(*)::text AS count
        FROM latest l
        JOIN qc_spect_tolerances t ON t.test_type = l.test_type AND t.active = true
        WHERE t.frequency_days IS NOT NULL
          AND (l.last_test_date + (t.frequency_days * INTERVAL '1 day')) < NOW()
      `),
    ]);

    // Compliance score
    const complianceTotal = complianceOk + compliancePendiente + complianceVencido;
    const complianceScore = complianceTotal > 0 ? Math.round((complianceOk / complianceTotal) * 100) : null;

    const summary = {
      generated_at: new Date().toISOString(),
      modules: {
        workers: {
          label: "Trabajadores expuestos",
          value: workers,
          status: workers > 0 ? "ok" : "warning",
        },
        dosimetry: {
          label: "Dosímetros vencidos sin retornar",
          value: dosimetryAlerts,
          status: dosimetryAlerts === 0 ? "ok" : dosimetryAlerts <= 3 ? "warning" : "danger",
        },
        i131: {
          label: "Administraciones I-131 (mes actual)",
          value: i131ThisMonth,
          status: "ok",
        },
        incidents: {
          label: "Incidentes abiertos",
          value: incidentsOpen,
          status: incidentsOpen === 0 ? "ok" : incidentsGrave > 0 ? "danger" : "warning",
          detail: incidentsGrave > 0 ? `${incidentsGrave} grave(s)` : null,
        },
        compliance: {
          label: "Cumplimiento normativo",
          value: complianceScore !== null ? `${complianceScore}%` : "—",
          ok: complianceOk,
          pendiente: compliancePendiente,
          vencido: complianceVencido,
          status: complianceVencido > 0 ? "danger" : compliancePendiente > 0 ? "warning" : "ok",
        },
        instruments: {
          label: "Instrumentos con calibración vencida",
          value: instruments,
          status: instruments === 0 ? "ok" : instruments <= 2 ? "warning" : "danger",
        },
        waste: {
          label: "Residuos radiactivos pendientes",
          value: wastePending,
          status: wastePending === 0 ? "ok" : "warning",
        },
        equipment: {
          label: "Equipos con autorización vencida",
          value: equipmentVencido,
          status: equipmentVencido > 0 ? "danger" : equipmentProximo > 0 ? "warning" : "ok",
          detail: equipmentProximo > 0 ? `${equipmentProximo} próxima(s) a vencer` : null,
        },
        quality_control: {
          label: "Controles de calidad vencidos",
          value: qcPetctVencidas + qcActivimetroVencidas + qcGammacamaraVencidas + qcSpectVencidas,
          status: (qcPetctVencidas + qcActivimetroVencidas + qcGammacamaraVencidas + qcSpectVencidas) === 0 ? "ok" :
                  (qcPetctVencidas + qcActivimetroVencidas + qcGammacamaraVencidas + qcSpectVencidas) <= 3 ? "warning" : "danger",
          detail: [
            qcPetctVencidas > 0 ? `PET/CT: ${qcPetctVencidas}` : null,
            qcActivimetroVencidas > 0 ? `Activ.: ${qcActivimetroVencidas}` : null,
            qcGammacamaraVencidas > 0 ? `Gamma: ${qcGammacamaraVencidas}` : null,
            qcSpectVencidas > 0 ? `SPECT: ${qcSpectVencidas}` : null,
          ].filter(Boolean).join(" · ") || null,
        },
      },
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error("GET /api/reports", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
