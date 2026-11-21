import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeFilter    = searchParams.get("type") || "";
  const serviceFilter = searchParams.get("service") || "";
  const q             = searchParams.get("q") || "";
  const year          = parseInt(searchParams.get("year") || "") || new Date().getFullYear();

  // Ensure table exists
  await sql`
    CREATE TABLE IF NOT EXISTS instrument_maintenances (
      id SERIAL PRIMARY KEY,
      instrument_id INTEGER NOT NULL,
      maintenance_date DATE NOT NULL,
      maintenance_type TEXT DEFAULT 'preventivo',
      company TEXT,
      responsible TEXT,
      notes TEXT,
      cost NUMERIC(12,2),
      next_maintenance_date DATE,
      created_by TEXT DEFAULT 'Sistema',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Per-instrument: latest maintenance + next scheduled
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
      i.maintenance_frequency_months,
      (SELECT m.maintenance_date     FROM instrument_maintenances m WHERE m.instrument_id = i.id ORDER BY m.maintenance_date DESC, m.id DESC LIMIT 1) AS last_maintenance_date,
      (SELECT m.maintenance_type     FROM instrument_maintenances m WHERE m.instrument_id = i.id ORDER BY m.maintenance_date DESC, m.id DESC LIMIT 1) AS last_maintenance_type,
      (SELECT m.company              FROM instrument_maintenances m WHERE m.instrument_id = i.id ORDER BY m.maintenance_date DESC, m.id DESC LIMIT 1) AS last_company,
      (SELECT m.next_maintenance_date FROM instrument_maintenances m WHERE m.instrument_id = i.id ORDER BY m.maintenance_date DESC, m.id DESC LIMIT 1) AS next_maintenance_date,
      (SELECT m.cost                 FROM instrument_maintenances m WHERE m.instrument_id = i.id ORDER BY m.maintenance_date DESC, m.id DESC LIMIT 1) AS last_cost,
      (SELECT COUNT(*) FROM instrument_maintenances m WHERE m.instrument_id = i.id)::int AS total_maintenances,
      (SELECT SUM(m.cost) FROM instrument_maintenances m WHERE m.instrument_id = i.id AND EXTRACT(YEAR FROM m.maintenance_date) = ${year}) AS cost_this_year
    FROM instruments i
    WHERE i.maintenance_frequency_months IS NOT NULL OR EXISTS (
      SELECT 1 FROM instrument_maintenances m WHERE m.instrument_id = i.id
    )
    ORDER BY i.service, i.name
  `;

  const today = new Date();

  const enriched = instruments.map((r) => {
    const nextDate = r.next_maintenance_date
      ? new Date(r.next_maintenance_date as string)
      : (r.last_maintenance_date && r.maintenance_frequency_months)
        ? (() => {
            const d = new Date(r.last_maintenance_date as string);
            d.setMonth(d.getMonth() + (r.maintenance_frequency_months as number));
            return d;
          })()
        : null;

    let maintStatus = "sin_mantenimiento";
    let daysToNext: number | null = null;

    if (nextDate) {
      daysToNext = Math.floor((nextDate.getTime() - today.getTime()) / 86400000);
      if (daysToNext < 0)        maintStatus = "vencido";
      else if (daysToNext <= 30) maintStatus = "urgente";
      else if (daysToNext <= 90) maintStatus = "proximo";
      else                       maintStatus = "al_dia";
    } else if (r.last_maintenance_date) {
      maintStatus = "al_dia";
    }

    return { ...r, maint_status: maintStatus, days_to_next: daysToNext, next_date_computed: nextDate?.toISOString().slice(0, 10) ?? null };
  });

  // Filters
  let filtered = enriched;
  if (typeFilter) {
    filtered = filtered.filter(r => (r.last_maintenance_type as string || "") === typeFilter);
  }
  if (serviceFilter) {
    filtered = filtered.filter(r => (r.service as string || "").toLowerCase().includes(serviceFilter.toLowerCase()));
  }
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(r =>
      (r.name as string || "").toLowerCase().includes(ql) ||
      (r.code as string || "").toLowerCase().includes(ql) ||
      (r.last_company as string || "").toLowerCase().includes(ql)
    );
  }

  // Stats
  const stats = {
    total:            enriched.length,
    al_dia:           enriched.filter(r => r.maint_status === "al_dia").length,
    proximo:          enriched.filter(r => r.maint_status === "proximo").length,
    urgente:          enriched.filter(r => r.maint_status === "urgente").length,
    vencido:          enriched.filter(r => r.maint_status === "vencido").length,
    sin_mantenimiento:enriched.filter(r => r.maint_status === "sin_mantenimiento").length,
    cost_year:        enriched.reduce((s, r) => s + parseFloat(String(r.cost_this_year ?? "0")), 0),
  };

  // Upcoming (90 days)
  const upcoming = enriched
    .filter(r => r.days_to_next !== null && r.days_to_next >= 0 && r.days_to_next <= 90)
    .sort((a, b) => (a.days_to_next as number) - (b.days_to_next as number))
    .slice(0, 15);

  // Maintenance type breakdown for year
  const { rows: byType } = await sql`
    SELECT
      maintenance_type,
      COUNT(*)::int AS count,
      SUM(cost)::numeric AS total_cost
    FROM instrument_maintenances
    WHERE EXTRACT(YEAR FROM maintenance_date) = ${year}
    GROUP BY maintenance_type
    ORDER BY count DESC
  `;

  const services = [...new Set(enriched.map(r => r.service as string).filter(Boolean))].sort();

  return NextResponse.json({ instruments: filtered, stats, upcoming, by_type: byType, services, year });
}
