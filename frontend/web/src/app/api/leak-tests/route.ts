import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985 Art. 36: las fuentes radiactivas selladas deben someterse a pruebas
// de estanqueidad (leak test) a intervalos regulares según su actividad y tipo.
// IAEA Safety Guide RS-G-1.5: periodicidad máxima 6 meses para fuentes selladas
// en uso. NS-06.0 §5.3.3: registro obligatorio de resultados.

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("leak-tests safeQuery error:", e);
    return fallback;
  }
}

async function initTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS leak_test_records (
      id                  SERIAL PRIMARY KEY,
      source_id           INTEGER,
      source_code         TEXT NOT NULL,
      radionuclide        TEXT NOT NULL,
      source_description  TEXT,
      equipment_name      TEXT,
      service_area        TEXT,
      test_date           DATE NOT NULL,
      next_test_date      DATE,
      test_method         TEXT DEFAULT 'wipe_test',
      wipe_location       TEXT,
      activity_bq         NUMERIC(14, 2),
      activity_limit_bq   NUMERIC(14, 2) DEFAULT 185,
      result              TEXT NOT NULL DEFAULT 'pass'
        CHECK (result IN ('pass', 'fail', 'inconclusive')),
      performed_by        TEXT,
      lab_name            TEXT,
      lab_certificate_no  TEXT,
      detector_used       TEXT,
      background_cps      NUMERIC(10, 3),
      wipe_cps            NUMERIC(10, 3),
      notes               TEXT,
      corrective_action   TEXT,
      source_removed      BOOLEAN DEFAULT FALSE,
      cchen_notified      BOOLEAN DEFAULT FALSE,
      cchen_notification_date DATE,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Seed with example records if empty
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM leak_test_records`;
  if ((rows[0] as { n: number }).n === 0) {
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const overdue = new Date(today);
    overdue.setDate(overdue.getDate() - 15);
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    await sql`
      INSERT INTO leak_test_records
        (source_code, radionuclide, source_description, equipment_name, service_area,
         test_date, next_test_date, test_method, wipe_location, activity_bq, activity_limit_bq,
         result, performed_by, lab_name, lab_certificate_no, detector_used,
         background_cps, wipe_cps, notes)
      VALUES
        ('SN-001', 'Co-57', 'Fuente de Co-57 para calibración gammacámara',
         'Gamma Camera Siemens Symbia', 'Medicina Nuclear',
         ${fmtDate(sixMonthsAgo)}, ${fmtDate(nextMonth)}, 'wipe_test', 'Superficie colimador',
         370000, 185, 'pass', 'Dr. Carlos Pérez', 'Lab. Metrología CCHEN',
         'CCHEN-2024-LT-001', 'Contador Geiger Mueller', 2.1, 2.3,
         'Sin contaminación detectable. Fuente en buen estado.'),
        ('SN-002', 'Cs-137', 'Fuente de Cs-137 para control calidad',
         'Detector NaI(Tl) portátil', 'Protección Radiológica',
         ${fmtDate(twoMonthsAgo)}, ${fmtDate(nextMonth)}, 'wipe_test', 'Contenedor externo',
         37000, 185, 'pass', 'TM Diego Solís', 'Lab. Metrología CCHEN',
         'CCHEN-2024-LT-002', 'Detector GM modelo 44-9', 1.8, 2.0,
         'Resultado conforme. Sin indicios de pérdida de sellado.'),
        ('SN-003', 'Am-241', 'Fuente Am-241 en detector humo (referencia)',
         'Detector de humo radiactivo', 'Área Técnica',
         ${fmtDate(overdue)}, ${fmtDate(overdue)}, 'wipe_test', 'Cámara detectora',
         0.9e6, 185, 'fail', 'TM Diego Solís', NULL, NULL, 'Detector GM modelo 44-9',
         1.9, 48.5, 'FALLO: actividad en paño de limpieza supera límite 185 Bq.'),
        ('SN-004', 'Ir-192', 'Fuente Ir-192 para braquiterapia HDR',
         'Microselect HDR Nucletron', 'Radioterapia',
         ${fmtDate(twoMonthsAgo)}, ${fmtDate(nextMonth)}, 'wipe_test', 'Cabezal fuente + transfer tube',
         370e9, 185, 'pass', 'Físico Med. R. Morales', 'Lab. Metrología LNMRI',
         'LNMRI-2024-187', 'Contador proporcional de flujo', 3.2, 3.5,
         'Fuente sellada íntegra. Certificado adjunto al equipo.'),
        ('SN-005', 'Ge-68', 'Fuente Ge-68/Ga-68 para normalización PET/CT',
         'PET/CT GE Discovery MI', 'Medicina Nuclear',
         ${fmtDate(sixMonthsAgo)}, ${fmtDate(overdue)}, 'wipe_test', 'Phantom cilíndrico',
         181500, 185, 'pass', 'Dr. Carlos Pérez', 'Lab. Metrología CCHEN',
         'CCHEN-2024-LT-005', 'Contador Geiger Mueller', 1.7, 1.9,
         'Próxima prueba VENCIDA. Programar con urgencia.')
    `;
  }
}

export async function GET(req: NextRequest) {
  return safeQuery(async () => {
    await initTables();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const result = searchParams.get("result") || "";
    const service = searchParams.get("service") || "";
    const overdue = searchParams.get("overdue") === "1";

    const { rows } = await sql`
      SELECT *,
        CASE
          WHEN next_test_date < CURRENT_DATE THEN 'overdue'
          WHEN next_test_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
          ELSE 'ok'
        END AS schedule_status,
        (CURRENT_DATE - next_test_date) AS days_overdue,
        (next_test_date - CURRENT_DATE) AS days_to_next
      FROM leak_test_records
      WHERE
        (${q} = '' OR source_code ILIKE ${'%' + q + '%'}
                   OR radionuclide ILIKE ${'%' + q + '%'}
                   OR source_description ILIKE ${'%' + q + '%'}
                   OR equipment_name ILIKE ${'%' + q + '%'})
        AND (${result} = '' OR result = ${result})
        AND (${service} = '' OR service_area ILIKE ${'%' + service + '%'})
        AND (NOT ${overdue} OR next_test_date < CURRENT_DATE)
      ORDER BY
        CASE WHEN next_test_date < CURRENT_DATE THEN 0 ELSE 1 END,
        next_test_date ASC
    `;

    const { rows: stats } = await sql`
      SELECT
        COUNT(*)::int                                                     AS total,
        COUNT(*) FILTER (WHERE result = 'fail')::int                     AS failed,
        COUNT(*) FILTER (WHERE next_test_date < CURRENT_DATE)::int       AS overdue,
        COUNT(*) FILTER (WHERE next_test_date BETWEEN CURRENT_DATE
                         AND CURRENT_DATE + INTERVAL '30 days')::int     AS due_soon,
        COUNT(*) FILTER (WHERE result = 'pass'
                         AND next_test_date >= CURRENT_DATE)::int        AS compliant
      FROM leak_test_records
    `;

    return NextResponse.json({ records: rows, stats: stats[0] });
  }, NextResponse.json({ records: [], stats: {} }, { status: 500 }));
}

export async function POST(req: NextRequest) {
  return safeQuery(async () => {
    await initTables();
    const body = await req.json();

    if (body._type === "bulk_update_dates") {
      // Recalculate next_test_date for all records (6 months from last test)
      await sql`
        UPDATE leak_test_records
        SET next_test_date = test_date + INTERVAL '6 months',
            updated_at = NOW()
        WHERE next_test_date IS NULL
      `;
      return NextResponse.json({ ok: true });
    }

    const {
      source_code, radionuclide, source_description, equipment_name, service_area,
      test_date, next_test_date, test_method, wipe_location,
      activity_bq, activity_limit_bq, result, performed_by,
      lab_name, lab_certificate_no, detector_used,
      background_cps, wipe_cps, notes, corrective_action,
      source_removed, cchen_notified, cchen_notification_date,
    } = body;

    if (!source_code || !radionuclide || !test_date || !result) {
      return NextResponse.json({ error: "source_code, radionuclide, test_date y result son requeridos" }, { status: 400 });
    }

    // Auto-calculate next_test_date if not provided (6 months)
    const computedNext = next_test_date || (() => {
      const d = new Date(test_date);
      d.setMonth(d.getMonth() + 6);
      return d.toISOString().slice(0, 10);
    })();

    const { rows } = await sql`
      INSERT INTO leak_test_records
        (source_code, radionuclide, source_description, equipment_name, service_area,
         test_date, next_test_date, test_method, wipe_location,
         activity_bq, activity_limit_bq, result, performed_by,
         lab_name, lab_certificate_no, detector_used,
         background_cps, wipe_cps, notes, corrective_action,
         source_removed, cchen_notified, cchen_notification_date)
      VALUES
        (${source_code}, ${radionuclide}, ${source_description || null}, ${equipment_name || null},
         ${service_area || null}, ${test_date}, ${computedNext}, ${test_method || 'wipe_test'},
         ${wipe_location || null}, ${activity_bq || null}, ${activity_limit_bq || 185},
         ${result}, ${performed_by || null}, ${lab_name || null}, ${lab_certificate_no || null},
         ${detector_used || null}, ${background_cps || null}, ${wipe_cps || null},
         ${notes || null}, ${corrective_action || null},
         ${source_removed || false}, ${cchen_notified || false}, ${cchen_notification_date || null})
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  }, NextResponse.json({ error: "Error interno" }, { status: 500 }));
}

export async function PATCH(req: NextRequest) {
  return safeQuery(async () => {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const setClauses = Object.keys(fields)
      .filter(k => fields[k] !== undefined)
      .map((k, i) => `"${k}" = $${i + 2}`)
      .join(", ");

    if (!setClauses) return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });

    const values = [id, ...Object.values(fields).filter(v => v !== undefined)];
    const { rows } = await sql.unsafe(
      `UPDATE leak_test_records SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );

    if (!rows.length) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    return NextResponse.json(rows[0]);
  }, NextResponse.json({ error: "Error interno" }, { status: 500 }));
}

export async function DELETE(req: NextRequest) {
  return safeQuery(async () => {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await sql`DELETE FROM leak_test_records WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  }, NextResponse.json({ error: "Error interno" }, { status: 500 }));
}
