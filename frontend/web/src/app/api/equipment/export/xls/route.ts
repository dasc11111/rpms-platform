/**
 * Exportación XLS — Inventario de Equipos
 * Medicina Nuclear y Radiodiagnóstico
 * DS 3/1985 — IAEA TECDOC-1040
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

interface EquipmentRow {
  id: number;
  equipment_code: string;
  name: string;
  category: string;
  model: string | null;
  brand: string | null;
  serial_number: string | null;
  acquisition_date: string | null;
  installation_date: string | null;
  location: string | null;
  responsible: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  last_calibration: string | null;
  next_calibration: string | null;
  last_qa: string | null;
  next_qa: string | null;
  warranty_expiry: string | null;
  status: string;
  references_norm: string | null;
  notes: string | null;
}

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    gamma_camera: "Gammacámara SPECT",
    pet_ct: "PET/CT",
    dose_calibrator: "Calibrador de Dosis",
    survey_meter: "Monitor de Área",
    rad_therapy: "Radioterapia",
    xray: "Rayos X",
    ct: "Tomógrafo CT",
    mri: "Resonancia Magnética",
    mammography: "Mamógrafo",
    densitometry: "Densitómetro",
    fluoroscopy: "Fluoroscopía",
    ultrasound: "Ecógrafo",
    other: "Otro",
  };
  return map[c] ?? c;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    operational: "Operativo",
    maintenance: "En mantención",
    out_of_service: "Fuera de servicio",
    decommissioned: "Dado de baja",
  };
  return map[s] ?? s;
}

export async function GET() {
  try {
    const institution = await getInstitutionInfo();

    const rows = (await sql`
      SELECT
        id, equipment_code, name, category, model, brand, serial_number,
        acquisition_date, installation_date, location, responsible,
        last_maintenance, next_maintenance,
        last_calibration, next_calibration,
        last_qa, next_qa,
        warranty_expiry, status, references_norm, notes
      FROM equipment
      WHERE active = TRUE
      ORDER BY category ASC, name ASC
      LIMIT 2000
    `) as EquipmentRow[];

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
    wsData.push(["Inventario de Equipos — Medicina Nuclear y Radiodiagnóstico"]);
    wsData.push([`Generado: ${dateLabel}`]);
    wsData.push([]); // blank row

    // Header row
    wsData.push([
      "N°",
      "Código",
      "Equipo",
      "Categoría",
      "Marca",
      "Modelo",
      "N° Serie",
      "Estado",
      "Ubicación",
      "Responsable",
      "Adquisición",
      "Instalación",
      "Últ. Mantención",
      "Próx. Mantención",
      "Últ. Calibración",
      "Próx. Calibración",
      "Últ. CQ",
      "Próx. CQ",
      "Venc. Garantía",
      "Norma Referencia",
    ]);

    rows.forEach((row, idx) => {
      wsData.push([
        idx + 1,
        row.equipment_code,
        row.name,
        categoryLabel(row.category),
        row.brand ?? "—",
        row.model ?? "—",
        row.serial_number ?? "—",
        statusLabel(row.status),
        row.location ?? "—",
        row.responsible ?? "—",
        fmtDate(row.acquisition_date),
        fmtDate(row.installation_date),
        fmtDate(row.last_maintenance),
        fmtDate(row.next_maintenance),
        fmtDate(row.last_calibration),
        fmtDate(row.next_calibration),
        fmtDate(row.last_qa),
        fmtDate(row.next_qa),
        fmtDate(row.warranty_expiry),
        row.references_norm ?? "—",
      ]);
    });

    // ── Create workbook ───────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 5 },  // N°
      { wch: 12 }, // Código
      { wch: 30 }, // Equipo
      { wch: 20 }, // Categoría
      { wch: 18 }, // Marca
      { wch: 18 }, // Modelo
      { wch: 18 }, // N° Serie
      { wch: 16 }, // Estado
      { wch: 25 }, // Ubicación
      { wch: 22 }, // Responsable
      { wch: 13 }, // Adquisición
      { wch: 13 }, // Instalación
      { wch: 15 }, // Últ. Mantención
      { wch: 16 }, // Próx. Mantención
      { wch: 15 }, // Últ. Calibración
      { wch: 16 }, // Próx. Calibración
      { wch: 12 }, // Últ. CQ
      { wch: 12 }, // Próx. CQ
      { wch: 14 }, // Venc. Garantía
      { wch: 30 }, // Norma Referencia
    ];

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 19 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 19 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Equipos");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const dateFile = today.toISOString().slice(0, 10).replace(/-/g, "");

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="equipos_${dateFile}.xlsx"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[equipment/export/xls]", err);
    return NextResponse.json({ error: "Error al generar XLS" }, { status: 500 });
  }
}
