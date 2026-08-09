import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";
import {
ensureMaintenanceExtendedTables,
computeMaintenanceSemaphore,
generateMaintenanceAlert,
checkMaintenanceDueAlert,
logMaintenanceAudit,
MAINTENANCE_TYPES,
} from "@/lib/linac-maintenance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
await ensureLinacTables();
await ensureMaintenanceExtendedTables();
const { searchParams } = new URL(request.url);
const linacId = searchParams.get("linacId");
const maintenanceType = searchParams.get("maintenanceType");
const status = searchParams.get("status");
const { rows } = await sql`
SELECT m.*, w.name AS engineer_name
FROM linac_maintenance m
LEFT JOIN workers w ON w.rut = m.engineer_rut
WHERE (${linacId}::int IS NULL OR m.linac_id = ${linacId}::int)
AND (${maintenanceType}::text IS NULL OR m.maintenance_type = ${maintenanceType}::text)
AND (${status}::text IS NULL OR m.status = ${status}::text)
ORDER BY m.maintenance_date DESC, m.id DESC
LIMIT 1000;
`;
return NextResponse.json({ ok: true, records: rows });
}

export async function POST(request: Request) {
await ensureLinacTables();
await ensureMaintenanceExtendedTables();
const form = await request.formData();
const file = form.get("file");
const photoFile = form.get("photoFile");
const documentFile = form.get("documentFile");
const linacId = Number(form.get("linacId"));
const maintenanceType = String(form.get("maintenanceType") || "").trim();
const maintenanceDate = String(form.get("maintenanceDate") || "").trim();
const maintenanceTime = (form.get("maintenanceTime") as string) || null;
const company = (form.get("company") as string) || null;
const engineer = (form.get("engineer") as string) || null;
const engineerRut = (form.get("engineerRut") as string) || null;
const spareParts = (form.get("spareParts") as string) || null;
const hours = (form.get("hours") as string) || null;
const downtimeHours = (form.get("downtimeHours") as string) || null;
const cost = (form.get("cost") as string) || null;
const result = (form.get("result") as string) || null;
const status = (form.get("status") as string) || "completado";
const nextMaintenanceDate = (form.get("nextMaintenanceDate") as string) || null;
const observations = (form.get("observations") as string) || null;
const actorEmail = (form.get("actorEmail") as string) || null;

if (!linacId || !maintenanceType || !maintenanceDate) {
return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}

let blobUrl: string | null = null;
let fileName: string | null = null;
let mimeType: string | null = null;
if (file instanceof File && file.size > 0) {
const pathname = `linac/maintenance/${linacId}/informe/${Date.now()}-${file.name}`;
const blob = await put(pathname, file, { access: "private" });
blobUrl = blob.url;
fileName = file.name;
mimeType = file.type || null;
}

let photoBlobUrl: string | null = null;
let photoFileName: string | null = null;
let photoMimeType: string | null = null;
if (photoFile instanceof File && photoFile.size > 0) {
const pathname = `linac/maintenance/${linacId}/foto/${Date.now()}-${photoFile.name}`;
const blob = await put(pathname, photoFile, { access: "private" });
photoBlobUrl = blob.url;
photoFileName = photoFile.name;
photoMimeType = photoFile.type || null;
}

let documentBlobUrl: string | null = null;
let documentFileName: string | null = null;
let documentMimeType: string | null = null;
if (documentFile instanceof File && documentFile.size > 0) {
const pathname = `linac/maintenance/${linacId}/documento/${Date.now()}-${documentFile.name}`;
const blob = await put(pathname, documentFile, { access: "private" });
documentBlobUrl = blob.url;
documentFileName = documentFile.name;
documentMimeType = documentFile.type || null;
}

const semaphore = computeMaintenanceSemaphore(result, status, nextMaintenanceDate);

const { rows } = await sql`
INSERT INTO linac_maintenance (
linac_id, maintenance_type, maintenance_date, maintenance_time, company, engineer, engineer_rut,
spare_parts, hours, downtime_hours, cost, result, status, next_maintenance_date, semaphore, observations,
file_name, blob_url, mime_type, photo_file_name, photo_blob_url, photo_mime_type,
document_file_name, document_blob_url, document_mime_type, updated_at
) VALUES (
${linacId}, ${maintenanceType}, ${maintenanceDate}, ${maintenanceTime}, ${company}, ${engineer}, ${engineerRut},
${spareParts}, ${hours}, ${downtimeHours}, ${cost}, ${result}, ${status}, ${nextMaintenanceDate}, ${semaphore}, ${observations},
${fileName}, ${blobUrl}, ${mimeType}, ${photoFileName}, ${photoBlobUrl}, ${photoMimeType},
${documentFileName}, ${documentBlobUrl}, ${documentMimeType}, now()
)
RETURNING id;
`;

const recordId = rows[0]!.id;
const typeLabel = (MAINTENANCE_TYPES.find((t: any) => t.value === maintenanceType) || { label: maintenanceType }).label;

if (semaphore !== "verde") {
const msg = "Mantenimiento " + typeLabel + " con resultado " + (result || status) + ": semaforo " + semaphore + ".";
await generateMaintenanceAlert(linacId, recordId, maintenanceType, semaphore, msg);
}
if (nextMaintenanceDate) {
await checkMaintenanceDueAlert(linacId, recordId, maintenanceType, typeLabel, nextMaintenanceDate);
}

await logLinacAudit("create_linac_maintenance", actorEmail, { linacId, maintenanceType, maintenanceDate });
await logMaintenanceAudit("create_linac_maintenance", actorEmail, { linacId, maintenanceType, semaphore, recordId });

return NextResponse.json({ ok: true, id: recordId, semaphore });
}

export async function PATCH(request: Request) {
await ensureMaintenanceExtendedTables();
const body = await request.json();
const id = Number(body.id);
const status = String(body.status || "").trim();
const actorEmail = body.actorEmail || null;
if (!id || !status) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
await sql`UPDATE linac_maintenance SET status = ${status}, updated_at = now() WHERE id = ${id}`;
await logMaintenanceAudit("update_linac_maintenance_status", actorEmail, { id, status });
return NextResponse.json({ ok: true });
}
