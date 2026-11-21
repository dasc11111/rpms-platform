import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: Record<string, string> = {
  area: "area",
  sala: "sala",
  dependencia: "dependencia",
  punto_medicion: "punto_medicion",
  equipo: "equipo",
  superficie: "superficie",
  radionuclido: "radionuclido",
  instrumento: "instrumento",
  responsable: "responsable",
  motivo: "motivo",
  accion_correctiva: "accion_correctiva",
  observaciones: "observaciones",
};

function buildFilters(searchParams: URLSearchParams) {
  const conditions: string[] = [];
  const params: unknown[] = [];

for (const [key, column] of Object.entries(FILTER_FIELDS)) {
  const val = searchParams.get(key);
  if (val) {
    params.push(`%${val}%`);
    conditions.push(`${column} ILIKE $${params.length}`);
  }
}
  const estado = searchParams.get("estado");
  if (estado) {
    params.push(estado);
    conditions.push(`estado = $${params.length}`);
  }
  const clasificacion = searchParams.get("clasificacion");
  if (clasificacion) {
    params.push(clasificacion);
    conditions.push(`clasificacion = $${params.length}`);
  }
  const year = searchParams.get("year");
  if (year) {
    params.push(Number(year));
    conditions.push(`monitor_year = $${params.length}`);
  }
  const month = searchParams.get("month");
  if (month) {
    params.push(Number(month));
    conditions.push(`monitor_month = $${params.length}`);
  }
  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`monitor_date >= $${params.length}`);
  }
  const dateTo = searchParams.get("dateTo");
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`monitor_date <= $${params.length}`);
  }
  const q = searchParams.get("q");
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    conditions.push(
      `(punto_medicion ILIKE $${idx} OR observaciones ILIKE $${idx} OR accion_correctiva ILIKE $${idx} OR responsable ILIKE $${idx} OR area ILIKE $${idx} OR sala ILIKE $${idx})`
      );
  }

const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

// Unidades: la actividad superficial se mide y exporta en Bq/cm2 (magnitud
// medida directamente por el detector sobre el area monitoreada), y la tasa
// de dosis se mide y exporta en uSv/h (microsievert por hora), nunca en mSv.
const COLUMNS: { key: string; label: string }[] = [
  { key: "monitor_date", label: "Fecha" },
  { key: "area", label: "Área" },
  { key: "sala", label: "Sala" },
  { key: "dependencia", label: "Dependencia" },
  { key: "punto_medicion", label: "Punto de medición" },
  { key: "equipo", label: "Equipo" },
  { key: "superficie", label: "Superficie" },
  { key: "radionuclido", label: "Radionúclido" },
  { key: "instrumento", label: "Instrumento" },
  { key: "numero_serie_detector", label: "N° serie detector" },
  { key: "fondo_cps", label: "Fondo (cps)" },
  { key: "conteo_bruto_cps", label: "Conteo bruto (cps)" },
  { key: "conteo_neto_cps", label: "Conteo neto (cps)" },
  { key: "actividad_bq_cm2", label: "Actividad (Bq/cm²)" },
  { key: "tasa_dosis_usv_h", label: "Tasa de dosis (uSv/h)" },
  { key: "pct_limite", label: "% del límite" },
  { key: "clasificacion", label: "Resultado" },
  { key: "semaforo", label: "Semáforo" },
  { key: "requiere_limpieza", label: "Requiere limpieza" },
  { key: "limpieza_realizada", label: "Limpieza realizada" },
  { key: "factor_descontaminacion", label: "Factor de descontaminación" },
  { key: "pct_actividad_residual", label: "% Actividad residual" },
  { key: "accion_correctiva", label: "Acción correctiva" },
  { key: "estado", label: "Estado" },
  { key: "motivo", label: "Motivo" },
  { key: "responsable", label: "Responsable" },
  { key: "observaciones", label: "Observaciones" },
  ];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "csv").toLowerCase();
  const { where, params } = buildFilters(searchParams);

const query = `SELECT * FROM contamination_records ${where} ORDER BY monitor_date DESC, id DESC`;
  const { rows } = await sql.query(query, params);

const stamp = new Date().toISOString().slice(0, 10);
  const filenameBase = `registro-contaminacion-${stamp}`;

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
  XLSX.utils.book_append_sheet(workbook, sheet, "Registro de Contaminación");
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
    autoTable: (opts: Record<string, unknown>) => void;
    output: (type: string) => ArrayBuffer;
  };
  doc.text("Registro de Contaminación — Reporte", 40, 30);
  const head = [COLUMNS.map((c) => c.label)];
  const body = rows.map((r) => COLUMNS.map((c) => (r[c.key] ?? "").toString()));
  doc.autoTable({
    head,
    body,
    startY: 45,
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
