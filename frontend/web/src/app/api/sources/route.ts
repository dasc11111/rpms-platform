import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS radioactive_sources (
      id SERIAL PRIMARY KEY,
      cchen_registration VARCHAR(50) UNIQUE NOT NULL,
      source_name VARCHAR(200) NOT NULL,
      radionuclide VARCHAR(50) NOT NULL,
      half_life_days NUMERIC(12,4) NOT NULL,
      category VARCHAR(20) NOT NULL DEFAULT '4',
      source_type VARCHAR(50) NOT NULL,
      manufacturer VARCHAR(150),
      serial_number VARCHAR(100),
      model VARCHAR(100),
      initial_activity_gbq NUMERIC(14,4) NOT NULL,
      reference_date DATE NOT NULL,
      calibration_date DATE,
      acquisition_date DATE,
      location VARCHAR(200),
      use_description TEXT,
      authorized_use VARCHAR(200),
      cchen_auth_number VARCHAR(100),
      cchen_auth_expiry DATE,
      last_cchen_report DATE,
      next_cchen_report DATE,
      leak_test_date DATE,
      leak_test_result VARCHAR(20) DEFAULT 'pass',
      next_leak_test DATE,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS source_events (
      id SERIAL PRIMARY KEY,
      source_id INT NOT NULL REFERENCES radioactive_sources(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      event_date DATE NOT NULL,
      performed_by VARCHAR(150),
      entity VARCHAR(150),
      result VARCHAR(50),
      activity_measured_gbq NUMERIC(14,4),
      notes TEXT,
      document_ref VARCHAR(200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM radioactive_sources`;
  if (parseInt((count as any)[0].count) === 0) {
    // Seed: typical nuclear medicine sources
    const now = new Date();
    const ref1 = new Date(now);
    ref1.setDate(ref1.getDate() - 365);
    const ref2 = new Date(now);
    ref2.setDate(ref2.getDate() - 180);
    const ref3 = new Date(now);
    ref3.setDate(ref3.getDate() - 730);
    const ref4 = new Date(now);
    ref4.setDate(ref4.getDate() - 90);

    const toDate = (d: Date) => d.toISOString().split("T")[0];

    // Source 1: Ga-67 generator (not real, illustrative)
    await sql`
      INSERT INTO radioactive_sources (
        cchen_registration, source_name, radionuclide, half_life_days,
        category, source_type, manufacturer, serial_number, model,
        initial_activity_gbq, reference_date, calibration_date, acquisition_date,
        location, use_description, authorized_use,
        cchen_auth_number, cchen_auth_expiry, last_cchen_report, next_cchen_report,
        leak_test_date, leak_test_result, next_leak_test, status
      ) VALUES (
        'CCHEN-MN-2021-0042', 'Fuente de Calibración Cs-137 #1', 'Cs-137', 10956.5,
        '3', 'sealed', 'Eckert & Ziegler', 'SN-CS137-00412', 'Model GA-5',
        0.37, ${toDate(ref3)}, ${toDate(ref3)}, ${toDate(ref3)},
        'Sala de Física Médica', 'Calibración de detectores y equipos de medición de radiación',
        'Uso en calibración de instrumentos dosimétricos',
        'AUTH-CCHEN-2022-0113', ${toDate(new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()))},
        ${toDate(ref1)}, ${toDate(new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()))},
        ${toDate(ref2)}, 'pass', ${toDate(new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()))},
        'active'
      )
    `;

    // Source 2: Co-57 point source
    const ref5 = new Date(now);
    ref5.setDate(ref5.getDate() - 400);
    await sql`
      INSERT INTO radioactive_sources (
        cchen_registration, source_name, radionuclide, half_life_days,
        category, source_type, manufacturer, serial_number, model,
        initial_activity_gbq, reference_date, calibration_date, acquisition_date,
        location, use_description, authorized_use,
        cchen_auth_number, cchen_auth_expiry, last_cchen_report, next_cchen_report,
        leak_test_date, leak_test_result, next_leak_test, status
      ) VALUES (
        'CCHEN-MN-2022-0018', 'Fuente Puntual Co-57 Gamma Camera', 'Co-57', 271.74,
        '4', 'sealed', 'Biodex Medical Systems', 'SN-CO57-2022A', 'Multi-Purpose Flood Phantom',
        0.00037, ${toDate(ref5)}, ${toDate(ref5)}, ${toDate(ref5)},
        'Gamma Cámara - Sala 1', 'Control de calidad y sintonización de gammacámara GE Discovery',
        'Control de calidad equipos de medicina nuclear',
        'AUTH-CCHEN-2022-0087', ${toDate(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()))},
        ${toDate(ref2)}, ${toDate(new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()))},
        ${toDate(ref2)}, 'pass', ${toDate(new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()))},
        'active'
      )
    `;

    // Source 3: Ge-68/Ga-68 PET phantom source
    await sql`
      INSERT INTO radioactive_sources (
        cchen_registration, source_name, radionuclide, half_life_days,
        category, source_type, manufacturer, serial_number, model,
        initial_activity_gbq, reference_date, calibration_date, acquisition_date,
        location, use_description, authorized_use,
        cchen_auth_number, cchen_auth_expiry, last_cchen_report, next_cchen_report,
        leak_test_date, leak_test_result, next_leak_test, status
      ) VALUES (
        'CCHEN-MN-2023-0005', 'Fuente Ge-68/Ga-68 PET Normalization', 'Ge-68', 270.95,
        '4', 'sealed', 'Siemens Healthineers', 'SN-GE68-2023-001', 'PET/CT Normalization Source',
        0.00185, ${toDate(ref1)}, ${toDate(ref1)}, ${toDate(ref1)},
        'PET/CT - Sala Biograph mCT', 'Normalización diaria y control de calidad PET/CT Siemens Biograph',
        'Control de calidad PET/CT medicina nuclear',
        'AUTH-CCHEN-2023-0044', ${toDate(new Date(now.getFullYear() + 3, now.getMonth(), now.getDate()))},
        ${toDate(ref4)}, ${toDate(new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()))},
        ${toDate(ref4)}, 'pass', ${toDate(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()))},
        'active'
      )
    `;

    // Source 4: Sr-90 beta source (ophthalmic/probe check)
    const ref6 = new Date(now);
    ref6.setDate(ref6.getDate() - 1095);
    await sql`
      INSERT INTO radioactive_sources (
        cchen_registration, source_name, radionuclide, half_life_days,
        category, source_type, manufacturer, serial_number,
        initial_activity_gbq, reference_date, calibration_date, acquisition_date,
        location, use_description, authorized_use,
        cchen_auth_number, cchen_auth_expiry, last_cchen_report, next_cchen_report,
        leak_test_date, leak_test_result, next_leak_test, status, notes
      ) VALUES (
        'CCHEN-MN-2019-0091', 'Fuente Beta Sr-90 Verificación Sonda', 'Sr-90', 10519.2,
        '4', 'sealed', 'Capintec', 'SN-SR90-19041',
        0.00037, ${toDate(ref6)}, ${toDate(ref6)}, ${toDate(ref6)},
        'Laboratorio Protección Radiológica', 'Verificación de respuesta de sonda detectora Capintec CRC-55tR',
        'Verificación instrumental dosimétrico',
        'AUTH-CCHEN-2019-0211', ${toDate(new Date(now.getFullYear(), now.getMonth() + 2, now.getDate()))},
        ${toDate(ref2)}, ${toDate(new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()))},
        ${toDate(ref2)}, 'pass', ${toDate(new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()))},
        'active', 'PRÓXIMO VENCIMIENTO AUTORIZACIÓN CCHEN — gestionar renovación'
      )
    `;

    // Source 5: disposed/transferred source
    const ref7 = new Date(now);
    ref7.setDate(ref7.getDate() - 1500);
    await sql`
      INSERT INTO radioactive_sources (
        cchen_registration, source_name, radionuclide, half_life_days,
        category, source_type, manufacturer, serial_number,
        initial_activity_gbq, reference_date, acquisition_date,
        location, use_description, authorized_use,
        cchen_auth_number, last_cchen_report,
        leak_test_date, leak_test_result, status, notes
      ) VALUES (
        'CCHEN-MN-2018-0034', 'Fuente Am-241 Detector Humo (transferida)', 'Am-241', 157788.0,
        '5', 'sealed', 'Varios', 'SN-AM241-2018',
        0.000001, ${toDate(ref7)}, ${toDate(ref7)},
        'N/A - Transferida a CCHEN', 'Detector de humo industrial obsoleto — transferido',
        'N/A',
        'AUTH-CCHEN-2018-0051', ${toDate(ref1)},
        ${toDate(ref1)}, 'pass', 'transferred', 'Transferida a CCHEN para disposición final — Dic 2024'
      )
    `;

    // Seed some events
    await sql`
      INSERT INTO source_events (source_id, event_type, event_date, performed_by, entity, result, notes)
      SELECT id, 'leak_test', CURRENT_DATE - INTERVAL '180 days', 'TM Protección Radiológica', 'Interno',
        'pass', 'Prueba de estanqueidad semestral — sin contaminación detectable'
      FROM radioactive_sources WHERE cchen_registration = 'CCHEN-MN-2021-0042'
    `;
    await sql`
      INSERT INTO source_events (source_id, event_type, event_date, performed_by, entity, result, notes)
      SELECT id, 'cchen_report', CURRENT_DATE - INTERVAL '365 days', 'TM Protección Radiológica', 'CCHEN',
        'accepted', 'Declaración anual inventario fuentes radiactivas — aceptada'
      FROM radioactive_sources WHERE cchen_registration = 'CCHEN-MN-2021-0042'
    `;
    await sql`
      INSERT INTO source_events (source_id, event_type, event_date, performed_by, entity, result, notes)
      SELECT id, 'calibration', CURRENT_DATE - INTERVAL '365 days', 'Físico Médico', 'Laboratorio PTB',
        'pass', 'Calibración trazable BIPM — certificado disponible'
      FROM radioactive_sources WHERE cchen_registration = 'CCHEN-MN-2021-0042'
    `;
  }
}

function computeCurrentActivity(initialGbq: number, referenceDate: Date, halfLifeDays: number): number {
  const elapsedDays = (Date.now() - referenceDate.getTime()) / (1000 * 3600 * 24);
  return initialGbq * Math.pow(0.5, elapsedDays / halfLifeDays);
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const radionuclide = searchParams.get("radionuclide");

    if (id) {
      const rows = await sql`SELECT * FROM radioactive_sources WHERE id = ${id}`;
      if (!rows || (rows as any[]).length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const events = await sql`SELECT * FROM source_events WHERE source_id = ${id} ORDER BY event_date DESC`;
      const src = (rows as any[])[0];
      const currentActivity = computeCurrentActivity(
        parseFloat(src.initial_activity_gbq),
        new Date(src.reference_date),
        parseFloat(src.half_life_days)
      );
      return NextResponse.json({ source: { ...src, current_activity_gbq: currentActivity }, events });
    }

    let baseQuery = `
      SELECT s.*
      FROM radioactive_sources s
      WHERE s.active = TRUE
    `;
    const params: any[] = [];
    let p = 1;

    if (status) { baseQuery += ` AND s.status = $${p++}`; params.push(status); }
    if (category) { baseQuery += ` AND s.category = $${p++}`; params.push(category); }
    if (radionuclide) { baseQuery += ` AND s.radionuclide ILIKE $${p++}`; params.push(`%${radionuclide}%`); }
    baseQuery += ` ORDER BY s.cchen_registration`;

    const sources = await sql.unsafe(baseQuery, params);

    // Enrich with computed activity
    const enriched = (sources as any[]).map((s) => {
      const current = computeCurrentActivity(
        parseFloat(s.initial_activity_gbq),
        new Date(s.reference_date),
        parseFloat(s.half_life_days)
      );
      const halfLivesElapsed = (Date.now() - new Date(s.reference_date).getTime()) / (1000 * 3600 * 24) / parseFloat(s.half_life_days);
      return { ...s, current_activity_gbq: current, half_lives_elapsed: halfLivesElapsed };
    });

    // Stats
    let stats: any = {};
    try {
      const st = await sql`
        SELECT
          COUNT(*) FILTER (WHERE active AND status = 'active') AS total_active,
          COUNT(*) FILTER (WHERE active AND status = 'stored') AS total_stored,
          COUNT(*) FILTER (WHERE active AND status = 'transferred') AS total_transferred,
          COUNT(*) FILTER (WHERE active AND status = 'disposed') AS total_disposed,
          COUNT(*) FILTER (WHERE active AND cchen_auth_expiry IS NOT NULL AND cchen_auth_expiry <= CURRENT_DATE + INTERVAL '90 days' AND cchen_auth_expiry >= CURRENT_DATE AND status NOT IN ('transferred','disposed')) AS auth_expiring_90d,
          COUNT(*) FILTER (WHERE active AND cchen_auth_expiry IS NOT NULL AND cchen_auth_expiry < CURRENT_DATE AND status NOT IN ('transferred','disposed')) AS auth_expired,
          COUNT(*) FILTER (WHERE active AND next_cchen_report IS NOT NULL AND next_cchen_report <= CURRENT_DATE + INTERVAL '30 days' AND status NOT IN ('transferred','disposed')) AS report_due_30d,
          COUNT(*) FILTER (WHERE active AND next_leak_test IS NOT NULL AND next_leak_test <= CURRENT_DATE AND status NOT IN ('transferred','disposed')) AS leak_test_overdue,
          COUNT(*) FILTER (WHERE active AND leak_test_result = 'fail' AND status NOT IN ('transferred','disposed')) AS leak_test_failed
        FROM radioactive_sources
      `;
      stats = (st as any[])[0];
    } catch {}

    return NextResponse.json({ sources: enriched, stats });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();

    // Add event to existing source
    if (body._type === "event") {
      const {
        source_id, event_type, event_date, performed_by, entity,
        result, activity_measured_gbq, notes, document_ref
      } = body;
      const ev = await sql`
        INSERT INTO source_events (source_id, event_type, event_date, performed_by, entity, result, activity_measured_gbq, notes, document_ref)
        VALUES (${source_id}, ${event_type}, ${event_date}, ${performed_by || null}, ${entity || null},
                ${result || null}, ${activity_measured_gbq || null}, ${notes || null}, ${document_ref || null})
        RETURNING *
      `;
      // Update source dates based on event type
      if (event_type === "leak_test" && event_date) {
        const nextDate = new Date(event_date);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        await sql`
          UPDATE radioactive_sources SET leak_test_date=${event_date}, leak_test_result=${result || 'pass'},
          next_leak_test=${nextDate.toISOString().split("T")[0]}, updated_at=NOW()
          WHERE id=${source_id}
        `;
      } else if (event_type === "cchen_report" && event_date) {
        const nextDate = new Date(event_date);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        await sql`
          UPDATE radioactive_sources SET last_cchen_report=${event_date},
          next_cchen_report=${nextDate.toISOString().split("T")[0]}, updated_at=NOW()
          WHERE id=${source_id}
        `;
      } else if (event_type === "calibration" && event_date) {
        await sql`
          UPDATE radioactive_sources SET calibration_date=${event_date}, updated_at=NOW()
          WHERE id=${source_id}
        `;
      }
      return NextResponse.json((ev as any[])[0]);
    }

    const {
      cchen_registration, source_name, radionuclide, half_life_days, category, source_type,
      manufacturer, serial_number, model, initial_activity_gbq, reference_date, calibration_date,
      acquisition_date, location, use_description, authorized_use, cchen_auth_number,
      cchen_auth_expiry, last_cchen_report, next_cchen_report, leak_test_date, leak_test_result,
      next_leak_test, status, notes
    } = body;

    const row = await sql`
      INSERT INTO radioactive_sources (
        cchen_registration, source_name, radionuclide, half_life_days, category, source_type,
        manufacturer, serial_number, model, initial_activity_gbq, reference_date, calibration_date,
        acquisition_date, location, use_description, authorized_use, cchen_auth_number,
        cchen_auth_expiry, last_cchen_report, next_cchen_report, leak_test_date, leak_test_result,
        next_leak_test, status, notes
      ) VALUES (
        ${cchen_registration}, ${source_name}, ${radionuclide}, ${half_life_days}, ${category || '4'}, ${source_type},
        ${manufacturer || null}, ${serial_number || null}, ${model || null}, ${initial_activity_gbq}, ${reference_date},
        ${calibration_date || null}, ${acquisition_date || null}, ${location || null}, ${use_description || null},
        ${authorized_use || null}, ${cchen_auth_number || null}, ${cchen_auth_expiry || null},
        ${last_cchen_report || null}, ${next_cchen_report || null}, ${leak_test_date || null},
        ${leak_test_result || 'pass'}, ${next_leak_test || null}, ${status || 'active'}, ${notes || null}
      )
      RETURNING *
    `;
    return NextResponse.json((row as any[])[0], { status: 201 });
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
      "cchen_registration","source_name","radionuclide","half_life_days","category","source_type",
      "manufacturer","serial_number","model","initial_activity_gbq","reference_date","calibration_date",
      "acquisition_date","location","use_description","authorized_use","cchen_auth_number",
      "cchen_auth_expiry","last_cchen_report","next_cchen_report","leak_test_date","leak_test_result",
      "next_leak_test","status","notes"
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
      `UPDATE radioactive_sources SET ${sets.join(",")} WHERE id=$${p} RETURNING *`,
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
    await sql`UPDATE radioactive_sources SET active=FALSE, updated_at=NOW() WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
