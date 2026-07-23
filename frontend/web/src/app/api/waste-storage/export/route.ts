import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

// Exportacion de datos del Inventario de Residuos y Almacenamiento Temporal:
// inventario actual, historial de movimientos y catalogo de ubicaciones.
// Uso: /api/waste-storage/export?dataset=inventory|movements|locations&format=csv|xlsx

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
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
  const dataset = searchParams.get("dataset") ?? "inventory";
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  if (dataset === "locations") {
    const { rows } = await sql`SELECT * FROM waste_storage_locations ORDER BY sort_order, name`;
    return buildResponse(rows as Record<string, unknown>[], format, "ubicaciones-almacenamiento-residuos");
  }

  if (dataset === "movements") {
    const { rows } = await sql`
      SELECT m.*, l.service, l.sala, l.radionuclide_code, l.status AS label_status
      FROM waste_inventory_movements m
      LEFT JOIN radioactive_waste_labels l ON l.id = m.waste_label_id
      ORDER BY m.moved_at DESC
    `;
    return buildResponse(rows as Record<string, unknown>[], format, "historial-movimientos-inventario");
  }

  // dataset === "inventory" (por defecto): inventario actual en almacenamiento
  const { rows } = await sql`
    SELECT w.*, r.half_life_days, l.name AS location_name
    FROM radioactive_waste_labels w
    LEFT JOIN radionuclides r ON r.code = w.radionuclide_code
    LEFT JOIN waste_storage_locations l ON l.id = w.storage_location_id
    WHERE w.status != 'liberado'
    ORDER BY w.entry_date ASC
  `;
  return buildResponse(rows as Record<string, unknown>[], format, "inventario-actual-residuos-radiactivos");
}
