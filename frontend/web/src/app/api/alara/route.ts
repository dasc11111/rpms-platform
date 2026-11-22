import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ── ensure tables ──────────────────────────────────────────────────────────
async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS alara_objectives (
      id              SERIAL PRIMARY KEY,
      year            INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
      title           TEXT NOT NULL,
      description     TEXT,
      category        TEXT NOT NULL DEFAULT 'optimization',  -- optimization|dose_reduction|technical|administrative
      target_metric   TEXT,                                   -- e.g. "avg_dose_msv"
      baseline_value  NUMERIC(10,4),
      target_value    NUMERIC(10,4),
      current_value   NUMERIC(10,4),
      unit            TEXT,
      status          TEXT NOT NULL DEFAULT 'planned',       -- planned|in_progress|achieved|not_achieved|cancelled
      priority        TEXT NOT NULL DEFAULT 'medium',        -- high|medium|low
      responsible     TEXT,
      due_date        DATE,
      completion_date DATE,
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS alara_measures (
      id              SERIAL PRIMARY KEY,
      objective_id    INT REFERENCES alara_objectives(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      description     TEXT,
      measure_type    TEXT NOT NULL DEFAULT 'technical',     -- technical|administrative|ppe|training|procedure
      area            TEXT,
      status          TEXT NOT NULL DEFAULT 'proposed',      -- proposed|approved|implementing|completed|rejected
      estimated_reduction_pct NUMERIC(5,2),
      actual_reduction_pct    NUMERIC(5,2),
      cost_clp        NUMERIC(12,0),
      responsible     TEXT,
      implementation_date DATE,
      verification_date   DATE,
      verification_result TEXT,
      doc_ref         TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS alara_reviews (
      id              SERIAL PRIMARY KEY,
      year            INT NOT NULL,
      quarter         INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
      review_date     DATE NOT NULL,
      conducted_by    TEXT,
      overall_assessment TEXT,  -- satisfactory|needs_improvement|critical
      collective_dose_msv NUMERIC(10,4),
      max_individual_msv  NUMERIC(10,4),
      avg_individual_msv  NUMERIC(10,4),
      incidents_count INT DEFAULT 0,
      objectives_achieved INT DEFAULT 0,
      objectives_total    INT DEFAULT 0,
      findings        TEXT,
      actions_required TEXT,
      next_review_date DATE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// ── seed ───────────────────────────────────────────────────────────────────
async function seedIfEmpty() {
  const count = await sql`SELECT COUNT(*) FROM alara_objectives`;
  if (Number(count[0].count) > 0) return;

  const year = new Date().getFullYear();

  await sql`
    INSERT INTO alara_objectives (year,title,description,category,target_metric,baseline_value,target_value,unit,status,priority,responsible,due_date)
    VALUES
    (${year},'Reducción dosis media personal medicina nuclear',
     'Reducir dosis promedio trimestral del personal de medicina nuclear mediante optimización de protocolos de radiofarmacia',
     'dose_reduction','avg_dose_msv',1.2,0.9,'mSv/trimestre','in_progress','high','Jefe de Protección Radiológica',${year+'-12-31'}),
    (${year},'Implementar blindaje adicional en sala caliente',
     'Instalar pantallas de vidrio plomado y contenedores adicionales en zona de preparación de radiofármacos',
     'technical',NULL,NULL,NULL,NULL,'in_progress','high','Jefe de Medicina Nuclear',${year+'-09-30'}),
    (${year},'Capacitación ALARA todo el personal OER',
     'Realizar jornada de capacitación específica en principio ALARA para todo el personal expuesto',
     'administrative','training_completion_pct',0,100,'%','planned','medium','Encargado Capacitación',${year+'-11-30'}),
    (${year},'Revisión y actualización procedimientos de trabajo',
     'Actualizar procedimientos escritos incorporando medidas de optimización identificadas en revisiones ALARA',
     'administrative',NULL,NULL,NULL,NULL,'in_progress','medium','Comité de Protección Radiológica',${year+'-12-31'}),
    (${year},'Implementar dosimetría de cristalino en personal de alto riesgo',
     'Iniciar monitoreo de dosis en cristalino para personal que realiza procedimientos intervencionistas',
     'technical','lens_dose_msv',NULL,15,'mSv/año','planned','medium','Jefe de Protección Radiológica',${year+'-10-31'})
  `;

  const objs = await sql`SELECT id FROM alara_objectives ORDER BY id LIMIT 2`;
  if (objs.length >= 2) {
    await sql`
      INSERT INTO alara_measures (objective_id,title,description,measure_type,area,status,estimated_reduction_pct,responsible,implementation_date)
      VALUES
      (${objs[0].id},'Uso de blindajes tipo L en preparación',
       'Instalar blindajes tipo L de 25 mm Pb en todas las estaciones de preparación de radiofármacos',
       'technical','Radiofarmacia','completed',25.0,'Jefe Radiofarmacia','${year}-03-15'),
      (${objs[0].id},'Optimización tiempo de permanencia en zona controlada',
       'Implementar sistema de control de tiempo máximo en sala caliente: 20 min por turno',
       'administrative','Sala Caliente','implementing',15.0,'Jefe Medicina Nuclear',NULL),
      (${objs[1].id},'Pantalla vidrio plomado 2 mm Pb en ventana sala caliente',
       'Instalación de ventana de vidrio plomado 50×50 cm para preparación con I-131',
       'technical','Sala Caliente','approved',30.0,'Mantención Hospital',NULL)
    `;
  }

  await sql`
    INSERT INTO alara_reviews (year,quarter,review_date,conducted_by,overall_assessment,
      collective_dose_msv,max_individual_msv,avg_individual_msv,incidents_count,
      objectives_achieved,objectives_total,findings,actions_required,next_review_date)
    VALUES
    (${year},1,'${year}-04-15','Comité de Protección Radiológica','satisfactory',
      12.5,0.8,0.42,0,1,3,
      'Implementación de blindajes tipo L exitosa. Dosis promedio bajó de 0.52 a 0.42 mSv/trimestre.',
      'Continuar con implementación de pantalla vidrio plomado. Revisar procedimientos sala caliente.',
      '${year}-07-15'),
    (${year},2,'${year}-07-18','Comité de Protección Radiológica','needs_improvement',
      14.2,1.1,0.47,1,0,3,
      'Incidente de contaminación menor en radiofarmacia. Dosis ligeramente sobre baseline por mayor carga de trabajo.',
      'Reforzar procedimiento de verificación de contenedores. Actualizar protocolo I-131.',
      '${year}-10-15')
  `;
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  await ensureTables();
  await seedIfEmpty();

  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year")     ? parseInt(searchParams.get("year")!) : new Date().getFullYear();
  const status = searchParams.get("status")  || "";

  const whereStatus = status ? sql`AND o.status = ${status}` : sql``;

  const objectives = await sql`
    SELECT o.*,
      COUNT(m.id)                                          AS measures_count,
      COUNT(m.id) FILTER (WHERE m.status = 'completed')   AS measures_done,
      ROUND(
        CASE WHEN o.baseline_value IS NOT NULL AND o.target_value IS NOT NULL AND o.baseline_value != o.target_value
          THEN LEAST(100, GREATEST(0,
            ((o.baseline_value - COALESCE(o.current_value, o.baseline_value)) /
             (o.baseline_value - o.target_value)) * 100
          ))
          ELSE NULL
        END, 1
      ) AS progress_pct
    FROM alara_objectives o
    LEFT JOIN alara_measures m ON m.objective_id = o.id
    WHERE o.year = ${year} ${whereStatus}
    GROUP BY o.id
    ORDER BY
      CASE o.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      o.created_at
  `;

  const reviews = await sql`
    SELECT * FROM alara_reviews
    WHERE year = ${year}
    ORDER BY quarter DESC
  `;

  // stats
  const stats = await sql`
    SELECT
      COUNT(*)                                                     AS total,
      COUNT(*) FILTER (WHERE status = 'achieved')                  AS achieved,
      COUNT(*) FILTER (WHERE status IN ('planned','in_progress'))  AS active,
      COUNT(*) FILTER (WHERE status = 'not_achieved')              AS not_achieved,
      COUNT(*) FILTER (WHERE priority = 'high' AND status NOT IN ('achieved','cancelled')) AS high_priority_pending,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('achieved','cancelled','not_achieved')) AS overdue
    FROM alara_objectives WHERE year = ${year}
  `;
  const s = stats[0];

  return NextResponse.json({
    year,
    objectives,
    reviews,
    stats: {
      total:                Number(s.total),
      achieved:             Number(s.achieved),
      active:               Number(s.active),
      not_achieved:         Number(s.not_achieved),
      high_priority_pending:Number(s.high_priority_pending),
      overdue:              Number(s.overdue),
    },
  });
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  await ensureTables();
  const body = await req.json();

  // sub-resource: measure
  if (body._type === "measure") {
    const { objective_id, title, description, measure_type, area, status, estimated_reduction_pct, responsible, implementation_date, doc_ref, cost_clp } = body;
    const rows = await sql`
      INSERT INTO alara_measures (objective_id,title,description,measure_type,area,status,estimated_reduction_pct,responsible,implementation_date,doc_ref,cost_clp)
      VALUES (${objective_id},${title},${description??null},${measure_type??'technical'},${area??null},${status??'proposed'},${estimated_reduction_pct??null},${responsible??null},${implementation_date??null},${doc_ref??null},${cost_clp??null})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  }

  // sub-resource: review
  if (body._type === "review") {
    const { year, quarter, review_date, conducted_by, overall_assessment, collective_dose_msv, max_individual_msv, avg_individual_msv, incidents_count, objectives_achieved, objectives_total, findings, actions_required, next_review_date } = body;
    const rows = await sql`
      INSERT INTO alara_reviews (year,quarter,review_date,conducted_by,overall_assessment,collective_dose_msv,max_individual_msv,avg_individual_msv,incidents_count,objectives_achieved,objectives_total,findings,actions_required,next_review_date)
      VALUES (${year},${quarter},${review_date},${conducted_by??null},${overall_assessment??null},${collective_dose_msv??null},${max_individual_msv??null},${avg_individual_msv??null},${incidents_count??0},${objectives_achieved??0},${objectives_total??0},${findings??null},${actions_required??null},${next_review_date??null})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  }

  // objective
  const { year, title, description, category, target_metric, baseline_value, target_value, unit, status, priority, responsible, due_date, notes } = body;
  const rows = await sql`
    INSERT INTO alara_objectives (year,title,description,category,target_metric,baseline_value,target_value,unit,status,priority,responsible,due_date,notes)
    VALUES (${year??new Date().getFullYear()},${title},${description??null},${category??'optimization'},${target_metric??null},${baseline_value??null},${target_value??null},${unit??null},${status??'planned'},${priority??'medium'},${responsible??null},${due_date??null},${notes??null})
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}

// ── PATCH ──────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  await ensureTables();
  const body = await req.json();
  const { id, _table, ...fields } = body;

  const table = _table === "measure" ? "alara_measures" : _table === "review" ? "alara_reviews" : "alara_objectives";
  if (_table !== "measure" && _table !== "review") fields.updated_at = new Date().toISOString();

  const keys = Object.keys(fields);
  if (!keys.length) return NextResponse.json({ error: "No fields" }, { status: 400 });

  let p = 1;
  const setClauses = keys.map(k => `"${k}" = $${p++}`).join(", ");
  const values = keys.map(k => fields[k]);
  values.push(id);

  const rows = await sql.unsafe(`UPDATE ${table} SET ${setClauses} WHERE id = $${p} RETURNING *`, values);
  return NextResponse.json(rows[0]);
}

// ── DELETE ─────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  await ensureTables();
  const { id, _table } = await req.json();
  const table = _table === "measure" ? "alara_measures" : _table === "review" ? "alara_reviews" : "alara_objectives";
  await sql.unsafe(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
