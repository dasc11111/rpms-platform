import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  try {
    const { rows } = estado
      ? await sql`
          SELECT id, waste_date::text, radionuclido, descripcion,
                 cantidad_mci::text, cantidad_gbq::text, tipo_residuo,
                 contenedor, estado, decaimiento_previsto::text, responsable
          FROM waste_records
          WHERE estado = ${estado}
          ORDER BY waste_date DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, waste_date::text, radionuclido, descripcion,
                 cantidad_mci::text, cantidad_gbq::text, tipo_residuo,
                 contenedor, estado, decaimiento_previsto::text, responsable
          FROM waste_records
          ORDER BY waste_date DESC
          LIMIT ${limit}
        `;
    return NextResponse.json({ waste_records: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const wasteDate = String(body.waste_date ?? new Date().toISOString().slice(0, 10));
    const radionuclido = String(body.radionuclido ?? "TC-99M").toUpperCase();
    const descripcion = String(body.descripcion ?? "").trim();
    const cantidadMci = body.cantidad_mci ? Number(body.cantidad_mci) : null;
    const cantidadGbq = body.cantidad_gbq ? Number(body.cantidad_gbq) : null;
    const tipoResiduo = String(body.tipo_residuo ?? "solido");
    const contenedor = body.contenedor ? String(body.contenedor) : null;
    const estado = String(body.estado ?? "almacenado");
    const decaimientoPrevisto = body.decaimiento_previsto ? String(body.decaimiento_previsto) : null;
    const responsable = body.responsable ? String(body.responsable) : null;
    const observaciones = body.observaciones ? String(body.observaciones) : null;

    if (!descripcion) return NextResponse.json({ error: "descripcion requerida" }, { status: 400 });

    const year = new Date(wasteDate).getFullYear();
    const month = new Date(wasteDate).getMonth() + 1;

    const decaimientoDate = decaimientoPrevisto ?? null;
    const { rows } = await sql`
      INSERT INTO waste_records (
        waste_date, waste_year, waste_month, radionuclido, descripcion,
        cantidad_mci, cantidad_gbq, tipo_residuo, contenedor, estado,
        decaimiento_previsto, responsable, observaciones
      ) VALUES (
        ${wasteDate}::date, ${year}, ${month}, ${radionuclido}, ${descripcion},
        ${cantidadMci}, ${cantidadGbq}, ${tipoResiduo}, ${contenedor}, ${estado},
        ${decaimientoDate}::date, ${responsable}, ${observaciones}
      )
      RETURNING id, waste_date::text, radionuclido, descripcion, estado
    `;
    return NextResponse.json({ waste_record: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
