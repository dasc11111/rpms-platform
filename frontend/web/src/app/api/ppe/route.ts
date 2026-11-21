import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// DS 3/1985 Art. 25: El encargado de PR debe velar por que el personal expuesto
// cuente con elementos de protección radiológica adecuados (delantales, tiroides,
// guantes plomados, lentes, mamparas). Se registra inventario, asignaciones y
// verificaciones de integridad.

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ppe_items (
      id              SERIAL PRIMARY KEY,
      item_code       TEXT        NOT NULL UNIQUE,
      item_type       TEXT        NOT NULL,
      description     TEXT,
      brand           TEXT,
      model           TEXT,
      lead_mm         NUMERIC(4,2),
      acquisition_date DATE,
      last_check_date DATE,
      next_check_date DATE,
      assigned_to     TEXT,
      service_area    TEXT,
      condition       TEXT        NOT NULL DEFAULT 'good',
      location        TEXT,
      notes           TEXT,
      active          BOOLEAN     DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ppe_checks (
      id          SERIAL PRIMARY KEY,
      item_id     INTEGER REFERENCES ppe_items(id) ON DELETE CASCADE,
      check_date  DATE NOT NULL,
      checked_by  TEXT,
      result      TEXT NOT NULL DEFAULT 'pass',
      findings    TEXT,
      action      TEXT,
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const { rows } = await sql`SELECT id FROM ppe_items LIMIT 1`;
  if (rows.length === 0) {
    const y = new Date().getFullYear();
    await sql`
      INSERT INTO ppe_items (item_code, item_type, description, brand, lead_mm, acquisition_date, last_check_date, next_check_date, service_area, condition, location)
      VALUES
        ('AP-001', 'apron',       'Delantal plomado frontal 0.5 mm Pb',      'INFAB',   0.50, ${`${y-3}-04-10`}, ${`${y}-03-01`}, ${`${y+1}-03-01`}, 'Medicina Nuclear',   'good',  'MN – Perchero sala 1'),
        ('AP-002', 'apron',       'Delantal plomado frontal 0.5 mm Pb',      'INFAB',   0.50, ${`${y-3}-04-10`}, ${`${y}-03-01`}, ${`${y+1}-03-01`}, 'Medicina Nuclear',   'good',  'MN – Perchero sala 1'),
        ('AP-003', 'apron',       'Delantal plomado wrap 0.25+0.25 mm Pb',   'Barrier', 0.25, ${`${y-2}-01-20`}, ${`${y}-03-01`}, ${`${y+1}-03-01`}, 'Radiofísica',        'good',  'RF – Sala calibración'),
        ('TH-001', 'thyroid',     'Protector tiroideo 0.5 mm Pb',            'INFAB',   0.50, ${`${y-3}-04-10`}, ${`${y}-03-01`}, ${`${y+1}-03-01`}, 'Medicina Nuclear',   'good',  'MN – Perchero sala 1'),
        ('TH-002', 'thyroid',     'Protector tiroideo 0.5 mm Pb',            'INFAB',   0.50, ${`${y-3}-04-10`}, ${`${y}-03-01`}, ${`${y+1}-03-01`}, 'Medicina Nuclear',   'fair',  'MN – Perchero sala 2'),
        ('GL-001', 'gloves',      'Guantes plomados 0.5 mm Pb (par)',        'Wolf',    0.50, ${`${y-1}-06-01`}, ${`${y}-06-01`}, ${`${y+1}-06-01`}, 'Medicina Nuclear',   'good',  'MN – Cajón técnico'),
        ('GL-002', 'gloves',      'Guantes plomados 0.5 mm Pb (par)',        'Wolf',    0.50, ${`${y-4}-06-01`}, ${`${y-1}-06-01`}, ${`${y}-06-01`},  'Radiofísica',        'poor',  'RF – Sala isótopos'),
        ('LG-001', 'glasses',     'Lentes plomados 0.75 mm Pb equiv.',       'Barrier', 0.75, ${`${y-2}-09-15`}, ${`${y}-03-01`}, ${`${y+1}-03-01`}, 'Medicina Nuclear',   'good',  'MN – Perchero sala 1'),
        ('SC-001', 'screen',      'Mampara móvil plomada 2 mm Pb 60×120 cm','Nuclear', 2.00, ${`${y-5}-02-01`}, ${`${y}-01-15`}, ${`${y+1}-01-15`}, 'Medicina Nuclear',   'good',  'MN – Sala de captación'),
        ('SC-002', 'screen',      'Mampara fija jeringoteca 50×50 cm 2mmPb','Nuclear', 2.00, ${`${y-5}-02-01`}, ${`${y}-01-15`}, ${`${y+1}-01-15`}, 'Radiofísica',        'good',  'RF – Cajón jeringoteca')
    `;
  }
}

export async function GET(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }

  const { searchParams } = new URL(req.url);
  const type      = searchParams.get("type");
  const condition = searchParams.get("condition");
  const area      = searchParams.get("area");

  try {
    let rows;
    const filters: string[] = ["active = true"];
    const vals: unknown[]   = [];

    if (type)      { vals.push(type);      filters.push(`item_type = $${vals.length}`); }
    if (condition) { vals.push(condition); filters.push(`condition = $${vals.length}`); }
    if (area)      { vals.push(`%${area}%`); filters.push(`service_area ILIKE $${vals.length}`); }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    ({ rows } = await sql.unsafe(`SELECT * FROM ppe_items ${where} ORDER BY item_type, item_code`, vals));

    // Stats
    const { rows: stats } = await sql`
      SELECT
        COUNT(*)                                                AS total,
        COUNT(*) FILTER (WHERE condition = 'good')             AS good,
        COUNT(*) FILTER (WHERE condition = 'fair')             AS fair,
        COUNT(*) FILTER (WHERE condition = 'poor')             AS poor,
        COUNT(*) FILTER (WHERE condition = 'condemned')        AS condemned,
        COUNT(*) FILTER (WHERE next_check_date < now() AND active) AS overdue_checks,
        COUNT(*) FILTER (WHERE next_check_date BETWEEN now() AND now()+INTERVAL '90 days' AND active) AS upcoming_checks
      FROM ppe_items WHERE active = true
    `;

    // Recent checks
    const { rows: checks } = await sql`
      SELECT c.*, p.item_code, p.description FROM ppe_checks c
      JOIN ppe_items p ON p.id = c.item_id
      ORDER BY c.check_date DESC LIMIT 20
    `;

    return NextResponse.json({ items: rows, stats: stats[0], checks });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { await ensureTable(); } catch { /* ok */ }
  try {
    const body = await req.json();

    if (body.check_for) {
      // Add integrity check
      const { rows } = await sql`
        INSERT INTO ppe_checks (item_id, check_date, checked_by, result, findings, action, notes)
        VALUES (${body.check_for}, ${body.check_date}, ${body.checked_by ?? null},
                ${body.result ?? "pass"}, ${body.findings ?? null},
                ${body.action ?? null}, ${body.notes ?? null})
        RETURNING *
      `;
      await sql`
        UPDATE ppe_items SET last_check_date=${body.check_date},
          next_check_date=${body.next_check_date ?? null},
          condition=${body.new_condition ?? "good"},
          updated_at=now()
        WHERE id=${body.check_for}
      `;
      return NextResponse.json({ check: rows[0] }, { status: 201 });
    }

    if (!body.item_code || !body.item_type) {
      return NextResponse.json({ error: "item_code e item_type son obligatorios" }, { status: 400 });
    }
    const { rows } = await sql`
      INSERT INTO ppe_items
        (item_code, item_type, description, brand, model, lead_mm, acquisition_date,
         last_check_date, next_check_date, assigned_to, service_area, condition, location, notes)
      VALUES
        (${body.item_code}, ${body.item_type}, ${body.description ?? null}, ${body.brand ?? null},
         ${body.model ?? null}, ${body.lead_mm ?? null}, ${body.acquisition_date ?? null},
         ${body.last_check_date ?? null}, ${body.next_check_date ?? null},
         ${body.assigned_to ?? null}, ${body.service_area ?? null},
         ${body.condition ?? "good"}, ${body.location ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const editable = ["item_code","item_type","description","brand","model","lead_mm",
      "acquisition_date","last_check_date","next_check_date","assigned_to",
      "service_area","condition","location","notes","active"];
    const fields = Object.keys(body).filter(k => editable.includes(k));
    if (!fields.length) return NextResponse.json({ error: "Sin campos" }, { status: 400 });
    const sets = fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ");
    const vals = [id, ...fields.map(f => (body as Record<string, unknown>)[f])];
    const { rows } = await sql.unsafe(
      `UPDATE ppe_items SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`, vals
    );
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`UPDATE ppe_items SET active=false, updated_at=now() WHERE id=${parseInt(id)} RETURNING id, item_code`;
    if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ deactivated: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
