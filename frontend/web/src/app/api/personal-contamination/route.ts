import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// §84 — Monitoreo de Contaminación Personal
// NS-06.0 §4.5 — DS 3/1985 Art. 12
// Registro de mediciones de contaminación corporal al salir de zonas controladas.
// Límites de referencia: 0.4 Bq/cm² para beta/gamma (zona supervisada),
// 0.04 Bq/cm² para alfa. Fuente: IAEA Safety Standards, NS-06.0 Anexo C.

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS personal_contamination_checks (
      id               SERIAL PRIMARY KEY,
      check_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
      check_time       TIME,
      worker_id        INTEGER,
      worker_name      TEXT        NOT NULL,
      worker_role      TEXT,
      area_origin      TEXT,
      instrument_used  TEXT,
      -- Measurement results (cpm or Bq/cm²)
      hands_result     NUMERIC(10,3),
      feet_result      NUMERIC(10,3),
      clothing_result  NUMERIC(10,3),
      body_result      NUMERIC(10,3),
      unit             TEXT        NOT NULL DEFAULT 'cpm'
                       CHECK (unit IN ('cpm','bq_cm2')),
      background_level NUMERIC(10,3),
      -- Outcome
      result           TEXT        NOT NULL DEFAULT 'clear'
                       CHECK (result IN ('clear','elevated','contaminated','decontaminated')),
      action_taken     TEXT,
      decontamination  TEXT,
      follow_up        TEXT,
      notes            TEXT,
      inspector        TEXT,
      active           BOOLEAN     DEFAULT true,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch(() => fallback);
}

async function seedData() {
  const { rows } = await sql`SELECT COUNT(*) AS n FROM personal_contamination_checks`;
  if (parseInt(rows[0].n, 10) > 0) return;

  const year = new Date().getFullYear();

  const checks = [
    // Normal checks — routine daily exit monitoring
    {
      check_date: `${year}-11-18`, check_time: "17:30:00", worker_name: "TM. Diego Solís C.",
      worker_role: "Encargado PR", area_origin: "Sala de Administraciones I-131",
      instrument_used: "Ludlum 3 (detector pancake GM)", hands_result: 45, feet_result: 38,
      clothing_result: 42, unit: "cpm", background_level: 35,
      result: "clear", inspector: "TM. Diego Solís C.", notes: "Monitoreo de rutina salida zona controlada",
    },
    {
      check_date: `${year}-11-18`, check_time: "18:00:00", worker_name: "TM. Carmen López",
      worker_role: "TM Medicina Nuclear", area_origin: "Sala de Medicina Nuclear",
      instrument_used: "Ludlum 3 (detector pancake GM)", hands_result: 48, feet_result: 40,
      clothing_result: 44, unit: "cpm", background_level: 35,
      result: "clear", inspector: "TM. Diego Solís C.",
    },
    {
      check_date: `${year}-11-19`, check_time: "13:15:00", worker_name: "TM. Diego Solís C.",
      worker_role: "Encargado PR", area_origin: "Radiofarmacia — Preparación Tc-99m",
      instrument_used: "Ludlum 3 (detector pancake GM)", hands_result: 62, feet_result: 39,
      clothing_result: 55, unit: "cpm", background_level: 35,
      result: "elevated",
      action_taken: "Remedir post-lavado de manos con agua y jabón",
      decontamination: "Lavado con agua y jabón ×2, remedir",
      follow_up: "Resultado post-lavado: 41 cpm (< nivel referencia)",
      inspector: "TM. Diego Solís C.",
      notes: "Manos: primera lectura elevada (62 cpm). Post-lavado normal. Evaluar uso de doble guante en preparaciones.",
    },
    {
      check_date: `${year}-11-20`, check_time: "12:00:00", worker_name: "TM. Roberto Soto",
      worker_role: "TM Medicina Nuclear", area_origin: "Sala PET/CT — Post administración FDG",
      instrument_used: "Ludlum 3 (detector pancake GM)", hands_result: 36, feet_result: 33,
      clothing_result: 35, unit: "cpm", background_level: 32,
      result: "clear", inspector: "TM. Carmen López",
    },
    // Contamination event (significant)
    {
      check_date: `${year}-10-15`, check_time: "11:45:00", worker_name: "TM. Carmen López",
      worker_role: "TM Medicina Nuclear", area_origin: "Radiofarmacia — Fractura frasco Tc-99m",
      instrument_used: "Ludlum 3 + ionización Victoreen 450P", hands_result: 850, feet_result: 320,
      clothing_result: 480, unit: "cpm", background_level: 35,
      result: "contaminated",
      action_taken: "Protocolo de descontaminación activado. Ropa retenida para decaimiento.",
      decontamination: "Lavado manos ×5 con agua+jabón, descontaminante RADIACARE. Ducha completa. Remedir cada 15 min.",
      follow_up: "Post-descontaminación (90 min): manos 48 cpm, pies 37 cpm, ropa retenida 7 días. Incidente notificado a CCHEN.",
      notes: "Fractura accidental frasco multidosis Tc-99m durante manipulación. Ver informe incidente INC-2025-015.",
      inspector: "TM. Diego Solís C.",
    },
    {
      check_date: `${year}-09-28`, check_time: "16:30:00", worker_name: "Dr. Mario Pérez",
      worker_role: "Médico Nuclear", area_origin: "Sala de Administraciones",
      instrument_used: "Ludlum 3 (detector pancake GM)", hands_result: 40, feet_result: 36,
      clothing_result: 38, unit: "cpm", background_level: 33,
      result: "clear", inspector: "TM. Diego Solís C.",
    },
    {
      check_date: `${year}-09-10`, check_time: "17:00:00", worker_name: "TM. Diego Solís C.",
      worker_role: "Encargado PR", area_origin: "Sala de Administraciones I-131",
      instrument_used: "Ludlum 3 (detector pancake GM)", hands_result: 44, feet_result: 37,
      clothing_result: 40, unit: "cpm", background_level: 34,
      result: "clear", inspector: "TM. Diego Solís C.",
    },
    {
      check_date: `${year}-08-22`, check_time: "14:00:00", worker_name: "TM. Roberto Soto",
      worker_role: "TM Medicina Nuclear", area_origin: "Sala de Medicina Nuclear",
      instrument_used: "Ludlum 3 (detector pancake GM)", hands_result: 72, feet_result: 42,
      clothing_result: 65, unit: "cpm", background_level: 35,
      result: "elevated",
      action_taken: "Lavado manos y pies, cambio calzado. Remedir.",
      decontamination: "Lavado ×3 manos+pies",
      follow_up: "Post lavado: manos 43 cpm, pies 37 cpm — NORMAL",
      inspector: "TM. Diego Solís C.",
    },
  ];

  for (const c of checks) {
    const keys = Object.keys(c);
    const vals = Object.values(c);
    await sql.unsafe(
      `INSERT INTO personal_contamination_checks (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")})`,
      vals
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await seedData();

    const sp = req.nextUrl.searchParams;
    const result = sp.get("result") ?? "";
    const worker = sp.get("worker") ?? "";
    const days = sp.get("days") ?? "90";

    let where = `active=true AND check_date >= CURRENT_DATE - $1::int * interval '1 day'`;
    const params: unknown[] = [days];
    if (result) { params.push(result); where += ` AND result=$${params.length}`; }
    if (worker) { params.push(`%${worker}%`); where += ` AND worker_name ILIKE $${params.length}`; }

    const { rows } = await sql.unsafe(
      `SELECT * FROM personal_contamination_checks WHERE ${where} ORDER BY check_date DESC, check_time DESC`,
      params
    );

    // Per-worker stats for the period
    const { rows: workerStats } = await sql.unsafe(
      `SELECT worker_name,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE result='clear')::int AS clear,
        COUNT(*) FILTER (WHERE result='elevated')::int AS elevated,
        COUNT(*) FILTER (WHERE result='contaminated')::int AS contaminated,
        MAX(check_date) AS last_check,
        ROUND(AVG(GREATEST(COALESCE(hands_result,0), COALESCE(feet_result,0), COALESCE(clothing_result,0)))::numeric, 1) AS avg_max_reading
       FROM personal_contamination_checks
       WHERE active=true AND check_date >= CURRENT_DATE - $1::int * interval '1 day'
       GROUP BY worker_name ORDER BY MAX(check_date) DESC`,
      [days]
    );

    const stats = await safeQuery(async () => {
      const { rows: s } = await sql.unsafe(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE result='clear')::int AS clear,
          COUNT(*) FILTER (WHERE result='elevated')::int AS elevated,
          COUNT(*) FILTER (WHERE result='contaminated')::int AS contaminated,
          COUNT(*) FILTER (WHERE result='decontaminated')::int AS decontaminated,
          COUNT(*) FILTER (WHERE check_date = CURRENT_DATE)::int AS today
         FROM personal_contamination_checks WHERE active=true AND check_date >= CURRENT_DATE - $1::int * interval '1 day'`,
        [days]
      );
      return s[0];
    }, {});

    return NextResponse.json({ checks: rows, workerStats, stats });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const keys = Object.keys(body);
    const vals = Object.values(body);
    const { rows } = await sql.unsafe(
      `INSERT INTO personal_contamination_checks (${keys.join(",")}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`,
      vals
    );
    return NextResponse.json({ check: rows[0] }, { status: 201 });
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
      `UPDATE personal_contamination_checks SET ${set} WHERE id=$${values.length} RETURNING *`,
      values
    );
    return NextResponse.json({ check: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await sql.unsafe(`UPDATE personal_contamination_checks SET active=false WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
