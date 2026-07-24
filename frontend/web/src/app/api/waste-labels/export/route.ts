import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

// Exportacion de datos del modulo Gestion de Residuos Radiactivos, segun lo
// requerido: PDF/Excel/CSV para listado de residuos, listado de rotulos e
// historial completo. (El PDF del rotulo individual se genera desde la vista
// del rotulo; aqui se cubren los formatos tabulares Excel/CSV para listados
// completos).
//
// Uso: /api/waste-labels/export?dataset=labels|room-release|history&format=csv|xlsx

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function buildResponse(rows: Record<string, unknown>[], format: string, filenameBase: string) {
  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }
  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dataset = searchParams.get("dataset") ?? "labels";
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  if (dataset === "room-release") {
    const { rows } = await sql`
      SELECT * FROM room_release_records ORDER BY release_date DESC, id DESC
    `;
    return buildResponse(rows as Record<string, unknown>[], format, "listado-residuos-liberacion-sala");
  }

  if (dataset === "history") {
    const { rows } = await sql`
      SELECT h.id, h.label_id, h.label_number, h.action, h.changed_by, h.changed_at,
             l.service, l.sala, l.radionuclide_code, l.status
      FROM waste_label_history h
      LEFT JOIN radioactive_waste_labels l ON l.id = h.label_id
      ORDER BY h.changed_at DESC
    `;
    return buildResponse(rows as Record<string, unknown>[], format, "historial-completo-residuos");
  }

  // dataset === "labels" (por defecto): listado de rotulos generados
  const { rows } = await sql`
    SELECT * FROM radioactive_waste_labels ORDER BY label_year DESC, correlative DESC
  `;
  return buildResponse(rows as Record<string, unknown>[], format, "listado-rotulos-residuos-radiactivos");
}
