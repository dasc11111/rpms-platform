/**
 * API Route: GET /api/waste-items/export/pdf
 * Genera Informe de Fichas de Residuos Radiactivos — Sistema Experto
 * Normativa: DS 133/1984 MINSAL · IAEA GSR Part 5 · IAEA SSG-45 · CCHEN
 * Sección 10 del Prompt Maestro Definitivo
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

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d).slice(0, 16);
  return dt.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtStr(v: string | null | undefined): string {
  return v?.trim() || "—";
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

// Estado labels from WASTE_ITEM_ESTADO_META in lib/waste-expert-ui.ts
const ESTADO_LABELS: Record<string, string> = {
  registrado:                 "Registrado",
  en_decaimiento:             "En decaimiento",
  pendiente_medicion:         "Pendiente medición",
  pendiente_verificacion:     "Pendiente verificación",
  disponible_evaluacion_final:"Disponible eval. final",
  liberado:                   "Liberado",
  bloqueado:                  "Bloqueado",
  no_cumple:                  "No cumple",
  eliminado_autorizado:       "Eliminado autorizado",
};

const TIPO_LABEL: Record<string, string> = {
  liquido:                  "Líquido",
  solido:                   "Sólido",
  gaseoso:                  "Gaseoso",
  fuente_sellada:           "Fuente sellada",
  equipo_contaminado:       "Equipo contaminado",
  material_biologico:       "Material biológico",
  otro:                     "Otro",
};

type WasteItemRow = {
  id: number;
  item_code: string;
  radionuclide_code: string;
  radionuclide_name: string | null;
  tipo_residuo: string;
  tipo_residuo_otro: string | null;
  estado: string;
  fecha_hora_generacion: string | null;
  actividad_inicial: number | null;
  unidad_actividad: string | null;
  ubicacion: string | null;
  responsable: string | null;
  notas: string | null;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado") ?? "";
    const radionuclide = searchParams.get("radionuclide_code") ?? "";

    // ── Load data ─────────────────────────────────────────────────────────────
    await ensureWasteExpertSchema();
    const institution = await getInstitutionInfo();

    const conditions: string[] = ["TRUE"];
    if (estado) conditions.push(`wi.estado = '${estado.replace(/'/g, "''")}'`);
    if (radionuclide) conditions.push(`wi.radionuclide_code = '${radionuclide.replace(/'/g, "''")}'`);
    const where = `WHERE ${conditions.join(" AND ")}`;

    const items: WasteItemRow[] = (await sql.unsafe(`
      SELECT wi.*, rn.name AS radionuclide_name
      FROM waste_items wi
      LEFT JOIN radionuclides rn ON rn.code = wi.radionuclide_code
      ${where}
      ORDER BY wi.created_at DESC LIMIT 500
    `)) as unknown as WasteItemRow[];

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const total = items.length;
    const liberados = items.filter(i => i.estado === "liberado").length;
    const bloqueados = items.filter(i => i.estado === "bloqueado" || i.estado === "no_cumple").length;
    const enProceso = items.filter(i =>
      ["registrado","en_decaimiento","pendiente_medicion","pendiente_verificacion","disponible_evaluacion_final"].includes(i.estado)
    ).length;

    const byEstado: Record<string, number> = {};
    const byRN: Record<string, number> = {};
    for (const it of items) {
      byEstado[it.estado] = (byEstado[it.estado] ?? 0) + 1;
      byRN[it.radionuclide_code] = (byRN[it.radionuclide_code] ?? 0) + 1;
    }

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
      d.text("Informe de Fichas de Residuos Radiactivos", pageW / 2, 13, { align: "center" });
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

    // ── PAGE 1: KPIs + Distributions ─────────────────────────────────────────
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
    if (estado) filterParts.push(`Estado: ${ESTADO_LABELS[estado] ?? estado}`);
    if (radionuclide) filterParts.push(`RN: ${radionuclide}`);
    if (filterParts.length > 0) { doc.text(`Filtros: ${filterParts.join("  ·  ")}`, 14, y + 10); y += 4; }

    y += 14;

    // KPI row
    y = sectionHeader(doc, "1. RESUMEN ESTADÍSTICO — FICHAS DE RESIDUOS", y);
    const kpis = [
      { label: "Total fichas",       value: String(total),      warn: false },
      { label: "En proceso",         value: String(enProceso),  warn: enProceso > 0 },
      { label: "Liberados",          value: String(liberados),  warn: false },
      { label: "Bloqueados / No cumple", value: String(bloqueados), warn: bloqueados > 0 },
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

    // Distribution by estado
    const estadoEntries = Object.entries(byEstado).sort((a, b) => b[1] - a[1]);
    if (estadoEntries.length > 0) {
      y = sectionHeader(doc, "2. DISTRIBUCIÓN POR ESTADO DE GESTIÓN", y);
      autoTable(doc, {
        startY: y,
        head: [["Estado", "N fichas", "% del total"]],
        body: estadoEntries.map(([st, n]) => [
          ESTADO_LABELS[st] ?? st,
          String(n),
          total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 25, halign: "right" },
          2: { cellWidth: 25, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Distribution by radionuclide
    const rnEntries = Object.entries(byRN).sort((a, b) => b[1] - a[1]);
    if (rnEntries.length > 0 && y < 155) {
      y = sectionHeader(doc, "3. DISTRIBUCIÓN POR RADIONÚCLIDO", y);
      autoTable(doc, {
        startY: y,
        head: [["Radionúclido", "N fichas", "% del total"]],
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
          1: { cellWidth: 25, halign: "right" },
          2: { cellWidth: 25, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── PAGE 2: Full register ─────────────────────────────────────────────────
    doc.addPage();
    drawPageHeader(doc);
    y = 24;

    y = sectionHeader(doc, "4. REGISTRO DE FICHAS DE RESIDUOS (orden cronológico inverso)", y);

    const tableRows = items.length > 0
      ? items.map(it => [
          it.item_code,
          it.radionuclide_code + (it.radionuclide_name ? `\n${truncate(it.radionuclide_name, 18)}` : ""),
          TIPO_LABEL[it.tipo_residuo] ?? it.tipo_residuo,
          ESTADO_LABELS[it.estado] ?? it.estado,
          fmtDateTime(it.fecha_hora_generacion),
          it.actividad_inicial != null
            ? `${it.actividad_inicial} ${it.unidad_actividad ?? ""}`
            : "—",
          fmtStr(it.ubicacion),
          fmtStr(it.responsable),
          fmtDate(it.created_at),
        ])
      : [["Sin fichas registradas", "—", "—", "—", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Código", "Radionúclido", "Tipo residuo", "Estado", "F. generación", "Act. inicial", "Ubicación", "Responsable", "F. registro"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold" },
        1: { cellWidth: 22 },
        2: { cellWidth: 26 },
        3: { cellWidth: 34 },
        4: { cellWidth: 28, halign: "center" },
        5: { cellWidth: 28, halign: "right" },
        6: { cellWidth: 34 },
        7: { cellWidth: 34 },
        8: { cellWidth: 22, halign: "center" },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;
        if (data.column.index === 3) {
          const val = String(data.cell.raw ?? "");
          if (val === "Liberado") {
            doc.setTextColor(...GREEN_DARK);
            doc.setFont("helvetica", "bold");
          } else if (val === "Bloqueado" || val === "No cumple") {
            doc.setTextColor(185, 28, 28);
            doc.setFont("helvetica", "bold");
          } else if (val.startsWith("Pendiente")) {
            doc.setTextColor(...AMBER_DARK);
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
        "Cada residuo radiactivo es una entidad independiente con su propia historia de mediciones, decisiones y autorizaciones (Sección 10 SPRM). " +
        "La liberación final debe ser autorizada por el OPR responsable según DS 133/1984 MINSAL Art. 56-62, IAEA GSR Part 5 e IAEA SSG-45. " +
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
        { title: "Dirección / Gerencia", name: "________________________________" },
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
        `SPRM v1 · Fichas Residuos Radiactivos · ${fmtStr(institution.name)} · DS 133/1984 MINSAL · IAEA GSR Part 5 · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2, ph - 4, { align: "center" }
      );
    }

    const pdfBuf = doc.output("arraybuffer");
    const slug = (institution.name ?? "nm").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);

    return new NextResponse(pdfBuf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fichas_residuos_${slug}_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/waste-items/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
