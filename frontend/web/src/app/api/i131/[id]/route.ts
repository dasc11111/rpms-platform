import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { I131_SUGGESTION_FIELDS, buildAdminDate, buildDedupeKey } from "@/lib/i131";

export const dynamic = "force-dynamic";

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await sql`SELECT * FROM i131_administrations WHERE id = ${id}`;
  if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ row: rows[0] });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const { rows: currentRows } = await sql`SELECT * FROM i131_administrations WHERE id = ${id}`;
  const current = currentRows[0];
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const admin_year = Number(body.admin_year ?? current.admin_year);
  const admin_month = Number(body.admin_month ?? current.admin_month);
  const admin_day = Number(body.admin_day ?? current.admin_day);
  const paciente_nombre = (body.paciente_nombre ?? current.paciente_nombre ?? "").toString().trim();
  const radiofarmaco = (body.radiofarmaco ?? current.radiofarmaco ?? "I-131").toString().trim() || "I-131";

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
      SELECT id FROM i131_administrations
      WHERE admin_date = ${admin_date} AND lower(paciente_nombre) = lower(${paciente_nombre}) AND id <> ${id}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ duplicate: true, existing }, { status: 409 });
    }
  }

  const partida = body.partida ?? current.partida;
  const pedido_numero = body.pedido_numero ?? current.pedido_numero;
  const cantidad_solicitada = body.cantidad_solicitada ?? current.cantidad_solicitada;
  const paciente_run = body.paciente_run ?? current.paciente_run;
  const ficha_clinica = body.ficha_clinica ?? current.ficha_clinica;
  const prevision = body.prevision ?? current.prevision;
  const diagnostico = body.diagnostico ?? current.diagnostico;
  const medico_solicitante = body.medico_solicitante ?? current.medico_solicitante;
  const procedencia = body.procedencia ?? current.procedencia;
  const tipo_examen = body.tipo_examen ?? current.tipo_examen;
  const equipo = body.equipo ?? current.equipo;
  const motivo = body.motivo ?? current.motivo;
  const protocolo = body.protocolo ?? current.protocolo;
  const tasa_dosis = body.tasa_dosis ?? current.tasa_dosis;
  const dosis_administrada = body.dosis_administrada ?? current.dosis_administrada;
  const notas = body.notas ?? current.notas;

  const dedupeKey = buildDedupeKey({
    admin_date,
    ficha_clinica,
    paciente_nombre,
    dosis_administrada,
    partida,
  });

  const { rows } = await sql`
    UPDATE i131_administrations SET
      admin_year = ${admin_year},
      admin_month = ${admin_month},
      admin_day = ${admin_day},
      admin_date = ${admin_date},
      partida = ${partida},
      pedido_numero = ${pedido_numero},
      radiofarmaco = ${radiofarmaco},
      cantidad_solicitada = ${cantidad_solicitada},
      paciente_nombre = ${paciente_nombre},
      paciente_run = ${paciente_run},
      ficha_clinica = ${ficha_clinica},
      prevision = ${prevision},
      diagnostico = ${diagnostico},
      medico_solicitante = ${medico_solicitante},
      procedencia = ${procedencia},
      tipo_examen = ${tipo_examen},
      equipo = ${equipo},
      motivo = ${motivo},
      protocolo = ${protocolo},
      tasa_dosis = ${tasa_dosis},
      dosis_administrada = ${dosis_administrada},
      notas = ${notas},
      dedupe_key = ${dedupeKey},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  await upsertSuggestions({
    radiofarmaco,
    medico_solicitante,
    procedencia,
    diagnostico,
    protocolo,
    equipo,
    motivo,
    tipo_examen,
    prevision,
    paciente_nombre,
  });

  return NextResponse.json({ row: rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await sql`DELETE FROM i131_administrations WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
