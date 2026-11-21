import { sql } from "@/lib/db";

export const SUPER_ADMIN_EMAIL = "tm.diego.solis@gmail.com";

let ensured = false;

export async function ensureAuthSchema() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      mfa_secret TEXT,
      mfa_enabled BOOLEAN NOT NULL DEFAULT false,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_single_super_admin_idx
    ON users (role) WHERE role = 'super_admin';
  `;

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
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    INSERT INTO users (email, role, status)
    VALUES (${SUPER_ADMIN_EMAIL}, 'super_admin', 'active')
    ON CONFLICT (email) DO NOTHING;
  `;

  await sql`
    INSERT INTO platform_settings (key, value)
    VALUES ('session_timeout_minutes', '30'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  `;

  ensured = true;
}

type LogAuditEntry = {
  actorEmail?: string | null;
  action: string;
  category?: string | null;
  details?: unknown;
  ipAddress?: string | null;
  success?: boolean;
};

export async function logAudit(entry: LogAuditEntry) {
  await ensureAuthSchema();
  const detailsJson = entry.details !== undefined ? JSON.stringify(entry.details) : null;
  await sql`
    INSERT INTO audit_logs (actor_email, action, category, details, ip_address, success)
    VALUES (
      ${entry.actorEmail ?? null},
      ${entry.action},
      ${entry.category ?? null},
      ${detailsJson}::jsonb,
      ${entry.ipAddress ?? null},
      ${entry.success ?? true}
    );
  `;
}
