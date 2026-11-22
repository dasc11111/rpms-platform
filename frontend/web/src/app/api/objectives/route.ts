import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §76 — Objetivos PR y Plan de Trabajo Anual
// NS-06.0 §8.1: El programa PR debe establecer objetivos anuales medibles,
// con responsables, plazos y criterios de cumplimiento documentados.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS pr_objectives (
      id              SERIAL PRIMARY KEY,
      year            INTEGER     NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::int,
      obj_code        TEXT        NOT NULL UNIQUE,
      title           TEXT        NOT NULL,
      description     TEXT,
      category        TEXT        NOT NULL DEFAULT 'dosimetry'
                      CHECK (category IN ('dosimetry','training','instruments','documents','safety','audits','committee','alara','other')),
      responsible     TEXT,
      responsible_dept TEXT,
      target_value    NUMERIC(10,2),
      target_unit     TEXT,
      target_direction TEXT        DEFAULT 'higher_better'
                      CHECK (target_direction IN ('higher_better','lower_better','achieve')),
      q1_progress     NUMERIC(5,2),
      q2_progress     NUMERIC(5,2),
      q3_progress     NUMERIC(5,2),
      q4_progress     NUMERIC(5,2),
      q1_notes        TEXT,
      q2_notes        TEXT,
      q3_notes        TEXT,
      q4_notes        TEXT,
      current_value   NUMERIC(10,2),
      status          TEXT        NOT NULL DEFAULT 'planned'
                      CHECK (status IN ('planned','in_progress','achieved','partial','not_achieved','cancelled')),
      priority        TEXT        NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('critical','high','medium','low')),
      ns_reference    TEXT,
      evidence        TEXT,
      active          BOOLEAN     DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS pr_work_items (
      id              SERIAL PRIMARY KEY,
      objective_id    INTEGER     REFERENCES pr_objectives(id) ON DELETE CASCADE,
      title           TEXT        NOT NULL,
      description     TEXT,
      responsible     TEXT,
      due_date        DATE,
      quarter         INTEGER     CHECK (quarter BETWEEN 1 AND 4),
      status          TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_progress','completed','cancelled')),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function nextCode(year: number): Promise<string> {
  const { rows } = await sql.unsafe(
    `SELECT COUNT(*) AS n FROM pr_objectives WHERE year = $1`,
    [year]
  );
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `OBJ-${year}-${String(n).padStart(2, "0")}`;
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM pr_objectives`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const year = new Date().getFullYear();
  const seeds = [
    {
      year, obj_code: `OBJ-${year}-01`,
      title: "Mantener dosis efectiva promedio POE < 5 mSv/año",
      description: "Implementar optimización ALARA para reducir exposición promedio del personal",
      category: "dosimetry", responsible: "Encargado PR", responsible_dept: "Protección Radiológica",
      target_value: 5, target_unit: "mSv/año", target_direction: "lower_better",
      status: "in_progress", priority: "critical",
      q1_progress: 100, q2_progress: 85, q3_progress: 90,
      q1_notes: "Dosis Q1: 1.2 mSv promedio", q2_notes: "Dosis Q2: 1.4 mSv promedio",
      q3_notes: "Dosis Q3: 1.3 mSv promedio",
      current_value: 3.9,
      ns_reference: "DS 3/1985 Art. 8 — NS-06.0 §4.3",
    },
    {
      year, obj_code: `OBJ-${year}-02`,
      title: "Capacitar al 100% del personal POE en radioprotección",
      description: "Realizar al menos 1 capacitación formal de radioprotección para todo el personal POE",
      category: "training", responsible: "Encargado PR", responsible_dept: "Protección Radiológica",
      target_value: 100, target_unit: "%", target_direction: "higher_better",
      status: "in_progress", priority: "high",
      q1_progress: 60, q2_progress: 75, q3_progress: 90,
      q1_notes: "Capacitación básica RN completada para 60% POE",
      q2_notes: "Capacitación manejo residuos completada",
      q3_notes: "Capacitación emergencias en curso",
      current_value: 90,
      ns_reference: "NS-06.0 §6.1",
    },
    {
      year, obj_code: `OBJ-${year}-03`,
      title: "0 instrumentos con calibración vencida en inspección CCHEN",
      description: "Garantizar que todos los instrumentos de medición cuenten con calibración vigente durante todo el año",
      category: "instruments", responsible: "Encargado de Instrumentos",
      target_value: 0, target_unit: "instrumentos", target_direction: "lower_better",
      status: "partial", priority: "critical",
      q1_progress: 100, q2_progress: 100, q3_progress: 70,
      q1_notes: "Todos los instrumentos calibrados al cierre Q1",
      q2_notes: "Sin vencimientos en Q2",
      q3_notes: "1 instrumento vencido en julio — subsanado con CAPA-2026-002",
      current_value: 0,
      ns_reference: "NS-06.0 §5.2",
    },
    {
      year, obj_code: `OBJ-${year}-04`,
      title: "Revisar y actualizar el 100% de documentos vencidos PR",
      description: "Poner al día todos los documentos del programa PR con revisión periódica vencida",
      category: "documents", responsible: "Químico Farmacéutico",
      target_value: 100, target_unit: "%", target_direction: "higher_better",
      status: "in_progress", priority: "high",
      q1_progress: 30, q2_progress: 60,
      q1_notes: "2 documentos actualizados",
      q2_notes: "4 documentos actualizados, 2 en proceso",
      current_value: 60,
      ns_reference: "NS-06.0 §4.1",
    },
    {
      year, obj_code: `OBJ-${year}-05`,
      title: "Realizar al menos 2 auditorías internas del programa PR",
      description: "Ejecutar auditorías internas completas del Programa de Protección Radiológica",
      category: "audits", responsible: "Encargado PR",
      target_value: 2, target_unit: "auditorías", target_direction: "higher_better",
      status: "achieved", priority: "high",
      q1_progress: 50, q2_progress: 100,
      q1_notes: "AUD-2026-001 realizada en marzo",
      q2_notes: "AUD-2026-002 realizada en junio — objetivo alcanzado",
      current_value: 4,
      ns_reference: "NS-06.0 §8.2 — Auditorías internas",
      evidence: "Informes AUD-2026-001 a AUD-2026-004 archivados en sistema",
    },
    {
      year, obj_code: `OBJ-${year}-06`,
      title: "Cerrar el 80% de las CAPA abiertas antes del cierre del año",
      description: "Seguimiento y cierre de acciones correctivas y preventivas del programa",
      category: "safety", responsible: "Encargado PR",
      target_value: 80, target_unit: "%", target_direction: "higher_better",
      status: "in_progress", priority: "medium",
      q1_progress: 40, q2_progress: 60, q3_progress: 70,
      q1_notes: "2 de 5 CAPA cerradas",
      q2_notes: "3 de 5 CAPA cerradas",
      q3_notes: "4 de 6 CAPA en proceso de cierre",
      current_value: 67,
      ns_reference: "NS-06.0 §8.3",
    },
    {
      year, obj_code: `OBJ-${year}-07`,
      title: "Mantener 0 incidentes de categoría INES ≥ 1",
      description: "Prevenir incidentes radiológicos clasificados en la escala INES nivel 1 o superior",
      category: "safety", responsible: "Encargado PR",
      target_value: 0, target_unit: "incidentes INES≥1", target_direction: "lower_better",
      status: "achieved", priority: "critical",
      q1_progress: 100, q2_progress: 100, q3_progress: 100,
      q1_notes: "Sin incidentes INES≥1 en Q1", q2_notes: "Sin incidentes en Q2", q3_notes: "Sin incidentes en Q3",
      current_value: 0,
      ns_reference: "DS 3/1985 — NS-06.0 §9.1",
      evidence: "Registro de incidentes sin eventos INES≥1 en el año",
    },
    {
      year, obj_code: `OBJ-${year}-08`,
      title: "Realizar al menos 4 sesiones del Comité PR",
      description: "Cumplir con la periodicidad mínima requerida por NS-06.0 para el Comité PR",
      category: "committee", responsible: "Presidente Comité PR",
      target_value: 4, target_unit: "sesiones", target_direction: "higher_better",
      status: "in_progress", priority: "high",
      q1_progress: 25, q2_progress: 50, q3_progress: 75,
      q1_notes: "1ra sesión — enero", q2_notes: "2da sesión — abril",
      q3_notes: "3ra sesión — julio",
      current_value: 3,
      ns_reference: "NS-06.0 §7.1",
    },
  ];

  for (const s of seeds) {
    const keys = Object.keys(s);
    const vals = Object.values(s);
    await sql.unsafe(
      `INSERT INTO pr_objectives (${keys.join(",")})
       VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")})
       ON CONFLICT (obj_code) DO NOTHING`,
      vals
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
    const year = parseInt(sp.get("year") ?? String(new Date().getFullYear()), 10);
    const objId = sp.get("obj_id");

    // Work items for a specific objective
    if (objId) {
      const { rows } = await sql.unsafe(
        `SELECT * FROM pr_work_items WHERE objective_id=$1 ORDER BY quarter, due_date`,
        [parseInt(objId)]
      );
      return NextResponse.json({ work_items: rows });
    }

    const category = sp.get("category") ?? "";
    const status   = sp.get("status") ?? "";
    const conditions: string[] = [`year = $1`];
    const params: unknown[] = [year];
    if (category) { params.push(category); conditions.push(`category=$${params.length}`); }
    if (status)   { params.push(status);   conditions.push(`status=$${params.length}`); }

    const { rows } = await sql.unsafe(
      `SELECT o.*,
        (SELECT COUNT(*) FROM pr_work_items w WHERE w.objective_id=o.id)::int AS work_items_total,
        (SELECT COUNT(*) FROM pr_work_items w WHERE w.objective_id=o.id AND w.status='completed')::int AS work_items_done
       FROM pr_objectives o
       WHERE ${conditions.join(" AND ")} AND active=true
       ORDER BY
         CASE o.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         o.obj_code`,
      params
    );

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql.unsafe(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='achieved')::int AS achieved,
          COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress,
          COUNT(*) FILTER (WHERE status='planned')::int AS planned,
          COUNT(*) FILTER (WHERE status='partial')::int AS partial,
          COUNT(*) FILTER (WHERE status='not_achieved')::int AS not_achieved,
          COUNT(*) FILTER (WHERE priority='critical')::int AS critical,
          ROUND(AVG(CASE
            WHEN q4_progress IS NOT NULL THEN q4_progress
            WHEN q3_progress IS NOT NULL THEN q3_progress
            WHEN q2_progress IS NOT NULL THEN q2_progress
            WHEN q1_progress IS NOT NULL THEN q1_progress
            ELSE 0 END), 1)::float AS avg_progress
         FROM pr_objectives WHERE year = $1 AND active=true`,
        [year]
      );
      return s[0];
    }, {});

    return NextResponse.json({ objectives: rows, stats, year });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { _type, ...data } = body;

    if (_type === "work_item") {
      const keys = Object.keys(data);
      const vals = Object.values(data);
      const { rows } = await sql.unsafe(
        `INSERT INTO pr_work_items (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
        vals
      );
      return NextResponse.json({ work_item: rows[0] }, { status: 201 });
    }

    const year = data.year ?? new Date().getFullYear();
    const code = data.obj_code || await nextCode(year);
    const fields = { obj_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO pr_objectives (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ objective: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { _type, id, ...rest } = body;

    if (_type === "work_item") {
      const fields = Object.keys(rest);
      const values = Object.values(rest);
      const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
      values.push(id);
      const { rows } = await sql.unsafe(
        `UPDATE pr_work_items SET ${set} WHERE id=$${values.length} RETURNING *`,
        values
      );
      return NextResponse.json({ work_item: rows[0] });
    }

    const fields = Object.keys(rest);
    const values = Object.values(rest);
    const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
    values.push(id);
    const { rows } = await sql.unsafe(
      `UPDATE pr_objectives SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ objective: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { _type, id } = await req.json();
    if (_type === "work_item") {
      await sql.unsafe(`DELETE FROM pr_work_items WHERE id=$1`, [id]);
    } else {
      await sql.unsafe(`UPDATE pr_objectives SET active=false, updated_at=now() WHERE id=$1`, [id]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
