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
    sala: "sala",
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
    "sala",
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
                              dosis_administrada, responsable, notas, dedupe_key,
                                    tipo_procedimiento, identidad_confirmada, embarazo_descartado, fecha_test_embarazo,
                                          lactancia_consultada, segunda_verificacion_responsable, bloqueo_tiroideo_considerado,
                                                actividad_dentro_tolerancia, informacion_radioproteccion_entregada, sala
                                                    ) VALUES (
                                                          ${admin_year}, ${admin_month}, ${admin_day}, ${admin_date}, ${body.partida ?? null}, ${body.pedido_numero ?? null}, ${radiofarmaco},
                                                                ${body.cantidad_solicitada ?? null}, ${paciente_nombre}, ${body.paciente_run ?? null}, ${body.ficha_clinica ?? null}, ${body.prevision ?? null}, ${body.diagnostico ?? null},
                                                                      ${body.medico_solicitante ?? null}, ${body.procedencia ?? null}, ${body.tipo_examen ?? null}, ${body.equipo ?? null}, ${body.motivo ?? null}, ${body.protocolo ?? null}, ${body.tasa_dosis ?? null},
                                                                            ${body.dosis_administrada ?? null}, ${RESPONSABLE_FIJO}, ${body.notas ?? null}, ${dedupeKey},
                                                                                  ${body.tipo_procedimiento ?? null}, ${body.identidad_confirmada ?? null}, ${body.embarazo_descartado ?? null}, ${body.fecha_test_embarazo ?? null},
                                                                                        ${body.lactancia_consultada ?? null}, ${body.segunda_verificacion_responsable ?? null}, ${body.bloqueo_tiroideo_considerado ?? null},
                                                                                              ${body.actividad_dentro_tolerancia ?? null}, ${body.informacion_radioproteccion_entregada ?? null}, ${body.sala ?? null}
                                                                                                  )
                                                                                                      RETURNING *
                                                                                                        `;

  await upsertSuggestions({ ...body, paciente_nombre, radiofarmaco });

  return NextResponse.json({ row: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`
      UPDATE i131_administrations SET
        admin_date              = COALESCE(${(fields.admin_date as string) ?? null}::timestamptz, admin_date),
        paciente_nombre         = COALESCE(${(fields.paciente_nombre as string) ?? null}, paciente_nombre),
        paciente_run            = COALESCE(${(fields.paciente_run as string) ?? null}, paciente_run),
        ficha_clinica           = COALESCE(${(fields.ficha_clinica as string) ?? null}, ficha_clinica),
        radiofarmaco            = COALESCE(${(fields.radiofarmaco as string) ?? null}, radiofarmaco),
        diagnostico             = COALESCE(${(fields.diagnostico as string) ?? null}, diagnostico),
        tipo_examen             = COALESCE(${(fields.tipo_examen as string) ?? null}, tipo_examen),
        medico_solicitante      = COALESCE(${(fields.medico_solicitante as string) ?? null}, medico_solicitante),
        dosis_administrada      = COALESCE(${fields.dosis_administrada != null ? Number(fields.dosis_administrada) : null}, dosis_administrada),
        tasa_dosis              = COALESCE(${fields.tasa_dosis != null ? Number(fields.tasa_dosis) : null}, tasa_dosis),
        responsable             = COALESCE(${(fields.responsable as string) ?? null}, responsable),
        notas                   = COALESCE(${(fields.notas as string) ?? null}, notas),
        tipo_procedimiento      = COALESCE(${(fields.tipo_procedimiento as string) ?? null}, tipo_procedimiento),
        identidad_confirmada    = COALESCE(${fields.identidad_confirmada != null ? Boolean(fields.identidad_confirmada) : null}, identidad_confirmada),
        embarazo_descartado     = COALESCE(${fields.embarazo_descartado != null ? Boolean(fields.embarazo_descartado) : null}, embarazo_descartado),
        updated_at              = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ error: "Administración no encontrada" }, { status: 404 });
    return NextResponse.json({ row: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await sql`DELETE FROM i131_administrations WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
