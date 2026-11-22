import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §83 — Gestión de EPP Radiológico — Equipos de Protección Personal
// NS-06.0 §4.6 — DS 3/1985 Art. 12
// Control de delantales plomados, protectores tiroideos, lentes plomados,
// guantes de plomo, biombos y mandiles para procedimientos intervencionistas.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS ppe_radiation_items (
      id                   SERIAL PRIMARY KEY,
      ppe_code             TEXT        NOT NULL UNIQUE,
      ppe_type             TEXT        NOT NULL DEFAULT 'apron'
                           CHECK (ppe_type IN ('apron','thyroid_collar','glasses','gloves','screen','other')),
      description          TEXT        NOT NULL,
      brand                TEXT,
      model                TEXT,
      serial_number        TEXT,
      lead_equivalent      NUMERIC(4,2),
      size_category        TEXT,
      location             TEXT,
      status               TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','in_repair','decommissioned','lost')),
      condition            TEXT        NOT NULL DEFAULT 'good'
                           CHECK (condition IN ('excellent','good','acceptable','needs_inspection','damaged')),
      assigned_to_worker   INTEGER,
      assigned_to_name     TEXT,
      assigned_date        DATE,
      purchase_date        DATE,
      expected_life_years  NUMERIC(4,1) DEFAULT 5,
      last_inspection_date DATE,
      next_inspection_date DATE,
      inspection_result    TEXT,
      fluoroscopy_tested   BOOLEAN DEFAULT false,
      fluoroscopy_date     DATE,
      fluoroscopy_result   TEXT,
      notes                TEXT,
      active               BOOLEAN     DEFAULT true,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ppe_assignments (
      id              SERIAL PRIMARY KEY,
      item_id         INTEGER     NOT NULL REFERENCES ppe_radiation_items(id) ON DELETE CASCADE,
      worker_id       INTEGER,
      worker_name     TEXT        NOT NULL,
      assigned_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
      returned_date   DATE,
      reason          TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ppe_inspections (
      id              SERIAL PRIMARY KEY,
      item_id         INTEGER     NOT NULL REFERENCES ppe_radiation_items(id) ON DELETE CASCADE,
      inspection_date DATE        NOT NULL DEFAULT CURRENT_DATE,
      inspector       TEXT        NOT NULL,
      method          TEXT        NOT NULL DEFAULT 'visual'
                      CHECK (method IN ('visual','fluoroscopy','both')),
      result          TEXT        NOT NULL DEFAULT 'pass'
                      CHECK (result IN ('pass','conditional','fail')),
      findings        TEXT,
      action_taken    TEXT,
      next_due        DATE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

async function nextCode(type: string): Promise<string> {
  const prefix: Record<string, string> = {
    apron: "DEL", thyroid_collar: "TIR", glasses: "LEN", gloves: "GUA", screen: "BIO", other: "EPP"
  };
  const p = prefix[type] ?? "EPP";
  const { rows } = await sql.unsafe(`SELECT COUNT(*)::int AS n FROM ppe_radiation_items WHERE ppe_type=$1`, [type]);
  const n = parseInt(rows[0]?.n ?? "0", 10) + 1;
  return `${p}-${String(n).padStart(3, "0")}`;
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM ppe_radiation_items`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const year = new Date().getFullYear();

  const items = [
    // Delantales plomados
    {
      ppe_code: "DEL-001", ppe_type: "apron", description: "Delantal plomado frontal 0.5 mm Pb — Medicina Nuclear",
      brand: "Infab", model: "Classic Series", serial_number: "INF-MN-001",
      lead_equivalent: 0.50, size_category: "M", location: "Medicina Nuclear",
      status: "active", condition: "good", assigned_to_name: "TM. Diego Solís C.",
      assigned_date: `${year-2}-03-15`, purchase_date: `${year-3}-01-10`,
      expected_life_years: 5, last_inspection_date: `${year}-03-15`,
      next_inspection_date: `${year+1}-03-15`, inspection_result: "pass",
      fluoroscopy_tested: true, fluoroscopy_date: `${year}-03-15`, fluoroscopy_result: "Sin fisuras detectadas",
    },
    {
      ppe_code: "DEL-002", ppe_type: "apron", description: "Delantal plomado frontal 0.5 mm Pb — RX Sala 1",
      brand: "Barrier Technologies", model: "Xenolite", serial_number: "BT-RX1-002",
      lead_equivalent: 0.50, size_category: "L", location: "Sala RX 1 — Siemens",
      status: "active", condition: "excellent", assigned_to_name: "TM. Carmen López",
      assigned_date: `${year-1}-06-01`, purchase_date: `${year-1}-05-15`,
      expected_life_years: 5, last_inspection_date: `${year}-06-01`,
      next_inspection_date: `${year+1}-06-01`, inspection_result: "pass",
      fluoroscopy_tested: true, fluoroscopy_date: `${year}-06-01`, fluoroscopy_result: "Sin fisuras detectadas",
    },
    {
      ppe_code: "DEL-003", ppe_type: "apron", description: "Delantal plomado frontal 0.35 mm Pb — RX Dental",
      brand: "MAVIG", model: "Euro-Apron", serial_number: "MAV-RXD-003",
      lead_equivalent: 0.35, size_category: "M", location: "Sala Dental Panorámica",
      status: "active", condition: "acceptable", assigned_to_name: "Dr. Mario Pérez",
      assigned_date: `${year-3}-09-10`, purchase_date: `${year-4}-08-01`,
      expected_life_years: 5, last_inspection_date: `${year-1}-09-10`,
      next_inspection_date: `${year}-09-10`, inspection_result: "conditional",
      fluoroscopy_tested: true, fluoroscopy_date: `${year-1}-09-10`,
      fluoroscopy_result: "Leve degradación en zona lateral derecha — aceptable por ahora",
      notes: "Programar inspección fluoroscópica de seguimiento al vencer plazo",
    },
    {
      ppe_code: "DEL-004", ppe_type: "apron", description: "Delantal plomado frontal+dorsal 0.5 mm Pb — Intervencional",
      brand: "Infab", model: "Revolve", serial_number: "INF-INT-004",
      lead_equivalent: 0.50, size_category: "L", location: "Sala de Procedimientos Intervencionales",
      status: "in_repair", condition: "needs_inspection",
      last_inspection_date: `${year}-01-20`, next_inspection_date: `${year}-07-20`,
      inspection_result: "fail", fluoroscopy_tested: true, fluoroscopy_date: `${year}-01-20`,
      fluoroscopy_result: "Fisura detectada en región lumbar 15×5 mm — RETIRADO",
      notes: "Enviado a reparación autorizada. Proveedor: Madatec Chile. ETA: 30 días.",
    },
    // Protectores tiroideos
    {
      ppe_code: "TIR-001", ppe_type: "thyroid_collar", description: "Protector tiroideo 0.5 mm Pb — Medicina Nuclear",
      brand: "Infab", model: "Thyroid Shield", serial_number: "INF-TIR-001",
      lead_equivalent: 0.50, location: "Medicina Nuclear",
      status: "active", condition: "good", assigned_to_name: "TM. Diego Solís C.",
      assigned_date: `${year-2}-03-15`, purchase_date: `${year-3}-01-10`,
      expected_life_years: 5, last_inspection_date: `${year}-03-15`,
      next_inspection_date: `${year+1}-03-15`, inspection_result: "pass",
    },
    {
      ppe_code: "TIR-002", ppe_type: "thyroid_collar", description: "Protector tiroideo 0.5 mm Pb — RX Sala 1",
      brand: "MAVIG", model: "Thyroid Collar", serial_number: "MAV-TIR-002",
      lead_equivalent: 0.50, location: "Sala RX 1",
      status: "active", condition: "excellent",
      last_inspection_date: `${year}-06-01`, next_inspection_date: `${year+1}-06-01`, inspection_result: "pass",
    },
    // Lentes plomados
    {
      ppe_code: "LEN-001", ppe_type: "glasses", description: "Lentes plomados 0.75 mm Pb — Procedimientos intervencionales",
      brand: "Barrier Technologies", model: "ClearView PbX",
      lead_equivalent: 0.75, location: "Sala de Procedimientos Intervencionales",
      status: "active", condition: "good",
      purchase_date: `${year-1}-11-01`, expected_life_years: 7,
      last_inspection_date: `${year}-02-01`, next_inspection_date: `${year+1}-02-01`, inspection_result: "pass",
    },
    // Biombo plomado
    {
      ppe_code: "BIO-001", ppe_type: "screen", description: "Biombo plomado móvil 2 mm Pb — 180×90 cm",
      brand: "Nuclear Associates", model: "Mobile Shield",
      lead_equivalent: 2.0, location: "Medicina Nuclear / Uso Compartido",
      status: "active", condition: "good",
      purchase_date: `${year-5}-05-01`, expected_life_years: 20,
      last_inspection_date: `${year}-01-10`, next_inspection_date: `${year+1}-01-10`, inspection_result: "pass",
      notes: "Biombo compartido para administraciones I-131 y procedimientos de alta actividad",
    },
  ];

  for (const item of items) {
    const keys = Object.keys(item);
    const vals = Object.values(item);
    await sql.unsafe(
      `INSERT INTO ppe_radiation_items (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) ON CONFLICT (ppe_code) DO NOTHING`,
      vals
    );
  }

  // Seed some assignment history
  const { rows: itemRows } = await sql`SELECT id, ppe_code FROM ppe_radiation_items ORDER BY id`;
  if (itemRows.length > 0) {
    const del1 = itemRows.find((r: { ppe_code: string }) => r.ppe_code === "DEL-001");
    if (del1) {
      await sql.unsafe(
        `INSERT INTO ppe_assignments (item_id, worker_name, assigned_date, returned_date, reason) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [del1.id, "TM. Roberto Soto", `${year-4}-01-01`, `${year-2}-03-14`, "Reasignación por cambio de turno"]
      );
    }
  }

  // Seed inspection history for DEL-003 (conditional)
  const { rows: del3rows } = await sql`SELECT id FROM ppe_radiation_items WHERE ppe_code='DEL-003'`;
  if (del3rows.length > 0) {
    const id = del3rows[0].id;
    await sql.unsafe(
      `INSERT INTO ppe_inspections (item_id, inspection_date, inspector, method, result, findings, next_due) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, `${year-2}-09-10`, "TM. Diego Solís C.", "fluoroscopy", "pass", "Sin hallazgos", `${year-1}-09-10`]
    );
    await sql.unsafe(
      `INSERT INTO ppe_inspections (item_id, inspection_date, inspector, method, result, findings, action_taken, next_due) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, `${year-1}-09-10`, "TM. Diego Solís C.", "fluoroscopy", "conditional",
       "Leve degradación en zona lateral derecha", "Continúa en servicio con seguimiento semestral", `${year}-03-10`]
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") ?? "";
    const status = sp.get("status") ?? "";
    const condition = sp.get("condition") ?? "";
    const item_id = sp.get("item_id");

    // Inspection history for specific item
    if (item_id) {
      const { rows } = await sql.unsafe(
        `SELECT * FROM ppe_inspections WHERE item_id=$1 ORDER BY inspection_date DESC LIMIT 20`,
        [item_id]
      );
      return NextResponse.json({ inspections: rows });
    }

    let where = "active=true";
    const params: unknown[] = [];
    if (type) { params.push(type); where += ` AND ppe_type=$${params.length}`; }
    if (status) { params.push(status); where += ` AND status=$${params.length}`; }
    if (condition) { params.push(condition); where += ` AND condition=$${params.length}`; }

    const { rows } = await sql.unsafe(
      `SELECT *,
        CASE WHEN next_inspection_date IS NOT NULL
          THEN EXTRACT(DAY FROM next_inspection_date - CURRENT_DATE)::int
          ELSE NULL END AS days_to_inspection,
        CASE WHEN purchase_date IS NOT NULL AND expected_life_years IS NOT NULL
          THEN EXTRACT(DAY FROM (purchase_date + (expected_life_years * 365)::int * interval '1 day') - CURRENT_DATE)::int
          ELSE NULL END AS days_to_eol
       FROM ppe_radiation_items WHERE ${where}
       ORDER BY
         CASE condition WHEN 'damaged' THEN 1 WHEN 'needs_inspection' THEN 2 ELSE 3 END,
         CASE status WHEN 'in_repair' THEN 1 ELSE 2 END,
         days_to_inspection NULLS LAST`,
      params
    );

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='active')::int AS active,
          COUNT(*) FILTER (WHERE status='in_repair')::int AS in_repair,
          COUNT(*) FILTER (WHERE status='decommissioned')::int AS decommissioned,
          COUNT(*) FILTER (WHERE condition IN ('damaged','needs_inspection'))::int AS needs_attention,
          COUNT(*) FILTER (WHERE next_inspection_date < CURRENT_DATE AND status='active')::int AS inspection_overdue,
          COUNT(*) FILTER (WHERE next_inspection_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90 AND status='active')::int AS inspection_due_90d,
          COUNT(*) FILTER (WHERE ppe_type='apron')::int AS aprons,
          COUNT(*) FILTER (WHERE ppe_type='thyroid_collar')::int AS thyroid_collars
        FROM ppe_radiation_items WHERE active=true
      `;
      return s[0];
    }, {});

    return NextResponse.json({ items: rows, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { _type, ...data } = body;

    if (_type === "inspection") {
      // Record an inspection
      const { item_id, ...rest } = data;
      const keys = Object.keys(rest);
      const vals = Object.values(rest);
      const { rows } = await sql.unsafe(
        `INSERT INTO ppe_inspections (item_id,${keys.join(",")}) VALUES ($1,${keys.map((_,i)=>`$${i+2}`).join(",")}) RETURNING *`,
        [item_id, ...vals]
      );
      // Update the item's last/next inspection fields
      const insp = rows[0];
      await sql.unsafe(
        `UPDATE ppe_radiation_items SET
          last_inspection_date=$1, next_inspection_date=$2, inspection_result=$3,
          condition=CASE WHEN $3='fail' THEN 'damaged' WHEN $3='conditional' THEN 'needs_inspection' ELSE condition END,
          fluoroscopy_tested=CASE WHEN $4 IN ('fluoroscopy','both') THEN true ELSE fluoroscopy_tested END,
          fluoroscopy_date=CASE WHEN $4 IN ('fluoroscopy','both') THEN $1 ELSE fluoroscopy_date END,
          fluoroscopy_result=CASE WHEN $4 IN ('fluoroscopy','both') THEN $5 ELSE fluoroscopy_result END,
          updated_at=now()
         WHERE id=$6`,
        [insp.inspection_date, insp.next_due ?? null, insp.result, insp.method, insp.findings ?? null, item_id]
      );
      return NextResponse.json({ inspection: insp }, { status: 201 });
    }

    if (_type === "assignment") {
      const { item_id, ...rest } = data;
      const keys = Object.keys(rest);
      const vals = Object.values(rest);
      const { rows } = await sql.unsafe(
        `INSERT INTO ppe_assignments (item_id,${keys.join(",")}) VALUES ($1,${keys.map((_,i)=>`$${i+2}`).join(",")}) RETURNING *`,
        [item_id, ...vals]
      );
      // Update item assignment
      await sql.unsafe(
        `UPDATE ppe_radiation_items SET assigned_to_name=$1, assigned_date=$2, updated_at=now() WHERE id=$3`,
        [data.worker_name, data.assigned_date ?? new Date().toISOString().slice(0,10), item_id]
      );
      return NextResponse.json({ assignment: rows[0] }, { status: 201 });
    }

    // Create new PPE item
    const code = data.ppe_code || await nextCode(data.ppe_type ?? "other");
    const fields = { ppe_code: code, ...data };
    const keys = Object.keys(fields);
    const vals = Object.values(fields);
    const { rows } = await sql.unsafe(
      `INSERT INTO ppe_radiation_items (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    const fields = Object.keys(rest);
    const values = Object.values(rest);
    const set = fields.map((f,i)=>`${f}=$${i+1}`).join(",");
    values.push(id);
    const { rows } = await sql.unsafe(
      `UPDATE ppe_radiation_items SET ${set}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ item: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql.unsafe(`UPDATE ppe_radiation_items SET active=false, updated_at=now() WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
