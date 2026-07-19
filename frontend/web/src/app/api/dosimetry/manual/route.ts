import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function toNum(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function levelFor(dose: number): string {
  if (dose >= 5) return "intervencion";
  if (dose >= 1.6) return "investigacion";
  if (dose >= 0.1) return "registro";
  return "normal";
}

export async function POST(request: Request) {
  const body: any = await request.json().catch(() => ({}));
  const worker_rut = String(body?.worker_rut ?? "").trim();
  const year = Number(body?.year);
  const quarter = Number(body?.quarter);

  if (!worker_rut || !year || !quarter || quarter < 1 || quarter > 4) {
    return NextResponse.json(
      { ok: false, error: "Datos incompletos: trabajador, año y trimestre son obligatorios." },
      { status: 400 }
    );
  }

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

  const { rows: workerRows } = await sql`SELECT rut, name FROM workers WHERE rut = ${worker_rut} LIMIT 1`;
  if (workerRows.length === 0) {
    return NextResponse.json({ ok: false, error: "No se encontró un trabajador con ese RUT." }, { status: 404 });
  }
  const worker: any = workerRows[0];

  const dose_body = toNum(body?.dose_body);
  const dose_lens = toNum(body?.dose_lens);
  const dose_skin = toNum(body?.dose_skin);
  const accum_year_body = toNum(body?.accum_year_body);
  const accum_12m_body = toNum(body?.accum_12m_body);
  const accum_60m_body = toNum(body?.accum_60m_body);
  const accum_60m_lens = toNum(body?.accum_60m_lens);
  const accum_60m_skin = toNum(body?.accum_60m_skin);
  const institucion = String(body?.institucion ?? "");
  const departamento = String(body?.departamento ?? "");
  const period_label = `T${quarter}-${year}`;
  const level = levelFor(dose_body);

  await sql`
    INSERT INTO dosimetry_quarterly (
      worker_rut, worker_name, institucion, departamento, year, quarter, period_label,
      dose_body, dose_lens, dose_skin, accum_year_body, accum_12m_body, accum_60m_body,
      accum_60m_lens, accum_60m_skin, level, updated_at
    ) VALUES (
      ${worker.rut}, ${worker.name}, ${institucion}, ${departamento}, ${year}, ${quarter}, ${period_label},
      ${dose_body}, ${dose_lens}, ${dose_skin}, ${accum_year_body}, ${accum_12m_body}, ${accum_60m_body},
      ${accum_60m_lens}, ${accum_60m_skin}, ${level}, now()
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

  return NextResponse.json({ ok: true, worker_name: worker.name, period_label, level });
}
