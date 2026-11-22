import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Gestión de Riesgos Radiológicos
// DS 3/1985 — Artículo 4: El titular de la instalación debe identificar y
// controlar los riesgos radiológicos asociados a las prácticas autorizadas.
// IAEA GSR Part 3 Req. 5 — Justification and optimization (ALARA).

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS risks (
      id              SERIAL PRIMARY KEY,
      risk_code       TEXT        NOT NULL UNIQUE,
      title           TEXT        NOT NULL,
      area            TEXT,
      category        TEXT        NOT NULL DEFAULT 'occupational',
      source          TEXT,
      scenario        TEXT        NOT NULL,
      hazard_type     TEXT        NOT NULL DEFAULT 'external_exposure',
      affected        TEXT,
      probability     INT         NOT NULL DEFAULT 3 CHECK (probability BETWEEN 1 AND 5),
      consequence     INT         NOT NULL DEFAULT 3 CHECK (consequence BETWEEN 1 AND 5),
      risk_score      INT         GENERATED ALWAYS AS (probability * consequence) STORED,
      risk_level      TEXT        NOT NULL DEFAULT 'medium',
      existing_controls TEXT,
      additional_controls TEXT,
      residual_prob   INT         DEFAULT 2 CHECK (residual_prob BETWEEN 1 AND 5),
      residual_cons   INT         DEFAULT 2 CHECK (residual_cons BETWEEN 1 AND 5),
      residual_score  INT         GENERATED ALWAYS AS (residual_prob * residual_cons) STORED,
      residual_level  TEXT        DEFAULT 'low',
      responsible     TEXT,
      due_date        DATE,
      completion_date DATE,
      status          TEXT        NOT NULL DEFAULT 'identified',
      review_date     DATE,
      references_norm TEXT,
      notes           TEXT,
      active          BOOLEAN     DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM risks LIMIT 1`;
  if (rows.length === 0) {
    const y = new Date().getFullYear();
    await sql`
      INSERT INTO risks
        (risk_code, title, area, category, source, scenario, hazard_type, affected,
         probability, consequence, risk_level, existing_controls, additional_controls,
         residual_prob, residual_cons, residual_level, responsible, due_date, status, references_norm)
      VALUES
        ('RSK-MN-001', 'Exposición accidental durante administración IV de radiofármaco',
         'Medicina Nuclear', 'occupational', 'F-18 FDG 370 MBq',
         'Extravasación durante administración intravenosa del radiofármaco al personal y paciente.',
         'external_exposure', 'TM Administrador, Radiofarmacéutico',
         2, 4, 'high',
         'Blindaje jeringa, guantes plomo, minimizar tiempo de contacto, dosimetría personal.',
         'Capacitación técnica inyección IV, protocolo posición brazo, monitoreo dosis extremidades.',
         2, 2, 'low', 'Encargado PR', ${`${y}-06-30`}, 'in_control', 'DS 3/1985 Art. 15; IAEA SRS No. 40'),

        ('RSK-MN-002', 'Contaminación interna por inhalación en preparación de radiofármacos',
         'Radiofarmacia', 'occupational', 'I-131 solución oral',
         'Inhalación de vapores de I-131 durante fraccionamiento sin campana adecuada.',
         'internal_exposure', 'Radiofarmacéutico',
         2, 5, 'high',
         'Campana de flujo laminar, monitoreo de tiroides mensual, filtros HEPA.',
         'Verificación semestral eficiencia campana, dosimetría interna bioassay trimestral.',
         1, 4, 'medium', 'Jefe Radiofarmacia', ${`${y}-09-30`}, 'identified', 'DS 3/1985; ICRP 103'),

        ('RSK-RF-001', 'Exposición de público en sala de espera por pacientes terapéuticos',
         'Medicina Nuclear', 'public', 'I-131 3.7 GBq (terapia)',
         'Pacientes tratados con I-131 terapéutico en sala de espera sin separación adecuada del público.',
         'external_exposure', 'Público general, acompañantes',
         3, 3, 'high',
         'Sala de espera diferenciada, señalética, instrucciones al paciente.',
         'Revisar distancias sala espera, implementar zona exclusiva post-terapia.',
         2, 2, 'low', 'Encargado PR', ${`${y}-04-30`}, 'completed', 'DS 3/1985 Art. 42; IAEA GSG-7'),

        ('RSK-DM-001', 'Pérdida de dosímetro personal con resultado no medible',
         null, 'occupational', null,
         'Trabajador no devuelve dosímetro al período de medición; dosis real del período es desconocida.',
         'external_exposure', 'TOE general',
         3, 2, 'medium',
         'Registro entrega/devolución mensual, alertas vencimiento.',
         'Sistema de alertas automáticas a jefatura 5 días antes del vencimiento.',
         2, 2, 'low', 'Encargado PR', ${`${y}-03-31`}, 'in_control', 'DS 3/1985 Art. 18'),

        ('RSK-WS-001', 'Derrame de residuos líquidos radiactivos durante manipulación',
         'Radiofarmacia', 'occupational', 'Tc-99m eluato, I-131 solución',
         'Volcamiento de recipiente con residuos líquidos radiactivos en área no clasificada.',
         'contamination', 'Personal área, público no controlado',
         2, 4, 'high',
         'Bandejas absorbentes, EPP completo, señalética zonas clasificadas.',
         'Actualizar procedimiento PRP-WM-001, simulacros de derrame semestrales.',
         1, 3, 'low', 'Encargado PR', ${`${y}-07-31`}, 'identified', 'DS 3/1985 Art. 42; IAEA GSG-1')
    `;
  }
}

function computeLevel(score: number): string {
  if (score >= 15) return "critical";
  if (score >= 9)  return "high";
  if (score >= 4)  return "medium";
  return "low";
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const level    = searchParams.get("level");
  const status   = searchParams.get("status");
  const area     = searchParams.get("area");

  try {
    let rows;
    if (category && level) {
      ({ rows } = await sql`SELECT * FROM risks WHERE category=${category} AND risk_level=${level} AND active=true ORDER BY risk_score DESC, risk_code`);
    } else if (category && status) {
      ({ rows } = await sql`SELECT * FROM risks WHERE category=${category} AND status=${status} AND active=true ORDER BY risk_score DESC`);
    } else if (category) {
      ({ rows } = await sql`SELECT * FROM risks WHERE category=${category} AND active=true ORDER BY risk_score DESC`);
    } else if (level) {
      ({ rows } = await sql`SELECT * FROM risks WHERE risk_level=${level} AND active=true ORDER BY risk_score DESC`);
    } else if (status) {
      ({ rows } = await sql`SELECT * FROM risks WHERE status=${status} AND active=true ORDER BY risk_score DESC`);
    } else if (area) {
      ({ rows } = await sql`SELECT * FROM risks WHERE area ILIKE ${'%' + area + '%'} AND active=true ORDER BY risk_score DESC`);
    } else {
      ({ rows } = await sql`SELECT * FROM risks WHERE active=true ORDER BY risk_score DESC, risk_code`);
    }

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE risk_level='critical') AS critical,
        COUNT(*) FILTER (WHERE risk_level='high')     AS high,
        COUNT(*) FILTER (WHERE risk_level='medium')   AS medium,
        COUNT(*) FILTER (WHERE risk_level='low')      AS low,
        COUNT(*) FILTER (WHERE status='identified')   AS identified,
        COUNT(*) FILTER (WHERE status='in_control')   AS in_control,
        COUNT(*) FILTER (WHERE status='completed')    AS completed
      FROM risks WHERE active=true
    `;

    const { rows: areas } = await sql`
      SELECT DISTINCT area FROM risks WHERE active=true AND area IS NOT NULL ORDER BY area
    `;

    return NextResponse.json({ risks: rows, stats: stats[0], areas: areas.map(r => r.area) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.risk_code || !body.scenario) {
      return NextResponse.json({ error: "risk_code y scenario requeridos" }, { status: 400 });
    }
    const prob = parseInt(body.probability) || 3;
    const cons = parseInt(body.consequence) || 3;
    const rProb = parseInt(body.residual_prob) || 2;
    const rCons = parseInt(body.residual_cons) || 2;
    const level    = computeLevel(prob * cons);
    const rLevel   = computeLevel(rProb * rCons);

    const { rows } = await sql`
      INSERT INTO risks
        (risk_code, title, area, category, source, scenario, hazard_type, affected,
         probability, consequence, risk_level, existing_controls, additional_controls,
         residual_prob, residual_cons, residual_level, responsible, due_date,
         status, review_date, references_norm, notes)
      VALUES
        (${body.risk_code}, ${body.title ?? body.scenario.slice(0,80)},
         ${body.area ?? null}, ${body.category ?? "occupational"}, ${body.source ?? null},
         ${body.scenario}, ${body.hazard_type ?? "external_exposure"}, ${body.affected ?? null},
         ${prob}, ${cons}, ${level}, ${body.existing_controls ?? null},
         ${body.additional_controls ?? null}, ${rProb}, ${rCons}, ${rLevel},
         ${body.responsible ?? null}, ${body.due_date ?? null},
         ${body.status ?? "identified"}, ${body.review_date ?? null},
         ${body.references_norm ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ risk: rows[0] }, { status: 201 });
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

    // Recalculate levels if scores changed
    const editable = ["title","area","category","source","scenario","hazard_type","affected",
      "probability","consequence","risk_level","existing_controls","additional_controls",
      "residual_prob","residual_cons","residual_level","responsible","due_date",
      "completion_date","status","review_date","references_norm","notes","active"];
    const fields = Object.keys(body).filter(k => editable.includes(k));
    if (!fields.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });

    // Auto-compute levels
    const extra: string[] = [];
    const extraVals: unknown[] = [];
    if ("probability" in body || "consequence" in body) {
      const { rows: cur } = await sql`SELECT probability, consequence FROM risks WHERE id=${id}`;
      const p = parseInt(String(body.probability ?? cur[0]?.probability ?? 3));
      const c = parseInt(String(body.consequence ?? cur[0]?.consequence ?? 3));
      if (!fields.includes("risk_level")) {
        extra.push(`risk_level = $${fields.length + 2 + extraVals.length}`);
        extraVals.push(computeLevel(p * c));
      }
    }
    if ("residual_prob" in body || "residual_cons" in body) {
      const { rows: cur } = await sql`SELECT residual_prob, residual_cons FROM risks WHERE id=${id}`;
      const p = parseInt(String(body.residual_prob ?? cur[0]?.residual_prob ?? 2));
      const c = parseInt(String(body.residual_cons ?? cur[0]?.residual_cons ?? 2));
      if (!fields.includes("residual_level")) {
        extra.push(`residual_level = $${fields.length + 2 + extraVals.length}`);
        extraVals.push(computeLevel(p * c));
      }
    }

    const sets = [...fields.map((f, i) => `"${f}" = $${i + 2}`), ...extra].join(", ");
    const vals = [id, ...fields.map(f => (body as Record<string, unknown>)[f]), ...extraVals];
    const { rows } = await sql.unsafe(`UPDATE risks SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`, vals);
    return NextResponse.json({ risk: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`UPDATE risks SET active=false, updated_at=now() WHERE id=${parseInt(id)}`;
    return NextResponse.json({ deactivated: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
