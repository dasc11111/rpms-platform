import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";
import {
    evaluarMetrologia,
    activityFromMethod,
    surfaceContaminationBqCm2,
    netDoseRateUsvH,
    cumpleCriterioContaminacion,
    cumpleCriterioTasaDosis,
    detectarBloqueos,
    type CalibrationMethod,
  } from "@/lib/waste-expert";

export const dynamic = "force-dynamic";

// Fase C - Registro de mediciones individuales por residuo (Secciones 14-30,
                                                             // 36-38, 42-44 del Prompt Maestro Definitivo). Integra Motor 2 (metrologia),
// Motor 3 (contaminacion superficial), Motor 4 (tasa de dosis) y Motor 5
// (regulacion/decision) sobre una ficha ya existente (waste_items).
//
// Principio de precaucion (seccion 43) + no invencion (seccion 44): ante
// cualquier duda o falta de dato/criterio configurado, el estado resultante
// es "pendiente_verificacion" o "bloqueado", NUNCA "liberado". La liberacion
// solo ocurre via /api/waste-items/[id]/authorize (autorizacion explicita).

const TIPOS_MEDICION = ["directa", "wipe", "tasa_dosis"] as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
      await ensureWasteExpertSchema();
      const { id: idParam } = await params;
      const id = Number(idParam);
    if (!Number.isFinite(id)) {
          return NextResponse.json({ error: "Id invalido" }, { status: 400 });
        }
    const { rows } = await sql`
      SELECT m.*, c.valor AS criterio_valor, c.unidad AS criterio_unidad, c.documento_fuente AS criterio_documento_fuente
      FROM waste_item_measurements m
      LEFT JOIN waste_contamination_criteria c ON c.id = m.criterio_aplicado_id
      WHERE m.waste_item_id = ${id}
      ORDER BY m.fecha DESC, m.id DESC
    `;
    return NextResponse.json({ measurements: rows });
  }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
      await ensureWasteExpertSchema();
      const { id: idParam } = await params;
      const id = Number(idParam);
    if (!Number.isFinite(id)) {
          return NextResponse.json({ error: "Id invalido" }, { status: 400 });
        }
    const body = await request.json();

    if (!body?.tipo_medicion || !TIPOS_MEDICION.includes(body.tipo_medicion)) {
          return NextResponse.json(
                  { error: `tipo_medicion debe ser uno de: ${TIPOS_MEDICION.join(", ")}` },
                  { status: 400 }
                );
        }
    if (!body?.fecha) {
          return NextResponse.json({ error: "Falta el campo requerido: fecha" }, { status: 400 });
        }

    const { rows: itemRows } = await sql`SELECT * FROM waste_items WHERE id = ${id}`;
    const item = itemRows[0];
    if (!item) {
          return NextResponse.json({ error: "Residuo no encontrado" }, { status: 404 });
        }

    const esContaminacion = body.tipo_medicion === "directa" || body.tipo_medicion === "wipe";

    // --- Calibracion (Seccion 18): matriz Detector x Radionuclido x Geometria
    // x Distancia x Eficiencia/CF x Vigencia. Nunca se asume una calibracion
    // universal ni valida para cualquier radionuclido.
    let calibration: any = null;
    if (body.calibration_id) {
          const { rows: calRows } = await sql`SELECT * FROM waste_calibration_matrix WHERE id = ${body.calibration_id}`;
          calibration = calRows[0] ?? null;
        }
    const calibracionVigente = calibration
      ? Boolean(calibration.vigente) && calibration.radionuclide_code === item.radionuclide_code
      : false;

    // --- Motor 2: metrologia (solo si vienen los datos de conteo) ---
    let metrologia: ReturnType<typeof evaluarMetrologia> | null = null;
    let actividadBq: number | null = null;
    let eficienciaUsada: number | null = null;
    let factorCalibracionUsado: number | null = null;
    if (
          esContaminacion &&
          body.cps_bruto !== undefined &&
          body.cps_bruto !== null &&
          body.cps_fondo !== undefined &&
          body.cps_fondo !== null &&
          body.tiempo_medicion_s &&
          body.tiempo_fondo_s
        ) {
          metrologia = evaluarMetrologia({
                  grossCps: Number(body.cps_bruto),
                  backgroundCps: Number(body.cps_fondo),
                  tGrossSec: Number(body.tiempo_medicion_s),
                  tBackgroundSec: Number(body.tiempo_fondo_s),
                });
          if (calibration && calibracionVigente) {
                  const metodo: CalibrationMethod = calibration.metodo === "factor_calibracion" ? "factor_calibracion" : "eficiencia";
                  eficienciaUsada = metodo === "eficiencia" ? calibration.eficiencia : null;
                  factorCalibracionUsado = metodo === "factor_calibracion" ? calibration.factor_calibracion : null;
                  actividadBq = activityFromMethod(metodo, metrologia.netCps, eficienciaUsada, factorCalibracionUsado);
                }
        }

    // --- Motor 3: contaminacion superficial (Sc = A / S). El area SIEMPRE
    // debe venir explicitamente clasificada por el usuario (area_tipo), nunca
    // inferida del area del detector (seccion 20).
    let actividadBqCm2: number | null = null;
    if (esContaminacion && actividadBq !== null && body.area_medicion_cm2) {
          actividadBqCm2 = surfaceContaminationBqCm2(actividadBq, Number(body.area_medicion_cm2));
        }

    // --- Motor 4: tasa de dosis, independiente y NUNCA convertida a Bq/cm2 ---
    let tasaDosisNeta: number | null = null;
    if (body.tasa_dosis_bruta_usv_h !== undefined && body.tasa_dosis_bruta_usv_h !== null) {
          tasaDosisNeta = netDoseRateUsvH(Number(body.tasa_dosis_bruta_usv_h), body.tasa_dosis_fondo_usv_h ?? null);
        }

    // --- Motor 5: criterio aplicable (contaminacion) y cumplimiento. Nunca
    // se inventa un criterio: si no hay uno configurado y vigente, cumpleCriterio
    // queda en null (seccion 44).
    let criterio: any = null;
    if (esContaminacion && body.tipo_superficie) {
          const { rows: critRows } = await sql`
            SELECT * FROM waste_contamination_criteria
            WHERE tipo_superficie = ${body.tipo_superficie}
              AND tipo_criterio = 'contaminacion'
              AND active = true
              AND (radionuclide_code = ${item.radionuclide_code} OR radionuclide_code IS NULL)
            ORDER BY (radionuclide_code IS NULL) ASC, id DESC
            LIMIT 1
          `;
          criterio = critRows[0] ?? null;
        }
    const criterioVencido = Boolean(
          criterio?.fecha_vigencia_hasta && new Date(criterio.fecha_vigencia_hasta) < new Date()
        );

    let cumpleCriterio: boolean | null = null;
    if (esContaminacion) {
          cumpleCriterio = cumpleCriterioContaminacion(actividadBqCm2, criterio && !criterioVencido ? Number(criterio.valor) : null);
        } else if (body.limite_tasa_dosis_usv_h !== undefined && body.limite_tasa_dosis_usv_h !== null) {
          // No existe aun una tabla de criterios de tasa de dosis configurada: solo
          // se evalua si el limite se entrega explicitamente (seccion 44).
          cumpleCriterio = cumpleCriterioTasaDosis(tasaDosisNeta, Number(body.limite_tasa_dosis_usv_h));
        }

    // --- Bloqueos automaticos (seccion 37): si hay alguno, el residuo NUNCA
    // puede pasar a "liberado" ni a "disponible_evaluacion_final".
    const bloqueos = detectarBloqueos({
          radionuclideCode: item.radionuclide_code,
          criterioIdentificado: esContaminacion ? Boolean(criterio) : undefined,
          criterioVencido: esContaminacion ? criterioVencido : undefined,
          instrumentoVigente: body.calibration_id ? calibracionVigente : undefined,
          calibracionVigente: esContaminacion ? (body.calibration_id ? calibracionVigente : false) : undefined,
          factorOEficienciaExiste: esContaminacion ? (eficienciaUsada !== null || factorCalibracionUsado !== null) : undefined,
          resultadoCuantificable: metrologia ? metrologia.decision.startsWith("CUANTIFICABLE") : undefined,
          incertidumbreRequiereVerificacion: metrologia ? metrologia.decision === "CUANTIFICABLE_CON_INCERTIDUMBRE_RELEVANTE" : undefined,
          informacionCompleta: esContaminacion ? Boolean(metrologia) : undefined,
        });

    const resultadoMetrologico = metrologia?.decision ?? (esContaminacion ? "INFORMACION_INSUFICIENTE" : null);

    const { rows: insertedRows } = await sql`
      INSERT INTO waste_item_measurements (
              waste_item_id, tipo_medicion, fecha, hora, instrumento, calibration_id,
              cps_bruto, cps_fondo, cps_neto, tiempo_medicion_s, tiempo_fondo_s,
              metodo_conversion, eficiencia_usada, factor_calibracion_usado,
              area_medicion_cm2, area_tipo, actividad_bq, actividad_bq_cm2,
              contaminacion_removible, tasa_dosis_bruta_usv_h, tasa_dosis_fondo_usv_h,
              tasa_dosis_neta_usv_h, distancia_cm, posicion, incertidumbre_absoluta,
              umbral_decision, limite_deteccion, resultado_metrologico,
              criterio_aplicado_id, cumple_criterio, usuario, observaciones
            ) VALUES (
              ${id}, ${body.tipo_medicion}, ${body.fecha}, ${body.hora ?? null}, ${body.instrumento ?? null}, ${body.calibration_id ?? null},
              ${body.cps_bruto ?? null}, ${body.cps_fondo ?? null}, ${metrologia?.netCps ?? null}, ${body.tiempo_medicion_s ?? null}, ${body.tiempo_fondo_s ?? null},
              ${calibration?.metodo ?? null}, ${eficienciaUsada}, ${factorCalibracionUsado},
              ${body.area_medicion_cm2 ?? null}, ${body.area_tipo ?? null}, ${actividadBq}, ${actividadBqCm2},
              ${body.tipo_medicion === "wipe"}, ${body.tasa_dosis_bruta_usv_h ?? null}, ${body.tasa_dosis_fondo_usv_h ?? null},
              ${tasaDosisNeta}, ${body.distancia_cm ?? null}, ${body.posicion ?? null}, ${metrologia?.incertidumbreCps ?? null},
              ${metrologia?.umbralDecisionCps ?? null}, ${metrologia?.limiteDeteccionCps ?? null}, ${resultadoMetrologico},
              ${criterio?.id ?? null}, ${cumpleCriterio}, ${body.usuario ?? null}, ${body.observaciones ?? null}
            )
      RETURNING *
    `;
    const measurement = insertedRows[0];

    // --- Motor 5: determinacion de estado (secciones 31, 43, 44). Ante
    // cualquier duda, el resultado es "pendiente_verificacion" o "bloqueado",
    // nunca "liberado" (la liberacion requiere autorizacion explicita aparte).
    let estadoNuevo: string = item.estado;
    let motivo = "Registro de medicion";
    if (bloqueos.length > 0) {
          estadoNuevo = "bloqueado";
          motivo = `Bloqueo automatico: ${bloqueos.join("; ")}`;
        } else if (esContaminacion) {
          if (!metrologia) {
                  estadoNuevo = "pendiente_medicion";
                  motivo = "Medicion registrada con datos incompletos (faltan cps/tiempos): no se pudo evaluar";
                } else if (metrologia.decision === "CUANTIFICABLE_CON_INCERTIDUMBRE_RELEVANTE") {
                  estadoNuevo = "pendiente_verificacion";
                  motivo = "Resultado cuantificable pero con incertidumbre relevante: requiere verificacion (seccion 43)";
                } else if (cumpleCriterio === null) {
                  estadoNuevo = "pendiente_verificacion";
                  motivo = "No hay criterio de contaminacion aplicable configurado o vigente: INFORMACION INSUFICIENTE PARA UNA DECISION";
                } else if (cumpleCriterio === false) {
                  estadoNuevo = "no_cumple";
                  motivo = "La contaminacion medida supera el criterio aplicable";
                } else {
                  estadoNuevo = "disponible_evaluacion_final";
                  motivo = "Cumple el criterio de contaminacion aplicable; disponible para evaluacion final (no implica liberacion automatica)";
                }
        }

    if (estadoNuevo !== item.estado) {
          await sql`UPDATE waste_items SET estado = ${estadoNuevo}, updated_at = now() WHERE id = ${id}`;
          await sql`
            INSERT INTO waste_item_status_history (waste_item_id, estado_anterior, estado_nuevo, motivo, usuario)
            VALUES (${id}, ${item.estado}, ${estadoNuevo}, ${motivo}, ${body.usuario ?? null})
          `;
        }

    return NextResponse.json(
          { measurement, estado: estadoNuevo, bloqueos, metrologia, criterio },
          { status: 201 }
        );
  }
