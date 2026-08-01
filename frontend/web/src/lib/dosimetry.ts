import { sql } from '@/lib/db';

// Utilidades y logica compartida del modulo Dosimetria. Centraliza la
// creacion/migracion de tablas y las reglas de negocio para que Manual,
// CSV/Excel, PDF y Devoluciones se mantengan siempre consistentes entre si
// y fieles a la planilla oficial 'Resumen - 908.xlsm' del laboratorio de
// dosimetria (hojas 'Reportes por trimestre', 'Resumen anual', 'Devueltos
// fuera de plazo', 'No devueltos', 'Lista de devolucion' y 'siglas').

// Codigos cualitativos que reemplazan una lectura numerica en la hoja
// 'Reportes por trimestre' (ver hoja 'siglas' de la planilla oficial). Se
// preservan tal cual en las columnas *_code y se tratan como 0 solo para
// efectos de sumas/acumulados.
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

// Opciones fijas de la hoja 'Lista de devolucion' (celda D7 / hoja
// 'opciones devolucion') de la planilla oficial.
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

// Si el valor original corresponde a un codigo cualitativo reconocido, lo
// retorna tal cual (para preservarlo en las columnas *_code); en caso
// contrario retorna null (valor numerico normal, sin codigo asociado).
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

// Crea/actualiza de forma idempotente todas las tablas del modulo Dosimetria.
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
}
