import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §81 — Gestión de Simulacros de Emergencia Radiológica
// DS 3/1985 Art. 17 — NS-06.0 §9.1
// El establecimiento debe realizar simulacros periódicos del Plan de Respuesta
// a Emergencias Radiológicas y evaluar el desempeño del personal.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS emergency_drills (
      id                SERIAL PRIMARY KEY,
      drill_code        TEXT        NOT NULL UNIQUE,
      drill_date        DATE        NOT NULL,
      drill_type        TEXT        NOT NULL DEFAULT 'full'
                        CHECK (drill_type IN ('full','partial','tabletop','evacuation','spill_response','equipment_failure','fire_radiation')),
      scenario          TEXT        NOT NULL,
      location          TEXT,
      coordinator       TEXT,
      participants      INTEGER     DEFAULT 0,
      participants_list TEXT,
      observers         TEXT,
      cchen_notified    BOOLEAN     DEFAULT false,
      duration_minutes  INTEGER,
      overall_score     NUMERIC(4,1),
      overall_rating    TEXT        DEFAULT 'acceptable'
                        CHECK (overall_rating IN ('excellent','good','acceptable','needs_improvement','failed')),
      objectives        TEXT,
      achievements      TEXT,
      deficiencies      TEXT,
      corrective_actions TEXT,
      next_drill_date   DATE,
      report_path       TEXT,
      status            TEXT        NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned','in_progress','completed','cancelled')),
      notes             TEXT,
      active            BOOLEAN     DEFAULT true,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS drill_evaluations (
      id                SERIAL PRIMARY KEY,
      drill_id          INTEGER     REFERENCES emergency_drills(id) ON DELETE CASCADE,
      criterion         TEXT        NOT NULL,
      criterion_weight  INTEGER     DEFAULT 10,
      score             NUMERIC(4,1),
      max_score         NUMERIC(4,1) DEFAULT 10,
      observations      TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

async function nextCode(year: number): Promise<string> {
  const { rows } = await sql.unsafe(
    `SELECT COUNT(*)::int AS n FROM emergency_drills WHERE EXTRACT(YEAR FROM drill_date)=$1`, [year]
  );
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `SIM-EMERG-${year}-${String(n).padStart(2, "0")}`;
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM emergency_drills`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const year = new Date().getFullYear();

  const drills = [
    {
      drill_code: `SIM-EMERG-${year - 1}-01`,
      drill_date: `${year - 1}-09-15`,
      drill_type: "full",
      scenario: "Derrame de Tc-99m en sala caliente durante preparación de radiofármaco. Contaminación superficial del mesón y piso (est. 50 MBq). Personal en área.",
      location: "Medicina Nuclear — Sala de Preparación de Radiofármacos",
      coordinator: "TM. Diego Solís C. (Encargado PR)",
      participants: 8,
      participants_list: "TM. María González, TM. Juan Pérez, Dra. Carmen Ruiz, Dr. Luis Morales, Aux. Patricia Soto, Aux. Roberto Vega, Enf. Claudia Torres, Administrativo Carlos Muñoz",
      observers: "Jefe de Medicina Nuclear, Jefe de Prevención de Riesgos",
      cchen_notified: false,
      duration_minutes: 95,
      overall_score: 7.8,
      overall_rating: "good",
      objectives: "1. Verificar activación del plan de emergencia\n2. Evaluar uso correcto de EPP\n3. Medir tiempo de respuesta inicial\n4. Verificar notificación a cadena de mando\n5. Evaluar descontaminación",
      achievements: "El personal activó el sistema de alarma en 2 minutos.\nEl EPP fue usado correctamente por 7 de 8 participantes.\nSe delimitó el área correctamente.\nNotificación a jefatura en 5 minutos.",
      deficiencies: "Un TM no usó la mascarilla de protección correctamente.\nEl registro del incidente tardó 15 min más de lo establecido en el protocolo.\nFaltó coordinación para el aviso a pacientes del área de espera.",
      corrective_actions: "1. Refuerzo de capacitación en uso de EPP para TM. Juan Pérez — completado Oct-2024\n2. Revisión del formulario de registro de incidente para agilizar el proceso\n3. Incorporar protocolo de notificación a pacientes en el plan de emergencia",
      next_drill_date: `${year}-09-01`,
      status: "completed",
      notes: "Primer simulacro completo del año. Resultado general satisfactorio. CCHEN fue informado en informe anual.",
    },
    {
      drill_code: `SIM-EMERG-${year - 1}-02`,
      drill_date: `${year - 1}-11-20`,
      drill_type: "tabletop",
      scenario: "Ejercicio de escritorio: paciente colapsado en sala de administración de I-131 (dosis terapéutica). Evaluar protocolo de código azul en área radiactiva.",
      location: "Medicina Nuclear — Sala de Reuniones",
      coordinator: "Dr. Luis Morales (Jefe MN) + TM. Diego Solís C.",
      participants: 12,
      participants_list: "Equipo completo de Medicina Nuclear + Equipo de Urgencias + Encargado PR",
      cchen_notified: false,
      duration_minutes: 120,
      overall_score: 8.5,
      overall_rating: "good",
      objectives: "Evaluar coordinación entre medicina nuclear y urgencias en emergencia médica con paciente radiactivo.",
      achievements: "Excelente participación del equipo de urgencias. El protocolo revisado funcionó bien. Se identificaron roles claros.",
      deficiencies: "El médico de urgencias no estaba familiarizado con el dosímetro de emergencia.",
      corrective_actions: "Capacitación específica a equipo de urgencias sobre manejo de paciente con I-131. Programada para dic-2024.",
      next_drill_date: `${year}-11-01`,
      status: "completed",
    },
    {
      drill_code: `SIM-EMERG-${year}-01`,
      drill_date: `${year}-04-10`,
      drill_type: "evacuation",
      scenario: "Alarma de incendio en bloque D (Medicina Nuclear) durante turno operativo. Evaluación de evacuación del área controlada con paciente post-administración de radiofármaco.",
      location: "Medicina Nuclear — Bloque D completo",
      coordinator: "TM. Diego Solís C.",
      participants: 15,
      participants_list: "Personal MN, 2 pacientes (voluntarios capacitados), Jefatura PR, Brigada de emergencia hospital",
      observers: "Administración Hospital, Jefe de Radiología",
      cchen_notified: false,
      duration_minutes: 45,
      overall_score: 8.2,
      overall_rating: "good",
      objectives: "1. Evacuación del área en < 5 min\n2. Manejo seguro de paciente con radiofármaco\n3. Conteo del personal en punto de reunión\n4. Comunicación con brigada hospitalaria",
      achievements: "Evacuación completada en 4:30 min. Protocolo de paciente con radiofármaco ejecutado correctamente. Punto de reunión despejado y conteo verificado.",
      deficiencies: "Un guardia de seguridad quiso detener al paciente. Falta coordinación previa con seguridad.",
      corrective_actions: "Reunión de coordinación con jefatura de seguridad del hospital programada.",
      status: "completed",
    },
    {
      drill_code: `SIM-EMERG-${year}-02`,
      drill_date: `${year + 0}-09-15`,
      drill_type: "full",
      scenario: "Simulacro anual completo: Contaminación superficial en área de radiología por rotura accidental de portafuentes. Evaluación completa del plan de emergencia.",
      location: "Radiología — Sala 1 y pasillo adyacente",
      coordinator: "TM. Diego Solís C.",
      participants: 0,
      cchen_notified: false,
      status: "planned",
      objectives: "1. Verificar mejoras implementadas desde simulacro 2024\n2. Evaluar personal nuevo incorporado en 2025\n3. Verificar funcionamiento de equipos de emergencia\n4. Evaluar coordinación inter-servicios",
      next_drill_date: `${year + 1}-09-01`,
      notes: "Simulacro anual programado. Pendiente confirmar fecha exacta con jefatura.",
    },
  ];

  for (const drill of drills) {
    const keys = Object.keys(drill);
    const vals = Object.values(drill);
    await sql.unsafe(
      `INSERT INTO emergency_drills (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) ON CONFLICT (drill_code) DO NOTHING`,
      vals
    );
  }

  // Add evaluation criteria for first drill
  const { rows: firstDrill } = await sql`SELECT id FROM emergency_drills WHERE drill_code=${`SIM-EMERG-${year - 1}-01`}`;
  if (firstDrill[0]) {
    const evalCriteria = [
      { criterion: "Tiempo de respuesta inicial (< 3 min)", score: 9.0, observations: "Alarma activada en 2:05 min. Excelente." },
      { criterion: "Uso correcto de EPP", score: 7.5, observations: "7/8 participantes OK. Un TM sin mascarilla correcta." },
      { criterion: "Delimitación del área", score: 8.0, observations: "Área delimitada en 8 min. Cintas y señales correctas." },
      { criterion: "Notificación a jefatura", score: 9.0, observations: "Jefe de MN notificado en 5 min. Protocolo cumplido." },
      { criterion: "Descontaminación del personal", score: 7.0, observations: "Procedimiento correcto pero tardó 20 min extra." },
      { criterion: "Registro del incidente", score: 6.5, observations: "Formulario completado 15 min tarde." },
      { criterion: "Comunicación con pacientes/público", score: 7.0, observations: "Faltó protocolo específico para notificación a sala de espera." },
    ];
    for (const ec of evalCriteria) {
      await sql.unsafe(
        `INSERT INTO drill_evaluations (drill_id, criterion, score, max_score, observations) VALUES ($1,$2,$3,$4,$5)`,
        [firstDrill[0].id, ec.criterion, ec.score, 10, ec.observations]
      );
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const drillId = sp.get("drill_id");
    const status = sp.get("status") ?? "";
    const type = sp.get("type") ?? "";

    if (drillId) {
      const { rows } = await sql.unsafe(
        `SELECT * FROM drill_evaluations WHERE drill_id=$1 ORDER BY id`, [drillId]
      );
      return NextResponse.json({ evaluations: rows });
    }

    let where = "active=true";
    const params: unknown[] = [];
    if (status) { params.push(status); where += ` AND status=$${params.length}`; }
    if (type) { params.push(type); where += ` AND drill_type=$${params.length}`; }

    const { rows } = await sql.unsafe(
      `SELECT d.*,
        (SELECT COUNT(*)::int FROM drill_evaluations e WHERE e.drill_id=d.id) AS eval_criteria_count,
        (SELECT AVG(score)::numeric(4,1) FROM drill_evaluations e WHERE e.drill_id=d.id) AS eval_avg_score
       FROM emergency_drills d WHERE ${where}
       ORDER BY drill_date DESC`,
      params
    );

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='completed')::int AS completed,
          COUNT(*) FILTER (WHERE status='planned')::int AS planned,
          ROUND(AVG(overall_score) FILTER (WHERE status='completed'), 1)::numeric AS avg_score,
          MAX(drill_date) FILTER (WHERE status='completed') AS last_drill_date,
          MIN(next_drill_date) FILTER (WHERE status IN ('completed','planned')) AS next_drill_date,
          COUNT(*) FILTER (WHERE overall_rating IN ('needs_improvement','failed') AND status='completed')::int AS below_acceptable,
          EXTRACT(DAY FROM MIN(next_drill_date) - CURRENT_DATE)::int AS days_to_next
        FROM emergency_drills WHERE active=true
      `;
      return s[0];
    }, {});

    return NextResponse.json({ drills: rows, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { _type, ...data } = body;

    if (_type === "evaluation") {
      const keys = Object.keys(data);
      const vals = Object.values(data);
      const { rows } = await sql.unsafe(
        `INSERT INTO drill_evaluations (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
        vals
      );
      return NextResponse.json({ evaluation: rows[0] }, { status: 201 });
    }

    const dateYear = data.drill_date ? new Date(data.drill_date as string).getFullYear() : new Date().getFullYear();
    const code = data.drill_code || await nextCode(dateYear);
    const fields = { drill_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO emergency_drills (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ drill: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    const fields = Object.keys(rest);
    const values = Object.values(rest);
    const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
    values.push(id);
    const { rows } = await sql.unsafe(
      `UPDATE emergency_drills SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ drill: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql.unsafe(`UPDATE emergency_drills SET active=false, updated_at=now() WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
