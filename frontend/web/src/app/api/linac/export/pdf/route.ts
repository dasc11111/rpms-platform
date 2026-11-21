import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables } from "@/lib/linac";
import { ensureQcExtendedTables } from "@/lib/linac-qc";
import { ensureRadiationExtendedTables } from "@/lib/linac-radiation";
import { ensureMaintenanceExtendedTables, computeMTBF, computeMTTR, computeMaintenanceAvailability } from "@/lib/linac-maintenance";
// Note: computeMTBF(totalOperatingHours, correctiveCount), computeMTTR(totalDowntimeHours, correctiveCount)
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

function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("es-CL");
}

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v).trim() || "—";
}

const PERIODICITY_LABEL: Record<string, string> = {
  diario: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const SEMAPHORE_LABEL: Record<string, string> = {
  verde: "Conforme",
  amarillo: "Advertencia",
  naranjo: "Precaución",
  rojo: "No conforme",
};

const MAINT_TYPE_LABEL: Record<string, string> = {
  preventivo: "Preventivo",
  correctivo: "Correctivo",
  predictivo: "Predictivo",
};

const OPSTATE_LABEL: Record<string, string> = {
  activo: "Activo",
  en_mantencion: "En Mantención",
  en_reparacion: "En Reparación",
  fuera_de_servicio: "Fuera de Servicio",
  baja: "Baja",
};

export async function GET(request: Request) {
  await ensureLinacTables();
  await ensureQcExtendedTables();
  await ensureRadiationExtendedTables();
  await ensureMaintenanceExtendedTables();

  const { searchParams } = new URL(request.url);
  const linacIdParam = searchParams.get("linac_id");

  // Resolve linac unit
  let unit: Record<string, unknown> | null = null;
  if (linacIdParam) {
    const { rows } = await sql`SELECT * FROM linac_units WHERE id = ${Number(linacIdParam)} LIMIT 1`;
    unit = (rows[0] as Record<string, unknown>) ?? null;
  }
  if (!unit) {
    const { rows } = await sql`SELECT * FROM linac_units ORDER BY id ASC LIMIT 1`;
    unit = (rows[0] as Record<string, unknown>) ?? null;
  }
  if (!unit) {
    return new NextResponse("No hay unidades LINAC registradas.", { status: 404 });
  }

  const linacId = unit.id as number;
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Load all data in parallel
  const [
    authRows,
    qcRows,
    qcAlerts,
    clinicalRows,
    maintenanceRows,
    radRows,
    incidentRows,
    auditRows,
    institution,
  ] = await Promise.all([
    sql`SELECT * FROM linac_authorizations WHERE linac_id = ${linacId} ORDER BY issue_date DESC LIMIT 10`,
    sql`SELECT * FROM linac_qc_tests WHERE linac_id = ${linacId} ORDER BY test_date DESC, id DESC LIMIT 60`,
    sql`SELECT * FROM linac_qc_alerts WHERE linac_id = ${linacId} AND status = 'abierta' ORDER BY created_at DESC LIMIT 20`,
    sql`SELECT * FROM linac_clinical_operations WHERE linac_id = ${linacId} ORDER BY op_date DESC LIMIT 12`,
    sql`SELECT * FROM linac_maintenance WHERE linac_id = ${linacId} ORDER BY maintenance_date DESC LIMIT 20`,
    sql`SELECT * FROM linac_radiation_protection WHERE linac_id = ${linacId} ORDER BY date DESC LIMIT 20`,
    sql`SELECT * FROM linac_incidents WHERE linac_id = ${linacId} ORDER BY date DESC LIMIT 10`,
    sql`SELECT * FROM linac_audits WHERE linac_id = ${linacId} ORDER BY audit_date DESC LIMIT 10`,
    getInstitutionInfo(),
  ]);

  // Compute QC compliance per periodicity
  const periodicities = ["diario", "semanal", "mensual", "trimestral", "semestral", "anual"];
  const qcByPeriodicity: Record<string, { total: number; cumple: number; no_cumple: number }> = {};
  for (const p of periodicities) {
    const tests = (qcRows.rows as Record<string, unknown>[]).filter((r) => r.periodicity === p);
    qcByPeriodicity[p] = {
      total: tests.length,
      cumple: tests.filter((r) => r.status === "cumple").length,
      no_cumple: tests.filter((r) => r.status === "no_cumple").length,
    };
  }

  // Maintenance metrics
  const mRows = maintenanceRows.rows as Record<string, unknown>[];
  const correctiveCount = mRows.filter((m) => m.maintenance_type === "correctivo").length;
  const totalDowntimeHours = mRows.reduce((s, m) => s + Number(m.downtime_hours ?? 0), 0);
  // Estimate operating hours from clinical operations (past 12 months)
  const totalOperatingHours = (clinicalRows.rows as Record<string, unknown>[]).reduce(
    (s, c) => s + Number(c.operating_hours ?? 0), 0
  );
  const mtbf = computeMTBF(totalOperatingHours, correctiveCount);
  const mttr = computeMTTR(totalDowntimeHours, correctiveCount);
  const avail = computeMaintenanceAvailability(mtbf, mttr);

  // Build PDF
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  function drawPageHeader(title: string) {
    // Dark blue banner
    doc.setFillColor(...HDR_DARK);
    doc.rect(0, 0, 297, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, ML, 7.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`${institution.name} | LINAC: ${safeStr(unit!.brand)} ${safeStr(unit!.model)} (${safeStr(unit!.room)})`, ML, 13);
    doc.text(`Fecha: ${dateStr}`, 297 - MR, 13, { align: "right" });
    // Light blue subheader
    doc.setFillColor(...HDR_LIGHT);
    doc.rect(0, 18, 297, 6, "F");
    doc.setTextColor(30, 30, 70);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.text("ARPANSA RPS 14.3 · IAEA TRS-430 · TG-142 · DS 133/1984 MINSAL · DS 3/1985 MINSAL", ML, 22);
    if (institution.opr_name) {
      doc.text(`OPR: ${institution.opr_name}`, 297 - MR, 22, { align: "right" });
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  }

  function drawFooter(pageNum: number, totalPages: number) {
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text(`Pág. ${pageNum} / ${totalPages}`, 297 / 2, PAGE_H - 4, { align: "center" });
    doc.text("Documento generado automáticamente — RPMS Platform", ML, PAGE_H - 4);
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
      drawPageHeader(newTitle ?? "Informe Técnico LINAC");
      return 28;
    }
    return y;
  }

  // ─── PAGE 1: Ficha técnica + autorizaciones ───
  drawPageHeader("Informe Técnico de Acelerador Lineal (LINAC)");
  let y = 28;

  y = sectionHeader(y, "1. Ficha Técnica del Equipo");
  const fichaData: [string, string][] = [
    ["Marca", safeStr(unit.brand)],
    ["Modelo", safeStr(unit.model)],
    ["Fabricante", safeStr(unit.manufacturer)],
    ["Año de fabricación", unit.manufacture_year ? String(unit.manufacture_year) : "—"],
    ["Año de instalación", unit.install_year ? String(unit.install_year) : "—"],
    ["N° de serie", safeStr(unit.serial_number)],
    ["N° inventario", safeStr(unit.inventory_number)],
    ["Sala / Room", safeStr(unit.room)],
    ["Estado operacional", OPSTATE_LABEL[unit.operational_status as string] ?? safeStr(unit.operational_status)],
    ["Energías fotónicas", safeStr(unit.photon_energies)],
    ["Energías electrónicas", safeStr(unit.electron_energies)],
    ["Tipo MLC", safeStr(unit.mlc_type)],
    ["EPID", unit.epid ? "Sí" : "No"],
    ["CBCT", unit.cbct ? "Sí" : "No"],
    ["Sistema R&V", safeStr(unit.record_verify_system)],
    ["TPS asociado", safeStr(unit.tps_associated)],
  ];

  // 2-column ficha
  const col1 = fichaData.slice(0, Math.ceil(fichaData.length / 2));
  const col2 = fichaData.slice(Math.ceil(fichaData.length / 2));
  const colW = CW / 2 - 2;
  const rowH = 5;
  let y1 = y;
  let y2 = y;

  for (const [label, value] of col1) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 120);
    doc.text(label, ML + 2, y1 + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value, ML + 2 + 55, y1 + 3.5);
    doc.setDrawColor(200, 210, 225);
    doc.line(ML, y1 + rowH, ML + colW, y1 + rowH);
    y1 += rowH;
  }
  for (const [label, value] of col2) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 120);
    doc.text(label, ML + colW + 4, y2 + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value, ML + colW + 4 + 55, y2 + 3.5);
    doc.setDrawColor(200, 210, 225);
    doc.line(ML + colW + 2, y2 + rowH, ML + CW, y2 + rowH);
    y2 += rowH;
  }
  y = Math.max(y1, y2) + 4;

  // Autorizaciones
  y = checkPageBreak(y, 30, "Informe Técnico LINAC — Autorizaciones");
  y = sectionHeader(y, "2. Autorizaciones Vigentes");

  if (authRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Tipo", "N° Documento", "Emisión", "Vencimiento", "Archivo"]],
      body: (authRows.rows as Record<string, unknown>[]).map((a) => [
        safeStr(a.doc_type),
        safeStr(a.document_number),
        fmtDate(a.issue_date),
        fmtDate(a.expiry_date),
        safeStr(a.file_name),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const val = String(data.cell.raw ?? "");
          if (val !== "—" && val !== "") {
            const d = new Date(val);
            const daysLeft = (d.getTime() - Date.now()) / 86400000;
            if (daysLeft < 0) data.cell.styles.textColor = [180, 30, 30];
            else if (daysLeft < 60) data.cell.styles.textColor = [180, 100, 0];
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin autorizaciones registradas.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // ─── PAGE 2: Control de Calidad ───
  doc.addPage();
  drawPageHeader("Informe Técnico LINAC — Control de Calidad");
  y = 28;

  y = sectionHeader(y, "3. Resumen de Control de Calidad por Periodicidad");

  // QC summary table
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [["Periodicidad", "Total", "Cumple", "No cumple", "% Cumplimiento"]],
    body: periodicities.map((p) => {
      const stats = qcByPeriodicity[p];
      const pct = stats.total > 0 ? Math.round((stats.cumple / stats.total) * 100) : null;
      return [
        PERIODICITY_LABEL[p] ?? p,
        stats.total,
        stats.cumple,
        stats.no_cumple,
        pct !== null ? `${pct}%` : "—",
      ];
    }),
    headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
    bodyStyles: { fontSize: 7, cellPadding: 1.5 },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const val = String(data.cell.raw ?? "");
        const num = parseInt(val);
        if (!isNaN(num)) {
          if (num < 80) data.cell.styles.textColor = [180, 30, 30];
          else if (num < 95) data.cell.styles.textColor = [180, 100, 0];
          else data.cell.styles.textColor = [20, 120, 20];
        }
      }
      if (data.section === "body" && data.column.index === 3 && Number(data.cell.raw) > 0) {
        data.cell.styles.textColor = [180, 30, 30];
      }
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 30, halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // Alertas QC abiertas
  y = checkPageBreak(y, 30, "Informe Técnico LINAC — Alertas QC");
  y = sectionHeader(y, "4. Alertas de Control de Calidad Abiertas");

  if (qcAlerts.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Periodicidad", "Prueba", "Semáforo", "Mensaje", "Fecha apertura"]],
      body: (qcAlerts.rows as Record<string, unknown>[]).map((a) => [
        safeStr(a.periodicity),
        safeStr(a.test_name),
        SEMAPHORE_LABEL[a.semaphore as string] ?? safeStr(a.semaphore),
        safeStr(a.message),
        fmtDate(a.created_at),
      ]),
      headStyles: { fillColor: [160, 40, 40], textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [255, 248, 245] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const val = String(data.cell.raw ?? "");
          if (val.includes("No")) data.cell.styles.textColor = [180, 30, 30];
          else if (val.includes("Advert")) data.cell.styles.textColor = [180, 100, 0];
          else if (val.includes("Precauc")) data.cell.styles.textColor = [180, 80, 0];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setFillColor(235, 255, 235);
    doc.rect(ML, y, CW, 8, "F");
    doc.setTextColor(20, 100, 20);
    doc.setFont("helvetica", "bold");
    doc.text("✓  Sin alertas QC abiertas — sistema en conformidad.", ML + 4, y + 5.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 12;
  }

  // Últimas pruebas QC detalle
  y = checkPageBreak(y, 30, "Informe Técnico LINAC — Pruebas QC Recientes");
  y = sectionHeader(y, "5. Pruebas de Control de Calidad Recientes (últimas 60)");

  if (qcRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Periodicidad", "Prueba", "Modalidad", "Energía", "Valor obtenido", "Tolerancia", "Desviación %", "Semáforo", "Responsable"]],
      body: (qcRows.rows as Record<string, unknown>[]).map((t) => [
        fmtDate(t.test_date),
        PERIODICITY_LABEL[t.periodicity as string] ?? safeStr(t.periodicity),
        safeStr(t.test_name),
        safeStr(t.modality),
        safeStr(t.energy),
        t.obtained_value ? `${safeStr(t.obtained_value)} ${safeStr(t.unit)}` : "—",
        t.tolerance ? `${safeStr(t.tolerance)} ${safeStr(t.unit)}` : "—",
        t.deviation_pct != null ? `${Number(t.deviation_pct).toFixed(1)}%` : "—",
        SEMAPHORE_LABEL[t.semaphore as string] ?? safeStr(t.semaphore),
        safeStr(t.responsible),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 6.5, fontStyle: "bold", cellPadding: 1.5 },
      bodyStyles: { fontSize: 6, cellPadding: 1.2 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell: (data) => {
        if (data.section === "body") {
          const rowData = data.row.raw as unknown[];
          const semaphore = String(rowData[8]);
          if (semaphore.includes("No")) {
            data.cell.styles.textColor = [160, 20, 20];
          } else if (semaphore.includes("Advert")) {
            data.cell.styles.textColor = [160, 80, 0];
          }
          if (data.column.index === 8) {
            if (semaphore.includes("No")) data.cell.styles.fillColor = [255, 230, 230];
            else if (semaphore.includes("Advert")) data.cell.styles.fillColor = [255, 248, 220];
            else if (semaphore.includes("Conf")) data.cell.styles.fillColor = [230, 255, 230];
          }
        }
      },
      didDrawPage: () => {
        drawPageHeader("Informe Técnico LINAC — Pruebas QC");
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin pruebas QC registradas.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // ─── PAGE 3: Mantenimiento + Protección radiológica ───
  doc.addPage();
  drawPageHeader("Informe Técnico LINAC — Mantenimiento y Protección Radiológica");
  y = 28;

  y = sectionHeader(y, "6. Métricas de Mantenimiento");

  // Metrics row
  const metrics: [string, string][] = [
    ["MTBF (Tiempo medio entre fallas)", mtbf !== null ? `${mtbf.toFixed(1)} días` : "Sin datos"],
    ["MTTR (Tiempo medio de reparación)", mttr !== null ? `${mttr.toFixed(1)} h` : "Sin datos"],
    ["Disponibilidad calculada", avail !== null ? `${(avail * 100).toFixed(1)}%` : "Sin datos"],
    ["Registros de mantenimiento", String(mRows.length)],
  ];

  const mColW = CW / 4 - 2;
  for (let i = 0; i < metrics.length; i++) {
    const x = ML + i * (mColW + 2.5);
    doc.setFillColor(...HDR_LIGHT);
    doc.rect(x, y, mColW, 14, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 80, 120);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(metrics[i][0], mColW - 4);
    doc.text(lines, x + 2, y + 4);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 60, 110);
    doc.text(metrics[i][1], x + 2, y + 11.5);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  }
  y += 18;

  y = checkPageBreak(y, 30, "Informe Técnico LINAC — Mantenimiento");
  y = sectionHeader(y, "7. Registros de Mantenimiento Recientes (últimos 20)");

  if (mRows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Tipo", "Descripción", "Ingeniero", "Tiempo (h)", "Estado", "Semáforo"]],
      body: mRows.map((m) => [
        fmtDate(m.maintenance_date),
        MAINT_TYPE_LABEL[m.maintenance_type as string] ?? safeStr(m.maintenance_type),
        safeStr(m.description),
        safeStr(m.engineer),
        m.downtime_hours != null ? String(m.downtime_hours) : "—",
        safeStr(m.status),
        SEMAPHORE_LABEL[m.semaphore as string] ?? safeStr(m.semaphore),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 6) {
          const val = String(data.cell.raw ?? "");
          if (val.includes("No")) data.cell.styles.textColor = [180, 30, 30];
          else if (val.includes("Advert")) data.cell.styles.textColor = [180, 100, 0];
        }
      },
      columnStyles: {
        2: { cellWidth: 70 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin registros de mantenimiento.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // Protección Radiológica
  y = checkPageBreak(y, 30, "Informe Técnico LINAC — Protección Radiológica");
  y = sectionHeader(y, "8. Protección Radiológica (últimos 20 registros)");

  if (radRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Tipo / Categoría", "Descripción", "Valor dosis", "Límite", "Semáforo", "Estado"]],
      body: (radRows.rows as Record<string, unknown>[]).map((r) => [
        fmtDate(r.date),
        [safeStr(r.type), safeStr(r.category)].filter((v) => v !== "—").join(" / "),
        safeStr(r.description),
        r.dose_value != null ? `${Number(r.dose_value).toFixed(3)} ${safeStr(r.dose_unit)}` : "—",
        r.limit_value != null ? `${Number(r.limit_value).toFixed(3)} ${safeStr(r.dose_unit)}` : "—",
        SEMAPHORE_LABEL[r.semaphore as string] ?? safeStr(r.semaphore),
        safeStr(r.status),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const val = String(data.cell.raw ?? "");
          if (val.includes("No")) data.cell.styles.textColor = [180, 30, 30];
          else if (val.includes("Advert")) data.cell.styles.textColor = [180, 100, 0];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin registros de protección radiológica.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // ─── PAGE 4: Operación clínica + Incidentes + Auditorías ───
  doc.addPage();
  drawPageHeader("Informe Técnico LINAC — Operación Clínica e Incidentes");
  y = 28;

  y = sectionHeader(y, "9. Operación Clínica (últimos 12 meses)");

  if (clinicalRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Pacientes", "Horas operación", "Horas detención", "Tipo tratamiento", "Interrupciones"]],
      body: (clinicalRows.rows as Record<string, unknown>[]).map((c) => [
        fmtDate(c.op_date),
        safeStr(c.patients_treated),
        c.operating_hours != null ? Number(c.operating_hours).toFixed(1) : "—",
        c.downtime_hours != null ? Number(c.downtime_hours).toFixed(1) : "—",
        safeStr(c.treatment_type),
        safeStr(c.interruptions),
      ]),
      headStyles: { fillColor: HDR_MED, textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin registros de operación clínica.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  y = checkPageBreak(y, 30, "Informe Técnico LINAC — Incidentes");
  y = sectionHeader(y, "10. Incidentes (últimos 10)");

  if (incidentRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Tipo", "Descripción", "Gravedad", "Estado", "Reportado por"]],
      body: (incidentRows.rows as Record<string, unknown>[]).map((i) => [
        fmtDate(i.date),
        safeStr(i.incident_type),
        safeStr(i.description),
        safeStr(i.severity),
        safeStr(i.status),
        safeStr(i.reported_by),
      ]),
      headStyles: { fillColor: [140, 60, 20], textColor: 255, fontSize: 7.5, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [255, 250, 245] },
      columnStyles: {
        2: { cellWidth: 80 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Sin incidentes registrados.", ML + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  y = checkPageBreak(y, 30, "Informe Técnico LINAC — Auditorías");
  y = sectionHeader(y, "11. Auditorías (últimas 10)");

  if (auditRows.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [["Fecha", "Tipo", "Entidad auditora", "Hallazgos", "Estado", "Próxima"]],
      body: (auditRows.rows as Record<string, unknown>[]).map((a) => [
        fmtDate(a.audit_date),
        safeStr(a.audit_type),
        safeStr(a.auditor),
        safeStr(a.findings),
        safeStr(a.status),
        fmtDate(a.next_audit_date),
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

  // Add page numbers to all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  const buf = Buffer.from(doc.output("arraybuffer"));
  const unitSlug = slug(`${unit.brand ?? ""}_${unit.model ?? ""}`);
  const fileDateStr = now.toISOString().slice(0, 10);
  const filename = `linac_informe_${unitSlug}_${fileDateStr}.pdf`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
