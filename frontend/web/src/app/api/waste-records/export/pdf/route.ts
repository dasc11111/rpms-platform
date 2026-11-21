/**
 * GET /api/waste-records/export/pdf
 * Informe de Gestión de Residuos Radiactivos — Módulo D
 * Formato: A4 apaisado, jsPDF + autotable
 * Referencia normativa: DS 133/1984 MINSAL Art. 47-52 · CCHEN Reglamento de Residuos Radiactivos
 *                       IAEA GSR Part 5 · SSG-45
 */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import {
  calcWasteDerived,
  WASTE_STATE_LABELS,
  WASTE_CATEGORY_LABELS,
  DISPOSAL_ROUTE_LABELS,
  type WasteRecord,
  type WasteState,
  type WasteCategory,
  type DisposalRoute,
} from "@/lib/waste-records";

// ─── PDF layout constants ──────────────────────────────────────────────────────
const PW = 297, PH = 210;   // A4 landscape mm
const ML = 14, MR = 14;
const CW = PW - ML - MR;    // 269 mm

const HDR_DARK:  [number, number, number] = [15,  60,  110];
const HDR_MED:   [number, number, number] = [30,  80,  140];
const HDR_LIGHT: [number, number, number] = [220, 235, 250];

const GREEN:  [number, number, number] = [209, 250, 229];
const YELLOW: [number, number, number] = [254, 249, 195];
const RED:    [number, number, number] = [254, 226, 226];
const GTEXT:  [number, number, number] = [22,  101,  52];
const YTEXT:  [number, number, number] = [133, 77,   14];
const RTEXT:  [number, number, number] = [153, 27,   27];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL");
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL");
}
function fmtMbq(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(2)} GBq`;
  if (v < 0.001) return `${(v * 1000).toFixed(3)} kBq`;
  return `${v.toFixed(3)} MBq`;
}

export async function GET(): Promise<NextResponse> {
  try {
    const { jsPDF } = await import("jspdf");
    // @ts-ignore
    await import("jspdf-autotable");

    const [recordsResult, institution] = await Promise.all([
      sql`
        SELECT * FROM waste_records
        ORDER BY initial_activity_date DESC
        LIMIT 500
      `,
      getInstitutionInfo(),
    ]);

    const rawRecords = recordsResult.rows as WasteRecord[];
    const records = rawRecords.map((r) => ({
      ...r,
      derived: calcWasteDerived(r),
    }));

    // ── Statistics ──
    const byState: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byRadionuclide: Record<string, number> = {};
    let totalInitialMbq = 0;
    let totalCurrentMbq = 0;

    for (const r of records) {
      byState[r.state] = (byState[r.state] ?? 0) + 1;
      byCategory[r.waste_category] = (byCategory[r.waste_category] ?? 0) + 1;
      byRadionuclide[r.radionuclide] = (byRadionuclide[r.radionuclide] ?? 0) + 1;
      totalInitialMbq += r.initial_activity_mbq;
      totalCurrentMbq += r.derived.current_activity_mbq;
    }

    const activeRecords = records.filter((r) =>
      r.state === "en_almacenamiento" || r.state === "en_decaimiento"
    );
    const readyToRelease = activeRecords.filter((r) => r.derived.can_release);
    const closeSoon = activeRecords.filter(
      (r) => !r.derived.can_release && r.derived.days_until_release <= 7
    );
    const releasedRecords = records.filter((r) =>
      r.state === "liberado" || r.state === "transferido" || r.state === "descartado"
    );

    // ── PDF ──
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const today = new Date().toLocaleDateString("es-CL");
    const todayISO = new Date().toISOString().slice(0, 10);
    let pageNum = 1;

    // eslint-disable-next-line prefer-const
    let totalPages = 4;

    function drawPageHeader(title: string) {
      // Main header bar
      doc.setFillColor(...HDR_DARK);
      doc.rect(0, 0, PW, 18, "F");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("RPMS · Módulo D — Gestión de Residuos Radiactivos", ML, 11);
      // Subtitle bar
      doc.setFillColor(...HDR_MED);
      doc.rect(0, 18, PW, 9, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(title, ML, 24.5);
      doc.text(`${institution.name}  ·  ${today}`, PW - MR, 24.5, { align: "right" });
    }

    function drawFooter(pn: number, tp: number) {
      const y = PH - 8;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(ML, y - 2, PW - MR, y - 2);
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(
        `DS 133/1984 MINSAL Art. 47-52 · CCHEN Reglamento de Residuos Radiactivos · IAEA GSR Part 5 · SSG-45`,
        ML, y + 2
      );
      doc.text(`Página ${pn} / ${tp}`, PW - MR, y + 2, { align: "right" });
    }

    function sectionHeader(y: number, title: string): number {
      doc.setFillColor(...HDR_LIGHT);
      doc.rect(ML, y, CW, 7, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...HDR_DARK);
      doc.text(title, ML + 3, y + 5);
      return y + 7;
    }

    function checkPageBreak(
      y: number,
      threshold = 15,
      newTitle?: string
    ): number {
      if (y > PH - threshold - 18) {
        drawFooter(pageNum, totalPages);
        doc.addPage();
        pageNum++;
        drawPageHeader(newTitle ?? "Continuación");
        return 34;
      }
      return y;
    }

    // ══════════════════════════════════════════════════
    // PAGE 1 — Resumen estadístico
    // ══════════════════════════════════════════════════
    drawPageHeader("Resumen Estadístico — Inventario de Residuos Radiactivos");

    let y = 34;

    // KPI row
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);

    const kpis = [
      { label: "Total registros", value: records.length.toString(), color: HDR_LIGHT },
      { label: "Activos (almac./decaim.)", value: activeRecords.length.toString(), color: [220,230,255] as [number,number,number] },
      { label: "Listos para liberar", value: readyToRelease.length.toString(), color: GREEN },
      { label: "Próximos 7 días", value: closeSoon.length.toString(), color: YELLOW },
      { label: "Liberados/transferidos", value: releasedRecords.length.toString(), color: [240,240,240] as [number,number,number] },
      { label: "Act. inicial total", value: fmtMbq(totalInitialMbq), color: HDR_LIGHT },
      { label: "Act. actual total", value: fmtMbq(totalCurrentMbq), color: HDR_LIGHT },
    ];

    const kpiW = CW / kpis.length;
    kpis.forEach((k, i) => {
      const kx = ML + i * kpiW;
      doc.setFillColor(...k.color);
      doc.roundedRect(kx + 1, y, kpiW - 2, 18, 1.5, 1.5, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...HDR_DARK);
      doc.text(k.value, kx + kpiW / 2, y + 10, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(k.label, kx + kpiW / 2, y + 16, { align: "center" });
    });
    y += 24;

    // State breakdown table
    y = sectionHeader(y, "1.1  Distribución por Estado");
    (doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      startY: y,
      head: [["Estado", "Cantidad", "% del Total"]],
      body: WASTE_STATE_LABELS
        ? Object.entries(WASTE_STATE_LABELS).map(([st, label]) => [
            label,
            byState[st] ?? 0,
            `${(((byState[st] ?? 0) / Math.max(1, records.length)) * 100).toFixed(1)}%`,
          ])
        : [],
      margin: { left: ML, right: MR },
      tableWidth: CW * 0.4,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HDR_MED, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const stateTableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // Category breakdown table (side by side)
    y = sectionHeader(stateTableEnd + 4, "1.2  Distribución por Categoría");
    (doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      startY: y,
      head: [["Categoría", "Cantidad"]],
      body: Object.entries(WASTE_CATEGORY_LABELS).map(([cat, label]) => [
        label,
        byCategory[cat] ?? 0,
      ]),
      margin: { left: ML, right: MR },
      tableWidth: CW * 0.45,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HDR_MED, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const catTableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // Radionuclide breakdown
    y = sectionHeader(catTableEnd + 4, "1.3  Distribución por Radionúclido");
    (doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      startY: y,
      head: [["Radionúclido", "Cantidad"]],
      body: Object.entries(byRadionuclide).sort((a, b) => b[1] - a[1]).map(([rn, cnt]) => [rn, cnt]),
      margin: { left: ML, right: MR },
      tableWidth: CW * 0.35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: HDR_MED, textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    drawFooter(pageNum, totalPages);

    // ══════════════════════════════════════════════════
    // PAGE 2 — Inventario activo (almacenamiento / decaimiento)
    // ══════════════════════════════════════════════════
    doc.addPage();
    pageNum++;
    drawPageHeader("Inventario Activo — En Almacenamiento y Decaimiento");
    y = 34;

    y = sectionHeader(y, "2.1  Registros en Almacenamiento y Decaimiento");

    (doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      startY: y,
      head: [[
        "Etiqueta", "Radionúclido", "Categoría", "Act. Inicial", "Fecha Inicial",
        "Act. Actual", "% Inicial", "Fecha Liberación", "Días Restantes", "Estado", "Semáforo"
      ]],
      body: activeRecords.map((r) => [
        r.container_label,
        r.radionuclide,
        WASTE_CATEGORY_LABELS[String(r.waste_category as WasteCategory)] ?? r.waste_category,
        fmtMbq(r.initial_activity_mbq),
        fmtDate(r.initial_activity_date),
        fmtMbq(r.derived.current_activity_mbq),
        `${r.derived.activity_pct_initial.toFixed(1)}%`,
        fmtDate(r.derived.retention_deadline),
        r.derived.can_release ? "—" : r.derived.days_until_release.toFixed(0),
        WASTE_STATE_LABELS[String(r.state as WasteState)] ?? r.state,
        r.derived.semaphore_label,
      ]),
      margin: { left: ML, right: MR },
      tableWidth: CW,
      styles: { fontSize: 6.5, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: HDR_DARK, textColor: 255, fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 18 },
        2: { cellWidth: 36 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 20 },
        6: { cellWidth: 14 },
        7: { cellWidth: 22 },
        8: { cellWidth: 18 },
        9: { cellWidth: 26 },
        10: { cellWidth: "auto" },
      },
      didParseCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { fillColor: number[]; textColor: number[] } } }) => {
        if (data.section === "body" && data.column.index === 10) {
          const rec = activeRecords[data.row.index];
          if (!rec) return;
          if (rec.derived.semaphore === "verde") {
            data.cell.styles.fillColor = GREEN;
            data.cell.styles.textColor = GTEXT;
          } else if (rec.derived.semaphore === "amarillo") {
            data.cell.styles.fillColor = YELLOW;
            data.cell.styles.textColor = YTEXT;
          } else {
            data.cell.styles.fillColor = RED;
            data.cell.styles.textColor = RTEXT;
          }
        }
      },
      didDrawPage: (data: { pageNumber: number }) => {
        if (data.pageNumber > 1) {
          drawPageHeader("Inventario Activo (continuación)");
          drawFooter(pageNum, totalPages);
        }
      },
    });

    drawFooter(pageNum, totalPages);

    // ══════════════════════════════════════════════════
    // PAGE 3 — Registros liberados / transferidos / descartados
    // ══════════════════════════════════════════════════
    doc.addPage();
    pageNum++;
    drawPageHeader("Registros Finalizados — Liberados, Transferidos y Descartados");
    y = 34;

    y = sectionHeader(y, "3.1  Registros Finalizados");

    (doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      startY: y,
      head: [[
        "Etiqueta", "Radionúclido", "Categoría", "Act. Inicial", "Fecha Inicial",
        "Estado Final", "Ruta Disposición", "Fecha Liberación", "Responsable"
      ]],
      body: releasedRecords.map((r) => [
        r.container_label,
        r.radionuclide,
        WASTE_CATEGORY_LABELS[String(r.waste_category as WasteCategory)] ?? r.waste_category,
        fmtMbq(r.initial_activity_mbq),
        fmtDate(r.initial_activity_date),
        WASTE_STATE_LABELS[String(r.state as WasteState)] ?? r.state,
        r.disposal_route
          ? (DISPOSAL_ROUTE_LABELS[String(r.disposal_route as DisposalRoute)] ?? r.disposal_route)
          : "—",
        fmtDate(r.release_date),
        r.released_by ?? "—",
      ]),
      margin: { left: ML, right: MR },
      tableWidth: CW,
      styles: { fontSize: 7, cellPadding: 1.8, overflow: "linebreak" },
      headStyles: { fillColor: HDR_DARK, textColor: 255, fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 18 },
        2: { cellWidth: 36 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28 },
        6: { cellWidth: 50 },
        7: { cellWidth: 22 },
        8: { cellWidth: "auto" },
      },
      didParseCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { fillColor: number[]; textColor: number[] } } }) => {
        if (data.section === "body" && data.column.index === 5) {
          const rec = releasedRecords[data.row.index];
          if (!rec) return;
          if (rec.state === "liberado") {
            data.cell.styles.fillColor = GREEN;
            data.cell.styles.textColor = GTEXT;
          } else if (rec.state === "transferido") {
            data.cell.styles.fillColor = [219, 234, 254];
            data.cell.styles.textColor = [30, 64, 175];
          } else {
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [75, 85, 99];
          }
        }
      },
      didDrawPage: (data: { pageNumber: number }) => {
        if (data.pageNumber > 1) {
          drawPageHeader("Registros Finalizados (continuación)");
          drawFooter(pageNum, totalPages);
        }
      },
    });

    drawFooter(pageNum, totalPages);

    // ══════════════════════════════════════════════════
    // PAGE 4 — Inventario completo
    // ══════════════════════════════════════════════════
    doc.addPage();
    pageNum++;
    drawPageHeader("Inventario Completo — Todos los Registros");
    y = 34;

    y = sectionHeader(y, "4.1  Inventario Completo de Residuos Radiactivos");

    (doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
      startY: y,
      head: [[
        "Etiqueta", "Radionúclido", "Categoría", "Act. Inicial", "Fecha Inicial",
        "Estado", "Área Origen", "Generado por", "Fecha Registro"
      ]],
      body: records.map((r) => [
        r.container_label,
        r.radionuclide,
        WASTE_CATEGORY_LABELS[String(r.waste_category as WasteCategory)] ?? r.waste_category,
        fmtMbq(r.initial_activity_mbq),
        fmtDate(r.initial_activity_date),
        WASTE_STATE_LABELS[String(r.state as WasteState)] ?? r.state,
        r.origin_area,
        r.generated_by,
        fmtDate(r.created_at),
      ]),
      margin: { left: ML, right: MR },
      tableWidth: CW,
      styles: { fontSize: 6.5, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: HDR_DARK, textColor: 255, fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 18 },
        2: { cellWidth: 36 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28 },
        6: { cellWidth: 30 },
        7: { cellWidth: 30 },
        8: { cellWidth: "auto" },
      },
      didParseCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { fillColor: number[]; textColor: number[] } } }) => {
        if (data.section === "body" && data.column.index === 5) {
          const rec = records[data.row.index];
          if (!rec) return;
          if (rec.state === "liberado") {
            data.cell.styles.fillColor = GREEN;
            data.cell.styles.textColor = GTEXT;
          } else if (rec.state === "en_almacenamiento" || rec.state === "en_decaimiento") {
            data.cell.styles.fillColor = [219, 234, 254];
            data.cell.styles.textColor = [30, 64, 175];
          } else if (rec.state === "transferido") {
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [75, 85, 99];
          }
        }
      },
      didDrawPage: (data: { pageNumber: number }) => {
        if (data.pageNumber > 1) {
          drawPageHeader("Inventario Completo (continuación)");
          drawFooter(pageNum, totalPages);
        }
      },
    });

    // Firma block
    const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    const safeY = Math.min(lastY, PH - 42);

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    const sigBoxW = 60;
    const sigBoxH = 18;
    const sigBoxes = [
      { label: "OPR Titular", x: ML },
      { label: "Jefe UMN / RT", x: ML + sigBoxW + 8 },
      { label: "Dirección Médica", x: ML + (sigBoxW + 8) * 2 },
    ];
    sigBoxes.forEach((s) => {
      doc.rect(s.x, safeY, sigBoxW, sigBoxH);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(s.label, s.x + sigBoxW / 2, safeY + 14, { align: "center" });
    });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Informe generado automáticamente por RPMS el ${fmtDateTime(new Date().toISOString())} · Para uso interno exclusivo`,
      ML, safeY + sigBoxH + 5
    );

    drawFooter(pageNum, totalPages);

    // ── Output ──
    const pdfBuf = Buffer.from(doc.output("arraybuffer"));
    const slug = institution.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 30);
    const filename = `waste_records_informe_${slug}_${todayISO}.pdf`;

    return new NextResponse(pdfBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[waste-records/export/pdf]", err);
    return NextResponse.json(
      { error: "Error generando PDF", detail: String(err) },
      { status: 500 }
    );
  }
}
