import { sql } from "@/lib/db";

let ensured = false;

export async function ensureAcceptanceTables() {
    if (ensured) return;

  await sql`
      CREATE TABLE IF NOT EXISTS linac_acceptance_protocols (
            id SERIAL PRIMARY KEY,
                  manufacturer TEXT NOT NULL,
                        model TEXT NOT NULL,
                              protocol_name TEXT NOT NULL,
                                    applicable_norms TEXT,
                                          items JSONB NOT NULL DEFAULT '[]',
                                                created_by TEXT,
                                                      status TEXT NOT NULL DEFAULT 'activo',
                                                            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                                                );
                                                                  `;

await sql`
CREATE TABLE IF NOT EXISTS linac_acceptance_tests (
id SERIAL PRIMARY KEY,
linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
protocol_id INTEGER REFERENCES linac_acceptance_protocols(id) ON DELETE SET NULL,
version INTEGER NOT NULL DEFAULT 1,
is_current BOOLEAN NOT NULL DEFAULT true,
supersedes_id INTEGER,
test_date DATE NOT NULL,
performed_by TEXT,
company TEXT,
results JSONB NOT NULL DEFAULT '[]',
overall_result TEXT NOT NULL DEFAULT 'cumple',
observations TEXT,
signed_by TEXT,
signed_at TIMESTAMPTZ,
status TEXT NOT NULL DEFAULT 'activo',
created_by TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`
CREATE TABLE IF NOT EXISTS linac_acceptance_documents (
id SERIAL PRIMARY KEY,
acceptance_test_id INTEGER REFERENCES linac_acceptance_tests(id) ON DELETE CASCADE,
category TEXT NOT NULL DEFAULT 'informe',
title TEXT,
file_name TEXT,
blob_url TEXT,
mime_type TEXT,
size_bytes INTEGER,
ocr_text TEXT,
uploaded_by TEXT,
uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

ensured = true;
}

export const ACCEPTANCE_DOC_CATEGORIES = [
  { value: "informe", label: "Informe tecnico" },
  { value: "certificado", label: "Certificado" },
  { value: "fotografia", label: "Fotografia" },
  { value: "otro", label: "Otro" },
  ];

export const ACCEPTANCE_RESULT_OPTIONS = [
  { value: "cumple", label: "Cumple" },
  { value: "cumple_observaciones", label: "Cumple con observaciones" },
  { value: "no_cumple", label: "No cumple" },
  ];

export function evaluateItemResult(measuredValue: any, specification: any, tolerance: any): string | null {
  if (measuredValue === undefined || measuredValue === null || measuredValue === "") return null;
  const measured = Number(String(measuredValue).replace(",", "."));
  if (Number.isNaN(measured)) return null;
  const spec = specification !== undefined && specification !== null && specification !== ""
  ? Number(String(specification).replace(",", "."))
    : null;
  const tol = (tolerance || "").toString().trim();
  if (!tol) return null;

const plusMinus = tol.match(/^(?:\u00b1|\+\/-|\+-)\s*([\d.,]+)\s*%?$/);
  if (plusMinus && spec !== null && !Number.isNaN(spec)) {
    const delta = Number(plusMinus[1].replace(",", "."));
    const isPercent = tol.includes("%");
    const margin = isPercent ? Math.abs(spec) * (delta / 100) : delta;
    return Math.abs(measured - spec) <= margin ? "cumple" : "no_cumple";
  }

const range = tol.match(/^(-?[\d.,]+)\s*(?:-|a)\s*(-?[\d.,]+)$/);
  if (range) {
    const lo = Number(range[1].replace(",", "."));
    const hi = Number(range[2].replace(",", "."));
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
      return measured >= Math.min(lo, hi) && measured <= Math.max(lo, hi) ? "cumple" : "no_cumple";
    }
  }

const gte = tol.match(/^>=\s*([\d.,]+)$/);
  if (gte) return measured >= Number(gte[1].replace(",", ".")) ? "cumple" : "no_cumple";
  const lte = tol.match(/^<=\s*([\d.,]+)$/);
  if (lte) return measured <= Number(lte[1].replace(",", ".")) ? "cumple" : "no_cumple";

return null;
}

export function computeOverallResult(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return "cumple";
  if (items.some((it) => it.result === "no_cumple")) return "no_cumple";
  if (items.some((it) => it.result === "cumple_observaciones" || (it.comment && String(it.comment).trim()))) {
    return "cumple_observaciones";
  }
  return "cumple";
}

export async function logAcceptanceAudit(action: string, actorEmail: string | null, details: any) {
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
    VALUES (${actorEmail}, ${action}, 'linac_acceptance', ${JSON.stringify(details || {})}::jsonb)
    `;
  } catch (err) {
    console.error("logAcceptanceAudit failed", err);
  }
}
