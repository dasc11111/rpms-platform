import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Report types supported
type ReportType =
  | "dosimetry_monthly"
  | "dosimetry_quarterly"
  | "incident_summary"
  | "compliance_matrix"
  | "source_inventory"
  | "worker_registry"
  | "qc_summary";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "dosimetry_monthly") as ReportType;
  const period = searchParams.get("period"); // e.g. "2026-11" or "2026-Q4"
  const format = searchParams.get("format") ?? "json"; // "json" or "csv"

  const now = new Date();
  const reportMeta = {
    report_type: type,
    period: period ?? now.toISOString().slice(0, 7),
    generated_at: now.toISOString(),
    generated_by: "RPMS Platform — OPR",
    institution: "Hospital Dr. Hernán Henríquez Aravena",
    regulation: getRegulation(type),
  };

  let data: unknown[] = [];

  try {
    switch (type) {
      case "worker_registry": {
        const { rows } = await sql`
          SELECT rut, name, role, service, category, status,
                 course_pr_completed, authorization_number,
                 authorization_expiry_date::text, annual_dose
          FROM workers
          ORDER BY service ASC, name ASC
        `;
        data = rows;
        break;
      }

      case "dosimetry_monthly": {
        const { rows } = await sql`
          SELECT w.rut, w.name, w.service, w.category,
                 dr.dosimeter_type, dr.period, dr.dose, dr.status
          FROM dosimetry_readings dr
          LEFT JOIN workers w ON w.rut = dr.worker_rut
          ORDER BY dr.period DESC, w.service ASC, w.name ASC
          LIMIT 500
        `;
        data = rows;
        break;
      }

      case "dosimetry_quarterly": {
        const { rows } = await sql`
          SELECT worker_rut, worker_name, year, quarter, period_label,
                 dose_body, dose_lens, dose_skin,
                 accum_year_body, accum_12m_body, accum_60m_body, level
          FROM dosimetry_quarterly
          ORDER BY year DESC, quarter DESC, worker_name ASC
          LIMIT 500
        `;
        data = rows;
        break;
      }

      case "incident_summary": {
        const { rows } = await sql`
          SELECT id, title, incident_date::text, service, severity, status,
                 ines_level, reference_code, reported_by, closed_at::text
          FROM incidents
          ORDER BY incident_date DESC
          LIMIT 200
        `;
        data = rows;
        break;
      }

      case "compliance_matrix": {
        const { rows } = await sql`
          SELECT reference_code, requirement, regulation, priority, owner,
                 frequency_months, last_review_date::text, next_review_date::text, status, notes
          FROM compliance_requirements
          ORDER BY
            CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
            next_review_date ASC NULLS LAST
        `;
        data = rows;
        break;
      }

      case "source_inventory": {
        const { rows } = await sql`
          SELECT source_code, isotope, half_life_days,
                 activity_bq_initial, activity_reference_date::text,
                 category_iaea, manufacturer, location, status,
                 last_inventory_date::text, next_inventory_date::text
          FROM radioactive_sources
          ORDER BY status ASC, isotope ASC
        `;
        data = rows;
        break;
      }

      case "qc_summary": {
        const { rows } = await sql`
          SELECT equipment_id, equipment_name, qc_type,
                 performed_at::text, performed_by, result, pass,
                 next_due_at::text
          FROM qc_records
          ORDER BY performed_at DESC
          LIMIT 200
        `;
        data = rows;
        break;
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Error generating report: ${String(err)}` },
      { status: 500 }
    );
  }

  if (format === "csv") {
    if (data.length === 0) {
      return new Response("No data available\n", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}_${reportMeta.period}.csv"`,
        },
      });
    }
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((h) => {
            const val = (row as Record<string, unknown>)[h];
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      ),
    ];
    return new Response(csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="RPMS_${type}_${reportMeta.period}.csv"`,
      },
    });
  }

  return NextResponse.json({
    meta: reportMeta,
    count: data.length,
    data,
  });
}

function getRegulation(type: ReportType): string {
  const map: Record<ReportType, string> = {
    dosimetry_monthly: "DS 3/1985 MINSAL · ICRP 103",
    dosimetry_quarterly: "DS 3/1985 MINSAL · NS-06.0 §11",
    incident_summary: "NS-06.0 §16 · IAEA INES",
    compliance_matrix: "NS-06.0 CCHEN · DS 133/1984",
    source_inventory: "NS-06.0 §6 · IAEA Safety Reports No. 6",
    worker_registry: "DS 3/1985 Art. 3 · NS-06.0 §4",
    qc_summary: "NS-06.0 §10 · IAEA-TECDOC-1683 · NCRP 182",
  };
  return map[type];
}
