import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSpectEquipmentTables, listSpectEquipment } from "@/lib/qc-spect-equipment-db";
import { ensureSpectQcTables } from "@/lib/qc-spect-db";
import { ensureSpectArchitectureTables } from "@/lib/qc-spect-architecture-db";
import { getInstitutionInfo } from "@/lib/institution-settings";

/**
 * MODULO 3 - SPECT - INFORME PDF SERVIDOR
 * GET ?equipment_id=N
 * Genera un informe profesional landscape A4 con:
 *   1. Ficha técnica del equipo
 *   2. Cumplimiento de frecuencias (todas las pruebas QC)
 *   3. Pruebas de Centro de Rotación (COR) — últimas 20
 *   4. Pruebas de Uniformidad Tomográfica — últimas 20
 *   5. Baseline vigente por parámetro
 *   6. Alertas activas
 *
 * Referencia: IAEA TECDOC-602 · DS 133/1984 MINSAL · DS 3/1985 MINSAL
 */

export const dynamic = "force-dynamic";

// Color palette (RGB)
const C = {
  headerBg: [15, 60, 110] as [number, number, number],
  sectionBg: [30, 80, 140] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  grayLight: [245, 247, 250] as [number, number, number],
  grayMid: [200, 210, 220] as [number, number, number],
  grayDark: [80, 90, 100] as [number, number, number],
  textDark: [20, 30, 45] as [number, number, number],
  green: [34, 139, 34] as [number, number, number],
  red: [180, 30, 30] as [number, number, number],
  yellow: [184, 134, 11] as [number, number, number],
  blue: [34, 100, 180] as [number, number, number],
};

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  alta: C.red,
  media: C.yellow,
  baja: C.blue,
};

function fmtStr(v: unknown): string {
  if (v == null) return "—";
  return String(v).trim() || "—";
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  if (!s || s === "null") return "—";
  return s;
}

function fmtNum(v: unknown, decimals = 2): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toFixed(decimals);
}

function frequencyLabel(days: number): string {
  if (days <= 1) return "Diaria";
  if (days <= 7) return "Semanal";
  if (days <= 31) return "Mensual";
  if (days <= 92) return "Trimestral";
  return "Anual";
}

const TEST_TYPE_LABELS: Record<string, string> = {
  centro_rotacion: "Centro de Rotación (COR)",
  uniformidad_tomografica: "Uniformidad Tomográfica",
};

export async function GET(request: NextRequest) {
  try {
    await Promise.all([
      ensureSpectEquipmentTables(),
      ensureSpectQcTables(),
      ensureSpectArchitectureTables(),
    ]);

    const { searchParams } = new URL(request.url);
    const equipmentIdParam = searchParams.get("equipment_id");
    const equipmentId = equipmentIdParam ? Number(equipmentIdParam) : null;

    // Load equipment
    const allEquipment = await listSpectEquipment();
    const eq = equipmentId
      ? allEquipment.find((e) => e.id === equipmentId) ?? allEquipment[0] ?? null
      : allEquipment[0] ?? null;

    if (!eq) {
      return NextResponse.json({ error: "No se encontró equipo SPECT" }, { status: 404 });
    }

    const eqId = eq.id;

    // Load all data in parallel
    const [
      baselines,
      corTests,
      uniformidadTests,
      tolerances,
      institution,
    ] = await Promise.all([
      sql`
        SELECT test_type, parameter_name, value, unit, date_established, physicist_responsible
        FROM qc_spect_baseline
        WHERE equipment_id = ${eqId} AND is_current = true
        ORDER BY test_type, parameter_name
      `,
      sql`
        SELECT test_date, test_type, result_status, performed_by,
               mean_value, reference_value, percent_difference, tolerance_percent, corrective_action
        FROM qc_spect_tests
        WHERE instrument_id = ${eqId} AND test_type = 'centro_rotacion'
        ORDER BY test_date DESC LIMIT 20
      `,
      sql`
        SELECT test_date, test_type, result_status, performed_by,
               mean_value, reference_value, percent_difference, tolerance_percent, corrective_action
        FROM qc_spect_tests
        WHERE instrument_id = ${eqId} AND test_type = 'uniformidad_tomografica'
        ORDER BY test_date DESC LIMIT 20
      `,
      sql`
        SELECT DISTINCT ON (test_type)
          test_type, frequency_days
        FROM qc_spect_tolerances
        WHERE active = true AND frequency_days IS NOT NULL
        ORDER BY test_type, protocol_version DESC
      `,
      getInstitutionInfo(),
    ]);

    // Compute compliance inline
    const now = new Date();
    type ComplianceRow = {
      test_type: string;
      test_label: string;
      frequency_days: number;
      frequency_label: string;
      last_test_date: string | null;
      next_due_date: string | null;
      days_until_due: number | null;
      status: string;
    };

    const complianceRows: ComplianceRow[] = [];
    for (const tol of tolerances) {
      const freqDays = Number(tol.frequency_days);
      const lastRows = await sql`
        SELECT test_date FROM qc_spect_tests
        WHERE instrument_id = ${eqId} AND test_type = ${tol.test_type}
        ORDER BY test_date DESC LIMIT 1
      `;
      const lastDate = lastRows[0]?.test_date ? new Date(String(lastRows[0].test_date)) : null;
      const nextDue = lastDate ? new Date(lastDate.getTime() + freqDays * 86400000) : null;
      const daysUntilDue = nextDue ? Math.round((nextDue.getTime() - now.getTime()) / 86400000) : null;
      let status = "sin_registro";
      if (daysUntilDue !== null) {
        if (daysUntilDue < 0) status = "overdue";
        else if (daysUntilDue <= Math.ceil(freqDays * 0.2)) status = "upcoming";
        else status = "ok";
      }
      complianceRows.push({
        test_type: String(tol.test_type),
        test_label: TEST_TYPE_LABELS[String(tol.test_type)] ?? String(tol.test_type),
        frequency_days: freqDays,
        frequency_label: frequencyLabel(freqDays),
        last_test_date: lastDate ? lastDate.toISOString().slice(0, 10) : null,
        next_due_date: nextDue ? nextDue.toISOString().slice(0, 10) : null,
        days_until_due: daysUntilDue,
        status,
      });
    }

    // Compute alerts inline
    type SpectAlert = {
      severity: string;
      alert_type: string;
      test_type: string;
      message: string;
      recommended_action: string;
    };
    const alerts: SpectAlert[] = [];

    for (const row of complianceRows) {
      if (row.status === "overdue") {
        alerts.push({
          severity: "alta",
          alert_type: "prueba_vencida",
          test_type: row.test_type,
          message: `${row.test_label}: prueba vencida (${Math.abs(row.days_until_due ?? 0)} días de retraso)`,
          recommended_action: `Realizar prueba de ${row.test_label.toLowerCase()} a la brevedad.`,
        });
      } else if (row.status === "sin_registro") {
        alerts.push({
          severity: "media",
          alert_type: "prueba_sin_registro",
          test_type: row.test_type,
          message: `${row.test_label}: sin registro de prueba`,
          recommended_action: `Realizar prueba inicial de ${row.test_label.toLowerCase()}.`,
        });
      } else if (row.status === "upcoming") {
        alerts.push({
          severity: "baja",
          alert_type: "prueba_proxima",
          test_type: row.test_type,
          message: `${row.test_label}: próxima a vencer (${row.days_until_due} días restantes)`,
          recommended_action: `Programar prueba de ${row.test_label.toLowerCase()}.`,
        });
      }
    }

    // Recent failed tests
    const recentFailed = await sql`
      SELECT test_type, test_date, result_status, percent_difference, tolerance_percent
      FROM qc_spect_tests
      WHERE instrument_id = ${eqId} AND result_status IN ('rechazado', 'advertencia')
        AND test_date >= NOW() - INTERVAL '90 days'
      ORDER BY test_date DESC LIMIT 10
    `;
    for (const t of recentFailed) {
      const severity = t.result_status === "rechazado" ? "alta" : "media";
      const label = TEST_TYPE_LABELS[String(t.test_type)] ?? String(t.test_type);
      alerts.push({
        severity,
        alert_type: t.result_status === "rechazado" ? "fuera_de_tolerancia" : "advertencia",
        test_type: String(t.test_type),
        message: `${label}: resultado ${t.result_status} el ${fmtDate(t.test_date)} (Δ=${fmtNum(t.percent_difference)}%, tol=${fmtNum(t.tolerance_percent)}%)`,
        recommended_action:
          t.result_status === "rechazado"
            ? `Verificar calibración y repetir prueba de ${label.toLowerCase()}.`
            : `Monitorear tendencia en ${label.toLowerCase()}.`,
      });
    }

    // Sort alerts: alta → media → baja
    const severityOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

    // --- BUILD PDF ---
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const PW = 297;
    const PH = 210;
    const ML = 14;
    const MR = 14;
    const CW = PW - ML - MR;

    const stamp = new Date().toISOString().slice(0, 10);
    const eqLabel =
      `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/código"})`.trim();
    const instName = institution.name || "Institución no configurada";

    function drawPageHeader(pg: number) {
      doc.setFillColor(...C.headerBg);
      doc.rect(0, 0, PW, 18, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.white);
      doc.text("INFORME QC SPECT — IAEA TECDOC-602", ML, 11);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`${instName} | ${eqLabel} | Generado: ${stamp} | Pág. ${pg}`, PW - MR, 11, { align: "right" });
      doc.setTextColor(...C.textDark);
    }

    function drawSection(y: number, title: string): number {
      doc.setFillColor(...C.sectionBg);
      doc.rect(ML, y, CW, 7, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.white);
      doc.text(title, ML + 3, y + 5);
      doc.setTextColor(...C.textDark);
      return y + 9;
    }

    let currentPage = 1;
    function checkPageBreak(y: number, threshold = 25): number {
      if (y > PH - threshold) {
        doc.addPage();
        currentPage++;
        drawPageHeader(currentPage);
        return 22;
      }
      return y;
    }

    // === PAGE 1 ===
    drawPageHeader(1);
    let y = 22;

    // --- SECTION 1: Ficha técnica ---
    y = drawSection(y, "1. Ficha Técnica del Equipo");

    const fichaRows = [
      ["Institución", fmtStr(eq.institution_name), "Servicio", fmtStr(eq.service_name)],
      ["Fabricante", fmtStr(eq.manufacturer), "Modelo", fmtStr(eq.model)],
      ["N/S", fmtStr(eq.serial_number), "Código interno", fmtStr(eq.internal_code)],
      ["N° detectores", fmtStr(eq.num_detectors), "Tipo cristal", fmtStr(eq.crystal_type)],
      ["Tamaño cristal (in)", fmtNum(eq.crystal_size_inch, 1), "Campo de visión", fmtStr(eq.fov_dimensions)],
      ["Resolución energética (%)", fmtNum(eq.energy_resolution_percent, 2), "Resolución intrínseca FWHM (mm)", fmtNum(eq.intrinsic_resolution_fwhm_mm, 2)],
      ["Resolución SPECT FWHM (mm)", fmtNum(eq.spect_resolution_fwhm_mm, 2), "Colimadores", fmtStr(eq.collimator_types)],
      ["Tiene CT", eq.has_ct ? "Sí" : "No", "Modelo CT", fmtStr(eq.ct_model)],
      ["N/S CT", fmtStr(eq.ct_serial_number), "Software", `${fmtStr(eq.software_name)} v${fmtStr(eq.software_version)}`],
      ["Fecha instalación", fmtDate(eq.installation_date), "Fecha aceptación", fmtDate(eq.acceptance_date)],
      ["Última calibración", fmtDate(eq.last_calibration_date), "Último servicio", fmtDate(eq.last_service_date)],
      ["N° autorización", fmtStr(eq.authorization_number), "Vencimiento autorización", fmtDate(eq.authorization_expiry_date)],
    ];

    doc.autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: fichaRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5, textColor: C.textDark },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: C.grayLight, cellWidth: 55 },
        1: { cellWidth: 70 },
        2: { fontStyle: "bold", fillColor: C.grayLight, cellWidth: 55 },
        3: { cellWidth: 70 },
      },
    });
    y = doc.lastAutoTable.finalY + 4;

    // --- SECTION 2: Cumplimiento ---
    y = checkPageBreak(y, 30);
    y = drawSection(y, "2. Cumplimiento de Frecuencias");

    if (complianceRows.length === 0) {
      doc.setFontSize(8);
      doc.text("Sin configuración de frecuencias registrada.", ML + 2, y + 4);
      y += 10;
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Prueba", "Frecuencia", "Último registro", "Próximo vencimiento", "Días restantes", "Estado"]],
        body: complianceRows.map((r) => [
          r.test_label,
          r.frequency_label,
          fmtDate(r.last_test_date),
          fmtDate(r.next_due_date),
          r.days_until_due != null ? String(r.days_until_due) : "—",
          r.status === "ok" ? "Al día" : r.status === "overdue" ? "VENCIDO" : r.status === "upcoming" ? "Próximo" : "Sin registro",
        ]),
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: C.sectionBg, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
        didParseCell: (data: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor: number[] } } }) => {
          if (data.section === "body" && data.column.index === 5) {
            const v = String(data.cell.raw ?? "");
            if (v === "VENCIDO") data.cell.styles.textColor = C.red;
            else if (v === "Próximo") data.cell.styles.textColor = C.yellow;
            else if (v === "Al día") data.cell.styles.textColor = C.green;
            else data.cell.styles.textColor = C.grayDark;
          }
        },
        didDrawPage: (_: unknown) => {
          currentPage++;
          drawPageHeader(currentPage);
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // Helper: test results table
    const drawTestTable = (rows: unknown[], sectionY: number): number => {
      if (!Array.isArray(rows) || rows.length === 0) {
        doc.setFontSize(8);
        doc.text("Sin registros.", ML + 2, sectionY + 4);
        return sectionY + 10;
      }
      doc.autoTable({
        startY: sectionY,
        margin: { left: ML, right: MR },
        head: [["Fecha", "Tipo de prueba", "Estado", "Valor", "Referencia", "Δ (%)", "Tol. (%)", "Operador", "Acción correctiva"]],
        body: (rows as Record<string, unknown>[]).map((t) => [
          fmtDate(t.test_date),
          TEST_TYPE_LABELS[String(t.test_type)] ?? String(t.test_type),
          fmtStr(t.result_status),
          fmtNum(t.mean_value, 2),
          fmtNum(t.reference_value, 2),
          fmtNum(t.percent_difference, 2),
          fmtNum(t.tolerance_percent, 1),
          fmtStr(t.performed_by),
          fmtStr(t.corrective_action),
        ]),
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: C.sectionBg, textColor: C.white, fontStyle: "bold", fontSize: 7 },
        didParseCell: (data: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor: number[] } } }) => {
          if (data.section === "body" && data.column.index === 2) {
            const v = String(data.cell.raw ?? "").toLowerCase();
            if (v === "rechazado") data.cell.styles.textColor = C.red;
            else if (v === "advertencia") data.cell.styles.textColor = C.yellow;
            else if (v === "aprobado") data.cell.styles.textColor = C.green;
          }
        },
        didDrawPage: (_: unknown) => {
          currentPage++;
          drawPageHeader(currentPage);
        },
      });
      return doc.lastAutoTable.finalY + 4;
    };

    // --- SECTION 3: Centro de Rotación ---
    y = checkPageBreak(y, 30);
    y = drawSection(y, "3. Pruebas de Centro de Rotación (COR)");
    y = drawTestTable(corTests, y);

    // --- SECTION 4: Uniformidad Tomográfica ---
    y = checkPageBreak(y, 30);
    y = drawSection(y, "4. Pruebas de Uniformidad Tomográfica");
    y = drawTestTable(uniformidadTests, y);

    // --- SECTION 5: Baseline vigente ---
    y = checkPageBreak(y, 30);
    y = drawSection(y, "5. Baseline Vigente por Parámetro");

    if (!baselines || baselines.length === 0) {
      doc.setFontSize(8);
      doc.text("Sin baseline registrado para este equipo.", ML + 2, y + 4);
      y += 10;
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Prueba", "Parámetro", "Valor", "Unidad", "Establecido", "Físico responsable"]],
        body: (baselines as Record<string, unknown>[]).map((b) => [
          TEST_TYPE_LABELS[String(b.test_type)] ?? String(b.test_type),
          fmtStr(b.parameter_name),
          fmtNum(b.value, 3),
          fmtStr(b.unit),
          fmtDate(b.date_established),
          fmtStr(b.physicist_responsible),
        ]),
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: C.sectionBg, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
        didDrawPage: (_: unknown) => {
          currentPage++;
          drawPageHeader(currentPage);
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // --- SECTION 6: Alertas ---
    y = checkPageBreak(y, 30);
    y = drawSection(y, "6. Alertas Activas");

    if (alerts.length === 0) {
      doc.setFontSize(8);
      doc.setTextColor(...C.green);
      doc.text("✓ Sin alertas activas. El equipo cumple todas las frecuencias de control de calidad.", ML + 2, y + 4);
      doc.setTextColor(...C.textDark);
      y += 10;
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Severidad", "Prueba", "Mensaje", "Acción recomendada"]],
        body: alerts.map((a) => [
          a.severity.toUpperCase(),
          TEST_TYPE_LABELS[a.test_type] ?? a.test_type,
          fmtStr(a.message),
          fmtStr(a.recommended_action),
        ]),
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: C.sectionBg, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 50 } },
        didParseCell: (data: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor: number[] } } }) => {
          if (data.section === "body" && data.column.index === 0) {
            const v = String(data.cell.raw ?? "").toLowerCase();
            data.cell.styles.textColor = SEVERITY_COLORS[v] ?? C.textDark;
          }
        },
        didDrawPage: (_: unknown) => {
          currentPage++;
          drawPageHeader(currentPage);
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // --- Footer ---
    doc.setFillColor(...C.grayMid);
    doc.rect(ML, PH - 14, CW, 0.3, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.grayDark);
    doc.text(
      "Referencia: IAEA TECDOC-602 (Quality Control Atlas for Scintillation Camera Systems) · DS 133/1984 MINSAL · DS 3/1985 MINSAL",
      ML, PH - 10
    );
    doc.text(
      `Requiere firma del Físico Médico responsable — ${institution.opr_name ?? "OPR no configurado"} | ${institution.cchen_code ?? "CCHEN no configurado"}`,
      PW - MR, PH - 10, { align: "right" }
    );

    const pdfBuffer = doc.output("arraybuffer") as ArrayBuffer;
    const slug = (eq.internal_code ?? String(eq.id)).replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `qc_spect_${slug}_${stamp}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[spect/export/pdf] Error:", err);
    return NextResponse.json(
      { error: "Error al generar el informe PDF", detail: String(err) },
      { status: 500 }
    );
  }
}
