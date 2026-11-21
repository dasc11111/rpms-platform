/**
 * API — Ajustes de Notificaciones
 * GET: retorna configuración actual
 * POST: guarda configuración (upsert en notification_settings)
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      email_enabled BOOLEAN NOT NULL DEFAULT false,
      email_address TEXT NOT NULL DEFAULT '',
      alert_dosimetry_overdue BOOLEAN NOT NULL DEFAULT true,
      alert_dosimetry_days_before INTEGER NOT NULL DEFAULT 7,
      alert_worker_auth_expiry BOOLEAN NOT NULL DEFAULT true,
      alert_worker_auth_days_before INTEGER NOT NULL DEFAULT 30,
      alert_calibration_expiry BOOLEAN NOT NULL DEFAULT true,
      alert_calibration_days_before INTEGER NOT NULL DEFAULT 30,
      alert_equipment_auth_expiry BOOLEAN NOT NULL DEFAULT true,
      alert_equipment_auth_days_before INTEGER NOT NULL DEFAULT 30,
      alert_incidents_grave BOOLEAN NOT NULL DEFAULT true,
      alert_compliance_vencido BOOLEAN NOT NULL DEFAULT true,
      alert_waste_pending BOOLEAN NOT NULL DEFAULT true,
      platform_notifications BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function GET() {
  try {
    await ensureTable();
    const { rows } = await sql`SELECT * FROM notification_settings WHERE id = 1`;
    if (rows.length === 0) {
      return NextResponse.json({
        email_enabled: false,
        email_address: "",
        alert_dosimetry_overdue: true,
        alert_dosimetry_days_before: 7,
        alert_worker_auth_expiry: true,
        alert_worker_auth_days_before: 30,
        alert_calibration_expiry: true,
        alert_calibration_days_before: 30,
        alert_equipment_auth_expiry: true,
        alert_equipment_auth_days_before: 30,
        alert_incidents_grave: true,
        alert_compliance_vencido: true,
        alert_waste_pending: true,
        platform_notifications: true,
      });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("GET /api/settings/notifications", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();

    const {
      email_enabled = false,
      email_address = "",
      alert_dosimetry_overdue = true,
      alert_dosimetry_days_before = 7,
      alert_worker_auth_expiry = true,
      alert_worker_auth_days_before = 30,
      alert_calibration_expiry = true,
      alert_calibration_days_before = 30,
      alert_equipment_auth_expiry = true,
      alert_equipment_auth_days_before = 30,
      alert_incidents_grave = true,
      alert_compliance_vencido = true,
      alert_waste_pending = true,
      platform_notifications = true,
    } = body;

    await sql`
      INSERT INTO notification_settings (
        id,
        email_enabled, email_address,
        alert_dosimetry_overdue, alert_dosimetry_days_before,
        alert_worker_auth_expiry, alert_worker_auth_days_before,
        alert_calibration_expiry, alert_calibration_days_before,
        alert_equipment_auth_expiry, alert_equipment_auth_days_before,
        alert_incidents_grave, alert_compliance_vencido, alert_waste_pending,
        platform_notifications, updated_at
      ) VALUES (
        1,
        ${email_enabled}, ${email_address},
        ${alert_dosimetry_overdue}, ${alert_dosimetry_days_before},
        ${alert_worker_auth_expiry}, ${alert_worker_auth_days_before},
        ${alert_calibration_expiry}, ${alert_calibration_days_before},
        ${alert_equipment_auth_expiry}, ${alert_equipment_auth_days_before},
        ${alert_incidents_grave}, ${alert_compliance_vencido}, ${alert_waste_pending},
        ${platform_notifications}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        email_enabled = EXCLUDED.email_enabled,
        email_address = EXCLUDED.email_address,
        alert_dosimetry_overdue = EXCLUDED.alert_dosimetry_overdue,
        alert_dosimetry_days_before = EXCLUDED.alert_dosimetry_days_before,
        alert_worker_auth_expiry = EXCLUDED.alert_worker_auth_expiry,
        alert_worker_auth_days_before = EXCLUDED.alert_worker_auth_days_before,
        alert_calibration_expiry = EXCLUDED.alert_calibration_expiry,
        alert_calibration_days_before = EXCLUDED.alert_calibration_days_before,
        alert_equipment_auth_expiry = EXCLUDED.alert_equipment_auth_expiry,
        alert_equipment_auth_days_before = EXCLUDED.alert_equipment_auth_days_before,
        alert_incidents_grave = EXCLUDED.alert_incidents_grave,
        alert_compliance_vencido = EXCLUDED.alert_compliance_vencido,
        alert_waste_pending = EXCLUDED.alert_waste_pending,
        platform_notifications = EXCLUDED.platform_notifications,
        updated_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/settings/notifications", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
