/**
 * Exportación XLS — Inventario de Instrumentos de Medición
 * DS 133/1984 MINSAL
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

interface InstrumentRow {
  id: number;
  name: string;
  serial_number: string | null;
  model: string | null;
  type_name: string | null;
  status: string;
  location: string | null;
  last_calibration_date: string | null;
  last_calibration_expiry: string | null;
  last_calibration_company: string | null;
  failures_open_count: number;
}

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function daysLeft(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(expiryDate));
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function calibStatus(days: number | null): string {
  if (days === null) return "Sin calibración";
  if (days < 0) return "VENCIDA";
  if (days <= 90) return `Próx. (${days}d)`;
  return `Vigente (${days}d)`;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    activo: "Activo",
    inactivo: "Inactivo",
    en_reparacion: "En reparación",
    baja: "Baja",
  };
  return map[s] ?? s;
}

export async function GET() {
  try {
    const institution = await getInstitutionInfo();
    const { rows } = (await sql`
      SELECT
        i.id,
        i.name,
        i.serial_number,
        i.model,
        t.name AS type_name,
        i.status,
        i.location,
        lc.calibration_date AS last_calibration_date,
        lc.expiry_date       AS last_calibration_expiry,
        COALESCE(lc.company_name, cc.name) AS last_calibration_company,
        COALESCE(fc.open_count, 0)         AS failures_open_count
      FROM instruments i
      LEFT JOIN instrument_types t ON t.id = i.type_id
      LEFT JOIN LATERAL (
        SELECT * FROM calibrations c
        WHERE c.instrument_id = i.id
        ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1
      ) lc ON true
      LEFT JOIN calibration_companies cc ON cc.id = lc.company_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS open_count FROM instrument_failures f
        WHERE f.instrument_id = i.id AND f.status IN ('abierta', 'en_proceso')
      ) fc ON true
      ORDER BY i.status ASC, type_name ASC, i.name ASC
      LIMIT 2000
    `) as { rows: InstrumentRow[] };

    const today = new Date();
    const dateLabel = today.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // ── Build worksheet data ──────────────────────────────────────────
    const wsData: (string | number)[][] = [];

    // Title rows
    wsData.push([institution?.name ?? "RPMS Platform"]);
    wsData.push(["Inventario de Instrumentos de Medición"]);
    wsData.push([`Generado: ${dateLabel}`]);
    wsData.push([]); // blank row

    // Header row
    wsData.push([
      "N°",
      "Instrumento",
      "N° Serie",
      "Modelo",
      "Tipo",
      "Estado",
      "Ubicación",
      "Última Calibración",
      "Vencimiento",
      "Estado Calibración",
      "Empresa Calibradora",
      "Fallas Abiertas",
    ]);

    // Data rows
    rows.forEach((row, idx) => {
      const days = daysLeft(row.last_calibration_expiry);
      wsData.push([
        idx + 1,
        row.name,
        row.serial_number ?? "—",
        row.model ?? "—",
        row.type_name ?? "—",
        statusLabel(row.status),
        row.location ?? "—",
        fmtDate(row.last_calibration_date),
        fmtDate(row.last_calibration_expiry),
        calibStatus(days),
        row.last_calibration_company ?? "—",
        Number(row.failures_open_count),
      ]);
    });

    // ── Create workbook ───────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths (characters)
    ws["!cols"] = [
      { wch: 5 },  // N°
      { wch: 30 }, // Instrumento
      { wch: 18 }, // N° Serie
      { wch: 18 }, // Modelo
      { wch: 20 }, // Tipo
      { wch: 14 }, // Estado
      { wch: 20 }, // Ubicación
      { wch: 18 }, // Última Calibración
      { wch: 14 }, // Vencimiento
      { wch: 20 }, // Estado Calibración
      { wch: 25 }, // Empresa Calibradora
      { wch: 14 }, // Fallas Abiertas
    ];

    // Merge title cells across all columns
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Instrumentos");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const dateFile = today
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="instrumentos_${dateFile}.xlsx"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[instruments/export/xls]", err);
    return NextResponse.json(
      { error: "Error al generar XLS" },
      { status: 500 }
    );
  }
}
