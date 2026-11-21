import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables } from "@/lib/radioterapia";
import { getInstitutionInfo } from "@/lib/institution-settings";

export const dynamic = "force-dynamic";

const ML = 14, MR = 14, CW = 269;
const PAGE_H = 210;
const HDR_DARK: [number, number, number] = [15, 60, 110];
const HDR_MED: [number, number, number] = [30, 80, 140];
const HDR_LIGHT: [number, number, number] = [220, 235, 250];

function slug(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}
function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("es-CL");
}
function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v).trim() || "—";
}

const SEVERITY_LABEL: Record<string, string> = {
  menor: "Menor", moderado: "Moderado", grave: "Grave",
};
const STATUS_LABEL: Record<string, string> = {
  abierto: "Abierto", en_investigacion: "En investigación", cerrado: "Cerrado",
  abierta: "Abierta", en_proceso: "En proceso", completada: "Completada",
  vigente: "Vigente", vencido: "Vencido", operativo: "Operativo", falla: "Falla",
  activo: "Activo", inactivo: "Inactivo",
};
const AUDIT_TYPE_LABEL: Record<string, string> = {
  interna: "Interna", externa: "Externa", seremi: "SEREMI", cchen: "CCHEN", iaea: "IAEA",
};
const DEVICE_TYPE_LABEL: Record<string, string> = {
  interlock: "Interlock", alarma: "Alarma", puerta: "Puerta blindada",
  monitor_area: "Monitor de área",
};

export async function GET(request: Request) {
  await ensureRadioterapiaTables();

  const { searchParams } = new URL(request.url);
  const facilityIdParam = searchParams.get("facility_id");

  // Resolve facility
  let facility: Record<string, unknown> | null = null;
  if (facilityIdParam) {
    const { rows } = await sql`SELECT * FROM rt_facilities WHERE id = ${Number(facilityIdParam)} LIMIT 1`;
    facility = (rows[0] as Record<string, unknown>) ?? null;
  }
  if (!facility) {
    const { rows } = await sql`SELECT * FROM rt_facilities ORDER BY id ASC LIMIT 1`;
    facility = (rows[0] as Record<string, unknown>) ?? null;
  }
  if (!facility) {
    return new NextResponse("No hay instalaciones de radioterapia registradas.", { status: 404 });
  }

  const facilityId = facility.id as number;
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Load all data in parallel
  const [
    bunkerRows,
    safetyDeviceRows,
    deviceCheckRows,
    surveyRows,
    incidentRows,
    auditRows,
    auditFindingRows,
    trainingRows,
    actionRows,
    riskRows,
    institution,
  ] = await Promise.all([
    sql`SELECT * FROM rt_bunkers WHERE facility_id = ${facilityId} ORDER BY id ASC`,
    sql`SELECT sd.*, rb.name AS bunker_name FROM rt_safety_devices sd
        LEFT JOIN rt_bunkers rb ON rb.id = sd.bunker_id
        WHERE rb.facility_id = ${facilityId} ORDER BY sd.id ASC`,
    sql`SELECT sdc.*, sd.name AS device_name, rb.name AS bunker_name
        FROM rt_safety_device_checks sdc
        LEFT JOIN rt_safety_devices sd ON sd.id = sdc.device_id
        LEFT JOIN rt_bunkers rb ON rb.id = sd.bunker_id
        WHERE rb.facility_id = ${facilityId} ORDER BY sdc.check_date DESC LIMIT 30`,
    sql`SELECT rs.*, rb.name AS bunker_name FROM rt_radiation_surveys rs
        LEFT JOIN rt_bunkers rb ON rb.id = rs.bunker_id
        WHERE rb.facility_id = ${facilityId} ORDER BY rs.survey_date DESC LIMIT 30`,
    sql`SELECT * FROM rt_incidents WHERE facility_id = ${facilityId} ORDER BY incident_date DESC LIMIT 20`,
    sql`SELECT * FROM rt_audits WHERE facility_id = ${facilityId} ORDER BY audit_date DESC LIMIT 15`,
    sql`SELECT af.*, ra.audit_date FROM rt_audit_findings af
        LEFT JOIN rt_audits ra ON ra.id = af.audit_id
        WHERE ra.facility_id = ${facilityId} ORDER BY af.id DESC LIMIT 30`,
    sql`SELECT * FROM rt_trainings WHERE facility_id = ${facilityId} ORDER BY expiry_date ASC LIMIT 30`,
    sql`SELECT * FROM rt_actions WHERE facility_id = ${facilityId} ORDER BY due_date ASC LIMIT 20`,
    sql`SELECT * FROM rt_risks WHERE facility_id = ${facilityId} ORDER BY risk_score DESC NULLS LAST LIMIT 15`,
    getInstitutionInfo(),
  ]);

  // Statistics
  const incidents = incidentRows.rows as Record<string, unknown>[];
  const openIncidents = incidents.filter((i) => i.status === "abierto" || i.status === "en_investigacion").length;
  const gravIncidents = incidents.filter((i) => i.severity === "grave").length;
  const nearMissCount = incidents.filter((i) => i.is_near_miss).length;

  const actions = actionRows.rows as Record<string, unknown>[];
  const openActions = actions.filter((a) => a.status !== "completada" && a.status !== "cerrada").length;
  const overdueActions = actions.filter((a) => {
    if (!a.due_date || a.status === "completada") return false;
    return new Date(a.due_date as string) < now;
  }).length;

  const trainings = trainingRows.rows as Record<string, unknown>[];
  const expiredTrainings = trainings.filter((t) => {
    if (!t.expiry_date) return false;
    return new Date(t.expiry_date as string) < now;
  }).length;
  const soonTrainings = trainings.filter((t) => {
    if (!t.expiry_date) return false;
    const d = new Date(t.expiry_date as string);
    const days = (d.getTime() - now.getTime()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;

  // Build PDF
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  function drawPageHeader(title: string) {
    doc.setFillColor(...HDR_DARK);
    doc.rect(0, 0, 297, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, ML, 7.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`${institution.name} | Instalación: ${safeStr(facility!.name)}`, ML, 13);
    doc.text(`Fecha: ${dateStr}`, 297 - MR, 13, { align: "right" });
    doc.setFillColor(...HDR_LIGHT);
    doc.rect(0, 18, 297, 6, "F");
    doc.setTextColor(30, 30, 70);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text("ARPANSA RPS 14.3 · IAEA TRS-430 · TG-142 · DS 133/1984 MINSAL · DS 3/1985 MINSAL", ML, 22);
    if (institution.opr_name) doc.text(`OPR: ${institution.opr_name}`, 297 - MR, 22, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  }

  function drawFooter(pageNum: number, totalPages: number) {
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text(`Pág. ${pageNum} / ${totalPages}`, 297 / 2, PAGE_H - 4, { align: "center" });
    doc.text("RPMS Platform — Radioterapia (SIGR)", ML, PAGE_H - 4);
    doc.text(`CCHEN: ${institution.cchen_code || "—"}`, 297 - MR, PAGE_H - 4, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  function sectionHeader(y: number, title: string): number {
    doc.setFillColor(...HDR_MED);
    doc.rect(ML, y, CW, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(title, ML + 2, y + 4.2);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    return y + 8;
  }

  function checkPageBreak(y: number, threshold: number, newTitle?: string): number {
    if (y + threshold > PAGE_H - 12) {
      doc.addPage();
      drawPageHeader(newTitle ?? "Informe Técnico Radioterapia (SIGR)");
      return 28;
    }
    return y;
  }

  // ─── PAGE 1: Ficha + Bunkers + Dispositivos ───
  drawPageHeader("Informe de Protección Radiológica — Servicio de Radioterapia (SIGR)");
  let y = 28;

  // KPI summary row
  const kpis: [string, string, [number, number, number]][] = [
    ["Incidentes abiertos", String(openIncidents), openIncidents > 0 ? [180, 30, 30] : [20, 120, 20]],
    ["Graves", String(gravIncidents), gravIncidents > 0 ? [180, 30, 30] : [20, 120, 20]],
    ["Near miss", String(nearMissCount), nearMissCount > 0 ? [180, 80, 0] : [20, 120, 20]],
    ["Acciones vencidas", String(overdueActions), overdueActions > 0 ? [180, 30, 30] : [20, 120, 20]],
    ["Capacitaciones vencidas", String(expiredTrainings), expiredTrainings > 0 ? [180, 30, 30] : [20, 120, 20]],
    ["Capacitaciones próx. 30d", String(soonTrainings), soonTrainings > 0 ? [180, 100, 0] : [100, 100, 100]],
  ];

  const kpiW = CW / kpis.length - 1;
  for (let i = 0; i < kpis.length; i++) {
    const x = ML + i * (kpiW + 1.2);
    doc.setFillColor(...HDR_LIGHT);
    doc.rect(x, y, kpiW, 12, "F");
    doc.setFontSize(6);
    doc.setTextColor(60, 80, 120);
    doc.text(kpis[i][0], x + 2, y + 4);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...kpis[i][2]);
    doc.text(kpis[i][1], x + 2, y + 10);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  }
  y += 16;

  y = sectionHeader(y, "1. Datos de la Instalación");
  const fichaFields: [string, string][] = [
    ["Nombre", safeStr(facility.name)],
    ["Dirección", safeStr(facility.address)],
    ["Responsable QA", safeStr(facility.responsible_qa)],
    ["Estado", STATUS_LABEL[facility.status as string] ?? safeStr(facility.status)],
    ["Descripción", safeStr(facility.description)],
    ["Bunkers registrados", String(bunkerRows.rows.length)],
  ];

  const colW2 = CW / 2 - 2;
  const col1 = fichaFields.slice(0, 3);
  const col2 = fichaFields.slice(3);
  let y1 = y, y2 = y;
  for (const [lbl, val] of col1) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 120);
    doc.text(lbl, ML + 2, y1 + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(val, ML + 45, y1 + 3.5);
    doc.setDrawColor(200, 210, 225);
    doc.line(ML, y1 + 5, ML + colW2, y1 + 5);
    y1 += 5;
  }
  for (const [lbl, val] of col2) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 120);
    doc.text(lbl, ML + colW2 + 4, y2 + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(val, ML + colW2 + 50, y2 + 3.5);
    doc.setDrawColor(200, 210, 225);
    doc.line(ML + colW2 + 2, y2 + 5, ML + CW, y2 + 5);
    y2 += 5;
  }
  y = Math.max(y1, y2) + 4;

  // Bunkers
  y = checkPageBreak(y, 25, "Informe Radioterapia — Bunkers");
  y = sectionHeader(y, "2. Bunkers y Blindaje");

  if (bunkerRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Nombre", "Referencia de diseño", "Estado", "LINAC asociado"]],
      body: (bunkerRows.rows as Record<string, unknown>[]).map((b) => [
        safeStr(b.name),
        safeStr(b.design_reference),
        STATUS_LABEL[b.status as string] ?? safeStr(b.status),
        b.linac_id ? `ID ${b.linac_id}` : "—",
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin bunkers registrados.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // Safety devices
  y = checkPageBreak(y, 25, "Informe Radioterapia — Dispositivos de Seguridad");
  y = sectionHeader(y, "3. Dispositivos de Seguridad");

  if (safetyDeviceRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Bunker", "Tipo", "Nombre", "Ubicación", "Estado"]],
      body: (safetyDeviceRows.rows as Record<string, unknown>[]).map((d) => [
        safeStr(d.bunker_name),
        DEVICE_TYPE_LABEL[d.device_type as string] ?? safeStr(d.device_type),
        safeStr(d.name),
        safeStr(d.location),
        STATUS_LABEL[d.status as string] ?? safeStr(d.status),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          if (String(data.cell.raw).toLowerCase() === "falla") data.cell.styles.textColor = [180, 30, 30];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin dispositivos de seguridad registrados.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // Device checks
  if (deviceCheckRows.rows.length > 0) {
    y = checkPageBreak(y, 25, "Informe Radioterapia — Revisiones de Dispositivos");
    y = sectionHeader(y, "4. Revisiones de Dispositivos de Seguridad (últimas 30)");
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Bunker", "Dispositivo", "Resultado", "Responsable", "Observaciones"]],
      body: (deviceCheckRows.rows as Record<string, unknown>[]).map((c) => [
        fmtDate(c.check_date),
        safeStr(c.bunker_name),
        safeStr(c.device_name),
        safeStr(c.result),
        safeStr(c.responsible),
        safeStr(c.observations),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          if (String(data.cell.raw).toLowerCase().includes("falla") ||
              String(data.cell.raw).toLowerCase() === "no_cumple") {
            data.cell.styles.textColor = [180, 30, 30];
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ─── PAGE 2: Levantamientos + Incidentes ───
  doc.addPage();
  drawPageHeader("Informe Radioterapia (SIGR) — Levantamientos Radiométricos e Incidentes");
  y = 28;

  y = sectionHeader(y, "5. Levantamientos Radiométricos (últimos 30)");

  if (surveyRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Bunker", "Ubicación", "Valor medido", "Unidad", "Instrumento", "Responsable"]],
      body: (surveyRows.rows as Record<string, unknown>[]).map((s) => [
        fmtDate(s.survey_date),
        safeStr(s.bunker_name),
        safeStr(s.location),
        s.measured_value != null ? Number(s.measured_value).toFixed(3) : "—",
        safeStr(s.unit),
        safeStr(s.instrument_ref),
        safeStr(s.responsible),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin levantamientos radiométricos registrados.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  y = checkPageBreak(y, 25, "Informe Radioterapia — Incidentes");
  y = sectionHeader(y, "6. Incidentes (últimos 20)");

  if (incidents.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Evento", "Gravedad", "Near Miss", "Estado", "Causa", "Acciones correctivas"]],
      body: incidents.map((i) => [
        fmtDate(i.incident_date),
        safeStr(i.event),
        SEVERITY_LABEL[i.severity as string] ?? safeStr(i.severity),
        i.is_near_miss ? "Sí" : "No",
        STATUS_LABEL[i.status as string] ?? safeStr(i.status),
        safeStr(i.cause),
        safeStr(i.corrective_actions),
      ]),
      headStyles: { fillColor: [140, 40, 20], textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [255, 250, 245] },
      didParseCell: (data) => {
        if (data.section === "body") {
          if (data.column.index === 2) {
            const val = String(data.cell.raw ?? "");
            if (val === "Grave") data.cell.styles.textColor = [180, 30, 30];
            else if (val === "Moderado") data.cell.styles.textColor = [180, 100, 0];
          }
          if (data.column.index === 3 && String(data.cell.raw) === "Sí") {
            data.cell.styles.textColor = [180, 80, 0];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      columnStyles: {
        1: { cellWidth: 50 },
        5: { cellWidth: 35 },
        6: { cellWidth: 50 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setFillColor(235, 255, 235);
    doc.rect(ML, y, CW, 8, "F");
    doc.setTextColor(20, 100, 20);
    doc.setFont("helvetica", "bold");
    doc.text("✓  Sin incidentes registrados.", ML + 4, y + 5.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 12;
  }

  // ─── PAGE 3: Auditorías + Acciones + Riesgos ───
  doc.addPage();
  drawPageHeader("Informe Radioterapia (SIGR) — Auditorías, Acciones y Riesgos");
  y = 28;

  y = sectionHeader(y, "7. Auditorías (últimas 15)");

  if (auditRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Tipo", "Hallazgos", "No conformidades", "Acciones", "Estado"]],
      body: (auditRows.rows as Record<string, unknown>[]).map((a) => [
        fmtDate(a.audit_date),
        AUDIT_TYPE_LABEL[a.audit_type as string] ?? safeStr(a.audit_type),
        safeStr(a.findings),
        safeStr(a.nonconformities),
        safeStr(a.actions),
        STATUS_LABEL[a.status as string] ?? safeStr(a.status),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin auditorías registradas.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // Audit findings
  if (auditFindingRows.rows.length > 0) {
    y = checkPageBreak(y, 20, "Informe Radioterapia — Hallazgos de Auditoría");
    y = sectionHeader(y, "8. Hallazgos de Auditoría (últimos 30)");
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha auditoría", "Clasificación", "Descripción", "Ref. requisito", "Estado"]],
      body: (auditFindingRows.rows as Record<string, unknown>[]).map((f) => [
        fmtDate(f.audit_date),
        safeStr(f.classification),
        safeStr(f.description),
        safeStr(f.requirement_ref),
        STATUS_LABEL[f.status as string] ?? safeStr(f.status),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  y = checkPageBreak(y, 25, "Informe Radioterapia — Acciones Correctivas/Preventivas");
  y = sectionHeader(y, "9. Acciones Correctivas/Preventivas (últimas 20)");

  if (actions.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Tipo", "Descripción", "Acción", "Responsable", "Vence", "Prioridad", "Estado"]],
      body: actions.map((a) => [
        safeStr(a.action_type),
        safeStr(a.description),
        safeStr(a.action),
        safeStr(a.responsible),
        fmtDate(a.due_date),
        safeStr(a.priority),
        STATUS_LABEL[a.status as string] ?? safeStr(a.status),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const action = actions[data.row.index];
          if (action && action.due_date) {
            const d = new Date(action.due_date as string);
            if (d < now && action.status !== "completada") {
              data.cell.styles.textColor = [180, 30, 30];
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
      columnStyles: {
        1: { cellWidth: 55 },
        2: { cellWidth: 55 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin acciones registradas.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  y = checkPageBreak(y, 25, "Informe Radioterapia — Gestión de Riesgos");
  y = sectionHeader(y, "10. Gestión de Riesgos (top 15 por puntaje)");

  if (riskRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Riesgo", "Probabilidad", "Gravedad", "Puntaje", "Estado", "Controles"]],
      body: (riskRows.rows as Record<string, unknown>[]).map((r) => [
        safeStr(r.description),
        safeStr(r.probability),
        safeStr(r.severity),
        r.risk_score != null ? String(r.risk_score) : (r.probability && r.severity ? String(Number(r.probability) * Number(r.severity)) : "—"),
        STATUS_LABEL[r.status as string] ?? safeStr(r.status),
        safeStr(r.existing_control),
      ]),
      headStyles: { fillColor: [100, 30, 120], textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [250, 245, 255] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const score = Number(data.cell.raw);
          if (score >= 15) data.cell.styles.textColor = [180, 30, 30];
          else if (score >= 9) data.cell.styles.textColor = [180, 100, 0];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin riesgos registrados.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // ─── PAGE 4: Capacitación ───
  doc.addPage();
  drawPageHeader("Informe Radioterapia (SIGR) — Capacitación y Competencias");
  y = 28;

  y = sectionHeader(y, "11. Capacitaciones y Competencias del Personal (hasta 30 registros)");

  if (trainings.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Nombre trabajador", "RUT", "Capacitación", "Fecha", "Vencimiento", "Institución", "Estado"]],
      body: trainings.map((t) => [
        safeStr(t.worker_name),
        safeStr(t.worker_rut),
        safeStr(t.training_name),
        fmtDate(t.training_date),
        fmtDate(t.expiry_date),
        safeStr(t.institution),
        STATUS_LABEL[t.status as string] ?? safeStr(t.status),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell: (data) => {
        if (data.section === "body") {
          const t = trainings[data.row.index];
          if (t && t.expiry_date) {
            const exp = new Date(t.expiry_date as string);
            const days = (exp.getTime() - now.getTime()) / 86400000;
            if (data.column.index === 4) {
              if (days < 0) {
                data.cell.styles.textColor = [180, 30, 30];
                data.cell.styles.fontStyle = "bold";
              } else if (days <= 30) {
                data.cell.styles.textColor = [180, 100, 0];
              }
            }
            if (data.column.index === 6 && days < 0) {
              data.cell.styles.textColor = [180, 30, 30];
            }
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin registros de capacitación.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // Summary box at bottom of page
  y = checkPageBreak(y, 30, "Informe Radioterapia — Resumen Normativo");
  y = sectionHeader(y, "12. Resumen de Cumplimiento Normativo");

  const normRefs = [
    ["DS 133/1984 MINSAL", "Reglamento de Protección Radiológica de Instalaciones Radiactivas"],
    ["DS 3/1985 MINSAL", "Reglamento de Autorización de Instalaciones Radiactivas"],
    ["ARPANSA RPS 14.3", "Radiation Protection Series — Radiation Protection in Radiotherapy"],
    ["IAEA TRS-430", "Absorbed Dose Determination in External Beam Radiotherapy"],
    ["TG-142 AAPM", "Quality Assurance of Medical Accelerators"],
    ["ISO 9001:2015", "Sistema de Gestión de Calidad — aplicable a gestión de incidentes y auditorías"],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [["Marco normativo", "Descripción / Aplicación"]],
    body: normRefs,
    headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 1.5 },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    columnStyles: { 0: { cellWidth: 55 } },
  });

  // Add page numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  const buf = Buffer.from(doc.output("arraybuffer"));
  const facilitySlug = slug(safeStr(facility.name));
  const fileDateStr = now.toISOString().slice(0, 10);
  const filename = `radioterapia_sigr_${facilitySlug}_${fileDateStr}.pdf`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
