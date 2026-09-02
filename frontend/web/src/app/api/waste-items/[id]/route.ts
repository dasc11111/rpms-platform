import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";
import { construirExplicacion } from "@/lib/waste-expert";

export const dynamic = "force-dynamic";

// Fase C - Ficha individual completa de un residuo (Seccion 10, 39: cada
// decision debe ser reconstruible: residuo -> mediciones -> historial de
// estados -> correcciones -> autorizaciones).
export async function GET(request: Request, { params }: { params: { id: string } }) {
    await ensureWasteExpertSchema();
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
          return NextResponse.json({ error: "Id invalido" }, { status: 400 });
    }

  const { rows: itemRows } = await sql`
      SELECT wi.*, rn.half_life_days, rn.name AS radionuclide_name
          FROM waste_items wi
              LEFT JOIN radionuclides rn ON rn.code = wi.radionuclide_code
                  WHERE wi.id = ${id}
                    `;
    const item = itemRows[0];
    if (!item) {
          return NextResponse.json({ error: "Residuo no encontrado" }, { status: 404 });
    }

  const { rows: measurements } = await sql`
      SELECT m.*, c.valor AS criterio_valor, c.unidad AS criterio_unidad, c.documento_fuente AS criterio_documento_fuente
          FROM waste_item_measurements m
              LEFT JOIN waste_contamination_criteria c ON c.id = m.criterio_aplicado_id
                  WHERE m.waste_item_id = ${id}
                      ORDER BY m.fecha DESC, m.id DESC
                        `;
    const { rows: statusHistory } = await sql`
        SELECT * FROM waste_item_status_history WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
          `;
    const { rows: authorizations } = await sql`
        SELECT * FROM waste_item_authorizations WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
          `;
    const { rows: corrections } = await sql`
        SELECT * FROM waste_item_corrections WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
          `;

  const ultima = measurements[0];
    const explicacion = construirExplicacion({
          itemCode: item.item_code,
          estado: item.estado,
          radionuclideCode: item.radionuclide_code,
          ultimaBqCm2: ultima?.actividad_bq_cm2 ?? null,
          criterioBqCm2: ultima?.criterio_valor ?? null,
          ultimaMedicionValida: ultima ? Boolean(ultima.cumple_criterio !== null) : null,
          fechaTeoricaProximaEvaluacion: item.fecha_teorica_cumplimiento ?? null,
    });

  return NextResponse.json({ item, measurements, statusHistory, authorizations, corrections, explicacion });
}
