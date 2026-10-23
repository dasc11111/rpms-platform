/**
 * Exportación PDF — Monitoreo de Contaminación Superficial
 * Registro de mediciones de contaminación de superficie por área, sala y punto.
 * DS 133/1984 MINSAL · CCHEN — Norma de Protección Radiológica.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

interface ContaminationRow {
  id: number;
  monitor_date: string | null;
  area: string | null;
  sala: string | null;
  punto_medicion: string | null;
  radionuclido: string | null;
  actividad_bq_m2: number | null;
  actividad_bq_cm2: number | null;
  pct_limite: number | null;
  clasificacion: string | null;
  semaforo: string | null;
  estado: string | null;
  responsable: string | null;
  instrumento: string | null;
  superficie: string | null;
  accion_correctiva: string | null;
  tasa_dosis_usv_h: number | null;
}

const CLASIFICACION_LABELS: Record<string, string> = {
  sin_contaminacion: "Sin contaminación",
  bajo_referencia: "Bajo referencia",
  cercano_limite: "Cercano al límite",
  sobre_limite: "Sobre el límite",
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  normal: "Normal",
  requiere_accion: "Requiere acción",
  resuelto: "Resuelto",
};

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtNum(val: number | null, decimals = 1): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year") || "";
    const monthParam = searchParams.get("month") || "";
    const areaParam = searchParams.get("area") || "";
    const clasificacionParam = searchParams.get("clasificacion") || "";

    const institution = await getInstitutionInfo();

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (yearParam) {
      conditions.push(`monitor_year = $${idx++}`);
      values.push(Number(yearParam));
    }
    if (monthParam) {
      conditions.push(`monitor_month = $${idx++}`);
      values.push(Number(monthParam));
    }
    if (areaParam) {
      conditions.push(`area ILIKE $${idx++}`);
      values.push(`%${areaParam}%`);
    }
    if (clasificacionParam) {
      conditions.push(`clasificacion = $${idx++}`);
      values.push(clasificacionParam);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        id, monitor_date, area, sala, punto_medicion, radionuclido,
        actividad_bq_m2, actividad_bq_cm2, pct_limite, clasificacion,
        semaforo, estado, responsable, instrumento, superficie,
        accion_correctiva, tasa_dosis_usv_h
      FROM contamination_records
      ${where}
      ORDER BY monitor_date DESC, area, sala, id DESC
      LIMIT 2000
    `;

    const { rows } = await sql.query(query, values);
    const records = rows as ContaminationRow[];

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // Stats
    const total = records.length;
    const sinContaminacion = records.filter((r) => r.clasificacion === "sin_contaminacion").length;
    const bajoReferencia = records.filter((r) => r.clasificacion === "bajo_referencia").length;
    const cercanoLimite = records.filter((r) => r.clasificacion === "cercano_limite").length;
    const sobreLimite = records.filter((r) => r.clasificacion === "sobre_limite").length;
    const requierenAccion = records.filter((r) => r.estado === "requiere_accion").length;

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
    doc.text("Monitoreo de Contaminación Superficial", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
    const periodLine =
      yearParam && monthParam
        ? `Período: ${monthParam}/${yearParam}  ·  `
        : yearParam
        ? `Año: ${yearParam}  ·  `
        : "";
    const areaLine = areaParam ? `Área: ${areaParam}  ·  ` : "";
    doc.text(
      `${oprLine}${cchenLine}${periodLine}${areaLine}DS 133/1984 MINSAL · CCHEN — Protección Radiológica  ·  Generado: ${dateStr}`,
      14,
      25
    );

    // ── KPI boxes ───────────────────────────────────────────────────────────────
    const summaryY = 34;
    const boxes = [
      { label: "Total mediciones", value: String(total), color: [15, 60, 110] as [number, number, number] },
      {
        label: "Sin contaminación",
        value: String(sinContaminacion),
        color: [22, 163, 74] as [number, number, number],
      },
      {
        label: "Bajo referencia",
        value: String(bajoReferencia),
        color: bajoReferencia > 0
          ? ([59, 130, 246] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Cercano al límite",
        value: String(cercanoLimite),
        color: cercanoLimite > 0
          ? ([202, 138, 4] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Sobre el límite",
        value: String(sobreLimite),
        color: sobreLimite > 0
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
    doc.text("Registro de mediciones de contaminación superficial (excluye registros archivados)", 14, startY);
    startY += 2;

    // ── Table ──────────────────────────────────────────────────────────────────
    const tableRows = records.map((r) => [
      fmtDate(r.monitor_date),
      r.area ?? "—",
      r.sala ?? "—",
      r.punto_medicion ?? "—",
      r.radionuclido ?? "—",
      r.actividad_bq_m2 !== null ? fmtNum(r.actividad_bq_m2, 1) : "—",
      r.pct_limite !== null ? `${fmtNum(r.pct_limite, 1)}%` : "—",
      CLASIFICACION_LABELS[r.clasificacion ?? ""] ?? (r.clasificacion ?? "—"),
      r.tasa_dosis_usv_h !== null ? `${fmtNum(r.tasa_dosis_usv_h, 2)}` : "—",
      ESTADO_LABELS[r.estado ?? ""] ?? (r.estado ?? "—"),
      r.responsable ?? "—",
      r.accion_correctiva ? r.accion_correctiva.slice(0, 35) : "—",
    ]);

    autoTable(doc, {
      startY,
      head: [["Fecha", "Área", "Sala", "Punto medición", "Radionúclido", "Act.\n(Bq/m²)", "% Límite", "Clasificación", "Dosis\n(µSv/h)", "Estado", "Responsable", "Acción correctiva"]],
      body: tableRows.length > 0
        ? tableRows
        : [["Sin registros de contaminación", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 24 },
        2: { cellWidth: 20 },
        3: { cellWidth: 28 },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 18, halign: "right" },
        6: { cellWidth: 14, halign: "right" },
        7: { cellWidth: 28 },
        8: { cellWidth: 14, halign: "center" },
        9: { cellWidth: 20 },
        10: { cellWidth: 22 },
        11: { cellWidth: 38 },
      },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;

        // Column 7: clasificacion
        if (data.column.index === 7) {
          const val = String(data.cell.raw ?? "");
          if (val === "Sobre el límite") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          } else if (val === "Cercano al límite") {
            doc.setTextColor(202, 138, 4);
            doc.setFont("helvetica", "bold");
          } else if (val === "Bajo referencia") {
            doc.setTextColor(59, 130, 246);
          } else if (val === "Sin contaminación") {
            doc.setTextColor(22, 163, 74);
          }
        }

        // Column 6: pct_limite — highlight high values
        if (data.column.index === 6) {
          const raw = String(data.cell.raw ?? "").replace("%", "");
          const pct = parseFloat(raw);
          if (!isNaN(pct)) {
            if (pct >= 50) {
              doc.setTextColor(220, 38, 38);
              doc.setFont("helvetica", "bold");
            } else if (pct >= 30) {
              doc.setTextColor(202, 138, 4);
            }
          }
        }

        // Column 9: estado
        if (data.column.index === 9) {
          const val = String(data.cell.raw ?? "");
          if (val === "Requiere acción") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          } else if (val === "Pendiente") {
            doc.setTextColor(202, 138, 4);
          } else if (val === "Resuelto" || val === "Normal") {
            doc.setTextColor(22, 163, 74);
          }
        }
      },
    });

    // ── Regulatory note ─────────────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 10;
    if (finalY < 175) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      const notes: string[] = [];
      if (sobreLimite > 0)
        notes.push(`${sobreLimite} medición(es) sobre el límite regulatorio — descontaminación y evaluación de causa raíz obligatoria.`);
      if (requierenAccion > 0)
        notes.push(`${requierenAccion} registro(s) requieren acción correctiva.`);
      notes.push("DS 133/1984 MINSAL Art. 34 — Todo nivel de contaminación sobre el límite debe registrarse y corregirse. Informar a OPR y CCHEN si corresponde.");
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
        `SPRM v1 · Contaminación Superficial · DS 133/1984 MINSAL · CCHEN · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contaminacion_superficial_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/contamination/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
