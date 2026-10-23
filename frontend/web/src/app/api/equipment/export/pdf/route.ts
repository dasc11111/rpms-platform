/**
 * Exportación PDF — Equipos Generadores de Radiación
 * Inventario de equipos radiológicos con estado de autorización DS 133/1984.
 * Obligatorio para SEREMI de Salud / CCHEN.
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

interface EquipmentRow {
  id: number;
  inventory_number: string | null;
  name: string;
  equipment_type: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  status: string;
  regulatory_class: string | null;
  tube_voltage_kv: number | null;
  authorization_number: string | null;
  authorization_issue_date: string | null;
  authorization_expiry_date: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  notes: string | null;
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

function authStatus(days: number | null): string {
  if (days === null) return "Sin autorización";
  if (days < 0) return "VENCIDA";
  if (days <= 90) return `Próx. (${days}d)`;
  return `Vigente (${days}d)`;
}

export async function GET() {
  try {
    const institution = await getInstitutionInfo();

    const { rows } = await sql`
      SELECT
        id, inventory_number, name, equipment_type, brand, model, serial_number,
        location, status, regulatory_class, tube_voltage_kv,
        authorization_number, authorization_issue_date, authorization_expiry_date,
        last_maintenance_date, next_maintenance_date, notes
      FROM radiology_equipment
      ORDER BY status ASC, equipment_type ASC, name ASC
      LIMIT 2000
    ` as { rows: EquipmentRow[] };

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // Stats
    const total = rows.length;
    const activos = rows.filter((r) => r.status === "activo").length;
    const authVencida = rows.filter((r) => {
      const d = daysLeft(r.authorization_expiry_date);
      return r.status === "activo" && (d !== null && d < 0);
    }).length;
    const authProx = rows.filter((r) => {
      const d = daysLeft(r.authorization_expiry_date);
      return r.status === "activo" && d !== null && d >= 0 && d <= 90;
    }).length;
    const sinAuth = rows.filter((r) => r.status === "activo" && !r.authorization_expiry_date).length;

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
    doc.text("Registro de Equipos Generadores de Radiación — DS 133/1984", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
    doc.text(`${oprLine}${cchenLine}DS 133/1984 MINSAL — Autorización de uso de equipos  ·  Generado: ${dateStr}`, 14, 25);

    // ── KPI boxes ────────────────────────────────────────────────────────────
    const summaryY = 34;
    const boxes = [
      { label: "Total equipos", value: String(total), color: [15, 60, 110] as [number, number, number] },
      { label: "Activos", value: String(activos), color: [22, 163, 74] as [number, number, number] },
      { label: "Autorización vencida", value: String(authVencida), color: authVencida > 0 ? [220, 38, 38] as [number, number, number] : [100, 100, 100] as [number, number, number] },
      { label: "Próx. vencer (≤90d)", value: String(authProx), color: authProx > 0 ? [202, 138, 4] as [number, number, number] : [100, 100, 100] as [number, number, number] },
      { label: "Sin autorización", value: String(sinAuth), color: sinAuth > 0 ? [202, 138, 4] as [number, number, number] : [100, 100, 100] as [number, number, number] },
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

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("Inventario de equipos radiológicos", 14, startY);
    startY += 2;

    const tableRows = rows.map((r) => {
      const days = daysLeft(r.authorization_expiry_date);
      const aStatus = authStatus(days);
      const statusLabels: Record<string, string> = {
        activo: "Activo",
        inactivo: "Inactivo",
        baja: "De baja",
        mantenimiento: "En mantención",
      };
      return [
        r.inventory_number ?? "—",
        r.name,
        r.equipment_type ?? "—",
        `${r.brand ?? ""}${r.model ? " " + r.model : ""}`.trim() || "—",
        r.serial_number ?? "—",
        r.location ?? "—",
        statusLabels[r.status] ?? r.status,
        r.regulatory_class ?? "—",
        r.authorization_number ?? "—",
        fmtDate(r.authorization_issue_date),
        fmtDate(r.authorization_expiry_date),
        aStatus,
        fmtDate(r.last_maintenance_date),
        fmtDate(r.next_maintenance_date),
      ];
    });

    autoTable(doc, {
      startY,
      head: [["Inv.", "Nombre", "Tipo", "Marca/Modelo", "N° Serie", "Ubicación", "Estado", "Clase", "N° Autorizac.", "Emisión", "Venc.", "Est. Autorizac.", "Último Mant.", "Próx. Mant."]],
      body: tableRows.length > 0 ? tableRows : [["Sin equipos registrados", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 6.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 6, cellPadding: 1.6 },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 36 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 20 },
        5: { cellWidth: 24 },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 14, halign: "center" },
        8: { cellWidth: 22, halign: "center" },
        9: { cellWidth: 16, halign: "center" },
        10: { cellWidth: 16, halign: "center" },
        11: { cellWidth: 22, halign: "center" },
        12: { cellWidth: 16, halign: "center" },
        13: { cellWidth: 16, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section === "body" && data.column.index === 11) {
          const val = String(data.cell.raw ?? "");
          if (val === "VENCIDA") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          } else if (val.startsWith("Próx.") || val === "Sin autorización") {
            doc.setTextColor(202, 138, 4);
            doc.setFont("helvetica", "bold");
          } else if (val.startsWith("Vigente")) {
            doc.setTextColor(22, 163, 74);
            doc.setFont("helvetica", "bold");
          }
        }
        if (data.section === "body" && data.column.index === 6) {
          const val = String(data.cell.raw ?? "");
          if (val === "De baja" || val === "Inactivo") {
            doc.setTextColor(220, 38, 38);
          } else if (val === "En mantención") {
            doc.setTextColor(202, 138, 4);
          } else if (val === "Activo") {
            doc.setTextColor(22, 163, 74);
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
        `SPRM v1 · Equipos Generadores de Radiación · DS 133/1984 MINSAL · Confidencial — Uso Interno · Pág. ${i} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="equipos_radiologicos_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/equipment/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
