import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import fs from "fs";
import path from "path";
import {
  ACTA_FIRMA_NOMBRE,
  ACTA_FIRMA_CARGO,
  ACTA_FIRMA_LICENCIAS,
  ACTA_REFERENCIA_NORMATIVA,
  type ActaPuntoMedicion,
} from "@/lib/waste";

export const dynamic = "force-dynamic";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFechaLarga(dateStr: string): string {
  const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = MESES[d.getMonth()]?.toUpperCase() ?? "";
  const year = d.getFullYear();
  return `${day} de ${month} de ${year}`;
}

type JsPdfLike = {
  text: (t: string | string[], x: number, y: number, opts?: Record<string, unknown>) => void;
  setFont: (font: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void;
  autoTable: (opts: Record<string, unknown>) => void;
  splitTextToSize: (t: string, w: number) => string[];
  output: (type: string) => ArrayBuffer;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  lastAutoTable: { finalY: number };
};

// Genera el documento oficial "ACTA ENTREGA DE SALA / AISLAMIENTO DE PACIENTE
// CON I 131" a partir de un Acta de Liberacion de Sala ya guardada, usando
// exactamente los mismos puntos de interes, referencias y pie de firma del
// modelo original. La fecha se registra automaticamente desde el Acta.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  }

  const { rows } = await sql`SELECT * FROM room_release_records WHERE id = ${id}`;
  const record = rows[0];
  if (!record) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  const puntos: ActaPuntoMedicion[] = Array.isArray(record.puntos_medicion) ? record.puntos_medicion : [];

  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" }) as unknown as JsPdfLike;

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Encabezado: bandera de Chile simplificada + "Gobierno de Chile"
  doc.setFillColor(0, 57, 166);
  doc.rect(margin, y, 20, 10, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y + 10, 20, 10, "F");
  doc.setFillColor(213, 43, 30);
  doc.rect(margin + 20, y + 10, 20, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Gobierno de Chile", margin + 50, y + 14);
  y += 36;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ACTA ENTREGA DE SALA", pageWidth / 2, y, { align: "center" });
  y += 18;
  doc.text("AISLAMIENTO DE PACIENTE CON I 131", pageWidth / 2, y, { align: "center" });
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);

  const fechaLarga = formatFechaLarga(record.release_date);
  const salaTxt = `${record.sala}${record.room_number ? " " + record.room_number : ""}`;
  const ubicacionTxt = record.ubicacion ? `, ubicado en ${record.ubicacion}` : "";
  const parrafo1 =
    `Con fecha ${fechaLarga}, se informa procedimiento realizado para verificar contaminación post ` +
    `hospitalización de la sala ${salaTxt} del Servicio ${record.service}${ubicacionTxt}.`;
  const lines1 = doc.splitTextToSize(parrafo1, contentWidth);
  doc.text(lines1, margin, y);
  y += lines1.length * 14 + 12;

  const parrafo2 =
    "La evaluación fue realizada por Tecnólogo Médico Diego Solís, Oficial de Protección Radiológica del " +
    "establecimiento, encontrando los siguientes niveles:";
  const lines2 = doc.splitTextToSize(parrafo2, contentWidth);
  doc.text(lines2, margin, y);
  y += lines2.length * 14 + 10;

  const body1 = puntos.map((p) => [
    p.label,
    `${Number(p.actividad_bq_cm2 ?? 0).toFixed(1)} Bq/cm2`,
    p.tasa_dosis_usv_h !== null && p.tasa_dosis_usv_h !== undefined ? `${p.tasa_dosis_usv_h} µSv/hr` : "—",
    p.observacion,
  ]);

  doc.autoTable({
    head: [["PUNTO", "ACTIVIDAD", "DOSIS", "OBSERVACIONES"]],
    body: body1,
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [210, 210, 210], textColor: [0, 0, 0], fontStyle: "bold" },
    theme: "grid",
  });

  y = doc.lastAutoTable.finalY + 18;

  const body2 = [
    ["SUPERFICIE Y EQUIPAMIENTO EN AREAS CONTROLADAS", ">30 (Contaminado)", ">45 µSv/hr"],
    ["SUPERFICIES DEL CUERPO", ">3(B) (Contaminado)", ""],
    ["AREAS SUPERVISADAS Y DE ACCESO PUBLICO, VESTIMENTA Y ROPA DE CAMA", ">3 (Contaminado)", ">15 µSv/hr"],
  ];

  doc.autoTable({
    head: [["SUPERFICIE", "CLASE DE RADIONUCLEIDO A (I-131) BQ/CM2", "DOSIS µSv/hr"]],
    body: body2,
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [230, 240, 220], textColor: [0, 0, 0], fontStyle: "bold" },
    theme: "grid",
    foot: [["(B) Uso de 1/10 del valor para emisores alfa", "", ""]],
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "normal", fontSize: 8 },
  });

  y = doc.lastAutoTable.finalY + 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const refLines = doc.splitTextToSize(ACTA_REFERENCIA_NORMATIVA, contentWidth);
  doc.text(refLines, margin, y);
  y += refLines.length * 12 + 26;

  // Bloque de firma: usa la imagen de firma cargada, mas el pie de firma
  // exacto del documento original (nombre, cargo y licencias CCHEN).
  try {
    const imgPath = path.join(process.cwd(), "public", "assets", "firma-diego-solis.png");
    const imgBuffer = fs.readFileSync(imgPath);
    const imgBase64 = `data:image/png;base64,${imgBuffer.toString("base64")}`;
    doc.addImage(imgBase64, "PNG", margin, y, 110, 60);
  } catch {
    // Si la imagen no esta disponible, se deja el espacio en blanco para firma manual.
  }

  const firmaTextX = margin + 130;
  let firmaY = y + 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(ACTA_FIRMA_NOMBRE, firmaTextX, firmaY);
  firmaY += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(ACTA_FIRMA_CARGO, firmaTextX, firmaY);
  for (const lic of ACTA_FIRMA_LICENCIAS) {
    firmaY += 12;
    doc.text(lic, firmaTextX, firmaY);
  }

  const arrayBuffer = doc.output("arraybuffer");
  const filename = `Acta_Liberacion_Sala_${record.sala}_${record.release_date}.pdf`.replace(/\s+/g, "_");

  return new NextResponse(Buffer.from(arrayBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
