/**
 * API Route: GET /api/petct/export/pdf
 * Genera Informe de Exámenes PET/CT — Registro Clínico y Dosimétrico
 * Normativa: DS 133/1984 MINSAL Art. 22-26 · DS 3/1985 Art. 5 · IAEA HHS No. 1
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import {
  calcDecay,
  doseRateAt1m_usvh,
  PETCT_EXAM_STATE_LABELS,
  HALF_LIFE_MINUTES,
  type PetctExam,
  type PetctExamState,
} from "@/lib/petct";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtNum(v: number | null | undefined, dec = 2): string {
  if (v == null) return "—";
  return v.toFixed(dec).replace(".", ",");
}

function fmtStr(v: string | null | undefined): string {
  return v?.trim() || "—";
}

const HDR_DARK: [number, number, number] = [15, 60, 110];
const HDR_MED: [number, number, number] = [30, 80, 140];
const HDR_LIGHT: [number, number, number] = [220, 235, 250];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "";
    const to   = searchParams.get("to")   ?? "";
    const state = searchParams.get("state") ?? "";
    const radiopharm = searchParams.get("radiopharmaceutical") ?? "";

    // ── Load data ─────────────────────────────────────────────────────────────
    const institution = await getInstitutionInfo();

    // Ensure table exists (graceful fallback)
    await sql`
      CREATE TABLE IF NOT EXISTS petct_examinations (
        id SERIAL PRIMARY KEY,
        patient_id TEXT NOT NULL,
        patient_name TEXT,
        radiopharmaceutical TEXT NOT NULL,
        radionuclide TEXT NOT NULL,
        administered_mbq NUMERIC(10,2) NOT NULL,
        patient_weight_kg NUMERIC(6,2),
        injection_datetime TIMESTAMPTZ NOT NULL,
        uptake_minutes INTEGER NOT NULL DEFAULT 60,
        exam_start TIMESTAMPTZ,
        exam_end TIMESTAMPTZ,
        state TEXT NOT NULL DEFAULT 'programado',
        operator TEXT NOT NULL,
        prescribing_physician TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Build dynamic filter
    const conditions: string[] = [];
    if (from)        conditions.push(`injection_datetime >= '${from}'::date`);
    if (to)          conditions.push(`injection_datetime <  ('${to}'::date + interval '1 day')`);
    if (state)       conditions.push(`state = '${state.replace(/'/g, "''")}'`);
    if (radiopharm)  conditions.push(`radiopharmaceutical = '${radiopharm.replace(/'/g, "''")}'`);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const exams: PetctExam[] = (await sql.unsafe(
      `SELECT * FROM petct_examinations ${whereClause} ORDER BY injection_datetime DESC LIMIT 500`
    )) as unknown as PetctExam[];

    // KPIs
    const total = exams.length;
    const byState: Record<string, number> = {};
    for (const e of exams) { byState[e.state] = (byState[e.state] ?? 0) + 1; }
    const totalMbq = exams.reduce((s, e) => s + (e.administered_mbq ?? 0), 0);
    const avgMbq = total > 0 ? totalMbq / total : 0;
    const byRadiopharm: Record<string, number> = {};
    for (const e of exams) { byRadiopharm[e.radiopharmaceutical] = (byRadiopharm[e.radiopharmaceutical] ?? 0) + 1; }

    // ── PDF generation ────────────────────────────────────────────────────────
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.width;  // 297
    const dateFile = new Date().toISOString().slice(0, 10).replace(/-/g, "");
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
      d.text("Informe de Exámenes PET/CT — Registro Clínico y Dosimétrico", pageW / 2, 13, { align: "center" });
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

    // ── PAGE 1: Cover + KPIs ──────────────────────────────────────────────────
    drawPageHeader(doc);
    let y = 24;

    // Institution block
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(fmtStr(institution.name), 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`OPR: ${fmtStr(institution.opr_name)}  ·  CCHEN: ${fmtStr(institution.cchen_code)}  ·  SEREMI: ${fmtStr(institution.seremi_code)}`, 14, y + 5);
    doc.text(`Generado: ${dateLabel}`, pageW - 14, y + 5, { align: "right" });

    // Filters applied
    const filterParts: string[] = [];
    if (from) filterParts.push(`Desde: ${fmtDate(from)}`);
    if (to)   filterParts.push(`Hasta: ${fmtDate(to)}`);
    if (state) filterParts.push(`Estado: ${PETCT_EXAM_STATE_LABELS[state as PetctExamState] ?? state}`);
    if (radiopharm) filterParts.push(`Radiofármaco: ${radiopharm}`);
    if (filterParts.length > 0) {
      doc.text(`Filtros: ${filterParts.join("  ·  ")}`, 14, y + 10);
      y += 4;
    }

    y += 14;

    // KPI row
    y = sectionHeader(doc, "1. RESUMEN ESTADÍSTICO", y);
    const kpis = [
      { label: "Total exámenes", value: String(total) },
      { label: "Completados",    value: String(byState["completado"] ?? 0) },
      { label: "Cancelados",     value: String(byState["cancelado"] ?? 0) },
      { label: "Programados",    value: String(byState["programado"] ?? 0) },
      { label: "En espera/examen", value: String((byState["en_espera"] ?? 0) + (byState["en_examen"] ?? 0)) },
      { label: "Actividad total (MBq)", value: fmtNum(totalMbq, 0) },
      { label: "Actividad media (MBq)", value: fmtNum(avgMbq, 1) },
    ];

    const kpiW = (pageW - 28) / kpis.length;
    kpis.forEach((k, i) => {
      const x = 14 + i * kpiW;
      doc.setFillColor(...HDR_LIGHT);
      doc.rect(x, y, kpiW - 1, 18, "F");
      doc.setDrawColor(...HDR_MED);
      doc.rect(x, y, kpiW - 1, 18, "S");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(k.label, x + (kpiW - 1) / 2, y + 5.5, { align: "center" });
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...HDR_DARK);
      doc.text(k.value, x + (kpiW - 1) / 2, y + 13, { align: "center" });
    });
    y += 22;

    // Distribution by radiopharmaceutical
    const pharmEntries = Object.entries(byRadiopharm).sort((a, b) => b[1] - a[1]);
    if (pharmEntries.length > 0) {
      y = sectionHeader(doc, "2. DISTRIBUCIÓN POR RADIOFÁRMACO", y);
      autoTable(doc, {
        startY: y,
        head: [["Radiofármaco", "N exámenes", "% del total"]],
        body: pharmEntries.map(([pharm, n]) => [
          pharm,
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

    // Distribution by state
    const stateEntries = Object.entries(byState);
    if (stateEntries.length > 0) {
      y = sectionHeader(doc, "3. DISTRIBUCIÓN POR ESTADO", y);
      autoTable(doc, {
        startY: y,
        head: [["Estado", "N exámenes", "% del total"]],
        body: stateEntries.map(([st, n]) => [
          PETCT_EXAM_STATE_LABELS[st as PetctExamState] ?? st,
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

    // ── PAGE 2: Exam register ──────────────────────────────────────────────────
    doc.addPage();
    drawPageHeader(doc);
    y = 24;

    y = sectionHeader(doc, "4. REGISTRO DE EXÁMENES PET/CT (orden cronológico inverso)", y);

    const examRows = exams.length > 0
      ? exams.map((e) => {
          const elapsedMin = (Date.now() - new Date(e.injection_datetime).getTime()) / 60_000;
          const currentMbq = calcDecay(e.administered_mbq, elapsedMin, e.radionuclide as any);
          const doseRate = doseRateAt1m_usvh(currentMbq);
          const hl = HALF_LIFE_MINUTES[e.radionuclide as keyof typeof HALF_LIFE_MINUTES] ?? 110;
          const releaseMin = hl * Math.log2(currentMbq / 0.04);  // below ~0.04 MBq → <25 µSv/h at 1m
          const releaseDt = new Date(Date.now() + Math.max(0, releaseMin) * 60_000);
          const relStr = e.state === "completado" ? fmtDateTime(releaseDt.toISOString()) : "—";
          return [
            fmtDate(e.injection_datetime),
            fmtStr(e.patient_id),
            fmtStr(e.patient_name),
            fmtStr(e.radiopharmaceutical),
            fmtNum(e.administered_mbq, 1),
            fmtStr(e.radionuclide),
            String(e.uptake_minutes),
            PETCT_EXAM_STATE_LABELS[e.state] ?? e.state,
            fmtStr(e.operator),
            fmtStr(e.prescribing_physician),
          ];
        })
      : [["Sin exámenes registrados", "—", "—", "—", "—", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Fecha", "ID Paciente", "Nombre", "Radiofármaco", "Act. (MBq)", "RN", "Uptake (min)", "Estado", "Operador", "Médico solicitante"]],
      body: examRows,
      theme: "grid",
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 22 },
        2: { cellWidth: 32 },
        3: { cellWidth: 38 },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 14, halign: "center" },
        6: { cellWidth: 18, halign: "right" },
        7: { cellWidth: 26 },
        8: { cellWidth: 32 },
        9: { cellWidth: 42 },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;
        if (data.column.index === 7) {
          const val = String(data.cell.raw ?? "");
          if (val === "Completado") {
            doc.setTextColor(22, 163, 74); doc.setFont("helvetica", "bold");
          } else if (val === "Cancelado") {
            doc.setTextColor(220, 38, 38); doc.setFont("helvetica", "bold");
          } else if (val.includes("espera") || val.includes("examen")) {
            doc.setTextColor(180, 100, 0); doc.setFont("helvetica", "bold");
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // ── PAGE 3: Signature block ────────────────────────────────────────────────
    if (y > 150 || total === 0) {
      doc.addPage();
      drawPageHeader(doc);
      y = 24;
    }

    // Regulatory note
    const finalY = (doc as any).lastAutoTable?.finalY ?? y;
    if (finalY < 175) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.text(
        "Este registro ha sido generado automáticamente por el SPRM. La trazabilidad de cada examen está sujeta " +
        "a verificación por parte del OPR de la instalación. Toda administración de radiofármacos debe contar con " +
        "prescripción médica válida y aprobación del Físico Médico (DS 133/1984 Art. 22-26, DS 3/1985 Art. 5, IAEA HHS No. 1).",
        14,
        finalY + 4,
        { maxWidth: pageW - 28 }
      );
    }

    // Signature boxes
    const sigY = Math.min(finalY + 18, 175);
    const boxes = [
      { title: "OPR Responsable",    name: fmtStr(institution.opr_name) },
      { title: "Físico Médico",       name: "________________________________" },
      { title: "Médico Nuclear",      name: "________________________________" },
    ];
    const boxW = (pageW - 28) / 3;
    boxes.forEach((b, i) => {
      const bx = 14 + i * (boxW + 1);
      doc.setDrawColor(...HDR_DARK);
      doc.setLineWidth(0.4);
      doc.rect(bx, sigY, boxW, 22);
      doc.setFillColor(...HDR_LIGHT);
      doc.rect(bx, sigY, boxW, 6, "F");
      doc.setTextColor(...HDR_DARK);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(b.title, bx + boxW / 2, sigY + 4, { align: "center" });
      doc.setTextColor(60, 60, 60);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(b.name, bx + boxW / 2, sigY + 11, { align: "center" });
      doc.setFontSize(6);
      doc.setTextColor(130, 130, 130);
      doc.text("Firma y timbre", bx + boxW / 2, sigY + 17, { align: "center" });
      doc.text("Fecha: ___/___/______", bx + boxW / 2, sigY + 21, { align: "center" });
    });

    // Footer on every page
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
        `SPRM v1 · Registro PET/CT · ${fmtStr(institution.name)} · DS 133/1984 MINSAL · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");
    const slug = (institution.name ?? "petct")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 30);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="petct_registro_${slug}_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/petct/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
