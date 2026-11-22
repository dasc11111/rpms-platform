import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ── ensure tables ──────────────────────────────────────────────────────────
async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS compliance_requirements (
      id              SERIAL PRIMARY KEY,
      regulation      TEXT NOT NULL DEFAULT 'NS-06.0',    -- NS-06.0|DS3|IAEA|DS594|other
      article         TEXT NOT NULL,                       -- e.g. "Art. 3", "Cap. II"
      section         TEXT,                                -- sub-section or sub-article
      requirement     TEXT NOT NULL,
      description     TEXT,
      category        TEXT NOT NULL DEFAULT 'program',    -- program|dosimetry|sources|waste|training|incident|personnel|facility|equipment|reports
      status          TEXT NOT NULL DEFAULT 'compliant',  -- compliant|partial|non_compliant|not_applicable|pending_review
      evidence        TEXT,                                -- how compliance is demonstrated
      last_verified   DATE,
      verified_by     TEXT,
      next_review     DATE,
      notes           TEXT,
      active          BOOLEAN DEFAULT true,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS compliance_nonconformities (
      id              SERIAL PRIMARY KEY,
      requirement_id  INT REFERENCES compliance_requirements(id) ON DELETE CASCADE,
      code            TEXT UNIQUE NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL,
      severity        TEXT NOT NULL DEFAULT 'minor',      -- minor|major|critical
      type            TEXT NOT NULL DEFAULT 'observation',-- observation|non_conformity|opportunity
      identified_date DATE NOT NULL DEFAULT CURRENT_DATE,
      identified_by   TEXT,
      root_cause      TEXT,
      corrective_action TEXT,
      responsible     TEXT,
      due_date        DATE,
      completion_date DATE,
      verification_date DATE,
      status          TEXT NOT NULL DEFAULT 'open',       -- open|in_progress|closed|verified
      closure_evidence TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// ── seed ───────────────────────────────────────────────────────────────────
async function seedIfEmpty() {
  const count = await sql`SELECT COUNT(*) FROM compliance_requirements`;
  if (Number(count[0].count) > 0) return;

  const year = new Date().getFullYear();

  await sql`
    INSERT INTO compliance_requirements (regulation,article,section,requirement,description,category,status,evidence,last_verified,verified_by,next_review)
    VALUES
    -- NS-06.0 / DS 3/1985 — Programa de Protección Radiológica
    ('NS-06.0','Art. 3',NULL,'Designación del Encargado de Protección Radiológica',
     'El titular debe designar un Encargado de Protección Radiológica con calificaciones acreditadas ante CCHEN',
     'program','compliant','Resolución de nombramiento en archivo. Acreditación CCHEN vigente hasta 2027.','2025-01-15','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 4','4.1','Programa de Protección Radiológica escrito',
     'Existencia de un programa escrito de protección radiológica actualizado y aprobado por la dirección',
     'program','compliant','Programa PR versión 2024 firmado por Director. Disponible en Intranet.','2025-01-15','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 5',NULL,'Autorización de operación CCHEN vigente',
     'La instalación debe contar con autorización de funcionamiento vigente otorgada por CCHEN',
     'program','compliant','Resolución CCHEN N° XXXX/2024 vigente hasta 2026.','2025-01-15','Encargado PR','${year}-06-30'),
    ('NS-06.0','Art. 7',NULL,'Clasificación de zonas de trabajo',
     'Las áreas de trabajo deben estar clasificadas (zona controlada/supervisada) y señalizadas',
     'facility','compliant','Mapa de zonas clasificadas actualizado. Señalética visible en todas las zonas.','2025-02-01','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 10','10.1','Dosimetría individual del personal OER',
     'Todo personal ocupacionalmente expuesto debe contar con dosimetría individual periódica',
     'dosimetry','compliant','100% del personal OER con dosímetro TLD trimestral. Registros en RPMS.','2025-03-01','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 10','10.2','Límites de dosis individuales',
     'Las dosis individuales deben mantenerse dentro de los límites establecidos (OER: 20 mSv/año, público: 1 mSv/año)',
     'dosimetry','compliant','Ningún trabajador superó límite anual en los últimos 3 años. Registros disponibles.','2025-03-01','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 12',NULL,'Monitoreo de contaminación',
     'Monitoreo periódico de contaminación superficial y ambiental en áreas de trabajo',
     'facility','compliant','Monitoreo semanal en áreas clasificadas. Registros en RPMS.','2025-02-15','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 15',NULL,'Gestión de residuos radiactivos',
     'Los residuos radiactivos deben gestionarse conforme a las normas CCHEN aplicables',
     'waste','compliant','Sistema de gestión de residuos implementado. Entregas a gestor autorizado documentadas.','2025-02-01','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 18',NULL,'Inventario de fuentes radiactivas',
     'Mantener registro actualizado de todas las fuentes radiactivas con sus características y ubicación',
     'sources','compliant','Inventario actualizado en RPMS. Movimientos registrados y trazables.','2025-02-01','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 20',NULL,'Pruebas de estanqueidad de fuentes selladas',
     'Fuentes selladas deben someterse a pruebas de estanqueidad según periodicidad indicada en autorización',
     'sources','partial','3 de 5 fuentes con prueba de estanqueidad vigente. 2 fuentes con prueba próxima a vencer.','2025-03-01','Encargado PR','${year}-04-30'),
    ('NS-06.0','Art. 22',NULL,'Exámenes médicos del personal OER',
     'El personal OER debe contar con exámenes médicos pre-ocupacionales y periódicos anuales',
     'personnel','partial','85% del personal con examen anual vigente. 2 trabajadores con examen vencido.','2025-03-15','Jefe RRHH','${year}-04-30'),
    ('NS-06.0','Art. 24',NULL,'Capacitación en Protección Radiológica',
     'Todo el personal OER debe recibir capacitación en protección radiológica al menos anualmente',
     'training','compliant','Jornada anual de capacitación PR realizada. Registro de participación disponible.','2025-02-20','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 26',NULL,'Procedimientos de trabajo escritos',
     'Existencia de procedimientos escritos para operaciones con radiación y materiales radiactivos',
     'program','compliant','Manual de procedimientos versión 2024 vigente. 18 procedimientos documentados.','2025-01-15','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 28',NULL,'Plan de contingencia y emergencias',
     'Existencia de plan de contingencia para emergencias radiológicas, con responsables y procedimientos',
     'program','compliant','Plan de contingencia versión 2024 aprobado. Simulacro realizado en mayo 2025.','2025-05-20','Encargado PR','${year}-12-31'),
    ('NS-06.0','Art. 30',NULL,'Informe anual a CCHEN',
     'Presentar informe anual de protección radiológica a CCHEN antes del 31 de marzo',
     'reports','compliant','Informe 2024 enviado el 15/03/2025. Acuse de recibo CCHEN disponible.','2025-03-15','Encargado PR','${year+1}-03-31'),
    ('DS 3/1985','Art. 46','46.1','Notificación de incidentes radiológicos a CCHEN',
     'Los incidentes radiológicos con INES ≥ 1 deben ser notificados a CCHEN dentro de las 24 horas',
     'incident','compliant','Ningún incidente INES ≥ 1 sin notificar en el período.','2025-03-01','Encargado PR','${year}-12-31'),
    ('IAEA','GSR Part 3','Principio 5','Programa ALARA implementado',
     'Existencia de programa ALARA con objetivos documentados y seguimiento de indicadores',
     'program','compliant','Programa ALARA 2025 con 5 objetivos. Revisiones trimestrales documentadas.','2025-07-18','Encargado PR','${year}-12-31'),
    ('DS 594/1999','Art. 52',NULL,'Señalización de peligro radiactivo',
     'Señalización visible del símbolo de peligro radiactivo en todas las zonas clasificadas',
     'facility','compliant','Señalética presente en todas las zonas. Inspección visual mensual.','2025-03-01','Encargado PR','${year}-12-31')
  `;

  // non-conformities
  const reqs = await sql`SELECT id FROM compliance_requirements WHERE status IN ('partial','non_compliant') ORDER BY id LIMIT 2`;
  if (reqs.length >= 2) {
    await sql`
      INSERT INTO compliance_nonconformities (requirement_id,code,title,description,severity,type,identified_date,identified_by,root_cause,corrective_action,responsible,due_date,status)
      VALUES
      (${reqs[0].id},'NC-2025-001','Pruebas de estanqueidad fuentes vencidas',
       'Dos fuentes radiactivas (Sr-90 y Am-241) tienen prueba de estanqueidad próxima a vencer en menos de 60 días',
       'minor','non_conformity','${year}-03-01','Encargado PR',
       'No se agendó oportunamente la próxima prueba con laboratorio acreditado',
       'Programar prueba de estanqueidad con laboratorio CCHEN-IAEA antes de fecha límite',
       'Jefe Protección Radiológica','${year}-04-30','in_progress'),
      (${reqs[1].id},'NC-2025-002','Exámenes médicos vencidos personal OER',
       '2 trabajadores del área de radiofarmacia tienen examen médico ocupacional vencido',
       'minor','non_conformity','${year}-03-15','Jefe RRHH',
       'Cambio de médico del trabajo del Servicio de Salud genera atrasos en agenda',
       'Gestionar agenda con nuevo médico del trabajo. Derivar trabajadores esta semana.',
       'Jefe RRHH','${year}-04-30','in_progress')
    `;
  }
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  await ensureTables();
  await seedIfEmpty();

  const { searchParams } = new URL(req.url);
  const regulation = searchParams.get("regulation") || "";
  const category   = searchParams.get("category")   || "";
  const status     = searchParams.get("status")      || "";

  let where = sql`WHERE r.active = true`;
  if (regulation) where = sql`${where} AND r.regulation = ${regulation}`;
  if (category)   where = sql`${where} AND r.category   = ${category}`;
  if (status)     where = sql`${where} AND r.status      = ${status}`;

  const requirements = await sql`
    SELECT r.*,
      COUNT(nc.id)                                              AS nc_count,
      COUNT(nc.id) FILTER (WHERE nc.status NOT IN ('closed','verified')) AS nc_open
    FROM compliance_requirements r
    LEFT JOIN compliance_nonconformities nc ON nc.requirement_id = r.id
    ${where}
    GROUP BY r.id
    ORDER BY
      CASE r.status WHEN 'non_compliant' THEN 1 WHEN 'partial' THEN 2 WHEN 'pending_review' THEN 3 ELSE 4 END,
      r.regulation, r.article
  `;

  const nonconformities = await sql`
    SELECT nc.*, r.article, r.requirement AS req_title, r.regulation
    FROM compliance_nonconformities nc
    JOIN compliance_requirements r ON r.id = nc.requirement_id
    ORDER BY
      CASE nc.severity WHEN 'critical' THEN 1 WHEN 'major' THEN 2 ELSE 3 END,
      nc.due_date NULLS LAST
  `;

  const stats = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'compliant')     AS compliant,
      COUNT(*) FILTER (WHERE status = 'partial')       AS partial,
      COUNT(*) FILTER (WHERE status = 'non_compliant') AS non_compliant,
      COUNT(*) FILTER (WHERE status = 'not_applicable')AS not_applicable,
      COUNT(*) FILTER (WHERE next_review < NOW() AND status NOT IN ('not_applicable'))
                                                       AS review_overdue,
      ROUND(
        COUNT(*) FILTER (WHERE status IN ('compliant','not_applicable'))::numeric /
        NULLIF(COUNT(*) FILTER (WHERE status != 'not_applicable'), 0) * 100, 1
      ) AS compliance_pct
    FROM compliance_requirements WHERE active = true
  `;

  const ncStats = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status NOT IN ('closed','verified'))      AS open,
      COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('closed','verified')) AS critical_open,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('closed','verified'))      AS overdue
    FROM compliance_nonconformities
  `;

  const s = stats[0]; const nc = ncStats[0];
  return NextResponse.json({
    requirements,
    nonconformities,
    stats: {
      total:          Number(s.total),
      compliant:      Number(s.compliant),
      partial:        Number(s.partial),
      non_compliant:  Number(s.non_compliant),
      not_applicable: Number(s.not_applicable),
      review_overdue: Number(s.review_overdue),
      compliance_pct: Number(s.compliance_pct ?? 0),
    },
    nc_stats: {
      total:         Number(nc.total),
      open:          Number(nc.open),
      critical_open: Number(nc.critical_open),
      overdue:       Number(nc.overdue),
    },
  });
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  await ensureTables();
  const body = await req.json();

  if (body._type === "nc") {
    const { requirement_id, title, description, severity, type, identified_by, root_cause, corrective_action, responsible, due_date } = body;
    const year = new Date().getFullYear();
    const count = await sql`SELECT COUNT(*)+1 AS n FROM compliance_nonconformities WHERE EXTRACT(YEAR FROM identified_date)=${year}`;
    const code = `NC-${year}-${String(Number(count[0].n)).padStart(3,"0")}`;
    const rows = await sql`
      INSERT INTO compliance_nonconformities (requirement_id,code,title,description,severity,type,identified_by,root_cause,corrective_action,responsible,due_date)
      VALUES (${requirement_id},${code},${title},${description??''},${severity??'minor'},${type??'observation'},${identified_by??null},${root_cause??null},${corrective_action??null},${responsible??null},${due_date??null})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  }

  const { regulation, article, section, requirement, description, category, status, evidence, last_verified, verified_by, next_review, notes } = body;
  const rows = await sql`
    INSERT INTO compliance_requirements (regulation,article,section,requirement,description,category,status,evidence,last_verified,verified_by,next_review,notes)
    VALUES (${regulation??'NS-06.0'},${article},${section??null},${requirement},${description??null},${category??'program'},${status??'pending_review'},${evidence??null},${last_verified??null},${verified_by??null},${next_review??null},${notes??null})
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}

// ── PATCH ──────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  await ensureTables();
  const body = await req.json();
  const { id, _table, ...fields } = body;
  const table = _table === "nc" ? "compliance_nonconformities" : "compliance_requirements";
  fields.updated_at = new Date().toISOString();
  const keys = Object.keys(fields);
  if (!keys.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  let p = 1;
  const setClauses = keys.map(k => `"${k}" = $${p++}`).join(", ");
  const values = [...keys.map(k => fields[k]), id];
  const rows = await sql.unsafe(`UPDATE ${table} SET ${setClauses} WHERE id = $${p} RETURNING *`, values);
  return NextResponse.json(rows[0]);
}
