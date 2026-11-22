import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS pr_audits (
      id              SERIAL PRIMARY KEY,
      audit_code      VARCHAR(30) UNIQUE NOT NULL,
      title           TEXT NOT NULL,
      audit_type      VARCHAR(30) NOT NULL DEFAULT 'internal',
      scope           TEXT,
      auditor         VARCHAR(120),
      auditee         VARCHAR(120),
      planned_date    DATE,
      start_date      DATE,
      end_date        DATE,
      status          VARCHAR(30) NOT NULL DEFAULT 'planned',
      criteria        TEXT,
      methodology     TEXT,
      summary         TEXT,
      conclusion      TEXT,
      overall_result  VARCHAR(30),
      report_path     TEXT,
      observations    TEXT,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_findings (
      id              SERIAL PRIMARY KEY,
      audit_id        INT NOT NULL REFERENCES pr_audits(id) ON DELETE CASCADE,
      finding_code    VARCHAR(30),
      finding_type    VARCHAR(30) NOT NULL DEFAULT 'observation',
      area            VARCHAR(120),
      description     TEXT NOT NULL,
      criteria_ref    VARCHAR(200),
      severity        VARCHAR(20) DEFAULT 'low',
      responsible     VARCHAR(120),
      due_date        DATE,
      corrective_action TEXT,
      status          VARCHAR(30) NOT NULL DEFAULT 'open',
      closure_date    DATE,
      evidence        TEXT,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const { rows:[{cnt}] } = await sql`SELECT COUNT(*)::int AS cnt FROM pr_audits`;
  if (cnt > 0) return;

  const audits = [
    { code:"AUD-2026-001", title:"Auditoría Interna Programa PR — 1er Semestre 2026", type:"internal", scope:"Dosimetría personal, Zonas clasificadas, Gestión de residuos", auditor:"TM Jefe PR (Externo Dept. Calidad)", auditee:"Servicio Medicina Nuclear", planned:"2026-03-15", start:"2026-03-18", end:"2026-03-20", status:"closed", result:"satisfactory", summary:"Auditoría completada sin hallazgos críticos" },
    { code:"AUD-2026-002", title:"Auditoría CCHEN NS-06.0 — Verificación Documental", type:"cchen", scope:"Programa PR, Documentación, Autorizaciones", auditor:"Inspector CCHEN", auditee:"TM Jefe PR", planned:"2026-05-20", start:"2026-05-20", end:"2026-05-21", status:"closed", result:"satisfactory", summary:"Verificación documental aprobada" },
    { code:"AUD-2026-003", title:"Auditoría Interna — Control de Calidad Instrumentos", type:"internal", scope:"Instrumentos de medición, Calibraciones, Verificaciones", auditor:"Físico Médico", auditee:"TM PR", planned:"2026-08-10", start:"2026-08-12", end:"2026-08-13", status:"closed", result:"minor_nc", summary:"1 no conformidad menor en registros de verificación" },
    { code:"AUD-2026-004", title:"Auditoría Interna Programa PR — 2do Semestre 2026", type:"internal", scope:"Programa completo NS-06.0", auditor:"TM Jefe PR (Externo Dept. Calidad)", auditee:"Servicio Medicina Nuclear", planned:"2026-11-25", start:null, end:null, status:"planned", result:null, summary:null },
  ];
  const idMap: Record<string,number> = {};
  for (const a of audits) {
    const { rows:[r] } = await sql`
      INSERT INTO pr_audits (audit_code, title, audit_type, scope, auditor, auditee,
        planned_date, start_date, end_date, status, overall_result, summary)
      VALUES (${a.code}, ${a.title}, ${a.type}, ${a.scope}, ${a.auditor}, ${a.auditee},
        ${a.planned}, ${a.start??null}, ${a.end??null}, ${a.status}, ${a.result??null}, ${a.summary??null})
      RETURNING id
    `;
    idMap[a.code] = r.id;
  }

  const findings = [
    { audit:"AUD-2026-003", code:"AUD-2026-003-NC-01", type:"non_conformance", area:"Control Instrumentos", desc:"Registros de verificación operacional incompletos para 2 instrumentos durante agosto", ref:"NS-06.0 §3.4.2", sev:"minor", resp:"TM PR", due:"2026-09-30", action:"Implementar lista de verificación digital diaria obligatoria", status:"closed", closure:"2026-09-28" },
    { audit:"AUD-2026-003", code:"AUD-2026-003-OB-01", type:"observation", area:"Calibraciones", desc:"Oportunidad de mejora: implementar alertas automáticas 30 días antes del vencimiento de calibración", ref:"NS-06.0 §3.4.1", sev:"low", resp:"TM Jefe PR", due:"2026-12-31", action:"Integrar sistema de alertas en RPMS", status:"open", closure:null },
    { audit:"AUD-2026-001", code:"AUD-2026-001-OB-01", type:"observation", area:"Dosimetría", desc:"Recomendación de digitalizar todos los registros de dosis previos a 2020", ref:"NS-06.0 §3.2.1", sev:"low", resp:"TM Jefe PR", due:"2026-12-31", action:"Digitalización retroactiva de historiales", status:"open", closure:null },
    { audit:"AUD-2026-002", code:"AUD-2026-002-OB-01", type:"observation", area:"Documentación", desc:"Actualizar referencia normativa en 3 procedimientos que citan versión anterior DS 3/1985", ref:"NS-06.0 §4.3", sev:"low", resp:"TM Jefe PR", due:"2026-07-31", action:"Actualización de referencias en PR-PO-003, PR-PO-004, PR-IN-002", status:"closed", closure:"2026-07-15" },
  ];
  for (const f of findings) {
    const auditId = idMap[f.audit];
    await sql`
      INSERT INTO audit_findings (audit_id, finding_code, finding_type, area, description,
        criteria_ref, severity, responsible, due_date, corrective_action, status, closure_date)
      VALUES (${auditId}, ${f.code}, ${f.type}, ${f.area}, ${f.desc},
        ${f.ref}, ${f.sev}, ${f.resp}, ${f.due??null}, ${f.action}, ${f.status}, ${f.closure??null})
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function GET(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const sp = req.nextUrl.searchParams;
    const type   = sp.get("type") ?? "";
    const status = sp.get("status") ?? "";
    const findings = sp.get("findings") ?? "";

    if (findings === "1") {
      const { rows } = await sql`
        SELECT f.*, a.audit_code, a.title AS audit_title
        FROM audit_findings f JOIN pr_audits a ON a.id = f.audit_id
        WHERE f.active = TRUE
        ORDER BY f.due_date ASC NULLS LAST, f.created_at DESC
      `;
      return NextResponse.json({ rows });
    }

    const { rows } = await sql`
      SELECT a.*,
        COUNT(f.id)                                            ::int AS finding_count,
        COUNT(f.id) FILTER (WHERE f.finding_type='non_conformance') ::int AS nc_count,
        COUNT(f.id) FILTER (WHERE f.status='open')            ::int AS open_findings,
        COUNT(f.id) FILTER (WHERE f.due_date < NOW() AND f.status='open') ::int AS overdue_findings
      FROM pr_audits a
      LEFT JOIN audit_findings f ON f.audit_id = a.id AND f.active = TRUE
      WHERE a.active = TRUE
        AND (${type}   = '' OR a.audit_type = ${type})
        AND (${status} = '' OR a.status     = ${status})
      GROUP BY a.id
      ORDER BY a.planned_date DESC
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(DISTINCT a.id)                                             ::int AS total_audits,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status='closed')           ::int AS completed,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status='planned')          ::int AS planned,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status='in_progress')      ::int AS in_progress,
        COUNT(f.id)                                                      ::int AS total_findings,
        COUNT(f.id) FILTER (WHERE f.finding_type='non_conformance')     ::int AS nc_total,
        COUNT(f.id) FILTER (WHERE f.status='open')                      ::int AS open_findings,
        COUNT(f.id) FILTER (WHERE f.due_date < NOW() AND f.status='open') ::int AS overdue_findings
      FROM pr_audits a
      LEFT JOIN audit_findings f ON f.audit_id = a.id AND f.active = TRUE
      WHERE a.active = TRUE
    `;

    return NextResponse.json({ rows, stats: stats[0] });
  }, NextResponse.json({ rows:[], stats:{} }, { status:500 }));
}

async function nextCode() {
  const yr = new Date().getFullYear();
  const { rows:[{cnt}] } = await sql`SELECT COUNT(*)::int AS cnt FROM pr_audits WHERE audit_code LIKE ${'AUD-'+yr+'%'}`;
  return `AUD-${yr}-${String(cnt+1).padStart(3,"0")}`;
}
async function nextFindingCode(auditCode: string, type: string) {
  const prefix = type === "non_conformance" ? "NC" : "OB";
  const { rows:[{cnt}] } = await sql`SELECT COUNT(*)::int AS cnt FROM audit_findings f JOIN pr_audits a ON a.id=f.audit_id WHERE a.audit_code=${auditCode}`;
  return `${auditCode}-${prefix}-${String(cnt+1).padStart(2,"0")}`;
}

export async function POST(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const b = await req.json();

    if (b._type === "finding") {
      const { audit_id, audit_code, ...rest } = b;
      const code = await nextFindingCode(audit_code ?? "AUD", rest.finding_type ?? "observation");
      const { rows:[row] } = await sql`
        INSERT INTO audit_findings (audit_id, finding_code, finding_type, area, description,
          criteria_ref, severity, responsible, due_date, corrective_action, status)
        VALUES (${audit_id}, ${code}, ${rest.finding_type??'observation'}, ${rest.area??null},
          ${rest.description}, ${rest.criteria_ref??null}, ${rest.severity??'low'},
          ${rest.responsible??null}, ${rest.due_date??null}, ${rest.corrective_action??null},
          ${rest.status??'open'})
        RETURNING *
      `;
      return NextResponse.json(row, { status:201 });
    }

    const code = await nextCode();
    const { rows:[row] } = await sql`
      INSERT INTO pr_audits (audit_code, title, audit_type, scope, auditor, auditee,
        planned_date, start_date, end_date, status, criteria, methodology, summary, observations)
      VALUES (${code}, ${b.title}, ${b.audit_type??'internal'}, ${b.scope??null},
        ${b.auditor??null}, ${b.auditee??null}, ${b.planned_date??null},
        ${b.start_date??null}, ${b.end_date??null}, ${b.status??'planned'},
        ${b.criteria??null}, ${b.methodology??null}, ${b.summary??null}, ${b.observations??null})
      RETURNING *
    `;
    return NextResponse.json(row, { status:201 });
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}

export async function PATCH(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const b = await req.json();
    const { id, _type, ...rest } = b;
    const table = _type === "finding" ? "audit_findings" : "pr_audits";
    const fields = Object.keys(rest);
    if (!fields.length) return NextResponse.json({ error:"no fields" }, { status:400 });
    const setClauses = fields.map((f,i) => `"${f}" = $${i+2}`).join(", ");
    const vals = fields.map(f => (rest as Record<string,unknown>)[f]);
    const { rows:[row] } = await sql.unsafe(
      `UPDATE ${table} SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...vals]
    );
    return NextResponse.json(row);
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}

export async function DELETE(req: NextRequest) {
  return safeQuery(async () => {
    await ensureTable();
    const { id, _type } = await req.json();
    if (_type === "finding") {
      await sql`UPDATE audit_findings SET active = FALSE WHERE id = ${id}`;
    } else {
      await sql`UPDATE pr_audits SET active = FALSE WHERE id = ${id}`;
    }
    return NextResponse.json({ ok:true });
  }, NextResponse.json({ error:"db error" }, { status:500 }));
}
