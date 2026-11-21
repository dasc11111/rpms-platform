import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") || "";
  const serviceFilter = searchParams.get("service") || "";
  const q = searchParams.get("q") || "";

  // Ensure calibrations table exists with needed columns
  await sql`
    CREATE TABLE IF NOT EXISTS calibrations (
      id SERIAL PRIMARY KEY,
      instrument_id INTEGER NOT NULL,
      calibration_date DATE NOT NULL,
      expiry_date DATE,
      company_id INTEGER,
      company_name TEXT,
      certificate_number TEXT,
      calibration_factor NUMERIC,
      magnitude TEXT,
      units TEXT,
      method TEXT,
      standard_used TEXT,
      notes TEXT,
      status TEXT DEFAULT 'vigente',
      created_by TEXT DEFAULT 'Sistema',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS calibration_companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      kind TEXT DEFAULT 'Otro',
      accreditation TEXT,
      contact TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Per-instrument: latest calibration + upcoming expiry
  const { rows: instruments } = await sql`
    SELECT
      i.id,
      i.code,
      i.name,
      i.brand,
      i.model,
      i.serial_number,
      i.service,
      i.unit,
      i.status AS instrument_status,
      i.calibration_frequency_months,
      -- latest calibration
      (SELECT c.calibration_date FROM calibrations c WHERE c.instrument_id = i.id ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1) AS last_calibration_date,
      (SELECT c.expiry_date     FROM calibrations c WHERE c.instrument_id = i.id ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1) AS expiry_date,
      (SELECT c.certificate_number FROM calibrations c WHERE c.instrument_id = i.id ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1) AS certificate_number,
      (SELECT COALESCE(c.company_name, cc.name)
       FROM calibrations c LEFT JOIN calibration_companies cc ON cc.id = c.company_id
       WHERE c.instrument_id = i.id ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1) AS calibration_company,
      (SELECT COUNT(*) FROM calibrations c WHERE c.instrument_id = i.id)::int AS total_calibrations
    FROM instruments i
    WHERE i.requires_calibration = true OR i.calibration_frequency_months IS NOT NULL
    ORDER BY i.service, i.name
  `;

  // Compute status per instrument
  const today = new Date();
  const enriched = instruments.map((r) => {
    const expiry = r.expiry_date ? new Date(r.expiry_date as string) : null;
    const lastCal = r.last_calibration_date ? new Date(r.last_calibration_date as string) : null;
    const freqMonths = r.calibration_frequency_months as number | null;

    let calStatus = "sin_calibrar";
    let daysToExpiry: number | null = null;

    if (expiry) {
      daysToExpiry = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
      if (daysToExpiry < 0)       calStatus = "vencida";
      else if (daysToExpiry <= 30) calStatus = "por_vencer";
      else if (daysToExpiry <= 90) calStatus = "proximo";
      else                         calStatus = "vigente";
    } else if (lastCal && freqMonths) {
      // Estimate from frequency
      const nextDue = new Date(lastCal);
      nextDue.setMonth(nextDue.getMonth() + freqMonths);
      daysToExpiry = Math.floor((nextDue.getTime() - today.getTime()) / 86400000);
      if (daysToExpiry < 0)       calStatus = "vencida";
      else if (daysToExpiry <= 30) calStatus = "por_vencer";
      else if (daysToExpiry <= 90) calStatus = "proximo";
      else                         calStatus = "vigente";
    }

    return { ...r, cal_status: calStatus, days_to_expiry: daysToExpiry };
  });

  // Filter
  let filtered = enriched;
  if (statusFilter) filtered = filtered.filter(r => r.cal_status === statusFilter);
  if (serviceFilter) filtered = filtered.filter(r => (r.service as string || "").toLowerCase().includes(serviceFilter.toLowerCase()));
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(r =>
      (r.name as string || "").toLowerCase().includes(ql) ||
      (r.code as string || "").toLowerCase().includes(ql) ||
      (r.serial_number as string || "").toLowerCase().includes(ql) ||
      (r.certificate_number as string || "").toLowerCase().includes(ql)
    );
  }

  // Stats
  const stats = {
    total:       enriched.length,
    vigente:     enriched.filter(r => r.cal_status === "vigente").length,
    por_vencer:  enriched.filter(r => r.cal_status === "por_vencer").length,
    proximo:     enriched.filter(r => r.cal_status === "proximo").length,
    vencida:     enriched.filter(r => r.cal_status === "vencida").length,
    sin_calibrar:enriched.filter(r => r.cal_status === "sin_calibrar").length,
  };

  // Upcoming calibrations (next 90 days)
  const upcoming = enriched
    .filter(r => r.days_to_expiry !== null && r.days_to_expiry >= 0 && r.days_to_expiry <= 90)
    .sort((a, b) => (a.days_to_expiry as number) - (b.days_to_expiry as number))
    .slice(0, 15);

  // Distinct services
  const services = [...new Set(enriched.map(r => r.service as string).filter(Boolean))].sort();

  return NextResponse.json({ instruments: filtered, stats, upcoming, services });
}
