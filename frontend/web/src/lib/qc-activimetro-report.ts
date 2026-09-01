import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * MODULO ACTIVIMETRO
 * Generador de informe PDF (seccion 31 del prompt maestro). Consolida en
 * un unico documento imprimible: la ficha tecnica del equipo (Fase A), los
 * avisos de vencimiento y retraso segun la frecuencia configurada
 * (qc_activimetro_tolerances), los resultados ya registrados de las
 * pruebas de control de calidad (ACTIV-02 a ACTIV-07), la inspeccion
 * fisica y funcional (ACTIV-01), los eventos de servicio tecnico y la
 * evidencia documental asociada. El informe solo consolida y da formato
 * a datos ya registrados/calculados por los modulos existentes; no
 * recalcula ni reclasifica ningun resultado (seccion 3 del prompt
 * maestro: el motor de calculo es la unica fuente de clasificacion,
 * nunca el operador). Se genera en el navegador con jsPDF (dependencia
 * ya declarada en package.json); no requiere backend adicional.
 */

type EquipmentInfo = {
  id: number;
  institution_name: string | null;
  service_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  internal_code: string | null;
  chamber_type: string | null;
  detector_type: string | null;
  software_name: string | null;
  software_version: string | null;
  instrument_id: number | null;
};

type TestRow = {
  test_type: string;
  test_date: string | null;
  result_status: string | null;
  mean_value?: number | string | null;
  cv_percent?: number | string | null;
  percent_difference?: number | string | null;
  reference_value?: number | string | null;
  corrected_activity?: number | string | null;
  performed_by?: string | null;
  created_at?: string | null;
};

type InspectionRow = {
  inspection_date: string | null;
  overall_result: string | null;
  performed_by?: string | null;
  observaciones?: string | null;
};

type ServiceEventRow = {
  service_type: string;
  service_date: string | null;
  status: string;
  technician?: string | null;
  company?: string | null;
  description?: string | null;
};

type EvidenceRow = {
  evidence_type: string | null;
  file_name: string | null;
  description?: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
};

type DueAlertRow = {
  testType: string;
  status: "overdue" | "upcoming" | "sin_registro";
  frequencyDays: number;
  lastTestDate: string | null;
  nextDueDate?: string | null;
  daysUntilDue?: number | null;
};

export interface ActivimetroReportInput {
  equipment: EquipmentInfo;
  generatedAt: string;
  tests: TestRow[];
  inspections: InspectionRow[];
  serviceEvents: ServiceEventRow[];
  evidence: EvidenceRow[];
  dueAlerts: DueAlertRow[];
}

const RESULT_LABELS: Record<string, string> = {
  cumple: "Cumple",
  advertencia: "Advertencia",
  no_cumple: "No cumple",
  pendiente_revision: "Pendiente de revision",
  requiere_revision: "Requiere revision",
  no_aplica: "No aplica",
};

const DUE_STATUS_LABELS: Record<string, string> = {
  overdue: "Retrasada",
  upcoming: "Proxima a vencer",
  sin_registro: "Sin registro",
};

const SERVICE_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completado: "Completado",
};

function equipmentLabel(eq: EquipmentInfo): string {
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/codigo"})`;
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString() : "s/d";
}

function fmtTestCalculated(r: TestRow): string {
  const parts: string[] = [];
  const mean = num(r.mean_value);
  if (mean !== null) parts.push(`media: ${mean.toFixed(3)}`);
  const cv = num(r.cv_percent);
  if (cv !== null) parts.push(`CV%: ${cv.toFixed(2)}`);
  const diff = num(r.percent_difference);
  if (diff !== null) parts.push(`dif%: ${diff.toFixed(2)}`);
  const ref = num(r.reference_value);
  if (ref !== null) parts.push(`ref: ${ref.toFixed(3)}`);
  const corr = num(r.corrected_activity);
  if (corr !== null) parts.push(`act. corregida: ${corr.toFixed(3)}`);
  return parts.length ? parts.join("; ") : "s/d";
}

export function generateActivimetroReportPdf(input: ActivimetroReportInput): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  let y = 50;

  doc.setFontSize(16);
  doc.text("Informe de Control de Calidad - Activimetro", marginX, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date(input.generatedAt).toLocaleString()}`, marginX, y);
  y += 20;

  doc.setFontSize(12);
  doc.text("Ficha del equipo", marginX, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 9 },
    head: [["Institucion", "Equipo", "N/S", "Camara/Detector", "Software"]],
    body: [[
      input.equipment.institution_name ?? "s/d",
      equipmentLabel(input.equipment),
      input.equipment.serial_number ?? "s/d",
      input.equipment.chamber_type ?? input.equipment.detector_type ?? "s/d",
      `${input.equipment.software_name ?? "s/d"} ${input.equipment.software_version ?? ""}`.trim(),
    ]],
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  doc.setFontSize(12);
  doc.text("Avisos de vencimiento y retraso", marginX, y);
  y += 6;
  if (!input.dueAlerts.length) {
    doc.setFontSize(9);
    doc.text("Sin avisos pendientes para este equipo.", marginX, y + 10);
    y += 26;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8 },
      head: [["Prueba", "Estado", "Frecuencia (dias)", "Ultima prueba", "Proximo vencimiento"]],
      body: input.dueAlerts.map((a) => [
        a.testType,
        DUE_STATUS_LABELS[a.status] ?? a.status,
        String(a.frequencyDays),
        fmtDate(a.lastTestDate),
        a.nextDueDate ? fmtDate(a.nextDueDate) : "s/d",
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  function section(title: string, head: string[], rows: string[][], emptyMsg: string) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(12);
    doc.text(title, marginX, y);
    y += 6;
    if (!rows.length) {
      doc.setFontSize(9);
      doc.text(emptyMsg, marginX, y + 10);
      y += 26;
      return;
    }
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8 },
      head: [head],
      body: rows,
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  section(
    "Pruebas de control de calidad (ACTIV-02 a ACTIV-07)",
    ["Tipo de prueba", "Fecha", "Estado", "Resultado calculado", "Realizado por"],
    input.tests.map((t) => [
      t.test_type,
      fmtDate(t.test_date ?? t.created_at),
      RESULT_LABELS[t.result_status ?? ""] ?? t.result_status ?? "s/d",
      fmtTestCalculated(t),
      t.performed_by ?? "s/d",
    ]),
    "Sin pruebas registradas para este equipo."
  );

  section(
    "Inspeccion fisica y funcional (ACTIV-01)",
    ["Fecha", "Resultado", "Realizado por", "Observaciones"],
    input.inspections.map((i) => [
      fmtDate(i.inspection_date),
      RESULT_LABELS[i.overall_result ?? ""] ?? i.overall_result ?? "s/d",
      i.performed_by ?? "s/d",
      i.observaciones ?? "s/d",
    ]),
    "Sin inspecciones registradas para este equipo."
  );

  section(
    "Eventos de servicio tecnico",
    ["Tipo", "Fecha", "Estado", "Tecnico / Empresa", "Descripcion"],
    input.serviceEvents.map((e) => [
      e.service_type,
      fmtDate(e.service_date),
      SERVICE_STATUS_LABELS[e.status] ?? e.status,
      [e.technician, e.company].filter(Boolean).join(" / ") || "s/d",
      e.description ?? "s/d",
    ]),
    "Sin eventos de servicio registrados para este equipo."
  );

  section(
    "Evidencia documental",
    ["Tipo", "Archivo", "Descripcion", "Subido por", "Fecha"],
    input.evidence.map((ev) => [
      ev.evidence_type ?? "s/d",
      ev.file_name ?? "s/d",
      ev.description ?? "s/d",
      ev.uploaded_by ?? "s/d",
      fmtDate(ev.uploaded_at),
    ]),
    "Sin evidencia registrada para este equipo."
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Pagina ${i} de ${pageCount} - Documento generado automaticamente por RPMS (Modulo Activimetro). No reemplaza la firma y revision del Fisico Medico responsable.`,
      marginX,
      820
    );
  }

  return doc;
}
