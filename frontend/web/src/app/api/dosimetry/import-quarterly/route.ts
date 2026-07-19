import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function normRut(v: unknown): string {
  return String(v ?? "").toUpperCase().replace(/[^0-9K]/g, "");
}

function toNum(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s || s === "MNR" || s === "NR") return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function levelFor(dose: number): string {
  if (dose >= 5) return "intervencion";
  if (dose >= 1.6) return "investigacion";
  if (dose >= 0.1) return "registro";
  return "normal";
}

function parsePeriodo(p: unknown): { year: number; quarter: number; label: string } | null {
  const m = String(p ?? "").match(/T\s*([1-4])\s*-\s*(\d{4})/i);
  if (!m) return null;
  return { quarter: Number(m[1]), year: Number(m[2]), label: `T${m[1]}-${m[2]}` };
}

type Agg = {
  worker_rut: string; worker_name: string; institucion: string; departamento: string;
  year: number; quarter: number; label: string;
  dose_body: number; dose_lens: number; dose_skin: number;
  accum_year_body: number; accum_12m_body: number; accum_60m_body: number;
  accum_60m_lens: number; accum_60m_skin: number;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  // rows are positional arrays:
  // [run, periodo, institucion, departamento, doseBody, doseLens, doseSkin, accumYear, accum12m, accum60mBody, accum60mLens, accum60mSkin]
  const rows: any[][] = Array.isArray(body?.rows) ? body.rows : [];

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_quarterly (
      id SERIAL PRIMARY KEY,
      worker_rut TEXT NOT NULL,
      worker_name TEXT,
      institucion TEXT,
      departamento TEXT,
      year INT NOT NULL,
      quarter INT NOT NULL,
      period_label TEXT NOT NULL,
      dose_body NUMERIC DEFAULT 0,
      dose_lens NUMERIC DEFAULT 0,
      dose_skin NUMERIC DEFAULT 0,
      accum_year_body NUMERIC DEFAULT 0,
      accum_12m_body NUMERIC DEFAULT 0,
      accum_60m_body NUMERIC DEFAULT 0,
      accum_60m_lens NUMERIC DEFAULT 0,
      accum_60m_skin NUMERIC DEFAULT 0,
      level TEXT,
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(worker_rut, year, quarter)
    )
  `;

  const { rows: workers } = await sql`SELECT rut, name FROM workers`;
  const rutMap = new Map<string, { rut: string; name: string }>();
  for (const w of workers as any[]) {
    rutMap.set(normRut(w.rut), w as any);
  }

  const agg = new Map<string, Agg>();
  let unmatched = 0;
  const unmatchedSamples: string[] = [];

  for (const r of rows) {
    const run = String(r[0] ?? "").trim();
    const norm = normRut(run);
    const worker = rutMap.get(norm);
    if (!worker || !norm) {
      unmatched++;
      if (unmatchedSamples.length < 30) unmatchedSamples.push(run);
      continue;
    }
    const periodo = parsePeriodo(r[1]);
    if (!periodo) continue;

    const institucion = String(r[2] ?? "");
    const departamento = String(r[3] ?? "");
    const doseBody = toNum(r[4]);
    const doseLens = toNum(r[5]);
    const doseSkin = toNum(r[6]);
    const accumYear = toNum(r[7]);
    const accum12m = toNum(r[8]);
    const accum60mBody = toNum(r[9]);
    const accum60mLens = toNum(r[10]);
    const accum60mSkin = toNum(r[11]);

    const key = `${worker.rut}__${periodo.year}__${periodo.quarter}`;
    const existing = agg.get(key);
    if (existing) {
      existing.dose_body += doseBody;
      existing.dose_lens += doseLens;
      existing.dose_skin += doseSkin;
      existing.accum_year_body = Math.max(existing.accum_year_body, accumYear);
      existing.accum_12m_body = Math.max(existing.accum_12m_body, accum12m);
      existing.accum_60m_body = Math.max(existing.accum_60m_body, accum60mBody);
      existing.accum_60m_lens = Math.max(existing.accum_60m_lens, accum60mLens);
      existing.accum_60m_skin = Math.max(existing.accum_60m_skin, accum60mSkin);
    } else {
      agg.set(key, {
        worker_rut: worker.rut, worker_name: worker.name,
        institucion, departamento,
        year: periodo.year, quarter: periodo.quarter, label: periodo.label,
        dose_body: doseBody, dose_lens: doseLens, dose_skin: doseSkin,
        accum_year_body: accumYear, accum_12m_body: accum12m, accum_60m_body: accum60mBody,
        accum_60m_lens: accum60mLens, accum_60m_skin: accum60mSkin,
      });
    }
  }

  let inserted = 0;
  for (const a of agg.values()) {
    const level = levelFor(a.dose_body);
    await sql`
      INSERT INTO dosimetry_quarterly (
        worker_rut, worker_name, institucion, departamento, year, quarter, period_label,
        dose_body, dose_lens, dose_skin, accum_year_body, accum_12m_body, accum_60m_body,
        accum_60m_lens, accum_60m_skin, level, updated_at
      ) VALUES (
        ${a.worker_rut}, ${a.worker_name}, ${a.institucion}, ${a.departamento}, ${a.year}, ${a.quarter}, ${a.label},
        ${a.dose_body}, ${a.dose_lens}, ${a.dose_skin}, ${a.accum_year_body}, ${a.accum_12m_body}, ${a.accum_60m_body},
        ${a.accum_60m_lens}, ${a.accum_60m_skin}, ${level}, now()
      )
      ON CONFLICT (worker_rut, year, quarter) DO UPDATE SET
        dose_body = EXCLUDED.dose_body,
        dose_lens = EXCLUDED.dose_lens,
        dose_skin = EXCLUDED.dose_skin,
        accum_year_body = EXCLUDED.accum_year_body,
        accum_12m_body = EXCLUDED.accum_12m_body,
        accum_60m_body = EXCLUDED.accum_60m_body,
        accum_60m_lens = EXCLUDED.accum_60m_lens,
        accum_60m_skin = EXCLUDED.accum_60m_skin,
        level = EXCLUDED.level,
        updated_at = now()
    `;
    inserted++;
  }

  return NextResponse.json(
    { ok: true, totalRows: rows.length, matchedGroups: agg.size, inserted, unmatched, unmatchedSamples },
    { headers: corsHeaders() }
  );
}
