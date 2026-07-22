import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const FILTER_FIELDS: Record<string, string> = {
  paciente: "paciente_nombre",
  run: "paciente_run",
  radiofarmaco: "radiofarmaco",
  medico_solicitante: "medico_solicitante",
  procedencia: "procedencia",
  diagnostico: "diagnostico",
  tipo_examen: "tipo_examen",
  equipo: "equipo",
  motivo: "motivo",
  protocolo: "protocolo",
  prevision: "prevision",
  ficha_clinica: "ficha_clinica",
  partida: "partida",
  pedido_numero: "pedido_numero",
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
  const year = searchParams.get("year");
  if (year) {
    params.push(Number(year));
    conditions.push(`admin_year = $${params.length}`);
  }
  const month = searchParams.get("month");
  if (month) {
    params.push(Number(month));
    conditions.push(`admin_month = $${params.length}`);
  }
  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`admin_date >= $${params.length}`);
  }
  const dateTo = searchParams.get("dateTo");
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`admin_date <= $${params.length}`);
  }
  const q = searchParams.get("q");
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    conditions.push(
      `(paciente_nombre ILIKE $${idx} OR ficha_clinica ILIKE $${idx} OR paciente_run ILIKE $${idx} OR pedido_numero ILIKE $${idx} OR partida ILIKE $${idx})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

const COLUMNS: { key: string; label: string }[] = [
  { key: "admin_date", label: "Fecha" },
  { key: "partida", label: "Partida" },
  { key: "pedido_numero", label: "N° Pedido" },
  { key: "radiofarmaco", label: "Radiofármaco" },
  { key: "cantidad_solicitada", label: "Cantidad solicitada (mCi)" },
  { key: "paciente_nombre", label: "Paciente" },
  { key: "paciente_run", label: "RUN" },
  { key: "tasa_dosis", label: "Tasa de dosis" },
  { key: "dosis_administrada", label: "Dosis administrada (mCi)" },
  { key: "ficha_clinica", label: "Ficha clínica" },
  { key: "prevision", label: "Previsión" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "medico_solicitante", label: "Médico solicitante" },
  { key: "procedencia", label: "Procedencia" },
  { key: "tipo_examen", label: "Tipo de examen" },
  { key: "equipo", label: "Equipo" },
  { key: "motivo", label: "Motivo" },
  { key: "protocolo", label: "Protocolo" },
  { key: "notas", label: "Notas" },
  { key: "responsable", label: "Responsable" },
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

  const query = `SELECT * FROM i131_administrations ${where} ORDER BY admin_date DESC, id DESC`;
  const { rows } = await sql.query(query, params);

  const stamp = new Date().toISOString().slice(0, 10);
  const filenameBase = `administracion-i131-${stamp}`;

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
    XLSX.utils.book_append_sheet(workbook, sheet, "Administraciones I-131");
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
    doc.text("Administración de I-131 — Reporte", 40, 30);
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
