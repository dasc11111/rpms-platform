import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("docId");

  const { rows: byPeriod } = await sql`
    SELECT period_label, year, quarter, source_document_id, entry_method, count(*)::int as cnt,
      sum(case when dose_body = 0 and dose_lens = 0 and dose_skin = 0 then 1 else 0 end)::int as all_zero
    FROM dosimetry_quarterly
    GROUP BY period_label, year, quarter, source_document_id, entry_method
    ORDER BY year DESC, quarter DESC
  `;

  let sampleQuery;
  if (docId) {
    sampleQuery = sql`SELECT worker_rut, worker_name, departamento, year, quarter, period_label, dose_body, dose_lens, dose_skin, dosimeter_number, dosimeter_type, entry_method, source_document_id FROM dosimetry_quarterly WHERE source_document_id = ${Number(docId)} ORDER BY worker_name LIMIT 40`;
  } else {
    sampleQuery = sql`SELECT worker_rut, worker_name, departamento, year, quarter, period_label, dose_body, dose_lens, dose_skin, dosimeter_number, dosimeter_type, entry_method, source_document_id FROM dosimetry_quarterly ORDER BY updated_at DESC LIMIT 40`;
  }
  const { rows: sample } = await sampleQuery;

  const { rows: dupRutCheck } = await sql`
    SELECT worker_rut, count(*)::int as cnt FROM dosimetry_quarterly
    WHERE source_document_id = ${docId ? Number(docId) : null}
    GROUP BY worker_rut HAVING count(*) > 1 ORDER BY cnt DESC LIMIT 20
  `;

  return NextResponse.json({ byPeriod, sample, dupRutCheck });
}
