/**
 * Exportación PDF — Registro de Dosímetros Físicos
 * Control de dosímetros de película/TLD asignados a Trabajadores Ocupacionalmente Expuestos.
 * DS 3/1985 MINSAL Art. 11 — Registro obligatorio para la Autoridad Sanitaria.
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import { ensureDosimeterTables } from "@/lib/dosimeters-db";

export const dynamic = "force-dynamic";

interface DosimeterExportRow {
  id: number;
  code: string;
  type: string;
  status: string;
  worker_rut: string | null;
  worker_name: string | null;
  service: string | null;
  unit: string | null;
  delivery_date: string | null;
  estimated_return_date: string | null;
  actual_return_date: string | null;
  observations: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  cuerpo_entero: "Cuerpo entero",
  cristalino: "Cristalino",
  extremidades: "Extremidades",
  ambiental: "Ambiental",
  area: "Área",
  otro: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  disponible: "Disponible",
  asignado: "Asignado",
  devuelto: "Devuelto",
  extraviado: "Extraviado",
  en_laboratorio: "En laboratorio",
  fuera_de_servicio: "Fuera de servicio",
  danado: "Dañado",
};

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function daysOverdue(estimatedReturn: string | null): number | null {
  if (!estimatedReturn) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(estimatedReturn));
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function isOverdue(row: DosimeterExportRow): boolean {
  if (row.status !== "asignado") return false;
  if (row.actual_return_date) return false;
  const d = daysOverdue(row.estimated_return_date);
  return d !== null && d > 0;
}

export async function GET() {
  try {
    await ensureDosimeterTables();
    const institution = await getInstitutionInfo();

    const { rows } = await sql`
      SELECT
        d.id, d.code, d.type, d.status,
        d.worker_rut, d.worker_name, d.service, d.unit,
        d.delivery_date, d.estimated_return_date, d.actual_return_date,
        d.observations
      FROM dosimeters d
      ORDER BY
        CASE d.status
          WHEN 'extraviado' THEN 1
          WHEN 'asignado' THEN 2
          WHEN 'disponible' THEN 3
          ELSE 4
        END,
        d.service ASC NULLS LAST,
        d.code ASC
    ` as { rows: DosimeterExportRow[] };

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);
    const { year: currentYear, quarter: currentQuarter } = (() => {
      const q = Math.floor(now.getMonth() / 3) + 1;
      return { year: now.getFullYear(), quarter: q };
    })();
    const quarterNames = ["Primer", "Segundo", "Tercer", "Cuarto"];
    const currentQuarterLabel = `${quarterNames[currentQuarter - 1]} trimestre ${currentYear}`;

    // ── Stats ──────────────────────────────────────────────────────────────────
    const total = rows.length;
    const disponibles = rows.filter((r) => r.status === "disponible").length;
    const asignados = rows.filter((r) => r.status === "asignado").length;
    const extraviados = rows.filter((r) => r.status === "extraviado").length;
    const fueraDePlazo = rows.filter((r) => isOverdue(r)).length;
    const enLaboratorio = rows.filter((r) => r.status === "en_laboratorio").length;

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
    doc.text("Registro de Dosímetros Físicos — Control de Asignación", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
    doc.text(
      `${oprLine}${cchenLine}DS 3/1985 MINSAL Art. 11  ·  Trimestre vigente: ${currentQuarterLabel}  ·  Generado: ${dateStr}`,
      14,
      25
    );

    // ── KPI boxes ───────────────────────────────────────────────────────────────
    const summaryY = 34;
    const boxes = [
      { label: "Total dosímetros", value: String(total), color: [15, 60, 110] as [number, number, number] },
      { label: "Disponibles", value: String(disponibles), color: [22, 163, 74] as [number, number, number] },
      { label: "Asignados", value: String(asignados), color: [59, 130, 246] as [number, number, number] },
      {
        label: "Fuera de plazo",
        value: String(fueraDePlazo),
        color: fueraDePlazo > 0
          ? ([220, 38, 38] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Extraviados",
        value: String(extraviados),
        color: extraviados > 0
          ? ([220, 38, 38] as [number, number, number])
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
    doc.text("Inventario completo de dosímetros físicos", 14, startY);
    startY += 2;

    // ── Table ──────────────────────────────────────────────────────────────────
    const tableRows = rows.map((r) => {
      const overdue = isOverdue(r);
      const overdueDays = overdue ? daysOverdue(r.estimated_return_date) : null;
      const statusLabel = STATUS_LABELS[String(r.status)] ?? r.status;
      const statusDisplay = overdue && overdueDays
        ? `${statusLabel} (+${overdueDays}d)`
        : statusLabel;

      return [
        r.code,
        TYPE_LABELS[String(r.type)] ?? r.type,
        r.worker_name ?? "—",
        r.worker_rut ?? "—",
        r.service ?? "—",
        fmtDate(r.delivery_date),
        fmtDate(r.estimated_return_date),
        fmtDate(r.actual_return_date),
        statusDisplay,
      ];
    });

    autoTable(doc, {
      startY,
      head: [["Código XA", "Tipo", "Trabajador", "RUT", "Servicio", "Entrega", "Dev. estimada", "Dev. real", "Estado"]],
      body: tableRows.length > 0
        ? tableRows
        : [["Sin dosímetros registrados", "—", "—", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 24, halign: "center", font: "courier" },
        1: { cellWidth: 26 },
        2: { cellWidth: 54 },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 38 },
        5: { cellWidth: 20, halign: "center" },
        6: { cellWidth: 22, halign: "center" },
        7: { cellWidth: 20, halign: "center" },
        8: { cellWidth: 36, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;

        // Column 8: status — color by state
        if (data.column.index === 8) {
          const val = String(data.cell.raw ?? "");
          if (val === "Extraviado") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          } else if (val.startsWith("Dañado") || val.startsWith("Fuera")) {
            doc.setTextColor(220, 38, 38);
          } else if (val.startsWith("Asignado (+")) {
            // overdue — orange bold
            doc.setTextColor(202, 138, 4);
            doc.setFont("helvetica", "bold");
          } else if (val === "Asignado") {
            doc.setTextColor(59, 130, 246);
          } else if (val === "Disponible") {
            doc.setTextColor(22, 163, 74);
          } else if (val === "En laboratorio") {
            doc.setTextColor(202, 138, 4);
          }
        }
      },
    });

    // ── Note on laboratory / overdue ────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 10;
    if (finalY < 175) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      const notes: string[] = [];
      if (fueraDePlazo > 0)
        notes.push(`${fueraDePlazo} dosímetro(s) fuera de plazo de devolución — gestionar devolución inmediata.`);
      if (extraviados > 0)
        notes.push(`${extraviados} dosímetro(s) extraviado(s) — reportar al OPR y a SEREMI de Salud si corresponde.`);
      if (enLaboratorio > 0)
        notes.push(`${enLaboratorio} dosímetro(s) en laboratorio de lectura.`);
      if (notes.length > 0) {
        doc.text("Alertas: " + notes.join(" "), 14, finalY + 6);
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
        `SPRM v1 · Registro Dosímetros Físicos · DS 3/1985 MINSAL Art. 11 · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dosimetros_fisicos_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/dosimeters/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
