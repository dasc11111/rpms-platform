import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: Record<string, string> = {
  paciente: "paciente_nombre",
  run: "paciente_run",
  service: "service",
  sala: "sala",
  radionuclide: "radionuclide_code",
  status: "status",
};

const SORTABLE = new Set([
  "release_date",
  "paciente_nombre",
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
    if (key === "status" || key === "radionuclide") {
      params.push(val);
      conditions.push(`${column} = $${params.length}`);
    } else {
      params.push(`%${val}%`);
      conditions.push(`${column} ILIKE $${params.length}`);
    }
  }
}

const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`release_date >= $${params.length}`);
  }
  const dateTo = searchParams.get("dateTo");
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`release_date <= $${params.length}`);
  }

const q = searchParams.get("q");
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    conditions.push(
      `(paciente_nombre ILIKE $${idx} OR ficha_clinica ILIKE $${idx} OR paciente_run ILIKE $${idx} OR sala ILIKE $${idx})`
      );
  }

const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { where, params } = buildFilters(searchParams);

const sortField = searchParams.get("sort") ?? "release_date";
  const sortCol = SORTABLE.has(sortField) ? sortField : "release_date";
  const dir = searchParams.get("dir") === "asc" ? "ASC" : "DESC";

const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));
  const offset = (page - 1) * pageSize;

const countQuery = `SELECT COUNT(*)::int AS count FROM room_release_records ${where}`;
  const { rows: countRows } = await sql.query(countQuery, params);
  const total = countRows[0]?.count ?? 0;

const dataParams = [...params, pageSize, offset];
  const dataQuery = `
  SELECT * FROM room_release_records
  ${where}
  ORDER BY ${sortCol} ${dir}, id ${dir}
  LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const { rows } = await sql.query(dataQuery, dataParams);

return NextResponse.json({ rows, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

const release_date = (body.release_date ?? "").toString();
  const service = (body.service ?? "").toString().trim();
  const sala = (body.sala ?? "").toString().trim();
  const paciente_nombre = (body.paciente_nombre ?? "").toString().trim();
  const radionuclide_code = (body.radionuclide_code ?? "I-131").toString().trim() || "I-131";

const errors: string[] = [];
  if (!release_date) errors.push("La fecha de liberación de sala es obligatoria");
  if (!service) errors.push("El servicio es obligatorio");
  if (!sala) errors.push("La sala es obligatoria");
  if (!paciente_nombre) errors.push("El nombre del paciente es obligatorio");
  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

const { rows } = await sql`
INSERT INTO room_release_records (
release_date, admission_date, service, sala, room_number, paciente_nombre, paciente_run,
ficha_clinica, radionuclide_code, actividad_administrada, actividad_medida_liberacion,
unidad_actividad, tasa_dosis_medida, criterio_liberacion, responsable_opr, observaciones, status,
created_by
) VALUES (
${release_date}, ${body.admission_date ?? null}, ${service}, ${sala}, ${body.room_number ?? null}, ${paciente_nombre}, ${body.paciente_run ?? null},
${body.ficha_clinica ?? null}, ${radionuclide_code}, ${body.actividad_administrada ?? null}, ${body.actividad_medida_liberacion ?? null},
${body.unidad_actividad ?? "mCi"}, ${body.tasa_dosis_medida ?? null}, ${body.criterio_liberacion ?? null}, ${body.responsable_opr ?? "Oficial de Protección Radiológica"}, ${body.observaciones ?? null}, ${body.status ?? "liberado"},
${body.created_by ?? null}
)
RETURNING *
`;

return NextResponse.json({ row: rows[0] }, { status: 201 });
}
