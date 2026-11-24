// §158 — Auditorías Internas de Protección Radiológica
// DS 3/1985 Arts. 55-57 · CCHEN NS-05.0 §11 · IAEA GSR Part 3 Req. 31
// Planificación, hallazgos, acciones correctivas, seguimiento

import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS audit_plans (
      id              SERIAL PRIMARY KEY,
      audit_code      VARCHAR(30) UNIQUE,
      audit_type      VARCHAR(30) NOT NULL,
      -- audit_type: annual_full, targeted, follow_up, surprise
      title           TEXT NOT NULL,
      scope           TEXT,
      area_audited    TEXT,
      lead_auditor    TEXT,
      team_members    TEXT,
      planned_date    DATE,
      actual_date     DATE,
      status          VARCHAR(20) NOT NULL DEFAULT 'planned',
      -- status: planned, in_progress, completed, cancelled
      overall_result  VARCHAR(20),
      -- overall_result: satisfactory, minor_findings, major_findings, critical
      summary         TEXT,
      cchen_notified  BOOLEAN DEFAULT false,
      report_path     TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_findings (
      id              SERIAL PRIMARY KEY,
      audit_id        INTEGER NOT NULL REFERENCES audit_plans(id),
      finding_code    VARCHAR(20),
      severity        VARCHAR(20) NOT NULL,
      -- severity: critical, major, minor, observation
      category        VARCHAR(40),
      -- category: documentation, training, equipment, procedures, shielding, dosimetry, sources, waste, emergency
      description     TEXT NOT NULL,
      reference_norm  TEXT,
      corrective_action TEXT,
      responsible     TEXT,
      due_date        DATE,
      completion_date DATE,
      verification_date DATE,
      status          VARCHAR(20) NOT NULL DEFAULT 'open',
      -- status: open, in_progress, closed, overdue, verified
      evidence        TEXT,
      notes           TEXT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const { rowCount } = await sql`SELECT 1 FROM audit_plans LIMIT 1`;
  if (!rowCount) {
    const prevYear = new Date().getFullYear() - 1;
    const curYear = new Date().getFullYear();

    await sql`
      INSERT INTO audit_plans
        (audit_code, audit_type, title, scope, area_audited, lead_auditor, team_members,
         planned_date, actual_date, status, overall_result, summary, cchen_notified)
      VALUES
        ('AUD-' || ${prevYear} || '-001', 'annual_full',
         'Auditoría Anual Protección Radiológica ' || ${prevYear},
         'Verificación integral del sistema de gestión de PR: documentación, capacitación, dosimetría, equipos, fuentes, residuos',
         'Todo el Servicio de Medicina Nuclear y Radioterapia',
         'TM. Diego Solís', 'Dr. Martínez, TM. Villarroel',
         (${prevYear} || '-03-15')::date, (${prevYear} || '-03-18')::date,
         'completed', 'minor_findings',
         'Sistema de gestión de PR en condición generalmente satisfactoria. Se identificaron 2 no conformidades menores y 3 observaciones.',
         false),

        ('AUD-' || ${prevYear} || '-002', 'targeted',
         'Auditoría Focalizada — Gestión de Residuos Radiactivos',
         'Verificación de procedimientos de clasificación, almacenamiento y disposición de residuos radiactivos',
         'Sala caliente, almacenamiento de residuos',
         'TM. Diego Solís', 'TM. Fernández',
         (${prevYear} || '-08-20')::date, (${prevYear} || '-08-22')::date,
         'completed', 'satisfactory',
         'No se identificaron no conformidades. Prácticas de gestión de residuos conformes a CCHEN NS-05.0 §9.',
         false),

        ('AUD-' || ${curYear} || '-001', 'annual_full',
         'Auditoría Anual Protección Radiológica ' || ${curYear},
         'Verificación integral del sistema de gestión de PR incluyendo nuevos equipos PET-CT y terapias Lu-177',
         'Todo el Servicio de Medicina Nuclear, Radioterapia y PET-CT',
         'TM. Diego Solís', 'Dr. Martínez, TM. Villarroel, TM. Morales',
         (${curYear} || '-03-10')::date, null,
         'planned', null, null, false),

        ('AUD-' || ${curYear} || '-002', 'follow_up',
         'Seguimiento — Hallazgos Auditoría Anual ' || ${prevYear},
         'Verificación de cierre de no conformidades identificadas en auditoría anual anterior',
         'Áreas con hallazgos previos',
         'TM. Diego Solís', null,
         (${curYear} || '-06-01')::date, null,
         'planned', null, null, false)
    `;

    // Seed findings for first completed audit
    const { rows: audits } = await sql`SELECT id, audit_code FROM audit_plans WHERE status = 'completed' ORDER BY id LIMIT 1`;
    if (audits.length) {
      const auditId = audits[0].id;
      await sql`
        INSERT INTO audit_findings
          (audit_id, finding_code, severity, category, description, reference_norm, corrective_action, responsible, due_date, status, completion_date)
        VALUES
          (${auditId}, 'F-001', 'minor', 'documentation',
           'Registros de calibración dosimétrica del año anterior sin firma del Encargado de Protección Radiológica. Art. 50 DS 3/1985 exige firma del EPR en todos los registros oficiales.',
           'DS 3/1985 Art. 50; CCHEN NS-05.0 §10.3',
           'Revisar y completar la firma del EPR en todos los registros de calibración pendientes del año anterior. Implementar lista de verificación de documentos.',
           'TM. Diego Solís',
           (${new Date().getFullYear() - 1} || '-05-30')::date,
           'closed',
           (${new Date().getFullYear() - 1} || '-05-15')::date),

          (${auditId}, 'F-002', 'minor', 'training',
           'Dos tecnólogos médicos con capacitación de PR básica desactualizada (> 3 años). La CCHEN NS-05.0 §7 establece actualización mínima cada 2 años.',
           'CCHEN NS-05.0 §7.2; DS 3/1985 Art. 15',
           'Programar y ejecutar capacitación de actualización en PR para TM. Fernández y TM. Morales antes del 30 junio.',
           'Jefe de Servicio MN',
           (${new Date().getFullYear() - 1} || '-06-30')::date,
           'closed',
           (${new Date().getFullYear() - 1} || '-06-25')::date),

          (${auditId}, 'F-003', 'observation', 'dosimetry',
           'El procedimiento escrito de lectura mensual de dosímetros no incluye instrucciones explícitas para el registro de dosímetros no devueltos.',
           'CCHEN NS-05.0 §6.4',
           'Actualizar el procedimiento POE-DOS-003 para incluir sección específica de gestión de dosímetros no devueltos y plazos de seguimiento.',
           'TM. Diego Solís',
           (${new Date().getFullYear() - 1} || '-09-30')::date,
           'closed',
           (${new Date().getFullYear() - 1} || '-09-10')::date),

          (${auditId}, 'F-004', 'observation', 'equipment',
           'Medidor de contaminación superficial (Geiger portátil) sin constancia de verificación funcional trimestral en el último trimestre.',
           'CCHEN NS-05.0 §5.3; DS 3/1985 Art. 36',
           'Implementar hoja de registro mensual de verificación funcional para todos los equipos de medición portátiles.',
           'TM. Diego Solís',
           (${new Date().getFullYear() - 1} || '-07-15')::date,
           'verified',
           (${new Date().getFullYear() - 1} || '-07-01')::date),

          (${auditId}, 'F-005', 'observation', 'procedures',
           'Procedimiento de emergencia por contaminación de personal no estaba disponible en sala caliente durante verificación in situ.',
           'DS 3/1985 Art. 44; CCHEN NS-05.0 §8.5',
           'Colocar copia laminada del procedimiento de emergencia por contaminación en sala caliente y verificar disponibilidad en próxima auditoría.',
           'TM. Villarroel',
           (${new Date().getFullYear() - 1} || '-04-30')::date,
           'closed',
           (${new Date().getFullYear() - 1} || '-04-20')::date)
      `;
    }
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const summary = searchParams.get("summary");

  if (summary) {
    const { rows } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_audits,
        COUNT(*) FILTER (WHERE status = 'planned' OR status = 'in_progress') AS pending_audits,
        (SELECT COUNT(*) FROM audit_findings WHERE status IN ('open','in_progress')) AS open_findings,
        (SELECT COUNT(*) FROM audit_findings WHERE status = 'open' AND due_date < CURRENT_DATE) AS overdue_findings,
        (SELECT COUNT(*) FROM audit_findings WHERE severity = 'critical' AND status NOT IN ('closed','verified')) AS critical_open,
        (SELECT COUNT(*) FROM audit_findings WHERE severity = 'major' AND status NOT IN ('closed','verified')) AS major_open
      FROM audit_plans
    `;
    return NextResponse.json({ stats: rows[0] });
  }

  if (id) {
    const { rows: audit } = await sql`SELECT * FROM audit_plans WHERE id = ${Number(id)}`;
    if (!audit.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { rows: findings } = await sql`
      SELECT * FROM audit_findings WHERE audit_id = ${Number(id)}
      ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END,
        due_date ASC NULLS LAST
    `;
    return NextResponse.json({ audit: audit[0], findings });
  }

  const { rows } = await sql`
    SELECT a.*,
      COUNT(f.id) AS total_findings,
      COUNT(f.id) FILTER (WHERE f.severity IN ('critical','major') AND f.status NOT IN ('closed','verified')) AS critical_major_open,
      COUNT(f.id) FILTER (WHERE f.status IN ('open','in_progress')) AS open_findings
    FROM audit_plans a
    LEFT JOIN audit_findings f ON f.audit_id = a.id
    GROUP BY a.id
    ORDER BY a.planned_date DESC
  `;

  return NextResponse.json({ audits: rows });
}

// ─── POST: Create audit plan ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();

  // If creating a finding
  if (body.audit_id && body.description) {
    const { rows } = await sql`
      INSERT INTO audit_findings
        (audit_id, finding_code, severity, category, description, reference_norm,
         corrective_action, responsible, due_date, notes)
      VALUES
        (${body.audit_id}, ${body.finding_code ?? null}, ${body.severity ?? 'minor'},
         ${body.category ?? null}, ${body.description}, ${body.reference_norm ?? null},
         ${body.corrective_action ?? null}, ${body.responsible ?? null},
         ${body.due_date ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ finding: rows[0] }, { status: 201 });
  }

  // Create audit plan
  const year = new Date().getFullYear();
  const { rowCount: cnt } = await sql`SELECT 1 FROM audit_plans WHERE audit_code LIKE ${'AUD-' + year + '-%'}`;
  const seq = String((cnt ?? 0) + 1).padStart(3, "0");
  const code = `AUD-${year}-${seq}`;

  const { rows } = await sql`
    INSERT INTO audit_plans
      (audit_code, audit_type, title, scope, area_audited, lead_auditor, team_members, planned_date)
    VALUES
      (${code}, ${body.audit_type ?? 'annual_full'}, ${body.title},
       ${body.scope ?? null}, ${body.area_audited ?? null},
       ${body.lead_auditor ?? null}, ${body.team_members ?? null},
       ${body.planned_date ?? null})
    RETURNING *
  `;
  return NextResponse.json({ audit: rows[0] }, { status: 201 });
}

// ─── PATCH: Update audit or finding ──────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const findingId = searchParams.get("finding_id");

  if (!id && !findingId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const body = await req.json();

  if (findingId) {
    await sql`
      UPDATE audit_findings SET
        status          = COALESCE(${body.status ?? null}, status),
        corrective_action = COALESCE(${body.corrective_action ?? null}, corrective_action),
        responsible     = COALESCE(${body.responsible ?? null}, responsible),
        due_date        = COALESCE(${body.due_date ?? null}, due_date),
        completion_date = COALESCE(${body.completion_date ?? null}, completion_date),
        verification_date = COALESCE(${body.verification_date ?? null}, verification_date),
        evidence        = COALESCE(${body.evidence ?? null}, evidence),
        notes           = COALESCE(${body.notes ?? null}, notes)
      WHERE id = ${Number(findingId)}
    `;
    const { rows } = await sql`SELECT * FROM audit_findings WHERE id = ${Number(findingId)}`;
    return NextResponse.json({ finding: rows[0] });
  }

  await sql`
    UPDATE audit_plans SET
      status         = COALESCE(${body.status ?? null}, status),
      actual_date    = COALESCE(${body.actual_date ?? null}, actual_date),
      overall_result = COALESCE(${body.overall_result ?? null}, overall_result),
      summary        = COALESCE(${body.summary ?? null}, summary),
      cchen_notified = COALESCE(${body.cchen_notified ?? null}::boolean, cchen_notified),
      report_path    = COALESCE(${body.report_path ?? null}, report_path),
      updated_at     = CURRENT_TIMESTAMP
    WHERE id = ${Number(id)}
  `;
  const { rows } = await sql`SELECT * FROM audit_plans WHERE id = ${Number(id)}`;
  return NextResponse.json({ audit: rows[0] });
}
