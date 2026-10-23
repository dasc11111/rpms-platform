/**
 * Exportación PDF — Registro de Trabajadores Ocupacionalmente Expuestos
 * DS 3/1985 MINSAL Art. 11 — Registro obligatorio a mantener en el
 * establecimiento y a disposición de la Autoridad Sanitaria (SEREMI de Salud)
 * DS 133/1984 — Reglamento de Protección Radiológica de Instalaciones
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

interface WorkerRow {
  rut: string;
  dv: string | null;
  name: string;
  last_name_1: string | null;
  last_name_2: string | null;
  first_names: string | null;
  role: string | null;
  service: string | null;
  category: string | null;
  status: string;
  authorization_number: string | null;
  authorization_issue_date: string | null;
  authorization_expiry_date: string | null;
  course_pr_completed: boolean;
  course_pr_date: string | null;
  annual_dose: string | number | null;
}

function fullName(w: WorkerRow): string {
  if (w.last_name_1 || w.last_name_2 || w.first_names) {
    return [w.last_name_1, w.last_name_2, w.first_names].filter(Boolean).join(" ");
  }
  return w.name;
}

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const s = String(val);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
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
  if (days <= 90) return `Próx. vencer (${days}d)`;
  return "Vigente";
}

export async function GET() {
  try {
    const institution = await getInstitutionInfo();
    const { rows } = await sql`
      SELECT
        w.rut, w.dv, w.name, w.last_name_1, w.last_name_2, w.first_names,
        w.role, w.service, w.category, w.status,
        w.authorization_number,
        w.authorization_issue_date,
        w.authorization_expiry_date,
        w.course_pr_completed,
        w.course_pr_date,
        COALESCE(
          (SELECT SUM(hp10) FROM dosimetry_quarterly_readings qr
           WHERE qr.worker_id = w.id AND qr.year = EXTRACT(YEAR FROM NOW())),
          0
        ) as annual_dose
      FROM workers w
      WHERE w.status IN ('activo', 'suspended')
      ORDER BY w.service ASC, w.last_name_1 ASC, w.name ASC
      LIMIT 2000
    ` as { rows: WorkerRow[] };

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);
    const year = now.getFullYear();

    const totalWorkers = rows.length;
    const vencidos = rows.filter((w) => {
      const d = daysLeft(w.authorization_expiry_date);
      return d !== null && d < 0;
    }).length;
    const proximoVencer = rows.filter((w) => {
      const d = daysLeft(w.authorization_expiry_date);
      return d !== null && d >= 0 && d <= 90;
    }).length;
    const sinAutorizacion = rows.filter((w) => !w.authorization_expiry_date).length;

    // Group by service for section headers
    const serviceMap = new Map<string, WorkerRow[]>();
    for (const w of rows) {
      const svc = w.service ?? "Sin servicio asignado";
      if (!serviceMap.has(svc)) serviceMap.set(svc, []);
      serviceMap.get(svc)!.push(w);
    }

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
    doc.text("Registro de Trabajadores Ocupacionalmente Expuestos", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
    doc.text(`${oprLine}${cchenLine}DS 3/1985 MINSAL Art. 11 · DS 133/1984  ·  Generado: ${dateStr}  ·  Año ${year}`, 14, 25);

    // ── Status summary row ───────────────────────────────────────────────────
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    const summaryY = 34;
    const boxes = [
      { label: "Total expuestos", value: String(totalWorkers), color: [15, 60, 110] as [number, number, number] },
      { label: "Autorizaciones vigentes", value: String(totalWorkers - vencidos - proximoVencer - sinAutorizacion), color: [22, 163, 74] as [number, number, number] },
      { label: "Próximas a vencer (≤90d)", value: String(proximoVencer), color: [202, 138, 4] as [number, number, number] },
      { label: "Vencidas", value: String(vencidos), color: [220, 38, 38] as [number, number, number] },
      { label: "Sin autorización", value: String(sinAutorizacion), color: [100, 100, 100] as [number, number, number] },
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

    // ── Worker table per service ─────────────────────────────────────────────
    for (const [service, workers] of serviceMap.entries()) {
      if (startY > 165) {
        doc.addPage();
        startY = 15;
      }

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(`Servicio: ${service}  (${workers.length} trabajador${workers.length !== 1 ? "es" : ""})`, 14, startY);
      startY += 2;

      const tableRows = workers.map((w) => {
        const days = daysLeft(w.authorization_expiry_date);
        const status = authStatus(days);
        const rutFull = w.dv ? `${w.rut}-${w.dv}` : w.rut;
        const doseVal = Number(w.annual_dose ?? 0);
        return [
          fullName(w),
          rutFull,
          w.role ?? "—",
          w.category ?? "—",
          w.authorization_number ?? "—",
          fmtDate(w.authorization_issue_date),
          fmtDate(w.authorization_expiry_date),
          status,
          w.course_pr_completed ? `Sí${w.course_pr_date ? ` (${fmtDate(w.course_pr_date)})` : ""}` : "No",
          doseVal > 0 ? `${doseVal.toFixed(2)} mSv` : "—",
        ];
      });

      autoTable(doc, {
        startY,
        head: [["Nombre", "RUT", "Cargo", "Categoría", "N° Autorizac.", "Emisión", "Vencimiento", "Estado", "Curso PR", "Dosis anual"]],
        body: tableRows,
        theme: "grid",
        headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 6.5, cellPadding: 1.8 },
        columnStyles: {
          0: { cellWidth: 52 },
          1: { cellWidth: 24 },
          2: { cellWidth: 34 },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 26, halign: "center" },
          5: { cellWidth: 20, halign: "center" },
          6: { cellWidth: 20, halign: "center" },
          7: { cellWidth: 28, halign: "center" },
          8: { cellWidth: 28, halign: "center" },
          9: { cellWidth: 22, halign: "right" },
        },
        didDrawCell: (data: any) => {
          if (data.section === "body" && data.column.index === 7) {
            const val = String(data.cell.raw ?? "");
            if (val === "VENCIDA") {
              doc.setTextColor(220, 38, 38);
              doc.setFont("helvetica", "bold");
            } else if (val.startsWith("Próx.")) {
              doc.setTextColor(202, 138, 4);
              doc.setFont("helvetica", "bold");
            } else if (val === "Vigente") {
              doc.setTextColor(22, 163, 74);
              doc.setFont("helvetica", "bold");
            } else {
              doc.setTextColor(100, 100, 100);
            }
          }
          if (data.section === "body" && data.column.index === 8) {
            const val = String(data.cell.raw ?? "");
            if (val === "No") {
              doc.setTextColor(220, 38, 38);
            }
          }
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (rows.length === 0) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("No hay trabajadores expuestos registrados en el sistema.", 14, startY + 10);
    }

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
        `SPRM v1 · Registro Trabajadores Expuestos ${year} · DS 3/1985 MINSAL Art. 11 · Confidencial — Uso Interno · Pág. ${i} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="registro_trabajadores_expuestos_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/workers/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
