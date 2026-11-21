import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Alert {
  id: string;
  type: "danger" | "warning" | "info";
  module: string;
  title: string;
  detail: string;
  regulation?: string;
  action?: string;
}

export async function GET() {
  const alerts: Alert[] = [];

  // 1. Autorizaciones de desempeño vencidas o próximas a vencer (30 días)
  try {
    const { rows: authRows } = await sql`
      SELECT name, authorization_expiry_date::text, authorization_number
      FROM workers
      WHERE status <> 'inactive'
        AND authorization_expiry_date IS NOT NULL
        AND authorization_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY authorization_expiry_date ASC
      LIMIT 10
    `;
    for (const w of authRows as { name: string; authorization_expiry_date: string; authorization_number: string | null }[]) {
      const isExpired = w.authorization_expiry_date <= new Date().toISOString().slice(0, 10);
      alerts.push({
        id: `auth-${w.name}`,
        type: isExpired ? "danger" : "warning",
        module: "Trabajadores",
        title: isExpired
          ? `Autorización vencida: ${w.name}`
          : `Autorización próxima a vencer: ${w.name}`,
        detail: `Vence: ${w.authorization_expiry_date}${w.authorization_number ? ` · N° ${w.authorization_number}` : ""}`,
        regulation: "DS 3/1985 Art. 3 — CCHEN",
        action: "/workers",
      });
    }
  } catch { /* tabla no existe aún */ }

  // 2. CC MN fallidos en los últimos 7 días
  try {
    const { rows: qcFails } = await sql`
      SELECT equipment_name, performed_at::text, result
      FROM qc_records
      WHERE pass = false AND performed_at > NOW() - INTERVAL '7 days'
      ORDER BY performed_at DESC
      LIMIT 5
    `;
    for (const q of qcFails as { equipment_name: string; performed_at: string; result: string | null }[]) {
      alerts.push({
        id: `qc-fail-${q.performed_at}`,
        type: "danger",
        module: "Control de Calidad MN",
        title: `CC MN fallido: ${q.equipment_name}`,
        detail: q.result ?? "Sin descripción del resultado",
        regulation: "NS-06.0 §10 — IAEA-TECDOC-1683",
        action: "/quality-control",
      });
    }
  } catch { /* tabla no existe aún */ }

  // 3. Fuentes radiactivas con inventario vencido
  try {
    const { rows: srcRows } = await sql`
      SELECT source_code, isotope, next_inventory_date::text
      FROM radioactive_sources
      WHERE status = 'in_use'
        AND next_inventory_date < CURRENT_DATE
      ORDER BY next_inventory_date ASC
      LIMIT 5
    `;
    for (const s of srcRows as { source_code: string; isotope: string; next_inventory_date: string }[]) {
      alerts.push({
        id: `src-${s.source_code}`,
        type: "danger",
        module: "Fuentes Radiactivas",
        title: `Inventario vencido: ${s.source_code} (${s.isotope})`,
        detail: `Último inventario programado: ${s.next_inventory_date}`,
        regulation: "NS-06.0 §6 — Control de fuentes selladas",
        action: "/sources",
      });
    }
  } catch { /* tabla no existe aún */ }

  // 4. Radiofármacos próximos a vencer (24h)
  try {
    const { rows: rfRows } = await sql`
      SELECT name, isotope, batch_number, expiry_datetime::text
      FROM radiopharmaceuticals
      WHERE status = 'active'
        AND expiry_datetime <= NOW() + INTERVAL '24 hours'
      ORDER BY expiry_datetime ASC
      LIMIT 5
    `;
    for (const rf of rfRows as { name: string; isotope: string; batch_number: string; expiry_datetime: string }[]) {
      alerts.push({
        id: `rf-${rf.batch_number}`,
        type: "warning",
        module: "Radiofarmacia",
        title: `Radiofármaco próximo a vencer: ${rf.name} (${rf.isotope})`,
        detail: `Lote ${rf.batch_number} · Vence: ${rf.expiry_datetime.slice(0, 16)}`,
        regulation: "DS 3/1985 §12",
        action: "/radiopharmacy",
      });
    }
  } catch { /* tabla no existe aún */ }

  // 5. Incidentes INES ≥ 1 sin cerrar
  try {
    const { rows: incRows } = await sql`
      SELECT id, title, ines_level, incident_date::text
      FROM incidents
      WHERE ines_level >= 1 AND status <> 'closed'
      ORDER BY ines_level DESC, incident_date DESC
      LIMIT 5
    `;
    for (const i of incRows as { id: number; title: string; ines_level: number; incident_date: string }[]) {
      alerts.push({
        id: `inc-${i.id}`,
        type: i.ines_level >= 3 ? "danger" : "warning",
        module: "Incidentes",
        title: `Incidente INES ${i.ines_level} abierto: ${i.title}`,
        detail: `Fecha: ${i.incident_date} · Notificar a CCHEN en 72h`,
        regulation: "NS-06.0 §16 · IAEA INES",
        action: "/incidents",
      });
    }
  } catch { /* tabla no existe aún */ }

  // 6. Requisitos de cumplimiento vencidos
  try {
    const { rows: compRows } = await sql`
      SELECT requirement, regulation, next_review_date::text, priority
      FROM compliance_requirements
      WHERE status IN ('overdue', 'pending')
        AND next_review_date < CURRENT_DATE
        AND priority = 'critical'
      ORDER BY next_review_date ASC
      LIMIT 5
    `;
    for (const c of compRows as { requirement: string; regulation: string; next_review_date: string; priority: string }[]) {
      alerts.push({
        id: `comp-${c.requirement}`,
        type: "danger",
        module: "Cumplimiento",
        title: `Requisito crítico vencido: ${c.requirement}`,
        detail: `Vencía: ${c.next_review_date} · ${c.regulation}`,
        regulation: c.regulation,
        action: "/compliance",
      });
    }
  } catch { /* tabla no existe aún */ }

  // 7. Instrumentos con calibración vencida
  try {
    const { rows: instrRows } = await sql`
      SELECT name, next_calibration_date::text
      FROM instruments
      WHERE status = 'expired'
        OR (next_calibration_date IS NOT NULL AND next_calibration_date < CURRENT_DATE)
      LIMIT 5
    `;
    for (const i of instrRows as { name: string; next_calibration_date: string | null }[]) {
      alerts.push({
        id: `instr-${i.name}`,
        type: "warning",
        module: "Instrumentos",
        title: `Calibración vencida: ${i.name}`,
        detail: `Vencía: ${i.next_calibration_date ?? "fecha no registrada"}`,
        regulation: "NS-06.0 §9",
        action: "/instruments",
      });
    }
  } catch { /* tabla no existe aún */ }

  // 8. Trabajadores con dosis anuales ≥ 15 mSv (nivel investigación DS 3/1985)
  try {
    const currentYear = new Date().getFullYear();
    const { rows: doseRows } = await sql`
      SELECT
        w.name,
        ROUND(SUM(COALESCE(dr.dose_whole_body_msv, 0))::numeric, 2) AS heff_msv
      FROM workers w
      JOIN dosimetry_records dr ON dr.worker_id = w.id AND dr.year = ${currentYear}
      WHERE w.status <> 'inactive'
      GROUP BY w.name
      HAVING SUM(COALESCE(dr.dose_whole_body_msv, 0)) >= 15
      ORDER BY heff_msv DESC
      LIMIT 5
    `;
    for (const d of doseRows as { name: string; heff_msv: string }[]) {
      const heff = parseFloat(d.heff_msv);
      alerts.push({
        id: `dose-${d.name}`,
        type: heff >= 20 ? "danger" : "warning",
        module: "Dosimetría",
        title: `${heff >= 20 ? "Límite superado" : "Nivel investigación"}: ${d.name}`,
        detail: `Heff ${currentYear}: ${heff} mSv / 20 mSv límite anual`,
        regulation: "DS 3/1985 Art. 7 — CCHEN",
        action: "/dosimetry/worker-history",
      });
    }
  } catch { /* tabla no existe aún */ }

  // 9. Zonas clasificadas con monitoreo vencido
  try {
    const { rows: zoneRows } = await sql`
      SELECT name, zone_type, next_survey_date::text
      FROM classified_zones
      WHERE status = 'active'
        AND next_survey_date IS NOT NULL
        AND next_survey_date < CURRENT_DATE
      ORDER BY next_survey_date ASC
      LIMIT 5
    `;
    for (const z of zoneRows as { name: string; zone_type: string; next_survey_date: string }[]) {
      alerts.push({
        id: `zone-${z.name}`,
        type: z.zone_type === "controlada" ? "danger" : "warning",
        module: "Zonas Clasificadas",
        title: `Monitoreo vencido: ${z.name} (zona ${z.zone_type})`,
        detail: `Monitoreo programado para: ${z.next_survey_date}`,
        regulation: "DS 3/1985 Art. 15 — MINSAL",
        action: "/classified-zones",
      });
    }
  } catch { /* tabla no existe aún */ }

  // Check #10: area monitoring — zones with result = 'fail' (tasa supera límite)
  try {
    const { rows: failZones } = await sql`
      SELECT DISTINCT ON (zone_name) zone_name, location, dose_rate_usv_h, expected_annual_dose_msv
      FROM area_monitoring_records
      WHERE result = 'fail'
      ORDER BY zone_name, measurement_date DESC
      LIMIT 5
    `;
    for (const z of failZones as { zone_name: string; location: string; dose_rate_usv_h: number; expected_annual_dose_msv: number }[]) {
      alerts.push({
        id: `area-fail-${z.zone_name}`,
        type: "danger",
        module: "Monitoreo de Área",
        title: `Tasa de dosis excesiva: ${z.zone_name}`,
        detail: `${Number(z.dose_rate_usv_h).toFixed(2)} µSv/h → ~${Number(z.expected_annual_dose_msv).toFixed(1)} mSv/año en ${z.location}`,
        regulation: "DS 3/1985 Art. 15 — MINSAL",
        action: "/area-monitoring",
      });
    }
  } catch { /* tabla no existe aún */ }

  // Check #11: instrument operational check failures (NS-06.0 §8.3)
  try {
    const { rows: instrFail } = await sql`
      SELECT DISTINCT ON (instrument_id) instrument_name, instrument_code, result, check_date
      FROM instrument_operational_checks
      WHERE result = 'fail'
        AND check_date >= now() - interval '7 days'
      ORDER BY instrument_id, check_date DESC
      LIMIT 5
    `;
    for (const ins of instrFail as { instrument_name: string; instrument_code: string; result: string; check_date: string }[]) {
      alerts.push({
        id: `instr-fail-${ins.instrument_name}`,
        type: "danger",
        module: "Instrumentos",
        title: `Verificación fallida: ${ins.instrument_name}${ins.instrument_code ? ` (${ins.instrument_code})` : ""}`,
        detail: `Desviación > ±10% — instrumento fuera de servicio hasta mantención. Última verif.: ${new Date(ins.check_date).toLocaleDateString("es-CL")}`,
        regulation: "NS-06.0 §8.3 — CCHEN",
        action: "/instruments/operational-check",
      });
    }
  } catch { /* tabla no existe aún */ }

  // Sort: danger first, then warning, then info
  const sortOrder = { danger: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => sortOrder[a.type] - sortOrder[b.type]);

  return NextResponse.json({
    total: alerts.length,
    danger: alerts.filter((a) => a.type === "danger").length,
    warning: alerts.filter((a) => a.type === "warning").length,
    alerts,
    generated_at: new Date().toISOString(),
  });
}
