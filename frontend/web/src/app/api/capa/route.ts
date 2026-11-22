import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §74 CAPA — Corrective and Preventive Actions (No Conformidades y Acciones Correctivas)
// NS-06.0 §8.3: El programa PR debe incluir un sistema de seguimiento de no conformidades,
// acciones correctivas y preventivas con evidencia de cierre.

async function ensureTables() {
  // Main CAPA records table
  await sql`
    CREATE TABLE IF NOT EXISTS capa_records (
      id              SERIAL PRIMARY KEY,
      capa_code       TEXT        NOT NULL UNIQUE,
      title           TEXT        NOT NULL,
      description     TEXT,
      capa_type       TEXT        NOT NULL DEFAULT 'corrective'
                      CHECK (capa_type IN ('corrective','preventive','improvement','observation')),
      source          TEXT        NOT NULL DEFAULT 'audit'
                      CHECK (source IN ('audit','incident','inspection','self-detection','measurement','complaint','other')),
      source_ref      TEXT,       -- e.g. audit code, incident ID
      severity        TEXT        NOT NULL DEFAULT 'minor'
                      CHECK (severity IN ('critical','major','minor','observation')),
      status          TEXT        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','in_progress','pending_verification','closed','cancelled')),
      responsible     TEXT,
      responsible_dept TEXT,
      detected_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
      due_date        DATE,
      closed_date     DATE,
      root_cause      TEXT,
      root_cause_category TEXT
                      CHECK (root_cause_category IN ('human','process','equipment','environment','management','other') OR root_cause_category IS NULL),
      immediate_action TEXT,
      corrective_action TEXT,
      preventive_action TEXT,
      effectiveness_criteria TEXT,
      verification_date DATE,
      verified_by     TEXT,
      effectiveness_ok BOOLEAN,
      evidence        TEXT,
      notes           TEXT,
      cchen_notified  BOOLEAN     DEFAULT false,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Action tasks within a CAPA
  await sql`
    CREATE TABLE IF NOT EXISTS capa_actions (
      id              SERIAL PRIMARY KEY,
      capa_id         INTEGER     REFERENCES capa_records(id) ON DELETE CASCADE,
      action_type     TEXT        NOT NULL DEFAULT 'corrective'
                      CHECK (action_type IN ('corrective','preventive','immediate')),
      description     TEXT        NOT NULL,
      responsible     TEXT,
      due_date        DATE,
      completed_date  DATE,
      status          TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_progress','completed','cancelled')),
      evidence        TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function nextCode(): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await sql.unsafe(
    `SELECT COUNT(*) AS n FROM capa_records WHERE capa_code LIKE $1`,
    [`CAPA-${year}-%`]
  );
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `CAPA-${year}-${String(n).padStart(3, "0")}`;
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM capa_records`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const seeds = [
    {
      capa_code: "CAPA-2026-001",
      title: "Dosímetro sin lectura mensual — 3 trabajadores Medicina Nuclear",
      capa_type: "corrective",
      source: "audit",
      source_ref: "AUD-2026-001",
      severity: "major",
      status: "closed",
      responsible: "Jefe Medicina Nuclear",
      responsible_dept: "Medicina Nuclear",
      detected_date: "2026-02-15",
      due_date: "2026-03-15",
      closed_date: "2026-03-10",
      root_cause: "Proceso de envío de dosímetros no estaba estandarizado",
      root_cause_category: "process",
      immediate_action: "Se contactó al personal y se regularizaron los dosímetros pendientes",
      corrective_action: "Se implementó lista de verificación mensual de envío de dosímetros con firma del jefe de servicio",
      preventive_action: "Se incluyó el control de dosimetría en la reunión mensual del Comité PR",
      effectiveness_criteria: "0 trabajadores sin lectura en los 3 meses siguientes",
      verification_date: "2026-06-15",
      verified_by: "Encargado PR",
      effectiveness_ok: true,
      evidence: "Registros de dosimetría meses marzo-mayo 2026 sin omisiones",
    },
    {
      capa_code: "CAPA-2026-002",
      title: "Instrumento de monitoreo Ludlum sin calibración vigente",
      capa_type: "corrective",
      source: "inspection",
      source_ref: "INSP-CCHEN-2026-01",
      severity: "major",
      status: "closed",
      responsible: "Encargado de Instrumentos",
      responsible_dept: "Protección Radiológica",
      detected_date: "2026-03-20",
      due_date: "2026-04-20",
      closed_date: "2026-04-18",
      root_cause: "No existía sistema de alerta para vencimiento de calibraciones",
      root_cause_category: "management",
      immediate_action: "El instrumento fue retirado de uso y etiquetado",
      corrective_action: "Se envió el instrumento a calibrar con laboratorio CCHEN autorizado",
      preventive_action: "Se configuraron alertas automáticas 60 y 30 días antes del vencimiento en RPMS",
      effectiveness_criteria: "Todos los instrumentos con calibración vigente en próxima inspección",
      verification_date: "2026-07-01",
      verified_by: "Encargado PR",
      effectiveness_ok: true,
      evidence: "Certificado de calibración LUD-2026-04 vigente hasta 2027",
    },
    {
      capa_code: "CAPA-2026-003",
      title: "Procedimiento de manejo de residuos radiactivos desactualizado",
      capa_type: "corrective",
      source: "audit",
      source_ref: "AUD-2026-002",
      severity: "minor",
      status: "in_progress",
      responsible: "Químico Farmacéutico",
      responsible_dept: "Radiofarmacia",
      detected_date: "2026-04-10",
      due_date: "2026-07-10",
      root_cause: "Procedimientos no fueron actualizados al cambiar a nuevo proveedor de Tc-99m",
      root_cause_category: "process",
      immediate_action: "Se suspendió uso del procedimiento hasta actualización",
      corrective_action: "Revisión y actualización del PR-PR-003 con nuevas instrucciones del proveedor",
      effectiveness_criteria: "Procedimiento aprobado y vigente con al menos 1 capacitación al personal",
    },
    {
      capa_code: "CAPA-2026-004",
      title: "Área supervisada sin señalización visible — PET/CT",
      capa_type: "corrective",
      source: "self-detection",
      severity: "minor",
      status: "closed",
      responsible: "Tecnólogo Médico PET/CT",
      responsible_dept: "Medicina Nuclear",
      detected_date: "2026-05-05",
      due_date: "2026-05-20",
      closed_date: "2026-05-18",
      root_cause: "Señalética se deterioró y no fue reportada a mantención",
      root_cause_category: "process",
      immediate_action: "Se instalaron señales provisionales impresas",
      corrective_action: "Se solicitó e instaló nueva señalética certificada",
      preventive_action: "Se incluyó inspección visual de señalética en rondas semanales de control",
      verification_date: "2026-06-05",
      verified_by: "Encargado PR",
      effectiveness_ok: true,
    },
    {
      capa_code: "CAPA-2026-005",
      title: "Capacitación radioprotección no completada — 2 funcionarios nuevos",
      capa_type: "corrective",
      source: "audit",
      source_ref: "AUD-2026-003",
      severity: "major",
      status: "pending_verification",
      responsible: "Jefe RRHH",
      responsible_dept: "Recursos Humanos",
      detected_date: "2026-06-01",
      due_date: "2026-08-01",
      root_cause: "Proceso de inducción no incluía capacitación PR obligatoria para funciones POE",
      root_cause_category: "management",
      immediate_action: "Se programó capacitación de emergencia para los 2 funcionarios",
      corrective_action: "Se actualizó protocolo de inducción para incluir capacitación PR antes del inicio de funciones",
      preventive_action: "Se coordinó con RRHH para bloquear acceso a áreas controladas hasta completar capacitación",
      effectiveness_criteria: "100% de nuevos POE con capacitación antes de inicio de funciones",
      verification_date: "2026-10-01",
    },
    {
      capa_code: "CAPA-2026-006",
      title: "ACCIÓN PREVENTIVA: Riesgo de contaminación superficial en laboratorio hot",
      capa_type: "preventive",
      source: "measurement",
      severity: "minor",
      status: "open",
      responsible: "Encargado PR",
      responsible_dept: "Protección Radiológica",
      detected_date: "2026-07-15",
      due_date: "2026-10-15",
      root_cause: "Tendencia creciente en lecturas de contaminación superficial en últimos 3 meses",
      root_cause_category: "process",
      immediate_action: "Se realizó limpieza profunda del laboratorio y verificación de técnica de manipulación",
      preventive_action: "Implementar protocolo de descontaminación semanal y auditoría de técnica de manipulación",
      effectiveness_criteria: "Lecturas de contaminación bajo 0.4 Bq/cm2 en próximas 4 mediciones",
    },
  ];

  for (const s of seeds) {
    await sql.unsafe(
      `INSERT INTO capa_records (${Object.keys(s).join(",")})
       VALUES (${Object.keys(s).map((_,i)=>`$${i+1}`).join(",")})
       ON CONFLICT (capa_code) DO NOTHING`,
      Object.values(s)
    );
  }

  // Seed actions for CAPA-001
  const { rows: c1 } = await sql`SELECT id FROM capa_records WHERE capa_code='CAPA-2026-001'`;
  if (c1.length > 0) {
    const id = c1[0].id;
    await sql.unsafe(
      `INSERT INTO capa_actions (capa_id, action_type, description, responsible, due_date, completed_date, status, evidence)
       VALUES ($1,'immediate','Contactar al personal afectado y regularizar envío de dosímetros',$2,'2026-02-20','2026-02-18','completed','Correo de confirmación + entrega registrada')
       ON CONFLICT DO NOTHING`,
      [id, "Encargado PR"]
    );
    await sql.unsafe(
      `INSERT INTO capa_actions (capa_id, action_type, description, responsible, due_date, completed_date, status, evidence)
       VALUES ($1,'corrective','Implementar lista de verificación mensual de envío de dosímetros',$2,'2026-03-15','2026-03-10','completed','Lista LV-DOS-001 aprobada y en uso')
       ON CONFLICT DO NOTHING`,
      [id, "Jefe Medicina Nuclear"]
    );
  }
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const type   = sp.get("type");
    const source = sp.get("source");
    const status = sp.get("status");
    const severity = sp.get("severity");
    const capaId = sp.get("capa_id");

    // Return actions for a specific CAPA
    if (capaId) {
      const { rows: actions } = await sql.unsafe(
        `SELECT * FROM capa_actions WHERE capa_id = $1 ORDER BY created_at`,
        [parseInt(capaId)]
      );
      return NextResponse.json({ actions });
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (type)     { params.push(type);     conditions.push(`capa_type = $${params.length}`); }
    if (source)   { params.push(source);   conditions.push(`source = $${params.length}`); }
    if (status)   { params.push(status);   conditions.push(`status = $${params.length}`); }
    if (severity) { params.push(severity); conditions.push(`severity = $${params.length}`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await sql.unsafe(
      `SELECT c.*,
              (SELECT COUNT(*) FROM capa_actions a WHERE a.capa_id = c.id)::int AS total_actions,
              (SELECT COUNT(*) FROM capa_actions a WHERE a.capa_id = c.id AND a.status='completed')::int AS completed_actions,
              CASE WHEN c.due_date < CURRENT_DATE AND c.status NOT IN ('closed','cancelled') THEN true ELSE false END AS overdue
       FROM capa_records c
       ${where}
       ORDER BY
         CASE c.severity WHEN 'critical' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 ELSE 4 END,
         CASE c.status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'pending_verification' THEN 3 ELSE 4 END,
         c.created_at DESC`,
      params
    );

    // Stats
    const stats = await safeQuery(async () => {
      const { rows: s } = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='open')::int AS open,
          COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress,
          COUNT(*) FILTER (WHERE status='pending_verification')::int AS pending_verification,
          COUNT(*) FILTER (WHERE status='closed')::int AS closed,
          COUNT(*) FILTER (WHERE capa_type='corrective')::int AS corrective,
          COUNT(*) FILTER (WHERE capa_type='preventive')::int AS preventive,
          COUNT(*) FILTER (WHERE severity='critical')::int AS critical,
          COUNT(*) FILTER (WHERE severity='major')::int AS major,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('closed','cancelled'))::int AS overdue,
          COUNT(*) FILTER (WHERE effectiveness_ok=true)::int AS effective_closed,
          COUNT(*) FILTER (WHERE effectiveness_ok IS NOT NULL)::int AS verified_total
        FROM capa_records
      `;
      return s[0];
    }, {});

    return NextResponse.json({ capas: rows, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { _type, ...data } = body;

    // Create a CAPA action
    if (_type === "action") {
      const { capa_id, action_type, description, responsible, due_date } = data;
      const { rows } = await sql.unsafe(
        `INSERT INTO capa_actions (capa_id, action_type, description, responsible, due_date)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [capa_id, action_type, description, responsible, due_date || null]
      );
      return NextResponse.json({ action: rows[0] }, { status: 201 });
    }

    // Create a CAPA record
    const code = data.capa_code || await nextCode();
    const fields = { capa_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO capa_records (${keys.join(",")})
       VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")})
       RETURNING *`,
      vals
    );
    return NextResponse.json({ capa: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { _type, id, ...rest } = body;

    if (_type === "action") {
      const fields = Object.keys(rest);
      const values = Object.values(rest);
      const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
      values.push(id);
      const { rows } = await sql.unsafe(
        `UPDATE capa_actions SET ${set} WHERE id=$${values.length} RETURNING *`,
        values
      );
      return NextResponse.json({ action: rows[0] });
    }

    const fields = Object.keys(rest);
    const values = Object.values(rest);
    const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
    values.push(id);
    const { rows } = await sql.unsafe(
      `UPDATE capa_records SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ capa: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { _type, id } = body;
    if (_type === "action") {
      await sql.unsafe(`DELETE FROM capa_actions WHERE id=$1`, [id]);
      return NextResponse.json({ ok: true });
    }
    await sql.unsafe(`UPDATE capa_records SET status='cancelled', updated_at=now() WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
