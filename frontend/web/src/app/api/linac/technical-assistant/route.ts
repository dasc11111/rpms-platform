import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";
import { ensureAlertsTables } from "@/lib/linac-alerts";

export const dynamic = "force-dynamic";

// Asistente Tecnico (seccion 46 de la especificacion Fase 6).
// NO utiliza un modelo de lenguaje generico: solo consulta datos ya
// validados y almacenados en la base de datos (criterios activos,
// mediciones, baselines, alertas, documentos). Si no existe informacion
// valida, responde explicitamente "NO EXISTE INFORMACION VALIDADA EN EL SISTEMA."
// para no inventar valores tecnicos.

function noInfo() {
  return "NO EXISTE INFORMACION VALIDADA EN EL SISTEMA.";
}

function extractReferenceValue(data: any): number | null {
  if (!data) return null;
  if (typeof data.value === "number") return data.value;
  if (typeof data.referenceValue === "number") return data.referenceValue;
  if (Array.isArray(data.points) && data.points.length > 0) {
    const p = data.points[0];
    if (p && typeof p.y === "number") return p.y;
  }
  return null;
}

export async function GET(request: Request) {
  await ensureScienceTables();
  await ensureAlertsTables();
  const { searchParams } = new URL(request.url);
  const linacId = Number(searchParams.get("linacId") || 0);
  const parameterName = (searchParams.get("parameterName") || "").trim();
  const module = (searchParams.get("module") || "general").trim();

  if (!linacId || !parameterName) {
    return NextResponse.json({ error: "linacId_and_parameterName_required" }, { status: 400 });
  }

  // 1. Criterio utilizado (solo criterios activos, nunca propuestos).
  const { rows: criteriaRows } = await sql`
    SELECT * FROM linac_technical_criteria
    WHERE status = 'activo'
    AND lower(parameter_name) = lower(${parameterName})
    AND (module = ${module} OR module = 'general')
    AND (linac_id IS NULL OR linac_id = ${linacId})
    ORDER BY (module = ${module}) DESC, (linac_id IS NOT NULL) DESC, updated_at DESC
    LIMIT 1;
  `;
  const criteria: any = criteriaRows[0] || null;

  let documento: any = null;
  if (criteria && criteria.document_id) {
    const { rows: docRows } = await sql`SELECT id, original_name, blob_url, doc_version FROM documents WHERE id = ${criteria.document_id}`;
    if (docRows[0]) {
      documento = {
        id: docRows[0].id,
        nombre: docRows[0].original_name,
        url: docRows[0].blob_url,
        version: criteria.document_version || docRows[0].doc_version,
        pagina: criteria.page,
        capitulo: criteria.chapter,
        seccion: criteria.section,
        tabla: criteria.table_ref,
        fragmento: criteria.fragment_text,
      };
    }
  }

  // 2. Ultima medicion registrada (QC).
  const { rows: qcRows } = await sql`
    SELECT * FROM linac_qc_tests
    WHERE linac_id = ${linacId}
    AND (lower(measurement_type) = lower(${parameterName}) OR lower(test_name) = lower(${parameterName}))
    ORDER BY test_date DESC, id DESC
    LIMIT 1;
  `;
  const ultimaMedicion: any = qcRows[0] || null;

  // 3. Baseline vigente.
  const { rows: baselineRows } = await sql`
    SELECT b.*, d.measurement_date, d.measured_by, d.instrument_used AS dataset_instrument, d.data, d.notes AS dataset_notes
    FROM linac_baselines b
    LEFT JOIN linac_commissioning_datasets d ON d.id = b.dataset_id
    WHERE b.linac_id = ${linacId} AND b.is_current = true
    AND lower(b.measurement_type) = lower(${parameterName})
    ORDER BY b.approved_at DESC
    LIMIT 1;
  `;
  const baselineRow: any = baselineRows[0] || null;
  const baseline = baselineRow
    ? {
        version: baselineRow.version,
        aprobadaEl: baselineRow.approved_at,
        medidaEl: baselineRow.measurement_date,
        medidaPor: baselineRow.measured_by,
        instrumento: baselineRow.dataset_instrument,
        valorReferencia: extractReferenceValue(baselineRow.data),
        notas: baselineRow.dataset_notes,
      }
    : null;

  // 4. Inicio de la desviacion (alerta cientifica mas antigua aun abierta o en revision).
  const { rows: alertRows } = await sql`
    SELECT * FROM linac_scientific_alerts
    WHERE linac_id = ${linacId}
    AND lower(parameter_name) = lower(${parameterName})
    AND status != 'cerrada'
    ORDER BY created_at ASC
    LIMIT 1;
  `;
  const alertaInicio: any = alertRows[0] || null;

  // 5. Instrumento utilizado (prioriza la ultima medicion, luego el baseline).
  const instrumento = (ultimaMedicion && ultimaMedicion.instrument_used) || (baseline && baseline.instrumento) || null;

  const respuestas = {
    criterioUtilizado: criteria
      ? {
          parametro: criteria.parameter_name,
          valor: criteria.value,
          unidad: criteria.unit,
          tolerancia: criteria.tolerance,
          limiteAccion: criteria.action_limit,
          limiteInvestigacion: criteria.investigation_limit,
          limiteCritico: criteria.critical_limit,
          fuente: criteria.source_name,
          estado: criteria.status,
          validadoPor: criteria.validated_by,
          validadoEl: criteria.validated_at,
        }
      : noInfo(),
    ultimaMedicion: ultimaMedicion
      ? {
          valor: ultimaMedicion.obtained_value,
          unidad: ultimaMedicion.unit,
          fecha: ultimaMedicion.test_date,
          responsable: ultimaMedicion.responsible,
          instrumento: ultimaMedicion.instrument_used,
          semaforo: ultimaMedicion.semaphore,
        }
      : noInfo(),
    baseline: baseline || noInfo(),
    inicioDesviacion: alertaInicio
      ? { fecha: alertaInicio.created_at, nivel: alertaInicio.level, mensaje: alertaInicio.message, estado: alertaInicio.status }
      : "SIN DESVIACION ABIERTA REGISTRADA PARA ESTE PARAMETRO.",
    instrumentoUtilizado: instrumento || noInfo(),
    referencia: criteria ? { valor: criteria.value, unidad: criteria.unit, fuente: criteria.source_name, nivelFuente: criteria.source_level } : noInfo(),
    documentoQueRespalda: documento || noInfo(),
  };

  return NextResponse.json({ parameterName, module, linacId, respuestas });
}
