import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS inspections (
      id              SERIAL PRIMARY KEY,
      inspection_type TEXT        NOT NULL DEFAULT 'cchen',
      inspection_date DATE        NOT NULL,
      inspector_name  TEXT,
      inspector_org   TEXT,
      areas_inspected TEXT,
      findings        TEXT,
      observations    TEXT,
      non_conformities TEXT,
      corrective_actions TEXT,
      follow_up_date  DATE,
      follow_up_done  BOOLEAN     DEFAULT false,
      result          TEXT        NOT NULL DEFAULT 'pending',
      report_ref      TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows: existing } = await sql`SELECT id FROM inspections LIMIT 1`;
  if (existing.length === 0) {
    const y = new Date().getFullYear();
    await sql`
      INSERT INTO inspections
        (inspection_type, inspection_date, inspector_name, inspector_org,
         areas_inspected, findings, observations, result, report_ref)
      VALUES
        ('cchen', ${`${y - 1}-08-10`},
         'Fiscalizador CCHEN', 'Comisión Chilena de Energía Nuclear',
         'Área Medicina Nuclear; Área Radiofísica; Almacén de fuentes; Sala PET/CT',
         'Programa de protección radiológica actualizado; Dosimetría en regla; Calibraciones vigentes',
         'Se solicita actualizar señalética sector PET/CT; Verificar vencimiento extintor sala de isótopos',
         'approved', ${`CCHEN-INS-${y - 1}-042`}),
        ('internal', ${`${y}-02-20`},
         'Encargado Protección Radiológica', 'Hospital Hernán Henríquez Aravena',
         'Todos los servicios con radiación ionizante',
         'Detectadas 3 no conformidades menores en registros de dosimetría; Capacitación pendiente 2 TM',
         'Revisar protocolo de entrega de dosímetros; Actualizar listado POE servicio imagenología',
         'conditional', 'AUD-INT-2024-01')
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* table may already exist */ }

  const { searchParams } = new URL(req.url);
  const type   = searchParams.get("type");
  const result = searchParams.get("result");
  const year   = searchParams.get("year");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  try {
    let rows;
    // Simple chained filters
    if (type && result && year) {
      ({ rows } = await sql`
        SELECT * FROM inspections
        WHERE inspection_type = ${type} AND result = ${result}
          AND EXTRACT(YEAR FROM inspection_date) = ${parseInt(year)}
        ORDER BY inspection_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (type && year) {
      ({ rows } = await sql`
        SELECT * FROM inspections
        WHERE inspection_type = ${type}
          AND EXTRACT(YEAR FROM inspection_date) = ${parseInt(year)}
        ORDER BY inspection_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (result && year) {
      ({ rows } = await sql`
        SELECT * FROM inspections
        WHERE result = ${result}
          AND EXTRACT(YEAR FROM inspection_date) = ${parseInt(year)}
        ORDER BY inspection_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (type) {
      ({ rows } = await sql`
        SELECT * FROM inspections WHERE inspection_type = ${type}
        ORDER BY inspection_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (result) {
      ({ rows } = await sql`
        SELECT * FROM inspections WHERE result = ${result}
        ORDER BY inspection_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else if (year) {
      ({ rows } = await sql`
        SELECT * FROM inspections
        WHERE EXTRACT(YEAR FROM inspection_date) = ${parseInt(year)}
        ORDER BY inspection_date DESC LIMIT ${limit} OFFSET ${offset}`);
    } else {
      ({ rows } = await sql`
        SELECT * FROM inspections
        ORDER BY inspection_date DESC LIMIT ${limit} OFFSET ${offset}`);
    }

    const { rows: stats } = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE result = 'approved')    AS approved,
        COUNT(*) FILTER (WHERE result = 'conditional') AS conditional,
        COUNT(*) FILTER (WHERE result = 'failed')      AS failed,
        COUNT(*) FILTER (WHERE result = 'pending')     AS pending,
        COUNT(*) FILTER (WHERE inspection_type = 'cchen')    AS cchen,
        COUNT(*) FILTER (WHERE inspection_type = 'internal') AS internal,
        COUNT(*) FILTER (WHERE follow_up_done = false AND follow_up_date IS NOT NULL
                           AND follow_up_date < CURRENT_DATE) AS overdue_followup,
        COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM inspection_date) = EXTRACT(YEAR FROM now())) AS this_year,
        MAX(inspection_date) AS last_inspection
      FROM inspections
    `;

    return NextResponse.json({ inspections: rows, stats: stats[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();
    if (!body.inspection_date) {
      return NextResponse.json({ error: "inspection_date es obligatorio" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO inspections
        (inspection_type, inspection_date, inspector_name, inspector_org,
         areas_inspected, findings, observations, non_conformities,
         corrective_actions, follow_up_date, follow_up_done,
         result, report_ref, notes)
      VALUES
        (${body.inspection_type ?? "cchen"},
         ${body.inspection_date},
         ${body.inspector_name ?? null},
         ${body.inspector_org ?? null},
         ${body.areas_inspected ?? null},
         ${body.findings ?? null},
         ${body.observations ?? null},
         ${body.non_conformities ?? null},
         ${body.corrective_actions ?? null},
         ${body.follow_up_date ?? null},
         ${body.follow_up_done ?? false},
         ${body.result ?? "pending"},
         ${body.report_ref ?? null},
         ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ inspection: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const editable = ["inspection_type","inspection_date","inspector_name","inspector_org",
      "areas_inspected","findings","observations","non_conformities","corrective_actions",
      "follow_up_date","follow_up_done","result","report_ref","notes"];
    const setClauses = editable
      .filter(k => k in fields)
      .map((k, i) => `${k} = $${i + 2}`)
      .join(", ");
    const values = [id, ...editable.filter(k => k in fields).map(k => fields[k])];

    if (!setClauses) return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });

    const query = `UPDATE inspections SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`;
    const { rows } = await sql.unsafe(query, values);
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ inspection: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`DELETE FROM inspections WHERE id = ${parseInt(id)} RETURNING id`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
