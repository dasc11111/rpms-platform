import { sql } from "@/lib/db";
import { ensureScienceTables, computeDeviation, classifyDeviation } from "@/lib/linac-science";
import { CALIBRATION_ALERT_LABELS } from "@/lib/instruments";

let alertsEnsured = false;

export async function ensureAlertsTables() {
  if (alertsEnsured) return;
  await ensureScienceTables();
  await sql`
    CREATE TABLE IF NOT EXISTS linac_scientific_alerts (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE SET NULL,
      module TEXT NOT NULL,
      parameter_name TEXT NOT NULL,
      criteria_id INTEGER REFERENCES linac_technical_criteria(id) ON DELETE SET NULL,
      measured_value TEXT,
      reference_value TEXT,
      deviation_pct NUMERIC,
      level TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'abierta',
      source_record_id INTEGER,
      source_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      acknowledged_by TEXT,
      acknowledged_at TIMESTAMPTZ,
      resolution_notes TEXT
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sci_alerts_status ON linac_scientific_alerts(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sci_alerts_linac ON linac_scientific_alerts(linac_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sci_alerts_module ON linac_scientific_alerts(module)`;
  alertsEnsured = true;
}

export function parseNumeric(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function findActiveCriteria(moduleName: string, linacId: number | null, parameterName: string): Promise<any> {
  const { rows } = await sql`
    SELECT * FROM linac_technical_criteria
    WHERE status = 'activo'
      AND lower(parameter_name) = lower(${parameterName})
      AND (module = ${moduleName} OR module = 'general')
      AND (linac_id IS NULL OR linac_id = ${linacId}::integer)
    ORDER BY (module = ${moduleName}) DESC, (linac_id IS NOT NULL) DESC, updated_at DESC
    LIMIT 1;
  `;
  return rows[0] || null;
}

export type EvaluateOpts = {
  module: string;
  linacId?: number | null;
  parameterName: string;
  measuredValue: string | number | null;
  sourceRecordId?: number | null;
  sourceDate?: string | null;
  persist?: boolean;
};

export async function evaluateAndMaybeAlert(opts: EvaluateOpts): Promise<any> {
  await ensureAlertsTables();
  const criteria: any = await findActiveCriteria(opts.module, opts.linacId ?? null, opts.parameterName);
  const measured = parseNumeric(opts.measuredValue);

  if (!criteria) {
    return { evaluated: false, reason: "CRITERIO PENDIENTE DE PARAMETRIZACION", criteria: null };
  }
  if (measured === null) {
    return { evaluated: false, reason: "sin_valor_medido", criteria };
  }
  const refValue = parseNumeric(criteria.value);
  if (refValue === null) {
    return { evaluated: false, reason: "INFORMACION INSUFICIENTE PARA ESTABLECER CRITERIO", criteria };
  }

  const deviationPct = computeDeviation(measured, refValue);
  const tolerance = parseNumeric(criteria.tolerance);
  const action = parseNumeric(criteria.action_limit);
  const investigation = parseNumeric(criteria.investigation_limit);
  const classification = classifyDeviation(deviationPct, tolerance, action, investigation);

  const persist = opts.persist !== false;
  let alertId: number | null = null;

  if (classification.level !== "normal" && classification.level !== "sin_criterio" && persist) {
    const recordId = opts.sourceRecordId ?? null;
    const { rows: existing } = await sql`
      SELECT id FROM linac_scientific_alerts
      WHERE module = ${opts.module}
        AND parameter_name = ${opts.parameterName}
        AND status = 'abierta'
        AND source_record_id = ${recordId}::integer
      LIMIT 1;
    `;
    if (existing[0]) {
      alertId = existing[0].id;
    } else {
      const message = "Parametro \"" + opts.parameterName + "\" (" + opts.module + "): valor medido " + measured + " vs referencia " + refValue + ". Desviacion " + (deviationPct !== null ? deviationPct.toFixed(2) : "N/A") + "% - " + classification.label + ".";
      const { rows: inserted } = await sql`
        INSERT INTO linac_scientific_alerts (
          linac_id, module, parameter_name, criteria_id, measured_value, reference_value,
          deviation_pct, level, message, status, source_record_id, source_date
        ) VALUES (
          ${opts.linacId ?? null}, ${opts.module}, ${opts.parameterName}, ${criteria.id},
          ${String(measured)}, ${String(refValue)}, ${deviationPct}, ${classification.level},
          ${message}, 'abierta', ${recordId}, ${opts.sourceDate ?? null}
        ) RETURNING id;
      `;
      alertId = inserted[0] ? inserted[0].id : null;
    }
  }

  return { evaluated: true, measured, refValue, deviationPct, classification, criteria, alertId };
}


// Mapa de nivel de calibracion (modulo Instrumentos existente) a nivel de alerta
// cientifica. Seccion 36-37 (Fase 6.9): "falta de calibracion" como disparador
// de alerta. No se duplica la logica de vigencia: se reutiliza el nivel ya
// calculado por getCalibrationAlertLevel() en lib/instruments.ts (seccion 51).
const CALIBRATION_TO_ALERT_LEVEL: Record<string, string> = {
  vencida: "critica",
  sin_calibracion: "investigacion",
  rojo: "atencion",
  amarillo: "atencion",
  verde: "normal",
};

export type CalibrationAlertInput = {
  linacId?: number | null;
  module?: string;
  instrumentId: number;
  instrumentCode: string;
  instrumentName: string;
  calibrationLevel: string;
  daysRemaining: number | null;
};

// Genera (o reutiliza si ya existe abierta) una alerta cientifica de "falta de
// calibracion" para un instrumento consultado desde el Motor de Incertidumbre.
export async function createCalibrationAlertIfNeeded(input: CalibrationAlertInput): Promise<number | null> {
  await ensureAlertsTables();
  const level = CALIBRATION_TO_ALERT_LEVEL[input.calibrationLevel] || "normal";
  if (level === "normal") return null;

  const moduleName = input.module || "instrumentos";
  const { rows: existing } = await sql`
    SELECT id FROM linac_scientific_alerts
    WHERE module = ${moduleName}
    AND parameter_name = ${input.instrumentCode}
    AND status = 'abierta'
    AND source_record_id = ${input.instrumentId}::integer
    LIMIT 1;
  `;
  if (existing[0]) return existing[0].id;

  const etiqueta = (CALIBRATION_ALERT_LABELS as any)[input.calibrationLevel] || input.calibrationLevel;
  const dias = input.daysRemaining !== null && input.daysRemaining !== undefined ? " (" + input.daysRemaining + " dias)" : "";
  const message = "Instrumento \"" + input.instrumentName + "\" (" + input.instrumentCode + "): " + etiqueta + dias + ".";

  const { rows: inserted } = await sql`
    INSERT INTO linac_scientific_alerts (
      linac_id, module, parameter_name, measured_value, reference_value,
      level, message, status, source_record_id
    ) VALUES (
      ${input.linacId ?? null}, ${moduleName}, ${input.instrumentCode},
      ${input.daysRemaining !== null && input.daysRemaining !== undefined ? String(input.daysRemaining) : null}, null,
      ${level}, ${message}, 'abierta', ${input.instrumentId}
    ) RETURNING id;
  `;
  return inserted[0] ? inserted[0].id : null;
}
