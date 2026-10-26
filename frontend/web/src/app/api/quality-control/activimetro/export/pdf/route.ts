/**
 * Exportación PDF — Informe de Control de Calidad Activímetro
 * SPRM · Módulo 1 — Activímetro (Dose Calibrator)
 * Normativa: IAEA TECDOC-602 · DS 3/1985 MINSAL · DS 133/1984 MINSAL
 *
 * Genera informe PDF landscape A4 con:
 *   1. Ficha técnica del equipo
 *   2. Panel de cumplimiento (pruebas del sistema heredado)
 *   3. Pruebas QC base: precisión, exactitud, linealidad, respuesta fondo, geometría
 *   4. Pruebas de constancia (ACTIV-estabilidad)
 *   5. Pruebas de pureza radionuclídica
 *   6. Pruebas de exactitud por radionúclido
 *   7. Inspecciones visuales
 *   8. Alertas activas
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  listActivimetroEquipment,
  ensureActivimetroArchitectureTables,
} from "@/lib/qc-activimetro-architecture-db";
import {
  ensureActivimetroQcTables,
} from "@/lib/qc-activimetro-db";
import {
  listConstanciaTests,
  ensureConstanciaTolerance,
} from "@/lib/qc-activimetro-constancy-db";
import {
  listPurityTests,
  ensurePurityTables,
} from "@/lib/qc-activimetro-purity-db";
import {
  listActivimetroInspections,
  ensureActivimetroInspectionTables,
} from "@/lib/qc-activimetro-inspection-db";
import {
  listExactitudRadionuclidoTests,
  ensureExactitudRadionuclidoTolerance,
} from "@/lib/qc-activimetro-radionuclide-accuracy-db";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<string, [number, number, number]> = {
  aceptable: [34, 139, 34],
  aprobado: [34, 139, 34],
  cumple: [34, 139, 34],
  advertencia: [184, 134, 11],
  revision: [184, 134, 11],
  requiere_revision: [184, 134, 11],
  fuera_de_tolerancia: [180, 30, 30],
  rechazado: [180, 30, 30],
  no_cumple: [180, 30, 30],
  no_aplica: [120, 120, 120],
  pendiente_revision: [120, 120, 120],
};

const COMPLIANCE_COLORS: Record<string, [number, number, number]> = {
  ok: [34, 139, 34],
  upcoming: [184, 134, 11],
  overdue: [180, 30, 30],
  sin_registro: [120, 120, 120],
};

const COMPLIANCE_LABELS: Record<string, string> = {
  ok: "Al día",
  upcoming: "Próxima",
  overdue: "Vencida",
  sin_registro: "Sin registro",
};

const STATUS_LABELS: Record<string, string> = {
  aceptable: "Aceptable",
  aprobado: "Aprobado",
  cumple: "Cumple",
  advertencia: "Advertencia",
  revision: "Revisión",
  requiere_revision: "Requiere revisión",
  fuera_de_tolerancia: "Fuera de tolerancia",
  rechazado: "Rechazado",
  no_cumple: "No cumple",
  no_aplica: "No aplica",
  pendiente_revision: "Pendiente revisión",
};

const TEST_TYPE_LABELS: Record<string, string> = {
  precision: "Precisión (CV%)",
  exactitud: "Exactitud",
  linealidad: "Linealidad",
  respuesta_fondo: "Respuesta de Fondo",
  geometria_volumen: "Geometría y Volumen",
};

function frequencyLabel(days: number): string {
  if (days <= 1) return "Diaria";
  if (days <= 7) return "Semanal";
  if (days <= 31) return "Mensual";
  if (days <= 92) return "Trimestral";
  return "Anual";
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const equipmentIdParam = searchParams.get("equipment_id");
    if (!equipmentIdParam) {
      return NextResponse.json({ error: "Falta el parámetro equipment_id." }, { status: 400 });
    }
    const equipmentId = Number(equipmentIdParam);
    if (isNaN(equipmentId)) {
      return NextResponse.json({ error: "equipment_id inválido." }, { status: 400 });
    }

    // Ensure tables exist
    await Promise.all([
      ensureActivimetroArchitectureTables(),
      ensureActivimetroQcTables(),
      ensureConstanciaTolerance(),
      ensurePurityTables(),
      ensureActivimetroInspectionTables(),
      ensureExactitudRadionuclidoTolerance(),
    ]);

    // Load equipment
    const allEquipment = await listActivimetroEquipment();
    const equipment = allEquipment.find((e) => e.id === equipmentId);
    if (!equipment) {
      return NextResponse.json({ error: "Equipo de activímetro no encontrado." }, { status: 404 });
    }

    const instrumentId = equipment.instrument_id;

    // Load data in parallel
    const [constanciaTests, purityTests, radionuclideTests, inspections, institution] = await Promise.all([
      listConstanciaTests(instrumentId ?? undefined),
      listPurityTests(instrumentId ?? undefined),
      listExactitudRadionuclidoTests(instrumentId ?? undefined),
      listActivimetroInspections(equipmentId),
      getInstitutionInfo(),
    ]);

    // Load legacy QC tests (precision, exactitud, etc.) via SQL
    const { rows: legacyTests } = instrumentId
      ? await sql`SELECT * FROM qc_activimetro_tests WHERE instrument_id = ${instrumentId} ORDER BY test_date DESC, id DESC LIMIT 200;`
      : await sql`SELECT * FROM qc_activimetro_tests WHERE instrument_id IS NULL ORDER BY test_date DESC, id DESC LIMIT 50;`;

    // Load compliance data
    const { rows: toleranceRows } = await sql`
      SELECT DISTINCT ON (test_type)
        test_type, frequency_days
      FROM qc_activimetro_tolerances
      WHERE active = true AND frequency_days IS NOT NULL
      ORDER BY test_type, protocol_version DESC;
    `;

    type ComplianceStatus = "overdue" | "upcoming" | "ok" | "sin_registro";
    type ComplianceRow = {
      test_type: string;
      test_label: string;
      frequency_days: number;
      frequency_label: string;
      last_test_date: string | null;
      next_due_date: string | null;
      days_until_due: number | null;
      status: ComplianceStatus;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const complianceRows: ComplianceRow[] = [];

    if (instrumentId) {
      const { rows: lastTests } = await sql`
        SELECT test_type, MAX(test_date) AS last_test_date
        FROM qc_activimetro_tests
        WHERE instrument_id = ${instrumentId}
        GROUP BY test_type;
      `;

      const lastMap = new Map<string, string>();
      for (const row of lastTests as Array<{ test_type: string; last_test_date: string }>) {
        lastMap.set(row.test_type, row.last_test_date);
      }

      for (const tol of toleranceRows as Array<{ test_type: string; frequency_days: number }>) {
        if (!tol.frequency_days) continue;
        const lastDate = lastMap.get(tol.test_type) ?? null;

        if (!lastDate) {
          complianceRows.push({
            test_type: tol.test_type,
            test_label: TEST_TYPE_LABELS[tol.test_type] ?? tol.test_type,
            frequency_days: tol.frequency_days,
            frequency_label: frequencyLabel(tol.frequency_days),
            last_test_date: null,
            next_due_date: null,
            days_until_due: null,
            status: "sin_registro",
          });
          continue;
        }

        const lastD = new Date(lastDate);
        const nextDue = new Date(lastD);
        nextDue.setDate(nextDue.getDate() + tol.frequency_days);
        const diffDays = Math.round((nextDue.getTime() - today.getTime()) / 86400000);
        const warningWindow = Math.max(1, Math.round(tol.frequency_days * 0.15));
        const status: ComplianceStatus = diffDays < 0 ? "overdue" : diffDays <= warningWindow ? "upcoming" : "ok";

        complianceRows.push({
          test_type: tol.test_type,
          test_label: TEST_TYPE_LABELS[tol.test_type] ?? tol.test_type,
          frequency_days: tol.frequency_days,
          frequency_label: frequencyLabel(tol.frequency_days),
          last_test_date: lastDate,
          next_due_date: nextDue.toISOString().slice(0, 10),
          days_until_due: diffDays,
          status,
        });
      }
    }

    const statusOrder = { overdue: 0, sin_registro: 1, upcoming: 2, ok: 3 };
    complianceRows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    const compSummary = {
      ok: complianceRows.filter((r) => r.status === "ok").length,
      upcoming: complianceRows.filter((r) => r.status === "upcoming").length,
      overdue: complianceRows.filter((r) => r.status === "overdue").length,
      sin_registro: complianceRows.filter((r) => r.status === "sin_registro").length,
    };

    // Load alerts (inline logic from /api/quality-control/activimetro/alerts)
    type Alert = { id: string; test_type: string; severity: string; message: string; recommended_action: string };
    const alerts: Alert[] = [];
    try {
      const { rows: tolerances } = await sql`
        SELECT DISTINCT ON (test_type) test_type, tolerance_percent, warning_percent, frequency_days
        FROM qc_activimetro_tolerances WHERE active = true ORDER BY test_type, protocol_version DESC;
      `;
      const { rows: lastTests } = instrumentId
        ? await sql`SELECT instrument_id, instrument_name, test_type, MAX(test_date) AS last_test_date,
            (array_agg(result_status ORDER BY test_date DESC, id DESC))[1] AS last_status
          FROM qc_activimetro_tests WHERE instrument_id = ${instrumentId}
          GROUP BY instrument_id, instrument_name, test_type;`
        : await sql`SELECT instrument_id, instrument_name, test_type, MAX(test_date) AS last_test_date,
            (array_agg(result_status ORDER BY test_date DESC, id DESC))[1] AS last_status
          FROM qc_activimetro_tests WHERE instrument_id IS NULL
          GROUP BY instrument_id, instrument_name, test_type;`;

      const todayAlert = new Date(); todayAlert.setHours(0, 0, 0, 0);

      for (const row of lastTests as Array<{ instrument_id: number | null; instrument_name: string | null; test_type: string; last_test_date: string | null; last_status: string | null }>) {
        const tol = (tolerances as Array<{ test_type: string; tolerance_percent: number | null; warning_percent: number | null; frequency_days: number | null }>)
          .find((t) => t.test_type === row.test_type);

        if (row.last_status === "no_cumple") {
          alerts.push({ id: `notol-${row.instrument_id}-${row.test_type}`, test_type: row.test_type, severity: "alta", message: `Último resultado de ${TEST_TYPE_LABELS[row.test_type] ?? row.test_type} está fuera de tolerancia.`, recommended_action: "Suspender uso clínico. Notificar al Físico Médico/OPR." });
        } else if (row.last_status === "advertencia") {
          alerts.push({ id: `adv-${row.instrument_id}-${row.test_type}`, test_type: row.test_type, severity: "media", message: `Último resultado de ${TEST_TYPE_LABELS[row.test_type] ?? row.test_type} está en zona de advertencia.`, recommended_action: "Revisar con Físico Médico/OPR y programar verificación adicional." });
        }

        if (tol?.frequency_days && row.last_test_date) {
          const nextDue = new Date(row.last_test_date);
          nextDue.setDate(nextDue.getDate() + tol.frequency_days);
          const diffDays = Math.round((nextDue.getTime() - todayAlert.getTime()) / 86400000);
          if (diffDays < 0) {
            alerts.push({ id: `vencida-${row.instrument_id}-${row.test_type}`, test_type: row.test_type, severity: diffDays < -tol.frequency_days ? "alta" : "media", message: `Prueba ${TEST_TYPE_LABELS[row.test_type] ?? row.test_type} vencida hace ${Math.abs(diffDays)} día(s).`, recommended_action: "Realizar la prueba a la brevedad y registrar en bitácora." });
          }
        }
      }

      // Sin registro
      if (instrumentId) {
        for (const tol of tolerances as Array<{ test_type: string; frequency_days: number | null }>) {
          const hasRecord = (lastTests as Array<{ test_type: string }>).some((r) => r.test_type === tol.test_type);
          if (!hasRecord) {
            alerts.push({ id: `sinreg-${instrumentId}-${tol.test_type}`, test_type: tol.test_type, severity: "baja", message: `Sin registros de ${TEST_TYPE_LABELS[tol.test_type] ?? tol.test_type} para este equipo.`, recommended_action: "Registrar la primera prueba antes del uso clínico." });
          }
        }
      }
    } catch {
      // Alerts are best-effort
    }

    // ── PDF generation ────────────────────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    const { jsPDF } = await import("jspdf");
    // @ts-ignore
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;

    const equipLabel = `${fmtStr(equipment.manufacturer)} ${fmtStr(equipment.model)}`.trim();
    const equipCode = equipment.internal_code ?? "s/código";

    function sectionHeader(y: number, text: string): number {
      doc.setFillColor(30, 80, 140);
      doc.rect(14, y, pageW - 28, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(text, 16, y + 4.2);
      doc.setTextColor(0, 0, 0);
      return y + 8;
    }

    function drawPageHeader() {
      doc.setFillColor(15, 60, 110);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Informe de Control de Calidad — Activímetro", 14, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${equipLabel}  ·  Código: ${equipCode}`, 14, 17);
      doc.setFontSize(7);
      const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
      const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
      doc.text(
        `${institution.name}  ·  ${oprLine}${cchenLine}IAEA TECDOC-602  ·  DS 3/1985 MINSAL  ·  Generado: ${dateStr}`,
        14,
        23
      );
      doc.setTextColor(0, 0, 0);
    }

    function checkPageBreak(y: number, threshold = 170): number {
      if (y > threshold) {
        doc.addPage();
        drawPageHeader();
        return 32;
      }
      return y;
    }

    drawPageHeader();
    let y = 32;

    // ── 1. Ficha técnica del equipo ───────────────────────────────────────────
    y = sectionHeader(y, "1. FICHA TÉCNICA DEL EQUIPO — ACTIVÍMETRO (DOSE CALIBRATOR)");

    autoTable(doc, {
      startY: y,
      body: [
        ["Fabricante", fmtStr(equipment.manufacturer), "Modelo", fmtStr(equipment.model)],
        ["N/S", fmtStr(equipment.serial_number), "Código interno", fmtStr(equipment.internal_code)],
        ["Institución", fmtStr(equipment.institution_name), "Servicio", fmtStr(equipment.service_name)],
        ["Tipo de cámara", fmtStr(equipment.chamber_type), "Tipo de detector", fmtStr(equipment.detector_type)],
        ["SW nombre", fmtStr(equipment.software_name), "SW versión", fmtStr(equipment.software_version)],
        ["Fecha instalación", fmtDate(equipment.installation_date), "Fecha aceptación", fmtDate(equipment.acceptance_date)],
        ["Última calibración", fmtDate(equipment.last_calibration_date), "Último servicio", fmtDate(equipment.last_service_date)],
      ],
      theme: "grid",
      bodyStyles: { fontSize: 7.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 44, fontStyle: "bold", fillColor: [245, 247, 250] },
        1: { cellWidth: 80 },
        2: { cellWidth: 44, fontStyle: "bold", fillColor: [245, 247, 250] },
        3: { cellWidth: 80 },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ── 2. Cumplimiento de frecuencias ────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `2. CUMPLIMIENTO DE FRECUENCIAS  —  Al día: ${compSummary.ok}  |  Próximas: ${compSummary.upcoming}  |  Vencidas: ${compSummary.overdue}  |  Sin registro: ${compSummary.sin_registro}`);

    if (complianceRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Prueba", "Frecuencia", "Último realizado", "Próximo vencimiento", "Días restantes", "Estado"]],
        body: complianceRows.map((r) => [
          r.test_label,
          r.frequency_label,
          fmtDate(r.last_test_date),
          fmtDate(r.next_due_date),
          r.days_until_due !== null ? String(r.days_until_due) : "—",
          COMPLIANCE_LABELS[r.status] ?? r.status,
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 54 },
          1: { cellWidth: 26 },
          2: { cellWidth: 32 },
          3: { cellWidth: 32 },
          4: { cellWidth: 24, halign: "right" },
          5: { cellWidth: 24 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 5) {
            const row = complianceRows[data.row.index];
            if (row) {
              const col = COMPLIANCE_COLORS[row.status];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text(instrumentId ? "Sin configuración de frecuencias." : "Este equipo no tiene instrument_id asociado.", 16, y + 4);
      doc.setTextColor(0, 0, 0); y += 10;
    }

    // ── 3. Pruebas QC base (legacy) ───────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `3. PRUEBAS QC BASE  (${(legacyTests as any[]).length} registros)`);

    if ((legacyTests as any[]).length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Tipo", "Fecha", "Operador", "N lecturas", "Media", "CV%", "Diferencia%", "Estado"]],
        body: (legacyTests as any[]).map((t) => [
          TEST_TYPE_LABELS[t.test_type] ?? fmtStr(t.test_type),
          fmtDate(t.test_date),
          fmtStr(t.performed_by),
          fmtStr(t.num_readings),
          fmtNum(t.mean_value, 3),
          fmtNum(t.cv_percent, 2),
          fmtNum(t.percent_difference, 2),
          STATUS_LABELS[t.result_status] ?? fmtStr(t.result_status),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 22 },
          2: { cellWidth: 36 },
          3: { cellWidth: 20, halign: "right" },
          4: { cellWidth: 24, halign: "right" },
          5: { cellWidth: 20, halign: "right" },
          6: { cellWidth: 24, halign: "right" },
          7: { cellWidth: 30 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 7) {
            const test = (legacyTests as any[])[data.row.index];
            if (test) {
              const col = STATUS_COLORS[test.result_status];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text("Sin registros de pruebas QC base.", 16, y + 4);
      doc.setTextColor(0, 0, 0); y += 10;
    }

    // ── 4. Pruebas de constancia ──────────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `4. PRUEBAS DE CONSTANCIA  (${constanciaTests.length} registros)`);

    if (constanciaTests.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Radionúclido", "Operador", "N lecturas", "Media", "CV%", "Dif%", "Estado"]],
        body: constanciaTests.map((t: Record<string, unknown>) => [
          fmtDate(t.test_date),
          fmtStr(t.radionuclide),
          fmtStr(t.performed_by),
          fmtStr(t.num_readings),
          fmtNum(t.mean_value, 3),
          fmtNum(t.cv_percent, 2),
          fmtNum(t.percent_difference, 2),
          STATUS_LABELS[t.result_status] ?? fmtStr(t.result_status),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 28 },
          2: { cellWidth: 36 },
          3: { cellWidth: 20, halign: "right" },
          4: { cellWidth: 24, halign: "right" },
          5: { cellWidth: 20, halign: "right" },
          6: { cellWidth: 22, halign: "right" },
          7: { cellWidth: 30 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 7) {
            const col = STATUS_COLORS[(constanciaTests as any[])[data.row.index]?.result_status];
            if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text("Sin registros de pruebas de constancia.", 16, y + 4);
      doc.setTextColor(0, 0, 0); y += 10;
    }

    // ── 5. Pruebas de pureza radionuclídica ───────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `5. PRUEBAS DE PUREZA RADIONUCLÍDICA  (${(purityTests as any[]).length} registros)`);

    if ((purityTests as any[]).length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Radionúclido", "Impureza detectada", "Operador", "Actividad (MBq)", "Pureza (%)", "Estado"]],
        body: (purityTests as any[]).map((t) => [
          fmtDate(t.test_date),
          fmtStr(t.radionuclide),
          fmtStr(t.impurity_detected),
          fmtStr(t.performed_by),
          fmtNum(t.activity_mbq, 1),
          fmtNum(t.purity_percent, 3),
          STATUS_LABELS[t.result_status ?? t.final_status] ?? fmtStr(t.result_status ?? t.final_status),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 28 },
          2: { cellWidth: 36 },
          3: { cellWidth: 36 },
          4: { cellWidth: 26, halign: "right" },
          5: { cellWidth: 22, halign: "right" },
          6: { cellWidth: 30 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 6) {
            const test = (purityTests as any[])[data.row.index];
            const statusKey = test?.result_status ?? test?.final_status;
            const col = STATUS_COLORS[statusKey];
            if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text("Sin registros de pruebas de pureza radionuclídica.", 16, y + 4);
      doc.setTextColor(0, 0, 0); y += 10;
    }

    // ── 6. Exactitud por radionúclido ─────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `6. EXACTITUD POR RADIONÚCLIDO  (${(radionuclideTests as any[]).length} registros)`);

    if ((radionuclideTests as any[]).length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Radionúclido", "Operador", "Act. referencia (MBq)", "Act. medida (MBq)", "Diferencia%", "Estado"]],
        body: (radionuclideTests as any[]).map((t) => [
          fmtDate(t.test_date),
          fmtStr(t.radionuclide),
          fmtStr(t.performed_by),
          fmtNum(t.reference_activity_mbq, 2),
          fmtNum(t.measured_activity_mbq, 2),
          fmtNum(t.percent_difference, 2),
          STATUS_LABELS[t.result_status] ?? fmtStr(t.result_status),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 28 },
          2: { cellWidth: 36 },
          3: { cellWidth: 32, halign: "right" },
          4: { cellWidth: 32, halign: "right" },
          5: { cellWidth: 26, halign: "right" },
          6: { cellWidth: 30 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 6) {
            const col = STATUS_COLORS[(radionuclideTests as any[])[data.row.index]?.result_status];
            if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text("Sin registros de exactitud por radionúclido.", 16, y + 4);
      doc.setTextColor(0, 0, 0); y += 10;
    }

    // ── 7. Inspecciones visuales ──────────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `7. INSPECCIONES VISUALES  (${inspections.length} registros)`);

    if (inspections.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Realizado por", "Revisor FM", "Resultado global", "Observaciones"]],
        body: inspections.map((ins: Record<string, unknown>) => [
          fmtDate(ins.inspection_date),
          fmtStr(ins.performed_by),
          fmtStr(ins.physicist_reviewed_by),
          STATUS_LABELS[ins.overall_result] ?? fmtStr(ins.overall_result),
          fmtStr(ins.observaciones),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 44 },
          2: { cellWidth: 44 },
          3: { cellWidth: 30 },
          4: { cellWidth: 100 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 3) {
            const col = STATUS_COLORS[inspections[data.row.index]?.overall_result];
            if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text("Sin registros de inspección visual.", 16, y + 4);
      doc.setTextColor(0, 0, 0); y += 10;
    }

    // ── 8. Alertas activas ────────────────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `8. ALERTAS ACTIVAS  (${alerts.length})`);

    if (alerts.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Severidad", "Prueba", "Descripción", "Acción recomendada"]],
        body: alerts.map((a) => [
          a.severity === "alta" ? "Alta" : a.severity === "media" ? "Media" : "Baja",
          TEST_TYPE_LABELS[a.test_type] ?? fmtStr(a.test_type),
          fmtStr(a.message),
          fmtStr(a.recommended_action),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 38 },
          2: { cellWidth: 100 },
          3: { cellWidth: 100 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 0) {
            const a = alerts[data.row.index];
            const colors: Record<string, [number, number, number]> = { alta: [180, 30, 30], media: [184, 134, 11], baja: [34, 100, 180] };
            const col = a && colors[a.severity];
            if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8); doc.setTextColor(34, 139, 34); doc.setFont("helvetica", "bold");
      doc.text("Sin alertas activas para este equipo.", 16, y + 4);
      doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); y += 10;
    }

    // ── Footer regulatorio ────────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.height;
      doc.setFillColor(240, 243, 248);
      doc.rect(0, pageH - 10, pageW, 10, "F");
      doc.setFontSize(6); doc.setTextColor(80, 80, 80);
      doc.text(
        "IAEA TECDOC-602  ·  DS 3/1985 MINSAL  ·  DS 133/1984 MINSAL  ·  Informe no reemplaza la firma y revisión del Físico Médico responsable.",
        14,
        pageH - 5.5
      );
      doc.text(`Página ${i} de ${totalPages}  ·  Generado: ${dateStr}`, pageW - 14, pageH - 5.5, { align: "right" });
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const equipSlug = `${fmtStr(equipment.manufacturer)}_${fmtStr(equipment.model)}_${equipCode}`
      .toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 60);
    const filename = `qc_activimetro_${equipSlug}_${dateFile}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error en GET /api/quality-control/activimetro/export/pdf:", error);
    return NextResponse.json({ error: "Error al generar el informe PDF de QC Activímetro" }, { status: 500 });
  }
}
