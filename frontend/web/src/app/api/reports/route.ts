import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS regulatory_reports (
      id SERIAL PRIMARY KEY,
      report_type VARCHAR(50) NOT NULL,
      title VARCHAR(300) NOT NULL,
      year INT NOT NULL,
      period_start DATE,
      period_end DATE,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      submitted_date DATE,
      cchen_reception_number VARCHAR(100),
      cchen_resolution VARCHAR(100),
      preparer VARCHAR(150),
      reviewer VARCHAR(150),
      approver VARCHAR(150),
      submission_method VARCHAR(50),
      notes TEXT,
      sections JSONB NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS report_attachments (
      id SERIAL PRIMARY KEY,
      report_id INT NOT NULL REFERENCES regulatory_reports(id) ON DELETE CASCADE,
      filename VARCHAR(300) NOT NULL,
      description VARCHAR(300),
      attachment_type VARCHAR(50),
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const count = await sql`SELECT COUNT(*) FROM regulatory_reports`;
  if (parseInt((count as any)[0].count) === 0) {
    const thisYear = new Date().getFullYear();
    const prevYear = thisYear - 1;

    // Seed: informe anual año anterior (enviado), año en curso (borrador)
    await sql`
      INSERT INTO regulatory_reports (
        report_type, title, year, period_start, period_end, status,
        submitted_date, cchen_reception_number, cchen_resolution,
        preparer, reviewer, approver, submission_method,
        sections, notes
      ) VALUES (
        'informe_anual',
        ${`Informe Anual de Protección Radiológica ${prevYear} — Hospital Hernán Henríquez Aravena`},
        ${prevYear},
        ${`${prevYear}-01-01`}, ${`${prevYear}-12-31`},
        'submitted',
        ${`${thisYear}-03-15`},
        ${`CCHEN-REC-${thisYear}-00412`},
        ${`RES-CCHEN-${thisYear}-0089`},
        'TM Protección Radiológica',
        'Físico Médico Jefe',
        'Director Hospital',
        'sistema_cchen',
        ${{
          identificacion: { completo: true, establecimiento: "Hospital Dr. Hernán Henríquez Aravena", direccion: "Manuel Montt 115, Temuco", cchen_licencia: "LIC-MN-2019-0042" },
          personal_ocupacionalmente_expuesto: { completo: true, total_poe: 12, hombres: 8, mujeres: 4, categorias: { "A": 10, "B": 2 } },
          dosimetria: { completo: true, dosis_colectiva_msv: 8.4, dosis_max_individual_msv: 4.2, excedentes_dosis: 0 },
          fuentes_radiactivas: { completo: true, total_fuentes: 5, fuentes_selladas: 4, fuentes_no_selladas: 1 },
          residuos_radiactivos: { completo: true, total_contenedores: 24, volumen_total_l: 48.5, liberados_decaimiento: 18 },
          incidentes: { completo: true, total_incidentes: 0, incidentes_relevantes: 0 },
          capacitacion: { completo: true, sesiones: 5, horas_totales: 32, personal_capacitado: 12 },
          declaracion_jurada: { completo: true, firmada: true }
        }},
        'Informe anual enviado vía sistema CCHEN. Acuse de recibo N° REC-2025-00412.'
      )
    `;

    await sql`
      INSERT INTO regulatory_reports (
        report_type, title, year, period_start, period_end, status,
        preparer, sections, notes
      ) VALUES (
        'informe_anual',
        ${`Informe Anual de Protección Radiológica ${thisYear} — Hospital Hernán Henríquez Aravena`},
        ${thisYear},
        ${`${thisYear}-01-01`}, ${`${thisYear}-12-31`},
        'in_progress',
        'TM Protección Radiológica',
        ${{
          identificacion: { completo: true, establecimiento: "Hospital Dr. Hernán Henríquez Aravena", direccion: "Manuel Montt 115, Temuco", cchen_licencia: "LIC-MN-2019-0042" },
          personal_ocupacionalmente_expuesto: { completo: false, total_poe: 0 },
          dosimetria: { completo: false },
          fuentes_radiactivas: { completo: false },
          residuos_radiactivos: { completo: false },
          incidentes: { completo: false },
          capacitacion: { completo: false },
          declaracion_jurada: { completo: false }
        }},
        `Informe en preparación. Plazo presentación CCHEN: 31 de marzo ${thisYear + 1}.`
      )
    `;

    await sql`
      INSERT INTO regulatory_reports (
        report_type, title, year, period_start, period_end, status,
        submitted_date, cchen_reception_number,
        preparer, reviewer, approver, submission_method, sections
      ) VALUES (
        'declaracion_inventario',
        'Declaración Inventario Fuentes Radiactivas — Semestre I 2025',
        2025,
        '2025-01-01', '2025-06-30',
        'submitted',
        '2025-07-10',
        'CCHEN-INV-2025-S1-00089',
        'TM Protección Radiológica',
        'Físico Médico Jefe',
        'Director Hospital',
        'correo_certificado',
        ${{ inventario: { completo: true, fuentes: 4 } }}
      )
    `;

    await sql`
      INSERT INTO regulatory_reports (
        report_type, title, year, period_start, period_end, status,
        preparer, sections, notes
      ) VALUES (
        'notificacion_incidente',
        'Notificación Pérdida Transitoria Dosímetro TLD — Nov 2025',
        2025,
        '2025-11-10', '2025-11-10',
        'draft',
        'TM Protección Radiológica',
        ${{ descripcion: { completo: false }, acciones_correctivas: { completo: false } }},
        'Notificación preventiva — dosímetro recuperado. Verificar si requiere reporte formal CCHEN.'
      )
    `;
  }
}

// Aggregate data from other platform tables to auto-fill report sections
async function aggregateReportData(year: number) {
  const data: Record<string, any> = {};

  try {
    const dosis = await sql`
      SELECT COUNT(DISTINCT worker_id) as total_poe,
             SUM(dose_msv) as dosis_colectiva,
             MAX(dose_msv) as dosis_max,
             COUNT(*) FILTER (WHERE dose_msv > 20) as excedentes
      FROM dosimetry_records
      WHERE EXTRACT(YEAR FROM period_start) = ${year} AND active = TRUE
    `;
    data.dosimetria = (dosis as any[])[0];
  } catch {}

  try {
    const fuentes = await sql`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE source_type = 'sealed') as selladas,
             COUNT(*) FILTER (WHERE source_type != 'sealed') as no_selladas
      FROM radioactive_sources
      WHERE active = TRUE AND status NOT IN ('transferred', 'disposed')
    `;
    data.fuentes = (fuentes as any[])[0];
  } catch {}

  try {
    const residuos = await sql`
      SELECT COUNT(*) as total_contenedores,
             SUM(volume_liters) as volumen_total,
             COUNT(*) FILTER (WHERE status = 'disposed') as dispuestos
      FROM radioactive_waste
      WHERE active = TRUE AND EXTRACT(YEAR FROM initial_date) = ${year}
    `;
    data.residuos = (residuos as any[])[0];
  } catch {}

  try {
    const cap = await sql`
      SELECT COUNT(*) as sesiones,
             SUM(duration_hours) as horas,
             SUM(total_attendees) as asistentes
      FROM training_sessions
      WHERE active = TRUE AND EXTRACT(YEAR FROM session_date) = ${year}
    `;
    data.capacitacion = (cap as any[])[0];
  } catch {}

  try {
    const poe = await sql`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE gender = 'M') as hombres,
             COUNT(*) FILTER (WHERE gender = 'F') as mujeres
      FROM workers WHERE active = TRUE AND is_poe = TRUE
    `;
    data.poe = (poe as any[])[0];
  } catch {}

  return data;
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const year = searchParams.get("year");
    const aggregate = searchParams.get("aggregate");

    if (aggregate) {
      const y = parseInt(aggregate);
      const data = await aggregateReportData(y);
      return NextResponse.json({ aggregate: data, year: y });
    }

    if (id) {
      const rows = await sql`SELECT * FROM regulatory_reports WHERE id = ${id}`;
      if (!(rows as any[]).length) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const attachments = await sql`SELECT * FROM report_attachments WHERE report_id = ${id} ORDER BY uploaded_at`;
      return NextResponse.json({ report: (rows as any[])[0], attachments });
    }

    let baseQ = `SELECT * FROM regulatory_reports WHERE active = TRUE`;
    const params: any[] = [];
    let p = 1;
    if (year) { baseQ += ` AND year = $${p++}`; params.push(parseInt(year)); }
    baseQ += ` ORDER BY year DESC, created_at DESC`;
    const reports = await sql.unsafe(baseQ, params);

    // Stats
    let stats: any = {};
    try {
      const st = await sql`
        SELECT
          COUNT(*) FILTER (WHERE active AND status = 'draft') AS draft_count,
          COUNT(*) FILTER (WHERE active AND status = 'in_progress') AS in_progress_count,
          COUNT(*) FILTER (WHERE active AND status = 'review') AS review_count,
          COUNT(*) FILTER (WHERE active AND status = 'submitted') AS submitted_count,
          COUNT(*) FILTER (WHERE active AND status = 'approved') AS approved_count,
          COUNT(*) FILTER (WHERE active AND report_type = 'informe_anual') AS annual_count,
          MAX(year) AS latest_year
        FROM regulatory_reports
      `;
      stats = (st as any[])[0];
    } catch {}

    // Years list
    let years: number[] = [];
    try {
      const yrs = await sql`SELECT DISTINCT year FROM regulatory_reports ORDER BY year DESC`;
      years = (yrs as any[]).map(r => r.year);
    } catch {}

    return NextResponse.json({ reports, stats, years });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();

    if (body._type === "attachment") {
      const { report_id, filename, description, attachment_type } = body;
      const a = await sql`
        INSERT INTO report_attachments (report_id, filename, description, attachment_type)
        VALUES (${report_id}, ${filename}, ${description || null}, ${attachment_type || null})
        RETURNING *
      `;
      return NextResponse.json((a as any[])[0], { status: 201 });
    }

    const {
      report_type, title, year, period_start, period_end,
      preparer, reviewer, approver, notes, sections
    } = body;

    const r = await sql`
      INSERT INTO regulatory_reports (
        report_type, title, year, period_start, period_end,
        preparer, reviewer, approver, notes, sections
      ) VALUES (
        ${report_type}, ${title}, ${year}, ${period_start || null}, ${period_end || null},
        ${preparer || null}, ${reviewer || null}, ${approver || null}, ${notes || null},
        ${JSON.stringify(sections || {})}::jsonb
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
      "report_type", "title", "year", "period_start", "period_end", "status",
      "submitted_date", "cchen_reception_number", "cchen_resolution",
      "preparer", "reviewer", "approver", "submission_method", "notes", "sections"
    ];
    const sets: string[] = [];
    const vals: any[] = [];
    let p = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) {
        if (k === "sections") {
          sets.push(`"${k}"=$${p++}::jsonb`);
          vals.push(JSON.stringify(v));
        } else {
          sets.push(`"${k}"=$${p++}`);
          vals.push(v);
        }
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    sets.push(`updated_at=NOW()`);
    vals.push(id);
    const row = await sql.unsafe(
      `UPDATE regulatory_reports SET ${sets.join(",")} WHERE id=$${p} RETURNING *`,
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
    await sql`UPDATE regulatory_reports SET active=FALSE, updated_at=NOW() WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
