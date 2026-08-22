import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import * as XLSX from "xlsx";
import { ensureQualityControlTables } from "@/lib/quality-control-db";
import {
  QC_TEST_TYPES,
  getQcTestTypeConfig,
  getQcDueStatus,
  getNextDueDate,
  formatShortDate,
} from "@/lib/quality-control";

export const dynamic = "force-dynamic";

const COLUMNS: { key: string; label: string }[] = [
  { key: "test_date", label: "Fecha" },
  { key: "test_type", label: "Tipo de prueba" },
  { key: "instrument_name", label: "Instrumento" },
  { key: "radionuclide", label: "Radionuclido" },
  { key: "measured_value", label: "Valor medido" },
  { key: "reference_value", label: "Valor referencia" },
  { key: "unit", label: "Unidad" },
  { key: "tolerance_percent", label: "Tolerancia (%)" },
  { key: "deviation_percent", label: "Desviacion (%)" },
  { key: "result_status", label: "Resultado" },
  { key: "performed_by", label: "Realizada por" },
  { key: "corrective_action", label: "Accion correctiva" },
  { key: "notes", label: "Notas" },
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function labelForType(code: string) {
  return getQcTestTypeConfig(code)?.label ?? code;
}

export async function GET(req: NextRequest) {
  await ensureQualityControlTables();
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "pdf").toLowerCase();

  const conditions: string[] = [];
  const params: unknown[] = [];
  const instrumentId = searchParams.get("instrumentId");
  const testType = searchParams.get("testType");
  const resultStatus = searchParams.get("resultStatus");
  if (instrumentId) {
    params.push(Number(instrumentId));
    conditions.push(`instrument_id = $${params.length}`);
  }
  if (testType) {
    params.push(testType);
    conditions.push(`test_type = $${params.length}`);
  }
  if (resultStatus) {
    params.push(resultStatus);
    conditions.push(`result_status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT * FROM quality_control_tests ${where} ORDER BY test_date DESC, id DESC LIMIT 5000`;
  const { rows } = await sql.query(query, params);

  const stamp = new Date().toISOString().slice(0, 10);
  const filenameBase = `control-calidad-medicina-nuclear-${stamp}`;

  if (format === "csv") {
    const header = COLUMNS.map((c) => csvEscape(c.label)).join(";");
    const lines = rows.map((r) => COLUMNS.map((c) => csvEscape(r[c.key])).join(";"));
    const csv = "\uFEFF" + [header, ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const data = rows.map((r) => {
      const obj: Record<string, unknown> = {};
      for (const c of COLUMNS) obj[c.label] = r[c.key];
      return obj;
    });
    const sheet = XLSX.utils.json_to_sheet(data, { header: COLUMNS.map((c) => c.label) });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Control de Calidad MN");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" }) as unknown as {
      text: (t: string, x: number, y: number) => void;
      setFontSize: (n: number) => void;
      autoTable: (opts: Record<string, unknown>) => void;
      lastAutoTable: { finalY: number };
      output: (type: string) => ArrayBuffer;
    };

    doc.setFontSize(13);
    doc.text("Control de Calidad - Medicina Nuclear", 40, 30);
    doc.setFontSize(8);
    doc.text(
      `Referencia tecnica: IAEA-TECDOC-602 "Quality Control of Nuclear Medicine Instruments" (1991). Reporte generado ${stamp}.`,
      40,
      44
    );

    const summaryHead = [["Prueba", "Frecuencia sugerida", "Ultima realizada", "Proxima fecha", "Estado", "Referencia (IAEA-TECDOC-602)"]];
    const summaryBody = QC_TEST_TYPES.map((cfg) => {
      const relevant = rows
        .filter((r) => r.test_type === cfg.code)
        .sort((a, b) => (a.test_date < b.test_date ? 1 : -1));
      const last = relevant[0]?.test_date ?? null;
      const due = getQcDueStatus(last, cfg.suggestedFrequencyDays);
      const nextDue = getNextDueDate(last, cfg.suggestedFrequencyDays);
      return [
        cfg.label,
        cfg.suggestedFrequencyDays !== null ? `${cfg.suggestedFrequencyDays} dia(s)` : "No definida",
        last ?? "Sin registro",
        nextDue ? formatShortDate(nextDue) : "-",
        due,
        cfg.sourceRef,
      ];
    });
    doc.autoTable({
      head: summaryHead,
      body: summaryBody,
      startY: 55,
      styles: { fontSize: 6.5 },
      headStyles: { fillColor: [30, 64, 175] },
      columnStyles: { 5: { cellWidth: 260 } },
    });

    const afterSummaryY = doc.lastAutoTable.finalY + 20;

    doc.setFontSize(10);
    doc.text("Registro detallado de pruebas", 40, afterSummaryY);

    const head = [COLUMNS.map((c) => c.label)];
    const body = rows.map((r) =>
      COLUMNS.map((c) => (c.key === "test_type" ? labelForType(r[c.key]) : (r[c.key] ?? "").toString()))
    );
    doc.autoTable({
      head,
      body,
      startY: afterSummaryY + 8,
      styles: { fontSize: 6 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    const arrayBuffer = doc.output("arraybuffer");
    return new NextResponse(Buffer.from(arrayBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Formato no soportado. Use csv, xlsx o pdf." }, { status: 400 });
}
