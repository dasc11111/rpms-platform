/**
 * Exportación PDF — Libro de Administración de I-131
 * Registro obligatorio de administraciones de Yodo-131 (radioiodo).
 * DS 3/1985 MINSAL — Registro de dosis, paciente, médico y criterios.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

interface I131Row {
  id: number;
  admin_date: string;
  ficha_clinica: string | null;
  paciente_nombre: string;
  paciente_run: string | null;
  radiofarmaco: string | null;
  cantidad_solicitada: number | null;
  dosis_administrada: number | null;
  tasa_dosis: string | null;
  diagnostico: string | null;
  medico_solicitante: string | null;
  sala: string | null;
  prevision: string | null;
  actividad_dentro_tolerancia: boolean | null;
  informacion_radioproteccion_entregada: boolean | null;
  notas: string | null;
}

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtNum(val: number | null, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return Number(val).toFixed(decimals);
}

function fmtBool(val: boolean | null): string {
  if (val === null || val === undefined) return "—";
  return val ? "Sí" : "No";
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year") || "";
    const monthParam = searchParams.get("month") || "";

    const institution = await getInstitutionInfo();

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (yearParam) {
      conditions.push(`admin_year = $${i++}`);
      values.push(Number(yearParam));
    }
    if (monthParam) {
      conditions.push(`admin_month = $${i++}`);
      values.push(Number(monthParam));
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        id, admin_date, ficha_clinica, paciente_nombre, paciente_run,
        radiofarmaco, cantidad_solicitada, dosis_administrada, tasa_dosis,
        diagnostico, medico_solicitante, sala, prevision,
        actividad_dentro_tolerancia, informacion_radioproteccion_entregada,
        notas
      FROM i131_administrations
      ${where}
      ORDER BY admin_date DESC, id DESC
      LIMIT 2000
    `;

    const { rows } = await sql.query(query, values);
    const administrations = rows as I131Row[];

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // Period label
    let periodLabel = "";
    if (yearParam && monthParam) {
      const mesNombre = MESES_ES[Number(monthParam) - 1] ?? monthParam;
      periodLabel = `${mesNombre.charAt(0).toUpperCase()}${mesNombre.slice(1)} ${yearParam}`;
    } else if (yearParam) {
      periodLabel = `Año ${yearParam}`;
    }

    // Stats
    const total = administrations.length;
    const totalDosis = administrations.reduce(
      (acc, r) => acc + (r.dosis_administrada !== null ? Number(r.dosis_administrada) : 0),
      0
    );
    const sinInfoRP = administrations.filter(
      (r) => r.informacion_radioproteccion_entregada === false
    ).length;
    const fueraTolerancia = administrations.filter(
      (r) => r.actividad_dentro_tolerancia === false
    ).length;
    const conNotas = administrations.filter(
      (r) => r.notas && r.notas.trim().length > 0
    ).length;

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
    doc.text("Libro de Administración de I-131 (Radioiodo)", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
    const periodLine = periodLabel ? `Período: ${periodLabel}  ·  ` : "";
    doc.text(
      `${oprLine}${cchenLine}${periodLine}DS 3/1985 MINSAL — Registro obligatorio I-131  ·  Generado: ${dateStr}`,
      14,
      25
    );

    // ── KPI boxes ───────────────────────────────────────────────────────────────
    const summaryY = 34;
    const boxes = [
      { label: "Administraciones", value: String(total), color: [15, 60, 110] as [number, number, number] },
      {
        label: "Actividad total (mCi)",
        value: totalDosis > 0 ? totalDosis.toFixed(1) : "—",
        color: [59, 130, 246] as [number, number, number],
      },
      {
        label: "Fuera de tolerancia",
        value: String(fueraTolerancia),
        color: fueraTolerancia > 0
          ? ([220, 38, 38] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Sin info. radioprotec.",
        value: String(sinInfoRP),
        color: sinInfoRP > 0
          ? ([202, 138, 4] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Con notas / incidencias",
        value: String(conNotas),
        color: conNotas > 0
          ? ([202, 138, 4] as [number, number, number])
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
    doc.text("Registro de administraciones de Yodo-131", 14, startY);
    startY += 2;

    // ── Table ──────────────────────────────────────────────────────────────────
    const tableRows = administrations.map((r) => [
      fmtDate(r.admin_date),
      r.ficha_clinica ?? "—",
      r.paciente_nombre ?? "—",
      r.paciente_run ?? "—",
      r.radiofarmaco ?? "—",
      fmtNum(r.cantidad_solicitada, 1),
      fmtNum(r.dosis_administrada, 1),
      fmtBool(r.actividad_dentro_tolerancia),
      r.tasa_dosis ?? "—",
      fmtBool(r.informacion_radioproteccion_entregada),
      r.diagnostico ? r.diagnostico.slice(0, 30) : "—",
      r.medico_solicitante ?? "—",
      r.sala ?? "—",
    ]);

    autoTable(doc, {
      startY,
      head: [["Fecha", "Ficha", "Paciente", "RUN", "Radiofármaco", "Solicit.\n(mCi)", "Admin.\n(mCi)", "Tolerancia", "Tasa\ndosis", "Info\nRP", "Diagnóstico", "Médico", "Sala"]],
      body: tableRows.length > 0
        ? tableRows
        : [["Sin administraciones registradas", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 16, halign: "center" },
        2: { cellWidth: 40 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 28 },
        5: { cellWidth: 14, halign: "center" },
        6: { cellWidth: 14, halign: "center" },
        7: { cellWidth: 16, halign: "center" },
        8: { cellWidth: 14, halign: "center" },
        9: { cellWidth: 12, halign: "center" },
        10: { cellWidth: 34 },
        11: { cellWidth: 36 },
        12: { cellWidth: 18, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;

        // Column 7: actividad_dentro_tolerancia
        if (data.column.index === 7) {
          const val = String(data.cell.raw ?? "");
          if (val === "No") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          } else if (val === "Sí") {
            doc.setTextColor(22, 163, 74);
          }
        }

        // Column 9: informacion_radioproteccion_entregada
        if (data.column.index === 9) {
          const val = String(data.cell.raw ?? "");
          if (val === "No") {
            doc.setTextColor(202, 138, 4);
            doc.setFont("helvetica", "bold");
          } else if (val === "Sí") {
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
      if (fueraTolerancia > 0)
        notes.push(`${fueraTolerancia} administración(es) fuera de tolerancia de actividad — revisar con OPR.`);
      if (sinInfoRP > 0)
        notes.push(`${sinInfoRP} registro(s) sin información de radioprotección entregada al paciente.`);
      notes.push("Registro confidencial — Uso Interno · Conservar por 30 años según DS 3/1985 MINSAL.");
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
        `SPRM v1 · Libro de Administración I-131 · DS 3/1985 MINSAL · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="libro_i131_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/i131/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
