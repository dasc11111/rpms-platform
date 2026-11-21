import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * MODULO 4 - PET/CT - FASE P
 * Generador de informe PDF (seccion 31 del prompt de mejora). Consolida en
 * un unico documento imprimible: la ficha tecnica del equipo (Fase A), el
 * cumplimiento de frecuencias (Fase H), los resultados ya calculados de
 * las pruebas PET (Fase B/L), CT (Fase C) e interaccion PET/CT (Fase D/G),
 * y las alertas activas con su accion recomendada (Fase M/N). El informe
 * solo consolida y da formato a datos ya calculados por el motor
 * (qc-petct-calc.ts) y por el motor de alertas/decision
 * (qc-petct-alerts.ts / qc-petct-decision.ts); no recalcula ni reclasifica
 * ningun resultado (seccion 3 del prompt maestro: el motor de calculo es
 * la unica fuente de clasificacion, nunca el operador). Se genera en el
 * navegador con jsPDF (dependencia ya declarada en package.json); no
 * requiere backend adicional.
 */

type EquipmentInfo = {
  institution_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  has_tof: boolean;
  software_name: string | null;
  software_version: string | null;
};

type GenericTestRow = {
  test_code: string;
  status: string;
  action_level: string;
  calculated: Record<string, any>;
  operator?: string | null;
  test_date?: string | null;
  created_at?: string | null;
};

type RecommendedAction = { urgency: string; action: string };

type AlertRow = {
  severity: string;
  type: string;
  test_name: string;
  title: string;
  description: string;
  recommended_action?: RecommendedAction;
};

export interface PetCtReportInput {
  equipment: EquipmentInfo;
  generatedAt: string;
  complianceSummary?: { overdue: number; upcoming: number; sin_registro: number; ok: number } | null;
  petTests: GenericTestRow[];
  ctTests: GenericTestRow[];
  jointTests: GenericTestRow[];
  alerts: AlertRow[];
}

const STATUS_LABELS: Record<string, string> = {
  cumple: "Cumple",
  no_cumple: "No cumple",
  requiere_revision: "Requiere revision",
  no_aplica: "No aplica",
  pendiente_revision: "Pendiente de revision",
};

function fmtCalculated(calculated: Record<string, any>): string {
  return Object.entries(calculated ?? {})
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${k}: ${typeof v === "number" ? Number(v).toFixed(2) : v}`)
    .join("; ");
}

function equipmentLabel(eq: EquipmentInfo): string {
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/codigo"})`;
}

function testDate(r: GenericTestRow): string {
  const iso = r.test_date ?? r.created_at ?? null;
  return iso ? new Date(iso).toLocaleDateString() : "s/d";
}

export function generatePetCtReportPdf(input: PetCtReportInput): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  let y = 50;

  doc.setFontSize(16);
  doc.text("Informe de Control de Calidad PET/CT", marginX, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Modulo 4 - Fase P (seccion 31 del prompt de mejora). Generado: ${new Date(input.generatedAt).toLocaleString()}`, marginX, y);
  y += 20;

  doc.setFontSize(12);
  doc.text("Ficha del equipo", marginX, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 9 },
    head: [["Institucion", "Equipo", "N/S", "TOF", "Software"]],
    body: [[
      input.equipment.institution_name ?? "s/d",
      equipmentLabel(input.equipment),
      input.equipment.serial_number ?? "s/d",
      input.equipment.has_tof ? "Si" : "No",
      `${input.equipment.software_name ?? "s/d"} ${input.equipment.software_version ?? ""}`.trim(),
    ]],
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  if (input.complianceSummary) {
    doc.setFontSize(12);
    doc.text("Resumen de cumplimiento (frecuencias)", marginX, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 9 },
      head: [["Vencidas", "Proximas a vencer", "Sin registro", "Al dia"]],
      body: [[
        String(input.complianceSummary.overdue),
        String(input.complianceSummary.upcoming),
        String(input.complianceSummary.sin_registro),
        String(input.complianceSummary.ok),
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  function testSection(title: string, rows: GenericTestRow[]) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(12);
    doc.text(title, marginX, y);
    y += 6;
    if (!rows.length) {
      doc.setFontSize(9);
      doc.text("Sin registros para este equipo.", marginX, y + 10);
      y += 26;
      return;
    }
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8 },
      columnStyles: { 3: { cellWidth: 220 } },
      head: [["Prueba", "Estado", "Nivel de accion", "Resultado calculado", "Fecha"]],
      body: rows.map((r) => [
        r.test_code,
        STATUS_LABELS[r.status] ?? r.status,
        r.action_level,
        fmtCalculated(r.calculated),
        testDate(r),
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  testSection("Pruebas PET (PET-01 a PET-06, PET-ESTAB, PET-CONC, PET-SUV-CAL, PET-UNIF)", input.petTests);
  testSection("Pruebas CT (CT-01 a CT-14)", input.ctTests);
  testSection("Interaccion PET/CT (PETCT-01, PETCT-02, PET-CLINICO, PET-QI-RUTINA)", input.jointTests);

  if (y > 680) {
    doc.addPage();
    y = 50;
  }
  doc.setFontSize(12);
  doc.text("Alertas activas y accion recomendada", marginX, y);
  y += 6;
  if (!input.alerts.length) {
    doc.setFontSize(9);
    doc.text("No hay alertas activas para este equipo.", marginX, y + 10);
    y += 26;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8 },
      head: [["Severidad", "Prueba", "Alerta", "Urgencia", "Accion recomendada"]],
      body: input.alerts.map((a) => [
        a.severity,
        a.test_name,
        a.title,
        a.recommended_action?.urgency ?? "s/d",
        a.recommended_action?.action ?? "s/d",
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Pagina ${i} de ${pageCount} - Documento generado automaticamente por RPMS (Modulo 4 PET/CT). No reemplaza la firma y revision del Fisico Medico responsable.`,
      marginX,
      820
    );
  }

  return doc;
}
