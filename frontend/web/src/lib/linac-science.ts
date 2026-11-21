import { sql } from "@/lib/db";

let ensured = false;

export async function ensureScienceTables() {
  if (ensured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_technical_criteria (
      id SERIAL PRIMARY KEY,
      parameter_name TEXT NOT NULL,
      module TEXT NOT NULL DEFAULT 'general',
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE SET NULL,
      value TEXT,
      unit TEXT,
      tolerance TEXT,
      action_limit TEXT,
      investigation_limit TEXT,
      critical_limit TEXT,
      source_level INTEGER,
      source_name TEXT,
      document_id INTEGER,
      document_version TEXT,
      page TEXT,
      chapter TEXT,
      section TEXT,
      table_ref TEXT,
      fragment_text TEXT,
      status TEXT NOT NULL DEFAULT 'propuesto',
      previous_version_id INTEGER,
      proposed_by TEXT,
      proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      validated_by TEXT,
      validated_at TIMESTAMPTZ,
      validation_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_criteria_status ON linac_technical_criteria(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_criteria_module ON linac_technical_criteria(module)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_criteria_linac ON linac_technical_criteria(linac_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_criteria_audit (
      id SERIAL PRIMARY KEY,
      criteria_id INTEGER REFERENCES linac_technical_criteria(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor TEXT,
      previous_data JSONB,
      new_data JSONB,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_criteria_links (
      id SERIAL PRIMARY KEY,
      criteria_id INTEGER REFERENCES linac_technical_criteria(id) ON DELETE CASCADE,
      module TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_criteria_links_record ON linac_criteria_links(module, record_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS linac_deviation_decisions (
      id SERIAL PRIMARY KEY,
      linac_id INTEGER REFERENCES linac_units(id) ON DELETE SET NULL,
      source_module TEXT NOT NULL,
      source_record_id INTEGER,
      parameter_name TEXT,
      measured_value TEXT,
      reference_value TEXT,
      baseline_value TEXT,
      deviation TEXT,
      criteria_id INTEGER REFERENCES linac_technical_criteria(id) ON DELETE SET NULL,
      decision TEXT NOT NULL,
      justification TEXT,
      decided_by TEXT,
      decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`ALTER TABLE linac_deviation_decisions ADD COLUMN IF NOT EXISTS alert_id INTEGER`;

  await sql`
    CREATE TABLE IF NOT EXISTS document_relations (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL,
      related_document_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'relacionado',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (document_id, related_document_id, relation_type)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS document_version_analysis (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL,
      previous_document_id INTEGER,
      changes_summary TEXT,
      criteria_affected JSONB,
      status TEXT NOT NULL DEFAULT 'pendiente',
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      decision TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Metadatos documentales del Motor Cientifico (no se duplica la tabla documents,
  // solo se amplia con columnas opcionales; nunca se sobrescribe el archivo original).
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS subcategory TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_organism TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_code TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_version TEXT NOT NULL DEFAULT '1'`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS publication_date DATE`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS validity_date DATE`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_date DATE`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS keywords TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_status TEXT NOT NULL DEFAULT 'vigente'`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS responsible TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS observations TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS previous_version_id INTEGER`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT`;

  ensured = true;
}

export const SOURCE_HIERARCHY: { level: number; name: string }[] = [
  { level: 1, name: "Normativa Chile" },
  { level: 2, name: "ARPANSA" },
  { level: 3, name: "IAEA/OIEA" },
  { level: 4, name: "IEC" },
  { level: 5, name: "AAPM" },
  { level: 6, name: "ICRU" },
  { level: 7, name: "Documentacion del fabricante" },
  { level: 8, name: "Protocolo institucional" },
  { level: 9, name: "Otro documento cientifico validado" },
];

export const CRITERIA_STATUS: { value: string; label: string }[] = [
  { value: "propuesto", label: "Pendiente de validacion" },
  { value: "activo", label: "Criterio activo" },
  { value: "rechazado", label: "Rechazado" },
  { value: "historico", label: "Historico" },
];

export const DOCUMENT_STATUS: { value: string; label: string }[] = [
  { value: "vigente", label: "Vigente" },
  { value: "proxima_revision", label: "Proxima a revision" },
  { value: "requiere_revision", label: "Requiere actualizacion" },
  { value: "obsoleto", label: "Obsoleto" },
  { value: "historico", label: "Historico" },
];

export const DECISION_OPTIONS: { value: string; label: string }[] = [
  { value: "revisar", label: "Revisar" },
  { value: "investigar", label: "Investigar" },
  { value: "repetir_medicion", label: "Repetir medicion" },
  { value: "registrar_mantenimiento", label: "Registrar mantenimiento" },
  { value: "registrar_correctiva", label: "Registrar accion correctiva" },
  { value: "justificar", label: "Justificar desviacion" },
  { value: "escalar_fisico_medico", label: "Escalar a Fisico Medico" },
  { value: "escalar_opr", label: "Escalar a OPR" },
  { value: "suspender_operacion", label: "Suspender operacion" },
];

export function computeDeviation(measured: number, baseline: number): number | null {
  if (!baseline || !Number.isFinite(baseline) || !Number.isFinite(measured)) return null;
  return ((measured - baseline) / baseline) * 100;
}

export function classifyDeviation(
  deviationPct: number | null,
  tolerancePct: number | null,
  actionPct: number | null,
  investigationPct: number | null
): { level: string; label: string; color: string } {
  if (deviationPct === null) return { level: "sin_criterio", label: "Sin criterio configurado", color: "gray" };
  const abs = Math.abs(deviationPct);
  if (investigationPct !== null && abs >= investigationPct) return { level: "critica", label: "Accion requerida", color: "red" };
  if (actionPct !== null && abs >= actionPct) return { level: "investigacion", label: "Investigacion", color: "orange" };
  if (tolerancePct !== null && abs >= tolerancePct) return { level: "atencion", label: "Atencion", color: "yellow" };
  return { level: "normal", label: "Dentro de criterio", color: "green" };
}

export type StatsResult = {
  n: number; mean: number; median: number; stdDev: number; cv: number | null;
  min: number; max: number; range: number; ucl: number; lcl: number;
};

export function computeStats(values: number[]): StatsResult | null {
  const nums = values.filter((v: number) => Number.isFinite(v));
  const n = nums.length;
  if (n === 0) return null;
  const mean = nums.reduce((a: number, b: number) => a + b, 0) / n;
  const sorted = [...nums].sort((a: number, b: number) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : sorted[(n - 1) / 2]!;
  const variance = n > 1 ? nums.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : null;
  const min = sorted[0]!;
  const max = sorted[n - 1]!;
  return { n, mean, median, stdDev, cv, min, max, range: max - min, ucl: mean + 2 * stdDev, lcl: mean - 2 * stdDev };
}

export function linearTrend(points: { x: number; y: number }[]): { slope: number; intercept: number; direction: string } | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((a: number, p) => a + p.x, 0);
  const sumY = points.reduce((a: number, p) => a + p.y, 0);
  const sumXY = points.reduce((a: number, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a: number, p) => a + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  let direction = "estable";
  if (slope > 0.001) direction = "creciente";
  else if (slope < -0.001) direction = "decreciente";
  return { slope, intercept, direction };
}

export type ControlPoint = { index: number; value: number; date?: string; id?: number };
export type AnomalousSequence = {
  type: string;
  label: string;
  startIndex: number;
  endIndex: number;
  length: number;
};
export type ControlAnalysis = {
  outOfControlPoints: ControlPoint[];
  anomalousSequences: AnomalousSequence[];
};

function findRuns(signs: number[], minLen: number, cb: (sign: number, start: number, end: number, len: number) => void) {
  let i = 0;
  while (i < signs.length) {
    if (signs[i] === 0) { i++; continue; }
    let j = i;
    while (j < signs.length && signs[j] === signs[i]) j++;
    const len = j - i;
    if (len >= minLen) cb(signs[i]!, i, j - 1, len);
    i = j;
  }
}

// Deteccion de puntos fuera de control estadistico y de rachas anomalas
// (version simplificada de las reglas de Nelson/Western Electric).
// Esto es DISTINTO de "FUERA DE TOLERANCIA" (que compara contra el criterio tecnico activo):
// aqui se evalua el comportamiento estadistico de la serie de mediciones en si misma.
export function detectControlViolations(values: number[], stats: StatsResult): ControlAnalysis {
  const outOfControlPoints: ControlPoint[] = [];
  values.forEach((v, i) => {
    if (v > stats.ucl || v < stats.lcl) outOfControlPoints.push({ index: i, value: v });
  });

  const anomalousSequences: AnomalousSequence[] = [];
  const MIN_SIDE_RUN = 7;
  const MIN_TREND_RUN = 6;

  const sideSigns = values.map((v) => (v > stats.mean ? 1 : v < stats.mean ? -1 : 0));
  findRuns(sideSigns, MIN_SIDE_RUN, (sign, start, end, len) => {
    anomalousSequences.push({
      type: sign > 0 ? "desplazamiento_superior" : "desplazamiento_inferior",
      label: `${len} valores consecutivos ${sign > 0 ? "por encima" : "por debajo"} de la media`,
      startIndex: start,
      endIndex: end,
      length: len,
    });
  });

  const diffSigns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    diffSigns.push(values[i] === values[i - 1] ? 0 : values[i]! > values[i - 1]! ? 1 : -1);
  }
  findRuns(diffSigns, MIN_TREND_RUN, (sign, start, end, len) => {
    anomalousSequences.push({
      type: sign > 0 ? "tendencia_creciente" : "tendencia_decreciente",
      label: `${len + 1} valores consecutivos en ${sign > 0 ? "aumento" : "descenso"}`,
      startIndex: start,
      endIndex: end + 1,
      length: len + 1,
    });
  });

  return { outOfControlPoints, anomalousSequences };
}

