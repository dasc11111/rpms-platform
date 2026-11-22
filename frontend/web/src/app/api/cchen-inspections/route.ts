import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §79 — Seguimiento de Recomendaciones de Inspecciones CCHEN
// DS 3/1985 Art. 15 + NS-06.0 §8.2: El establecimiento debe implementar
// las recomendaciones emitidas por CCHEN dentro de los plazos acordados
// y mantener registro de su estado de cumplimiento.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS cchen_inspections (
      id                SERIAL PRIMARY KEY,
      inspection_code   TEXT        NOT NULL UNIQUE,
      inspection_date   DATE        NOT NULL,
      inspection_type   TEXT        NOT NULL DEFAULT 'routine'
                        CHECK (inspection_type IN ('routine','announced','unannounced','follow_up','licensing')),
      inspectors        TEXT,
      cchen_report_number TEXT,
      establishment_name TEXT       DEFAULT 'Hospital Dr. Hernán Henríquez Aravena',
      areas_inspected   TEXT,
      overall_rating    TEXT        DEFAULT 'satisfactory'
                        CHECK (overall_rating IN ('satisfactory','conditional','unsatisfactory','critical')),
      total_findings    INTEGER     DEFAULT 0,
      critical_findings INTEGER     DEFAULT 0,
      status            TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','closed','verified_cchen')),
      next_inspection_date DATE,
      notes             TEXT,
      active            BOOLEAN     DEFAULT true,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS cchen_findings (
      id                SERIAL PRIMARY KEY,
      inspection_id     INTEGER     REFERENCES cchen_inspections(id) ON DELETE CASCADE,
      finding_code      TEXT        NOT NULL,
      finding_type      TEXT        NOT NULL DEFAULT 'recommendation'
                        CHECK (finding_type IN ('critical','major','minor','recommendation','observation')),
      description       TEXT        NOT NULL,
      area              TEXT,
      ns_reference      TEXT,
      responsible       TEXT,
      due_date          DATE,
      completion_date   DATE,
      status            TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','completed','verified','cancelled')),
      action_taken      TEXT,
      evidence          TEXT,
      capa_id           INTEGER,
      notes             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function nextCode(year: number): Promise<string> {
  const { rows } = await sql.unsafe(
    `SELECT COUNT(*) AS n FROM cchen_inspections WHERE EXTRACT(YEAR FROM inspection_date)=$1`, [year]
  );
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `INSP-CCHEN-${year}-${String(n).padStart(2, "0")}`;
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM cchen_inspections`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const year = new Date().getFullYear();

  const inspections = [
    {
      inspection_code: `INSP-CCHEN-${year - 1}-01`,
      inspection_date: `${year - 1}-06-15`,
      inspection_type: "routine",
      inspectors: "Ing. Carlos Méndez (CCHEN), Físico Médico: Dra. Paula Vidal (CCHEN)",
      cchen_report_number: `CCH-INS-${year - 1}-0234`,
      areas_inspected: "Medicina Nuclear, Radiología, Área de Almacenamiento de Residuos Radiactivos, Sala de Preparación de Radiofármacos",
      overall_rating: "conditional",
      total_findings: 7,
      critical_findings: 1,
      status: "closed",
      next_inspection_date: `${year}-06-01`,
      notes: `Inspección rutinaria anual. Se detectó 1 hallazgo crítico: dosímetro vencido en uso. 6 recomendaciones en áreas de mejora. Todos los hallazgos subsanados al cierre de la inspección de seguimiento.`,
    },
    {
      inspection_code: `INSP-CCHEN-${year}-01`,
      inspection_date: `${year}-03-20`,
      inspection_type: "follow_up",
      inspectors: "Ing. Carlos Méndez (CCHEN)",
      cchen_report_number: `CCH-INS-${year}-0089`,
      areas_inspected: "Medicina Nuclear, Radiología",
      overall_rating: "satisfactory",
      total_findings: 2,
      critical_findings: 0,
      status: "in_progress",
      next_inspection_date: `${year + 1}-03-01`,
      notes: `Inspección de seguimiento a hallazgos de ${year - 1}. Calificación satisfactoria general. 2 recomendaciones menores subsistentes en documentación.`,
    },
  ];

  const findingsBatch: Array<{ inspection_code: string; findings: Array<Record<string, unknown>> }> = [
    {
      inspection_code: `INSP-CCHEN-${year - 1}-01`,
      findings: [
        {
          finding_code: `HALL-${year - 1}-001`,
          finding_type: "critical",
          description: "Dosímetro TLD del TM. Juan Pérez con período de calibración vencido hace 4 meses. El instrumento siguió en uso sin calibración vigente.",
          area: "Medicina Nuclear",
          ns_reference: "NS-06.0 §5.2 — DS 3/1985 Art. 12",
          responsible: "Encargado PR",
          due_date: `${year - 1}-07-15`,
          completion_date: `${year - 1}-07-10`,
          status: "verified",
          action_taken: "Instrumento retirado de uso inmediatamente. Se realizó nueva calibración. Procedimiento de control de calibración revisado y actualizado. CAPA-2024-002 iniciada.",
          evidence: "Certificado de calibración N° CAL-2024-089, Procedimiento PR-005 Rev.3",
          notes: "Hallazgo crítico — generó CAPA-2024-002 y mejora del sistema de control de vencimientos",
        },
        {
          finding_code: `HALL-${year - 1}-002`,
          finding_type: "major",
          description: "Falta de señalización de área controlada en puerta de acceso a sala caliente. Señal de radiación no visible desde el pasillo.",
          area: "Medicina Nuclear",
          ns_reference: "NS-06.0 §4.5 — DS 3/1985 Art. 9",
          responsible: "Encargado PR",
          due_date: `${year - 1}-07-30`,
          completion_date: `${year - 1}-07-25`,
          status: "verified",
          action_taken: "Señalización de radiación instalada en puerta de acceso. Se agregó señalización luminosa adicional.",
          evidence: "Fotografía de señalización instalada, registro de inspección interna Jul-2024",
        },
        {
          finding_code: `HALL-${year - 1}-003`,
          finding_type: "minor",
          description: "Registro de dosis de área no actualizado por 2 meses consecutivos. Formulario de monitoreo de área sin firmar.",
          area: "Sala de Preparación",
          ns_reference: "NS-06.0 §5.4",
          responsible: "TM. María González",
          due_date: `${year - 1}-07-15`,
          completion_date: `${year - 1}-07-12`,
          status: "verified",
          action_taken: "Registros actualizados. Se estableció recordatorio mensual. Revisión del procedimiento de monitoreo de área.",
        },
        {
          finding_code: `HALL-${year - 1}-004`,
          finding_type: "recommendation",
          description: "Se recomienda aumentar la frecuencia de calibración de monitores de contaminación superficial de anual a semestral.",
          area: "Medicina Nuclear",
          ns_reference: "NS-06.0 §5.2",
          responsible: "Encargado PR",
          due_date: `${year - 1}-12-31`,
          completion_date: `${year - 1}-11-15`,
          status: "completed",
          action_taken: "Contrato de calibración semestral establecido con INDEG. Próxima calibración programada para abril.",
        },
        {
          finding_code: `HALL-${year - 1}-005`,
          finding_type: "observation",
          description: "Se observa stock de delantales plomados con baja en inventario. Algunos presentan fisuras menores en las zonas de doblado.",
          area: "Radiología",
          ns_reference: "NS-06.0 §4.6",
          responsible: "Jefe de Radiología",
          due_date: `${year}-03-31`,
          completion_date: `${year}-02-15`,
          status: "completed",
          action_taken: "4 delantales dados de baja y reemplazados. Proceso de adquisición de 6 delantales adicionales completado.",
          evidence: "Acta de baja N° INV-2024-089, factura de nuevos delantales",
        },
      ],
    },
    {
      inspection_code: `INSP-CCHEN-${year}-01`,
      findings: [
        {
          finding_code: `HALL-${year}-001`,
          finding_type: "minor",
          description: "Plan de respuesta a emergencias radiológicas no actualizado con la nueva dotación de personal POE de 2025.",
          area: "Gestión General PR",
          ns_reference: "NS-06.0 §9.1",
          responsible: "Encargado PR",
          due_date: `${year}-06-30`,
          status: "in_progress",
          action_taken: "Revisión del plan de emergencia en curso. Se tiene fecha comprometida de actualización para junio.",
        },
        {
          finding_code: `HALL-${year}-002`,
          finding_type: "recommendation",
          description: "Se recomienda digitalizar el registro de dosis individual acumulada histórica, actualmente en formato papel desde 2018.",
          area: "Dosimetría",
          ns_reference: "NS-06.0 §4.3",
          responsible: "Encargado PR",
          due_date: `${year}-12-31`,
          status: "pending",
          notes: "Recomendación de largo plazo. Se evaluará el uso del sistema RPMS para la digitalización.",
        },
      ],
    },
  ];

  for (const insp of inspections) {
    const keys = Object.keys(insp);
    const vals = Object.values(insp);
    await sql.unsafe(
      `INSERT INTO cchen_inspections (${keys.join(",")})
       VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")})
       ON CONFLICT (inspection_code) DO NOTHING`,
      vals
    );
  }

  for (const batch of findingsBatch) {
    const { rows: inspRows } = await sql.unsafe(
      `SELECT id FROM cchen_inspections WHERE inspection_code=$1`,
      [batch.inspection_code]
    );
    if (!inspRows[0]) continue;
    const inspId = inspRows[0].id;
    for (const f of batch.findings) {
      const fields = { inspection_id: inspId, ...f };
      const keys = Object.keys(fields);
      const vals = Object.values(fields);
      await sql.unsafe(
        `INSERT INTO cchen_findings (${keys.join(",")})
         VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")})
         ON CONFLICT DO NOTHING`,
        vals
      );
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const inspId = sp.get("insp_id");
    const findingStatus = sp.get("finding_status") ?? "";
    const type = sp.get("type") ?? "";

    if (inspId) {
      const params: unknown[] = [parseInt(inspId)];
      let where = "inspection_id=$1";
      if (findingStatus) { params.push(findingStatus); where += ` AND status=$${params.length}`; }
      if (type) { params.push(type); where += ` AND finding_type=$${params.length}`; }
      const { rows } = await sql.unsafe(
        `SELECT * FROM cchen_findings WHERE ${where} ORDER BY
           CASE finding_type WHEN 'critical' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 WHEN 'recommendation' THEN 4 ELSE 5 END,
           due_date NULLS LAST`,
        params
      );
      return NextResponse.json({ findings: rows });
    }

    const { rows } = await sql`
      SELECT i.*,
        (SELECT COUNT(*)::int FROM cchen_findings f WHERE f.inspection_id=i.id) AS findings_total,
        (SELECT COUNT(*)::int FROM cchen_findings f WHERE f.inspection_id=i.id AND f.status IN ('completed','verified')) AS findings_done,
        (SELECT COUNT(*)::int FROM cchen_findings f WHERE f.inspection_id=i.id AND f.status='pending' AND f.due_date < CURRENT_DATE) AS findings_overdue
      FROM cchen_inspections i
      WHERE i.active=true
      ORDER BY i.inspection_date DESC
    `;

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql`
        SELECT
          COUNT(DISTINCT i.id)::int AS total_inspections,
          COUNT(DISTINCT i.id) FILTER (WHERE i.status='open' OR i.status='in_progress')::int AS open_inspections,
          COUNT(f.id)::int AS total_findings,
          COUNT(f.id) FILTER (WHERE f.status='pending')::int AS pending_findings,
          COUNT(f.id) FILTER (WHERE f.status='in_progress')::int AS inprogress_findings,
          COUNT(f.id) FILTER (WHERE f.status IN ('completed','verified'))::int AS closed_findings,
          COUNT(f.id) FILTER (WHERE f.finding_type='critical' AND f.status NOT IN ('completed','verified','cancelled'))::int AS open_critical,
          COUNT(f.id) FILTER (WHERE f.status='pending' AND f.due_date < CURRENT_DATE)::int AS overdue_findings
        FROM cchen_inspections i
        LEFT JOIN cchen_findings f ON f.inspection_id=i.id
        WHERE i.active=true
      `;
      return s[0];
    }, {});

    return NextResponse.json({ inspections: rows, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { _type, ...data } = body;

    if (_type === "finding") {
      const keys = Object.keys(data);
      const vals = Object.values(data);
      const { rows } = await sql.unsafe(
        `INSERT INTO cchen_findings (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
        vals
      );
      return NextResponse.json({ finding: rows[0] }, { status: 201 });
    }

    const dateYear = data.inspection_date
      ? new Date(data.inspection_date as string).getFullYear()
      : new Date().getFullYear();
    const code = data.inspection_code || await nextCode(dateYear);
    const fields = { inspection_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO cchen_inspections (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ inspection: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { _type, id, ...rest } = body;
    const fields = Object.keys(rest);
    const values = Object.values(rest);
    const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
    values.push(id);

    if (_type === "finding") {
      const { rows } = await sql.unsafe(
        `UPDATE cchen_findings SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
        values
      );
      return NextResponse.json({ finding: rows[0] });
    }

    const { rows } = await sql.unsafe(
      `UPDATE cchen_inspections SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ inspection: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { _type, id } = await req.json();
    if (_type === "finding") {
      await sql.unsafe(`UPDATE cchen_findings SET status='cancelled', updated_at=now() WHERE id=$1`, [id]);
    } else {
      await sql.unsafe(`UPDATE cchen_inspections SET active=false, updated_at=now() WHERE id=$1`, [id]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
