/**
 * API Route: GET /api/nuclear-medicine/references/export/pdf
 * Genera Informe de Referencias Técnicas y Criterios Radiológicos — Medicina Nuclear
 * Normativa: DS 133/1984 MINSAL · IAEA SSG-51 · IAEA GSR Part 3 · ICRP · ARPANSA · CCHEN
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import {
  ensureNmReferencesTables,
  type NmReferenceRecord,
  type NmReferenceOrganization,
  type NmReferenceRecordType,
  type NmReferenceVerificationStatus,
} from "@/lib/nm-references";

export const dynamic = "force-dynamic";

// ─── Label maps ──────────────────────────────────────────────────────────────

const RECORD_TYPE_LABELS: Record<NmReferenceRecordType, string> = {
  criterio_radiologico: "Criterio radiológico",
  referencia_tecnica:  "Referencia técnica",
};

const ORGANIZATION_LABELS: Record<NmReferenceOrganization, string> = {
  arpansa:          "ARPANSA",
  iaea:             "IAEA",
  icrp:             "ICRP",
  normativa_chilena:"Normativa chilena",
  otro:             "Otro",
};

const VERIFICATION_LABELS: Record<NmReferenceVerificationStatus, string> = {
  verificado:              "Verificado",
  pendiente_verificacion:  "Pendiente",
};

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

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const HDR_DARK: [number, number, number] = [15, 60, 110];
const HDR_MED: [number, number, number] = [30, 80, 140];
const HDR_LIGHT: [number, number, number] = [220, 235, 250];
const GREEN_DARK: [number, number, number] = [22, 101, 52];
const AMBER_DARK: [number, number, number] = [146, 64, 14];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const recordType = searchParams.get("recordType") ?? "";
    const organization = searchParams.get("organization") ?? "";
    const status = searchParams.get("status") ?? "";

    // ── Load data ─────────────────────────────────────────────────────────────
    await ensureNmReferencesTables();
    const institution = await getInstitutionInfo();

    const conditions: string[] = ["TRUE"];
    if (recordType) conditions.push(`record_type = '${recordType.replace(/'/g, "''")}'`);
    if (organization) conditions.push(`organization = '${organization.replace(/'/g, "''")}'`);
    if (status) conditions.push(`status = '${status.replace(/'/g, "''")}'`);
    const where = `WHERE ${conditions.join(" AND ")}`;

    const references: NmReferenceRecord[] = (await sql.unsafe(
      `SELECT * FROM nm_technical_references ${where} ORDER BY organization, document_title, id DESC LIMIT 500`
    )) as unknown as NmReferenceRecord[];

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const total = references.length;
    const verificados = references.filter(r => r.verification_status === "verificado").length;
    const pendientes = total - verificados;
    const criterios = references.filter(r => r.record_type === "criterio_radiologico").length;
    const tecnicas = references.filter(r => r.record_type === "referencia_tecnica").length;

    const byOrg: Record<string, number> = {};
    for (const r of references) {
      byOrg[r.organization] = (byOrg[r.organization] ?? 0) + 1;
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
      d.text("SISTEMA DE PROTECCIÓN RADIOLÓGICA — MEDICINA NUCLEAR", pageW / 2, 7, { align: "center" });
      d.setFontSize(8.5);
      d.setFont("helvetica", "normal");
      d.text("Informe de Referencias Técnicas y Criterios Radiológicos", pageW / 2, 13, { align: "center" });
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

    // ── PAGE 1: KPIs + Distribution ───────────────────────────────────────────
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
    if (recordType) filterParts.push(`Tipo: ${RECORD_TYPE_LABELS[recordType as NmReferenceRecordType] ?? recordType}`);
    if (organization) filterParts.push(`Org.: ${ORGANIZATION_LABELS[organization as NmReferenceOrganization] ?? organization}`);
    if (status) filterParts.push(`Estado: ${status}`);
    if (filterParts.length > 0) { doc.text(`Filtros: ${filterParts.join("  ·  ")}`, 14, y + 10); y += 4; }

    y += 14;

    // KPI row
    y = sectionHeader(doc, "1. RESUMEN ESTADÍSTICO", y);
    const kpis = [
      { label: "Total registros",       value: String(total),       warn: false },
      { label: "Criterios radiológicos", value: String(criterios),   warn: false },
      { label: "Referencias técnicas",   value: String(tecnicas),    warn: false },
      { label: "Verificados",            value: String(verificados), warn: false },
      { label: "Pendientes verificación",value: String(pendientes),  warn: pendientes > 0 },
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

    // Distribution by organization
    const orgEntries = Object.entries(byOrg).sort((a, b) => b[1] - a[1]);
    if (orgEntries.length > 0) {
      y = sectionHeader(doc, "2. DISTRIBUCIÓN POR ORGANISMO NORMATIVO", y);
      autoTable(doc, {
        startY: y,
        head: [["Organismo", "N registros", "% del total"]],
        body: orgEntries.map(([org, n]) => [
          ORGANIZATION_LABELS[org as NmReferenceOrganization] ?? org,
          String(n),
          total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 30, halign: "right" },
          2: { cellWidth: 30, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── PAGE 2: Reference register ────────────────────────────────────────────
    doc.addPage();
    drawPageHeader(doc);
    y = 24;

    y = sectionHeader(doc, "3. CATÁLOGO DE REFERENCIAS TÉCNICAS Y CRITERIOS RADIOLÓGICOS", y);

    const tableRows = references.length > 0
      ? references.map(ref => [
          RECORD_TYPE_LABELS[ref.record_type] ?? ref.record_type,
          ORGANIZATION_LABELS[ref.organization] ?? ref.organization,
          truncate(ref.document_title, 50) + (ref.document_code ? ` (${ref.document_code})` : ""),
          ref.year ? String(ref.year) : "—",
          fmtStr(ref.radionuclide),
          truncate(ref.criterion_type || ref.variable_name, 35),
          ref.value_text ? `${ref.value_text}${ref.unit ? " " + ref.unit : ""}` : "—",
          VERIFICATION_LABELS[ref.verification_status] ?? ref.verification_status,
          fmtDate(ref.verification_date),
        ])
      : [["Sin referencias registradas", "—", "—", "—", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Organismo", "Documento", "Año", "Radionúclido", "Criterio / Variable", "Valor", "Verificación", "F. Verificación"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 28 },
        2: { cellWidth: 72 },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 20 },
        5: { cellWidth: 50 },
        6: { cellWidth: 30, halign: "right" },
        7: { cellWidth: 22, halign: "center" },
        8: { cellWidth: 22, halign: "center" },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;
        if (data.column.index === 7) {
          const val = String(data.cell.raw ?? "");
          if (val === "Verificado") {
            doc.setTextColor(...GREEN_DARK);
            doc.setFont("helvetica", "bold");
          } else if (val === "Pendiente") {
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
        "Este catálogo contiene únicamente valores ya verificados en las fuentes oficiales citadas (ARPANSA, IAEA, ICRP, normativa chilena). " +
        "Ningún valor es calculado ni aplicado automáticamente. Las referencias pendientes de verificación deben ser confirmadas antes de su uso clínico. " +
        "DS 133/1984 MINSAL · IAEA GSR Part 3 · IAEA SSG-51 · CCHEN. Uso interno confidencial.",
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
        `SPRM v1 · Referencias Técnicas MN · ${fmtStr(institution.name)} · DS 133/1984 MINSAL · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2, ph - 4, { align: "center" }
      );
    }

    const pdfBuf = doc.output("arraybuffer");
    const slug = (institution.name ?? "nm").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);

    return new NextResponse(pdfBuf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="referencias_tecnicas_mn_${slug}_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/nuclear-medicine/references/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
