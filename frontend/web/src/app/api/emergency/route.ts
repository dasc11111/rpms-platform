import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ── ensure tables ──────────────────────────────────────────────────────────
async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS emergency_procedures (
      id              SERIAL PRIMARY KEY,
      code            TEXT UNIQUE NOT NULL,
      title           TEXT NOT NULL,
      scenario_type   TEXT NOT NULL DEFAULT 'spill',  -- spill|loss|overexposure|contamination|fire|transport|other
      severity        TEXT NOT NULL DEFAULT 'low',    -- low|medium|high|extreme
      description     TEXT,
      immediate_actions TEXT[],       -- ordered list of immediate steps
      notification_chain TEXT[],      -- who to notify and in what order
      evacuation_zone TEXT,
      ppe_required    TEXT[],
      estimated_duration_min INT,
      last_reviewed   DATE,
      reviewed_by     TEXT,
      version         TEXT DEFAULT '1.0',
      active          BOOLEAN DEFAULT true,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      role            TEXT NOT NULL,
      organization    TEXT,
      phone_primary   TEXT NOT NULL,
      phone_secondary TEXT,
      email           TEXT,
      availability    TEXT DEFAULT '24/7',  -- 24/7|office_hours|on_call
      contact_order   INT DEFAULT 99,
      notes           TEXT,
      active          BOOLEAN DEFAULT true,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS emergency_equipment (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      equipment_type  TEXT NOT NULL DEFAULT 'detection',  -- detection|ppe|decontamination|containment|communication
      location        TEXT NOT NULL,
      quantity        INT DEFAULT 1,
      unit            TEXT DEFAULT 'unidad',
      condition       TEXT DEFAULT 'good',    -- good|fair|needs_service|out_of_service
      last_inspection DATE,
      next_inspection DATE,
      responsible     TEXT,
      notes           TEXT,
      active          BOOLEAN DEFAULT true,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS emergency_drills (
      id              SERIAL PRIMARY KEY,
      drill_date      DATE NOT NULL,
      drill_type      TEXT NOT NULL DEFAULT 'table_top',  -- table_top|functional|full_scale
      scenario        TEXT NOT NULL,
      procedure_id    INT REFERENCES emergency_procedures(id) ON DELETE SET NULL,
      participants    TEXT[],
      participants_count INT DEFAULT 0,
      duration_min    INT,
      coordinator     TEXT,
      overall_rating  TEXT DEFAULT 'satisfactory',  -- excellent|satisfactory|needs_improvement|unsatisfactory
      strengths       TEXT,
      improvement_areas TEXT,
      corrective_actions TEXT[],
      next_drill_date DATE,
      report_doc_ref  TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// ── seed ───────────────────────────────────────────────────────────────────
async function seedIfEmpty() {
  const count = await sql`SELECT COUNT(*) FROM emergency_procedures`;
  if (Number(count[0].count) > 0) return;

  // procedures
  await sql`
    INSERT INTO emergency_procedures (code,title,scenario_type,severity,description,immediate_actions,notification_chain,ppe_required,estimated_duration_min,last_reviewed,reviewed_by)
    VALUES
    ('PC-01','Derrame de Material Radiactivo — Área Medicina Nuclear','spill','medium',
     'Procedimiento para contener y descontaminar derrames de radiofármacos en áreas de trabajo',
     ARRAY[
       'Detener la actividad. Alertar al personal de la sala.',
       'Cubrir el derrame con absorbente (papel toalla/absorbente) sin extenderlo.',
       'Señalizar área con cinta o conos de peligro radiactivo.',
       'Ponerse guantes y delantal plomado antes de cualquier acción.',
       'Contactar al Encargado de Protección Radiológica.',
       'Medir tasa de dosis en el área con detector GM.',
       'Iniciar descontaminación con paños húmedos desde periferia hacia centro.',
       'Monitorear manos y pies al salir del área.',
       'Registrar el incidente en el libro de novedades.'
     ],
     ARRAY['Encargado PR inmediatamente','Jefe Medicina Nuclear','Jefe Radiofarmacia'],
     ARRAY['Guantes látex doble','Delantal plomado','Protector tiroideo','Gafas de protección'],
     60,'2025-03-15','Jefe Protección Radiológica'),
    ('PC-02','Pérdida o Extravío de Fuente Radiactiva','loss','high',
     'Procedimiento de búsqueda y notificación ante pérdida de fuente sellada o no sellada',
     ARRAY[
       'Verificar última ubicación conocida de la fuente.',
       'Buscar sistemáticamente con detector GM en toda el área.',
       'Aislar el área potencialmente afectada.',
       'Notificar al Jefe de Protección Radiológica de inmediato.',
       'NO informar a medios de comunicación hasta autorización.',
       'Revisar registros de movimientos y log de acceso.',
       'Contactar CCHEN si no se localiza en 2 horas (obligatorio por DS 3/1985).',
       'Iniciar cadena de notificación institucional.'
     ],
     ARRAY['Encargado PR de inmediato','Director del Hospital en <1 hora','CCHEN en <2 horas si no se localiza','Carabineros si se confirma pérdida'],
     ARRAY['Guantes','Detector GM portátil','Dosímetro personal'],
     120,'2025-03-15','Jefe Protección Radiológica'),
    ('PC-03','Sobreexposición Accidental de Personal','overexposure','high',
     'Protocolo de actuación ante exposición accidental superior a límites establecidos',
     ARRAY[
       'Retirar al trabajador afectado del área de exposición.',
       'Registrar dosis en dosímetro de alarma al momento del incidente.',
       'Evaluar síntomas clínicos: náuseas, eritema, si están presentes llamar URGENCIAS.',
       'Contactar al Encargado de Protección Radiológica.',
       'Estimar dosis recibida con todos los dosímetros disponibles.',
       'Derivar a médico para evaluación clínica aunque el trabajador esté asintomático.',
       'Separar al trabajador de trabajo con radiaciones hasta evaluación médica.',
       'Notificar a CCHEN en 24 horas si dosis supera límite anual.'
     ],
     ARRAY['Encargado PR inmediatamente','Jefe RRHH','Médico del Trabajo','CCHEN en <24h si dosis > límite'],
     ARRAY['Ninguno — proteger al accidentado'],
     240,'2025-03-15','Jefe Protección Radiológica'),
    ('PC-04','Incendio en Área de Trabajo con Material Radiactivo','fire','extreme',
     'Coordinación con brigada de incendio y bomberos considerando riesgo radiactivo adicional',
     ARRAY[
       'Activar alarma de incendio.',
       'Evacuar el área siguiendo plan de evacuación del edificio.',
       'NO intentar combatir el incendio con material radiactivo presente.',
       'Informar a bomberos sobre presencia de material radiactivo al llegar.',
       'Entregar inventario de fuentes al Comandante de bomberos.',
       'Establecer zona de exclusión de 50 metros si hay fuentes de alta actividad.',
       'Contactar CCHEN y autoridades competentes.',
       'Monitorear el perímetro con detectores portátiles si es seguro.'
     ],
     ARRAY['Jefe de Turno inmediatamente','Bomberos 132','Encargado PR','CCHEN','Director Hospital'],
     'Zona exclusión 50 m + perímetro de seguridad',
     ARRAY['Traje protector completo','Equipo respiratorio autónomo','Detector GM'],
     480,'2025-03-15','Jefe Protección Radiológica')
  `;

  // contacts
  await sql`
    INSERT INTO emergency_contacts (name,role,organization,phone_primary,phone_secondary,email,availability,contact_order)
    VALUES
    ('Jefe de Protección Radiológica','Encargado PR principal','Hospital Hernán Henríquez Aravena','+56 9 XXXX XXXX','+56 45 2 XXXXXX','radiologia@hhha.cl','24/7',1),
    ('Jefe de Medicina Nuclear','Responsable área MN','Hospital Hernán Henríquez Aravena','+56 9 XXXX XXXX',NULL,'mn@hhha.cl','office_hours',2),
    ('Director del Hospital','Autoridad máxima institucional','Hospital Hernán Henríquez Aravena','+56 45 2 XXXXXX','+56 9 XXXX XXXX','director@hhha.cl','on_call',3),
    ('CCHEN — División Protección Radiológica','Autoridad regulatoria','Comisión Chilena de Energía Nuclear','600 600 XXXX','+56 2 2XXXXXXX','proteccionradiologica@cchen.cl','24/7',4),
    ('Bomberos Temuco','Emergencias con materiales peligrosos','Cuerpo de Bomberos de Temuco','132',NULL,NULL,'24/7',5),
    ('SAMU Regional Araucanía','Emergencias médicas','SAMU','131',NULL,NULL,'24/7',6),
    ('SEREMI de Salud Araucanía','Autoridad sanitaria regional','SEREMI Salud La Araucanía','+56 45 2 XXXXXX',NULL,NULL,'office_hours',7)
  `;

  // equipment
  await sql`
    INSERT INTO emergency_equipment (name,equipment_type,location,quantity,unit,condition,last_inspection,next_inspection,responsible)
    VALUES
    ('Detector GM portátil (Inspector Alert)','detection','Jefatura Protección Radiológica',2,'unidad','good','2025-01-15','2025-07-15','Encargado PR'),
    ('Kit de descontaminación radiológica','decontamination','Sala Caliente Medicina Nuclear',1,'kit','good','2025-02-01','2025-08-01','Jefe Radiofarmacia'),
    ('Dosímetros de alarma (TLD electrónico)','detection','Radiofarmacia',5,'unidad','good','2025-03-01','2025-09-01','Encargado PR'),
    ('Delantales plomados de emergencia (0.5 mm Pb)','ppe','Bodega Protección Radiológica',3,'unidad','good','2025-01-15','2026-01-15','Encargado PR'),
    ('Protectores tiroideos de emergencia','ppe','Bodega Protección Radiológica',5,'unidad','good','2025-01-15','2026-01-15','Encargado PR'),
    ('Absorbentes radiactivos (papel especial)','containment','Sala Caliente Medicina Nuclear',1,'caja','good','2025-02-01','2025-08-01','Jefe Radiofarmacia'),
    ('Contenedores de residuos de emergencia','containment','Bodega Protección Radiológica',3,'unidad','good','2025-01-15','2026-01-15','Encargado PR'),
    ('Radio comunicación portátil','communication','Jefatura Medicina Nuclear',2,'unidad','fair','2024-12-01','2025-06-01','Jefe MN')
  `;

  // drills
  await sql`
    INSERT INTO emergency_drills (drill_date,drill_type,scenario,participants_count,duration_min,coordinator,overall_rating,strengths,improvement_areas,corrective_actions,next_drill_date)
    VALUES
    ('2025-05-20','table_top','Simulacro de escritorio: derrame de Tc-99m en radiofarmacia durante preparación de dosis',12,90,'Jefe Protección Radiológica',
     'satisfactory',
     'El personal conoce el procedimiento PC-01. Tiempo de notificación al EPR < 5 minutos.',
     'Algunos no sabían la ubicación exacta del kit de descontaminación. Cadena de notificación lenta para contactar al Director.',
     ARRAY['Señalizar claramente la ubicación del kit de descontaminación','Actualizar árbol telefónico con números actualizados','Realizar simulacro funcional en 6 meses'],
     '2025-11-20'),
    ('2024-11-15','full_scale','Simulacro completo: pérdida de fuente Cs-137 en bodega de instrumentos',18,180,'Jefe de Seguridad + Encargado PR',
     'needs_improvement',
     'Evacuación del área correcta y oportuna. Uso adecuado de EPP por todo el personal.',
     'Retraso de 45 min en notificar a CCHEN. Personal de otras áreas no conocía procedimiento de aislamiento.',
     ARRAY['Incluir procedimiento de notificación CCHEN en inducción anual','Instalar cartelería de emergencia en pasillos','Capacitar personal de portería en protocolo de no acceso durante emergencia'],
     '2025-05-20')
  `;
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  await ensureTables();
  await seedIfEmpty();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "";

  const whereType = type ? sql`WHERE scenario_type = ${type} AND active = true` : sql`WHERE active = true`;

  const [procedures, contacts, equipment, drills] = await Promise.all([
    sql`SELECT * FROM emergency_procedures ${whereType} ORDER BY severity DESC, code`,
    sql`SELECT * FROM emergency_contacts WHERE active = true ORDER BY contact_order`,
    sql`SELECT * FROM emergency_equipment WHERE active = true ORDER BY equipment_type, name`,
    sql`SELECT d.*, p.title AS procedure_title FROM emergency_drills d LEFT JOIN emergency_procedures p ON p.id = d.procedure_id ORDER BY d.drill_date DESC LIMIT 10`,
  ]);

  // stats
  const equipmentStats = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE condition = 'out_of_service') AS out_of_service,
      COUNT(*) FILTER (WHERE next_inspection < NOW())       AS inspection_overdue,
      COUNT(*) FILTER (WHERE next_inspection BETWEEN NOW() AND NOW() + INTERVAL '60 days') AS inspection_soon
    FROM emergency_equipment WHERE active = true
  `;
  const drillStats = await sql`
    SELECT
      COUNT(*) AS total_drills,
      MAX(drill_date) AS last_drill,
      COUNT(*) FILTER (WHERE drill_date >= NOW() - INTERVAL '1 year') AS last_year
    FROM emergency_drills
  `;
  const es = equipmentStats[0];
  const ds = drillStats[0];

  return NextResponse.json({
    procedures,
    contacts,
    equipment,
    drills,
    stats: {
      procedures_count: procedures.length,
      contacts_count: contacts.length,
      equipment_total: Number(es.total),
      equipment_out: Number(es.out_of_service),
      equipment_overdue: Number(es.inspection_overdue),
      equipment_soon: Number(es.inspection_soon),
      total_drills: Number(ds.total_drills),
      last_drill: ds.last_drill,
      drills_last_year: Number(ds.last_year),
    },
  });
}

// ── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  await ensureTables();
  const body = await req.json();

  if (body._type === "drill") {
    const { drill_date, drill_type, scenario, procedure_id, participants_count, duration_min, coordinator, overall_rating, strengths, improvement_areas, corrective_actions, next_drill_date, report_doc_ref } = body;
    const rows = await sql`
      INSERT INTO emergency_drills (drill_date,drill_type,scenario,procedure_id,participants_count,duration_min,coordinator,overall_rating,strengths,improvement_areas,corrective_actions,next_drill_date,report_doc_ref)
      VALUES (${drill_date},${drill_type??'table_top'},${scenario},${procedure_id??null},${participants_count??0},${duration_min??null},${coordinator??null},${overall_rating??'satisfactory'},${strengths??null},${improvement_areas??null},${corrective_actions??null},${next_drill_date??null},${report_doc_ref??null})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  }

  if (body._type === "contact") {
    const { name, role, organization, phone_primary, phone_secondary, email, availability, contact_order, notes } = body;
    const rows = await sql`
      INSERT INTO emergency_contacts (name,role,organization,phone_primary,phone_secondary,email,availability,contact_order,notes)
      VALUES (${name},${role},${organization??null},${phone_primary},${phone_secondary??null},${email??null},${availability??'office_hours'},${contact_order??99},${notes??null})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  }

  if (body._type === "equipment") {
    const { name, equipment_type, location, quantity, unit, condition, last_inspection, next_inspection, responsible, notes } = body;
    const rows = await sql`
      INSERT INTO emergency_equipment (name,equipment_type,location,quantity,unit,condition,last_inspection,next_inspection,responsible,notes)
      VALUES (${name},${equipment_type??'detection'},${location},${quantity??1},${unit??'unidad'},${condition??'good'},${last_inspection??null},${next_inspection??null},${responsible??null},${notes??null})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  }

  // procedure
  const { code, title, scenario_type, severity, description, immediate_actions, notification_chain, ppe_required, estimated_duration_min, last_reviewed, reviewed_by, version } = body;
  const rows = await sql`
    INSERT INTO emergency_procedures (code,title,scenario_type,severity,description,immediate_actions,notification_chain,ppe_required,estimated_duration_min,last_reviewed,reviewed_by,version)
    VALUES (${code},${title},${scenario_type??'spill'},${severity??'medium'},${description??null},${immediate_actions??null},${notification_chain??null},${ppe_required??null},${estimated_duration_min??null},${last_reviewed??null},${reviewed_by??null},${version??'1.0'})
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}

// ── PATCH ──────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  await ensureTables();
  const body = await req.json();
  const { id, _table, ...fields } = body;
  const tableMap: Record<string, string> = {
    contact: "emergency_contacts", equipment: "emergency_equipment", drill: "emergency_drills",
  };
  const table = tableMap[_table] ?? "emergency_procedures";
  if (!["contact","equipment","drill"].includes(_table)) fields.updated_at = new Date().toISOString();
  const keys = Object.keys(fields);
  if (!keys.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  let p = 1;
  const setClauses = keys.map(k => `"${k}" = $${p++}`).join(", ");
  const values = [...keys.map(k => fields[k]), id];
  const rows = await sql.unsafe(`UPDATE ${table} SET ${setClauses} WHERE id = $${p} RETURNING *`, values);
  return NextResponse.json(rows[0]);
}
