import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS improvement_plans (
    id              SERIAL PRIMARY KEY,
    plan_code       TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT,
    plan_type       TEXT DEFAULT 'improvement',
    source          TEXT,
    priority        TEXT DEFAULT 'medium',
    responsible     TEXT,
    sponsor         TEXT,
    start_date      DATE,
    target_date     DATE,
    completion_date DATE,
    progress        INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'planned',
    success_criteria TEXT,
    kpi_description TEXT,
    kpi_baseline    TEXT,
    kpi_target      TEXT,
    kpi_current     TEXT,
    budget          NUMERIC(12,2),
    budget_used     NUMERIC(12,2),
    related_nc      TEXT,
    related_finding TEXT,
    observations    TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS improvement_actions (
    id            SERIAL PRIMARY KEY,
    plan_id       INTEGER REFERENCES improvement_plans(id),
    action_code   TEXT NOT NULL,
    description   TEXT NOT NULL,
    responsible   TEXT,
    start_date    DATE,
    due_date      DATE,
    completion_date DATE,
    status        TEXT DEFAULT 'pending',
    evidence      TEXT,
    observations  TEXT,
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  )`;

  const { rows } = await sql`SELECT COUNT(*) FROM improvement_plans WHERE active=TRUE`;
  if (Number(rows[0].count) === 0) {
    const { rows: p1 } = await sql`INSERT INTO improvement_plans
      (plan_code,title,description,plan_type,source,priority,responsible,sponsor,start_date,target_date,
       progress,status,success_criteria,kpi_description,kpi_baseline,kpi_target,kpi_current) VALUES
      ('MJ-2026-001','Reducción de dosis colectiva Medicina Nuclear',
       'Plan para reducir la dosis colectiva del equipo de Medicina Nuclear mediante optimización de protocolos y equipos de protección',
       'improvement','Revisión ALARA 2025','high','Fís. Med. Diego Solís','Director Médico',
       '2026-01-01','2026-12-31',45,'in_progress',
       'Reducir dosis colectiva en al menos 20% respecto al año anterior',
       'Dosis colectiva anual (mSv/año)','8.4 mSv (2025)','≤6.7 mSv','4.2 mSv acumulado Q1-Q2')
    RETURNING id`;

    const { rows: p2 } = await sql`INSERT INTO improvement_plans
      (plan_code,title,description,plan_type,source,priority,responsible,start_date,target_date,
       progress,status,success_criteria,kpi_description,kpi_baseline,kpi_target) VALUES
      ('MJ-2026-002','Implementación sistema de gestión documental PR',
       'Digitalización y control de versiones de todos los procedimientos y registros del programa PR',
       'improvement','Auditoría interna 2025','medium','TM. Andrea López',
       '2026-02-01','2026-07-31',70,'in_progress',
       '100% de documentos PR en sistema digital con control de versiones',
       'Documentos digitalizados (%)','30%','100%')
    RETURNING id`;

    await sql`INSERT INTO improvement_plans
      (plan_code,title,description,plan_type,source,priority,responsible,start_date,target_date,
       progress,status,related_nc) VALUES
      ('MJ-2026-003','Corrección deficiencia señalética zona PET/CT',
       'Actualizar señalética de zona controlada PET/CT según nueva norma CCHEN 2025',
       'corrective','No-conformidad NC-2026-003','high','TM. Carlos Rivas',
       '2026-03-01','2026-04-30',100,'completed','NC-2026-003')`;

    await sql`INSERT INTO improvement_plans
      (plan_code,title,description,plan_type,source,priority,responsible,start_date,target_date,
       progress,status,success_criteria) VALUES
      ('MJ-2025-004','Programa de calibración de instrumentos',
       'Establecer programa sistemático de calibración para todos los instrumentos de medida de radiación',
       'improvement','Revisión anual 2024','medium','Fís. Med. Diego Solís',
       '2025-01-01','2025-12-31',100,'completed',
       'Todos los instrumentos con calibración vigente y certificado CCHEN')`;

    if (p1.length) {
      const pid = p1[0].id;
      await sql`INSERT INTO improvement_actions (plan_id,action_code,description,responsible,due_date,status,evidence) VALUES
        (${pid},'MJ-2026-001-A01','Actualizar protocolo de administración I-131 con blindaje adicional','TM. Andrea López','2026-03-31','completed','Procedimiento PR-MN-005 v2.1 aprobado'),
        (${pid},'MJ-2026-001-A02','Adquirir 2 delantales plomados adicionales para Medicina Nuclear','Jefe Dpto. PR','2026-04-30','completed','OC-2026-0234 recepcionada'),
        (${pid},'MJ-2026-001-A03','Implementar dosimetría de cristalino para todo el personal MN','Fís. Med. Diego Solís','2026-06-30','in_progress',NULL),
        (${pid},'MJ-2026-001-A04','Revisión semestral de dosis y ajuste de protocolos ALARA','Fís. Med. Diego Solís','2026-12-31','pending',NULL)`;
    }

    if (p2.length) {
      const pid = p2[0].id;
      await sql`INSERT INTO improvement_actions (plan_id,action_code,description,responsible,due_date,status) VALUES
        (${pid},'MJ-2026-002-A01','Levantar inventario completo de documentos PR vigentes','TM. Andrea López','2026-02-28','completed'),
        (${pid},'MJ-2026-002-A02','Digitalizar procedimientos operacionales (20 docs)','TM. Andrea López','2026-04-30','completed'),
        (${pid},'MJ-2026-002-A03','Digitalizar registros de dosimetría (histórico 5 años)','Fís. Med. Diego Solís','2026-06-30','in_progress'),
        (${pid},'MJ-2026-002-A04','Capacitar a todo el personal en uso del sistema','TM. Andrea López','2026-07-31','pending')`;
    }
  }
}

async function nextPlanCode() {
  const year = new Date().getFullYear();
  const { rows } = await sql`SELECT plan_code FROM improvement_plans WHERE plan_code LIKE ${`MJ-${year}-%`} ORDER BY plan_code DESC LIMIT 1`;
  if (!rows.length) return `MJ-${year}-001`;
  const n = parseInt((rows[0].plan_code as string).split("-").pop() ?? "0") + 1;
  return `MJ-${year}-${String(n).padStart(3,"0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const type   = sp.get("type");
    const priority = sp.get("priority");

    const { rows } = await sql`
      SELECT p.*,
        CASE WHEN p.target_date < NOW() AND p.status NOT IN ('completed','cancelled') THEN TRUE ELSE FALSE END AS is_overdue,
        (SELECT COUNT(*) FROM improvement_actions a WHERE a.plan_id=p.id AND a.active=TRUE) AS action_count,
        (SELECT COUNT(*) FROM improvement_actions a WHERE a.plan_id=p.id AND a.status='completed' AND a.active=TRUE) AS actions_done,
        COALESCE((SELECT json_agg(a ORDER BY a.due_date ASC) FROM improvement_actions a WHERE a.plan_id=p.id AND a.active=TRUE),'[]'::json) AS actions
      FROM improvement_plans p
      WHERE p.active=TRUE
        AND (${status}::text IS NULL OR p.status=${status})
        AND (${type}::text IS NULL OR p.plan_type=${type})
        AND (${priority}::text IS NULL OR p.priority=${priority})
      ORDER BY
        CASE p.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        p.target_date ASC NULLS LAST
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE active=TRUE) AS total,
        COUNT(*) FILTER (WHERE status='planned' AND active=TRUE) AS planned,
        COUNT(*) FILTER (WHERE status='in_progress' AND active=TRUE) AS in_progress,
        COUNT(*) FILTER (WHERE status='completed' AND active=TRUE) AS completed,
        COUNT(*) FILTER (WHERE priority='high' AND status!='completed' AND active=TRUE) AS high_priority,
        COUNT(*) FILTER (WHERE target_date < NOW() AND status NOT IN ('completed','cancelled') AND active=TRUE) AS overdue,
        ROUND(AVG(progress) FILTER (WHERE status='in_progress' AND active=TRUE))::int AS avg_progress
      FROM improvement_plans
    `;

    return NextResponse.json({ rows, stats: stats[0] });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const b = await req.json();

    if (b._type === "action") {
      const { rows } = await sql`
        INSERT INTO improvement_actions (plan_id,action_code,description,responsible,start_date,due_date,status,observations)
        VALUES (${b.plan_id},${b.action_code},${b.description},${b.responsible??null},${b.start_date??null},${b.due_date??null},${b.status??"pending"},${b.observations??null})
        RETURNING *`;
      return NextResponse.json(rows[0], { status: 201 });
    }

    const code = await nextPlanCode();
    const { rows } = await sql`
      INSERT INTO improvement_plans (plan_code,title,description,plan_type,source,priority,responsible,sponsor,
        start_date,target_date,progress,status,success_criteria,kpi_description,kpi_baseline,kpi_target,
        budget,related_nc,related_finding,observations)
      VALUES (${code},${b.title},${b.description??null},${b.plan_type??"improvement"},${b.source??null},
        ${b.priority??"medium"},${b.responsible??null},${b.sponsor??null},
        ${b.start_date??null},${b.target_date??null},${b.progress??0},${b.status??"planned"},
        ${b.success_criteria??null},${b.kpi_description??null},${b.kpi_baseline??null},${b.kpi_target??null},
        ${b.budget??null},${b.related_nc??null},${b.related_finding??null},${b.observations??null})
      RETURNING *`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    if (b._type === "action") {
      const fields = Object.entries(b).filter(([k]) => !["id","_type"].includes(k));
      const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
      const { rows } = await sql.unsafe(
        `UPDATE improvement_actions SET ${sets} WHERE id=$1 RETURNING *`,
        [b.id, ...fields.map(([,v])=>v)]
      );
      return NextResponse.json(rows[0]);
    }

    const fields = Object.entries(b).filter(([k]) => k !== "id");
    const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
    const { rows } = await sql.unsafe(
      `UPDATE improvement_plans SET ${sets}, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [b.id, ...fields.map(([,v])=>v)]
    );
    return NextResponse.json(rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const b = await req.json();
    if (b._type === "action") {
      await sql`UPDATE improvement_actions SET active=FALSE WHERE id=${b.id}`;
    } else {
      await sql`UPDATE improvement_plans SET active=FALSE WHERE id=${b.id}`;
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
