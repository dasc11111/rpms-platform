import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";
import {
ensureQcExtendedTables,
computeDeviationPct,
computeSemaphore,
findCurrentBaseline,
generateQcAlert,
logQcAudit,
} from "@/lib/linac-qc";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
await ensureLinacTables();
await ensureQcExtendedTables();
const { searchParams } = new URL(request.url);
const linacId = searchParams.get("linacId");
const periodicity = searchParams.get("periodicity");
const modality = searchParams.get("modality");
const energy = searchParams.get("energy");
const measurementType = searchParams.get("measurementType");
const semaphore = searchParams.get("semaphore");
const { rows } = await sql`
SELECT * FROM linac_qc_tests
WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
AND (${periodicity}::text IS NULL OR periodicity = ${periodicity}::text)
AND (${modality}::text IS NULL OR modality = ${modality}::text)
AND (${energy}::text IS NULL OR energy = ${energy}::text)
AND (${measurementType}::text IS NULL OR measurement_type = ${measurementType}::text)
AND (${semaphore}::text IS NULL OR semaphore = ${semaphore}::text)
ORDER BY test_date DESC, id DESC
LIMIT 1000;
`;
return NextResponse.json({ ok: true, tests: rows });
}

export async function POST(request: Request) {
await ensureLinacTables();
await ensureQcExtendedTables();
const form = await request.formData();
const file = form.get("file");
const linacId = Number(form.get("linacId"));
const periodicity = String(form.get("periodicity") || "").trim();
const testName = String(form.get("testName") || "").trim();
const testDate = String(form.get("testDate") || "").trim();
const testTime = (form.get("testTime") as string) || null;
const expectedValue = (form.get("expectedValue") as string) || null;
const obtainedValue = (form.get("obtainedValue") as string) || null;
const tolerance = (form.get("tolerance") as string) || null;
const unit = (form.get("unit") as string) || null;
const status = (form.get("status") as string) || "cumple";
const observations = (form.get("observations") as string) || null;
const responsible = (form.get("responsible") as string) || null;
const procedureText = (form.get("procedure") as string) || null;
const applicableRegulation = (form.get("applicableRegulation") as string) || null;
const instrumentUsed = (form.get("instrumentUsed") as string) || null;
const modality = (form.get("modality") as string) || null;
const energy = (form.get("energy") as string) || null;
const measurementType = (form.get("measurementType") as string) || null;

if (!linacId || !periodicity || !testName || !testDate) {
return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}

let blobUrl = null;
let fileName = null;
let mimeType = null;
if (file instanceof File && file.size > 0) {
const pathname = `linac/qc/${linacId}/${periodicity}/${Date.now()}-${file.name}`;
const blob = await put(pathname, file, { access: "private" });
blobUrl = blob.url;
fileName = file.name;
mimeType = file.type || null;
}

const baseline = await findCurrentBaseline(linacId, measurementType, modality, energy);
const effectiveExpected = expectedValue || (baseline && baseline.referenceValue != null ? String(baseline.referenceValue) : null);
const deviationPct = computeDeviationPct(effectiveExpected, obtainedValue);
const semaphore = computeSemaphore(status, deviationPct, tolerance);
const baselineVersion = baseline ? baseline.version : null;
const baselineId = baseline ? baseline.id : null;
const baselineValue = baseline && baseline.referenceValue != null ? String(baseline.referenceValue) : null;

const { rows } = await sql`
INSERT INTO linac_qc_tests (
linac_id, periodicity, test_name, test_date, test_time, expected_value, obtained_value,
tolerance, unit, status, observations, responsible, file_name, blob_url, mime_type,
procedure_text, applicable_regulation, instrument_used, modality, energy, measurement_type,
baseline_id, baseline_version, baseline_value, deviation_pct, semaphore, updated_at
) VALUES (
${linacId}, ${periodicity}, ${testName}, ${testDate}, ${testTime}, ${expectedValue}, ${obtainedValue},
${tolerance}, ${unit}, ${status}, ${observations}, ${responsible}, ${fileName}, ${blobUrl}, ${mimeType},
${procedureText}, ${applicableRegulation}, ${instrumentUsed}, ${modality}, ${energy}, ${measurementType},
${baselineId}, ${baselineVersion}, ${baselineValue}, ${deviationPct}, ${semaphore}, now()
)
RETURNING id;
`;

const testId = rows[0]!.id;

if (semaphore !== "verde") {
const msg = `Prueba "${testName}" (${periodicity}) fuera de tolerancia: desviacion ${deviationPct ?? "N/A"}% - semaforo ${semaphore}.`;
await generateQcAlert(linacId, testId, periodicity, testName, semaphore, msg);
}

await logLinacAudit("create_linac_qc_test", responsible, { linacId, periodicity, testName, status, semaphore, deviationPct });
await logQcAudit("create_linac_qc_test", responsible, { linacId, periodicity, testName, status, semaphore, deviationPct, baselineId });

return NextResponse.json({ ok: true, id: testId, semaphore, deviationPct, baseline });
}
