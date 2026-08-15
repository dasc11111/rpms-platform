import { sql } from "@/lib/db";

let ensured = false;

export async function ensureRiskExtendedTables() {
  if (ensured) return;
  await sql`ALTER TABLE linac_risks ADD COLUMN IF NOT EXISTS evidence TEXT`;
  await sql`ALTER TABLE linac_risks ADD COLUMN IF NOT EXISTS controls TEXT`;
  await sql`ALTER TABLE linac_risks ADD COLUMN IF NOT EXISTS event_type TEXT`;
  await sql`ALTER TABLE linac_risks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'abierto'`;
  await sql`ALTER TABLE linac_risks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE linac_risks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
  ensured = true;
}

export function classifyRiskLevel(level: number | null | undefined): { label: string; cls: string; bg: string } {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 0) return { label: "Sin clasificar", cls: "text-muted-foreground", bg: "bg-muted" };
  if (n <= 4) return { label: "Bajo", cls: "text-success", bg: "bg-success" };
  if (n <= 9) return { label: "Moderado", cls: "text-warning", bg: "bg-warning" };
  if (n <= 15) return { label: "Alto", cls: "text-orange-500", bg: "bg-orange-500" };
  return { label: "Muy alto", cls: "text-danger", bg: "bg-danger" };
}

export async function logRiskAudit(action: string, actorEmail: string | null, details: any) {
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
    VALUES (${actorEmail}, ${action}, 'linac_risk', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logRiskAudit failed", err);
  }
}
