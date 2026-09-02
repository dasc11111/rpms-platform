import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";

export const dynamic = "force-dynamic";

// Fase C - Sistema Experto de Gestion de Desechos Radiactivos: registro y
// listado de fichas individuales (Seccion 10 del Prompt Maestro Definitivo).
// Cada residuo es una entidad independiente identificada por item_code
// (ej. RR-2026-000001). No reemplaza el modulo anterior (radioactive_waste_labels).

function pad6(n: number): string {
    return String(n).padStart(6, "0");
}

async function nextItemCode(year: number): Promise<string> {
    const prefix = `RR-${year}-`;
    const { rows } = await sql`
        SELECT item_code FROM waste_items WHERE item_code LIKE ${prefix + "%"} ORDER BY item_code DESC LIMIT 1
          `;
    const last = rows[0]?.item_code as string | undefined;
    const lastN = last ? parseInt(last.slice(prefix.length), 10) : 0;
    return `${prefix}${pad6((Number.isFinite(lastN) ? lastN : 0) + 1)}`;
}

export async function GET() {
    await ensureWasteExpertSchema();
    const { rows } = await sql`
        SELECT wi.*, rn.half_life_days, rn.name AS radionuclide_name
            FROM waste_items wi
                LEFT JOIN radionuclides rn ON rn.code = wi.radionuclide_code
                    ORDER BY wi.created_at DESC
                      `;
    return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
    await ensureWasteExpertSchema();
    const body = await request.json();

  const required = ["radionuclide_code", "tipo_residuo", "fecha_hora_generacion"];
    for (const field of required) {
          if (!body?.[field]) {
                  return NextResponse.json({ error: `Falta el campo requerido: ${field}` }, { status: 400 });
          }
    }

  const { rows: rnRows } = await sql`SELECT code FROM radionuclides WHERE code = ${body.radionuclide_code} AND active = true`;
    if (rnRows.length === 0) {
          return NextResponse.json(
            { error: "INFORMACION INSUFICIENTE PARA UNA DECISION: radionuclido no registrado o inactivo. No se invento ningun valor." },
            { status: 400 }
                );
    }

  const year = new Date(body.fecha_hora_generacion).getFullYear() || new Date().getFullYear();
    const itemCode = await nextItemCode(year);

  const { rows } = await sql`
      INSERT INTO waste_items (
            item_code, radionuclide_code, tipo_residuo, tipo_residuo_otro, descripcion,
                  fecha_hora_generacion, zona_horaria, actividad_inicial, unidad_actividad,
                        masa_g, volumen_ml, superficie_estimada_cm2, ubicacion, contenedor,
                              area_almacenamiento, responsable, estado
                                  ) VALUES (
                                        ${itemCode}, ${body.radionuclide_code}, ${body.tipo_residuo}, ${body.tipo_residuo_otro ?? null}, ${body.descripcion ?? null},
                                              ${body.fecha_hora_generacion}, ${body.zona_horaria ?? "America/Santiago"}, ${body.actividad_inicial ?? null}, ${body.unidad_actividad ?? "mCi"},
                                                    ${body.masa_g ?? null}, ${body.volumen_ml ?? null}, ${body.superficie_estimada_cm2 ?? null}, ${body.ubicacion ?? null}, ${body.contenedor ?? null},
                                                          ${body.area_almacenamiento ?? null}, ${body.responsable ?? null}, 'registrado'
                                                              )
                                                                  RETURNING *
                                                                    `;

  const item = rows[0];
    await sql`
        INSERT INTO waste_item_status_history (waste_item_id, estado_anterior, estado_nuevo, motivo, usuario)
            VALUES (${item.id}, NULL, 'registrado', 'Alta inicial de ficha individual', ${body.responsable ?? null})
              `;

  return NextResponse.json({ item }, { status: 201 });
}
