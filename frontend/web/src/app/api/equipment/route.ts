import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// §54 — Gestión de Equipos y Mantenimiento
// DS 3/1985 Art. 18 — equipos bajo norma técnica
// IAEA TECDOC-1040 — control calidad equipos medicina nuclear

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS equipment (
      id               SERIAL PRIMARY KEY,
      equipment_code   VARCHAR(50) UNIQUE NOT NULL,
      name             TEXT NOT NULL,
      category         VARCHAR(50) NOT NULL DEFAULT 'gamma_camera',
      model            TEXT,
      brand            TEXT,
      serial_number    VARCHAR(100),
      acquisition_date DATE,
      installation_date DATE,
      location         TEXT,
      responsible      TEXT,
      vendor_id        INT,
      maintenance_type VARCHAR(30) DEFAULT 'preventive',
      last_maintenance DATE,
      next_maintenance DATE,
      maintenance_freq_months INT DEFAULT 6,
      last_calibration DATE,
      next_calibration DATE,
      calibration_freq_months INT DEFAULT 12,
      last_qa          DATE,
      next_qa          DATE,
      qa_freq_months   INT DEFAULT 3,
      warranty_expiry  DATE,
      status           VARCHAR(30) NOT NULL DEFAULT 'operational',
      observations     TEXT,
      references_norm  TEXT,
      notes            TEXT,
      active           BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS equipment_events (
      id            SERIAL PRIMARY KEY,
      equipment_id  INT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      event_type    VARCHAR(30) NOT NULL DEFAULT 'maintenance',
      event_date    DATE NOT NULL,
      end_date      DATE,
      performed_by  TEXT,
      entity        TEXT,
      description   TEXT,
      findings      TEXT,
      result        VARCHAR(20) DEFAULT 'approved',
      next_due      DATE,
      cost          NUMERIC(12,2),
      order_number  VARCHAR(50),
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM equipment`;
  if (parseInt(count[0]?.count ?? "0") === 0) {
    await sql`
      INSERT INTO equipment (equipment_code, name, category, model, brand, serial_number, acquisition_date, installation_date, location, responsible, maintenance_freq_months, last_maintenance, next_maintenance, calibration_freq_months, last_calibration, next_calibration, qa_freq_months, last_qa, next_qa, status, references_norm)
      VALUES
        ('EQ-MN-001', 'Gammacámara SPECT/CT', 'gamma_camera', 'Discovery NM/CT 670', 'GE Healthcare', 'SN-GE-MN-2019-001', '2019-03-15', '2019-04-20', 'Sala Gammacámara, Medicina Nuclear piso 2', 'Tecnólogo Médico Encargado', 6, '2025-05-10', '2025-11-10', 12, '2025-01-15', '2026-01-15', 3, '2025-09-01', '2025-12-01', 'operational', 'DS 3/1985 Art. 18; IAEA TECDOC-1040; NEMA NU1-2018'),
        ('EQ-RF-001', 'Calibrador de dosis (Curiemeter)', 'dose_calibrator', 'CRC-55tR', 'Capintec', 'SN-CAP-RF-2020-002', '2020-08-01', '2020-08-15', 'Radiofarmacia, piso 3', 'Radiofarmacéutica', 12, '2025-06-01', '2026-06-01', 12, '2025-01-10', '2026-01-10', 1, '2025-10-15', '2025-11-15', 'operational', 'DS 3/1985 Art. 42; IAEA TECDOC-602; NRC Reg. Guide 10.8'),
        ('EQ-MN-002', 'Sistema PET/CT', 'pet_ct', 'Biograph mCT 128', 'Siemens Healthineers', 'SN-SIE-MN-2021-001', '2021-05-20', '2021-06-15', 'Sala PET/CT, Medicina Nuclear piso 2', 'Físico Médico', 6, '2025-07-20', '2026-01-20', 12, '2025-02-28', '2026-02-28', 3, '2025-09-15', '2025-12-15', 'operational', 'DS 3/1985 Art. 18; IAEA TECDOC-1040; NEMA NU2-2018'),
        ('EQ-RP-001', 'Contador de pozo (Well counter)', 'survey_meter', 'Wizard2 2480', 'PerkinElmer', 'SN-PE-RP-2018-001', '2018-11-01', '2018-11-20', 'Laboratorio Protección Radiológica', 'Encargado Protección Radiológica', 12, '2025-04-10', '2026-04-10', 12, '2025-04-10', '2026-04-10', 6, '2025-07-01', '2026-01-01', 'operational', 'DS 3/1985; IAEA Safety Reports Series No.16'),
        ('EQ-RP-002', 'Monitor de área (Geiger-Müller)', 'survey_meter', 'FH 40 GL', 'Thermo Scientific', 'SN-TS-RP-2022-003', '2022-02-14', '2022-02-28', 'Sala de espera terapia I-131', 'Encargado Protección Radiológica', 12, '2025-02-28', '2026-02-28', 12, '2025-02-28', '2026-02-28', 6, '2025-08-15', '2026-02-15', 'maintenance', 'DS 3/1985 Art. 50; IEC 60846-1')
    `;
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id       = searchParams.get("id");
    const category = searchParams.get("category");
    const status   = searchParams.get("status");

    if (id) {
      const [eq] = await sql`SELECT * FROM equipment WHERE id = ${id} AND active = TRUE`;
      if (!eq) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      const events = await sql`SELECT * FROM equipment_events WHERE equipment_id = ${id} ORDER BY event_date DESC`;
      return NextResponse.json({ equipment: eq, events });
    }

    let equipment;
    if (category && status) {
      equipment = await sql`SELECT * FROM equipment WHERE active=TRUE AND category=${category} AND status=${status} ORDER BY name`;
    } else if (category) {
      equipment = await sql`SELECT * FROM equipment WHERE active=TRUE AND category=${category} ORDER BY name`;
    } else if (status) {
      equipment = await sql`SELECT * FROM equipment WHERE active=TRUE AND status=${status} ORDER BY name`;
    } else {
      equipment = await sql`SELECT * FROM equipment WHERE active=TRUE ORDER BY name`;
    }

    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE active)                                                   AS total,
        COUNT(*) FILTER (WHERE active AND status='operational')                           AS operational,
        COUNT(*) FILTER (WHERE active AND status='maintenance')                           AS maintenance,
        COUNT(*) FILTER (WHERE active AND status='out_of_service')                        AS out_of_service,
        COUNT(*) FILTER (WHERE active AND next_maintenance <= CURRENT_DATE + INTERVAL '30 days' AND status='operational') AS maintenance_due,
        COUNT(*) FILTER (WHERE active AND next_calibration <= CURRENT_DATE + INTERVAL '30 days' AND status='operational') AS calibration_due,
        COUNT(*) FILTER (WHERE active AND next_qa <= CURRENT_DATE AND status='operational') AS qa_overdue
      FROM equipment
    `;

    return NextResponse.json({ equipment, stats });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    // Handle equipment_event sub-creation
    if (body._type === "event") {
      const { equipment_id, event_type, event_date, end_date, performed_by, entity, description, findings, result, next_due, cost, order_number, notes } = body;
      if (!equipment_id || !event_date) return NextResponse.json({ error: "equipment_id y event_date requeridos" }, { status: 400 });
      const [row] = await sql`
        INSERT INTO equipment_events (equipment_id, event_type, event_date, end_date, performed_by, entity, description, findings, result, next_due, cost, order_number, notes)
        VALUES (${equipment_id}, ${event_type ?? "maintenance"}, ${event_date}, ${end_date ?? null}, ${performed_by ?? null}, ${entity ?? null}, ${description ?? null}, ${findings ?? null}, ${result ?? "approved"}, ${next_due ?? null}, ${cost ?? null}, ${order_number ?? null}, ${notes ?? null})
        RETURNING *
      `;
      // Update last/next dates on equipment based on event type
      if (event_type === "maintenance" && next_due) {
        await sql`UPDATE equipment SET last_maintenance=${event_date}, next_maintenance=${next_due}, updated_at=now() WHERE id=${equipment_id}`;
      } else if (event_type === "calibration" && next_due) {
        await sql`UPDATE equipment SET last_calibration=${event_date}, next_calibration=${next_due}, updated_at=now() WHERE id=${equipment_id}`;
      } else if (event_type === "qa" && next_due) {
        await sql`UPDATE equipment SET last_qa=${event_date}, next_qa=${next_due}, updated_at=now() WHERE id=${equipment_id}`;
      }
      return NextResponse.json(row, { status: 201 });
    }

    const { equipment_code, name, category = "gamma_camera", model, brand, serial_number, acquisition_date, installation_date, location, responsible, maintenance_freq_months = 6, last_maintenance, next_maintenance, calibration_freq_months = 12, last_calibration, next_calibration, qa_freq_months = 3, last_qa, next_qa, warranty_expiry, status = "operational", references_norm, notes } = body;
    if (!equipment_code || !name) return NextResponse.json({ error: "Código y nombre requeridos" }, { status: 400 });
    const [row] = await sql`
      INSERT INTO equipment (equipment_code, name, category, model, brand, serial_number, acquisition_date, installation_date, location, responsible, maintenance_freq_months, last_maintenance, next_maintenance, calibration_freq_months, last_calibration, next_calibration, qa_freq_months, last_qa, next_qa, warranty_expiry, status, references_norm, notes)
      VALUES (${equipment_code}, ${name}, ${category}, ${model ?? null}, ${brand ?? null}, ${serial_number ?? null}, ${acquisition_date ?? null}, ${installation_date ?? null}, ${location ?? null}, ${responsible ?? null}, ${maintenance_freq_months}, ${last_maintenance ?? null}, ${next_maintenance ?? null}, ${calibration_freq_months}, ${last_calibration ?? null}, ${next_calibration ?? null}, ${qa_freq_months}, ${last_qa ?? null}, ${next_qa ?? null}, ${warranty_expiry ?? null}, ${status}, ${references_norm ?? null}, ${notes ?? null})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const allowed = ["name","category","model","brand","serial_number","acquisition_date","installation_date","location","responsible","maintenance_freq_months","last_maintenance","next_maintenance","calibration_freq_months","last_calibration","next_calibration","qa_freq_months","last_qa","next_qa","warranty_expiry","status","observations","references_norm","notes"];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (!entries.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });
    const setClauses = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
    const values = [id, ...entries.map(([, v]) => v)];
    const rows = await sql.unsafe(`UPDATE equipment SET ${setClauses}, updated_at=now() WHERE id=$1 AND active=TRUE RETURNING *`, values);
    return NextResponse.json(rows[0] ?? null);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`UPDATE equipment SET active=FALSE, updated_at=now() WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
