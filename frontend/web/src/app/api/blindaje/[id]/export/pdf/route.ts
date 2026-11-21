/**
 * Exportación PDF — Memoria de Cálculo de Blindaje
 * SPRM · Módulo de Blindaje Radiológico
 * Normativa: DS 133/1984 MINSAL · NCRP 147 · NCRP 151 · AAPM TG-108 · IAEA SRS-47
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ensureBlindajeTables,
  listBlindajePir,
  listBlindajeBarriers,
  listBlindajeSources,
  listBlindajeWorkload,
} from "@/lib/blindaje";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

const FACILITY_LABELS: Record<string, string> = {
  diagnostico: "Imagenología Diagnóstica (NCRP 147)",
  radioterapia: "Radioterapia — Acelerador Lineal (NCRP 151)",
  braquiterapia: "Braquiterapia (IAEA SRS-47)",
  medicina_nuclear_pet: "Medicina Nuclear — PET/FDG (AAPM TG-108)",
  medicina_nuclear_pet_ct: "Medicina Nuclear — PET/CT (AAPM TG-108)",
  medicina_nuclear_convencional: "Medicina Nuclear Convencional (NCRP 155)",
};

const BARRIER_TYPE_LABELS: Record<string, string> = {
  primaria: "Primaria",
  secundaria: "Secundaria",
  neutronica: "Neutrónica",
  captura: "Captura de neutrones",
};

const STATUS_LABELS: Record<string, string> = {
  sin_informacion: "Sin info.",
  revisar: "Revisar",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtNum(val: unknown, dec = 2): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  return n.toFixed(dec);
}

function fmtStr(val: unknown): string {
  if (!val) return "—";
  return String(val);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    if (!projectId || isNaN(projectId)) {
      return NextResponse.json({ error: "ID de proyecto inválido." }, { status: 400 });
    }

    await ensureBlindajeTables();

    // Load project
    const { rows: projRows } = await sql`SELECT * FROM blindaje_projects WHERE id = ${projectId}`;
    if (!projRows[0]) {
      return NextResponse.json({ error: "Proyecto de blindaje no encontrado." }, { status: 404 });
    }
    // Helper to extract typed fields from the SQL row
    const projectRow = projRows[0] as Record<string, unknown>;
    const project = {
      name: String(projectRow.name ?? ""),
      project_number: String(projectRow.project_number ?? ""),
      version: String(projectRow.version ?? ""),
      institution: String(projectRow.institution ?? ""),
      service: String(projectRow.service ?? ""),
      unit: String(projectRow.unit ?? ""),
      address: String(projectRow.address ?? ""),
      city: String(projectRow.city ?? ""),
      facility_type: String(projectRow.facility_type ?? ""),
      status: String(projectRow.status ?? ""),
      responsible: String(projectRow.responsible ?? ""),
      opr_name: String(projectRow.opr_name ?? ""),
      medical_physicist: String(projectRow.medical_physicist ?? ""),
      created_at: projectRow.created_at,
    };

    // Load related data in parallel
    const [pir, barriers, sources, workload, institution] = await Promise.all([
      listBlindajePir(projectId),
      listBlindajeBarriers(projectId),
      listBlindajeSources(projectId),
      listBlindajeWorkload(projectId),
      getInstitutionInfo(),
    ]);

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    const { jsPDF } = await import("jspdf");
    // @ts-ignore
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;

    // ── Helper: section header ─────────────────────────────────────────────────
    function sectionHeader(doc: any, text: string, y: number): number {
      doc.setFillColor(30, 80, 140);
      doc.rect(14, y, pageW - 28, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(text, 16, y + 4.2);
      doc.setTextColor(0, 0, 0);
      return y + 8;
    }

    // ── Page header (repeated via didDrawPage) ─────────────────────────────────
    function drawPageHeader(doc: any) {
      doc.setFillColor(15, 60, 110);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Memoria de Cálculo — Blindaje Radiológico", 14, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(project.name || institution.name, 14, 17);
      doc.setFontSize(7);
      const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
      const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
      const facilityLine = FACILITY_LABELS[String(project.facility_type ?? "")] ?? (project.facility_type ?? "");
      doc.text(
        `${oprLine}${cchenLine}${facilityLine}  ·  DS 133/1984 MINSAL  ·  Generado: ${dateStr}`,
        14,
        23
      );
    }

    drawPageHeader(doc);

    // ── Project identification block ───────────────────────────────────────────
    let y = 32;
    y = sectionHeader(doc, "1. IDENTIFICACIÓN DEL PROYECTO", y);

    const projInfoRows = [
      ["Nombre del proyecto", fmtStr(project.name), "Número / Versión", `${fmtStr(project.project_number)} / ${fmtStr(project.version)}`],
      ["Institución", fmtStr(project.institution), "Servicio / Unidad", `${fmtStr(project.service)} / ${fmtStr(project.unit)}`],
      ["Dirección", fmtStr(project.address), "Ciudad", fmtStr(project.city)],
      ["Tipo de instalación", FACILITY_LABELS[String(project.facility_type ?? "")] ?? fmtStr(project.facility_type), "Estado", fmtStr(project.status)],
      ["Responsable técnico", fmtStr(project.responsible), "OPR", fmtStr(project.opr_name)],
      ["Físico médico", fmtStr(project.medical_physicist), "Fecha creación", fmtDate(project.created_at)],
    ];

    autoTable(doc, {
      startY: y,
      body: projInfoRows,
      theme: "grid",
      bodyStyles: { fontSize: 7.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: "bold", fillColor: [245, 247, 250] },
        1: { cellWidth: 85 },
        2: { cellWidth: 42, fontStyle: "bold", fillColor: [245, 247, 250] },
        3: { cellWidth: 85 },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // ── Sources ────────────────────────────────────────────────────────────────
    y = sectionHeader(doc, "2. FUENTES DE RADIACIÓN", y);

    const sourceRows = sources.length > 0
      ? sources.map((s: Record<string, unknown>) => [
          fmtStr(s.source_type),
          fmtStr(s.radionuclide),
          fmtStr(s.energy),
          s.activity !== null ? `${fmtNum(s.activity, 1)} ${fmtStr(s.activity_unit)}` : "—",
          s.dose_rate !== null ? `${fmtNum(s.dose_rate, 2)} µSv/h` : "—",
          fmtStr(s.notes),
        ])
      : [["Sin fuentes registradas", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Tipo fuente", "Radionúclido", "Energía", "Actividad", "Tasa de dosis", "Notas"]],
      body: sourceRows,
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 28, halign: "center" },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: 32, halign: "center" },
        4: { cellWidth: 30, halign: "center" },
        5: { cellWidth: 112 },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // ── Workload ───────────────────────────────────────────────────────────────
    if (workload.length > 0) {
      y = sectionHeader(doc, "3. CARGA DE TRABAJO", y);

      const workloadRows = workload.map((w: Record<string, unknown>) => {
        const d = (w.data || {}) as Record<string, any>;
        const details = Object.entries(d)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join("  ·  ");
        return [
          fmtStr(w.workload_type),
          fmtNum(w.workload_value, 1),
          fmtStr(w.workload_unit),
          details || "—",
          fmtStr(w.notes),
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Tipo de carga", "Valor", "Unidad", "Parámetros adicionales", "Notas"]],
        body: workloadRows,
        theme: "grid",
        headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 20, halign: "right" },
          2: { cellWidth: 24, halign: "center" },
          3: { cellWidth: 120 },
          4: { cellWidth: 66 },
        },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── PIR ───────────────────────────────────────────────────────────────────
    if (y > 165) {
      doc.addPage();
      drawPageHeader(doc);
      y = 32;
    }

    y = sectionHeader(doc, "4. PUNTOS DE INTERÉS RADIOLÓGICO (PIR)", y);

    const pirRows = pir.length > 0
      ? pir.map((p: Record<string, unknown>) => [
          fmtStr(p.code),
          fmtStr(p.name),
          fmtStr(p.area_type),
          fmtStr(p.occupancy_type),
          fmtNum(p.distance_m, 1),
          fmtNum(p.occupancy_factor, 2),
          p.design_criterion_value !== null
            ? `${fmtNum(p.design_criterion_value, 1)} ${fmtStr(p.design_criterion_unit)}`
            : "—",
          fmtStr(p.design_criterion_source),
        ])
      : [["Sin PIR registrados", "—", "—", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Código", "Nombre/Descripción", "Tipo área", "Ocupación", "d (m)", "T", "P (criterio)", "Fuente normativa"]],
      body: pirRows,
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 40 },
        2: { cellWidth: 28 },
        3: { cellWidth: 30 },
        4: { cellWidth: 14, halign: "right" },
        5: { cellWidth: 12, halign: "right" },
        6: { cellWidth: 30, halign: "center" },
        7: { cellWidth: 96 },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // ── Barriers ───────────────────────────────────────────────────────────────
    if (y > 155) {
      doc.addPage();
      drawPageHeader(doc);
      y = 32;
    }

    y = sectionHeader(doc, "5. BARRERAS — RESULTADOS DE CÁLCULO", y);

    const barrierRows = barriers.length > 0
      ? barriers.map((b: Record<string, unknown>) => [
          fmtStr(b.code),
          fmtStr(b.name),
          BARRIER_TYPE_LABELS[String(b.barrier_type ?? "")] ?? fmtStr(b.barrier_type),
          fmtStr(b.material),
          b.thickness_existing_cm !== null ? `${fmtNum(b.thickness_existing_cm, 1)} cm` : "—",
          b.thickness_required_cm !== null ? `${fmtNum(b.thickness_required_cm, 2)} cm` : "—",
          b.thickness_adopted_cm !== null ? `${fmtNum(b.thickness_adopted_cm, 2)} cm` : "—",
          b.result_value !== null ? fmtNum(b.result_value, 4) : "—",
          STATUS_LABELS[String(b.result_status ?? "")] ?? fmtStr(b.result_status),
        ])
      : [["Sin barreras registradas", "—", "—", "—", "—", "—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Código", "Nombre", "Tipo", "Material", "Existente", "Requerido", "Adoptado", "B / resultado", "Estado"]],
      body: barrierRows,
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 44 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 24 },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 20, halign: "right" },
        6: { cellWidth: 20, halign: "right" },
        7: { cellWidth: 28, halign: "right" },
        8: { cellWidth: 22, halign: "center" },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;
        if (data.column.index === 8) {
          const val = String(data.cell.raw ?? "");
          if (val === "Aprobado") {
            doc.setTextColor(22, 163, 74);
            doc.setFont("helvetica", "bold");
          } else if (val === "Revisar") {
            doc.setTextColor(202, 138, 4);
            doc.setFont("helvetica", "bold");
          } else if (val === "Rechazado") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // ── Barrier detail notes (result_unit) ─────────────────────────────────────
    const barriersWithDetail = barriers.filter((b: Record<string, unknown>) => b.result_unit);
    if (barriersWithDetail.length > 0) {
      if (y > 165) {
        doc.addPage();
        drawPageHeader(doc);
        y = 32;
      }

      y = sectionHeader(doc, "6. DETALLE DE CÁLCULO POR BARRERA (memoria de cálculo)", y);

      const detailRows = barriersWithDetail.map((b: Record<string, unknown>) => [
        fmtStr(b.code),
        fmtStr(b.name),
        String(b.result_unit || "").slice(0, 400),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Código", "Barrera", "Resultado detallado / Memoria de cálculo"]],
        body: detailRows,
        theme: "grid",
        headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 6, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },
          1: { cellWidth: 40 },
          2: { cellWidth: 210 },
        },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── Regulatory note ────────────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable?.finalY ?? y;
    if (finalY < 175) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.text(
        "Este documento es una memoria de cálculo de blindaje radiológico generada automáticamente por el SPRM. " +
        "Debe ser revisada y firmada por el OPR y Físico Médico habilitado antes de su presentación ante CCHEN o MINSAL. " +
        "Normativa aplicable: DS 133/1984 MINSAL Art. 24-28, NCRP 147, NCRP 151, AAPM TG-108, IAEA SRS-47.",
        14,
        finalY + 5,
        { maxWidth: pageW - 28 }
      );
    }

    // ── Footer on each page ────────────────────────────────────────────────────
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
        `SPRM v1 · Memoria de Cálculo Blindaje · ${fmtStr(project.name)} · DS 133/1984 MINSAL · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");
    const safeFileName = (project.name ?? "blindaje")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 40);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="memoria_blindaje_${safeFileName}_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/blindaje/[id]/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
