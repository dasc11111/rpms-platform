import { sql } from '@/lib/db';

// Utilidades y logica compartida del modulo Dosimetria. Centraliza la
// creacion/migracion de tablas y las reglas de negocio para que Manual,
// CSV/Excel, PDF y Devoluciones se mantengan siempre consistentes entre si
// y fieles a la planilla oficial 'Resumen - 908.xlsm' del laboratorio de
// dosimetria (hojas 'Reportes por trimestre', 'Resumen anual', 'Devueltos
// fuera de plazo', 'No devueltos', 'Lista de devolucion' y 'siglas').

export const DOSE_QUALITATIVE_CODES: Record<string, string> = {
  MNR: 'Minimo Nivel de Registro (dosis entre 0,01 y 0,09 mSv)',
  NU: 'Dosimetro No Usado',
  NS: 'Dosimetro No Solicitado',
  NR: 'Dosimetro No Recepcionado',
  DD: 'Dosimetro Danado (no es posible leerlo por danos fisicos)',
  PL: 'Dosimetro Contaminado',
};

export const DOSIMETER_KIND_CODES: Record<string, string> = {
  I1: 'Dosimetro de cuerpo entero',
  I7: 'Dosimetro de cuerpo entero',
  I2: 'Dosimetro de area / ambiental / referencia',
  I5: 'Dosimetro de pulsera',
  MF: 'Monitor fetal',
};

export const RADIATION_CODES: Record<string, string> = {
  PH: 'Foton de alta energia',
  PM: 'Foton de mediana energia',
  PL: 'Foton de baja energia',
  BH: 'Beta de alta energia',
  BM: 'Beta de mediana energia',
  BL: 'Beta de baja energia',
};

export const ANNUAL_STATUS_CODES: Record<string, string> = {
  Activo: 'La persona tiene dosimetro asignado actualmente',
  Inactivo: 'La persona no tiene dosimetro asignado actualmente',
};

export const DOSIMETER_TYPES = ['C.E.', 'EXTREMIDAD'] as const;

export const RETURN_STATUSES = [
  'Usado',
  'No usado',
  'Danado',
  'Irradiado el dosimetro, no la persona',
] as const;

export function toNum(v: unknown): number {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s || s in DOSE_QUALITATIVE_CODES) return 0;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function qualCode(v: unknown): string | null {
  const s = String(v ?? '').trim().toUpperCase();
  return s in DOSE_QUALITATIVE_CODES ? s : null;
}

export function levelFor(dose: number): string {
  if (dose >= 5) return 'intervencion';
  if (dose >= 1.6) return 'investigacion';
  if (dose >= 0.1) return 'registro';
  return 'normal';
}

export function parsePeriodo(p: unknown): { year: number; quarter: number; label: string } | null {
  const m = String(p ?? '').match(/T\s*([1-4])\s*-\s*(\d{4})/i);
  if (!m) return null;
  return { quarter: Number(m[1]), year: Number(m[2]), label: `T${m[1]}-${m[2]}` };
}

export async function ensureDosimetryTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_quarterly (
      id SERIAL PRIMARY KEY,
      worker_rut TEXT NOT NULL,
      worker_name TEXT,
      institucion TEXT,
      departamento TEXT,
      year INT NOT NULL,
      quarter INT NOT NULL,
      period_label TEXT NOT NULL,
      dose_body NUMERIC DEFAULT 0,
      dose_lens NUMERIC DEFAULT 0,
      dose_skin NUMERIC DEFAULT 0,
      accum_year_body NUMERIC DEFAULT 0,
      accum_12m_body NUMERIC DEFAULT 0,
      accum_60m_body NUMERIC DEFAULT 0,
      accum_60m_lens NUMERIC DEFAULT 0,
      accum_60m_skin NUMERIC DEFAULT 0,
      level TEXT,
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'C.E.'`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS dosimetro TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS radiacion TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS proceso TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS dose_body_code TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS dose_lens_code TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS dose_skin_code TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS accum_year_lens NUMERIC DEFAULT 0`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS accum_year_skin NUMERIC DEFAULT 0`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS accum_12m_lens NUMERIC DEFAULT 0`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS accum_12m_skin NUMERIC DEFAULT 0`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS source_document_id INTEGER`;

  // Compatibilidad con la importacion PDF (hoja 'Reportes por trimestre'
  // leida por OCR), que historicamente escribio el codigo de dosimetro,
  // tipo y radiacion en columnas con otro nombre. Se agregan aqui tambien
  // para poder unificarlas en una sola columna canonica sin perder datos.
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS dosimeter_number TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS dosimeter_type TEXT`;
  await sql`ALTER TABLE dosimetry_quarterly ADD COLUMN IF NOT EXISTS radiation_type TEXT`;
  await sql`UPDATE dosimetry_quarterly SET dosimetro = dosimeter_number WHERE (dosimetro IS NULL OR dosimetro = '') AND dosimeter_number IS NOT NULL AND dosimeter_number <> ''`;
  await sql`UPDATE dosimetry_quarterly SET radiacion = radiation_type WHERE (radiacion IS NULL OR radiacion = '') AND radiation_type IS NOT NULL AND radiation_type <> ''`;
  await sql`UPDATE dosimetry_quarterly SET tipo = 'EXTREMIDAD' WHERE dosimeter_type ILIKE '%EXTREM%' AND tipo <> 'EXTREMIDAD'`;

  try {
    await sql`ALTER TABLE dosimetry_quarterly DROP CONSTRAINT IF EXISTS dosimetry_quarterly_worker_rut_year_quarter_key`;
  } catch {}
  try {
    await sql`ALTER TABLE dosimetry_quarterly ADD CONSTRAINT dosimetry_quarterly_unique_key UNIQUE (worker_rut, year, quarter, tipo)`;
  } catch {}

  await sql`CREATE INDEX IF NOT EXISTS idx_dosimetry_quarterly_dosimetro ON dosimetry_quarterly(dosimetro)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dosimetry_quarterly_worker ON dosimetry_quarterly(worker_rut)`;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_returns (
      id SERIAL PRIMARY KEY,
      dosimeter_code TEXT NOT NULL,
      unidad TEXT,
      worker_rut TEXT,
      worker_name TEXT,
      period_label TEXT,
      estado TEXT NOT NULL,
      observaciones TEXT,
      registered_by TEXT,
      registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_dosimetry_returns_code ON dosimetry_returns(dosimeter_code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dosimetry_returns_worker ON dosimetry_returns(worker_rut)`;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_lost_flags (
      id SERIAL PRIMARY KEY,
      dosimeter_code TEXT NOT NULL,
      period_label TEXT NOT NULL,
      extraviado BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (dosimeter_code, period_label)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS dosimetry_column_config (
      field_key TEXT PRIMARY KEY,
      label TEXT,
      keyword_sets JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

// ---------------------------------------------------------------------------
// Hoja 'No devueltos': dosimetros informados en 'Reportes por trimestre' que
// aun no tienen un registro de devolucion (hoja 'Lista de devolucion') para
// el mismo periodo. El flag 'extraviado' se persiste en dosimetry_lost_flags
// y puede alternarse desde la vista sin perder el resto del calculo, que
// siempre se deriva en vivo de los datos oficiales.
export type NotReturnedRow = {
  dosimetro: string;
  institucion: string | null;
  unidad: string | null;
  nombrepart: string | null;
  dcto: string | null;
  tipod: string | null;
  trimestre_d: string | null;
  extraviado: boolean;
};

export async function getNotReturned(): Promise<NotReturnedRow[]> {
  await ensureDosimetryTables();
  const { rows } = await sql`
    SELECT q.dosimetro, q.institucion, q.departamento AS unidad, q.worker_name AS nombrepart,
      q.worker_rut AS dcto, q.tipo AS tipod, q.period_label AS trimestre_d,
      COALESCE(f.extraviado, false) AS extraviado
    FROM dosimetry_quarterly q
    LEFT JOIN dosimetry_returns r ON r.dosimeter_code = q.dosimetro AND r.period_label = q.period_label
    LEFT JOIN dosimetry_lost_flags f ON f.dosimeter_code = q.dosimetro AND f.period_label = q.period_label
    WHERE q.dosimetro IS NOT NULL AND q.dosimetro <> '' AND r.id IS NULL
    ORDER BY q.year DESC, q.quarter DESC, q.worker_name ASC
  `;
  return rows.map((r: any) => ({ ...r, extraviado: Boolean(r.extraviado) })) as NotReturnedRow[];
}

export async function setLostFlag(dosimetro: string, periodLabel: string, extraviado: boolean) {
  await ensureDosimetryTables();
  await sql`
    INSERT INTO dosimetry_lost_flags (dosimeter_code, period_label, extraviado, updated_at)
    VALUES (${dosimetro}, ${periodLabel}, ${extraviado}, now())
    ON CONFLICT (dosimeter_code, period_label) DO UPDATE SET extraviado = EXCLUDED.extraviado, updated_at = now()
  `;
}

// ---------------------------------------------------------------------------
// Hoja 'Resumen anual': un renglon por (trabajador, tipo de dosimetro, ano)
// con la dosis de cada trimestre y el total anual. En la planilla original
// estos valores estan pegados como texto/numero fijo; aqui se calculan en
// vivo a partir de 'Reportes por trimestre' para que nunca queden
// desactualizados, conservando el mismo layout de columnas.
export type AnnualSummaryRow = {
  institucion: string | null;
  departamento: string | null;
  nombre: string | null;
  run: string;
  estado: string;
  tipod: string;
  anio: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  total: number;
};

export async function getAnnualSummary(): Promise<AnnualSummaryRow[]> {
  await ensureDosimetryTables();
  const { rows } = await sql`
    SELECT q.institucion, q.departamento, q.worker_name AS nombre, q.worker_rut AS run,
      q.tipo AS tipod, q.year AS anio,
      SUM(CASE WHEN q.quarter = 1 THEN q.dose_body ELSE 0 END) AS t1,
      SUM(CASE WHEN q.quarter = 2 THEN q.dose_body ELSE 0 END) AS t2,
      SUM(CASE WHEN q.quarter = 3 THEN q.dose_body ELSE 0 END) AS t3,
      SUM(CASE WHEN q.quarter = 4 THEN q.dose_body ELSE 0 END) AS t4,
      SUM(q.dose_body) AS total,
      MAX(w.status) AS worker_status
    FROM dosimetry_quarterly q
    LEFT JOIN workers w ON w.rut = q.worker_rut
    GROUP BY q.institucion, q.departamento, q.worker_name, q.worker_rut, q.tipo, q.year
    ORDER BY q.year DESC, q.worker_name ASC
  `;
  return rows.map((r: any) => ({
    institucion: r.institucion,
    departamento: r.departamento,
    nombre: r.nombre,
    run: r.run,
    tipod: r.tipod,
    anio: r.anio,
    t1: Number(r.t1) || 0,
    t2: Number(r.t2) || 0,
    t3: Number(r.t3) || 0,
    t4: Number(r.t4) || 0,
    total: Number(r.total) || 0,
    estado: r.worker_status && r.worker_status !== 'inactive' ? 'Activo' : 'Inactivo',
  }));
}

// ---------------------------------------------------------------------------
// Hoja 'Devueltos fuera de plazo': dosimetros cuya fecha de proceso/lectura
// de laboratorio quedo mas de 45 dias despues del cierre del trimestre
// informado. Se calcula en JS (no en SQL) para tolerar formatos de fecha
// no estandar sin que una fila invalida rompa el resto del reporte.
export type LateReturnRow = {
  institucion: string | null;
  departamento: string | null;
  nombre: string | null;
  run: string;
  period_label: string;
  dosimetro: string | null;
  fecha_lectura: string | null;
  alerta_dosis: boolean;
};

const QUARTER_END: Record<number, [number, number]> = { 1: [2, 31], 2: [5, 30], 3: [8, 30], 4: [11, 31] };

export async function getLateReturns(): Promise<LateReturnRow[]> {
  await ensureDosimetryTables();
  const { rows } = await sql`
    SELECT institucion, departamento, worker_name AS nombre, worker_rut AS run, period_label,
      dosimetro, proceso AS fecha_lectura, level, year, quarter
    FROM dosimetry_quarterly
    WHERE proceso IS NOT NULL AND proceso <> ''
  `;
  const out: LateReturnRow[] = [];
  const graceMs = 45 * 24 * 60 * 60 * 1000;
  for (const r of rows as any[]) {
    const m = String(r.fecha_lectura).match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (!m) continue;
    const procesoDate = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const qe = QUARTER_END[Number(r.quarter)];
    if (!qe) continue;
    const quarterEnd = new Date(Number(r.year), qe[0], qe[1]);
    if (procesoDate.getTime() > quarterEnd.getTime() + graceMs) {
      out.push({
        institucion: r.institucion,
        departamento: r.departamento,
        nombre: r.nombre,
        run: r.run,
        period_label: r.period_label,
        dosimetro: r.dosimetro,
        fecha_lectura: r.fecha_lectura,
        alerta_dosis: Boolean(r.level && r.level !== 'normal'),
      });
    }
  }
  return out;
}


// ---------------------------------------------------------------------------
// Importacion inteligente: reconocimiento automatico de columnas para la
// hoja 'Reportes por trimestre'. Cada campo tiene un set de palabras clave
// por defecto (igual al formato oficial actual). Si el laboratorio cambia
// el nombre de una columna, el sistema pedira una unica vez que se indique
// a que campo corresponde y aprendera esa asociacion para futuras cargas,
// sin necesidad de modificar el codigo.
export type QuarterlyFieldDef = {
  key: string;
  label: string;
  required: boolean;
  keywordSets: string[][];
};

export const QUARTERLY_FIELD_DEFS: QuarterlyFieldDef[] = [
  { key: 'institucion', label: 'Institucion', required: false, keywordSets: [['instituci']] },
  { key: 'departamento', label: 'Departamento', required: false, keywordSets: [['departamento']] },
  { key: 'periodo', label: 'Periodo', required: true, keywordSets: [['periodo']] },
  { key: 'nombre', label: 'Nombre', required: false, keywordSets: [['nombre']] },
  { key: 'run', label: 'RUN / RUT', required: true, keywordSets: [['run'], ['rut']] },
  { key: 'dosis_cuerpo_cualitativo', label: 'Hp(10) cualitativo', required: false, keywordSets: [['cuerpo entero', 'cualitativo']] },
  { key: 'dosis_cristalino_cualitativo', label: 'Hp(3) cualitativo', required: false, keywordSets: [['cristalino', 'cualitativo']] },
  { key: 'dosis_piel_cualitativo', label: 'Hp(0.07) cualitativo', required: false, keywordSets: [['piel', 'cualitativo']] },
  { key: 'dosis_cuerpo_cuantitativo', label: 'Hp(10) cuantitativo', required: true, keywordSets: [['cuerpo entero', 'cuantitativo']] },
  { key: 'dosis_cristalino_cuantitativo', label: 'Hp(3) cuantitativo', required: false, keywordSets: [['cristalino', 'cuantitativo']] },
  { key: 'dosis_piel_cuantitativo', label: 'Hp(0.07) cuantitativo', required: false, keywordSets: [['piel', 'cuantitativo']] },
  { key: 'acum_anio_cuerpo', label: 'Suma Hp(10) ano cal.', required: false, keywordSets: [['cuerpo entero', 'ano calendario']] },
  { key: 'acum_anio_cristalino', label: 'Suma Hp(3) ano cal.', required: false, keywordSets: [['cristalino', 'ano calendario']] },
  { key: 'acum_anio_piel', label: 'Suma piel ano cal.', required: false, keywordSets: [['piel', 'ano calendario']] },
  { key: 'acum_12m_cuerpo', label: 'Suma Hp(10) 12m', required: false, keywordSets: [['cuerpo entero', '12 meses']] },
  { key: 'acum_12m_cristalino', label: 'Suma Hp(3) 12m', required: false, keywordSets: [['cristalino', '12 meses']] },
  { key: 'acum_12m_piel', label: 'Suma piel 12m', required: false, keywordSets: [['piel', '12 meses']] },
  { key: 'acum_60m_cuerpo', label: 'Suma Hp(10) 60m', required: false, keywordSets: [['cuerpo entero', '60 meses']] },
  { key: 'acum_60m_cristalino', label: 'Suma Hp(3) 60m', required: false, keywordSets: [['cristalino', '60 meses']] },
  { key: 'acum_60m_piel', label: 'Suma piel 60m', required: false, keywordSets: [['piel', '60 meses']] },
  { key: 'tipo', label: 'Tipo', required: false, keywordSets: [['tipo']] },
  { key: 'radiacion', label: 'Radiacion', required: false, keywordSets: [['radiacion']] },
  { key: 'proceso', label: 'Proceso', required: false, keywordSets: [['proceso']] },
  { key: 'dosimetro', label: 'Dosimetro', required: false, keywordSets: [['dosimetro']] },
];

export async function getQuarterlyColumnConfig(): Promise<QuarterlyFieldDef[]> {
  await ensureDosimetryTables();
  const { rows } = await sql`SELECT field_key, keyword_sets FROM dosimetry_column_config`;
  const overrides = new Map<string, string[][]>();
  for (const r of rows as any[]) overrides.set(r.field_key, r.keyword_sets);
  return QUARTERLY_FIELD_DEFS.map((f) => ({
    ...f,
    keywordSets: overrides.get(f.key) ?? f.keywordSets,
  }));
}

export async function learnQuarterlyColumnMapping(fieldKey: string, headerText: string): Promise<boolean> {
  await ensureDosimetryTables();
  const def = QUARTERLY_FIELD_DEFS.find((f) => f.key === fieldKey);
  if (!def) return false;
  const normalized = String(headerText ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!normalized) return false;
  const { rows } = await sql`SELECT keyword_sets FROM dosimetry_column_config WHERE field_key = ${fieldKey}`;
  const current: string[][] = rows[0]?.keyword_sets ?? def.keywordSets;
  const alreadyLearned = current.some((g) => g.length === 1 && g[0] === normalized);
  const updated = alreadyLearned ? current : [...current, [normalized]];
  await sql`
    INSERT INTO dosimetry_column_config (field_key, label, keyword_sets, updated_at)
    VALUES (${fieldKey}, ${def.label}, ${JSON.stringify(updated)}::jsonb, now())
    ON CONFLICT (field_key) DO UPDATE SET keyword_sets = ${JSON.stringify(updated)}::jsonb, updated_at = now()
  `;
  return true;
}


// ---------------------------------------------------------------------------
// Alerta automatica de dosis (>5 mSv). Capa adicional de deteccion que NO
// reemplaza la clasificacion existente (levelFor/Registro-Investigacion-
// Intervencion). El umbral es estrictamente mayor a 5 mSv: 5,00 mSv no
// genera alerta, 5,01 mSv si la genera.
export function isDoseAlert(dose: number): boolean {
    return dose > 5;
}

export type QuarterlyDoseAlertWorker = {
    worker_rut: string;
    worker_name: string;
    dose_body: number;
};

export type QuarterlyDoseAlertSummary = {
    year: number;
    quarter: number;
    period_label: string;
    totalEvaluated: number;
    maxDose: number;
    workersOverThreshold: QuarterlyDoseAlertWorker[];
};

export type DoseAlertInputRow = {
    worker_rut: string;
    worker_name: string;
    year: number;
    quarter: number;
    period_label: string;
    dose_body: number;
};

export function buildQuarterlyDoseAlertSummaries(inputRows: DoseAlertInputRow[]): QuarterlyDoseAlertSummary[] {
    const byPeriod = new Map<string, DoseAlertInputRow[]>();
    for (const r of inputRows) {
          const key = r.period_label || `T${r.quarter}-${r.year}`;
          const list = byPeriod.get(key) ?? [];
          list.push(r);
          byPeriod.set(key, list);
    }

  const summaries: QuarterlyDoseAlertSummary[] = [];
    for (const [label, list] of byPeriod.entries()) {
          const byWorker = new Map<string, DoseAlertInputRow>();
          for (const r of list) {
                  const existing = byWorker.get(r.worker_rut);
                  if (!existing || r.dose_body > existing.dose_body) byWorker.set(r.worker_rut, r);
          }
          const workers = Array.from(byWorker.values());
          const totalEvaluated = workers.length;
          const maxDose = workers.reduce((m, w) => Math.max(m, w.dose_body), 0);
          const workersOverThreshold = workers
            .filter((w) => isDoseAlert(w.dose_body))
            .sort((a, b) => b.dose_body - a.dose_body)
            .map((w) => ({ worker_rut: w.worker_rut, worker_name: w.worker_name, dose_body: w.dose_body }));
          const first = list[0];    if (!first) continue;
          summaries.push({
                  year: first.year,
                  quarter: first.quarter,
                  period_label: label,
                  totalEvaluated,
                  maxDose,
                  workersOverThreshold,
          });
    }
    return summaries;
}
