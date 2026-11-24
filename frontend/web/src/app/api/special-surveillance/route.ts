import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// §153 — Vigilancia Radiológica Especial POE
// DS 3/1985 Arts. 16-18 (mujeres embarazadas: 1 mSv durante embarazo)
// DS 3/1985 Art. 19 (menores de 18: 6 mSv/año — 30% límite adulto)
// CCHEN NS-05.0 §7 · IAEA GSR Part 3 Req. 30 · ICRP 103

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS special_surveillance (
    id                      SERIAL PRIMARY KEY,
    worker_rut              TEXT NOT NULL,
    worker_name             TEXT NOT NULL,
    service                 TEXT,
    surveillance_type       TEXT NOT NULL,  -- 'pregnant','nursing','minor','student','external_visitor','medical_condition'
    declared_date           DATE NOT NULL,
    expected_end_date       DATE,           -- fecha probable de parto / fin de período especial
    actual_end_date         DATE,
    dose_at_declaration_msv NUMERIC(10,4),  -- dosis acumulada al momento de declaración
    dose_limit_msv          NUMERIC(10,4),  -- límite aplicable según condición
    current_period_dose_msv NUMERIC(10,4),  -- dosis acumulada en período especial
    dosimeter_type          TEXT,           -- tipo de dosímetro asignado en período especial
    restrictions            TEXT,           -- restricciones de zona/tarea
    notes                   TEXT,
    status                  TEXT DEFAULT 'active',  -- active, closed, suspended
    notified_cchen          BOOLEAN DEFAULT FALSE,
    notified_cchen_date     DATE,
    created_by              TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS special_surveillance_monitoring (
    id                      SERIAL PRIMARY KEY,
    surveillance_id         INTEGER NOT NULL REFERENCES special_surveillance(id) ON DELETE CASCADE,
    monitoring_date         DATE NOT NULL,
    dose_period_msv         NUMERIC(10,4),
    cumulative_dose_msv     NUMERIC(10,4),
    dosimeter_code          TEXT,
    limit_remaining_msv     NUMERIC(10,4),
    limit_percent_used      NUMERIC(5,2),
    alarm_triggered         BOOLEAN DEFAULT FALSE,
    alarm_level             TEXT,           -- 'green','amber','red'
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
  )`;

  const { rows } = await sql`SELECT COUNT(*) FROM special_surveillance`;
  if (Number(rows[0].count) === 0) {
    // Seed demo — trabajadoras embarazadas + menor de edad
    await sql`INSERT INTO special_surveillance
      (worker_rut, worker_name, service, surveillance_type, declared_date,
       expected_end_date, dose_at_declaration_msv, dose_limit_msv,
       current_period_dose_msv, dosimeter_type, restrictions, status, notes)
      VALUES
      ('14.321.098-7', 'TM. Valentina Muñoz Ortiz', 'Medicina Nuclear',
       'pregnant', '2026-08-15', '2027-01-20',
       0.42, 1.00, 0.18,
       'TLD mensual abdominal + OSL muñeca',
       'Sin acceso a sala PET-CT durante administración. No manipular I-131. Solo procedimientos diagnósticos de baja actividad.',
       'active', 'Embarazo notificado voluntariamente. Período gestacional semana 14 a la declaración.'),

      ('16.543.210-K', 'Int. Carlos Vásquez Pino', 'Radiología Diagnóstica',
       'student', '2026-03-01', '2026-12-15',
       0.00, 6.00, 1.24,
       'TLD mensual tronco',
       'Acceso solo a áreas supervisadas acompañado de supervisor certificado. Sin fluoroscopía intervencionista.',
       'active', 'Estudiante de TM en práctica. Límite reducido al 30% (6 mSv/año según DS 3/1985 Art. 19).'),

      ('12.876.543-2', 'Lic. Paz Fernández Riquelme', 'Radioterapia',
       'nursing', '2026-05-10', '2026-11-10',
       0.85, 1.00, 0.08,
       'TLD quincenal abdominal',
       'Sin manipulación de pacientes post-I-131 primeras 48h. No asistir a braquiterapia.',
       'active', 'Período de lactancia declarado voluntariamente.')
    `;

    // Seed monitoring records
    const { rows: surv } = await sql`SELECT id, surveillance_type, declared_date, dose_limit_msv FROM special_surveillance`;
    for (const s of surv) {
      const baseDate = new Date(s.declared_date as string);
      let cumulative = 0;
      for (let m = 0; m < 3; m++) {
        const monDate = new Date(baseDate);
        monDate.setMonth(monDate.getMonth() + m);
        const monthDose = s.surveillance_type === 'pregnant' ? 0.06 + Math.random() * 0.04 : 0.15 + Math.random() * 0.1;
        cumulative += monthDose;
        const limitMsv = Number(s.dose_limit_msv);
        const pctUsed = limitMsv > 0 ? (cumulative / limitMsv) * 100 : 0;
        const alarm = pctUsed >= 90 ? 'red' : pctUsed >= 75 ? 'amber' : 'green';
        await sql`INSERT INTO special_surveillance_monitoring
          (surveillance_id, monitoring_date, dose_period_msv, cumulative_dose_msv,
           limit_remaining_msv, limit_percent_used, alarm_triggered, alarm_level)
          VALUES
          (${s.id}, ${monDate.toISOString().split('T')[0]},
           ${monthDose.toFixed(4)}, ${cumulative.toFixed(4)},
           ${(limitMsv - cumulative).toFixed(4)}, ${pctUsed.toFixed(2)},
           ${alarm !== 'green'}, ${alarm})
        `;
      }
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const type   = searchParams.get("type");
    const status = searchParams.get("status") ?? "active";
    const id     = searchParams.get("id");

    if (id) {
      const { rows: [rec] } = await sql`SELECT * FROM special_surveillance WHERE id = ${Number(id)}`;
      const { rows: monitoring } = await sql`
        SELECT * FROM special_surveillance_monitoring
        WHERE surveillance_id = ${Number(id)}
        ORDER BY monitoring_date DESC
      `;
      return NextResponse.json({ record: rec, monitoring });
    }

    // Stats
    const { rows: stats } = await sql`
      SELECT
        COUNT(*)                                                   AS total,
        COUNT(*) FILTER (WHERE status = 'active')                  AS active,
        COUNT(*) FILTER (WHERE surveillance_type = 'pregnant')     AS pregnant,
        COUNT(*) FILTER (WHERE surveillance_type = 'nursing')      AS nursing,
        COUNT(*) FILTER (WHERE surveillance_type = 'student')      AS students,
        COUNT(*) FILTER (WHERE surveillance_type = 'minor')        AS minors,
        COUNT(*) FILTER (WHERE notified_cchen = FALSE AND status = 'active') AS pending_cchen
      FROM special_surveillance
    `;

    // Alarms
    const { rows: alarms } = await sql`
      SELECT s.id, s.worker_name, s.service, s.surveillance_type,
             m.cumulative_dose_msv, m.limit_percent_used, m.alarm_level
      FROM special_surveillance s
      JOIN (
        SELECT DISTINCT ON (surveillance_id)
          surveillance_id, cumulative_dose_msv, limit_percent_used, alarm_level
        FROM special_surveillance_monitoring
        ORDER BY surveillance_id, monitoring_date DESC
      ) m ON m.surveillance_id = s.id
      WHERE s.status = 'active' AND m.alarm_level IN ('amber','red')
      ORDER BY m.limit_percent_used DESC
    `;

    let query = sql`SELECT s.*,
      (SELECT m.cumulative_dose_msv FROM special_surveillance_monitoring m
       WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS latest_cumulative,
      (SELECT m.limit_percent_used FROM special_surveillance_monitoring m
       WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS latest_pct,
      (SELECT m.alarm_level FROM special_surveillance_monitoring m
       WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS alarm_level
      FROM special_surveillance s
      WHERE 1=1`;

    if (status !== "all") {
      query = sql`SELECT s.*,
        (SELECT m.cumulative_dose_msv FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS latest_cumulative,
        (SELECT m.limit_percent_used FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS latest_pct,
        (SELECT m.alarm_level FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS alarm_level
        FROM special_surveillance s
        WHERE s.status = ${status}
        ORDER BY s.created_at DESC`;
    } else {
      query = sql`SELECT s.*,
        (SELECT m.cumulative_dose_msv FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS latest_cumulative,
        (SELECT m.limit_percent_used FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS latest_pct,
        (SELECT m.alarm_level FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS alarm_level
        FROM special_surveillance s
        ORDER BY s.created_at DESC`;
    }

    if (type) {
      query = sql`SELECT s.*,
        (SELECT m.cumulative_dose_msv FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS latest_cumulative,
        (SELECT m.limit_percent_used FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS latest_pct,
        (SELECT m.alarm_level FROM special_surveillance_monitoring m
         WHERE m.surveillance_id = s.id ORDER BY m.monitoring_date DESC LIMIT 1) AS alarm_level
        FROM special_surveillance s
        WHERE s.surveillance_type = ${type}
        ORDER BY s.created_at DESC`;
    }

    const { rows } = await query;
    return NextResponse.json({ records: rows, stats: stats[0], alarms });
  } catch (err) {
    console.error("special-surveillance GET:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const {
      worker_rut, worker_name, service = null,
      surveillance_type, declared_date, expected_end_date = null,
      dose_at_declaration_msv = null, dosimeter_type = null,
      restrictions = null, notes = null, created_by = null,
    } = body;

    if (!worker_rut || !worker_name || !surveillance_type || !declared_date) {
      return NextResponse.json({ error: "worker_rut, worker_name, surveillance_type y declared_date requeridos" }, { status: 400 });
    }

    // Set dose limit based on type
    const DOSE_LIMITS: Record<string, number> = {
      pregnant: 1.0,   // DS 3/1985 Art. 16: 1 mSv durante embarazo
      nursing:  1.0,   // protección voluntaria — aplicar mismo límite gestación
      minor:    6.0,   // DS 3/1985 Art. 19: 30% de 20 mSv = 6 mSv/año
      student:  6.0,   // igual que menor
      external_visitor: 2.0,
      medical_condition: 15.0,
    };
    const dose_limit_msv = DOSE_LIMITS[surveillance_type] ?? 15.0;

    const { rows } = await sql`
      INSERT INTO special_surveillance
        (worker_rut, worker_name, service, surveillance_type, declared_date,
         expected_end_date, dose_at_declaration_msv, dose_limit_msv,
         current_period_dose_msv, dosimeter_type, restrictions, notes, created_by)
      VALUES
        (${worker_rut}, ${worker_name}, ${service}, ${surveillance_type}, ${declared_date},
         ${expected_end_date}, ${dose_at_declaration_msv}, ${dose_limit_msv},
         0, ${dosimeter_type}, ${restrictions}, ${notes}, ${created_by})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("special-surveillance POST:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const body = await req.json();
    const {
      status, actual_end_date = null, restrictions = null, notes = null,
      notified_cchen = null, notified_cchen_date = null,
      current_period_dose_msv = null,
    } = body;

    const { rows } = await sql`
      UPDATE special_surveillance SET
        status                  = COALESCE(${status ?? null}, status),
        actual_end_date         = COALESCE(${actual_end_date}, actual_end_date),
        restrictions            = COALESCE(${restrictions}, restrictions),
        notes                   = COALESCE(${notes}, notes),
        notified_cchen          = COALESCE(${notified_cchen}, notified_cchen),
        notified_cchen_date     = COALESCE(${notified_cchen_date}, notified_cchen_date),
        current_period_dose_msv = COALESCE(${current_period_dose_msv}, current_period_dose_msv),
        updated_at              = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    return NextResponse.json(rows[0] ?? null);
  } catch (err) {
    console.error("special-surveillance PATCH:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
