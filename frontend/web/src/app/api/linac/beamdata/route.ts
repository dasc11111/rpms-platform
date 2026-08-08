import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { ensureBeamDataTables, importBeamDataEntry, logBeamDataAudit } from "@/lib/linac-beamdata";
import { ensureCommissioningTables } from "@/lib/linac-commissioning";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureBeamDataTables();
  await ensureCommissioningTables();
  const { searchParams } = new URL(request.url);
  const linacId = searchParams.get("linacId");
  const modality = searchParams.get("modality");
  const energy = searchParams.get("energy");
  const measurementType = searchParams.get("measurementType");
  const instrument = searchParams.get("instrument");
  const responsible = searchParams.get("responsible");
  const compareIds = searchParams.get("compareIds");

  if (compareIds) {
    const pairs = compareIds.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
      const parts = p.split(":");
      return { source: parts[0], id: Number(parts[1]) };
    });
    const items: any[] = [];
    for (const p of pairs) {
      if (p.source === "library") {
        const { rows } = await sql`SELECT * FROM linac_beam_data WHERE id = ${p.id}`;
        if (rows[0]) items.push({ ...rows[0], source: "library" });
      } else if (p.source === "commissioning") {
        const { rows } = await sql`SELECT * FROM linac_commissioning_datasets WHERE id = ${p.id}`;
        if (rows[0]) items.push({ ...rows[0], source: "commissioning" });
      }
    }
    return NextResponse.json({ ok: true, items });
  }

  const { rows: libraryRows } = await sql`
    SELECT * FROM linac_beam_data
    WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
      AND (${measurementType}::text IS NULL OR measurement_type = ${measurementType}::text)
      AND (${modality}::text IS NULL OR modality ILIKE '%' || ${modality}::text || '%')
      AND (${energy}::text IS NULL OR energy ILIKE '%' || ${energy}::text || '%')
      AND (${instrument}::text IS NULL OR instrument_used ILIKE '%' || ${instrument}::text || '%')
      AND (${responsible}::text IS NULL OR measured_by ILIKE '%' || ${responsible}::text || '%')
    ORDER BY measurement_date DESC, id DESC
    LIMIT 1000;
  `;
  const { rows: commissioningRows } = await sql`
    SELECT * FROM linac_commissioning_datasets
    WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
      AND (${measurementType}::text IS NULL OR measurement_type = ${measurementType}::text)
      AND (${modality}::text IS NULL OR modality ILIKE '%' || ${modality}::text || '%')
      AND (${energy}::text IS NULL OR energy ILIKE '%' || ${energy}::text || '%')
      AND (${instrument}::text IS NULL OR instrument_used ILIKE '%' || ${instrument}::text || '%')
      AND (${responsible}::text IS NULL OR measured_by ILIKE '%' || ${responsible}::text || '%')
    ORDER BY measurement_date DESC, id DESC
    LIMIT 1000;
  `;

  const items = [
    ...libraryRows.map((r: any) => ({ ...r, source: "library" })),
    ...commissioningRows.map((r: any) => ({ ...r, source: "commissioning" })),
  ];
  items.sort((a: any, b: any) => new Date(b.measurement_date).getTime() - new Date(a.measurement_date).getTime());

  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  await ensureBeamDataTables();
  const form = await request.formData();
  const linacId = Number(form.get("linacId"));
  const modality = String(form.get("modality") || "");
  const energy = String(form.get("energy") || "");
  const measurementType = String(form.get("measurementType") || "");
  const measurementDate = String(form.get("measurementDate") || "");
  const measuredBy = String(form.get("measuredBy") || "");
  const instrumentUsed = String(form.get("instrumentUsed") || "");
  const uncertaintyType = String(form.get("uncertaintyType") || "");
  const uncertaintyValue = String(form.get("uncertaintyValue") || "");
  const uncertaintyUnit = String(form.get("uncertaintyUnit") || "");
  const notes = String(form.get("notes") || "");
  const createdBy = (form.get("createdBy") as string) || null;
  const pointsRaw = String(form.get("points") || "[]");
  const file = form.get("file");

  if (!linacId || !measurementType || !measurementDate) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let points: any[] = [];
  try { points = JSON.parse(pointsRaw); } catch {}

  let fileName: string | null = null;
  let blobUrl: string | null = null;
  let mimeType: string | null = null;
  if (file instanceof File && file.size > 0) {
    const pathname = `linac/beamdata/${linacId}/${measurementType}/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "private" });
    fileName = file.name;
    blobUrl = blob.url;
    mimeType = file.type || null;
  }

  const result = await importBeamDataEntry({
    linacId, modality, energy, measurementType, measurementDate, measuredBy, instrumentUsed,
    data: { points }, uncertaintyType, uncertaintyValue, uncertaintyUnit,
    fileName, blobUrl, mimeType, notes, createdBy,
  });

  await logBeamDataAudit("import_beam_data", createdBy, { id: result.id, linacId, measurementType, version: result.version });
  return NextResponse.json({ ok: true, id: result.id, version: result.version });
}
