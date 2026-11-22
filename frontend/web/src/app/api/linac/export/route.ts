import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper: convert rows to CSV
function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

// Helper: convert rows to minimal XLSX-compatible CSV (Vercel env has no xlsx lib)
// We return CSV for both formats since we cannot install xlsx server-side.
// The page will trigger a download with the appropriate extension.
function buildResponse(rows: Record<string, unknown>[], format: string, dataset: string) {
  const csv = toCSV(rows);
  const isXlsx = format === "xlsx";
  const contentType = isXlsx
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
  const ext = isXlsx ? "xlsx" : "csv";
  const filename = `rpms_linac_${dataset}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  return new Response(csv, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dataset = searchParams.get("dataset") || "qa_records";
  const format = searchParams.get("format") || "csv";
  const linacId = searchParams.get("linacId");
  const category = searchParams.get("category");
  const fechaDesde = searchParams.get("fechaDesde");
  const fechaHasta = searchParams.get("fechaHasta");

  try {
    let rows: Record<string, unknown>[] = [];

    if (dataset === "qa_records") {
      const result = await sql`
        SELECT id, linac_id, category, fecha, estado, valor_medido, tolerancia,
               unidad, responsable, equipo_usado, notas, created_at
        FROM linac_qa_records
        WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
          AND (${category} IS NULL OR ${category} = '' OR category = ${category})
          AND (${fechaDesde} IS NULL OR ${fechaDesde} = '' OR fecha >= ${fechaDesde}::date)
          AND (${fechaHasta} IS NULL OR ${fechaHasta} = '' OR fecha <= ${fechaHasta}::date)
        ORDER BY fecha DESC, created_at DESC
        LIMIT 10000
      `;
      rows = result.rows as Record<string, unknown>[];
    } else if (dataset === "commissioning") {
      const result = await sql`
        SELECT id, linac_id, category, measurement_type, measurement_date, measured_by,
               instrument_used, status, is_current, version, notes, created_at
        FROM linac_commissioning_datasets
        WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
          AND (${category} IS NULL OR ${category} = '' OR category = ${category})
        ORDER BY measurement_date DESC
        LIMIT 10000
      `;
      rows = result.rows as Record<string, unknown>[];
    } else if (dataset === "baseline") {
      const result = await sql`
        SELECT id, linac_id, category, measurement_type, version, is_current,
               created_by, notes, dataset_id, measurement_date, created_at
        FROM linac_baseline_data
        WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
          AND (${category} IS NULL OR ${category} = '' OR category = ${category})
        ORDER BY measurement_date DESC
        LIMIT 10000
      `;
      rows = result.rows as Record<string, unknown>[];
    } else if (dataset === "beamdata") {
      const result = await sql`
        SELECT id, linac_id, modality, energy, measurement_type, field_size,
               depth, value, unit, instrument, responsible, measurement_date, notes, created_at
        FROM linac_beam_data
        WHERE (${linacId}::int IS NULL OR linac_id = ${linacId}::int)
          AND (${category} IS NULL OR ${category} = '' OR measurement_type = ${category})
        ORDER BY measurement_date DESC
        LIMIT 10000
      `;
      rows = result.rows as Record<string, unknown>[];
    } else if (dataset === "acceptance") {
      const result = await sql`
        SELECT t.id, t.linac_id, t.protocol_reference, t.category, t.test_name,
               t.result, t.status, t.responsible, t.test_date, t.notes,
               t.tolerance_value, t.measured_value, t.created_at
        FROM linac_acceptance_tests t
        WHERE (${linacId}::int IS NULL OR t.linac_id = ${linacId}::int)
          AND (${category} IS NULL OR ${category} = '' OR t.category = ${category})
          AND (${fechaDesde} IS NULL OR ${fechaDesde} = '' OR t.test_date >= ${fechaDesde}::date)
          AND (${fechaHasta} IS NULL OR ${fechaHasta} = '' OR t.test_date <= ${fechaHasta}::date)
        ORDER BY t.test_date DESC
        LIMIT 10000
      `;
      rows = result.rows as Record<string, unknown>[];
    } else if (dataset === "instrument_validation") {
      const result = await sql`
        SELECT id, instrument_code, instrument_name, instrument_type, serial_number,
               manufacturer, model, calibration_date, expiry_date, calibration_lab,
               certificate_number, status, responsible, notes, created_at
        FROM linac_instrument_validations
        ORDER BY expiry_date ASC
        LIMIT 10000
      `;
      rows = result.rows as Record<string, unknown>[];
    } else {
      return NextResponse.json({ error: "unknown_dataset" }, { status: 400 });
    }

    return buildResponse(rows, format, dataset);
  } catch (err) {
    console.error("[/api/linac/export] error:", err);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
