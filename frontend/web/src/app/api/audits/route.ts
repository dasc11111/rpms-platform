import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Gestión de Auditorías Internas de Protección Radiológica
// DS 3/1985 — Los titulares de instalaciones deben implementar un sistema
// de verificación periódica del cumplimiento de las normas de protección radiológica.
// IAEA GSR Part 3 — Self-assessment and independent audits.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS audits (
      id                SERIAL PRIMARY KEY,
      audit_code        TEXT        NOT NULL UNIQUE,
      title             TEXT        NOT NULL,
      audit_type        TEXT        NOT NULL DEFAULT 'internal',
      scope             TEXT,
      audit_date        DATE        NOT NULL,
      lead_auditor      TEXT,
      team_members      TEXT,
      areas_audited     TEXT,
      criteria          TEXT,
      methodology       TEXT,
      findings_total    INT         DEFAULT 0,
      nc_critical       INT         DEFAULT 0,
      nc_major          INT         DEFAULT 0,
      nc_minor          INT         DEFAULT 0,
      observations      INT         DEFAULT 0,
      opportunities     INT         DEFAULT 0,
      summary           TEXT,
      conclusions       TEXT,
      recommendations   TEXT,
      status            TEXT        NOT NULL DEFAULT 'planned',
      report_date       DATE,
      report_location   TEXT,
      next_audit        DATE,
      responsible       TEXT,
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_findings (
      id              SERIAL PRIMARY KEY,
      audit_id        INT         NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
      finding_ref     TEXT        NOT NULL,
      finding_type    TEXT        NOT NULL DEFAULT 'nc_minor',
      area            TEXT,
      description     TEXT        NOT NULL,
      criteria_ref    TEXT,
      evidence        TEXT,
      risk_level      TEXT        DEFAULT 'low',
      corrective_action TEXT,
      responsible     TEXT,
      due_date        DATE,
      completion_date DATE,
      verification    TEXT,
      status          TEXT        NOT NULL DEFAULT 'open',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM audits LIMIT 1`;
  if (rows.length === 0) {
    const y = new Date().getFullYear();
    const { rows: a1 } = await sql`
      INSERT INTO audits
        (audit_code, title, audit_type, scope, audit_date, lead_auditor, team_members,
         areas_audited, criteria, findings_total, nc_critical, nc_major, nc_minor,
         observations, summary, conclusions, status, report_date, next_audit, responsible)
      VALUES
        ('AUD-PR-001', 'Auditoría Interna Anual Sistema de Protección Radiológica',
         'internal', 'Sistema completo de protección radiológica del Departamento de Medicina Nuclear',
         ${`${y}-03-15`}, 'Encargado PR', 'Jefe PABH, TM Dosimetría',
         'Medicina Nuclear, Radiofarmacia, Almacén de residuos, Zonas clasificadas',
         'DS 3/1985; IAEA GSR Part 3; ISO 19011:2018',
         8, 0, 2, 4, 2,
         'Auditoría programada al sistema completo de PR. Se identificaron 8 hallazgos: 2 NC mayores, 4 NC menores y 2 observaciones.',
         'El sistema de PR funciona adecuadamente. Se requiere mejorar la gestión documental y el programa de monitoreo de área.',
         'completed', ${`${y}-04-01`}, ${`${y + 1}-03-15`}, 'Encargado PR')
      RETURNING id
    `;
    await sql`
      INSERT INTO audit_findings
        (audit_id, finding_ref, finding_type, area, description, criteria_ref,
         risk_level, corrective_action, responsible, due_date, status)
      VALUES
        (${a1[0].id}, 'AUD-PR-001-NC01', 'nc_major', 'Monitoreo de área',
         'Registros de monitoreo de área no actualizados por 3 meses en zona de preparación de radiofármacos.',
         'DS 3/1985 Art. 25', 'medium',
         'Implementar registro electrónico de monitoreo y asignar responsable semanal.',
         'Encargado PR', ${`${y}-06-30`}, 'closed'),
        (${a1[0].id}, 'AUD-PR-001-NC02', 'nc_major', 'Gestión de residuos',
         'Plan de gestión de residuos radiactivos no incluye procedimiento para contenedores de dosis unitaria.',
         'DS 3/1985; IAEA GSG-1', 'medium',
         'Actualizar procedimiento PRP-WM-001 incluyendo protocolo para contenedores unitarios.',
         'Encargado PR', ${`${y}-07-31`}, 'open'),
        (${a1[0].id}, 'AUD-PR-001-NC03', 'nc_minor', 'Dosimetría personal',
         'Tres trabajadores sin registro de entrega de dosímetro durante enero.',
         'DS 3/1985 Art. 18', 'low',
         'Reforzar control de asistencia a dosímetros en reunión mensual.',
         'Jefe PABH', ${`${y}-05-31`}, 'closed'),
        (${a1[0].id}, 'AUD-PR-001-OBS01', 'observation', 'Capacitación',
         'Oportunidad de mejora: capacitación en ALARA no incluye casos prácticos de optimización.',
         'IAEA GSR Part 3 Req. 12', 'low', null, null, null, 'open')
    `;

    await sql`
      INSERT INTO audits
        (audit_code, title, audit_type, scope, audit_date, lead_auditor,
         areas_audited, criteria, status, next_audit, responsible)
      VALUES
        ('AUD-PR-002', 'Auditoría de Seguimiento — Gestión de Residuos',
         'followup', 'Verificación cierre NC mayores auditoría AUD-PR-001',
         ${`${y}-09-20`}, 'Encargado PR',
         'Almacén de residuos, Radiofarmacia',
         'DS 3/1985; IAEA GSG-1; PRP-WM-001',
         'planned', null, 'Encargado PR')
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const year   = searchParams.get("year");
  const type   = searchParams.get("type");
  const status = searchParams.get("status");
  const id     = searchParams.get("id");

  try {
    // Single audit with findings
    if (id) {
      const { rows: audit } = await sql`SELECT * FROM audits WHERE id=${parseInt(id)}`;
      const { rows: findings } = await sql`SELECT * FROM audit_findings WHERE audit_id=${parseInt(id)} ORDER BY finding_ref`;
      return NextResponse.json({ audit: audit[0], findings });
    }

    let rows;
    if (year && type && status) {
      ({ rows } = await sql`SELECT * FROM audits WHERE EXTRACT(YEAR FROM audit_date)=${parseInt(year)} AND audit_type=${type} AND status=${status} ORDER BY audit_date DESC`);
    } else if (year && type) {
      ({ rows } = await sql`SELECT * FROM audits WHERE EXTRACT(YEAR FROM audit_date)=${parseInt(year)} AND audit_type=${type} ORDER BY audit_date DESC`);
    } else if (year && status) {
      ({ rows } = await sql`SELECT * FROM audits WHERE EXTRACT(YEAR FROM audit_date)=${parseInt(year)} AND status=${status} ORDER BY audit_date DESC`);
    } else if (year) {
      ({ rows } = await sql`SELECT * FROM audits WHERE EXTRACT(YEAR FROM audit_date)=${parseInt(year)} ORDER BY audit_date DESC`);
    } else if (type) {
      ({ rows } = await sql`SELECT * FROM audits WHERE audit_type=${type} ORDER BY audit_date DESC`);
    } else if (status) {
      ({ rows } = await sql`SELECT * FROM audits WHERE status=${status} ORDER BY audit_date DESC`);
    } else {
      ({ rows } = await sql`SELECT * FROM audits ORDER BY audit_date DESC`);
    }

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='planned') AS planned,
        COUNT(*) FILTER (WHERE status='in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        SUM(nc_critical)::int AS nc_critical_total,
        SUM(nc_major)::int AS nc_major_total,
        SUM(nc_minor)::int AS nc_minor_total,
        SUM(observations)::int AS obs_total
      FROM audits
    `;

    const { rows: openFindings } = await sql`
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE finding_type='nc_critical') AS critical,
        COUNT(*) FILTER (WHERE finding_type='nc_major') AS major
      FROM audit_findings WHERE status='open'
    `;

    const { rows: years } = await sql`
      SELECT DISTINCT EXTRACT(YEAR FROM audit_date)::int AS y FROM audits ORDER BY y DESC
    `;

    return NextResponse.json({ audits: rows, stats: stats[0], openFindings: openFindings[0], years: years.map(r => r.y) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.audit_code || !body.title || !body.audit_date) {
      return NextResponse.json({ error: "audit_code, title y audit_date requeridos" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO audits
        (audit_code, title, audit_type, scope, audit_date, lead_auditor, team_members,
         areas_audited, criteria, methodology, summary, conclusions, recommendations,
         status, report_date, report_location, next_audit, responsible, notes)
      VALUES
        (${body.audit_code}, ${body.title}, ${body.audit_type ?? "internal"},
         ${body.scope ?? null}, ${body.audit_date}, ${body.lead_auditor ?? null},
         ${body.team_members ?? null}, ${body.areas_audited ?? null}, ${body.criteria ?? null},
         ${body.methodology ?? null}, ${body.summary ?? null}, ${body.conclusions ?? null},
         ${body.recommendations ?? null}, ${body.status ?? "planned"},
         ${body.report_date ?? null}, ${body.report_location ?? null},
         ${body.next_audit ?? null}, ${body.responsible ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ audit: rows[0] }, { status: 201 });
  } catch (err) {
    if (String(err).includes("unique")) {
      return NextResponse.json({ error: "El código ya existe" }, { status: 409 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const editable = ["title","audit_type","scope","audit_date","lead_auditor","team_members",
      "areas_audited","criteria","methodology","findings_total","nc_critical","nc_major","nc_minor",
      "observations","opportunities","summary","conclusions","recommendations","status",
      "report_date","report_location","next_audit","responsible","notes"];
    const fields = Object.keys(body).filter(k => editable.includes(k));
    if (!fields.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });
    const sets = fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ");
    const vals = [id, ...fields.map(f => (body as Record<string, unknown>)[f])];
    const { rows } = await sql.unsafe(`UPDATE audits SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`, vals);
    return NextResponse.json({ audit: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`DELETE FROM audits WHERE id=${parseInt(id)}`;
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
