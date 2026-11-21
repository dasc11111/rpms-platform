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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = body.id;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const { rows } = await sql`
      UPDATE waste_records SET
        radionuclido        = COALESCE(${body.radionuclido ? String(body.radionuclido).toUpperCase() : null}, radionuclido),
        descripcion         = COALESCE(${body.descripcion ? String(body.descripcion) : null}, descripcion),
        cantidad_mci        = COALESCE(${body.cantidad_mci != null ? Number(body.cantidad_mci) : null}, cantidad_mci),
        cantidad_gbq        = COALESCE(${body.cantidad_gbq != null ? Number(body.cantidad_gbq) : null}, cantidad_gbq),
        tipo_residuo        = COALESCE(${body.tipo_residuo ? String(body.tipo_residuo) : null}, tipo_residuo),
        contenedor          = COALESCE(${body.contenedor ? String(body.contenedor) : null}, contenedor),
        estado              = COALESCE(${body.estado ? String(body.estado) : null}, estado),
        decaimiento_previsto = COALESCE(${body.decaimiento_previsto ? String(body.decaimiento_previsto) : null}::date, decaimiento_previsto),
        responsable         = COALESCE(${body.responsable ? String(body.responsable) : null}, responsable),
        observaciones       = COALESCE(${body.observaciones ? String(body.observaciones) : null}, observaciones),
        updated_at          = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    if (!rows[0]) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    return NextResponse.json({ waste_record: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await sql`UPDATE waste_records SET estado = 'eliminado', updated_at = NOW() WHERE id = ${Number(id)}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
