import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureActivimetroQcTables } from "@/lib/qc-activimetro-db";

export const dynamic = "force-dynamic";

export async function GET() {
    await ensureActivimetroQcTables();
    const { rows } = await sql`
        SELECT * FROM qc_activimetro_tolerances ORDER BY test_type ASC, parameter_name ASC, effective_from DESC
          `;
    return NextResponse.json({ tolerances: rows });
}

export async function POST(request: Request) {
    await ensureActivimetroQcTables();
    const body = await request.json();

  const testType = String(body.testType || "").trim();
    const parameterName = String(body.parameterName || "").trim();
    const tolerancePercent = body.tolerancePercent !== undefined && body.tolerancePercent !== "" ? Number(body.tolerancePercent) : null;
    const toleranceAbsolute = body.toleranceAbsolute !== undefined && body.toleranceAbsolute !== "" ? Number(body.toleranceAbsolute) : null;
    const warningPercent = body.warningPercent !== undefined && body.warningPercent !== "" ? Number(body.warningPercent) : null;
    const referenceSource = body.referenceSource || "Documento QA Activimetro proporcionado por usuario";
    const protocolVersion = body.protocolVersion || "1.0";
    const numReadingsRequired = body.numReadingsRequired !== undefined && body.numReadingsRequired !== "" ? Number(body.numReadingsRequired) : null;
    const notes = body.notes || null;

  if (!testType || !parameterName) {
        return NextResponse.json({ error: "test_type_and_parameter_required" }, { status: 400 });
  }

  await sql`
      UPDATE qc_activimetro_tolerances
          SET active = false
              WHERE test_type = ${testType} AND parameter_name = ${parameterName} AND active = true
                `;

  const { rows } = await sql`
      INSERT INTO qc_activimetro_tolerances (
            test_type, parameter_name, tolerance_percent, tolerance_absolute, warning_percent,
                  reference_source, protocol_version, num_readings_required, notes, active
                      ) VALUES (
                            ${testType}, ${parameterName}, ${tolerancePercent}, ${toleranceAbsolute}, ${warningPercent},
                                  ${referenceSource}, ${protocolVersion}, ${numReadingsRequired}, ${notes}, true
                                      )
                                          ON CONFLICT (test_type, parameter_name, protocol_version)
                                              DO UPDATE SET
                                                    tolerance_percent = EXCLUDED.tolerance_percent,
                                                          tolerance_absolute = EXCLUDED.tolerance_absolute,
                                                                warning_percent = EXCLUDED.warning_percent,
                                                                      reference_source = EXCLUDED.reference_source,
                                                                            num_readings_required = EXCLUDED.num_readings_required,
                                                                                  notes = EXCLUDED.notes,
                                                                                        active = true,
                                                                                              updated_at = now()
                                                                                                  RETURNING *
                                                                                                    `;

  return NextResponse.json({ tolerance: rows[0] });
}
