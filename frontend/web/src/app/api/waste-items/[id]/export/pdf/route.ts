import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureWasteExpertSchema } from "@/lib/waste-expert-db";
import { activityAtElapsed, construirExplicacion } from "@/lib/waste-expert";
import { getInstitutionInfo } from "@/lib/institution-settings";

/**
 * SISTEMA EXPERTO - GESTION DE DESECHOS RADIACTIVOS
 * GET /api/waste-items/[id]/export/pdf
 *
 * Genera la Ficha Individual de Residuo Radiactivo en formato PDF
 * landscape A4 con trazabilidad completa:
 *   1. Identificacion y datos del residuo
 *   2. Prediccion de decaimiento fisico (Motor 1)
 *   3. Mediciones y decision metrologica (ISO 11929)
 *   4. Historial de estados
 *   5. Autorizaciones
 *   6. Correcciones (auditoria)
 *
 * Regulacion: DS 133/1984 MINSAL Art. 47-52
 *             CCHEN Reglamento de Residuos Radiactivos
 *             ISO 11929 (metrologia de actividad)
 */

export const dynamic = "force-dynamic";

// ─── Colores ─────────────────────────────────────────────────────────────────
const C = {
  headerBg: [15, 60, 110] as [number, number, number],
  sectionBg: [30, 80, 140] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  grayLight: [245, 247, 250] as [number, number, number],
  grayMid: [200, 210, 220] as [number, number, number],
  grayDark: [80, 90, 100] as [number, number, number],
  textDark: [20, 30, 45] as [number, number, number],
  green: [34, 139, 34] as [number, number, number],
  red: [180, 30, 30] as [number, number, number],
  yellow: [184, 134, 11] as [number, number, number],
};

// ─── Label helpers (inlined from waste-expert-ui to avoid client-only import) ─
const TIPO_RESIDUO: Record<string, string> = {
  solido: "Sólido", liquido: "Líquido", vial: "Vial", jeringa: "Jeringa",
  aguja: "Aguja", algodon: "Algodón", absorbente: "Absorbente",
  guantes: "Guantes", epp: "EPP", ropa: "Ropa", radiofarmaco: "Radiofármaco",
  fuente: "Fuente", generador: "Generador",
  superficie_contaminada: "Superficie contaminada", equipo: "Equipo", otro: "Otro",
};
const TIPO_MEDICION: Record<string, string> = {
  directa: "Medición directa (contaminación)",
  wipe: "Wipe test (contaminación removible)",
  tasa_dosis: "Tasa de dosis",
};
const AREA_TIPO: Record<string, string> = {
  ventana_detector: "Ventana del detector",
  area_activa: "Área activa del detector",
  area_efectiva: "Área efectiva de calibración",
  area_superficie_evaluada: "Área de superficie evaluada",
  area_total_objeto: "Área total del objeto",
};
const DECISION_METROLOGICA: Record<string, string> = {
  NO_DISTINGUIBLE_DEL_FONDO: "No distinguible del fondo",
  DETECTADO: "Detectado (bajo LQ)",
  CUANTIFICABLE: "Cuantificable",
  CUANTIFICABLE_CON_INCERTIDUMBRE_RELEVANTE: "Cuantificable, incertidumbre relevante",
  INFORMACION_INSUFICIENTE: "Información insuficiente",
};
const ESTADO_LABELS: Record<string, string> = {
  registrado: "Registrado",
  en_decaimiento: "En decaimiento",
  pendiente_medicion: "Pendiente de medición",
  pendiente_verificacion: "Pendiente de verificación",
  disponible_evaluacion_final: "Disponible evaluación final",
  liberado: "Liberado",
  no_cumple: "No cumple criterio",
  bloqueado: "Bloqueado",
};

function lbl(map: Record<string, string>, v: unknown): string {
  if (!v) return "—";
  return map[String(v)] ?? String(v);
}
function fmtStr(v: unknown): string {
  if (v == null) return "—";
  return String(v).trim() || "—";
}
function fmtDate(v: unknown): string {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  return s || "—";
}
function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 16).replace("T", " ");
}
function fmtNum(v: unknown, digits = 4): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString("es-CL", { maximumFractionDigits: digits });
}
function cumpleLbl(v: unknown): string {
  if (v === true || v === "true") return "Cumple";
  if (v === false || v === "false") return "No cumple";
  return "Sin evaluar";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureWasteExpertSchema();
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Load all data
    const [itemRows, measRows, statusRows, authRows, corrRows, institution] = await Promise.all([
      sql`
        SELECT wi.*, rn.half_life_days, rn.name AS radionuclide_name, rn.symbol AS radionuclide_symbol
        FROM waste_items wi
        LEFT JOIN radionuclides rn ON rn.code = wi.radionuclide_code
        WHERE wi.id = ${id}
      `,
      sql`
        SELECT m.*, c.valor AS criterio_valor, c.unidad AS criterio_unidad,
               c.documento_fuente AS criterio_documento_fuente
        FROM waste_item_measurements m
        LEFT JOIN waste_contamination_criteria c ON c.id = m.criterio_aplicado_id
        WHERE m.waste_item_id = ${id}
        ORDER BY m.fecha DESC, m.id DESC
      `,
      sql`
        SELECT * FROM waste_item_status_history WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
      `,
      sql`
        SELECT * FROM waste_item_authorizations WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
      `,
      sql`
        SELECT * FROM waste_item_corrections WHERE waste_item_id = ${id} ORDER BY fecha DESC, id DESC
      `,
      getInstitutionInfo(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: Record<string, unknown> = itemRows[0] as Record<string, unknown>;
    if (!item) {
      return NextResponse.json({ error: "Residuo no encontrado" }, { status: 404 });
    }

    // Decay prediction
    let prediccionActual: number | null = null;
    if (item.actividad_inicial != null && item.half_life_days && item.fecha_hora_generacion) {
      const elapsedDays = (Date.now() - new Date(item.fecha_hora_generacion).getTime()) / 86400000;
      prediccionActual = activityAtElapsed(
        Number(item.actividad_inicial),
        Number(item.half_life_days),
        elapsedDays
      );
    }

    // Motor de explicacion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ultima: Record<string, unknown> | undefined = measRows[0] as Record<string, unknown> | undefined;
    const explicacion = construirExplicacion({
      itemCode: item.item_code,
      estado: item.estado,
      radionuclideCode: item.radionuclide_code,
      ultimaBqCm2: ultima?.actividad_bq_cm2 ?? null,
      criterioBqCm2: ultima?.criterio_valor ?? null,
      ultimaMedicionValida: ultima ? Boolean(ultima.cumple_criterio !== null) : null,
      fechaTeoricaProximaEvaluacion: item.fecha_teorica_cumplimiento ?? null,
    });

    // ─── BUILD PDF ───────────────────────────────────────────────────────────
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const PW = 297;
    const PH = 210;
    const ML = 14;
    const MR = 14;
    const CW = PW - ML - MR;

    const stamp = new Date().toISOString().slice(0, 10);
    const instName = institution.name || "Institución no configurada";
    const estadoLabel = ESTADO_LABELS[String(item.estado)] ?? String(item.estado);

    let currentPage = 1;
    function drawPageHeader(pg: number) {
      doc.setFillColor(...C.headerBg);
      doc.rect(0, 0, PW, 18, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.white);
      doc.text(`FICHA DE RESIDUO RADIACTIVO — ${item.item_code}`, ML, 11);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`${instName} | Generado: ${stamp} | Pág. ${pg}`, PW - MR, 11, { align: "right" });
      doc.setTextColor(...C.textDark);
    }

    function drawSection(y: number, title: string): number {
      doc.setFillColor(...C.sectionBg);
      doc.rect(ML, y, CW, 7, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.white);
      doc.text(title, ML + 3, y + 5);
      doc.setTextColor(...C.textDark);
      return y + 9;
    }

    function checkPageBreak(y: number, threshold = 25): number {
      if (y > PH - threshold) {
        doc.addPage();
        currentPage++;
        drawPageHeader(currentPage);
        return 22;
      }
      return y;
    }

    // === PAGE 1 ===
    drawPageHeader(1);
    let y = 22;

    // --- SECTION 1: Identificación ---
    y = drawSection(y, "1. Identificación del Residuo");

    const fichaRows = [
      ["Código de residuo", fmtStr(item.item_code), "Estado actual", estadoLabel],
      ["Radionúclido", `${fmtStr(item.radionuclide_symbol || item.radionuclide_code)} — ${fmtStr(item.radionuclide_name)}`, "Vida media (días)", fmtNum(item.half_life_days, 2)],
      ["Tipo de residuo", lbl(TIPO_RESIDUO, item.tipo_residuo) + (item.tipo_residuo_otro ? ` (${item.tipo_residuo_otro})` : ""), "Actividad inicial", item.actividad_inicial != null ? `${fmtNum(item.actividad_inicial)} ${fmtStr(item.unidad_actividad)}` : "—"],
      ["Fecha/hora de generación", fmtDateTime(item.fecha_hora_generacion), "Actividad teórica actual", prediccionActual != null ? `${fmtNum(prediccionActual)} ${fmtStr(item.unidad_actividad)} (estimado)` : "—"],
      ["Masa (g)", fmtNum(item.masa_g), "Volumen (ml)", fmtNum(item.volumen_ml)],
      ["Superficie estimada (cm²)", fmtNum(item.superficie_estimada_cm2), "Ubicación / Contenedor", `${fmtStr(item.ubicacion)} / ${fmtStr(item.contenedor)}`],
      ["Área de almacenamiento", fmtStr(item.area_almacenamiento), "Responsable", fmtStr(item.responsable)],
      ["Fecha teórica cumplimiento", fmtDateTime(item.fecha_teorica_cumplimiento), "Fecha verificación", fmtDate(item.fecha_verificacion)],
      ["Fecha liberación autorizada", fmtDate(item.fecha_liberacion_autorizada), "Registrado por", fmtStr(item.registrado_por)],
    ];

    doc.autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      head: [],
      body: fichaRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5, textColor: C.textDark },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: C.grayLight, cellWidth: 55 },
        1: { cellWidth: 80 },
        2: { fontStyle: "bold", fillColor: C.grayLight, cellWidth: 55 },
        3: { cellWidth: 75 },
      },
    });
    y = doc.lastAutoTable.finalY + 4;

    // Motor de explicacion box
    y = checkPageBreak(y, 20);
    doc.setFillColor(240, 248, 255);
    doc.rect(ML, y, CW, 12, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.sectionBg);
    doc.text("Motor de explicación del estado (sección 42 del Prompt Maestro):", ML + 2, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.textDark);
    // Word-wrap explicacion
    const lines = doc.splitTextToSize(explicacion, CW - 4) as string[];
    doc.setFontSize(7);
    doc.text(lines.slice(0, 3), ML + 2, y + 8);
    y += 14;

    if (item.descripcion) {
      y = checkPageBreak(y, 14);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.text(`Descripción: ${item.descripcion}`, ML + 2, y + 3);
      doc.setFont("helvetica", "normal");
      y += 8;
    }

    // --- SECTION 2: Mediciones ---
    y = checkPageBreak(y, 30);
    y = drawSection(y, "2. Mediciones Registradas (ISO 11929)");

    if (measRows.length === 0) {
      doc.setFontSize(8);
      doc.text("Sin mediciones registradas.", ML + 2, y + 4);
      y += 10;
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Fecha / Hora", "Tipo", "Instrumento", "cps neto", "Actividad (Bq)", "Bq/cm²", "Área", "µSv/h", "Decisión metrológica", "Criterio", "Cumple"]],
        body: (measRows as Record<string, unknown>[]).map((m) => [
          `${fmtDate(m.fecha)}${m.hora ? ` ${String(m.hora).slice(0, 5)}` : ""}`,
          lbl(TIPO_MEDICION, m.tipo_medicion),
          fmtStr(m.instrumento),
          fmtNum(m.cps_neto),
          fmtNum(m.actividad_bq),
          fmtNum(m.actividad_bq_cm2),
          lbl(AREA_TIPO, m.area_tipo),
          fmtNum(m.tasa_dosis_neta_usv_h),
          lbl(DECISION_METROLOGICA, m.resultado_metrologico),
          m.criterio_valor != null ? `${fmtNum(m.criterio_valor)} ${fmtStr(m.criterio_unidad)}` : "—",
          cumpleLbl(m.cumple_criterio),
        ]),
        theme: "striped",
        styles: { fontSize: 6.5, cellPadding: 1.2 },
        headStyles: { fillColor: C.sectionBg, textColor: C.white, fontStyle: "bold", fontSize: 6.5 },
        didParseCell: (data: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor: number[] } } }) => {
          if (data.section === "body" && data.column.index === 10) {
            const v = String(data.cell.raw ?? "");
            if (v === "Cumple") data.cell.styles.textColor = C.green;
            else if (v === "No cumple") data.cell.styles.textColor = C.red;
          }
        },
        didDrawPage: (_: unknown) => {
          currentPage++;
          drawPageHeader(currentPage);
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // --- SECTION 3: Historial de estados ---
    y = checkPageBreak(y, 30);
    y = drawSection(y, "3. Historial de Estados");

    if (statusRows.length === 0) {
      doc.setFontSize(8);
      doc.text("Sin cambios de estado registrados.", ML + 2, y + 4);
      y += 10;
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Fecha/Hora", "Estado anterior", "Estado nuevo", "Motivo", "Usuario"]],
        body: (statusRows as Record<string, unknown>[]).map((h) => [
          fmtDateTime(h.fecha),
          lbl(ESTADO_LABELS, h.estado_anterior) ,
          lbl(ESTADO_LABELS, h.estado_nuevo),
          fmtStr(h.motivo),
          fmtStr(h.usuario),
        ]),
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: C.sectionBg, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 } },
        didDrawPage: (_: unknown) => {
          currentPage++;
          drawPageHeader(currentPage);
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // --- SECTION 4: Autorizaciones ---
    y = checkPageBreak(y, 30);
    y = drawSection(y, "4. Autorizaciones");

    if (authRows.length === 0) {
      doc.setFontSize(8);
      doc.text("Sin autorizaciones registradas. La liberación requiere autorización explícita.", ML + 2, y + 4);
      y += 10;
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Fecha/Hora", "Tipo", "Autorizado por", "Observaciones"]],
        body: (authRows as Record<string, unknown>[]).map((a) => [
          fmtDateTime(a.fecha),
          fmtStr(a.tipo),
          fmtStr(a.autorizado_por),
          fmtStr(a.observaciones),
        ]),
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: C.sectionBg, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
        didDrawPage: (_: unknown) => {
          currentPage++;
          drawPageHeader(currentPage);
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // --- SECTION 5: Correcciones (si las hay) ---
    if (corrRows.length > 0) {
      y = checkPageBreak(y, 30);
      y = drawSection(y, "5. Correcciones de Datos (Auditoría)");
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        head: [["Fecha/Hora", "Campo", "Valor anterior", "Valor nuevo", "Motivo", "Usuario"]],
        body: (corrRows as Record<string, unknown>[]).map((c) => [
          fmtDateTime(c.fecha),
          fmtStr(c.campo),
          fmtStr(c.valor_anterior),
          fmtStr(c.valor_nuevo),
          fmtStr(c.motivo),
          fmtStr(c.usuario),
        ]),
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: C.sectionBg, textColor: C.white, fontStyle: "bold", fontSize: 7 },
        didDrawPage: (_: unknown) => {
          currentPage++;
          drawPageHeader(currentPage);
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // --- Footer ---
    doc.setFillColor(...C.grayMid);
    doc.rect(ML, PH - 14, CW, 0.3, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.grayDark);
    doc.text(
      "Referencia: DS 133/1984 MINSAL Art. 47-52 · CCHEN Reglamento de Residuos Radiactivos · ISO 11929 (metrología de actividad)",
      ML, PH - 10
    );
    doc.text(
      `Ficha generada automáticamente — requiere verificación y firma del Físico Médico responsable · ${institution.opr_name ?? ""} | ${institution.cchen_code ?? ""}`,
      PW - MR, PH - 10, { align: "right" }
    );

    const pdfBuffer = doc.output("arraybuffer") as ArrayBuffer;
    const slug = String(item.item_code).replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `ficha_residuo_${slug}_${stamp}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[waste-items/export/pdf] Error:", err);
    return NextResponse.json(
      { error: "Error al generar la ficha PDF", detail: String(err) },
      { status: 500 }
    );
  }
}
