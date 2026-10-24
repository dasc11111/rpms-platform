/**
 * API Route: GET /api/waste-calibration/export/pdf
 * Genera Informe de Matriz de Calibración — Gestión de Desechos Radiactivos
 * Normativa: DS 133/1984 MINSAL · IAEA GSR Part 5 · IAEA SSG-45 · CCHEN
 * Sección 18 del Prompt Maestro Definitivo
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";

export const dynamic = "force-dynamic";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtStr(v: string | null | undefined): string {
  return v?.trim() || "—";
}

function fmtNum(v: number | null | undefined, decimals = 4): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const HDR_DARK: [number, number, number] = [15, 60, 110];
const HDR_MED: [number, number, number] = [30, 80, 140];
const HDR_LIGHT: [number, number, number] = [220, 235, 250];
const GREEN_DARK: [number, number, number] = [22, 101, 52];
const AMBER_DARK: [number, number, number] = [146, 64, 14];

type CalibrationRow = {
  id: number;
  instrumento: string;
  radionuclide_code: string;
  geometria: string | null;
  distancia_cm: number | null;
  metodo: "eficiencia" | "factor_calibracion";
  eficiencia: number | null;
  factor_calibracion: number | null;
  area_efectiva_cm2: number | null;
  fecha_calibracion: string | null;
  fecha_vigencia_hasta: string | null;
  vigente: boolean;
  documento_fuente: string | null;
  notes: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const radionuclideCode = searchParams.get("radionuclide_code") ?? "";
    const soloVigentes = searchParams.get("vigente") === "true";

    // ── Load data ─────────────────────────────────────────────────────────────
    await ensureWasteExpertSchema();
    const institution = await getInstitutionInfo();

    const conditions: string[] = [];
    if (radionuclideCode) conditions.push(`radionuclide_code = '${radionuclideCode.replace(/'/g, "''")}'`);
    if (soloVigentes) conditions.push(`vigente = true`);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows: CalibrationRow[] = (await sql.unsafe(
      `SELECT * FROM waste_calibration_matrix ${where} ORDER BY instrumento, radionuclide_code, fecha_calibracion DESC LIMIT 500`
    )) as unknown as CalibrationRow[];

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const total = rows.length;
    const vigentes = rows.filter(r => r.vigente).length;
    const vencidas = total - vigentes;
    const byRN: Record<string, number> = {};
    const byInstrumento: Record<string, number> = {};
    for (const r of rows) {
      byRN[r.radionuclide_code] = (byRN[r.radionuclide_code] ?? 0) + 1;
      byInstrumento[r.instrumento] = (byInstrumento[r.instrumento] ?? 0) + 1;
    }
    const nRadionuclides = Object.keys(byRN).length;
    const nInstrumentos = Object.keys(byInstrumento).length;

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.width;
    const dateFile  = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const dateLabel = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

    function drawPageHeader(d: typeof doc) {
      d.setFillColor(...HDR_DARK);
      d.rect(0, 0, pageW, 18, "F");
      d.setTextColor(255, 255, 255);
      d.setFontSize(11);
      d.setFont("helvetica", "bold");
      d.text("SISTEMA EXPERTO DE DESECHOS RADIACTIVOS — MEDICINA NUCLEAR", pageW / 2, 7, { align: "center" });
      d.setFontSize(8.5);
      d.setFont("helvetica", "normal");
      d.text("Informe de Matriz de Calibración de Detectores", pageW / 2, 13, { align: "center" });
    }

    function sectionHeader(d: typeof doc, text: string, y: number): number {
      d.setFillColor(...HDR_MED);
      d.rect(14, y, pageW - 28, 7, "F");
      d.setTextColor(255, 255, 255);
      d.setFontSize(8);
      d.setFont("helvetica", "bold");
      d.text(text, 17, y + 4.8);
      d.setTextColor(0, 0, 0);
      return y + 10;
    }

    // ── PAGE 1: KPIs + Summaries ──────────────────────────────────────────────
    drawPageHeader(doc);
    let y = 24;

    // Institution header
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(fmtStr(institution.name), 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `OPR: ${fmtStr(institution.opr_name)}  ·  CCHEN: ${fmtStr(institution.cchen_code)}  ·  SEREMI: ${fmtStr(institution.seremi_code)}`,
      14, y + 5
    );
    doc.text(`Generado: ${dateLabel}`, pageW - 14, y + 5, { align: "right" });

    const filterParts: string[] = [];
    if (radionuclideCode) filterParts.push(`Radionúclido: ${radionuclideCode}`);
    if (soloVigentes) filterParts.push(`Solo vigentes`);
    if (filterParts.length > 0) { doc.text(`Filtros: ${filterParts.join("  ·  ")}`, 14, y + 10); y += 4; }

    y += 14;

    // KPI row
    y = sectionHeader(doc, "1. RESUMEN ESTADÍSTICO DE CALIBRACIONES", y);
    const kpis = [
      { label: "Total calibraciones",   value: String(total),           warn: false },
      { label: "Vigentes",              value: String(vigentes),        warn: false },
      { label: "Vencidas / No vigentes",value: String(vencidas),        warn: vencidas > 0 },
      { label: "Radionúclidos",         value: String(nRadionuclides),  warn: false },
      { label: "Instrumentos",          value: String(nInstrumentos),   warn: false },
    ];
    const kpiW = (pageW - 28) / kpis.length;
    kpis.forEach((k, i) => {
      const x = 14 + i * kpiW;
      const fillRgb: [number, number, number] = k.warn && k.value !== "0" ? [254, 226, 226] : HDR_LIGHT;
      const textRgb: [number, number, number] = k.warn && k.value !== "0" ? [185, 28, 28] : HDR_DARK;
      doc.setFillColor(...fillRgb);
      doc.rect(x, y, kpiW - 1, 18, "F");
      doc.setDrawColor(...HDR_MED);
      doc.rect(x, y, kpiW - 1, 18, "S");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(k.label, x + (kpiW - 1) / 2, y + 5.5, { align: "center" });
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...textRgb);
      doc.text(k.value, x + (kpiW - 1) / 2, y + 13.5, { align: "center" });
    });
    y += 22;

    // Distribution by radionuclide
    const rnEntries = Object.entries(byRN).sort((a, b) => b[1] - a[1]);
    if (rnEntries.length > 0) {
      y = sectionHeader(doc, "2. DISTRIBUCIÓN POR RADIONÚCLIDO", y);
      autoTable(doc, {
        startY: y,
        head: [["Radionúclido", "N calibraciones", "% del total"]],
        body: rnEntries.map(([code, n]) => [
          code,
          String(n),
          total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 35, halign: "right" },
          2: { cellWidth: 30, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Distribution by instrument
    const instrEntries = Object.entries(byInstrumento).sort((a, b) => b[1] - a[1]);
    if (instrEntries.length > 0 && y < 160) {
      y = sectionHeader(doc, "3. DISTRIBUCIÓN POR INSTRUMENTO / DETECTOR", y);
      autoTable(doc, {
        startY: y,
        head: [["Instrumento / Detector", "N calibraciones", "% del total"]],
        body: instrEntries.map(([instr, n]) => [
          truncate(instr, 60),
          String(n),
          total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 35, halign: "right" },
          2: { cellWidth: 30, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── PAGE 2: Full calibration matrix ──────────────────────────────────────
    doc.addPage();
    drawPageHeader(doc);
    y = 24;

    y = sectionHeader(doc, "4. MATRIZ DE CALIBRACIÓN COMPLETA (Detector × Radionúclido × Geometría)", y);

    const tableRows = rows.length > 0
      ? rows.map(r => [
          fmtStr(r.instrumento),
          fmtStr(r.radionuclide_code),
          fmtStr(r.geometria),
          r.distancia_cm != null ? `${r.distancia_cm} cm` : "—",
          r.metodo === "eficiencia" ? "Eficiencia" : "Factor Cal.",
          r.metodo === "eficiencia"
            ? (r.eficiencia != null ? `${fmtNum(r.eficiencia, 4)}` : "—")
            : (r.factor_calibracion != null ? `${fmtNum(r.factor_calibracion, 4)} cpm/dpm` : "—"),
          r.area_efectiva_cm2 != null ? `${r.area_efectiva_cm2} cm²` : "—",
          fmtDate(r.fecha_calibracion),
          fmtDate(r.fecha_vigencia_hasta),
          r.vigente ? "Vigente" : "Vencida",
          truncate(r.documento_fuente, 25),
        ])
      : [["Sin calibraciones registradas", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Instrumento", "RN", "Geometría", "Dist.", "Método", "Valor", "Área ef.", "F. calibración", "F. vigencia", "Estado", "Documento"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 18 },
        2: { cellWidth: 22 },
        3: { cellWidth: 16, halign: "right" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 30, halign: "right" },
        6: { cellWidth: 18, halign: "right" },
        7: { cellWidth: 22, halign: "center" },
        8: { cellWidth: 22, halign: "center" },
        9: { cellWidth: 18, halign: "center" },
        10: { cellWidth: 36 },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;
        if (data.column.index === 9) {
          const val = String(data.cell.raw ?? "");
          if (val === "Vigente") {
            doc.setTextColor(...GREEN_DARK);
            doc.setFont("helvetica", "bold");
          } else if (val === "Vencida") {
            doc.setTextColor(185, 28, 28);
            doc.setFont("helvetica", "bold");
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Regulatory note
    if (y < 175) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.text(
        "Cada entrada de esta matriz es específica para el instrumento, radionúclido, geometría y distancia indicados. " +
        "No se aplica una calibración universal. Las calibraciones vencidas no deben usarse para cálculos de dosis. " +
        "DS 133/1984 MINSAL · IAEA GSR Part 5 · IAEA SSG-45 · CCHEN. " +
        "Conservar un mínimo de 5 años. Uso interno confidencial.",
        14, y + 4, { maxWidth: pageW - 28 }
      );
      y += 12;
    }

    // Signature block
    const sigY = Math.min(y, 175);
    if (sigY < 185) {
      const boxes = [
        { title: "OPR Responsable",     name: fmtStr(institution.opr_name) },
        { title: "Físico Médico",        name: "________________________________" },
        { title: "Responsable Equipos",  name: "________________________________" },
      ];
      const bW = (pageW - 28) / 3;
      boxes.forEach((b, i) => {
        const bx = 14 + i * (bW + 1);
        doc.setDrawColor(...HDR_DARK);
        doc.setLineWidth(0.4);
        doc.rect(bx, sigY, bW, 18);
        doc.setFillColor(...HDR_LIGHT);
        doc.rect(bx, sigY, bW, 6, "F");
        doc.setTextColor(...HDR_DARK);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(b.title, bx + bW / 2, sigY + 4, { align: "center" });
        doc.setTextColor(60, 60, 60);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text(b.name, bx + bW / 2, sigY + 10, { align: "center" });
        doc.setFontSize(6);
        doc.setTextColor(130, 130, 130);
        doc.text("Firma y timbre", bx + bW / 2, sigY + 14.5, { align: "center" });
        doc.text("Fecha: ___/___/______", bx + bW / 2, sigY + 17.5, { align: "center" });
      });
    }

    // Footer on all pages
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
        `SPRM v1 · Matriz de Calibración · ${fmtStr(institution.name)} · DS 133/1984 MINSAL · IAEA GSR Part 5 · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2, ph - 4, { align: "center" }
      );
    }

    const pdfBuf = doc.output("arraybuffer");
    const slug = (institution.name ?? "nm").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);

    return new NextResponse(pdfBuf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="calibracion_detectores_${slug}_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/waste-calibration/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
