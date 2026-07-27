import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRoomClearanceSchema } from "@/lib/room-clearance-db";
import {
  RC_RADIONUCLIDOS,
  RC_LABORATORIO_PUNTOS,
  RC_SALA_PACIENTES_PUNTOS,
  RC_VERSION_FORMULARIO,
  evaluarPuntoRoomClearance,
  calcularResumenArea,
  type RcPointInput,
  type RcLimite,
} from "@/lib/room-clearance";

export const dynamic = "force-dynamic";

async function getLimite(radionuclido: string): Promise<RcLimite | null> {
  const { rows } = await sql`
    SELECT limite_bq_m2, pct_registro, pct_investigacion, pct_intervencion
    FROM contamination_limits WHERE radionuclido = ${radionuclido}
  `;
  if (rows[0]) return rows[0] as unknown as RcLimite;
  const { rows: fallback } = await sql`
    SELECT limite_bq_m2, pct_registro, pct_investigacion, pct_intervencion
    FROM contamination_limits WHERE radionuclido = 'GENERICO'
  `;
  return (fallback[0] as unknown as RcLimite) ?? null;
}

function parsePoints(input: unknown, expectedPuntos: readonly string[]): RcPointInput[] {
  const arr = Array.isArray(input) ? input : [];
  return expectedPuntos.map((punto) => {
    const found = arr.find(
      (p: any) => (p?.punto ?? "").toString().trim().toLowerCase() === punto.toLowerCase()
    );
    return {
      punto,
      cps_medida: Number(found?.cps_medida ?? 0) || 0,
      cps_fondo: Number(found?.cps_fondo ?? 0) || 0,
      tasa_dosis_usv_h:
        found?.tasa_dosis_usv_h !== undefined && found?.tasa_dosis_usv_h !== null && found?.tasa_dosis_usv_h !== ""
          ? Number(found.tasa_dosis_usv_h)
          : null,
    };
  });
}

const FILTERABLE_ESTADOS = new Set([
  "conforme",
  "requiere_descontaminacion",
  "liberado",
  "no_liberado",
]);

export async function GET(req: NextRequest) {
  await ensureRoomClearanceSchema();
  const { searchParams } = new URL(req.url);
  const conditions: string[] = [];
  const params: unknown[] = [];

  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`eval_date >= $${params.length}`);
  }
  const dateTo = searchParams.get("dateTo");
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`eval_date <= $${params.length}`);
  }
  const responsable = searchParams.get("responsable");
  if (responsable) {
    params.push(`%${responsable}%`);
    conditions.push(`responsable ILIKE $${params.length}`);
  }
  const radionuclido = searchParams.get("radionuclido");
  if (radionuclido) {
    params.push(radionuclido);
    conditions.push(`radionuclido = $${params.length}`);
  }
  const estadoLaboratorio = searchParams.get("estadoLaboratorio");
  if (estadoLaboratorio && FILTERABLE_ESTADOS.has(estadoLaboratorio)) {
    params.push(estadoLaboratorio);
    conditions.push(`estado_general_laboratorio = $${params.length}`);
  }
  const estadoSala = searchParams.get("estadoSala");
  if (estadoSala && FILTERABLE_ESTADOS.has(estadoSala)) {
    params.push(estadoSala);
    conditions.push(`estado_general_sala = $${params.length}`);
  }
  const q = searchParams.get("q");
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(responsable ILIKE $${params.length} OR observaciones_generales ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "30")));
  const offset = (page - 1) * pageSize;

  const { rows: countRows } = await sql.query(
    `SELECT COUNT(*)::int AS count FROM room_clearance_evaluations ${where}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  const dataParams = [...params, pageSize, offset];
  const { rows } = await sql.query(
    `SELECT * FROM room_clearance_evaluations ${where} ORDER BY eval_date DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  return NextResponse.json({ rows, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  await ensureRoomClearanceSchema();
  const body = await req.json().catch(() => ({}));

  const eval_date = (body.eval_date ?? "").toString().trim();
  const responsable = (body.responsable ?? "").toString().trim();
  const radionuclido = (body.radionuclido ?? "TC-99M").toString().trim().toUpperCase() || "TC-99M";
  const instrumento_utilizado = body.instrumento_utilizado ? String(body.instrumento_utilizado).trim() : null;
  const observaciones_generales = body.observaciones_generales ? String(body.observaciones_generales).trim() : null;
  const usuario = body.usuario ? String(body.usuario).trim() : responsable || null;

  const errors: string[] = [];
  if (!eval_date) errors.push("La fecha es obligatoria");
  if (!responsable) errors.push("El responsable de la medición es obligatorio");
  if (!(RC_RADIONUCLIDOS as readonly string[]).includes(radionuclido)) errors.push("Radioisótopo inválido");
  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  const limite = await getLimite(radionuclido);

  const laboratorioInputs = parsePoints(body.laboratorio, RC_LABORATORIO_PUNTOS);
  const salaInputs = parsePoints(body.sala_pacientes, RC_SALA_PACIENTES_PUNTOS);

  const laboratorioResultados = laboratorioInputs.map((p) => evaluarPuntoRoomClearance(p, limite));
  const salaResultados = salaInputs.map((p) => evaluarPuntoRoomClearance(p, limite));

  const resumenLaboratorio = calcularResumenArea(laboratorioResultados, Boolean(body.limpieza_realizada_laboratorio));
  const resumenSala = calcularResumenArea(salaResultados, Boolean(body.limpieza_realizada_sala));

  const { rows } = await sql`
    INSERT INTO room_clearance_evaluations (
      eval_date, responsable, radionuclido, instrumento_utilizado, observaciones_generales,
      estado_general_laboratorio, resumen_laboratorio, estado_general_sala, resumen_sala,
      usuario, version_formulario
    ) VALUES (
      ${eval_date}, ${responsable}, ${radionuclido}, ${instrumento_utilizado}, ${observaciones_generales},
      ${resumenLaboratorio.estado_general}, ${JSON.stringify(resumenLaboratorio)}, ${resumenSala.estado_general}, ${JSON.stringify(resumenSala)},
      ${usuario}, ${RC_VERSION_FORMULARIO}
    )
    RETURNING *
  `;
  const evaluation = rows[0]!;

  const allPoints = [
    ...laboratorioResultados.map((p) => ({ ...p, area_tipo: "laboratorio" as const })),
    ...salaResultados.map((p) => ({ ...p, area_tipo: "sala_pacientes" as const })),
  ];

  for (const p of allPoints) {
    await sql`
      INSERT INTO room_clearance_points (
        evaluation_id, area_tipo, punto, cps_medida, cps_fondo, tasa_dosis_usv_h,
        cps_neto, bq_cm2, bq_m2, pct_limite, clasificacion, semaforo, cumple
      ) VALUES (
        ${evaluation.id}, ${p.area_tipo}, ${p.punto}, ${p.cps_medida}, ${p.cps_fondo}, ${p.tasa_dosis_usv_h},
        ${p.cps_neto}, ${p.bq_cm2}, ${p.bq_m2}, ${p.pct_limite}, ${p.clasificacion}, ${p.semaforo}, ${p.cumple}
      )
    `;
  }

  for (const [field, value] of [
    ["responsable", responsable],
    ["instrumento", instrumento_utilizado],
  ] as const) {
    if (value) {
      await sql`
        INSERT INTO contamination_field_suggestions (field_name, value, usage_count, last_used_at)
        VALUES (${field}, ${value}, 1, now())
        ON CONFLICT (field_name, value) DO UPDATE SET
          usage_count = contamination_field_suggestions.usage_count + 1,
          last_used_at = now()
      `;
    }
  }

  return NextResponse.json({ row: evaluation, points: allPoints }, { status: 201 });
}
