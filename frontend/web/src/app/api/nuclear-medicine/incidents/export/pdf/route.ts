/**
 * API Route: GET /api/nuclear-medicine/incidents/export/pdf
 * Genera Informe de Emergencias e Incidentes — Medicina Nuclear
 * Normativa: DS 133/1984 MINSAL Art. 56-62 · DS 3/1985 · IAEA SSG-51
 * Reglamento de Gestión de Emergencias Radiológicas (CCHEN)
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import {
  ensureNmIncidentsTables,
  type NmIncidentRecord,
  type NmIncidentCategory,
  type NmIncidentSeverity,
  type NmIncidentStatus,
} from "@/lib/nm-incidents";

export const dynamic = "force-dynamic";

// ─── Label maps ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<NmIncidentCategory, string> = {
  derrame:          "Derrame de material",
  perdida_material: "Pérdida de material",
  exposicion:       "Exposición no planificada",
  contaminacion:    "Contaminación",
  equipo:           "Falla de equipo",
  otro:             "Otro",
};

const SEVERITY_LABELS: Record<NmIncidentSeverity, string> = {
  leve:     "Leve",
  moderado: "Moderado",
  grave:    "Grave",
};

const STATUS_LABELS: Record<NmIncidentStatus, string> = {
  abierto: "Abierto",
  cerrado: "Cerrado",
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
const RED_DARK: [number, number, number] = [185, 28, 28];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from   = searchParams.get("from") ?? "";
    const to     = searchParams.get("to")   ?? "";
    const status = searchParams.get("status") ?? "";

    // ── Load data ─────────────────────────────────────────────────────────────
    await ensureNmIncidentsTables();
    const institution = await getInstitutionInfo();

    const conditions: string[] = [];
    if (from)   conditions.push(`event_date >= '${from}'::date`);
    if (to)     conditions.push(`event_date <  ('${to}'::date + interval '1 day')`);
    if (status) conditions.push(`status = '${status.replace(/'/g, "''")}'`);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const incidents: NmIncidentRecord[] = (await sql.unsafe(
      `SELECT * FROM nm_incidents ${where} ORDER BY event_date DESC, id DESC LIMIT 500`
    )) as unknown as NmIncidentRecord[];

    // KPIs
    const total = incidents.length;
    const open  = incidents.filter(i => i.status === "abierto").length;
    const closed = total - open;
    const graves = incidents.filter(i => i.severity === "grave").length;
    const nearMiss = incidents.filter(i => i.is_near_miss).length;
    const byCat: Record<string, number> = {};
    for (const i of incidents) { byCat[i.category] = (byCat[i.category] ?? 0) + 1; }

    // ── PDF ───────────────────────────────────────────────────────────────────
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.width;
    const dateFile  = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const dateLabel = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

    function drawPageHeader(d: typeof doc) {
      d.setFillColor(...RED_DARK);
      d.rect(0, 0, pageW, 18, "F");
      d.setTextColor(255, 255, 255);
      d.setFontSize(11);
      d.setFont("helvetica", "bold");
      d.text("SISTEMA DE PROTECCIÓN RADIOLÓGICA — MEDICINA NUCLEAR", pageW / 2, 7, { align: "center" });
      d.setFontSize(8.5);
      d.setFont("helvetica", "normal");
      d.text("Informe de Emergencias e Incidentes Radiológicos", pageW / 2, 13, { align: "center" });
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

    // ── PAGE 1: KPIs + Distribution ──────────────────────────────────────────
    drawPageHeader(doc);
    let y = 24;

    // Institution header
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(fmtStr(institution.name), 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`OPR: ${fmtStr(institution.opr_name)}  ·  CCHEN: ${fmtStr(institution.cchen_code)}  ·  SEREMI: ${fmtStr(institution.seremi_code)}`, 14, y + 5);
    doc.text(`Generado: ${dateLabel}`, pageW - 14, y + 5, { align: "right" });

    const filterParts: string[] = [];
    if (from)   filterParts.push(`Desde: ${fmtDate(from)}`);
    if (to)     filterParts.push(`Hasta: ${fmtDate(to)}`);
    if (status) filterParts.push(`Estado: ${STATUS_LABELS[String(status as NmIncidentStatus)] ?? status}`);
    if (filterParts.length > 0) { doc.text(`Filtros: ${filterParts.join("  ·  ")}`, 14, y + 10); y += 4; }

    y += 14;

    // KPI row
    y = sectionHeader(doc, "1. RESUMEN ESTADÍSTICO", y);
    const kpis = [
      { label: "Total incidentes",       value: String(total),    warn: false },
      { label: "Abiertos",               value: String(open),     warn: open > 0 },
      { label: "Cerrados",               value: String(closed),   warn: false },
      { label: "Severos (Grave)",        value: String(graves),   warn: graves > 0 },
      { label: "Near-miss",              value: String(nearMiss), warn: nearMiss > 0 },
    ];

    const kpiW = (pageW - 28) / kpis.length;
    kpis.forEach((k, i) => {
      const x = 14 + i * kpiW;
      const fillRgb: [number, number, number] = k.warn && k.value !== "0" ? [254, 226, 226] : HDR_LIGHT;
      const textRgb: [number, number, number] = k.warn && k.value !== "0" ? RED_DARK : HDR_DARK;
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

    // Distribution by category
    const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if (catEntries.length > 0) {
      y = sectionHeader(doc, "2. DISTRIBUCIÓN POR CATEGORÍA DE INCIDENTE", y);
      autoTable(doc, {
        startY: y,
        head: [["Categoría", "N incidentes", "% del total"]],
        body: catEntries.map(([cat, n]) => [
          CATEGORY_LABELS[String(cat as NmIncidentCategory)] ?? cat,
          String(n),
          `${((n / total) * 100).toFixed(1)}%`,
        ]),
        theme: "grid",
        headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 30, halign: "right" },
          2: { cellWidth: 30, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── PAGE 2: Incident register ─────────────────────────────────────────────
    doc.addPage();
    drawPageHeader(doc);
    y = 24;

    y = sectionHeader(doc, "3. REGISTRO DE INCIDENTES (orden cronológico inverso)", y);

    const rows = incidents.length > 0
      ? incidents.map(inc => [
          fmtDate(inc.event_date),
          CATEGORY_LABELS[String(inc.category)] ?? inc.category,
          SEVERITY_LABELS[String(inc.severity)] ?? inc.severity,
          inc.is_near_miss ? "Sí" : "No",
          fmtStr(inc.location),
          truncate(inc.description, 120),
          truncate(inc.immediate_actions, 80),
          STATUS_LABELS[String(inc.status)] ?? inc.status,
          inc.notification_status === "notificado" ? "Sí" : inc.notification_status === "pendiente" ? "Pend." : "N/A",
        ])
      : [["Sin incidentes registrados", "—", "—", "—", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Categoría", "Severidad", "Near-miss", "Lugar", "Descripción", "Acc. inmediatas", "Estado", "Notif."]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 30 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 24 },
        5: { cellWidth: 74 },
        6: { cellWidth: 52 },
        7: { cellWidth: 18, halign: "center" },
        8: { cellWidth: 14, halign: "center" },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;
        if (data.column.index === 2) {
          const val = String(data.cell.raw ?? "");
          if (val === "Grave") { doc.setTextColor(220, 38, 38); doc.setFont("helvetica", "bold"); }
          else if (val === "Moderado") { doc.setTextColor(180, 100, 0); doc.setFont("helvetica", "bold"); }
        }
        if (data.column.index === 7) {
          const val = String(data.cell.raw ?? "");
          if (val === "Abierto") { doc.setTextColor(220, 38, 38); doc.setFont("helvetica", "bold"); }
          else if (val === "Cerrado") { doc.setTextColor(22, 163, 74); doc.setFont("helvetica", "bold"); }
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
        "Todo incidente con material radiactivo debe ser notificado a CCHEN dentro de los plazos establecidos (DS 133/1984 MINSAL Art. 58). " +
        "Los incidentes graves requieren notificación inmediata. Este informe es de uso interno y debe ser conservado durante 5 años " +
        "como mínimo (DS 133/1984 Art. 62, IAEA SSG-51).",
        14, y + 4, { maxWidth: pageW - 28 }
      );
    }

    // Signature block
    const sigY = Math.min((doc as any).lastAutoTable?.finalY ?? y, 175) + 10;
    if (sigY < 185) {
      const boxes = [
        { title: "OPR Responsable",    name: fmtStr(institution.opr_name) },
        { title: "Físico Médico",       name: "________________________________" },
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

    // Footer
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
        `SPRM v1 · Incidentes Medicina Nuclear · ${fmtStr(institution.name)} · DS 133/1984 MINSAL · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2, ph - 4, { align: "center" }
      );
    }

    const pdfBuf = doc.output("arraybuffer");
    const slug = (institution.name ?? "nm").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);

    return new NextResponse(pdfBuf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="incidentes_nm_${slug}_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/nuclear-medicine/incidents/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
