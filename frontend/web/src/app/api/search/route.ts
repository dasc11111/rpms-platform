/**
 * API de búsqueda universal RPMS
 * Busca en: trabajadores, instrumentos, equipos, documentos, incidentes, I-131
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SearchResult {
  id: string;
  type: "worker" | "instrument" | "incident" | "document" | "i131" | "compliance";
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${q}%`;
  const results: SearchResult[] = [];

  // Workers
  const workers = await safeQuery(async () => {
    const { rows } = await sql.query(
      `SELECT id, name, rut, service, status
       FROM workers
       WHERE (name ILIKE $1 OR rut ILIKE $1 OR service ILIKE $1)
         AND status <> 'inactive'
       ORDER BY name ASC
       LIMIT 5`,
      [pattern]
    );
    return rows as Array<{ id: number; name: string; rut: string; service: string; status: string }>;
  }, []);

  for (const w of workers) {
    results.push({
      id: `worker-${w.id}`,
      type: "worker",
      title: w.name,
      subtitle: [w.service, w.rut].filter(Boolean).join(" · "),
      href: `/workers?id=${w.id}`,
      meta: w.status === "activo" ? "Activo" : w.status,
    });
  }

  // Instruments
  const instruments = await safeQuery(async () => {
    const { rows } = await sql.query(
      `SELECT id, code, name, model, location, status
       FROM instruments
       WHERE (code ILIKE $1 OR name ILIKE $1 OR model ILIKE $1 OR location ILIKE $1)
       ORDER BY name ASC
       LIMIT 5`,
      [pattern]
    );
    return rows as Array<{ id: number; code: string; name: string; model: string; location: string; status: string }>;
  }, []);

  for (const inst of instruments) {
    results.push({
      id: `instrument-${inst.id}`,
      type: "instrument",
      title: `${inst.name}${inst.model ? ` (${inst.model})` : ""}`,
      subtitle: [inst.code, inst.location].filter(Boolean).join(" · "),
      href: `/instruments?id=${inst.id}`,
      meta: inst.status,
    });
  }

  // Incidents
  const incidents = await safeQuery(async () => {
    const { rows } = await sql.query(
      `SELECT id, description, severity, status, event_date
       FROM nm_incidents
       WHERE description ILIKE $1 OR location ILIKE $1 OR person_involved ILIKE $1
       ORDER BY event_date DESC
       LIMIT 4`,
      [pattern]
    );
    return rows as Array<{ id: number; description: string; severity: string; status: string; event_date: string }>;
  }, []);

  for (const inc of incidents) {
    results.push({
      id: `incident-${inc.id}`,
      type: "incident",
      title: inc.description?.slice(0, 80) ?? `Incidente #${inc.id}`,
      subtitle: `${inc.event_date ? new Date(inc.event_date).toLocaleDateString("es-CL") : "Sin fecha"} · ${inc.severity ?? "—"}`,
      href: `/incidents?id=${inc.id}`,
      meta: inc.status,
    });
  }

  // Documents
  const documents = await safeQuery(async () => {
    const { rows } = await sql.query(
      `SELECT d.id, d.name, d.code, c.name as category_name
       FROM documents d
       LEFT JOIN document_categories c ON c.id = d.category_id
       WHERE d.name ILIKE $1 OR d.code ILIKE $1
       ORDER BY d.name ASC
       LIMIT 4`,
      [pattern]
    );
    return rows as Array<{ id: number; name: string; code: string; category_name: string }>;
  }, []);

  for (const doc of documents) {
    results.push({
      id: `doc-${doc.id}`,
      type: "document",
      title: doc.name,
      subtitle: [doc.code, doc.category_name].filter(Boolean).join(" · "),
      href: `/documents?id=${doc.id}`,
    });
  }

  // I-131 patients (last 90 days)
  const i131 = await safeQuery(async () => {
    const { rows } = await sql.query(
      `SELECT id, paciente_nombre, paciente_run, diagnostico, admin_date
       FROM i131_administrations
       WHERE (paciente_nombre ILIKE $1 OR paciente_run ILIKE $1 OR ficha_clinica ILIKE $1)
         AND admin_date >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY admin_date DESC
       LIMIT 4`,
      [pattern]
    );
    return rows as Array<{ id: number; paciente_nombre: string; paciente_run: string; diagnostico: string; admin_date: string }>;
  }, []);

  for (const p of i131) {
    results.push({
      id: `i131-${p.id}`,
      type: "i131",
      title: p.paciente_nombre ?? `Paciente #${p.id}`,
      subtitle: [p.paciente_run, p.diagnostico?.slice(0, 40)].filter(Boolean).join(" · "),
      href: `/i131?id=${p.id}`,
      meta: p.admin_date ? new Date(p.admin_date).toLocaleDateString("es-CL") : undefined,
    });
  }

  // Compliance requirements
  const compliance = await safeQuery(async () => {
    const { rows } = await sql.query(
      `SELECT id, code, requirement, status
       FROM compliance_requirements
       WHERE code ILIKE $1 OR requirement ILIKE $1
       ORDER BY code ASC
       LIMIT 3`,
      [pattern]
    );
    return rows as Array<{ id: number; code: string; requirement: string; status: string }>;
  }, []);

  for (const c of compliance) {
    results.push({
      id: `compliance-${c.id}`,
      type: "compliance",
      title: c.requirement?.slice(0, 80) ?? c.code,
      subtitle: c.code,
      href: `/compliance?id=${c.id}`,
      meta: c.status,
    });
  }

  return NextResponse.json({ results, query: q });
}
