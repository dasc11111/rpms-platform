import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  I131_SUGGESTION_FIELDS,
  RESPONSABLE_FIJO,
  buildAdminDate,
  buildDedupeKey,
} from "@/lib/i131";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: Record<string, string> = {
  paciente: "paciente_nombre",
  run: "paciente_run",
  radiofarmaco: "radiofarmaco",
  medico_solicitante: "medico_solicitante",
  procedencia: "procedencia",
  diagnostico: "diagnostico",
  tipo_examen: "tipo_examen",
  equipo: "equipo",
  motivo: "motivo",
  protocolo: "protocolo",
  prevision: "prevision",
  ficha_clinica: "ficha_clinica",
  partida: "partida",
  pedido_numero: "pedido_numero",
};

const SORTABLE = new Set([
  "admin_date",
  "paciente_nombre",
  "radiofarmaco",
  "dosis_administrada",
  "cantidad_solicitada",
  "diagnostico",
  "ficha_clinica",
  "created_at",
  "prevision",
  "medico_solicitante",
  "procedencia",
  "tipo_examen",
  "equipo",
]);

function buildFilters(searchParams: URLSearchParams) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, column] of Object.entries(FILTER_FIELDS)) {
    const val = searchParams.get(key);
    if (val) {
      params.push(`%${val}%`);
      conditions.push(`${column} ILIKE $${params.length}`);
    }
  }

  const year = searchParams.get("year");
  if (year) {
    params.push(Number(year));
    conditions.push(`admin_year = $${params.length}`);
  }
  const month = searchParams.get("month");
  if (month) {
    params.push(Number(month));
    conditions.push(`admin_month = $${params.length}`);
  }
  const day = searchParams.get("day");
  if (day) {
    params.push(Number(day));
    conditions.push(`admin_day = $${params.length}`);
  }

  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`admin_date >= $${params.length}`);
  }
  const dateTo = searchParams.get("dateTo");
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`admin_date <= $${params.length}`);
  }

  const q = searchParams.get("q");
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    conditions.push(
      `(paciente_nombre ILIKE $${idx} OR ficha_clinica ILIKE $${idx} OR paciente_run ILIKE $${idx} OR pedido_numero ILIKE $${idx} OR partida ILIKE $${idx})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { where, params } = buildFilters(searchParams);

  const sortField = searchParams.get("sort") ?? "admin_date";
  const sortCol = SORTABLE.has(sortField) ? sortField : "admin_date";
  const dir = searchParams.get("dir") === "asc" ? "ASC" : "DESC";

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));
  const offset = (page - 1) * pageSize;

  const countQuery = `SELECT COUNT(*)::int AS count FROM i131_administrations ${where}`;
  const { rows: countRows } = await sql.query(countQuery, params);
  const total = countRows[0]?.count ?? 0;

  const dataParams = [...params, pageSize, offset];
  const dataQuery = `
    SELECT * FROM i131_administrations
    ${where}
    ORDER BY ${sortCol} ${dir}, id ${dir}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const { rows } = await sql.query(dataQuery, dataParams);

  return NextResponse.json({ rows, total, page, pageSize });
}

async function upsertSuggestions(body: Record<string, unknown>) {
  for (const field of I131_SUGGESTION_FIELDS) {
    const value = body[field];
    if (typeof value === "string" && value.trim()) {
      await sql`
        INSERT INTO i131_field_suggestions (field_name, value, usage_count, last_used_at)
        VALUES (${field}, ${value.trim()}, 1, now())
        ON CONFLICT (field_name, value) DO UPDATE SET
          usage_count = i131_field_suggestions.usage_count + 1,
          last_used_at = now()
      `;
    }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const admin_year = Number(body.admin_year);
  const admin_month = Number(body.admin_month);
  const admin_day = Number(body.admin_day);
  const paciente_nombre = (body.paciente_nombre ?? "").toString().trim();
  const radiofarmaco = (body.radiofarmaco ?? "I-131").toString().trim() || "I-131";

  const errors: string[] = [];
  if (!admin_year || admin_year < 2000 || admin_year > 2100) errors.push("Año inválido");
  if (!admin_month || admin_month < 1 || admin_month > 12) errors.push("Mes inválido");
  if (!admin_day || admin_day < 1 || admin_day > 31) errors.push("Día inválido");
  if (!paciente_nombre) errors.push("El nombre del paciente es obligatorio");
  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  const admin_date = buildAdminDate(admin_year, admin_month, admin_day);

  if (!body.force) {
    const { rows: existing } = await sql`
      SELECT id, admin_date, paciente_nombre, dosis_administrada, radiofarmaco
      FROM i131_administrations
      WHERE admin_date = ${admin_date} AND lower(paciente_nombre) = lower(${paciente_nombre})
    `;
    if (existing.length > 0) {
      return NextResponse.json({ duplicate: true, existing }, { status: 409 });
    }
  }

  const dedupeKey =
    buildDedupeKey({
      admin_date,
      ficha_clinica: body.ficha_clinica ?? null,
      paciente_nombre,
      dosis_administrada: body.dosis_administrada ?? null,
      partida: body.partida ?? null,
    }) + (body.force ? `|${Date.now()}` : "");

  const { rows } = await sql`
    INSERT INTO i131_administrations (
      admin_year, admin_month, admin_day, admin_date, partida, pedido_numero, radiofarmaco,
      cantidad_solicitada, paciente_nombre, paciente_run, ficha_clinica, prevision, diagnostico,
      medico_solicitante, procedencia, tipo_examen, equipo, motivo, protocolo, tasa_dosis,
      dosis_administrada, responsable, notas, dedupe_key
    ) VALUES (
      ${admin_year}, ${admin_month}, ${admin_day}, ${admin_date}, ${body.partida ?? null}, ${body.pedido_numero ?? null}, ${radiofarmaco},
      ${body.cantidad_solicitada ?? null}, ${paciente_nombre}, ${body.paciente_run ?? null}, ${body.ficha_clinica ?? null}, ${body.prevision ?? null}, ${body.diagnostico ?? null},
      ${body.medico_solicitante ?? null}, ${body.procedencia ?? null}, ${body.tipo_examen ?? null}, ${body.equipo ?? null}, ${body.motivo ?? null}, ${body.protocolo ?? null}, ${body.tasa_dosis ?? null},
      ${body.dosis_administrada ?? null}, ${RESPONSABLE_FIJO}, ${body.notas ?? null}, ${dedupeKey}
    )
    RETURNING *
  `;

  await upsertSuggestions({ ...body, paciente_nombre, radiofarmaco });

  return NextResponse.json({ row: rows[0] }, { status: 201 });
}
