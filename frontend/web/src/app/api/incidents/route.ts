import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS radiological_incidents (
      id SERIAL PRIMARY KEY,
      incident_code VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(300) NOT NULL,
      description TEXT,
      incident_date DATE NOT NULL,
      incident_time TIME,
      location VARCHAR(200),
      area VARCHAR(100),
      incident_type VARCHAR(50) NOT NULL,
      ines_level INT NOT NULL DEFAULT 0,
      severity VARCHAR(20) NOT NULL DEFAULT 'low',
      persons_involved INT DEFAULT 0,
      estimated_dose_msv NUMERIC(10,4),
      contamination_detected BOOLEAN DEFAULT FALSE,
      immediate_actions TEXT,
      reported_internally BOOLEAN DEFAULT FALSE,
      internal_report_date DATE,
      cchen_notified BOOLEAN DEFAULT FALSE,
      cchen_notification_date DATE,
      cchen_notification_number VARCHAR(100),
      investigation_status VARCHAR(30) NOT NULL DEFAULT 'open',
      root_cause TEXT,
      contributing_factors TEXT,
      corrective_actions TEXT,
      preventive_actions TEXT,
      closure_date DATE,
      closure_notes TEXT,
      reported_by VARCHAR(150),
      investigated_by VARCHAR(150),
      approved_by VARCHAR(150),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS incident_actions (
      id SERIAL PRIMARY KEY,
      incident_id INT NOT NULL REFERENCES radiological_incidents(id) ON DELETE CASCADE,
      action_type VARCHAR(30) NOT NULL DEFAULT 'corrective',
      description TEXT NOT NULL,
      responsible VARCHAR(150),
      due_date DATE,
      completion_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM radiological_incidents`;
  if (parseInt((count as any)[0].count) === 0) {
    // Seed incidents
    await sql`
      INSERT INTO radiological_incidents (
        incident_code, title, description, incident_date, incident_time,
        location, area, incident_type, ines_level, severity,
        persons_involved, estimated_dose_msv, contamination_detected,
        immediate_actions, reported_internally, internal_report_date,
        cchen_notified, investigation_status, root_cause, corrective_actions,
        closure_date, reported_by, investigated_by, approved_by
      ) VALUES (
        'INC-2025-001',
        'Pérdida transitoria dosímetro TLD — tecnólogo MN',
        'Dosímetro TLD del TM Juan Pérez (MN) no encontrado al retirarse del servicio. Se realizó búsqueda y fue localizado en vestidor área limpia luego de 2 horas.',
        '2025-11-10', '17:30',
        'Servicio Medicina Nuclear', 'Área Administración Radiofármacos',
        'loss_device', 0, 'low',
        1, NULL, FALSE,
        'Se realizó búsqueda inmediata en el área. Dosímetro recuperado. Se notificó a jefatura de turno.',
        TRUE, '2025-11-10', FALSE,
        'closed',
        'Falta de protocolo de verificación al cierre de turno. Dosímetro dejado en bolsillo de pechera de protección.',
        'Implementar lista de verificación de cierre de turno que incluya portadosímetro. Capacitación al personal sobre uso correcto.',
        '2025-11-15', 'TM Protección Radiológica', 'Encargado PR', 'Jefe Medicina Nuclear'
      )
    `;
    await sql`
      INSERT INTO incident_actions (incident_id, action_type, description, responsible, due_date, completion_date, status)
      SELECT id, 'corrective', 'Implementar lista de verificación de cierre de turno (check-list)',
        'TM Protección Radiológica', '2025-11-30', '2025-11-18', 'completed'
      FROM radiological_incidents WHERE incident_code = 'INC-2025-001'
    `;
    await sql`
      INSERT INTO incident_actions (incident_id, action_type, description, responsible, due_date, status)
      SELECT id, 'preventive', 'Capacitación al personal sobre protocolo de portadosímetro',
        'TM Protección Radiológica', '2025-12-15', 'in_progress'
      FROM radiological_incidents WHERE incident_code = 'INC-2025-001'
    `;

    await sql`
      INSERT INTO radiological_incidents (
        incident_code, title, description, incident_date, incident_time,
        location, area, incident_type, ines_level, severity,
        persons_involved, estimated_dose_msv, contamination_detected,
        immediate_actions, reported_internally, internal_report_date,
        cchen_notified, investigation_status,
        reported_by, investigated_by
      ) VALUES (
        'INC-2025-002',
        'Derrame menor radiofármaco Tc-99m — laboratorio marcación',
        'Pequeño derrame de ~0,5 mL de solución Tc-99m (actividad estimada 5 MBq) durante carga de jeringa en cámara de plomada. Personal llevaba EPP completo.',
        '2025-10-22', '09:15',
        'Laboratorio de Radiofármacos', 'Cámara de Plomada',
        'spill', 0, 'low',
        1, 0.001, TRUE,
        'Se activó protocolo de descontaminación. Cámara sellada. Medición con survey meter Thermo FH 40 GL. Contaminación localizada y limpiada.',
        TRUE, '2025-10-22',
        FALSE, 'in_progress',
        'TM Radiofarmacia', 'Encargado PR'
      )
    `;
    await sql`
      INSERT INTO incident_actions (incident_id, action_type, description, responsible, due_date, status)
      SELECT id, 'corrective', 'Revisión y actualización del procedimiento de marcación de radiofármacos',
        'TM Radiofarmacia', '2025-11-30', 'pending'
      FROM radiological_incidents WHERE incident_code = 'INC-2025-002'
    `;
    await sql`
      INSERT INTO incident_actions (incident_id, action_type, description, responsible, due_date, status)
      SELECT id, 'preventive', 'Verificación del estado de las jeringas y set de administración antes de uso',
        'TM Radiofarmacia', '2025-11-15', 'in_progress'
      FROM radiological_incidents WHERE incident_code = 'INC-2025-002'
    `;

    // Potential event — near-miss
    await sql`
      INSERT INTO radiological_incidents (
        incident_code, title, description, incident_date, incident_time,
        location, area, incident_type, ines_level, severity,
        persons_involved, contamination_detected,
        immediate_actions, reported_internally, internal_report_date,
        cchen_notified, investigation_status,
        reported_by
      ) VALUES (
        'INC-2024-001',
        'Cuasi-accidente: paciente recibe dosis diferente a la prescrita (Ga-67)',
        'Al momento de administrar Ga-67 para gammagrafía ósea, el calibrador de dosis arrojó lectura de 95 MBq vs los 150 MBq prescritos. Se detuvo la administración, se verificó y se confirmó error en la carga del generador.',
        '2024-08-15', '08:45',
        'Servicio Medicina Nuclear', 'Sala de Administración',
        'near_miss', 0, 'medium',
        2, FALSE,
        'Se detuvo inmediatamente. Se calibró correctamente el radiofármaco. Se administró dosis correcta. Se informó a médico tratante.',
        TRUE, '2024-08-15',
        FALSE, 'closed',
        'TM Radiofarmacia'
      )
    `;
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");
    const ines = searchParams.get("ines");
    const year = searchParams.get("year");

    if (id) {
      const rows = await sql`SELECT * FROM radiological_incidents WHERE id = ${id}`;
      if (!(rows as any[]).length) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const actions = await sql`SELECT * FROM incident_actions WHERE incident_id = ${id} ORDER BY created_at`;
      return NextResponse.json({ incident: (rows as any[])[0], actions });
    }

    let baseQ = `SELECT * FROM radiological_incidents WHERE active = TRUE`;
    const params: any[] = [];
    let p = 1;
    if (status) { baseQ += ` AND investigation_status = $${p++}`; params.push(status); }
    if (ines !== null && ines !== "") { baseQ += ` AND ines_level = $${p++}`; params.push(parseInt(ines)); }
    if (year) { baseQ += ` AND EXTRACT(YEAR FROM incident_date) = $${p++}`; params.push(parseInt(year)); }
    baseQ += ` ORDER BY incident_date DESC`;

    const incidents = await sql.unsafe(baseQ, params);

    let stats: any = {};
    try {
      const st = await sql`
        SELECT
          COUNT(*) FILTER (WHERE active) AS total,
          COUNT(*) FILTER (WHERE active AND investigation_status = 'open') AS open_count,
          COUNT(*) FILTER (WHERE active AND investigation_status = 'in_progress') AS in_progress_count,
          COUNT(*) FILTER (WHERE active AND investigation_status = 'closed') AS closed_count,
          COUNT(*) FILTER (WHERE active AND ines_level >= 1) AS ines_1_plus,
          COUNT(*) FILTER (WHERE active AND ines_level = 0 AND severity = 'medium') AS near_miss_medium,
          COUNT(*) FILTER (WHERE active AND cchen_notified = FALSE AND ines_level >= 1) AS cchen_pending,
          COUNT(*) FILTER (WHERE active AND EXTRACT(YEAR FROM incident_date) = EXTRACT(YEAR FROM CURRENT_DATE)) AS this_year
        FROM radiological_incidents
      `;
      stats = (st as any[])[0];
    } catch {}

    // Years
    let years: number[] = [];
    try {
      const yrs = await sql`SELECT DISTINCT EXTRACT(YEAR FROM incident_date)::INT AS y FROM radiological_incidents ORDER BY y DESC`;
      years = (yrs as any[]).map(r => r.y);
    } catch {}

    return NextResponse.json({ incidents, stats, years });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();

    if (body._type === "action") {
      const { incident_id, action_type, description, responsible, due_date, notes } = body;
      const a = await sql`
        INSERT INTO incident_actions (incident_id, action_type, description, responsible, due_date, notes)
        VALUES (${incident_id}, ${action_type || 'corrective'}, ${description}, ${responsible || null}, ${due_date || null}, ${notes || null})
        RETURNING *
      `;
      return NextResponse.json((a as any[])[0], { status: 201 });
    }

    if (body._type === "action_update") {
      const { action_id, status: s, completion_date, notes } = body;
      const a = await sql`
        UPDATE incident_actions SET status=${s}, completion_date=${completion_date || null}, notes=${notes || null}
        WHERE id=${action_id} RETURNING *
      `;
      return NextResponse.json((a as any[])[0]);
    }

    // Generate incident code
    const yr = new Date().getFullYear();
    const cnt = await sql`SELECT COUNT(*) FROM radiological_incidents WHERE EXTRACT(YEAR FROM incident_date) = ${yr}`;
    const seq = parseInt((cnt as any)[0].count) + 1;
    const incident_code = body.incident_code || `INC-${yr}-${String(seq).padStart(3, "0")}`;

    const {
      title, description, incident_date, incident_time, location, area,
      incident_type, ines_level, severity, persons_involved, estimated_dose_msv,
      contamination_detected, immediate_actions, reported_internally, internal_report_date,
      cchen_notified, cchen_notification_date, cchen_notification_number,
      reported_by, investigated_by
    } = body;

    const r = await sql`
      INSERT INTO radiological_incidents (
        incident_code, title, description, incident_date, incident_time, location, area,
        incident_type, ines_level, severity, persons_involved, estimated_dose_msv,
        contamination_detected, immediate_actions, reported_internally, internal_report_date,
        cchen_notified, cchen_notification_date, cchen_notification_number,
        reported_by, investigated_by
      ) VALUES (
        ${incident_code}, ${title}, ${description || null}, ${incident_date}, ${incident_time || null},
        ${location || null}, ${area || null}, ${incident_type}, ${ines_level ?? 0}, ${severity || 'low'},
        ${persons_involved ?? 0}, ${estimated_dose_msv || null}, ${contamination_detected ?? false},
        ${immediate_actions || null}, ${reported_internally ?? false}, ${internal_report_date || null},
        ${cchen_notified ?? false}, ${cchen_notification_date || null}, ${cchen_notification_number || null},
        ${reported_by || null}, ${investigated_by || null}
      )
      RETURNING *
    `;
    return NextResponse.json((r as any[])[0], { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const allowed = [
      "title", "description", "incident_date", "incident_time", "location", "area",
      "incident_type", "ines_level", "severity", "persons_involved", "estimated_dose_msv",
      "contamination_detected", "immediate_actions", "reported_internally", "internal_report_date",
      "cchen_notified", "cchen_notification_date", "cchen_notification_number",
      "investigation_status", "root_cause", "contributing_factors", "corrective_actions",
      "preventive_actions", "closure_date", "closure_notes", "reported_by", "investigated_by", "approved_by"
    ];
    const sets: string[] = [];
    const vals: any[] = [];
    let p = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { sets.push(`"${k}"=$${p++}`); vals.push(v); }
    }
    if (sets.length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    sets.push(`updated_at=NOW()`);
    vals.push(id);
    const row = await sql.unsafe(
      `UPDATE radiological_incidents SET ${sets.join(",")} WHERE id=$${p} RETURNING *`,
      vals
    );
    return NextResponse.json((row as any[])[0]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await sql`UPDATE radiological_incidents SET active=FALSE, updated_at=NOW() WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
