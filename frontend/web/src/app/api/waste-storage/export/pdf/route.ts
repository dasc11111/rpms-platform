/**
 * Exportación PDF — Gestión de Residuos Radiactivos
 * Inventario de rótulos de residuos en almacenamiento temporal.
 * Ley 18.302 CCHEN — Formulario de gestión de residuos radiactivos.
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import {
  daysBetween,
  decayFractionRemaining,
  daysUntilReleaseEligible,
  isReleaseEligible,
  WASTE_LABEL_STATUS_LABELS,
  WASTE_TYPE_OPTIONS_V2,
} from "@/lib/waste";

export const dynamic = "force-dynamic";

interface WasteRow {
  id: number;
  label_number: string;
  generation_date: string;
  service: string;
  sala: string;
  radionuclide_code: string;
  waste_type: string | null;
  actividad_estimada_residual: number | null;
  unidad_actividad: string;
  container: string | null;
  entry_date: string;
  status: string;
  observations: string | null;
  half_life_days: number | null;
  release_criteria_activity: number | null;
  location_name: string | null;
}

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function getWasteTypeLabel(code: string | null): string {
  if (!code) return "—";
  const found = WASTE_TYPE_OPTIONS_V2.find((o) => o.value === code);
  return found ? found.label : code;
}

export async function GET() {
  try {
    const institution = await getInstitutionInfo();

    const { rows } = await sql`
      SELECT
        w.id, w.label_number, w.generation_date, w.service, w.sala,
        w.radionuclide_code, w.waste_type, w.actividad_estimada_residual,
        w.unidad_actividad, w.container, w.entry_date, w.status, w.observations,
        r.half_life_days, r.release_criteria_activity,
        l.name AS location_name
      FROM radioactive_waste_labels w
      LEFT JOIN radionuclides r ON r.code = w.radionuclide_code
      LEFT JOIN waste_storage_locations l ON l.id = w.storage_location_id
      WHERE w.status != 'liberado'
      ORDER BY w.entry_date ASC, w.id ASC
      LIMIT 2000
    ` as { rows: WasteRow[] };

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // Enrich with decay calculations
    type EnrichedWaste = WasteRow & {
      elapsed_days: number;
      current_activity: number | null;
      release_eligible: boolean;
      days_until_release: number;
    };

    const enriched: EnrichedWaste[] = rows.map((r) => {
      const halfLifeDays = r.half_life_days !== null ? Number(r.half_life_days) : 0;
      const initialActivity = r.actividad_estimada_residual !== null
        ? Number(r.actividad_estimada_residual)
        : null;
      const elapsedDays = daysBetween(String(r.entry_date), today);
      const fraction = halfLifeDays > 0 ? decayFractionRemaining(halfLifeDays, elapsedDays) : 1;
      const currentActivity = initialActivity !== null ? initialActivity * fraction : null;
      const releaseEl = halfLifeDays > 0
        ? isReleaseEligible(halfLifeDays, elapsedDays)
        : false;
      const daysUntil = halfLifeDays > 0
        ? daysUntilReleaseEligible(halfLifeDays, elapsedDays)
        : 9999;
      return {
        ...r,
        elapsed_days: elapsedDays,
        current_activity: currentActivity,
        release_eligible: releaseEl,
        days_until_release: daysUntil,
      };
    });

    // Stats
    const total = enriched.length;
    const pendientes = enriched.filter((r) => r.status === "pendiente").length;
    const almacenados = enriched.filter((r) => r.status === "almacenado").length;
    const listos = enriched.filter((r) => r.release_eligible).length;
    const sinUbicacion = enriched.filter((r) => !r.location_name).length;

    const { jsPDF } = await import("jspdf");
    // @ts-ignore
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;

    // ── Header ─────────────────────────────────────────────────────────────────
    doc.setFillColor(15, 60, 110);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Inventario de Residuos Radiactivos en Almacenamiento", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
    doc.text(
      `${oprLine}${cchenLine}Ley 18.302 CCHEN — Gestión de Residuos Radiactivos  ·  Generado: ${dateStr}`,
      14,
      25
    );

    // ── KPI boxes ───────────────────────────────────────────────────────────────
    const summaryY = 34;
    const boxes = [
      { label: "Total en almacén", value: String(total), color: [15, 60, 110] as [number, number, number] },
      { label: "Almacenados", value: String(almacenados), color: [59, 130, 246] as [number, number, number] },
      { label: "Pendientes", value: String(pendientes), color: [202, 138, 4] as [number, number, number] },
      {
        label: "Listos para liberar",
        value: String(listos),
        color: listos > 0
          ? ([22, 163, 74] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Sin ubicación",
        value: String(sinUbicacion),
        color: sinUbicacion > 0
          ? ([220, 38, 38] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
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

    // ── Section header ──────────────────────────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("Inventario activo de rótulos de residuos radiactivos (excluye liberados)", 14, startY);
    startY += 2;

    // ── Table ──────────────────────────────────────────────────────────────────
    const tableRows = enriched.map((r) => {
      const releaseText = r.release_eligible
        ? "✓ Listo"
        : r.days_until_release < 9999
        ? `${r.days_until_release}d`
        : "—";
      const currentAct = r.current_activity !== null
        ? `${r.current_activity.toFixed(2)} ${r.unidad_actividad}`
        : "—";
      const statusLabel = WASTE_LABEL_STATUS_LABELS[r.status as keyof typeof WASTE_LABEL_STATUS_LABELS] ?? r.status;

      return [
        r.label_number,
        fmtDate(r.generation_date),
        r.radionuclide_code,
        getWasteTypeLabel(r.waste_type),
        r.service ?? "—",
        r.sala ?? "—",
        r.location_name ?? "—",
        fmtDate(r.entry_date),
        `${r.elapsed_days}d`,
        currentAct,
        releaseText,
        statusLabel,
      ];
    });

    autoTable(doc, {
      startY,
      head: [["N° Rótulo", "Generación", "Radionúclido", "Tipo residuo", "Servicio", "Sala", "Ubicación", "Ingreso", "Días\nalmacan.", "Act. actual", "Liberación", "Estado"]],
      body: tableRows.length > 0
        ? tableRows
        : [["Sin residuos en almacenamiento", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 22, halign: "center", font: "courier" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 36 },
        4: { cellWidth: 30 },
        5: { cellWidth: 20 },
        6: { cellWidth: 28 },
        7: { cellWidth: 18, halign: "center" },
        8: { cellWidth: 14, halign: "center" },
        9: { cellWidth: 26, halign: "center" },
        10: { cellWidth: 18, halign: "center" },
        11: { cellWidth: 18, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;

        // Column 10: release status
        if (data.column.index === 10) {
          const val = String(data.cell.raw ?? "");
          if (val.startsWith("✓")) {
            doc.setTextColor(22, 163, 74);
            doc.setFont("helvetica", "bold");
          } else if (val !== "—") {
            doc.setTextColor(59, 130, 246);
          }
        }

        // Column 11: status
        if (data.column.index === 11) {
          const val = String(data.cell.raw ?? "");
          if (val === "Almacenado") {
            doc.setTextColor(59, 130, 246);
          } else if (val === "Pendiente") {
            doc.setTextColor(202, 138, 4);
          } else if (val === "Liberado") {
            doc.setTextColor(22, 163, 74);
          }
        }

        // Column 6: location — warn if missing
        if (data.column.index === 6) {
          if (String(data.cell.raw ?? "") === "—") {
            doc.setTextColor(220, 38, 38);
          }
        }
      },
    });

    // ── Note ───────────────────────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 10;
    if (finalY < 175) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      const notes: string[] = [];
      if (listos > 0)
        notes.push(`${listos} rótulo(s) han cumplido el criterio de decaimiento (≥10 semividas) — pueden liberarse previo control de tasa de dosis.`);
      if (sinUbicacion > 0)
        notes.push(`${sinUbicacion} rótulo(s) sin ubicación de almacenamiento asignada.`);
      notes.push("Ley 18.302 CCHEN — Todo residuo radiactivo debe estar identificado, registrado y almacenado en zona autorizada.");
      doc.text(notes.join(" "), 14, finalY + 6, { maxWidth: pageW - 28 });
    }

    // ── Footer on each page ─────────────────────────────────────────────────────
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
        `SPRM v1 · Gestión Residuos Radiactivos · Ley 18.302 CCHEN · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="residuos_radiactivos_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/waste-storage/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
