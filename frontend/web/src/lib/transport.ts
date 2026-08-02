import { sql } from "@/lib/db";

export const DOSE_LIMIT_1M = 100; // uSv/h
export const DOSE_LIMIT_VEHICLE = 2000; // uSv/h

export const AUTH_ALERT_LEVELS = [
  { min: 180, level: "verde", label: "Vigente" },
  { min: 120, level: "amarillo", label: "Por vencer (120-180 dias)" },
  { min: 90, level: "naranjo", label: "Proxima a vencer (90-120 dias)" },
  { min: -Infinity, level: "rojo", label: "Critica / vencida (< 90 dias)" },
] as const;

export type AuthAlertLevel = "verde" | "amarillo" | "naranjo" | "rojo";

export function getAuthAlertLevel(daysRemaining: number | null): AuthAlertLevel {
  if (daysRemaining === null || Number.isNaN(daysRemaining)) return "rojo";
  if (daysRemaining >= 180) return "verde";
  if (daysRemaining >= 120) return "amarillo";
  if (daysRemaining >= 90) return "naranjo";
  return "rojo";
}

export const MATERIAL_LABELS: Record<string, string> = {
  MO_TC99: "Generador Mo-99/Tc-99m",
  I131: "I-131",
};

let ensured = false;

export async function ensureTransportTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS transport_radionuclides (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      activity_label TEXT NOT NULL,
      allows_multiple BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transport_drivers (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      company TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transport_oprs (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transport_shipments (
      id SERIAL PRIMARY KEY,
      transport_date DATE NOT NULL,
      correlative_number INTEGER NOT NULL,
      it_value NUMERIC,
      dose_contact NUMERIC,
      dose_1m NUMERIC,
      dose_vehicle NUMERIC,
      material_code TEXT NOT NULL,
      requested_activity_mci NUMERIC,
      driver_name TEXT,
      opr_name TEXT,
      signage_dosimeter BOOLEAN NOT NULL DEFAULT false,
      signage_radiactivo7 BOOLEAN NOT NULL DEFAULT false,
      signage_nu2915 BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transport_i131_activities (
      id SERIAL PRIMARY KEY,
      shipment_id INTEGER NOT NULL REFERENCES transport_shipments(id) ON DELETE CASCADE,
      label TEXT,
      activity_mci NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transport_dispatch_documents (
      id SERIAL PRIMARY KEY,
      transport_date DATE NOT NULL,
      file_name TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      is_current BOOLEAN NOT NULL DEFAULT true,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transport_authorization_documents (
      id SERIAL PRIMARY KEY,
      number TEXT,
      issued_date DATE,
      expiry_date DATE,
      file_name TEXT,
      blob_url TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      is_current BOOLEAN NOT NULL DEFAULT true,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    INSERT INTO transport_radionuclides (code, label, activity_label, allows_multiple)
    VALUES
      ('MO_TC99', 'Generador Mo-99/Tc-99m', 'Actividad solicitada (mCi)', false),
      ('I131', 'I-131', 'Actividad total transportada (mCi)', true)
    ON CONFLICT (code) DO NOTHING;
  `;

  ensured = true;
}

export async function logTransportAudit(
  action: string,
  actorEmail: string | null,
  details: Record<string, unknown>
) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        actor_email TEXT,
        action TEXT NOT NULL,
        category TEXT,
        details JSONB,
        ip_address TEXT,
        success BOOLEAN NOT NULL DEFAULT true
      );
    `;
    await sql`
      INSERT INTO audit_logs (actor_email, action, category, details)
      VALUES (${actorEmail}, ${action}, 'transporte_material_radiactivo', ${JSON.stringify(details)}::jsonb)
    `;
  } catch {
    // El historial de auditoria nunca debe interrumpir la operacion principal.
  }
}

export function computeShipmentAlerts(row: {
  dose_1m: number | null;
  dose_vehicle: number | null;
  signage_dosimeter: boolean;
  signage_radiactivo7: boolean;
  signage_nu2915: boolean;
  driver_name: string | null;
  opr_name: string | null;
}): string[] {
  const alerts: string[] = [];
  if (row.dose_1m !== null && row.dose_1m > DOSE_LIMIT_1M) alerts.push("dose_1m_exceeded");
  if (row.dose_vehicle !== null && row.dose_vehicle > DOSE_LIMIT_VEHICLE) alerts.push("dose_vehicle_exceeded");
  if (!row.signage_dosimeter) alerts.push("missing_dosimeter");
  if (!row.signage_radiactivo7) alerts.push("missing_radiactivo7");
  if (!row.signage_nu2915) alerts.push("missing_nu2915");
  if (!row.driver_name) alerts.push("missing_driver");
  if (!row.opr_name) alerts.push("missing_opr");
  return alerts;
}

export async function nextCorrelativeNumber(): Promise<number> {
  const { rows } = await sql`SELECT COALESCE(MAX(correlative_number), 0) + 1 AS next FROM transport_shipments`;
  return Number(rows[0]?.next ?? 1);
}
