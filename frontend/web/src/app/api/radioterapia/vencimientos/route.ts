import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables, getActionAlertLevel } from "@/lib/radioterapia";
import { ensureLinacTables } from "@/lib/linac";

export const dynamic = "force-dynamic";

type Nivel = "vencida" | "rojo" | "naranjo" | "amarillo" | "verde" | "sin_fecha";

type VencimientoItem = {
  id: string;
  categoria: string;
  descripcion: string;
  responsable: string | null;
  vencimiento: string | null;
  dias: number | null;
  nivel: Nivel;
  fuente: string;
};

function classify(dueDate: any): { nivel: Nivel; dias: number | null } {
  const alert = getActionAlertLevel("pendiente", dueDate);
  if (alert.level === "sin_fecha") return { nivel: "sin_fecha", dias: null };
  if (alert.level === "vencida") return { nivel: "vencida", dias: alert.daysOverdue !== null ? -alert.daysOverdue : null };
  return { nivel: alert.level as Nivel, dias: alert.daysRemaining };
}

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  await ensureLinacTables();

  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");

  const facilitiesRes = facilityId
    ? await sql`SELECT * FROM rt_facilities WHERE id = ${facilityId}`
    : await sql`SELECT * FROM rt_facilities ORDER BY id ASC`;
  const facilities = facilitiesRes.rows;
  const facilityIds: any = facilityId ? [Number(facilityId)] : facilities.map((f: any) => f.id);

  const bunkersRes = facilityIds.length
    ? await sql`SELECT * FROM rt_bunkers WHERE facility_id = ANY(${facilityIds}::int[])`
    : { rows: [] as any[] };
  const bunkers = bunkersRes.rows;
  const bunkerIds: any = bunkers.map((b: any) => b.id);
  const linacIds: any = Array.from(new Set(bunkers.map((b: any) => b.linac_id).filter((v: any) => v !== null && v !== undefined)));

  const items: VencimientoItem[] = [];

  if (linacIds.length) {
    const { rows: auths } = await sql`
      SELECT la.*, lu.name AS linac_name
      FROM linac_authorizations la
      JOIN linac_units lu ON lu.id = la.linac_id
      WHERE la.linac_id = ANY(${linacIds}::int[]) AND la.is_current = true
    `;
    for (const a of auths) {
      const c = classify(a.expiry_date);
      items.push({
        id: `auth-${a.id}`,
        categoria: "Autorizacion acelerador",
        descripcion: `${a.authorization_type || "Autorizacion"} - ${a.linac_name}`,
        responsable: null,
        vencimiento: a.expiry_date,
        dias: c.dias,
        nivel: c.nivel,
        fuente: "linac_authorizations",
      });
    }
  }

  const { rows: workers } = await sql`
    SELECT rut, name, authorization_expiry_date
    FROM workers
    WHERE status <> 'inactive' AND authorization_expiry_date IS NOT NULL
  `;
  for (const w of workers) {
    const c = classify(w.authorization_expiry_date);
    items.push({
      id: `worker-${w.rut}`,
      categoria: "Autorizacion de desempeno",
      descripcion: `${w.name} (${w.rut})`,
      responsable: w.name,
      vencimiento: w.authorization_expiry_date,
      dias: c.dias,
      nivel: c.nivel,
      fuente: "workers",
    });
  }

  const { rows: instruments } = await sql`
    SELECT i.id, i.name, i.code, lc.expiry_date AS last_calibration_expiry
    FROM instruments i
    LEFT JOIN LATERAL (
      SELECT expiry_date FROM calibrations c WHERE c.instrument_id = i.id ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1
    ) lc ON true
    WHERE i.status <> 'dado_de_baja'
  `;
  for (const i of instruments) {
    if (!i.last_calibration_expiry) continue;
    const c = classify(i.last_calibration_expiry);
    items.push({
      id: `instrument-${i.id}`,
      categoria: "Calibracion de instrumento",
      descripcion: `${i.name} (${i.code})`,
      responsable: null,
      vencimiento: i.last_calibration_expiry,
      dias: c.dias,
      nivel: c.nivel,
      fuente: "instruments/calibrations",
    });
  }

  if (facilityIds.length) {
    const { rows: trainings } = await sql`
      SELECT * FROM rt_trainings WHERE facility_id = ANY(${facilityIds}::int[]) AND expiry_date IS NOT NULL
    `;
    for (const t of trainings) {
      const c = classify(t.expiry_date);
      items.push({
        id: `training-${t.id}`,
        categoria: "Capacitacion",
        descripcion: `${t.training_name} - ${t.worker_name}`,
        responsable: t.worker_name,
        vencimiento: t.expiry_date,
        dias: c.dias,
        nivel: c.nivel,
        fuente: "rt_trainings",
      });
    }
  }

  if (bunkerIds.length) {
    const { rows: surveys } = await sql`
      SELECT * FROM rt_radiation_surveys WHERE bunker_id = ANY(${bunkerIds}::int[]) ORDER BY survey_date DESC
    `;
    for (const b of bunkers) {
      const last = surveys.find((s: any) => s.bunker_id === b.id);
      if (!last) continue;
      const next = new Date(last.survey_date);
      next.setDate(next.getDate() + 180);
      const nextStr = next.toISOString().slice(0, 10);
      const c = classify(nextStr);
      items.push({
        id: `survey-${b.id}`,
        categoria: "Levantamiento radiometrico",
        descripcion: `Bunker ${b.name}`,
        responsable: last.responsible,
        vencimiento: nextStr,
        dias: c.dias,
        nivel: c.nivel,
        fuente: "rt_radiation_surveys",
      });
    }
  }

  if (facilityIds.length) {
    const { rows: audits } = await sql`
      SELECT * FROM rt_audits WHERE facility_id = ANY(${facilityIds}::int[])
    `;
    for (const a of audits) {
      if (a.next_audit_date) {
        const c = classify(a.next_audit_date);
        items.push({
          id: `audit-${a.id}`,
          categoria: "Proxima auditoria",
          descripcion: a.title || `Auditoria ${a.audit_type}`,
          responsable: a.lead_auditor,
          vencimiento: a.next_audit_date,
          dias: c.dias,
          nivel: c.nivel,
          fuente: "rt_audits",
        });
      }
    }

    const auditIds = audits.map((a: any) => a.id);
    if (auditIds.length) {
      const { rows: findings } = await sql`
        SELECT f.*, a.title AS audit_title FROM rt_audit_findings f
        JOIN rt_audits a ON a.id = f.audit_id
        WHERE f.audit_id = ANY(${auditIds}::int[]) AND f.status <> 'cerrado' AND f.due_date IS NOT NULL
      `;
      for (const f of findings) {
        const c = classify(f.due_date);
        items.push({
          id: `finding-${f.id}`,
          categoria: "Hallazgo de auditoria",
          descripcion: `${f.description} (${f.audit_title || "auditoria"})`,
          responsable: f.responsible,
          vencimiento: f.due_date,
          dias: c.dias,
          nivel: c.nivel,
          fuente: "rt_audit_findings",
        });
      }
    }
  }

  const order: Record<Nivel, number> = { vencida: 0, rojo: 1, naranjo: 2, amarillo: 3, verde: 4, sin_fecha: 5 };
  items.sort((a, b) => {
    const oa = order[a.nivel];
    const ob = order[b.nivel];
    if (oa !== ob) return oa - ob;
    const da = a.dias ?? 999999;
    const db = b.dias ?? 999999;
    return da - db;
  });

  const summary = {
    total: items.length,
    vencidos: items.filter((i) => i.nivel === "vencida").length,
    criticos7: items.filter((i) => i.nivel === "rojo").length,
    proximos15: items.filter((i) => i.nivel === "naranjo").length,
    proximos30: items.filter((i) => i.nivel === "amarillo").length,
    enPlazo: items.filter((i) => i.nivel === "verde").length,
    sinFecha: items.filter((i) => i.nivel === "sin_fecha").length,
  };

  return NextResponse.json({ ok: true, items, summary });
}
