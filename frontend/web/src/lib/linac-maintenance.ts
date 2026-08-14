import { sql } from "@/lib/db";
import { ensureAlertsTables } from "@/lib/linac-alerts";

let ensured = false;

export async function ensureMaintenanceExtendedTables() {
if (ensured) return;

await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS maintenance_time TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS engineer TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS engineer_rut TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS spare_parts TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS downtime_hours NUMERIC`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS result TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completado'`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS next_maintenance_date DATE`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS semaphore TEXT NOT NULL DEFAULT 'verde'`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS photo_file_name TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS photo_blob_url TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS photo_mime_type TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS document_file_name TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS document_blob_url TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS document_mime_type TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;

// Fase 6.10 (Tarea 43): Integracion con Mantenimiento. Estas columnas permiten
// que una orden de mantenimiento herede automaticamente el contexto de una
// desviacion repetitiva detectada por el Motor Cientifico (alerta, parametro,
// medicion, referencia, desviacion, criterio y su documento de respaldo) sin
// volver a pedir esos datos al usuario. Nunca se sobrescribe informacion
// historica: son columnas nuevas, opcionales, agregadas de forma aditiva.
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS source_alert_id INTEGER`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS source_decision_id INTEGER`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS parameter_name TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS source_module TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS criteria_id INTEGER`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS reference_value TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS deviation_pct NUMERIC`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS repetition_count INTEGER`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS history_snapshot JSONB`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS requested_by TEXT`;
await sql`ALTER TABLE linac_maintenance ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual'`;

await sql`
CREATE TABLE IF NOT EXISTS linac_maintenance_alerts (
id SERIAL PRIMARY KEY,
linac_id INTEGER REFERENCES linac_units(id) ON DELETE CASCADE,
record_id INTEGER,
maintenance_type TEXT,
semaphore TEXT NOT NULL,
message TEXT NOT NULL,
status TEXT NOT NULL DEFAULT 'abierta',
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
resolved_at TIMESTAMPTZ,
resolved_by TEXT
);
`;

ensured = true;
}

export const MAINTENANCE_TYPES: { value: string; label: string }[] = [
{ value: "preventivo", label: "Preventivo" },
{ value: "correctivo", label: "Correctivo" },
{ value: "predictivo", label: "Predictivo" },
];

export const MAINTENANCE_RESULTS: { value: string; label: string }[] = [
{ value: "exitoso", label: "Exitoso" },
{ value: "parcial", label: "Parcial" },
{ value: "fallido", label: "Fallido" },
];

export const MAINTENANCE_STATUSES: { value: string; label: string }[] = [
{ value: "completado", label: "Completado" },
{ value: "pendiente", label: "Pendiente" },
{ value: "en_proceso", label: "En Proceso" },
];

export function daysUntilMaintenance(dateValue: any): number | null {
if (!dateValue) return null;
const target = new Date(dateValue);
if (Number.isNaN(target.getTime())) return null;
const now = new Date();
const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function computeMaintenanceSemaphore(result: any, status: any, nextMaintenanceDate: any): string {
if (result === "fallido") return "rojo";
const days = daysUntilMaintenance(nextMaintenanceDate);
if (days !== null && days < 0) return "rojo";
if (result === "parcial") return "amarillo";
if (days !== null && days <= 30) return "amarillo";
if (status === "pendiente") return "amarillo";
return "verde";
}

export function computeMTBF(totalOperatingHours: any, correctiveCount: any): number | null {
const hours = Number(totalOperatingHours || 0);
const count = Number(correctiveCount || 0);
if (count <= 0) return null;
return Math.round((hours / count) * 10) / 10;
}

export function computeMTTR(totalDowntimeHours: any, correctiveCount: any): number | null {
const hours = Number(totalDowntimeHours || 0);
const count = Number(correctiveCount || 0);
if (count <= 0) return null;
return Math.round((hours / count) * 100) / 100;
}

export function computeMaintenanceAvailability(mtbf: any, mttr: any): number | null {
const m = Number(mtbf);
const r = Number(mttr);
if (!mtbf || !mttr || Number.isNaN(m) || Number.isNaN(r) || m + r <= 0) return null;
return Math.round((m / (m + r)) * 1000) / 10;
}

export async function generateMaintenanceAlert(linacId: any, recordId: any, maintenanceType: any, semaphore: any, message: any) {
try {
await sql`
INSERT INTO linac_maintenance_alerts (linac_id, record_id, maintenance_type, semaphore, message)
VALUES (${linacId}, ${recordId}, ${maintenanceType}, ${semaphore}, ${message})
`;
} catch (err) {
console.error("generateMaintenanceAlert failed", err);
}
}

export async function checkMaintenanceDueAlert(linacId: any, recordId: any, maintenanceType: any, typeLabel: any, nextMaintenanceDate: any) {
const days = daysUntilMaintenance(nextMaintenanceDate);
if (days === null) return;
if (days <= 30) {
const message = "Mantenimiento " + typeLabel + " programado " + (days < 0 ? "vencido hace " + Math.abs(days) + " dias." : "vence en " + days + " dias.");
await generateMaintenanceAlert(linacId, recordId, maintenanceType, days < 0 ? "rojo" : "amarillo", message);
}
}

export async function logMaintenanceAudit(action: string, actorEmail: string | null, details: any) {
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
VALUES (${actorEmail}, ${action}, 'linac_maintenance', ${JSON.stringify(details || {})}::jsonb)
`;
} catch (err) {
console.error("logMaintenanceAudit failed", err);
}
}

// ---------------------------------------------------------------------------
// Fase 6.10 (Tarea 43): INTEGRACION CON MANTENIMIENTO
// ---------------------------------------------------------------------------
// Cuenta cuantas veces se ha detectado una alerta cientifica para el mismo
// equipo + modulo + parametro (independiente del estado de cada alerta) y
// devuelve el historial completo (mediciones, referencias, desviaciones y
// fechas) para poder heredarlo sin volver a pedirlo. Esto NO reemplaza el
// Motor de Tendencias: es una cuenta simple de repeticiones, tal como exige
// la tarea ("cuando exista una desviacion repetitiva").
export async function getRepeatedDeviationInfo(linacId: number | null, moduleName: string, parameterName: string) {
await ensureAlertsTables();
const { rows } = await sql`
SELECT id, measured_value, reference_value, deviation_pct, level, status, created_at
FROM linac_scientific_alerts
WHERE module = ${moduleName}
AND lower(parameter_name) = lower(${parameterName})
AND (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
ORDER BY created_at ASC
LIMIT 200
`;
return { count: rows.length, history: rows };
}

// Evita crear ordenes duplicadas si ya existe una generada desde la misma alerta.
export async function findMaintenanceOrderByAlert(alertId: number) {
const { rows } = await sql`
SELECT * FROM linac_maintenance WHERE source_alert_id = ${alertId} ORDER BY id DESC LIMIT 1
`;
return rows[0] || null;
}

// Construye el texto de observaciones heredando automaticamente equipo,
// parametro, mediciones, baseline/referencia, criterio/fuente, documento y
// responsable. Nunca inventa valores: solo transcribe lo ya registrado.
export function buildInheritedObservations(ctx: {
parameterName: string;
moduleName: string;
measuredValue: any;
referenceValue: any;
deviationPct: any;
criteriaSourceName?: string | null;
documentName?: string | null;
documentVersion?: string | null;
page?: string | null;
section?: string | null;
repetitionCount: number;
requestedBy?: string | null;
alertId: number;
decisionJustification?: string | null;
}): string {
const lines: string[] = [];
lines.push("ORDEN GENERADA AUTOMATICAMENTE DESDE EL MOTOR CIENTIFICO (desviacion repetitiva detectada).");
lines.push("Modulo/Equipo: " + ctx.moduleName);
lines.push("Parametro: " + ctx.parameterName);
lines.push(
"Valor medido: " + (ctx.measuredValue ?? "-") + " / Valor de referencia (baseline/criterio): " + (ctx.referenceValue ?? "-")
);
lines.push(
"Desviacion: " +
(ctx.deviationPct !== null && ctx.deviationPct !== undefined ? Number(ctx.deviationPct).toFixed(2) + "%" : "-")
);
lines.push("Criterio / Fuente: " + (ctx.criteriaSourceName || "CRITERIO PENDIENTE DE PARAMETRIZACION"));
if (ctx.documentName) {
lines.push(
"Documento de respaldo: " +
ctx.documentName +
(ctx.documentVersion ? " (v" + ctx.documentVersion + ")" : "") +
(ctx.page ? " - Pag. " + ctx.page : "") +
(ctx.section ? " - " + ctx.section : "")
);
}
lines.push("Repeticiones detectadas para este parametro: " + ctx.repetitionCount);
lines.push("Alerta cientifica de origen: #" + ctx.alertId);
if (ctx.requestedBy) lines.push("Solicitado por: " + ctx.requestedBy);
if (ctx.decisionJustification) lines.push("Justificacion registrada en la decision: " + ctx.decisionJustification);
lines.push("Datos heredados automaticamente. No se solicito reingresar informacion ya existente en el sistema.");
return lines.join("\n");
}
