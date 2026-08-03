import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureLinacTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const periodicity = searchParams.get("periodicity");
  const { rows } = await sql`
    SELECT * FROM linac_qc_tests
    WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
      AND (${periodicity}::text IS NULL OR periodicity = ${periodicity}::text)
    ORDER BY test_date DESC, id DESC
    LIMIT 1000;
  `;
  return NextResponse.json({ ok: true, tests: rows });
}

export async function POST(request: Request) {
  await ensureLinacTables();
  const form = await request.formData();
  const file = form.get("file");
  const linacId = Number(form.get("linacId"));
  const periodicity = String(form.get("periodicity") || "").trim();
  const testName = String(form.get("testName") || "").trim();
  const testDate = String(form.get("testDate") || "").trim();
  const expectedValue = (form.get("expectedValue") as string) || null;
  const obtainedValue = (form.get("obtainedValue") as string) || null;
  const tolerance = (form.get("tolerance") as string) || null;
  const unit = (form.get("unit") as string) || null;
  const status = (form.get("status") as string) || "cumple";
  const observations = (form.get("observations") as string) || null;
  const responsible = (form.get("responsible") as string) || null;
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

  const { rows } = await sql`
    INSERT INTO linac_qc_tests (
      linac_id, periodicity, test_name, test_date, expected_value, obtained_value,
      tolerance, unit, status, observations, responsible, file_name, blob_url, mime_type
    ) VALUES (
      ${linacId}, ${periodicity}, ${testName}, ${testDate}, ${expectedValue}, ${obtainedValue},
      ${tolerance}, ${unit}, ${status}, ${observations}, ${responsible}, ${fileName}, ${blobUrl}, ${mimeType}
    )
    RETURNING id;
  `;

  await logLinacAudit("create_linac_qc_test", responsible, { linacId, periodicity, testName, status });
  return NextResponse.json({ ok: true, id: rows[0]!.id });
}
