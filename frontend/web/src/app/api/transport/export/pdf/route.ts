/**
 * Exportación PDF — Registro de Transporte de Material Radiactivo
 * Registro de embarques con datos dosimétricos, señalética y OPR.
 * DS 133/1984 MINSAL — Reglamento de Protección Radiológica de Instalaciones.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

interface ShipmentRow {
  id: number;
  transport_date: string;
  correlative_number: number;
  it_value: number | null;
  dose_contact: number | null;
  dose_1m: number | null;
  dose_vehicle: number | null;
  material_code: string;
  requested_activity_mci: number | null;
  driver_name: string | null;
  opr_name: string | null;
  signage_dosimeter: boolean;
  signage_radiactivo7: boolean;
  signage_nu2915: boolean;
  notes: string | null;
  total_i131_activity: number | null;
  i131_capsule_count: number | null;
}

const MATERIAL_LABELS: Record<string, string> = {
  MO_TC99: "Generador Mo-99/Tc-99m",
  I131: "I-131",
};

const DOSE_LIMIT_1M = 100; // µSv/h
const DOSE_LIMIT_VEHICLE = 2000; // µSv/h

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtNum(val: number | null, decimals = 1): string {
  if (val === null || val === undefined) return "—";
  return Number(val).toFixed(decimals);
}

function fmtActivity(row: ShipmentRow): string {
  if (row.material_code === "I131") {
    if (row.total_i131_activity !== null) {
      return `${fmtNum(row.total_i131_activity, 1)} mCi (${row.i131_capsule_count ?? 0} cáps.)`;
    }
    return "—";
  }
  if (row.requested_activity_mci !== null) {
    return `${fmtNum(row.requested_activity_mci, 1)} mCi`;
  }
  return "—";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year") || "";
    const monthParam = searchParams.get("month") || "";

    const institution = await getInstitutionInfo();

    // Build query with optional year/month filter
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (yearParam) {
      conditions.push(`EXTRACT(YEAR FROM s.transport_date) = $${i++}`);
      values.push(Number(yearParam));
    }
    if (monthParam) {
      conditions.push(`EXTRACT(MONTH FROM s.transport_date) = $${i++}`);
      values.push(Number(monthParam));
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        s.id,
        s.transport_date,
        s.correlative_number,
        s.it_value,
        s.dose_contact,
        s.dose_1m,
        s.dose_vehicle,
        s.material_code,
        s.requested_activity_mci,
        s.driver_name,
        s.opr_name,
        s.signage_dosimeter,
        s.signage_radiactivo7,
        s.signage_nu2915,
        s.notes,
        SUM(a.activity_mci) AS total_i131_activity,
        COUNT(a.id) AS i131_capsule_count
      FROM transport_shipments s
      LEFT JOIN transport_i131_activities a ON a.shipment_id = s.id
      ${where}
      GROUP BY s.id
      ORDER BY s.transport_date DESC, s.correlative_number DESC
      LIMIT 2000
    `;

    const { rows } = await sql.query(query, values);
    const shipments = rows as ShipmentRow[];

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // ── Stats ──────────────────────────────────────────────────────────────────
    const total = shipments.length;
    const moTc99Count = shipments.filter((r) => r.material_code === "MO_TC99").length;
    const i131Count = shipments.filter((r) => r.material_code === "I131").length;
    const dose1mExceeded = shipments.filter(
      (r) => r.dose_1m !== null && Number(r.dose_1m) > DOSE_LIMIT_1M
    ).length;
    const doseVehicleExceeded = shipments.filter(
      (r) => r.dose_vehicle !== null && Number(r.dose_vehicle) > DOSE_LIMIT_VEHICLE
    ).length;
    const signageIncomplete = shipments.filter(
      (r) => !r.signage_dosimeter || !r.signage_radiactivo7 || !r.signage_nu2915
    ).length;
    const withoutOpr = shipments.filter((r) => !r.opr_name).length;

    const { jsPDF } = await import("jspdf");
    // @ts-ignore
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;

    // ── Header ─────────────────────────────────────────────────────────────────
    doc.setFillColor(15, 60, 110);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Registro de Transporte de Material Radiactivo", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
    const periodLine =
      yearParam
        ? `Período: ${monthParam ? `${monthParam.padStart(2, "0")}/` : ""}${yearParam}  ·  `
        : "";
    doc.text(
      `${oprLine}${cchenLine}${periodLine}DS 133/1984 MINSAL — Registro de embarques  ·  Generado: ${dateStr}`,
      14,
      25
    );

    // ── KPI boxes ───────────────────────────────────────────────────────────────
    const summaryY = 34;
    const boxes = [
      { label: "Total embarques", value: String(total), color: [15, 60, 110] as [number, number, number] },
      { label: "Generadores Mo-99/Tc-99m", value: String(moTc99Count), color: [22, 163, 74] as [number, number, number] },
      { label: "Embarques I-131", value: String(i131Count), color: [59, 130, 246] as [number, number, number] },
      {
        label: "Dosis 1m excedida",
        value: String(dose1mExceeded),
        color: dose1mExceeded > 0
          ? ([220, 38, 38] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Señalética incompleta",
        value: String(signageIncomplete),
        color: signageIncomplete > 0
          ? ([202, 138, 4] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
    ];
    const boxW = 46, boxH = 14, boxGap = 6;
    let bx = 14;
    for (const box of boxes) {
      doc.setFillColor(...box.color);
      doc.roundedRect(bx, summaryY, boxW, boxH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(box.value, bx + boxW / 2, summaryY + 8, { align: "center" });
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(box.label, bx + boxW / 2, summaryY + 12.5, { align: "center" });
      bx += boxW + boxGap;
    }

    let startY = summaryY + boxH + 6;

    // ── Section header ──────────────────────────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("Registro completo de embarques de material radiactivo", 14, startY);
    startY += 2;

    // ── Table ──────────────────────────────────────────────────────────────────
    const tableRows = shipments.map((r) => {
      const dose1mVal = r.dose_1m !== null ? Number(r.dose_1m) : null;
      const doseVehicleVal = r.dose_vehicle !== null ? Number(r.dose_vehicle) : null;
      const signageOk = r.signage_dosimeter && r.signage_radiactivo7 && r.signage_nu2915;
      const signageParts = [];
      if (r.signage_dosimeter) signageParts.push("D");
      if (r.signage_radiactivo7) signageParts.push("R7");
      if (r.signage_nu2915) signageParts.push("NU");
      return [
        fmtDate(r.transport_date),
        String(r.correlative_number),
        MATERIAL_LABELS[r.material_code] ?? r.material_code,
        fmtActivity(r),
        r.it_value !== null ? fmtNum(r.it_value) : "—",
        r.dose_contact !== null ? fmtNum(r.dose_contact) : "—",
        dose1mVal !== null ? fmtNum(dose1mVal) : "—",
        doseVehicleVal !== null ? fmtNum(doseVehicleVal) : "—",
        r.driver_name ?? "—",
        r.opr_name ?? "—",
        signageParts.length > 0 ? signageParts.join("+") : "—",
      ];
    });

    autoTable(doc, {
      startY,
      head: [["Fecha", "N°", "Material", "Actividad", "IT (µSv/h)", "Contacto", "1m (µSv/h)", "Vehículo", "Conductor", "OPR", "Señal."]],
      body: tableRows.length > 0
        ? tableRows
        : [["Sin embarques registrados", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 44 },
        3: { cellWidth: 36 },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 18, halign: "center" },
        8: { cellWidth: 36 },
        9: { cellWidth: 36 },
        10: { cellWidth: 18, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;

        // Column 6: dose_1m — red if exceeded
        if (data.column.index === 6) {
          const val = parseFloat(String(data.cell.raw ?? ""));
          if (!isNaN(val) && val > DOSE_LIMIT_1M) {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          }
        }
        // Column 7: dose_vehicle — red if exceeded
        if (data.column.index === 7) {
          const val = parseFloat(String(data.cell.raw ?? ""));
          if (!isNaN(val) && val > DOSE_LIMIT_VEHICLE) {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          }
        }
        // Column 9: OPR — gray if missing
        if (data.column.index === 9) {
          if (String(data.cell.raw ?? "") === "—") {
            doc.setTextColor(180, 80, 0);
          }
        }
        // Column 10: signage — orange if incomplete
        if (data.column.index === 10) {
          const val = String(data.cell.raw ?? "");
          if (val !== "D+R7+NU" && val !== "—") {
            doc.setTextColor(202, 138, 4);
            doc.setFont("helvetica", "bold");
          }
        }
      },
    });

    // ── Limits legend ───────────────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 10;
    if (finalY < 175) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Límites DS 133/1984: Tasa dosis 1 m ≤ ${DOSE_LIMIT_1M} µSv/h · Tasa dosis vehículo ≤ ${DOSE_LIMIT_VEHICLE} µSv/h · Señalética: D=Dosímetro, R7=Radiactivo7, NU=NU2915`,
        14,
        finalY + 6
      );
      if (withoutOpr > 0) {
        doc.text(`Advertencia: ${withoutOpr} embarque(s) sin OPR registrado.`, 14, finalY + 11);
      }
    }

    // ── Footer on each page ─────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let pg = 1; pg <= pageCount; pg++) {
      doc.setPage(pg);
      const ph = doc.internal.pageSize.height;
      doc.setFillColor(240, 240, 240);
      doc.rect(0, ph - 12, pageW, 12, "F");
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(
        `SPRM v1 · Registro Transporte Material Radiactivo · DS 133/1984 MINSAL · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="transporte_material_radiactivo_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/transport/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
