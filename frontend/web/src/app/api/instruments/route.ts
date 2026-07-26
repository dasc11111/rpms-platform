import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCalibrationAlertLevel, getTrackingCheckpoint } from "@/lib/instruments";

export const dynamic = "force-dynamic";

type Filters = {
  q?: string;
  typeId?: string;
  status?: string;
  service?: string;
  unit?: string;
};

function buildWhere(filters: Filters): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

if (filters.q) {
  params.push(`%${filters.q}%`);
  const p = params.length;
  conditions.push(
    `(i.code ILIKE $${p} OR i.name ILIKE $${p} OR i.brand ILIKE $${p} OR i.model ILIKE $${p} OR i.serial_number ILIKE $${p} OR i.manufacturer ILIKE $${p} OR i.service ILIKE $${p} OR i.unit ILIKE $${p} OR i.location ILIKE $${p})`
    );
}
  if (filters.typeId) {
    params.push(Number(filters.typeId));
    conditions.push(`i.type_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`i.status = $${params.length}`);
  }
  if (filters.service) {
    params.push(filters.service);
    conditions.push(`i.service = $${params.length}`);
  }
  if (filters.unit) {
    params.push(filters.unit);
    conditions.push(`i.unit = $${params.length}`);
  }

const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: Filters = {
    q: searchParams.get("q") || undefined,
    typeId: searchParams.get("typeId") || undefined,
    status: searchParams.get("status") || undefined,
    service: searchParams.get("service") || undefined,
    unit: searchParams.get("unit") || undefined,
  };
  const companyFilter = (searchParams.get("company") || "").trim().toLowerCase();
  const calibrationStatus = searchParams.get("calibrationStatus") || "";
  const hasFailures = searchParams.get("hasFailures") || "";
  const inMaintenance = searchParams.get("inMaintenance") || "";

const { where, params } = buildWhere(filters);

const query = `
SELECT
i.*,
t.name AS type_name,
lc.calibration_date AS last_calibration_date,
lc.expiry_date AS last_calibration_expiry,
lc.certificate_number AS last_calibration_certificate,
COALESCE(lc.company_name, cc.name) AS last_calibration_company,
COALESCE(fc.open_count, 0) AS failures_open_count
FROM instruments i
LEFT JOIN instrument_types t ON t.id = i.type_id
LEFT JOIN LATERAL (
SELECT * FROM calibrations c WHERE c.instrument_id = i.id ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1
) lc ON true
LEFT JOIN calibration_companies cc ON cc.id = lc.company_id
LEFT JOIN LATERAL (
SELECT COUNT(*)::int AS open_count FROM instrument_failures f WHERE f.instrument_id = i.id AND f.status IN ('abierta','en_proceso')
) fc ON true
${where}
ORDER BY i.name ASC
LIMIT 5000
`;

const { rows } = await sql.query(query, params);

type Row = Record<string, unknown>;
  type EnrichedRow = Row & {
    alert_level: string;
    days_remaining: number | null;
    tracking_checkpoint: number | null;
    in_maintenance: boolean;
  };
  let items: EnrichedRow[] = (rows as Row[]).map((row) => {
    const alert = getCalibrationAlertLevel((row.last_calibration_expiry as string) ?? null);
    return {
      ...row,
      alert_level: alert.level,
      days_remaining: alert.daysRemaining,
      tracking_checkpoint: getTrackingCheckpoint(alert.daysRemaining),
      in_maintenance: row.status === "en_mantenimiento",
    } as EnrichedRow;
  });

if (companyFilter) {
  items = items.filter((it) => String(it.last_calibration_company ?? "").toLowerCase().includes(companyFilter));
}
  if (calibrationStatus) {
    items = items.filter((it) => it.alert_level === calibrationStatus);
  }
  if (hasFailures === "true") {
    items = items.filter((it) => Number(it.failures_open_count ?? 0) > 0);
  }
  if (hasFailures === "false") {
    items = items.filter((it) => Number(it.failures_open_count ?? 0) === 0);
  }
  if (inMaintenance === "true") {
    items = items.filter((it) => it.in_maintenance === true);
  }

return NextResponse.json({ instruments: items, total: items.length });
}

export async function POST(request: Request) {
  const body = await request.json();
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();

if (!code || !name) {
  return NextResponse.json({ error: "code_and_name_required" }, { status: 400 });
}

const { rows: existing } = await sql`SELECT id FROM instruments WHERE code = ${code}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: "code_already_exists" }, { status: 409 });
  }

const typeId = body.typeId ? Number(body.typeId) : null;
  const brand = body.brand || null;
  const model = body.model || null;
  const serialNumber = body.serialNumber || null;
  const manufacturer = body.manufacturer || null;
  const service = body.service || null;
  const unit = body.unit || null;
  const location = body.location || null;
  const acquisitionDate = body.acquisitionDate || null;
  const provider = body.provider || null;
  const status = body.status || "operativo";
  const notes = body.notes || null;
  const changedBy = body.changedBy || "Usuario RPMS";

const { rows } = await sql`
INSERT INTO instruments (
code, name, type_id, brand, model, serial_number, manufacturer, service, unit, location, acquisition_date, provider, status, notes
) VALUES (
${code}, ${name}, ${typeId}, ${brand}, ${model}, ${serialNumber}, ${manufacturer}, ${service}, ${unit}, ${location}, ${acquisitionDate}, ${provider}, ${status}, ${notes}
)
RETURNING *
`;

const created = rows[0] as { id: number };

await sql`
INSERT INTO instrument_history (instrument_id, changed_by, field_name, old_value, new_value)
VALUES (${created.id}, ${changedBy}, 'creacion', NULL, ${"Instrumento creado: " + name})
`;

return NextResponse.json({ instrument: created });
}
