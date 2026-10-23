/**
 * Exportación PDF — Estado de Equipos y Control de Calidad
 * Inventario de instrumentos de medición con estado de calibración,
 * vencimientos próximos y mantenimientos. DS 133/1984 MINSAL.
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";

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

export async function GET() {
  try {
    const institution = await getInstitutionInfo();
    const { rows } = await sql`
      SELECT
        i.id,
        i.name,
        i.serial_number,
        i.model,
        t.name AS type_name,
        i.status,
        i.location,
        lc.calibration_date AS last_calibration_date,
        lc.expiry_date AS last_calibration_expiry,
        COALESCE(lc.company_name, cc.name) AS last_calibration_company,
        COALESCE(fc.open_count, 0) AS failures_open_count
      FROM instruments i
      LEFT JOIN instrument_types t ON t.id = i.type_id
      LEFT JOIN LATERAL (
        SELECT * FROM calibrations c WHERE c.instrument_id = i.id
        ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1
      ) lc ON true
      LEFT JOIN calibration_companies cc ON cc.id = lc.company_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS open_count FROM instrument_failures f
        WHERE f.instrument_id = i.id AND f.status = 'abierto'
      ) fc ON true
      ORDER BY i.status ASC, type_name ASC, i.name ASC
      LIMIT 2000
    ` as { rows: InstrumentRow[] };

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // Stats
    const total = rows.length;
    const operativos = rows.filter((r) => r.status === "operativo").length;
    const calibVencida = rows.filter((r) => {
      const d = daysLeft(r.last_calibration_expiry);
      return (r.status === "operativo") && (d === null || d < 0);
    }).length;
    const calibProx = rows.filter((r) => {
      const d = daysLeft(r.last_calibration_expiry);
      return (r.status === "operativo") && d !== null && d >= 0 && d <= 90;
    }).length;
    const conFallas = rows.filter((r) => Number(r.failures_open_count) > 0).length;

    const { jsPDF } = await import("jspdf");
    // @ts-ignore
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFillColor(15, 60, 110);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Estado de Equipos e Instrumentos de Medición", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const instrOprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    doc.text(`${instrOprLine}Control de Calibraciones y Mantenimiento — DS 133/1984 MINSAL  ·  Generado: ${dateStr}`, 14, 25);

    // ── KPI boxes ────────────────────────────────────────────────────────────
    const summaryY = 34;
    const boxes = [
      { label: "Total instrumentos", value: String(total), color: [15, 60, 110] as [number, number, number] },
      { label: "Operativos", value: String(operativos), color: [22, 163, 74] as [number, number, number] },
      { label: "Calibración vencida", value: String(calibVencida), color: [220, 38, 38] as [number, number, number] },
      { label: "Próx. vencer (≤90d)", value: String(calibProx), color: [202, 138, 4] as [number, number, number] },
      { label: "Con fallas abiertas", value: String(conFallas), color: conFallas > 0 ? [220, 38, 38] as [number, number, number] : [100, 100, 100] as [number, number, number] },
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

    // ── Instruments table ─────────────────────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("Inventario completo de instrumentos", 14, startY);
    startY += 2;

    const tableRows = rows.map((r) => {
      const days = daysLeft(r.last_calibration_expiry);
      const calStatus = calibStatus(days);
      const statusLabel: Record<string, string> = {
        operativo: "Operativo",
        "fuera_de_servicio": "Fuera de servicio",
        mantenimiento: "En mantención",
        baja: "De baja",
      };
      return [
        r.name,
        r.serial_number ?? "—",
        r.type_name ?? "—",
        statusLabel[r.status] ?? r.status,
        r.location ?? "—",
        fmtDate(r.last_calibration_date),
        fmtDate(r.last_calibration_expiry),
        calStatus,
        r.last_calibration_company ?? "—",
        Number(r.failures_open_count) > 0 ? `${r.failures_open_count} abiertas` : "—",
      ];
    });

    autoTable(doc, {
      startY,
      head: [["Instrumento", "N° Serie", "Tipo", "Estado", "Ubicación", "Última cal.", "Vencimiento", "Est. Calibración", "Empresa", "Fallas"]],
      body: tableRows.length > 0 ? tableRows : [["Sin instrumentos registrados", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 24 },
        2: { cellWidth: 26 },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 26 },
        5: { cellWidth: 20, halign: "center" },
        6: { cellWidth: 20, halign: "center" },
        7: { cellWidth: 30, halign: "center" },
        8: { cellWidth: 34 },
        9: { cellWidth: 22, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section === "body" && data.column.index === 7) {
          const val = String(data.cell.raw ?? "");
          if (val === "VENCIDA" || val === "Sin calibración") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          } else if (val.startsWith("Próx.")) {
            doc.setTextColor(202, 138, 4);
            doc.setFont("helvetica", "bold");
          } else if (val.startsWith("Vigente")) {
            doc.setTextColor(22, 163, 74);
            doc.setFont("helvetica", "bold");
          }
        }
        if (data.section === "body" && data.column.index === 3) {
          const val = String(data.cell.raw ?? "");
          if (val === "Fuera de servicio" || val === "De baja") {
            doc.setTextColor(220, 38, 38);
          } else if (val === "En mantención") {
            doc.setTextColor(202, 138, 4);
          } else if (val === "Operativo") {
            doc.setTextColor(22, 163, 74);
          }
        }
        if (data.section === "body" && data.column.index === 9) {
          const val = String(data.cell.raw ?? "");
          if (val !== "—") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          }
        }
      },
    });

    // ── Footer on each page ─────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const ph = doc.internal.pageSize.height;
      doc.setFillColor(240, 240, 240);
      doc.rect(0, ph - 12, pageW, 12, "F");
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(
        `SPRM v1 · Estado Equipos e Instrumentos · DS 133/1984 MINSAL · Confidencial — Uso Interno · Pág. ${i} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="estado_equipos_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/instruments/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
