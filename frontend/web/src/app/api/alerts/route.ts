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

  // 8. Trabajadores con dosis anuales superando umbrales DS 3/1985 Art.7
  try {
    const currentYear = new Date().getFullYear();
    const yearStr = String(currentYear);
    // Consulta compatible con nueva tabla dosimetry_readings
    const { rows: doseRows } = await sql`
      SELECT
        d.worker_name,
        d.worker_rut,
        COALESCE(w.category, 'B') AS category,
        ROUND(SUM(d.dose)::numeric, 3) AS total_dose
      FROM dosimetry_readings d
      LEFT JOIN workers w ON w.rut = d.worker_rut
      WHERE (d.period LIKE ${yearStr + '-%'} OR d.period LIKE ${'%/' + yearStr} OR d.period LIKE ${yearStr + '%'})
        AND (d.body_region = 'whole_body' OR d.body_region IS NULL)
        AND d.status NOT IN ('lost', 'not_worn', 'damaged')
      GROUP BY d.worker_name, d.worker_rut, w.category
      HAVING SUM(d.dose) >= 15
      ORDER BY total_dose DESC
      LIMIT 5
    `;
    for (const d of doseRows as { worker_name: string; worker_rut: string | null; category: string; total_dose: string }[]) {
      const dose = parseFloat(d.total_dose);
      const limit = d.category === "A" ? 50 : 15;
      const exceeded = dose >= limit;
      alerts.push({
        id: `dose-${d.worker_name}`,
        type: exceeded ? "danger" : "warning",
        module: "Dosimetría",
        title: `${exceeded ? "Límite anual superado" : "Umbral investigación"}: ${d.worker_name}`,
        detail: `Heff ${currentYear}: ${dose.toFixed(2)} mSv / ${limit} mSv (Cat.${d.category})`,
        regulation: "DS 3/1985 MINSAL Art. 7",
        action: "/dosimetry",
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

  // Check #12: fuentes en préstamo con fecha de retorno vencida (IMAR)
  try {
    const { rows: overdueLoans } = await sql`
      SELECT DISTINCT ON (source_id) source_name, isotope, destination_location, expected_return_date
      FROM source_movements
      WHERE movement_type = 'prestamo'
        AND expected_return_date IS NOT NULL
        AND expected_return_date < CURRENT_DATE
        AND id NOT IN (
          SELECT sm2.id FROM source_movements sm2
          WHERE sm2.movement_type = 'devolucion'
            AND sm2.source_id = source_movements.source_id
            AND sm2.movement_date >= source_movements.movement_date
        )
      ORDER BY source_id, movement_date DESC
      LIMIT 5
    `;
    for (const l of overdueLoans as { source_name: string; isotope: string | null; destination_location: string | null; expected_return_date: string }[]) {
      alerts.push({
        id: `imar-loan-${l.source_name}`,
        type: "danger",
        module: "Movimientos IMAR",
        title: `Préstamo IMAR vencido: ${l.source_name}${l.isotope ? ` (${l.isotope})` : ""}`,
        detail: `Retorno esperado: ${new Date(l.expected_return_date).toLocaleDateString("es-CL")} · Destino: ${l.destination_location ?? "s/d"}`,
        regulation: "NS-04 CCHEN — Registro de Movimientos de Material Radiactivo",
        action: "/sources/movements",
      });
    }
  } catch { /* tabla no existe aún */ }

  // Check #13: personas en zona radiológica > 8h sin registrar egreso (posible olvido)
  try {
    const { rows: longStay } = await sql`
      SELECT person_name, zone_name, zone_type, entry_datetime,
             EXTRACT(EPOCH FROM (NOW() - entry_datetime))/3600 AS hours_inside
      FROM zone_access_log
      WHERE exit_datetime IS NULL
        AND entry_datetime < NOW() - INTERVAL '8 hours'
      ORDER BY entry_datetime ASC
      LIMIT 5
    `;
    for (const p of longStay as { person_name: string; zone_name: string; zone_type: string; entry_datetime: string; hours_inside: number }[]) {
      const h = Math.round(p.hours_inside);
      alerts.push({
        id: `zone-stay-${p.person_name}-${p.entry_datetime}`,
        type: p.zone_type === "controlada" ? "danger" : "warning",
        module: "Control de Acceso",
        title: `Persona en zona sin egreso: ${p.person_name}`,
        detail: `${p.zone_name} (${p.zone_type}) · ${h}h desde ingreso · Verificar egreso o exposición acumulada`,
        regulation: "DS 3/1985 MINSAL Art.15 / NS-06.0 CCHEN",
        action: "/zone-access",
      });
    }
  } catch { /* tabla no existe aún */ }

  // Check #14: novedades con seguimiento vencido sin cerrar (DS 3/1985 Art.32)
  try {
    const { rows: overdueFollowUp } = await sql`
      SELECT id, zone_name, event_type, description, reported_by, follow_up_date::text
      FROM operational_logbook
      WHERE follow_up_required = TRUE
        AND follow_up_date < CURRENT_DATE
        AND status != 'closed'
      ORDER BY follow_up_date ASC
      LIMIT 5
    `;
    for (const e of overdueFollowUp as { id: number; zone_name: string | null; event_type: string; description: string; reported_by: string; follow_up_date: string }[]) {
      alerts.push({
        id: `logbook-followup-${e.id}`,
        type: "warning",
        module: "Libro de Novedades",
        title: `Seguimiento vencido: ${e.event_type}`,
        detail: `Zona: ${e.zone_name ?? "N/A"} · Vencido: ${e.follow_up_date} · Rep: ${e.reported_by}`,
        regulation: "DS 3/1985 MINSAL Art. 32",
        action: "/logbook",
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
