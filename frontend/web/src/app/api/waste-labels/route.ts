import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { formatWasteLabelNumber, estimateResidualActivity, daysBetween } from "@/lib/waste";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: Record<string, string> = {
  service: "service",
  sala: "sala",
  radionuclide: "radionuclide_code",
  status: "status",
};

const SORTABLE = new Set([
  "generation_date",
  "label_number",
  "service",
  "sala",
  "status",
  "created_at",
]);

function buildFilters(searchParams: URLSearchParams) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, column] of Object.entries(FILTER_FIELDS)) {
    const val = searchParams.get(key);
    if (val) {
      params.push(val);
      conditions.push(`${column} = $${params.length}`);
    }
  }

  const year = searchParams.get("year");
  if (year) {
    params.push(Number(year));
    conditions.push(`label_year = $${params.length}`);
  }

  const q = searchParams.get("q");
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    conditions.push(
      `(label_number ILIKE $${idx} OR paciente_nombre ILIKE $${idx} OR sala ILIKE $${idx} OR service ILIKE $${idx})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { where, params } = buildFilters(searchParams);

  const sortField = searchParams.get("sort") ?? "generation_date";
  const sortCol = SORTABLE.has(sortField) ? sortField : "generation_date";
  const dir = searchParams.get("dir") === "asc" ? "ASC" : "DESC";

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));
  const offset = (page - 1) * pageSize;

  const countQuery = `SELECT COUNT(*)::int AS count FROM radioactive_waste_labels ${where}`;
  const { rows: countRows } = await sql.query(countQuery, params);
  const total = countRows[0]?.count ?? 0;

  const dataParams = [...params, pageSize, offset];
  const dataQuery = `
    SELECT * FROM radioactive_waste_labels
    ${where}
    ORDER BY ${sortCol} ${dir}, id ${dir}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const { rows } = await sql.query(dataQuery, dataParams);

  return NextResponse.json({ rows, total, page, pageSize });
}

// Genera automaticamente un rotulo de Gestion de Residuos Radiactivos a partir
// de un Acta de Liberacion de Sala ya guardada (room_release_id). Toda la
// informacion se reutiliza desde ese registro: no se vuelve a solicitar nada
// ya ingresado. El numero correlativo (GRR-AAAA-NNNNNN) se reserva de forma
// atomica y nunca se reutiliza, incluso si el rotulo se elimina despues.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const room_release_id = Number(body.room_release_id);
  if (!room_release_id) {
    return NextResponse.json({ error: "room_release_id es obligatorio" }, { status: 400 });
  }

  const { rows: releaseRows } = await sql`
    SELECT * FROM room_release_records WHERE id = ${room_release_id}
  `;
  const release = releaseRows[0];
  if (!release) {
    return NextResponse.json({ error: "No se encontró el Acta de Liberación de Sala indicada" }, { status: 404 });
  }

  const { rows: radioRows } = await sql`
    SELECT * FROM radionuclides WHERE code = ${release.radionuclide_code}
  `;
  const radionuclide = radioRows[0];
  const halfLifeDays = radionuclide ? Number(radionuclide.half_life_days) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const labelYear = new Date().getFullYear();

  const baseActivity = release.actividad_medida_liberacion ?? release.actividad_administrada ?? null;
  const elapsedDays = daysBetween(release.release_date, today);
  const actividadEstimada =
    baseActivity !== null ? estimateResidualActivity(Number(baseActivity), halfLifeDays, elapsedDays) : null;

  // Reserva atomica del correlativo del anio en curso (nunca se reutiliza).
  const { rows: seqRows } = await sql`
    INSERT INTO waste_label_sequence (label_year, last_correlative)
    VALUES (${labelYear}, 1)
    ON CONFLICT (label_year) DO UPDATE SET last_correlative = waste_label_sequence.last_correlative + 1
    RETURNING last_correlative
  `;
  const seqRow = seqRows[0];
  if (!seqRow) {
    return NextResponse.json({ error: "No se pudo reservar el correlativo del rótulo" }, { status: 500 });
  }
  const correlative = seqRow.last_correlative as number;
  const label_number = formatWasteLabelNumber(labelYear, correlative);

  const { rows } = await sql`
    INSERT INTO radioactive_waste_labels (
      label_number, label_year, correlative, room_release_id, generation_date, service, sala,
      room_number, paciente_nombre, radionuclide_code, actividad_estimada_residual, unidad_actividad,
      waste_type, waste_classification, container, storage_location, entry_date, responsible,
      observations, status, created_by
    ) VALUES (
      ${label_number}, ${labelYear}, ${correlative}, ${room_release_id}, ${today}, ${release.service}, ${release.sala},
      ${release.room_number}, ${release.paciente_nombre}, ${release.radionuclide_code}, ${actividadEstimada}, ${release.unidad_actividad ?? "mCi"},
      ${body.waste_type ?? null}, ${body.waste_classification ?? null}, ${body.container ?? null}, ${body.storage_location ?? null}, ${today}, ${release.responsable_opr ?? "Oficial de Protección Radiológica"},
      ${body.observations ?? null}, 'pendiente', ${body.created_by ?? null}
    )
    RETURNING *
  `;
  const label = rows[0];

  await sql`
    INSERT INTO waste_label_history (label_id, label_number, action, changed_by, snapshot)
    VALUES (${label.id}, ${label.label_number}, 'created', ${body.created_by ?? null}, ${JSON.stringify(label)})
  `;

  await sql`
    UPDATE room_release_records SET waste_label_generated = true, updated_at = now() WHERE id = ${room_release_id}
  `;

  return NextResponse.json({ row: label }, { status: 201 });
}
