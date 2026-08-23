/**
 * MODULO 1 - ACTIVIMETRO (DOSE CALIBRATOR)
 * Motor de calculo del sistema de Control de Calidad.
 *
 * REGLA FUNDAMENTAL (Prompt maestro CC, seccion 3): el operador introduce
 * unicamente los datos medidos. Todo calculo (promedio, SD, CV%, diferencia %,
 * correccion por decaimiento, regresion ln-ln, clasificacion del resultado)
 * se realiza aqui, nunca manualmente por el usuario.
 *
 * Estas funciones son puras (sin efectos secundarios, sin acceso a BD) para
 * poder ser verificadas y reutilizadas tanto en el backend (API) como en el
 * frontend (vista previa antes de guardar).
 */

export type ResultStatus = "cumple" | "advertencia" | "no_cumple" | "pendiente_revision";

export function mean(values: number[]): number {
    if (!values.length) return NaN;
    return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function stddev(values: number[]): number {
    if (values.length < 2) return 0;
    const m = mean(values);
    const sumSq = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
    return Math.sqrt(sumSq / (values.length - 1));
}

export function coefficientOfVariation(values: number[]): number {
    const m = mean(values);
    if (!m) return NaN;
    return (stddev(values) / m) * 100;
}

export function percentDifference(measuredValue: number, referenceValue: number): number {
    if (!referenceValue) return NaN;
    return ((measuredValue - referenceValue) / referenceValue) * 100;
}

export function decayConstant(halfLifeMinutes: number): number {
    if (!halfLifeMinutes) return NaN;
    return Math.LN2 / halfLifeMinutes;
}

export function decayCorrectActivity(
    activity: number,
    halfLifeMinutes: number,
    elapsedMinutes: number,
    direction: "forward" | "backward" = "forward"
  ): number {
    const lambda = decayConstant(halfLifeMinutes);
    if (Number.isNaN(lambda)) return NaN;
    const factor = Math.exp(-lambda * elapsedMinutes);
    return direction === "forward" ? activity * factor : activity / factor;
}

export interface LinearRegressionResult {
    slope: number;
    intercept: number;
    r2: number;
}

export function linearRegression(x: number[], y: number[]): LinearRegressionResult {
    const n = x.length;
    if (n < 2 || n !== y.length) return { slope: NaN, intercept: NaN, r2: NaN };
    const mx = mean(x);
    const my = mean(y);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
          const dx = x[i] - mx;
          const dy = y[i] - my;
          sxy += dx * dy;
          sxx += dx * dx;
          syy += dy * dy;
    }
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : NaN;
    return { slope, intercept, r2 };
}

export interface LnLnRegressionResult extends LinearRegressionResult {
    impliedHalfLifeMinutes: number;
}

export function lnLnRegression(timeMinutes: number[], activity: number[]): LnLnRegressionResult {
    const x = timeMinutes.map((t) => Math.log(t));
    const y = activity.map((a) => Math.log(a));
    const { slope, intercept, r2 } = linearRegression(x, y);
    const impliedHalfLifeMinutes = slope ? Math.LN2 / -slope : NaN;
    return { slope, intercept, r2, impliedHalfLifeMinutes };
}

export function evaluateTolerance(
    observedPercent: number,
    tolerancePercent: number | null | undefined,
    warningPercent?: number | null
  ): ResultStatus {
    if (tolerancePercent === null || tolerancePercent === undefined || Number.isNaN(observedPercent)) {
          return "pendiente_revision";
    }
    const abs = Math.abs(observedPercent);
    if (abs > tolerancePercent) return "no_cumple";
    if (warningPercent && abs > tolerancePercent - warningPercent) return "advertencia";
    return "cumple";
}

export interface PrecisionExactitudInput {
    readings: number[];
    referenceValue?: number | null;
    tolerancePercent: number | null;
    warningPercent?: number | null;
}

export interface PrecisionExactitudOutput {
    numReadings: number;
    meanValue: number;
    stddevValue: number;
    cvPercent: number;
    percentDifference: number | null;
    status: ResultStatus;
}

export function calculatePrecisionExactitud(input: PrecisionExactitudInput): PrecisionExactitudOutput {
    const { readings, referenceValue, tolerancePercent, warningPercent } = input;
    const meanValue = mean(readings);
    const stddevValue = stddev(readings);
    const cvPercent = coefficientOfVariation(readings);
    const diff = referenceValue ? percentDifference(meanValue, referenceValue) : null;
    const observed = referenceValue ? (diff as number) : cvPercent;
    const status = evaluateTolerance(observed, tolerancePercent, warningPercent);
    return {
          numReadings: readings.length,
          meanValue,
          stddevValue,
          cvPercent,
          percentDifference: diff,
          status,
    };
}
