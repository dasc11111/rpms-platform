/**
 * Exportación PDF — Resumen Ejecutivo SPRM
 * Genera informe ejecutivo en PDF usando jsPDF + autotable (Node-compatible)
 * DS 133/1984, DS 3/1985 MINSAL
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

async function safeCount(fn: () => Promise<{ count: string }[]>): Promise<number> {
  try {
    const rows = await fn();
    return parseInt(rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const institution = await getInstitutionInfo();
    // Fetch same KPIs as /api/reports
    const [
      workers,
      dosimetryAlerts,
      i131ThisMonth,
      incidentsOpen,
      incidentsGrave,
      complianceOk,
      compliancePendiente,
      complianceVencido,
      instruments,
      wastePending,
      equipmentVencido,
    ] = await Promise.all([
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM workers WHERE status = 'activo'`),
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM dosimeter_assignments WHERE returned_at IS NULL AND due_date < CURRENT_DATE`),
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM i131_administrations WHERE admin_year = EXTRACT(YEAR FROM NOW()) AND admin_month = EXTRACT(MONTH FROM NOW())`),
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM nm_incidents WHERE status = 'abierto'`),
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM nm_incidents WHERE severity = 'grave' AND status = 'abierto'`),
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'ok'`),
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'pendiente'`),
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM compliance_requirements WHERE status = 'vencido'`),
      safeCount(() => sql`
        SELECT COUNT(*)::text as count FROM instruments i
        WHERE i.status = 'operativo'
          AND NOT EXISTS (
            SELECT 1 FROM calibrations c
            WHERE c.instrument_id = i.id AND c.expiry_date >= CURRENT_DATE
          )
      `),
      safeCount(() => sql`SELECT COUNT(*)::text as count FROM waste_records WHERE status = 'pending'`),
      safeCount(() => sql`
        SELECT COUNT(*)::text as count FROM radiology_equipment
        WHERE status = 'activo'
          AND authorization_expiry_date IS NOT NULL
          AND authorization_expiry_date < CURRENT_DATE
      `),
    ]);

    const complianceTotal = complianceOk + compliancePendiente + complianceVencido;
    const complianceScore = complianceTotal > 0 ? Math.round((complianceOk / complianceTotal) * 100) : null;
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    // Dynamically import jsPDF (Node-compatible)
    const { jsPDF } = await import("jspdf");
    // @ts-ignore — no types for autotable default import
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(15, 60, 110); // dark blue
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen Ejecutivo — Protección Radiológica", 14, 11);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(institution.name, 14, 18);
    doc.setFontSize(7.5);
    const sumOprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
    doc.text(`${sumOprLine}Sistema de Protección Radiológica (SPRM)  ·  Generado: ${dateStr}`, 14, 24);

    // ── Subtitle ──────────────────────────────────────────────────────────────
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.text("Normativa: DS 133/1984, DS 3/1985 MINSAL, Ley 18.302, NCh 2764 Of. 2003, CCHEN", 14, 34);

    // ── Global status banner ───────────────────────────────────────────────────
    const hasDanger = dosimetryAlerts > 3 || incidentsGrave > 0 || complianceVencido > 0 || instruments > 2 || equipmentVencido > 0;
    const hasWarning = !hasDanger && (dosimetryAlerts > 0 || incidentsOpen > 0 || compliancePendiente > 0 || instruments > 0);
    const [r, g, b] = hasDanger ? [220, 38, 38] : hasWarning ? [202, 138, 4] : [22, 163, 74];
    const statusLabel = hasDanger ? "REQUIERE ATENCIÓN URGENTE" : hasWarning ? "REVISAR ALERTAS" : "SISTEMA EN NORMA";

    doc.setFillColor(r, g, b);
    doc.roundedRect(14, 37, 182, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(statusLabel, 105, 43.5, { align: "center" });

    // ── KPI table ─────────────────────────────────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Indicadores de gestión", 14, 56);

    function statusCell(val: number, ok: boolean, warn: boolean): [string, number, number, number] {
      if (ok) return [`✓ ${val}`, 22, 163, 74];
      if (warn) return [`⚠ ${val}`, 202, 138, 4];
      return [`✗ ${val}`, 220, 38, 38];
    }

    const kpiRows = [
      ["Trabajadores expuestos activos", String(workers), workers > 0 ? "OK" : "—"],
      ["Dosímetros vencidos sin retornar", String(dosimetryAlerts), dosimetryAlerts === 0 ? "OK" : dosimetryAlerts <= 3 ? "Alerta" : "Urgente"],
      ["Administraciones I-131 (mes actual)", String(i131ThisMonth), "OK"],
      ["Incidentes radiológicos abiertos", incidentsGrave > 0 ? `${incidentsOpen} (${incidentsGrave} grave)` : String(incidentsOpen), incidentsOpen === 0 ? "OK" : incidentsGrave > 0 ? "Urgente" : "Alerta"],
      ["Cumplimiento normativo", complianceScore !== null ? `${complianceScore}% (${complianceOk}/${complianceTotal})` : "—", complianceVencido > 0 ? "Urgente" : compliancePendiente > 0 ? "Alerta" : "OK"],
      ["Instrumentos sin calibración vigente", String(instruments), instruments === 0 ? "OK" : instruments <= 2 ? "Alerta" : "Urgente"],
      ["Residuos radiactivos pendientes", String(wastePending), wastePending === 0 ? "OK" : "Alerta"],
      ["Equipos con autorización DS 133 vencida", String(equipmentVencido), equipmentVencido === 0 ? "OK" : "Urgente"],
    ];

    autoTable(doc, {
      startY: 59,
      head: [["Indicador", "Valor", "Estado"]],
      body: kpiRows,
      theme: "grid",
      headStyles: { fillColor: [15, 60, 110], textColor: 255, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 36, halign: "center" },
        2: { cellWidth: 36, halign: "center" },
      },
      didDrawCell: (data: any) => {
        if (data.section === "body" && data.column.index === 2) {
          const val = String(data.cell.raw);
          let color: [number, number, number] = [22, 163, 74];
          if (val === "Urgente") color = [220, 38, 38];
          else if (val === "Alerta") color = [202, 138, 4];
          doc.setTextColor(...color);
          doc.setFont("helvetica", "bold");
        }
      },
    });

    // ── Compliance breakdown ───────────────────────────────────────────────────
    const tableEndY = (doc as any).lastAutoTable.finalY ?? 140;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Cumplimiento normativo — desglose", 14, tableEndY + 10);

    autoTable(doc, {
      startY: tableEndY + 13,
      head: [["Estado", "Cantidad", "Porcentaje"]],
      body: [
        ["Al día (OK)", String(complianceOk), complianceTotal > 0 ? `${Math.round((complianceOk / complianceTotal) * 100)}%` : "—"],
        ["Pendientes", String(compliancePendiente), complianceTotal > 0 ? `${Math.round((compliancePendiente / complianceTotal) * 100)}%` : "—"],
        ["Vencidos", String(complianceVencido), complianceTotal > 0 ? `${Math.round((complianceVencido / complianceTotal) * 100)}%` : "—"],
        ["Total", String(complianceTotal), "100%"],
      ],
      theme: "grid",
      headStyles: { fillColor: [15, 60, 110], textColor: 255, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 36, halign: "center" },
        2: { cellWidth: 36, halign: "center" },
      },
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(240, 240, 240);
    doc.rect(0, pageHeight - 14, 210, 14, "F");
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(
      "SPRM v1 · Documento generado automáticamente · Confidencial — uso interno · DS 133/1984, DS 3/1985 MINSAL",
      105,
      pageHeight - 6,
      { align: "center" }
    );

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resumen_ejecutivo_sprm_${dateFile}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("GET /api/reports/export/pdf", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
