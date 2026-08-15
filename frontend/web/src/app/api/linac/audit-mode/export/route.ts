import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureScienceTables } from "@/lib/linac-science";
import { ensureAlertsTables } from "@/lib/linac-alerts";
import { ensureLinacTables } from "@/lib/linac";
import { ensureRadiationExtendedTables } from "@/lib/linac-radiation";
import { ensureMaintenanceExtendedTables } from "@/lib/linac-maintenance";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Fase 6.13 (Tarea 49): MODO AUDITORIA
// ---------------------------------------------------------------------------
// Genera un reporte de auditoria consolidado del motor cientifico de
// Radioterapia (cumplimiento, desviaciones, QC, calibraciones/dosimetria/
// proteccion radiologica, mantenimiento, documentos, historial de criterios
// y referencias), exportable en PDF, Excel (XLSX) o CSV. Reutiliza unicamente
// datos ya existentes en tablas ya validadas (nunca inventa ni calcula
// nuevos criterios, incidentes y autorizaciones (linac_incidents,
// linac_authorizations, Fase 6 Tarea 42). Nunca inventa datos cuando
// campos como incidentes o autorizaciones no existen en las tablas.



async function gatherAuditData(linacId: number) {
  await ensureScienceTables();
  await ensureAlertsTables();
  await ensureLinacTables();
  await ensureRadiationExtendedTables();
  await ensureMaintenanceExtendedTables();

const { rows: criteriaRows } = await sql`
SELECT status, count(*)::int AS n FROM linac_technical_criteria
WHERE (${linacId} = 0 OR linac_id = ${linacId} OR linac_id IS NULL)
GROUP BY status;
`;
  const cumplimiento: Record<string, number> = { propuesto: 0, activo: 0, rechazado: 0, historico: 0 };
  criteriaRows.forEach((r: any) => { cumplimiento[r.status] = r.n; });

const { rows: desviaciones } = await sql`
SELECT id, parameter_name, module, measured_value, reference_value, deviation_pct, level, status, created_at
FROM linac_scientific_alerts
WHERE (${linacId} = 0 OR linac_id = ${linacId})
ORDER BY created_at DESC
LIMIT 300;
`;

const { rows: decisiones } = await sql`
SELECT decision, count(*)::int AS n FROM linac_deviation_decisions
WHERE (${linacId} = 0 OR linac_id = ${linacId})
GROUP BY decision;
`;

const { rows: qcPorEstado } = await sql`
SELECT status, count(*)::int AS n FROM linac_qc_tests
WHERE (${linacId} = 0 OR linac_id = ${linacId})
GROUP BY status;
`;
  const { rows: qcResumenRows } = await sql`
  SELECT count(*)::int AS total,
  count(*) FILTER (WHERE test_date > now() - interval '90 days')::int AS ultimos90dias
  FROM linac_qc_tests WHERE (${linacId} = 0 OR linac_id = ${linacId});
  `;

const { rows: proteccionRadiologica } = await sql`
SELECT category, semaphore, count(*)::int AS n FROM linac_radiation_protection
WHERE (${linacId} = 0 OR linac_id = ${linacId})
GROUP BY category, semaphore
ORDER BY category, semaphore;
`;

const { rows: mantenimiento } = await sql`
SELECT maintenance_type, status, count(*)::int AS n FROM linac_maintenance
WHERE (${linacId} = 0 OR linac_id = ${linacId})
GROUP BY maintenance_type, status
ORDER BY maintenance_type, status;
`;

const { rows: incidentesPorEstado } = await sql`SELECT status, count(*)::int AS n FROM linac_incidents WHERE (${linacId} = 0 OR linac_id = ${linacId}) GROUP BY status;`; const { rows: incidentesAbiertos } = await sql`SELECT id, event, incident_date, ines_level, dose, status FROM linac_incidents WHERE (${linacId} = 0 OR linac_id = ${linacId}) AND status = 'abierto' ORDER BY incident_date DESC LIMIT 100;`; const { rows: autorizaciones } = await sql`SELECT doc_type, document_number, expiry_date, is_current FROM linac_authorizations WHERE (${linacId} = 0 OR linac_id = ${linacId}) AND is_current = true ORDER BY doc_type;`; const { rows: rootRows } = await sql`
SELECT id FROM document_categories
WHERE upper(trim(name)) = 'MEDICINA NUCLEAR' AND parent_id IS NULL
LIMIT 1;
`;
  const documentos: Record<string, number> = { vigente: 0, proxima_revision: 0, requiere_revision: 0, obsoleto: 0, historico: 0 };
  if (rootRows[0]) {
    const rootId = rootRows[0].id;
    const { rows: docStatusRows } = await sql`
    WITH RECURSIVE subtree AS (
    SELECT id FROM document_categories WHERE id = ${rootId}
    UNION ALL
    SELECT c.id FROM document_categories c JOIN subtree s ON c.parent_id = s.id
    )
    SELECT doc_status, count(*)::int AS n FROM documents
    WHERE category_id IN (SELECT id FROM subtree)
    GROUP BY doc_status;
    `;
    docStatusRows.forEach((r: any) => { documentos[r.doc_status] = r.n; });
  }

const { rows: historialCriterios } = await sql`
SELECT a.id, a.action, a.actor, a.reason, a.created_at, c.parameter_name, c.module
FROM linac_criteria_audit a
LEFT JOIN linac_technical_criteria c ON c.id = a.criteria_id
WHERE (${linacId} = 0 OR c.linac_id = ${linacId} OR c.linac_id IS NULL)
ORDER BY a.created_at DESC
LIMIT 200;
`;

const { rows: referencias } = await sql`
SELECT DISTINCT source_name, source_level, document_version FROM linac_technical_criteria
WHERE status = 'activo' AND (${linacId} = 0 OR linac_id = ${linacId} OR linac_id IS NULL)
ORDER BY source_name;
`;

return {
  linacId: linacId || null,
  generadoEl: new Date().toISOString(),
  cumplimiento,
  desviaciones,
  decisiones,
  qc: { resumen: qcResumenRows[0] || { total: 0, ultimos90dias: 0 }, porEstado: qcPorEstado },
  proteccionRadiologica,
  mantenimiento,
  documentos,
  historialCriterios,
  referencias,
  incidentes: { porEstado: incidentesPorEstado, abiertos: incidentesAbiertos },
  autorizaciones,
};
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCsv(data: any): string {
  const lines: string[] = [];
  lines.push("MODO AUDITORIA - RPMS Radioterapia (Fase 6, Tarea 49)");
  lines.push("Generado el;" + csvEscape(data.generadoEl));
  lines.push("");
  lines.push("RESUMEN DE CUMPLIMIENTO (criterios tecnicos)");
  lines.push("Estado;Cantidad");
  Object.entries(data.cumplimiento).forEach(([k, v]) => lines.push(csvEscape(k) + ";" + csvEscape(v)));
  lines.push("");
  lines.push("CONTROL DE CALIDAD (QC)");
  lines.push("Total;" + csvEscape(data.qc.resumen.total));
  lines.push("Ultimos 90 dias;" + csvEscape(data.qc.resumen.ultimos90dias));
  lines.push("Estado;Cantidad");
  data.qc.porEstado.forEach((r: any) => lines.push(csvEscape(r.status) + ";" + csvEscape(r.n)));
  lines.push("");
  lines.push("PROTECCION RADIOLOGICA (incluye calibraciones y dosimetria ocupacional, por categoria y semaforo)");
  lines.push("Categoria;Semaforo;Cantidad");
  data.proteccionRadiologica.forEach((r: any) => lines.push(csvEscape(r.category) + ";" + csvEscape(r.semaphore) + ";" + csvEscape(r.n)));
  lines.push("");
  lines.push("MANTENIMIENTO (por tipo y estado)");
  lines.push("Tipo;Estado;Cantidad");
  data.mantenimiento.forEach((r: any) => lines.push(csvEscape(r.maintenance_type) + ";" + csvEscape(r.status) + ";" + csvEscape(r.n)));
  lines.push("");
  lines.push("DOCUMENTOS (Medicina Nuclear, por estado de vigencia)");
  lines.push("Estado;Cantidad");
  Object.entries(data.documentos).forEach(([k, v]) => lines.push(csvEscape(k) + ";" + csvEscape(v)));
  lines.push("");
  lines.push("DESVIACIONES (alertas cientificas)");
  lines.push("Fecha;Parametro;Modulo;Medido;Referencia;Desviacion;Nivel;Estado");
  data.desviaciones.forEach((r: any) => lines.push([r.created_at, r.parameter_name, r.module, r.measured_value, r.reference_value, r.deviation_pct, r.level, r.status].map(csvEscape).join(";")));
  lines.push("");
  lines.push("REGISTROS / HISTORIAL DE CAMBIOS DE CRITERIOS");
  lines.push("Fecha;Accion;Actor;Parametro;Modulo;Motivo");
  data.historialCriterios.forEach((r: any) => lines.push([r.created_at, r.action, r.actor, r.parameter_name, r.module, r.reason].map(csvEscape).join(";")));
  lines.push("");
  lines.push("REFERENCIAS (fuentes de criterios activos)");
  lines.push("Fuente;Nivel de jerarquia;Version de documento");
  data.referencias.forEach((r: any) => lines.push([r.source_name, r.source_level, r.document_version].map(csvEscape).join(";")));
  lines.push("");
  lines.push("INCIDENTES (linac_incidents, por estado)"); lines.push("Estado;Cantidad"); data.incidentes.porEstado.forEach((r: any) => lines.push(csvEscape(r.status) + ";" + csvEscape(r.n))); lines.push(""); lines.push("Incidentes abiertos"); lines.push("Fecha;Evento;Nivel INES;Dosis;Estado"); data.incidentes.abiertos.forEach((r: any) => lines.push([r.incident_date, r.event, r.ines_level, r.dose, r.status].map(csvEscape).join(";")));
  lines.push(""); lines.push("AUTORIZACIONES (linac_authorizations, version vigente)"); lines.push("Tipo de documento;N documento;Vencimiento"); data.autorizaciones.forEach((r: any) => lines.push([r.doc_type, r.document_number, r.expiry_date].map(csvEscape).join(";")));
  return "\uFEFF" + lines.join("\n");
}

async function buildXlsx(data: any): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([["Estado", "Cantidad"], ...Object.entries(data.cumplimiento)]),
  "Cumplimiento"
  );

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(
    data.desviaciones.map((r: any) => ({
      Fecha: r.created_at, Parametro: r.parameter_name, Modulo: r.module,
      Medido: r.measured_value, Referencia: r.reference_value,
      Desviacion: r.deviation_pct, Nivel: r.level, Estado: r.status,
    }))
    ),
  "Desviaciones"
  );

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ["Total", data.qc.resumen.total],
    ["Ultimos 90 dias", data.qc.resumen.ultimos90dias],
    [],
    ["Estado", "Cantidad"],
    ...data.qc.porEstado.map((r: any) => [r.status, r.n]),
    ]),
  "QC"
  );

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(data.proteccionRadiologica.map((r: any) => ({ Categoria: r.category, Semaforo: r.semaphore, Cantidad: r.n }))),
  "Proteccion Radiologica"
  );

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(data.mantenimiento.map((r: any) => ({ Tipo: r.maintenance_type, Estado: r.status, Cantidad: r.n }))),
  "Mantenimiento"
  );

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([["Estado", "Cantidad"], ...Object.entries(data.documentos)]),
  "Documentos"
  );

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(
    data.historialCriterios.map((r: any) => ({
      Fecha: r.created_at, Accion: r.action, Actor: r.actor, Parametro: r.parameter_name, Modulo: r.module, Motivo: r.reason,
    }))
    ),
  "Historial Criterios"
  );

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(data.referencias.map((r: any) => ({ Fuente: r.source_name, Nivel: r.source_level, Version: r.document_version }))),
  "Referencias"
  );

XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(data.incidentes.porEstado.map((r: any) => ({ Estado: r.status, Cantidad: r.n }))),
  "Incidentes"); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.incidentes.abiertos.map((r: any) => ({ Fecha: r.incident_date, Evento: r.event, NivelINES: r.ines_level, Dosis: r.dose, Estado: r.status }))), "Incidentes Abiertos"); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.autorizaciones.map((r: any) => ({ Tipo: r.doc_type, Numero: r.document_number, Vencimiento: r.expiry_date }))), "Autorizaciones"
  );

return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function buildPdf(data: any): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" }) as unknown as {
    text: (t: string, x: number, y: number) => void;
    setFontSize: (n: number) => void;
    setFont: (font: string, style?: string) => void;
    autoTable: (opts: Record<string, unknown>) => void;
    addPage: () => void;
    output: (type: string) => ArrayBuffer;
    lastAutoTable?: { finalY: number };
  };

let y = 40;
  function title(text: string) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(text, 40, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  }
  function afterTable() {
    y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 24;
    if (y > 500) { doc.addPage(); y = 40; }
  }

doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MODO AUDITORIA - RPMS RADIOTERAPIA (Fase 6, Tarea 49)", 40, y);
  y += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Generado el: " + new Date(data.generadoEl).toLocaleString("es-CL"), 40, y);
  y += 20;

title("1. RESUMEN DE CUMPLIMIENTO (criterios tecnicos)");
  doc.autoTable({
    head: [["Estado", "Cantidad"]],
    body: Object.entries(data.cumplimiento).map(([k, v]) => [k, String(v)]),
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();

title("2. DESVIACIONES (alertas cientificas)");
  doc.autoTable({
    head: [["Fecha", "Parametro", "Modulo", "Medido", "Referencia", "Desviacion", "Nivel", "Estado"]],
    body: data.desviaciones.slice(0, 100).map((r: any) => [
      r.created_at ? new Date(r.created_at).toLocaleString("es-CL") : "-",
      r.parameter_name ?? "-", r.module ?? "-", r.measured_value ?? "-", r.reference_value ?? "-",
      r.deviation_pct !== null && r.deviation_pct !== undefined ? Number(r.deviation_pct).toFixed(2) + "%" : "-",
      r.level ?? "-", r.status ?? "-",
      ]),
    startY: y,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();

title("3. CONTROL DE CALIDAD (QC)");
  doc.autoTable({
    head: [["Total", "Ultimos 90 dias"]],
    body: [[String(data.qc.resumen.total), String(data.qc.resumen.ultimos90dias)]],
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();
  doc.autoTable({
    head: [["Estado QC", "Cantidad"]],
    body: data.qc.porEstado.map((r: any) => [r.status, String(r.n)]),
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();

title("4. PROTECCION RADIOLOGICA (incluye calibraciones y dosimetria ocupacional)");
  doc.autoTable({
    head: [["Categoria", "Semaforo", "Cantidad"]],
    body: data.proteccionRadiologica.map((r: any) => [r.category, r.semaphore ?? "-", String(r.n)]),
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();

title("5. MANTENIMIENTO");
  doc.autoTable({
    head: [["Tipo", "Estado", "Cantidad"]],
    body: data.mantenimiento.map((r: any) => [r.maintenance_type, r.status, String(r.n)]),
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();

title("6. DOCUMENTOS (Medicina Nuclear, por estado de vigencia)");
  doc.autoTable({
    head: [["Estado", "Cantidad"]],
    body: Object.entries(data.documentos).map(([k, v]) => [k, String(v)]),
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();

title("7. REGISTROS / HISTORIAL DE CAMBIOS DE CRITERIOS");
  doc.autoTable({
    head: [["Fecha", "Accion", "Actor", "Parametro", "Modulo", "Motivo"]],
    body: data.historialCriterios.slice(0, 80).map((r: any) => [
      r.created_at ? new Date(r.created_at).toLocaleString("es-CL") : "-",
      r.action ?? "-", r.actor ?? "-", r.parameter_name ?? "-", r.module ?? "-", r.reason ?? "-",
      ]),
    startY: y,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();

title("8. REFERENCIAS (fuentes de criterios activos)");
  doc.autoTable({
    head: [["Fuente", "Nivel de jerarquia", "Version de documento"]],
    body: data.referencias.map((r: any) => [r.source_name ?? "-", r.source_level ?? "-", r.document_version ?? "-"]),
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  afterTable();

title("9. INCIDENTES Y AUTORIZACIONES");
  doc.autoTable({
    head: [["Modulo", "Estado"]],
    body: [].concat(data.incidentes.porEstado.map((r: any) => ["Incidente: " + r.status, String(r.n)])).concat(data.autorizaciones.map((r: any) => ["Autorizacion: " + (r.doc_type || "-"), (r.expiry_date ? "Vence " + String(r.expiry_date).slice(0,10) : "-")])),
    startY: y,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });

const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const linacId = Number(searchParams.get("linacId") || 0);
  const format = (searchParams.get("format") || "pdf").toLowerCase();

const data = await gatherAuditData(linacId);
  const stamp = new Date().toISOString().slice(0, 10);
  const filenameBase = "modo-auditoria-radioterapia-" + stamp;

if (format === "csv") {
  const csv = buildCsv(data);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + filenameBase + '.csv"',
    },
  });
}

if (format === "xlsx" || format === "excel") {
  const buffer = await buildXlsx(data);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="' + filenameBase + '.xlsx"',
    },
  });
}

if (format === "pdf") {
  const buffer = await buildPdf(data);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="' + filenameBase + '.pdf"',
    },
  });
}

return NextResponse.json({ error: "Formato no soportado. Use pdf, xlsx o csv." }, { status: 400 });
}
