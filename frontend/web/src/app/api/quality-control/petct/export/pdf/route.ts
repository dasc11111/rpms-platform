/**
 * Exportación PDF — Informe de Control de Calidad PET/CT
 * SPRM · Módulo 4 — Control de Calidad PET/CT
 * Normativa: IAEA Human Health Series No. 1 · AAPM TG-108 · DS 3/1985 MINSAL · DS 133/1984 MINSAL
 *
 * Genera un informe PDF landscape A4 con:
 *   1. Ficha técnica del equipo
 *   2. Panel de cumplimiento de frecuencias (compliance)
 *   3. Resultados de pruebas PET (PET-01 a PET-UNIF)
 *   4. Resultados de pruebas CT (CT-01 a CT-14)
 *   5. Resultados de pruebas de interacción PET/CT (PETCT-01, PETCT-02)
 *   6. Alertas activas (severidad alta / media / baja)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  listPetTests,
  ensurePetTestsTables,
} from "@/lib/qc-petct-pet-tests-db";
import {
  listCtTests,
  ensureCtTestsTables,
} from "@/lib/qc-petct-ct-tests-db";
import {
  listJointTests,
  ensureJointTestsTables,
} from "@/lib/qc-petct-joint-tests-db";
import {
  listPetCtEquipment,
  ensurePetCtEquipmentTables,
} from "@/lib/qc-petct-equipment-db";
import {
  listTestCatalog,
  ensurePetCtArchitectureTables,
} from "@/lib/qc-petct-architecture-db";
import { computePetCtAlerts } from "@/lib/qc-petct-alerts";
import { withRecommendedActions } from "@/lib/qc-petct-decision";
import { getInstitutionInfo } from "@/lib/institution-settings";
import { sql } from "@/lib/db";

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

function yesNo(val: unknown): string {
  if (val === true || val === "true") return "Sí";
  if (val === false || val === "false") return "No";
  return "—";
}

// Status color maps
const STATUS_COLORS: Record<string, [number, number, number]> = {
  aceptable: [34, 139, 34],
  aceptado: [34, 139, 34],
  requiere_revision: [184, 134, 11],
  rechazado: [180, 30, 30],
  no_aplica: [120, 120, 120],
  sin_registro: [120, 120, 120],
};

const ACTION_LEVEL_COLORS: Record<string, [number, number, number]> = {
  normal: [34, 139, 34],
  advertencia: [184, 134, 11],
  accion: [180, 30, 30],
};

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  alta: [180, 30, 30],
  media: [184, 134, 11],
  baja: [34, 100, 180],
};

const COMPLIANCE_STATUS_COLORS: Record<string, [number, number, number]> = {
  ok: [34, 139, 34],
  upcoming: [184, 134, 11],
  overdue: [180, 30, 30],
  sin_registro: [120, 120, 120],
};

const STATUS_LABELS: Record<string, string> = {
  aceptable: "Aceptable",
  aceptado: "Aceptado",
  requiere_revision: "Requiere revisión",
  rechazado: "Rechazado",
  no_aplica: "No aplica",
  sin_registro: "Sin registro",
};

const ACTION_LABELS: Record<string, string> = {
  normal: "Normal",
  advertencia: "Advertencia",
  accion: "Acción",
};

const COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  ok: "Al día",
  upcoming: "Próxima",
  overdue: "Vencida",
  sin_registro: "Sin registro",
};

// Compliance calculation (mirrors /api/quality-control/petct/compliance logic)
type FrequencyFlag = "freq_daily" | "freq_weekly" | "freq_monthly" | "freq_quarterly" | "freq_annual";
const FREQUENCY_DAYS: Array<{ flag: FrequencyFlag; label: string; days: number }> = [
  { flag: "freq_daily", label: "Diaria", days: 1 },
  { flag: "freq_weekly", label: "Semanal", days: 7 },
  { flag: "freq_monthly", label: "Mensual", days: 30 },
  { flag: "freq_quarterly", label: "Trimestral", days: 91 },
  { flag: "freq_annual", label: "Anual", days: 365 },
];

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

    // Ensure all tables exist
    await Promise.all([
      ensurePetCtArchitectureTables(),
      ensurePetCtEquipmentTables(),
      ensurePetTestsTables(),
      ensureCtTestsTables(),
      ensureJointTestsTables(),
    ]);

    // Load all data in parallel
    const [allEquipment, petTests, ctTests, jointTests, catalog, rawAlerts, institution] = await Promise.all([
      listPetCtEquipment(),
      listPetTests({ equipment_id: equipmentId }),
      listCtTests({ equipment_id: equipmentId }),
      listJointTests({ equipment_id: equipmentId }),
      listTestCatalog(),
      computePetCtAlerts(equipmentId),
      getInstitutionInfo(),
    ]);

    const equipment = allEquipment.find((e) => e.id === equipmentId);
    if (!equipment) {
      return NextResponse.json({ error: "Equipo PET/CT no encontrado." }, { status: 404 });
    }

    const alerts = withRecommendedActions(rawAlerts);

    // Build compliance rows
    const { rows: lastFinalizedRows } = await sql`
      SELECT equipment_id, test_code, MAX(performed_at) AS last_performed_at
      FROM (
        SELECT equipment_id, test_code, performed_at FROM qc_petct_pet_tests WHERE is_finalized = true AND equipment_id = ${equipmentId}
        UNION ALL
        SELECT equipment_id, test_code, performed_at FROM qc_petct_ct_tests WHERE is_finalized = true AND equipment_id = ${equipmentId}
        UNION ALL
        SELECT equipment_id, test_code, performed_at FROM qc_petct_joint_tests WHERE is_finalized = true AND equipment_id = ${equipmentId}
      ) t
      WHERE equipment_id IS NOT NULL
      GROUP BY equipment_id, test_code;
    `;

    const lastMap = new Map<string, string>();
    for (const row of lastFinalizedRows as Array<{ equipment_id: number; test_code: string; last_performed_at: string }>) {
      lastMap.set(row.test_code, row.last_performed_at);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    type ComplianceStatus = "overdue" | "upcoming" | "ok" | "sin_registro";
    type ComplianceRow = {
      test_code: string;
      test_name: string;
      modality: string;
      frequency_label: string;
      last_performed_at: string | null;
      next_due_date: string | null;
      days_until_due: number | null;
      status: ComplianceStatus;
    };

    const complianceRows: ComplianceRow[] = [];
    for (const entry of catalog) {
      if (!entry.implemented) continue;
      let best: { label: string; days: number } | null = null;
      for (const f of FREQUENCY_DAYS) {
        if ((entry as any)[f.flag]) {
          if (!best || f.days < best.days) best = { label: f.label, days: f.days };
        }
      }
      if (!best) continue;

      const lastPerformedAt = lastMap.get(entry.test_code) ?? null;
      if (!lastPerformedAt) {
        complianceRows.push({
          test_code: entry.test_code,
          test_name: entry.test_name,
          modality: entry.modality,
          frequency_label: best.label,
          last_performed_at: null,
          next_due_date: null,
          days_until_due: null,
          status: "sin_registro",
        });
        continue;
      }

      const nextDueDate = new Date(lastPerformedAt);
      nextDueDate.setDate(nextDueDate.getDate() + best.days);
      const diffDays = Math.round((nextDueDate.getTime() - today.getTime()) / 86400000);
      const warningWindow = Math.max(1, Math.round(best.days * 0.15));
      const status: ComplianceStatus = diffDays < 0 ? "overdue" : diffDays <= warningWindow ? "upcoming" : "ok";

      complianceRows.push({
        test_code: entry.test_code,
        test_name: entry.test_name,
        modality: entry.modality,
        frequency_label: best.label,
        last_performed_at: lastPerformedAt,
        next_due_date: nextDueDate.toISOString().slice(0, 10),
        days_until_due: diffDays,
        status,
      });
    }

    const statusOrder: Record<ComplianceStatus, number> = { overdue: 0, sin_registro: 1, upcoming: 2, ok: 3 };
    complianceRows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.test_code.localeCompare(b.test_code));

    const complianceSummary = {
      overdue: complianceRows.filter((r) => r.status === "overdue").length,
      upcoming: complianceRows.filter((r) => r.status === "upcoming").length,
      sin_registro: complianceRows.filter((r) => r.status === "sin_registro").length,
      ok: complianceRows.filter((r) => r.status === "ok").length,
    };

    // ── PDF generation ─────────────────────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CL", { dateStyle: "long" });
    const dateFile = now.toISOString().slice(0, 10);

    const { jsPDF } = await import("jspdf");
    // @ts-ignore
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297;

    const equipmentLabel = `${fmtStr(equipment.manufacturer)} ${fmtStr(equipment.model)}`.trim();
    const equipmentCode = equipment.internal_code ?? "s/código";

    // ── Helpers ──────────────────────────────────────────────────────────────

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
      doc.text("Informe de Control de Calidad — PET/CT", 14, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${equipmentLabel}  ·  Código: ${equipmentCode}`, 14, 17);
      doc.setFontSize(7);
      const oprLine = institution.opr_name ? `OPR: ${institution.opr_name}  ·  ` : "";
      const cchenLine = institution.cchen_code ? `CCHEN: ${institution.cchen_code}  ·  ` : "";
      doc.text(
        `${institution.name}  ·  ${oprLine}${cchenLine}IAEA HHS No. 1 · AAPM TG-108  ·  Generado: ${dateStr}`,
        14,
        23
      );
      doc.setTextColor(0, 0, 0);
    }

    function statusCell(statusStr: string, labelMap: Record<string, string>, colorMap: Record<string, [number, number, number]>): string {
      return labelMap[statusStr] ?? statusStr;
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
    y = sectionHeader(y, "1. FICHA TÉCNICA DEL EQUIPO PET/CT");

    const equipRows = [
      ["Fabricante", fmtStr(equipment.manufacturer), "Modelo", fmtStr(equipment.model)],
      ["N/S", fmtStr(equipment.serial_number), "Código interno", fmtStr(equipment.internal_code)],
      ["Institución", fmtStr(equipment.institution_name), "Detectores", fmtStr(equipment.num_detectors)],
      ["Tipo de detector", fmtStr(equipment.detector_type), "Material cristal", fmtStr(equipment.crystal_material)],
      ["Modo de adquisición", fmtStr(equipment.acquisition_mode), "TOF", yesNo(equipment.has_tof)],
      ["Resolución TOF (ps)", fmtStr(equipment.tof_timing_resolution_ps), "FOV axial (cm)", fmtStr(equipment.fov_axial_cm)],
      ["FOV transaxial (cm)", fmtStr(equipment.fov_transaxial_cm), "Nro. de anillos", fmtStr(equipment.num_rings)],
      ["CT N° de cortes", fmtStr(equipment.ct_num_slices), "CT tecnología", fmtStr(equipment.ct_technology)],
      ["SW nombre", fmtStr(equipment.software_name), "SW versión", fmtStr(equipment.software_version)],
      ["Fecha instalación", fmtDate(equipment.installation_date), "Fecha aceptación", fmtDate(equipment.acceptance_date)],
      ["Última calibración", fmtDate(equipment.last_calibration_date), "Último servicio", fmtDate(equipment.last_service_date)],
    ];

    autoTable(doc, {
      startY: y,
      body: equipRows,
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

    // ── 2. Panel de cumplimiento ───────────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `2. PANEL DE CUMPLIMIENTO DE FRECUENCIAS  —  Al día: ${complianceSummary.ok}  |  Próximas: ${complianceSummary.upcoming}  |  Vencidas: ${complianceSummary.overdue}  |  Sin registro: ${complianceSummary.sin_registro}`);

    if (complianceRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Código", "Prueba", "Modalidad", "Frecuencia", "Último realizado", "Próximo vencimiento", "Días restantes", "Estado"]],
        body: complianceRows.map((r) => [
          r.test_code,
          r.test_name,
          r.modality.toUpperCase(),
          r.frequency_label,
          fmtDate(r.last_performed_at),
          fmtDate(r.next_due_date),
          r.days_until_due !== null ? String(r.days_until_due) : "—",
          COMPLIANCE_STATUS_LABELS[r.status] ?? r.status,
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 62 },
          2: { cellWidth: 18 },
          3: { cellWidth: 20 },
          4: { cellWidth: 26 },
          5: { cellWidth: 26 },
          6: { cellWidth: 20, halign: "right" },
          7: { cellWidth: 22 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 7) {
            const row = complianceRows[data.row.index];
            if (row) {
              const col = COMPLIANCE_STATUS_COLORS[row.status];
              if (col) {
                data.cell.styles.textColor = col;
                data.cell.styles.fontStyle = "bold";
              }
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("No hay pruebas implementadas en el catálogo.", 16, y + 4);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    // ── 3. Resultados pruebas PET ─────────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `3. RESULTADOS — PRUEBAS PET  (${petTests.length} registros)`);

    if (petTests.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Código", "Fecha", "Operador", "Actividad (MBq)", "Phantom", "Estado", "Nivel de acción", "Revisor FM"]],
        body: petTests.map((t) => [
          t.test_code,
          fmtDate(t.performed_at),
          fmtStr(t.operator),
          fmtNum(t.activity_mbq, 1),
          fmtStr(t.phantom),
          STATUS_LABELS[t.status] ?? t.status,
          ACTION_LABELS[t.action_level] ?? t.action_level,
          fmtStr(t.physicist_reviewed_by),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 22 },
          2: { cellWidth: 36 },
          3: { cellWidth: 24, halign: "right" },
          4: { cellWidth: 28 },
          5: { cellWidth: 28 },
          6: { cellWidth: 26 },
          7: { cellWidth: 36 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body") {
            const test = petTests[data.row.index];
            if (!test) return;
            if (data.column.index === 5) {
              const col = STATUS_COLORS[test.status];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
            if (data.column.index === 6) {
              const col = ACTION_LEVEL_COLORS[test.action_level];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Sin registros de pruebas PET para este equipo.", 16, y + 4);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    // ── 4. Resultados pruebas CT ──────────────────────────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `4. RESULTADOS — PRUEBAS CT  (${ctTests.length} registros)`);

    if (ctTests.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Código", "Fecha", "Operador", "kVp", "mAs", "Phantom", "Estado", "Nivel de acción", "Revisor FM"]],
        body: ctTests.map((t) => [
          t.test_code,
          fmtDate(t.performed_at),
          fmtStr(t.operator),
          fmtStr((t.raw_inputs as any)?.kvp),
          fmtStr((t.raw_inputs as any)?.mas),
          fmtStr(t.phantom),
          STATUS_LABELS[t.status] ?? t.status,
          ACTION_LABELS[t.action_level] ?? t.action_level,
          fmtStr(t.physicist_reviewed_by),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 22 },
          2: { cellWidth: 34 },
          3: { cellWidth: 14, halign: "right" },
          4: { cellWidth: 14, halign: "right" },
          5: { cellWidth: 26 },
          6: { cellWidth: 28 },
          7: { cellWidth: 26 },
          8: { cellWidth: 34 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body") {
            const test = ctTests[data.row.index];
            if (!test) return;
            if (data.column.index === 6) {
              const col = STATUS_COLORS[test.status];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
            if (data.column.index === 7) {
              const col = ACTION_LEVEL_COLORS[test.action_level];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Sin registros de pruebas CT para este equipo.", 16, y + 4);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    // ── 5. Resultados pruebas de interacción PET/CT ───────────────────────────
    y = checkPageBreak(y, 155);
    y = sectionHeader(y, `5. RESULTADOS — PRUEBAS DE INTERACCIÓN PET/CT  (${jointTests.length} registros)`);

    if (jointTests.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Código", "Fecha", "Operador", "Phantom", "Protocolo", "Estado", "Nivel de acción", "Revisor FM"]],
        body: jointTests.map((t) => [
          t.test_code,
          fmtDate(t.performed_at),
          fmtStr(t.operator),
          fmtStr(t.phantom),
          fmtStr(t.protocol),
          STATUS_LABELS[t.status] ?? t.status,
          ACTION_LABELS[t.action_level] ?? t.action_level,
          fmtStr(t.physicist_reviewed_by),
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 22 },
          2: { cellWidth: 34 },
          3: { cellWidth: 26 },
          4: { cellWidth: 32 },
          5: { cellWidth: 28 },
          6: { cellWidth: 26 },
          7: { cellWidth: 34 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body") {
            const test = jointTests[data.row.index];
            if (!test) return;
            if (data.column.index === 5) {
              const col = STATUS_COLORS[test.status];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
            if (data.column.index === 6) {
              const col = ACTION_LEVEL_COLORS[test.action_level];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Sin registros de pruebas de interacción PET/CT para este equipo.", 16, y + 4);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    // ── 6. Alertas activas ────────────────────────────────────────────────────
    y = checkPageBreak(y, 155);
    const alertSummary = {
      alta: alerts.filter((a) => a.severity === "alta").length,
      media: alerts.filter((a) => a.severity === "media").length,
      baja: alerts.filter((a) => a.severity === "baja").length,
    };
    y = sectionHeader(y, `6. ALERTAS ACTIVAS  —  Alta: ${alertSummary.alta}  |  Media: ${alertSummary.media}  |  Baja: ${alertSummary.baja}`);

    if (alerts.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Severidad", "Código prueba", "Descripción", "Acción recomendada", "Tipo alerta"]],
        body: alerts.map((a) => [
          (a.severity === "alta" ? "Alta" : a.severity === "media" ? "Media" : "Baja"),
          fmtStr(a.test_code),
          fmtStr(a.description),
          fmtStr((a as any).recommended_action?.action ?? "—"),
          a.test_code ?? "—",
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: 255 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 26 },
          2: { cellWidth: 80 },
          3: { cellWidth: 100 },
          4: { cellWidth: 22 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 0) {
            const alert = alerts[data.row.index];
            if (alert) {
              const col = SEVERITY_COLORS[alert.severity];
              if (col) { data.cell.styles.textColor = col; data.cell.styles.fontStyle = "bold"; }
            }
          }
        },
        didDrawPage: () => { drawPageHeader(); },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(34, 139, 34);
      doc.setFont("helvetica", "bold");
      doc.text("Sin alertas activas para este equipo.", 16, y + 4);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      y += 10;
    }

    // ── Footer regulatorio ────────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.height;
      doc.setFillColor(240, 243, 248);
      doc.rect(0, pageHeight - 10, pageW, 10, "F");
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.text(
        "IAEA Human Health Series No. 1  ·  AAPM TG-108 (Madsen et al., 2006)  ·  DS 3/1985 MINSAL  ·  DS 133/1984 MINSAL",
        14,
        pageHeight - 5.5
      );
      doc.text(
        `Página ${i} de ${totalPages}  ·  Generado: ${dateStr}`,
        pageW - 14,
        pageHeight - 5.5,
        { align: "right" }
      );
    }

    // ── Render PDF ────────────────────────────────────────────────────────────
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    const equipmentSlug = `${fmtStr(equipment.manufacturer)}_${fmtStr(equipment.model)}_${equipmentCode}`
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 60);

    const filename = `qc_petct_${equipmentSlug}_${dateFile}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error en GET /api/quality-control/petct/export/pdf:", error);
    return NextResponse.json({ error: "Error al generar el informe PDF de QC PET/CT" }, { status: 500 });
  }
}
