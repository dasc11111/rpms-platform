/**
 * Exportación PDF — Reporte de Cumplimiento Normativo
 * Estado de requisitos regulatorios por categoría y regulación.
 * DS 133/1984, DS 3/1985 MINSAL, Ley 18.302, NCh 2764, CCHEN
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureComplianceTables } from "@/lib/compliance";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

interface ComplianceRow {
  id: number;
  code: string | null;
  requirement: string;
  regulation: string | null;
  article_ref: string | null;
  category: string | null;
  priority: string | null;
  owner: string | null;
  status: string;
  next_review_date: string | null;
  last_review_date: string | null;
  evidence_description: string | null;
  notes: string | null;
}

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function priorityLabel(p: string | null): string {
  const map: Record<string, string> = {
    critica: "Crítica",
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  };
  return map[p ?? ""] ?? (p ?? "—");
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    ok: "Al día",
    pendiente: "Pendiente",
    vencido: "Vencido",
  };
  return map[s] ?? s;
}

export async function GET() {
  try {
    const institution = await getInstitutionInfo();
    await ensureComplianceTables();

    const { rows } = await sql`
      SELECT * FROM compliance_requirements
      ORDER BY
        CASE priority WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
        CASE status WHEN 'vencido' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END,
        regulation ASC, code ASC
      LIMIT 2000
    ` as { rows: ComplianceRow[] };

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // Compute stats
    const total = rows.length;
    const ok = rows.filter((r) => r.status === "ok").length;
    const pendiente = rows.filter((r) => r.status === "pendiente").length;
    const vencido = rows.filter((r) => r.status === "vencido").length;
    const score = total > 0 ? Math.round((ok / total) * 100) : null;

    // Group by regulation
    const regulationMap = new Map<string, ComplianceRow[]>();
    for (const row of rows) {
      const reg = row.regulation ?? "Sin regulación especificada";
      if (!regulationMap.has(reg)) regulationMap.set(reg, []);
      regulationMap.get(reg)!.push(row);
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
    doc.text("Reporte de Cumplimiento Normativo", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const compOprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    doc.text(`${compOprLine}DS 133/1984 · DS 3/1985 · Ley 18.302 · NCh 2764 · CCHEN  ·  Generado: ${dateStr}`, 14, 25);

    // ── KPI boxes ────────────────────────────────────────────────────────────
    const summaryY = 34;
    const globalColor: [number, number, number] =
      vencido > 0 ? [220, 38, 38] : pendiente > 0 ? [202, 138, 4] : [22, 163, 74];

    const boxes = [
      { label: "Total requisitos", value: String(total), color: [15, 60, 110] as [number, number, number] },
      { label: "Al día", value: String(ok), color: [22, 163, 74] as [number, number, number] },
      { label: "Pendientes", value: String(pendiente), color: [202, 138, 4] as [number, number, number] },
      { label: "Vencidos", value: String(vencido), color: [220, 38, 38] as [number, number, number] },
      { label: "Índice cumplimiento", value: score !== null ? `${score}%` : "—", color: globalColor },
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

    // ── Requirements table per regulation ────────────────────────────────────
    for (const [regulation, reqs] of regulationMap.entries()) {
      if (startY > 165) {
        doc.addPage();
        startY = 15;
      }

      const regOk = reqs.filter((r) => r.status === "ok").length;
      const regVencido = reqs.filter((r) => r.status === "vencido").length;
      const regPendiente = reqs.filter((r) => r.status === "pendiente").length;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${regulation}  —  ${reqs.length} req.  ·  ${regOk} al día  ·  ${regPendiente} pendientes  ·  ${regVencido} vencidos`,
        14,
        startY
      );
      startY += 2;

      const tableRows = reqs.map((r) => [
        r.code ?? "—",
        r.requirement,
        r.article_ref ?? "—",
        priorityLabel(r.priority),
        r.owner ?? "—",
        statusLabel(r.status),
        fmtDate(r.last_review_date),
        fmtDate(r.next_review_date),
      ]);

      autoTable(doc, {
        startY,
        head: [["Código", "Requisito", "Artículo", "Prioridad", "Responsable", "Estado", "Última rev.", "Próx. rev."]],
        body: tableRows,
        theme: "grid",
        headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 6.5, cellPadding: 1.8 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 82 },
          2: { cellWidth: 22 },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 36 },
          5: { cellWidth: 20, halign: "center" },
          6: { cellWidth: 22, halign: "center" },
          7: { cellWidth: 22, halign: "center" },
        },
        didDrawCell: (data: any) => {
          if (data.section === "body" && data.column.index === 5) {
            const val = String(data.cell.raw ?? "");
            if (val === "Vencido") {
              doc.setTextColor(220, 38, 38);
              doc.setFont("helvetica", "bold");
            } else if (val === "Pendiente") {
              doc.setTextColor(202, 138, 4);
              doc.setFont("helvetica", "bold");
            } else if (val === "Al día") {
              doc.setTextColor(22, 163, 74);
              doc.setFont("helvetica", "bold");
            }
          }
          if (data.section === "body" && data.column.index === 3) {
            const val = String(data.cell.raw ?? "");
            if (val === "Crítica") {
              doc.setTextColor(220, 38, 38);
              doc.setFont("helvetica", "bold");
            } else if (val === "Alta") {
              doc.setTextColor(202, 138, 4);
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
      doc.text("No hay requisitos de cumplimiento registrados en el sistema.", 14, startY + 10);
    }

    // ── Footer ───────────────────────────────────────────────────────────────
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
        `SPRM v1 · Cumplimiento Normativo ${now.getFullYear()} · DS 133/1984 · DS 3/1985 MINSAL · Confidencial — Uso Interno · Pág. ${i} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cumplimiento_normativo_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/compliance/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
