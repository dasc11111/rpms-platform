/**
 * Exportación PDF — Resumen de Incidentes Radiológicos
 * Libro de incidentes, cuasi-accidentes y acciones correctivas.
 * DS 133/1984 MINSAL · CCHEN — Notificación obligatoria de incidentes graves.
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";
import { ensureNmIncidentsTables } from "@/lib/nm-incidents";

export const dynamic = "force-dynamic";

interface IncidentRow {
  id: number;
  event_date: string | null;
  category: string | null;
  severity: string;
  is_near_miss: boolean;
  location: string | null;
  person_involved: string | null;
  description: string | null;
  immediate_actions: string | null;
  corrective_actions: string | null;
  investigation_status: string;
  notification_status: string | null;
  status: string;
}

const SEVERITY_LABELS: Record<string, string> = {
  leve: "Leve",
  moderado: "Moderado",
  grave: "GRAVE",
};

const CATEGORY_LABELS: Record<string, string> = {
  derrame: "Derrame",
  perdida_material: "Pérdida material",
  exposicion: "Exposición no planif.",
  contaminacion: "Contaminación",
  equipo: "Falla equipo",
  otro: "Otro",
};

const INVESTIGATION_LABELS: Record<string, string> = {
  abierto: "Abierto",
  en_investigacion: "En investigación",
  cerrado: "Cerrado",
};

function fmtDate(val: unknown): string {
  if (!val) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (!m) return String(val);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export async function GET(req: NextRequest) {
  try {
    await ensureNmIncidentsTables();

    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year") || "";

    const institution = await getInstitutionInfo();

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (yearParam) {
      conditions.push(`EXTRACT(YEAR FROM event_date) = $${i++}`);
      values.push(Number(yearParam));
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        id, event_date, category, severity, is_near_miss,
        location, person_involved, description,
        immediate_actions, corrective_actions,
        investigation_status, notification_status, status
      FROM nm_incidents
      ${where}
      ORDER BY event_date DESC, id DESC
      LIMIT 500
    `;

    const { rows } = await sql.query(query, values);
    const incidents = rows as IncidentRow[];

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // Stats
    const total = incidents.length;
    const graves = incidents.filter((r) => r.severity === "grave").length;
    const nearMiss = incidents.filter((r) => r.is_near_miss).length;
    const abiertos = incidents.filter((r) => r.status === "abierto").length;
    const enInvestigacion = incidents.filter((r) => r.investigation_status === "en_investigacion").length;

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
    doc.text("Registro de Incidentes Radiológicos y Cuasi-Accidentes", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 19);
    doc.setFontSize(7.5);
    const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
    const periodLine = yearParam ? `Año: ${yearParam}  ·  ` : "";
    doc.text(
      `${oprLine}${cchenLine}${periodLine}DS 133/1984 MINSAL · CCHEN — Notificación obligatoria de incidentes graves  ·  Generado: ${dateStr}`,
      14,
      25
    );

    // ── KPI boxes ───────────────────────────────────────────────────────────────
    const summaryY = 34;
    const boxes = [
      { label: "Total incidentes", value: String(total), color: [15, 60, 110] as [number, number, number] },
      {
        label: "Graves",
        value: String(graves),
        color: graves > 0
          ? ([220, 38, 38] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Cuasi-accidentes",
        value: String(nearMiss),
        color: nearMiss > 0
          ? ([202, 138, 4] as [number, number, number])
          : ([100, 100, 100] as [number, number, number]),
      },
      {
        label: "Abiertos",
        value: String(abiertos),
        color: abiertos > 0
          ? ([202, 138, 4] as [number, number, number])
          : ([22, 163, 74] as [number, number, number]),
      },
      {
        label: "En investigación",
        value: String(enInvestigacion),
        color: enInvestigacion > 0
          ? ([59, 130, 246] as [number, number, number])
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
    doc.text("Listado de incidentes radiológicos registrados", 14, startY);
    startY += 2;

    // ── Table ──────────────────────────────────────────────────────────────────
    const tableRows = incidents.map((r) => [
      fmtDate(r.event_date),
      CATEGORY_LABELS[r.category ?? ""] ?? (r.category ?? "—"),
      SEVERITY_LABELS[r.severity] ?? r.severity,
      r.is_near_miss ? "Sí" : "No",
      r.location ?? "—",
      r.person_involved ?? "—",
      r.description ? r.description.slice(0, 60) : "—",
      r.immediate_actions ? r.immediate_actions.slice(0, 40) : "—",
      INVESTIGATION_LABELS[r.investigation_status] ?? r.investigation_status,
      r.notification_status === "notificado" ? "Sí" : r.notification_status === "no_aplica" ? "N/A" : "Pend.",
      r.status === "cerrado" ? "Cerrado" : "Abierto",
    ]);

    autoTable(doc, {
      startY,
      head: [["Fecha", "Categoría", "Severidad", "Cuasi-\nAccidente", "Lugar", "Involucrado", "Descripción", "Acciones inmediatas", "Investigación", "Notif.\nCCHEN", "Estado"]],
      body: tableRows.length > 0
        ? tableRows
        : [["Sin incidentes registrados", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      theme: "grid",
      headStyles: { fillColor: [30, 80, 140], textColor: 255, fontSize: 6.5, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 6, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 26 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 26 },
        5: { cellWidth: 26 },
        6: { cellWidth: 52 },
        7: { cellWidth: 40 },
        8: { cellWidth: 24, halign: "center" },
        9: { cellWidth: 14, halign: "center" },
        10: { cellWidth: 16, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section !== "body") return;

        // Column 2: severity
        if (data.column.index === 2) {
          const val = String(data.cell.raw ?? "");
          if (val === "GRAVE") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          } else if (val === "Moderado") {
            doc.setTextColor(202, 138, 4);
          } else if (val === "Leve") {
            doc.setTextColor(22, 163, 74);
          }
        }

        // Column 3: near miss
        if (data.column.index === 3) {
          if (String(data.cell.raw ?? "") === "Sí") {
            doc.setTextColor(220, 38, 38);
            doc.setFont("helvetica", "bold");
          }
        }

        // Column 10: estado
        if (data.column.index === 10) {
          const val = String(data.cell.raw ?? "");
          if (val === "Abierto") {
            doc.setTextColor(202, 138, 4);
          } else if (val === "Cerrado") {
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
      if (graves > 0)
        notes.push(`${graves} incidente(s) grave(s) — notificación obligatoria a CCHEN y SEREMI de Salud en 24 h.`);
      if (abiertos > 0)
        notes.push(`${abiertos} incidente(s) aún abierto(s) — gestionar cierre y acciones correctivas.`);
      notes.push("DS 133/1984 MINSAL — Todo incidente grave debe notificarse a la Autoridad Reguladora en plazo de 24 horas.");
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
        `SPRM v1 · Incidentes Radiológicos · DS 133/1984 MINSAL · CCHEN · Confidencial — Uso Interno · Pág. ${pg} / ${pageCount}`,
        pageW / 2,
        ph - 4,
        { align: "center" }
      );
    }

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="incidentes_radiologicos_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/incidents/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
