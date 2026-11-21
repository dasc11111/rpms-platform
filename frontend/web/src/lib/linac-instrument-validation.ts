// Motor de Incertidumbre / Validacion de Instrumentos (Fase 6, seccion 39-40).
// NO se duplica el modulo de Instrumentos: se consulta directamente instruments/calibrations
// ya existentes en el sistema (seccion 51: regla de no duplicacion).
import { sql } from "@/lib/db";
import { getCalibrationAlertLevel, CALIBRATION_ALERT_LABELS } from "@/lib/instruments";

export const INSUFFICIENT_UNCERTAINTY_INFO = "INFORMACION INSUFICIENTE PARA CALCULO DE INCERTIDUMBRE.";

export type InstrumentValidationResult =
  | { found: false; message: string }
  | {
      found: true;
      instrumento: {
        id: number;
        code: string;
        name: string;
        brand: string | null;
        model: string | null;
        serialNumber: string | null;
        status: string;
      };
      calibracion:
        | {
            fecha: string | null;
            vencimiento: string | null;
            certificado: string | null;
            empresa: string | null;
            factor: number | null;
            magnitud: string | null;
            unidades: string | null;
            metodo: string | null;
            patronUtilizado: string | null;
          }
        | string;
      estadoCalibracion: { nivel: string; etiqueta: string; diasRestantes: number | null };
      trazabilidad: string;
    };

// Busca un instrumento existente por codigo, nombre, numero de serie, marca o modelo.
// Si no existe o no tiene calibracion registrada, se retorna el mensaje literal
// INFORMACION INSUFICIENTE PARA CALCULO DE INCERTIDUMBRE (nunca se inventa un valor).
export async function validateInstrument(query: string): Promise<InstrumentValidationResult> {
  const q = (query || "").trim();
  if (!q) return { found: false, message: INSUFFICIENT_UNCERTAINTY_INFO };

  const like = "%" + q + "%";
  const { rows } = await sql`
    SELECT * FROM instruments
    WHERE code ILIKE ${like} OR name ILIKE ${like} OR serial_number ILIKE ${like}
       OR brand ILIKE ${like} OR model ILIKE ${like}
    ORDER BY updated_at DESC
    LIMIT 1;
  `;
  const instrument: any = rows[0];
  if (!instrument) {
    return { found: false, message: INSUFFICIENT_UNCERTAINTY_INFO };
  }

  const { rows: calRows } = await sql`
    SELECT * FROM calibrations WHERE instrument_id = ${instrument.id}
    ORDER BY calibration_date DESC, id DESC LIMIT 1;
  `;
  const cal: any = calRows[0];

  const alert = getCalibrationAlertLevel(cal ? cal.expiry_date : null);

  return {
    found: true,
    instrumento: {
      id: instrument.id,
      code: instrument.code,
      name: instrument.name,
      brand: instrument.brand,
      model: instrument.model,
      serialNumber: instrument.serial_number,
      status: instrument.status,
    },
    calibracion: cal
      ? {
          fecha: cal.calibration_date,
          vencimiento: cal.expiry_date,
          certificado: cal.certificate_number,
          empresa: cal.company_name,
          factor: cal.calibration_factor,
          magnitud: cal.magnitude,
          unidades: cal.units,
          metodo: cal.method,
          patronUtilizado: cal.standard_used,
        }
      : INSUFFICIENT_UNCERTAINTY_INFO,
    estadoCalibracion: {
      nivel: alert.level,
      etiqueta: (CALIBRATION_ALERT_LABELS as any)[alert.level] || alert.level,
      diasRestantes: alert.daysRemaining,
    },
    trazabilidad: cal && cal.standard_used ? cal.standard_used : INSUFFICIENT_UNCERTAINTY_INFO,
  };
}
