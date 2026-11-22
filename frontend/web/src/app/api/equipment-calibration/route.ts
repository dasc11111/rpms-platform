export const dynamic = "force-dynamic";
import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch (e) { console.error(e); return fallback; }
}

async function initTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS calibration_equipment (
      id SERIAL PRIMARY KEY,
      equipment_code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      model VARCHAR(100),
      manufacturer VARCHAR(100),
      serial_number VARCHAR(100),
      equipment_type VARCHAR(50) NOT NULL DEFAULT 'detector',
      service VARCHAR(100),
      location VARCHAR(150),
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      last_calibration_date DATE,
      next_calibration_date DATE,
      calibration_interval_days INTEGER DEFAULT 365,
      last_qc_date DATE,
      next_qc_date DATE,
      qc_interval_days INTEGER DEFAULT 1,
      cchen_registration VARCHAR(50),
      authorized_user VARCHAR(100),
      notes TEXT,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS calibration_records (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER REFERENCES calibration_equipment(id),
      record_type VARCHAR(30) NOT NULL DEFAULT 'calibration',
      record_date DATE NOT NULL DEFAULT CURRENT_DATE,
      performed_by VARCHAR(100),
      lab_or_entity VARCHAR(150),
      reference_source VARCHAR(100),
      result VARCHAR(30) DEFAULT 'pass',
      measured_value NUMERIC(12,4),
      expected_value NUMERIC(12,4),
      deviation_pct NUMERIC(6,2),
      uncertainty_pct NUMERIC(6,2),
      calibration_factor NUMERIC(12,6),
      correction_factor NUMERIC(12,6),
      certificate_number VARCHAR(100),
      valid_until DATE,
      next_due_date DATE,
      comments TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM calibration_equipment`;
  if (parseInt(count[0].count) > 0) return;

  const today = new Date();
  const dateStr = (d: Date) => d.toISOString().split("T")[0];
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const equipment = [
    { code: "EC-001", name: "Contador Geiger-Müller portátil", model: "RD-50", manufacturer: "Radiagem", serial: "RG-2019-4471", type: "area_monitor", service: "Medicina Nuclear", location: "Sala hot lab", lastCal: addDays(today, -180), calInterval: 365, lastQC: addDays(today, -1), qcInterval: 7, cchen: "CCHEN-DET-2019-0441", status: "active" },
    { code: "EC-002", name: "Dosis-calibrador RISOmat", model: "RISOmat", manufacturer: "Comecer", serial: "RC-2020-0882", type: "dose_calibrator", service: "Medicina Nuclear", location: "Radiofarmacia", lastCal: addDays(today, -60), calInterval: 365, lastQC: addDays(today, -0), qcInterval: 1, cchen: "CCHEN-DET-2020-0882", status: "active" },
    { code: "EC-003", name: "Gammacámara Siemens Symbia T2", model: "Symbia T2", manufacturer: "Siemens Healthineers", serial: "SH-2021-7734", type: "gamma_camera", service: "Medicina Nuclear", location: "Sala gammacámara", lastCal: addDays(today, -45), calInterval: 180, lastQC: addDays(today, -1), qcInterval: 1, cchen: "CCHEN-GC-2021-0334", status: "active" },
    { code: "EC-004", name: "Detector de contaminación superficial", model: "MRD-50", manufacturer: "Mini-instruments", serial: "MI-2018-3321", type: "contamination_monitor", service: "Radioprotección", location: "Depto. Radiofísica", lastCal: addDays(today, -400), calInterval: 365, lastQC: addDays(today, -3), qcInterval: 7, cchen: "CCHEN-DET-2018-0221", status: "overdue" },
    { code: "EC-005", name: "Electrómetro Keithley 6517B", model: "6517B", manufacturer: "Keithley", serial: "KE-2017-9941", type: "electrometer", service: "Radioterapia", location: "Lab. Dosimetría RT", lastCal: addDays(today, -30), calInterval: 365, lastQC: addDays(today, -0), qcInterval: 7, cchen: "", status: "active" },
    { code: "EC-006", name: "Cámara ionización Farmer FC65-G", model: "FC65-G", manufacturer: "IBA Dosimetry", serial: "IBA-2020-FC65-7721", type: "ionization_chamber", service: "Radioterapia", location: "Lab. Dosimetría RT", lastCal: addDays(today, -30), calInterval: 365, lastQC: addDays(today, -7), qcInterval: 90, cchen: "CCHEN-CI-2020-0771", status: "active" },
    { code: "EC-007", name: "Monitor de área H*(10) electrónico", model: "FHZ 672E", manufacturer: "Thermo Fisher", serial: "TF-2022-FH672-1123", type: "area_monitor", service: "Radioprotección", location: "Sala braquiterapia", lastCal: addDays(today, -10), calInterval: 365, lastQC: addDays(today, -1), qcInterval: 7, cchen: "CCHEN-DET-2022-1123", status: "active" },
    { code: "EC-008", name: "Fantoma agua sólida RT Dosimetría", model: "MP3-M", manufacturer: "PTW Freiburg", serial: "PTW-2019-MP3-4451", type: "phantom", service: "Radioterapia", location: "Bunker LINAC", lastCal: addDays(today, -365), calInterval: 730, lastQC: addDays(today, -30), qcInterval: 90, cchen: "", status: "active" },
  ];

  for (const eq of equipment) {
    const nextCal = addDays(eq.lastCal, eq.calInterval);
    const nextQC = addDays(eq.lastQC, eq.qcInterval);
    await sql`
      INSERT INTO calibration_equipment (equipment_code, name, model, manufacturer, serial_number, equipment_type, service, location, status, last_calibration_date, next_calibration_date, calibration_interval_days, last_qc_date, next_qc_date, qc_interval_days, cchen_registration)
      VALUES (${eq.code}, ${eq.name}, ${eq.model}, ${eq.manufacturer}, ${eq.serial}, ${eq.type}, ${eq.service}, ${eq.location}, ${eq.status}, ${dateStr(eq.lastCal)}, ${dateStr(nextCal)}, ${eq.calInterval}, ${dateStr(eq.lastQC)}, ${dateStr(nextQC)}, ${eq.qcInterval}, ${eq.cchen})
    `;
  }

  // Seed calibration records
  const eqRows = await sql`SELECT id, equipment_code FROM calibration_equipment ORDER BY equipment_code`;
  const idMap: Record<string, number> = {};
  for (const r of eqRows) idMap[r.equipment_code] = r.id;

  const records = [
    { code: "EC-002", type: "daily_qc", date: dateStr(today), by: "TM. J. Torres", result: "pass", measured: 999.2, expected: 1000.0, dev: -0.08, comment: "Constancia NIST Am-241. Dentro de ±1%" },
    { code: "EC-002", type: "constancy", date: dateStr(addDays(today, -1)), by: "TM. J. Torres", result: "pass", measured: 1001.1, expected: 1000.0, dev: 0.11 },
    { code: "EC-003", type: "daily_qc", date: dateStr(today), by: "TM. M. Reyes", result: "pass", measured: 99.4, expected: 100.0, dev: -0.6, comment: "Sensibilidad Co-57 100 kBq. FWHM 9.4%" },
    { code: "EC-005", type: "calibration", date: dateStr(addDays(today, -30)), by: "LMRI CCHEN", lab: "Lab. Metrología Radiológica CCHEN", result: "pass", cert: "CCHEN-LMRI-2024-05-887", dev: 0.3, calFactor: 1.0003 },
    { code: "EC-006", type: "calibration", date: dateStr(addDays(today, -30)), by: "LMRI CCHEN", lab: "Lab. Metrología Radiológica CCHEN", result: "pass", cert: "CCHEN-LMRI-2024-05-888", dev: 0.15, calFactor: 0.9985 },
    { code: "EC-004", type: "calibration", date: dateStr(addDays(today, -400)), by: "Proveedor Mini-instruments", result: "pass", cert: "MI-CAL-2023-0441", dev: 1.2 },
    { code: "EC-001", type: "calibration", date: dateStr(addDays(today, -180)), by: "LMRI CCHEN", lab: "Lab. Metrología Radiológica CCHEN", result: "pass", cert: "CCHEN-LMRI-2024-02-441", dev: 0.5 },
  ];

  for (const r of records) {
    if (!idMap[r.code]) continue;
    await sql`
      INSERT INTO calibration_records (equipment_id, record_type, record_date, performed_by, lab_or_entity, result, measured_value, expected_value, deviation_pct, certificate_number, calibration_factor, comments)
      VALUES (${idMap[r.code]}, ${r.type}, ${r.date}, ${r.by || null}, ${r.lab || null}, ${r.result}, ${r.measured || null}, ${r.expected || null}, ${r.dev || null}, ${r.cert || null}, ${r.calFactor || null}, ${r.comment || null})
    `;
  }
}

export async function GET(req: NextRequest) {
  return safeQuery(async () => {
    await initTables();
    const { searchParams } = new URL(req.url);
    const equipmentId = searchParams.get("equipment_id");
    const statusFilter = searchParams.get("status");
    const typeFilter = searchParams.get("equipment_type");
    const search = searchParams.get("search");

    if (equipmentId) {
      const records = await sql`
        SELECT * FROM calibration_records WHERE equipment_id = ${parseInt(equipmentId)} ORDER BY record_date DESC LIMIT 50
      `;
      return NextResponse.json({ records });
    }

    const today = new Date().toISOString().split("T")[0];

    let equipment = await sql`
      SELECT e.*,
        CASE WHEN e.next_calibration_date < ${today}::date THEN true ELSE false END AS calibration_overdue,
        CASE WHEN e.next_qc_date < ${today}::date THEN true ELSE false END AS qc_overdue,
        (${today}::date - e.last_calibration_date) AS days_since_calibration,
        (e.next_calibration_date - ${today}::date) AS days_to_calibration,
        (${today}::date - e.last_qc_date) AS days_since_qc,
        (e.next_qc_date - ${today}::date) AS days_to_qc
      FROM calibration_equipment e
      WHERE e.deleted_at IS NULL
      ORDER BY e.next_calibration_date ASC
    `;

    if (statusFilter) equipment = equipment.filter((e: { status: string }) => e.status === statusFilter);
    if (typeFilter) equipment = equipment.filter((e: { equipment_type: string }) => e.equipment_type === typeFilter);
    if (search) {
      const s = search.toLowerCase();
      equipment = equipment.filter((e: { name: string; equipment_code: string; service: string }) =>
        e.name.toLowerCase().includes(s) || e.equipment_code.toLowerCase().includes(s) || (e.service || "").toLowerCase().includes(s)
      );
    }

    const all = await sql`SELECT * FROM calibration_equipment WHERE deleted_at IS NULL`;
    const stats = {
      total: all.length,
      active: all.filter((e: { status: string }) => e.status === "active").length,
      overdue_calibration: all.filter((e: { next_calibration_date: string }) => e.next_calibration_date < today).length,
      overdue_qc: all.filter((e: { next_qc_date: string }) => e.next_qc_date < today).length,
      calibration_due_30d: all.filter((e: { next_calibration_date: string }) => {
        const diff = (new Date(e.next_calibration_date).getTime() - new Date(today).getTime()) / 86400000;
        return diff >= 0 && diff <= 30;
      }).length,
      qc_due_today: all.filter((e: { next_qc_date: string }) => e.next_qc_date <= today).length,
    };

    return NextResponse.json({ equipment, stats });
  }, NextResponse.json({ equipment: [], stats: {} }, { status: 500 }));
}

export async function POST(req: NextRequest) {
  return safeQuery(async () => {
    await initTables();
    const body = await req.json();

    if (body._type === "record") {
      const { equipment_id, record_type, record_date, performed_by, lab_or_entity, result, measured_value, expected_value, deviation_pct, uncertainty_pct, calibration_factor, correction_factor, certificate_number, valid_until, next_due_date, comments } = body;
      const inserted = await sql`
        INSERT INTO calibration_records (equipment_id, record_type, record_date, performed_by, lab_or_entity, result, measured_value, expected_value, deviation_pct, uncertainty_pct, calibration_factor, correction_factor, certificate_number, valid_until, next_due_date, comments)
        VALUES (${equipment_id}, ${record_type || "daily_qc"}, ${record_date || new Date().toISOString().split("T")[0]}, ${performed_by || null}, ${lab_or_entity || null}, ${result || "pass"}, ${measured_value || null}, ${expected_value || null}, ${deviation_pct || null}, ${uncertainty_pct || null}, ${calibration_factor || null}, ${correction_factor || null}, ${certificate_number || null}, ${valid_until || null}, ${next_due_date || null}, ${comments || null})
        RETURNING *
      `;
      // Update equipment dates
      if (record_type === "calibration" && next_due_date) {
        await sql`UPDATE calibration_equipment SET last_calibration_date = ${record_date}, next_calibration_date = ${next_due_date}, status = 'active' WHERE id = ${equipment_id}`;
      } else if ((record_type === "daily_qc" || record_type === "constancy" || record_type === "weekly_qc") && record_date) {
        const eq = await sql`SELECT qc_interval_days FROM calibration_equipment WHERE id = ${equipment_id}`;
        if (eq.length) {
          const nextQC = new Date(record_date);
          nextQC.setDate(nextQC.getDate() + (eq[0].qc_interval_days || 1));
          await sql`UPDATE calibration_equipment SET last_qc_date = ${record_date}, next_qc_date = ${nextQC.toISOString().split("T")[0]} WHERE id = ${equipment_id}`;
        }
      }
      return NextResponse.json(inserted[0]);
    }

    // Create new equipment
    const { name, model, manufacturer, serial_number, equipment_type, service, location, calibration_interval_days, qc_interval_days, cchen_registration, authorized_user, notes } = body;
    const countRes = await sql`SELECT COUNT(*) FROM calibration_equipment`;
    const n = parseInt(countRes[0].count) + 1;
    const code = `EC-${String(n).padStart(3, "0")}`;
    const inserted = await sql`
      INSERT INTO calibration_equipment (equipment_code, name, model, manufacturer, serial_number, equipment_type, service, location, calibration_interval_days, qc_interval_days, cchen_registration, authorized_user, notes)
      VALUES (${code}, ${name}, ${model || null}, ${manufacturer || null}, ${serial_number || null}, ${equipment_type || "detector"}, ${service || null}, ${location || null}, ${calibration_interval_days || 365}, ${qc_interval_days || 1}, ${cchen_registration || null}, ${authorized_user || null}, ${notes || null})
      RETURNING *
    `;
    return NextResponse.json(inserted[0]);
  }, NextResponse.json({ error: "Error" }, { status: 500 }));
}

export async function PATCH(req: NextRequest) {
  return safeQuery(async () => {
    await initTables();
    const body = await req.json();
    const { id, ...fields } = body;
    const allowed = ["name","model","manufacturer","serial_number","equipment_type","service","location","status","calibration_interval_days","qc_interval_days","cchen_registration","authorized_user","notes","last_calibration_date","next_calibration_date","last_qc_date","next_qc_date"];
    const entries = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (!entries.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
    const sets = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
    const vals = entries.map(([, v]) => v);
    const rows = await sql.unsafe(`UPDATE calibration_equipment SET ${sets} WHERE id = $1 RETURNING *`, [id, ...vals]);
    return NextResponse.json(rows[0]);
  }, NextResponse.json({ error: "Error" }, { status: 500 }));
}

export async function DELETE(req: NextRequest) {
  return safeQuery(async () => {
    await initTables();
    const { id } = await req.json();
    await sql`UPDATE calibration_equipment SET deleted_at = NOW() WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  }, NextResponse.json({ error: "Error" }, { status: 500 }));
}
