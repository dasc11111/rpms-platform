import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";
import { ensureSpectEquipmentTables } from "@/lib/qc-spect-equipment-db";
import { ensureSpectArchitectureTables } from "@/lib/qc-spect-architecture-db";

/**
 * MODULO 2 - SPECT - INFORME PDF
 * GET ?equipmentId=N
 * Genera informe técnico completo del equipo: ficha, eventos de servicio,
 * baseline vigente, pruebas QC recientes. Referencia: IAEA TECDOC-602.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await Promise.all([
      ensureSpectQcTables(),
      ensureSpectEquipmentTables(),
      ensureSpectArchitectureTables(),
    ]);

    const { searchParams } = new URL(request.url);
    const equipmentId = searchParams.get("equipmentId");
    const eqId = equipmentId ? Number(equipmentId) : null;

    // Equipment record
    const eqRows = eqId
      ? await sql`SELECT * FROM qc_spect_equipment WHERE id = ${eqId}`
      : await sql`SELECT * FROM qc_spect_equipment ORDER BY manufacturer, model LIMIT 1`;
    const eq = eqRows[0] ?? null;

    // Service events (last 20)
    const events = eqId
      ? await sql`SELECT * FROM qc_spect_service_events WHERE equipment_id = ${eqId} ORDER BY service_date DESC LIMIT 20`
      : [];

    // Baseline vigente por parámetro (SPECT: sin test_mode)
    const baselines = eqId
      ? await sql`
          SELECT test_type, parameter_name, value, unit, date_established, physicist_responsible
          FROM qc_spect_baseline
          WHERE equipment_id = ${eqId} AND is_current = true
          ORDER BY test_type, parameter_name
        `
      : [];

    // QC tests (last 30)
    const tests = eqId
      ? await sql`
          SELECT test_date, test_type, result_status, performed_by,
                 mean_value, reference_value, percent_value, tolerance_percent,
                 corrective_action
          FROM qc_spect_tests
          WHERE instrument_id = ${eqId}
          ORDER BY test_date DESC
          LIMIT 30
        `
      : [];

    const stamp = new Date().toISOString().slice(0, 10);
    const eqLabel = eq
      ? `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/código"})`.trim()
      : "Equipo no especificado";

    // --- Build PDF ---
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" }) as unknown as {
      text: (t: string, x: number, y: number, opts?: Record<string, unknown>) => void;
      setFontSize: (n: number) => void;
      setFont: (family: string, style?: string) => void;
      setTextColor: (r: number, g?: number, b?: number) => void;
      line: (x1: number, y1: number, x2: number, y2: number) => void;
      setDrawColor: (r: number, g?: number, b?: number) => void;
      autoTable: (opts: Record<string, unknown>) => void;
      lastAutoTable: { finalY: number };
      output: (type: string) => ArrayBuffer;
      internal: { pageSize: { getWidth: () => number } };
      getNumberOfPages: () => number;
      setPage: (n: number) => void;
    };

    const W = doc.internal.pageSize.getWidth();
    const MARGIN = 40;
    let y = 40;

    // Header
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 80, 60);
    doc.text("INFORME TÉCNICO — SPECT", MARGIN, y);
    y += 18;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Referencia técnica: IAEA TECDOC-602. DS 133/1984 MINSAL.  Generado: ${stamp}`, MARGIN, y);
    y += 8;
    doc.setDrawColor(15, 80, 60);
    doc.line(MARGIN, y, W - MARGIN, y);
    y += 14;

    // Section: Equipment
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 80, 60);
    doc.text("1. Ficha técnica del equipo", MARGIN, y); y += 12;

    if (eq) {
      doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 8 },
        body: [
          ["Fabricante", eq.manufacturer ?? "—", "Modelo", eq.model ?? "—"],
          ["Código interno", eq.internal_code ?? "—", "N/S", eq.serial_number ?? "—"],
          ["Año fabricación", eq.manufacture_year ?? "—", "Año instalación", eq.installation_year ?? "—"],
          ["N° detectores", eq.num_detectors ?? "—", "Tipo SPECT", eq.has_ct ? "SPECT/CT" : "SPECT"],
          ["Resolución FWHM (mm)", eq.spect_resolution_fwhm_mm ?? "—", "Estado operativo", eq.operational_status ?? "—"],
          ...(eq.has_ct ? [["Modelo CT", eq.ct_model ?? "—", "N/S CT", eq.ct_serial_number ?? "—"]] : []),
          ["Ubicación", eq.location ?? "—", "", ""],
        ],
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 110 }, 2: { fontStyle: "bold", cellWidth: 110 } },
        theme: "grid",
      });
      y = doc.lastAutoTable.finalY + 16;
    } else {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
      doc.text("No se encontró ficha de equipo.", MARGIN, y); y += 16;
    }

    // Section: Service events
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 80, 60);
    doc.text("2. Historial de eventos de servicio (últimos 20)", MARGIN, y); y += 12;

    if (events.length > 0) {
      doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [15, 80, 60] },
        head: [["Fecha", "Tipo", "Técnico/Empresa", "Descripción / Hallazgo", "Estado"]],
        body: events.map((ev: Record<string, unknown>) => [
          String(ev.service_date ?? "").slice(0, 10),
          String(ev.service_type ?? "—"),
          `${ev.technician ?? ""}${ev.company ? " / " + ev.company : ""}`,
          String(ev.description ?? ev.finding ?? "—").slice(0, 80),
          String(ev.status ?? "—"),
        ]),
        theme: "striped",
      });
      y = doc.lastAutoTable.finalY + 16;
    } else {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
      doc.text("Sin eventos de servicio registrados para este equipo.", MARGIN, y); y += 16;
    }

    // Section: Baseline
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 80, 60);
    doc.text("3. Baseline vigente por parámetro", MARGIN, y); y += 12;

    if (baselines.length > 0) {
      doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [15, 80, 60] },
        head: [["Tipo de prueba", "Parámetro", "Valor", "Unidad", "Fecha establecido", "Físico responsable"]],
        body: baselines.map((b: Record<string, unknown>) => [
          String(b.test_type ?? "—"),
          String(b.parameter_name ?? "—"),
          b.value !== null && b.value !== undefined ? String(b.value) : "—",
          String(b.unit ?? "—"),
          String(b.date_established ?? "—").slice(0, 10),
          String(b.physicist_responsible ?? "—"),
        ]),
        theme: "striped",
      });
      y = doc.lastAutoTable.finalY + 16;
    } else {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
      doc.text("Sin baseline establecido para este equipo.", MARGIN, y); y += 16;
    }

    // Section: QC tests
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 80, 60);
    doc.text("4. Pruebas de control de calidad recientes (últimas 30)", MARGIN, y); y += 12;

    if (tests.length > 0) {
      doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 7 },
        headStyles: { fillColor: [15, 80, 60] },
        head: [["Fecha", "Tipo de prueba", "Estado", "Valor medio", "Referencia", "Desv. (%)", "Tol. (%)", "Realizada por"]],
        body: tests.map((t: Record<string, unknown>) => [
          String(t.test_date ?? "").slice(0, 10),
          String(t.test_type ?? "—"),
          String(t.result_status ?? "—"),
          t.mean_value !== null && t.mean_value !== undefined ? Number(t.mean_value).toFixed(3) : "—",
          t.reference_value !== null && t.reference_value !== undefined ? Number(t.reference_value).toFixed(3) : "—",
          t.percent_value !== null && t.percent_value !== undefined ? Number(t.percent_value).toFixed(2) : "—",
          t.tolerance_percent !== null && t.tolerance_percent !== undefined ? String(t.tolerance_percent) : "—",
          String(t.performed_by ?? "—"),
        ]),
        theme: "striped",
        didParseCell: (data: { row: { raw: unknown[] }; column: { index: number }; cell: { styles: { textColor: number[] } } }) => {
          if (data.column.index === 2) {
            const status = String((data.row.raw as unknown[])[2]);
            if (status === "aprobado") data.cell.styles.textColor = [0, 128, 0];
            else if (status === "rechazado" || status === "fuera_tolerancia") data.cell.styles.textColor = [180, 0, 0];
          }
        },
      });
      y = doc.lastAutoTable.finalY + 16;
    } else {
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
      doc.text("Sin pruebas QC registradas para este equipo.", MARGIN, y); y += 16;
    }

    // Footer: page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 140);
      doc.text(`${eqLabel}  |  Página ${i} de ${totalPages}  |  IAEA TECDOC-602 / DS 133/1984`, MARGIN, 832);
    }

    const arrayBuffer = doc.output("arraybuffer");
    const filename = `spect-informe-${eq?.internal_code ?? "general"}-${stamp}.pdf`;

    return new NextResponse(Buffer.from(arrayBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/quality-control/spect/report:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
