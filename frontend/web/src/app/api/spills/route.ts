import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985 Art. 42: todo derrame de material radiactivo debe registrarse,
// investigarse y comunicarse según su magnitud. Este módulo gestiona el
// historial de derrames, respuesta y lecciones aprendidas.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS spill_events (
      id              SERIAL PRIMARY KEY,
      event_date      DATE        NOT NULL,
      event_time      TIME,
      location        TEXT        NOT NULL,
      service_area    TEXT,
      radionuclide    TEXT,
      activity_mbq    NUMERIC(12,3),
      volume_ml       NUMERIC(10,2),
      description     TEXT,
      severity        TEXT        NOT NULL DEFAULT 'minor',
      detected_by     TEXT,
      immediate_actions TEXT,
      decontamination_steps TEXT,
      clearance_survey TEXT,
      clearance_date  DATE,
      persons_exposed TEXT,
      dose_estimate_msv NUMERIC(10,4),
      reported_to     TEXT,
      report_date     DATE,
      investigation_findings TEXT,
      corrective_actions TEXT,
      status          TEXT        NOT NULL DEFAULT 'open',
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM spill_events LIMIT 1`;
  if (rows.length === 0) {
    const y = new Date().getFullYear();
    await sql`
      INSERT INTO spill_events
        (event_date, location, service_area, radionuclide, activity_mbq, volume_ml,
         description, severity, detected_by, immediate_actions, decontamination_steps,
         clearance_date, status)
      VALUES
        (${`${y}-02-14`}, 'Sala de Captación PET — Mesa técnico', 'Medicina Nuclear',
         'F-18 FDG', 3.700, 0.05,
         'Derrame de trazador FDG durante preparación de dosis. Goteo menor al retirar jeringa de blindaje.',
         'minor', 'Técnico en turno',
         'Uso de EPP completo, señalización del área, aviso al Encargado PR.',
         'Absorción con papel absorbente, descontaminación con agua y jabón, monitoreo con contador GM.',
         ${`${y}-02-14`}, 'closed'),
        (${`${y}-07-03`}, 'Sala de Dosis I-131 — Área preparación', 'Medicina Nuclear',
         'I-131', 185.0, 0.20,
         'Fractura de vial durante manipulación de dosis terapéutica de I-131. Derrame limitado a campana extractora.',
         'moderate', 'Radiofarmacéutico',
         'Activar alarma, evacuar sala, notificación inmediata a Encargado PR, cierre de campana.',
         'Absorción con material absorbente especial, neutralización con tiosulfato de sodio, monitoreo extenso.',
         ${`${y}-07-04`}, 'closed')
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const year     = searchParams.get("year");
  const severity = searchParams.get("severity");
  const status   = searchParams.get("status");

  try {
    let rows;
    if (year && severity && status) {
      ({ rows } = await sql`SELECT * FROM spill_events WHERE EXTRACT(YEAR FROM event_date)=${parseInt(year)} AND severity=${severity} AND status=${status} ORDER BY event_date DESC`);
    } else if (year && severity) {
      ({ rows } = await sql`SELECT * FROM spill_events WHERE EXTRACT(YEAR FROM event_date)=${parseInt(year)} AND severity=${severity} ORDER BY event_date DESC`);
    } else if (year && status) {
      ({ rows } = await sql`SELECT * FROM spill_events WHERE EXTRACT(YEAR FROM event_date)=${parseInt(year)} AND status=${status} ORDER BY event_date DESC`);
    } else if (year) {
      ({ rows } = await sql`SELECT * FROM spill_events WHERE EXTRACT(YEAR FROM event_date)=${parseInt(year)} ORDER BY event_date DESC`);
    } else {
      ({ rows } = await sql`SELECT * FROM spill_events ORDER BY event_date DESC LIMIT 100`);
    }

    const { rows: stats } = await sql`
      SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE severity = 'minor')                     AS minor,
        COUNT(*) FILTER (WHERE severity = 'moderate')                  AS moderate,
        COUNT(*) FILTER (WHERE severity = 'major')                     AS major,
        COUNT(*) FILTER (WHERE status = 'open')                        AS open_count,
        COUNT(*) FILTER (WHERE status = 'closed')                      AS closed_count,
        COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM event_date) = EXTRACT(YEAR FROM now())) AS this_year,
        MAX(event_date)                                                 AS last_event
      FROM spill_events
    `;

    const { rows: years } = await sql`SELECT DISTINCT EXTRACT(YEAR FROM event_date)::int AS y FROM spill_events ORDER BY y DESC`;

    return NextResponse.json({ events: rows, stats: stats[0], years: years.map(r => r.y) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.event_date || !body.location) {
      return NextResponse.json({ error: "event_date y location son obligatorios" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO spill_events
        (event_date, event_time, location, service_area, radionuclide, activity_mbq, volume_ml,
         description, severity, detected_by, immediate_actions, decontamination_steps,
         clearance_survey, clearance_date, persons_exposed, dose_estimate_msv,
         reported_to, report_date, investigation_findings, corrective_actions, status, notes)
      VALUES
        (${body.event_date}, ${body.event_time ?? null}, ${body.location},
         ${body.service_area ?? null}, ${body.radionuclide ?? null},
         ${body.activity_mbq ?? null}, ${body.volume_ml ?? null},
         ${body.description ?? null}, ${body.severity ?? "minor"},
         ${body.detected_by ?? null}, ${body.immediate_actions ?? null},
         ${body.decontamination_steps ?? null}, ${body.clearance_survey ?? null},
         ${body.clearance_date ?? null}, ${body.persons_exposed ?? null},
         ${body.dose_estimate_msv ?? null}, ${body.reported_to ?? null},
         ${body.report_date ?? null}, ${body.investigation_findings ?? null},
         ${body.corrective_actions ?? null}, ${body.status ?? "open"}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ event: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const editable = ["event_date","event_time","location","service_area","radionuclide",
      "activity_mbq","volume_ml","description","severity","detected_by","immediate_actions",
      "decontamination_steps","clearance_survey","clearance_date","persons_exposed",
      "dose_estimate_msv","reported_to","report_date","investigation_findings",
      "corrective_actions","status","notes"];
    const fields = Object.keys(body).filter(k => editable.includes(k));
    if (!fields.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });
    const sets = fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ");
    const vals = [id, ...fields.map(f => (body as Record<string, unknown>)[f])];
    const { rows } = await sql.unsafe(
      `UPDATE spill_events SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`, vals
    );
    return NextResponse.json({ event: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`DELETE FROM spill_events WHERE id=${parseInt(id)} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
