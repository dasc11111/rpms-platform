import { sql } from "@/lib/db";

let ensured = false;

export async function ensureQcExtendedTables() {
if (ensured) return;

await sql`
CREATE TABLE IF NOT EXISTS linac_qc_tests (
id SERIAL PRIMARY KEY,
linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
periodicity TEXT NOT NULL,
test_name TEXT NOT NULL,
test_date DATE NOT NULL,
expected_value TEXT,
obtained_value TEXT,
tolerance TEXT,
unit TEXT,
status TEXT NOT NULL DEFAULT 'cumple',
observations TEXT,
responsible TEXT,
file_name TEXT,
blob_url TEXT,
mime_type TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS test_time TEXT;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS procedure_text TEXT;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS applicable_regulation TEXT;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS instrument_used TEXT;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS modality TEXT;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS energy TEXT;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS measurement_type TEXT;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS baseline_id INTEGER;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS baseline_version INTEGER;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS baseline_value TEXT;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS deviation_pct NUMERIC;`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS semaphore TEXT NOT NULL DEFAULT 'verde';`;
await sql`ALTER TABLE linac_qc_tests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();`;

await sql`
CREATE TABLE IF NOT EXISTS linac_qc_alerts (
id SERIAL PRIMARY KEY,
linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
qc_test_id INTEGER REFERENCES linac_qc_tests(id) ON DELETE CASCADE,
periodicity TEXT,
test_name TEXT,
semaphore TEXT NOT NULL,
message TEXT,
status TEXT NOT NULL DEFAULT 'abierta',
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
resolved_at TIMESTAMPTZ,
resolved_by TEXT
);
`;

ensured = true;
}

export const QC_TEST_TEMPLATES = [
{ periodicity: "diario", testName: "Constancia de salida (output)", procedure: "Medicion diaria de dosis relativa con camara/diodo en condiciones de referencia, comparar con linea base.", regulation: "ARPANSA RPS 14.3 / TG-142", defaultTolerance: "3", unit: "%" },
{ periodicity: "diario", testName: "Alineacion de lasers", procedure: "Verificar coincidencia de lasers sagital y lateral con isocentro mecanico.", regulation: "ARPANSA RPS 14.3 / TG-142", defaultTolerance: "2", unit: "mm" },
{ periodicity: "diario", testName: "Distancia fuente-superficie (ODI)", procedure: "Verificar indicador optico de distancia contra distancia mecanica conocida.", regulation: "ARPANSA RPS 14.3 / TG-142", defaultTolerance: "2", unit: "mm" },
{ periodicity: "diario", testName: "Interlocks de puerta y emergencia", procedure: "Verificacion funcional de interlocks de puerta, boton de parada y senalizacion.", regulation: "ARPANSA RPS 14.3", defaultTolerance: "0", unit: "funcional" },
{ periodicity: "semanal", testName: "Constancia de salida por energia", procedure: "Medicion de salida para cada energia disponible, comparar contra baseline.", regulation: "ARPANSA RPS 14.3 / TG-142", defaultTolerance: "2", unit: "%" },
{ periodicity: "semanal", testName: "Simetria del haz", procedure: "Adquisicion de perfil de haz y calculo de simetria respecto a baseline.", regulation: "TG-142", defaultTolerance: "2", unit: "%" },
{ periodicity: "semanal", testName: "Planicidad del haz", procedure: "Adquisicion de perfil de haz y calculo de planicidad respecto a baseline.", regulation: "TG-142", defaultTolerance: "3", unit: "%" },
{ periodicity: "mensual", testName: "Factor de salida (output factor)", procedure: "Medicion de factores de salida para campos representativos, comparar con Beam Data.", regulation: "TG-142", defaultTolerance: "2", unit: "%" },
{ periodicity: "mensual", testName: "Congruencia luz-radiacion", procedure: "Comparacion de campo luminoso vs campo de radiacion.", regulation: "TG-142", defaultTolerance: "2", unit: "mm" },
{ periodicity: "mensual", testName: "Posicionamiento de MLC", procedure: "Verificacion de posicionamiento de laminas mediante patron de prueba.", regulation: "TG-142", defaultTolerance: "1", unit: "mm" },
{ periodicity: "mensual", testName: "Isocentro mecanico", procedure: "Verificacion de coincidencia de isocentros de gantry, colimador y mesa.", regulation: "TG-142", defaultTolerance: "2", unit: "mm" },
{ periodicity: "trimestral", testName: "PDD / TPR", procedure: "Adquisicion de curva de PDD o TPR y comparacion contra baseline de commissioning.", regulation: "TG-142", defaultTolerance: "2", unit: "%" },
{ periodicity: "trimestral", testName: "Perfil de haz completo", procedure: "Adquisicion de perfiles completos en profundidades de referencia.", regulation: "TG-142", defaultTolerance: "2", unit: "%" },
{ periodicity: "trimestral", testName: "Factor de cuna / bandeja", procedure: "Medicion de factores de cuna y bandeja, comparacion contra baseline.", regulation: "TG-142", defaultTolerance: "2", unit: "%" },
{ periodicity: "semestral", testName: "Isocentro de radiacion (esfera)", procedure: "Verificacion de isocentro de radiacion mediante tecnica de esfera/pelicula.", regulation: "TG-142", defaultTolerance: "2", unit: "mm" },
{ periodicity: "semestral", testName: "Verificacion TPS vs medicion", procedure: "Comparacion de dosis calculada por TPS contra medicion directa en fantoma.", regulation: "TG-142 / IAEA TRS-430", defaultTolerance: "3", unit: "%" },
{ periodicity: "anual", testName: "Commissioning comparativo completo", procedure: "Repeticion de mediciones de commissioning y comparacion integral contra baseline oficial.", regulation: "ARPANSA RPS 14.3 / TG-142", defaultTolerance: "2", unit: "%" },
{ periodicity: "anual", testName: "Auditoria dosimetrica externa", procedure: "Auditoria dosimetrica independiente de la unidad de tratamiento.", regulation: "IAEA TRS-430", defaultTolerance: "3", unit: "%" },
];

export function computeDeviationPct(expected: any, obtained: any): number | null {
const e = parseFloat(expected);
const o = parseFloat(obtained);
if (!Number.isFinite(e) || !Number.isFinite(o) || e === 0) return null;
return Math.round(((o - e) / e) * 1000) / 10;
}

export function computeSemaphore(status: any, deviationPct: any, tolerancePct: any): string {
if (status === "no_cumple") return "rojo";
const tol = parseFloat(tolerancePct);
if (deviationPct === null || deviationPct === undefined || !Number.isFinite(tol) || tol <= 0) return "verde";
const dev = Math.abs(deviationPct);
if (dev <= tol) return "verde";
if (dev <= tol * 1.5) return "amarillo";
return "rojo";
}

function extractReferenceValue(data: any): number | null {
if (!data) return null;
if (typeof data.value === "number") return data.value;
if (typeof data.referenceValue === "number") return data.referenceValue;
if (Array.isArray(data.points) && data.points.length > 0) {
const p = data.points[0];
if (p && typeof p.y === "number") return p.y;
if (p && typeof p.y === "string" && Number.isFinite(parseFloat(p.y))) return parseFloat(p.y);
}
return null;
}

export async function findCurrentBaseline(linacId: any, measurementType: any, modality: any, energy: any): Promise<any> {
if (!measurementType) return null;
const { rows } = await sql`
SELECT b.id, b.version, b.approved_at, b.dataset_id, d.data
FROM linac_baselines b
LEFT JOIN linac_commissioning_datasets d ON d.id = b.dataset_id
WHERE b.linac_id = ${linacId} AND b.is_current = true
AND b.measurement_type ILIKE ${measurementType}
AND (${modality}::text IS NULL OR b.modality = ${modality}::text)
AND (${energy}::text IS NULL OR b.energy = ${energy}::text)
ORDER BY b.approved_at DESC
LIMIT 1;
`;
if (!rows[0]) return null;
const referenceValue = extractReferenceValue(rows[0].data);
return {
id: rows[0].id,
version: rows[0].version,
approvedAt: rows[0].approved_at,
datasetId: rows[0].dataset_id,
referenceValue,
};
}

export async function generateQcAlert(linacId: any, qcTestId: any, periodicity: any, testName: any, semaphore: any, message: any) {
if (semaphore === "verde") return;
await sql`
INSERT INTO linac_qc_alerts (linac_id, qc_test_id, periodicity, test_name, semaphore, message)
VALUES (${linacId}, ${qcTestId}, ${periodicity}, ${testName}, ${semaphore}, ${message});
`;
}

export async function logQcAudit(action: string, actorEmail: string | null, details: any) {
try {
await sql`
CREATE TABLE IF NOT EXISTS audit_logs (
id SERIAL PRIMARY KEY,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
actor_email TEXT,
action TEXT NOT NULL,
category TEXT,
details JSONB,
ip_address TEXT,
success BOOLEAN NOT NULL DEFAULT true
);
`;
await sql`
INSERT INTO audit_logs (actor_email, action, category, details)
VALUES (${actorEmail}, ${action}, 'linac_qc', ${JSON.stringify(details || {})}::jsonb)
`;
} catch (err) {
console.error("logQcAudit failed", err);
}
}
