import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// NS-06.0 §8.3 — Verificación Operacional de Instrumentos de Monitoreo
// Checks pre-uso con fuente de verificación (check source)
// Criterio de aceptación: lecturas dentro de ±10% del valor de referencia

async function ensureTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS instrument_operational_checks (
        id SERIAL PRIMARY KEY,
        instrument_id INT NOT NULL,
        instrument_name TEXT NOT NULL,
        instrument_code TEXT,
        check_source_id INT,
        check_source_name TEXT,
        check_source_activity_kbq NUMERIC(10,3),
        check_date TIMESTAMPTZ NOT NULL DEFAULT now(),
        reference_reading NUMERIC(10,3),
        actual_reading NUMERIC(10,3) NOT NULL,
        deviation_pct NUMERIC(6,2),
        result TEXT NOT NULL DEFAULT 'pass' CHECK (result IN ('pass', 'fail', 'marginal')),
        battery_ok BOOLEAN DEFAULT true,
        background_reading NUMERIC(10,3),
        performed_by TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_ioc_instrument_id ON instrument_operational_checks(instrument_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ioc_check_date ON instrument_operational_checks(check_date DESC);`;
  } catch { /* table already exists */ }
}

function evaluateResult(actual: number, reference: number | null): { result: string; deviation_pct: number | null } {
  if (!reference || reference === 0) return { result: "pass", deviation_pct: null };
  const deviation_pct = ((actual - reference) / reference) * 100;
  const absDeviation = Math.abs(deviation_pct);
  let result = "pass";
  if (absDeviation > 10) result = "fail";
  else if (absDeviation > 5) result = "marginal";
  return { result, deviation_pct: Math.round(deviation_pct * 100) / 100 };
}

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const instrumentId = searchParams.get("instrument_id");
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const summary = searchParams.get("summary") === "1";

  if (summary) {
    // Latest check per instrument + instruments without recent check
    const { rows } = await sql`
      SELECT
        ioc.instrument_id,
        ioc.instrument_name,
        ioc.instrument_code,
        ioc.check_date,
        ioc.actual_reading,
        ioc.reference_reading,
        ioc.deviation_pct,
        ioc.result,
        ioc.battery_ok,
        ioc.performed_by,
        EXTRACT(DAY FROM now() - ioc.check_date)::int AS days_since_check
      FROM (
        SELECT DISTINCT ON (instrument_id) *
        FROM instrument_operational_checks
        ORDER BY instrument_id, check_date DESC
      ) ioc
      ORDER BY ioc.check_date ASC
    `;

    const stats = {
      total: rows.length,
      pass: rows.filter((r) => r.result === "pass").length,
      fail: rows.filter((r) => r.result === "fail").length,
      marginal: rows.filter((r) => r.result === "marginal").length,
      overdue: rows.filter((r) => Number(r.days_since_check) > 1).length,
    };

    return NextResponse.json({ records: rows, stats });
  }

  if (instrumentId) {
    const { rows } = await sql`
      SELECT * FROM instrument_operational_checks
      WHERE instrument_id = ${parseInt(instrumentId, 10)}
        AND check_date >= now() - (${days} || ' days')::interval
      ORDER BY check_date DESC
      LIMIT 100
    `;
    return NextResponse.json({ records: rows });
  }

  // Recent checks
  const { rows } = await sql`
    SELECT * FROM instrument_operational_checks
    WHERE check_date >= now() - (${days} || ' days')::interval
    ORDER BY check_date DESC
    LIMIT 200
  `;
  return NextResponse.json({ records: rows });
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json();
  const {
    instrument_id,
    instrument_name,
    instrument_code,
    check_source_id,
    check_source_name,
    check_source_activity_kbq,
    reference_reading,
    actual_reading,
    battery_ok,
    background_reading,
    performed_by,
    notes,
  } = body;

  if (!instrument_id || !instrument_name || actual_reading == null) {
    return NextResponse.json({ error: "instrument_id, instrument_name y actual_reading son requeridos" }, { status: 400 });
  }

  const { result, deviation_pct } = evaluateResult(Number(actual_reading), reference_reading ? Number(reference_reading) : null);

  const { rows } = await sql`
    INSERT INTO instrument_operational_checks (
      instrument_id, instrument_name, instrument_code,
      check_source_id, check_source_name, check_source_activity_kbq,
      reference_reading, actual_reading, deviation_pct, result,
      battery_ok, background_reading, performed_by, notes
    ) VALUES (
      ${instrument_id}, ${instrument_name}, ${instrument_code ?? null},
      ${check_source_id ?? null}, ${check_source_name ?? null}, ${check_source_activity_kbq ?? null},
      ${reference_reading ?? null}, ${actual_reading}, ${deviation_pct ?? null}, ${result},
      ${battery_ok !== false}, ${background_reading ?? null}, ${performed_by ?? null}, ${notes ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json({ record: rows[0], result, deviation_pct }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await sql`DELETE FROM instrument_operational_checks WHERE id = ${parseInt(id, 10)}`;
  return NextResponse.json({ ok: true });
}
