import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";

export const dynamic = "force-dynamic";

// Fase C - Autorizacion explicita (Secciones 6, 31, 39, 43-44 del Prompt
                                    // Maestro Definitivo). Esta es la UNICA ruta que puede llevar un residuo a
// estado "liberado". Nunca se libera automaticamente por decaimiento, cps,
// o cualquier otro calculo: siempre requiere una accion humana explicita,
// registrada con usuario, fecha y criterios verificados.

const TIPOS_AUTORIZACION = ["verificacion", "liberacion"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    await ensureWasteExpertSchema();
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
          return NextResponse.json({ error: "Id invalido" }, { status: 400 });
        }
    const body = await request.json();

    if (!body?.tipo || !TIPOS_AUTORIZACION.includes(body.tipo)) {
          return NextResponse.json(
                  { error: `tipo debe ser uno de: ${TIPOS_AUTORIZACION.join(", ")}` },
                  { status: 400 }
                );
        }
    if (!body?.autorizado_por) {
          return NextResponse.json({ error: "Falta el campo requerido: autorizado_por" }, { status: 400 });
        }
    if (!body?.criterios_verificados || typeof body.criterios_verificados !== "object") {
          return NextResponse.json(
                  { error: "Falta 'criterios_verificados': debe documentar explicitamente que criterios fueron revisados por el autorizador (seccion 39, 43)." },
                  { status: 400 }
                );
        }

    const { rows: itemRows } = await sql`SELECT * FROM waste_items WHERE id = ${id}`;
    const item = itemRows[0];
    if (!item) {
          return NextResponse.json({ error: "Residuo no encontrado" }, { status: 404 });
        }

    if (body.tipo === "liberacion") {
          // Regla de precaucion (seccion 43): un residuo bloqueado NUNCA puede
          // liberarse, sin excepcion, sin importar quien autorice.
          if (item.estado === "bloqueado") {
                  return NextResponse.json(
                            { error: "El residuo esta bloqueado. No puede liberarse hasta resolver los motivos de bloqueo registrados en su historial." },
                            { status: 400 }
                          );
                }

          const { rows: lastMeasurementRows } = await sql`
            SELECT * FROM waste_item_measurements WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC LIMIT 1
          `;
          const ultima = lastMeasurementRows[0];

          // Regla de no invencion (seccion 44): sin una ultima medicion que
          // cumpla explicitamente un criterio configurado, no hay base para
          // liberar. "cumple_criterio" solo es true cuando hubo criterio
          // identificado, vigente, y el resultado fue evaluado contra el.
          if (!ultima || ultima.cumple_criterio !== true) {
                  return NextResponse.json(
                            {
                                        error:
                                          "INFORMACION INSUFICIENTE PARA UNA DECISION: no hay una medicion valida que cumpla explicitamente un criterio de contaminacion configurado y vigente. No se puede autorizar la liberacion.",
                                      },
                            { status: 400 }
                          );
                }
        }

    const { rows: authRows } = await sql`
      INSERT INTO waste_item_authorizations (waste_item_id, tipo, autorizado_por, criterios_verificados, observaciones)
      VALUES (${id}, ${body.tipo}, ${body.autorizado_por}, ${JSON.stringify(body.criterios_verificados)}, ${body.observaciones ?? null})
      RETURNING *
    `;
    const authorization = authRows[0];

    let estadoNuevo = item.estado;
    let motivo = `Autorizacion de tipo '${body.tipo}' registrada por ${body.autorizado_por}`;

    if (body.tipo === "liberacion") {
          estadoNuevo = "liberado";
          await sql`
            UPDATE waste_items SET estado = ${estadoNuevo}, fecha_liberacion_autorizada = CURRENT_DATE, updated_at = now()
            WHERE id = ${id}
          `;
        } else if (body.tipo === "verificacion" && item.estado === "pendiente_verificacion") {
          estadoNuevo = "disponible_evaluacion_final";
          await sql`UPDATE waste_items SET estado = ${estadoNuevo}, fecha_verificacion = CURRENT_DATE, updated_at = now() WHERE id = ${id}`;
        } else if (body.tipo === "verificacion") {
          await sql`UPDATE waste_items SET fecha_verificacion = CURRENT_DATE, updated_at = now() WHERE id = ${id}`;
        }

    if (estadoNuevo !== item.estado) {
          await sql`
            INSERT INTO waste_item_status_history (waste_item_id, estado_anterior, estado_nuevo, motivo, usuario)
            VALUES (${id}, ${item.estado}, ${estadoNuevo}, ${motivo}, ${body.autorizado_por})
          `;
        }

    return NextResponse.json({ authorization, estado: estadoNuevo }, { status: 201 });
  }
