import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";
import {
  ensureRadiationExtendedTables,
  computeRadiationSemaphore,
  generateRadiationAlert,
  checkDueDateAlert,
  logRadiationAudit,
  RADIATION_CATEGORIES,
} from "@/lib/linac-radiation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureLinacTables();
  await ensureRadiationExtendedTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const category = searchParams.get("category");
  const semaphore = searchParams.get("semaphore");
  const workerRut = searchParams.get("workerRut");
  const instrumentId = searchParams.get("instrumentId");
  const { rows } = await sql`
    SELECT r.*, w.name AS worker_name, i.name AS instrument_name, i.code AS instrument_code
    FROM linac_radiation_protection r
    LEFT JOIN workers w ON w.rut = r.worker_rut
    LEFT JOIN instruments i ON i.id = r.instrument_id
    WHERE (${linacId}::int IS NULL OR r.linac_id = ${linacId}::int)
    AND (${category}::text IS NULL OR r.category = ${category}::text)
    AND (${semaphore}::text IS NULL OR r.semaphore = ${semaphore}::text)
    AND (${workerRut}::text IS NULL OR r.worker_rut = ${workerRut}::text)
    AND (${instrumentId}::int IS NULL OR r.instrument_id = ${instrumentId}::int)
    ORDER BY r.measurement_date DESC, r.id DESC
    LIMIT 1000;
  `;
  return NextResponse.json({ ok: true, records: rows });
}

export async function POST(request: Request) {
  await ensureLinacTables();
  await ensureRadiationExtendedTables();
  const form = await request.formData();
  const file = form.get("file");
  const linacId = Number(form.get("linacId"));
  const category = String(form.get("category") || "").trim();
  const measurementType = (form.get("measurementType") as string) || null;
  const measurementDate = String(form.get("measurementDate") || "").trim();
  const measurementTime = (form.get("measurementTime") as string) || null;
  const location = (form.get("location") as string) || null;
  const value = (form.get("value") as string) || null;
  const unit = (form.get("unit") as string) || null;
  const doseValue = (form.get("doseValue") as string) || null;
  const doseUnit = (form.get("doseUnit") as string) || null;
  const limitValue = (form.get("limitValue") as string) || null;
  const referenceLevel = (form.get("referenceLevel") as string) || null;
  const status = (form.get("status") as string) || "conforme";
  const frequency = (form.get("frequency") as string) || null;
  const nextDueDate = (form.get("nextDueDate") as string) || null;
  const instrumentRef = (form.get("instrumentRef") as string) || null;
  const instrumentIdRaw = form.get("instrumentId");
  const instrumentId = instrumentIdRaw ? Number(instrumentIdRaw) : null;
  const workerRut = (form.get("workerRut") as string) || null;
  const responsible = (form.get("responsible") as string) || null;
  const notes = (form.get("notes") as string) || null;

  if (!linacId || !category || !measurementDate) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let blobUrl: string | null = null;
  let fileName: string | null = null;
  let mimeType: string | null = null;
  if (file instanceof File && file.size > 0) {
    const pathname = `linac/radiation/${linacId}/${category}/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "private" });
    blobUrl = blob.url;
    fileName = file.name;
    mimeType = file.type || null;
  }

  const effectiveValue = value || doseValue;
  const semaphore = computeRadiationSemaphore(status, effectiveValue, limitValue, referenceLevel);

  const { rows } = await sql`
    INSERT INTO linac_radiation_protection (
      linac_id, measurement_date, measurement_time, measurement_type, location, value, unit,
      instrument_ref, responsible, notes, category, worker_rut, instrument_id, dose_value, dose_unit,
      limit_value, reference_level, semaphore, status, frequency, next_due_date, file_name, blob_url,
      mime_type, updated_at
    ) VALUES (
      ${linacId}, ${measurementDate}, ${measurementTime}, ${measurementType}, ${location}, ${value}, ${unit},
      ${instrumentRef}, ${responsible}, ${notes}, ${category}, ${workerRut}, ${instrumentId}, ${doseValue}, ${doseUnit},
      ${limitValue}, ${referenceLevel}, ${semaphore}, ${status}, ${frequency}, ${nextDueDate}, ${fileName}, ${blobUrl},
      ${mimeType}, now()
    )
    RETURNING id;
  `;

  const recordId = rows[0]!.id;
  const categoryLabel = (RADIATION_CATEGORIES.find((c: any) => c.value === category) || { label: category }).label;
  const recordLabel = (measurementType || categoryLabel) as string;

  if (semaphore !== "verde") {
    const msg = categoryLabel + ' "' + recordLabel + '" fuera de nivel: semaforo ' + semaphore + ".";
    await generateRadiationAlert(linacId, recordId, category, semaphore, msg);
  }
  if (nextDueDate) {
    await checkDueDateAlert(linacId, recordId, category, categoryLabel, recordLabel, nextDueDate);
  }

  await logLinacAudit("create_linac_radiation", responsible, { linacId, category, semaphore });
  await logRadiationAudit("create_linac_radiation", responsible, { linacId, category, semaphore, recordId });

  return NextResponse.json({ ok: true, id: recordId, semaphore });
}

export async function PATCH(request: Request) {
  await ensureRadiationExtendedTables();
  const body = await request.json();
  const id = Number(body.id);
  const status = String(body.status || "").trim();
  const actorEmail = body.actorEmail || null;
  if (!id || !status) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  await sql`UPDATE linac_radiation_protection SET status = ${status}, updated_at = now() WHERE id = ${id}`;
  await logRadiationAudit("update_linac_radiation_status", actorEmail, { id, status });
  return NextResponse.json({ ok: true });
}
