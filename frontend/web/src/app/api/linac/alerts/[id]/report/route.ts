import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureLinacTables, logLinacAudit } from "@/lib/linac";
import { ensureAlertsTables, parseNumeric } from "@/lib/linac-alerts";
import { ensureScienceTables, linearTrend } from "@/lib/linac-science";
import { getRepeatedDeviationInfo } from "@/lib/linac-maintenance";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Fase 6.11 (Tarea 44): GENERACION DE INFORMES
// ---------------------------------------------------------------------------
// Genera un INFORME PDF para una alerta cientifica especifica, reutilizando
// datos ya existentes (nunca inventa valores): identificacion, equipo,
// fecha, responsable, medicion, valor de referencia/criterio, desviacion,
// fuente, historial/tendencia (con grafico simple), accion/decision
// registrada, conclusion y documentos asociados.

const LEVEL_LABELS: Record<string, string> = {
    normal: "Dentro de criterio",
    atencion: "Atencion (preventiva)",
    investigacion: "Investigacion",
    critica: "Critica - accion requerida",
    sin_criterio: "Sin criterio configurado",
};

const DECISION_LABELS: Record<string, string> = {
    revisar: "Revisar",
    investigar: "Investigar",
    repetir_medicion: "Repetir medicion",
    registrar_mantenimiento: "Registrar mantenimiento",
    registrar_correctiva: "Registrar accion correctiva",
    justificar: "Justificar desviacion",
    escalar_fisico_medico: "Escalar a Fisico Medico",
    escalar_opr: "Escalar a OPR",
    suspender_operacion: "Suspender operacion",
};

async function loadReportContext(alertId: number) {
    const { rows } = await sql`
        SELECT
              a.*,
                    u.brand AS linac_brand, u.model AS linac_model, u.room AS linac_room, u.serial_number AS linac_serial,
                          c.source_name AS criteria_source_name, c.value AS criteria_value, c.unit AS criteria_unit,
                                c.tolerance AS criteria_tolerance, c.action_limit AS criteria_action_limit,
                                      c.investigation_limit AS criteria_investigation_limit, c.critical_limit AS criteria_critical_limit,
                                            c.status AS criteria_status,
                                                  c.document_id AS criteria_document_id, c.document_version AS criteria_document_version,
                                                        c.page AS criteria_page, c.chapter AS criteria_chapter, c.section AS criteria_section,
                                                              d.original_name AS document_name, d.blob_url AS document_url
                                                                  FROM linac_scientific_alerts a
                                                                      LEFT JOIN linac_units u ON u.id = a.linac_id
                                                                          LEFT JOIN linac_technical_criteria c ON c.id = a.criteria_id
                                                                              LEFT JOIN documents d ON d.id = c.document_id
                                                                                  WHERE a.id = ${alertId}
                                                                                      LIMIT 1;
                                                                                        `;
    return rows[0] || null;
}

async function loadLatestDecision(alertId: number) {
    const { rows } = await sql`
        SELECT * FROM linac_deviation_decisions WHERE alert_id = ${alertId} ORDER BY decided_at DESC LIMIT 1;
          `;
    return rows[0] || null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    await ensureLinacTables();
    await ensureScienceTables();
    await ensureAlertsTables();

  const { id: idParam } = await params;
    const alertId = Number(idParam);
    if (!alertId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const alert: any = await loadReportContext(alertId);
    if (!alert) return NextResponse.json({ error: "alert_not_found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
    const actor = searchParams.get("actor") || null;

  const decision: any = await loadLatestDecision(alertId);
    const { count: repetitionCount, history } = await getRepeatedDeviationInfo(alert.linac_id, alert.module, alert.parameter_name);

  const numericHistory = (history as any[])
      .map((h) => ({ date: h.created_at, value: parseNumeric(h.measured_value) }))
      .filter((p) => p.value !== null) as { date: any; value: number }[];

  const trendPoints = numericHistory.map((p, i) => ({ x: i, y: p.value }));
    const trend = linearTrend(trendPoints);

  const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" }) as unknown as {
          text: (t: string, x: number, y: number) => void;
          setFontSize: (n: number) => void;
          setFont: (font: string, style?: string) => void;
          setDrawColor: (r: number, g?: number, b?: number) => void;
          setLineWidth: (n: number) => void;
          line: (x1: number, y1: number, x2: number, y2: number) => void;
          circle: (x: number, y: number, r: number, style?: string) => void;
          splitTextToSize: (t: string, w: number) => string[];
          addPage: () => void;
          output: (type: string) => ArrayBuffer;
    };

  const pageWidth = 595;
    const marginX = 40;
    const contentWidth = pageWidth - marginX * 2;
    let y = 40;

  function ensureSpace(next: number) {
        if (y + next > 780) {
                doc.addPage();
                y = 40;
        }
  }

  function heading(text: string) {
        ensureSpace(24);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(text, marginX, y);
        y += 6;
        doc.setDrawColor(30, 64, 175);
        doc.setLineWidth(1);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 12;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
  }

  function field(label: string, value: unknown) {
        const text = label + ": " + (value === null || value === undefined || value === "" ? "-" : String(value));
        const wrapped = doc.splitTextToSize(text, contentWidth);
        wrapped.forEach((ln: string) => {
                ensureSpace(12);
                doc.text(ln, marginX, y);
                y += 12;
        });
  }

  function paragraph(text: string) {
        const wrapped = doc.splitTextToSize(text, contentWidth);
        wrapped.forEach((ln: string) => {
                ensureSpace(12);
                doc.text(ln, marginX, y);
                y += 12;
        });
  }

  doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("INFORME DE ALERTA CIENTIFICA - RADIOTERAPIA", marginX, y);
    y += 8;
    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(1.5);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

  const equipoLabel = [alert.linac_brand, alert.linac_model].filter(Boolean).join(" ") || "Equipo no identificado";

  heading("1. IDENTIFICACION");
    field("N de alerta", alert.id);
    field("Fecha de generacion del informe", new Date().toLocaleString("es-CL"));
    field("Fecha de deteccion de la alerta", alert.created_at ? new Date(alert.created_at).toLocaleString("es-CL") : "-");
    field("Modulo", alert.module);
    field("Nivel", LEVEL_LABELS[alert.level] || alert.level);
    field("Estado de la alerta", alert.status);

  heading("2. EQUIPO");
    field("Equipo", equipoLabel);
    field("Sala", alert.linac_room);
    field("Numero de serie", alert.linac_serial);

  heading("3. RESPONSABLE");
    field("Reconocida/gestionada por", alert.acknowledged_by || "Sin responsable asignado aun");
    field("Registrada por (decision)", decision?.decided_by);

  heading("4. MEDICION Y REFERENCIA");
    field("Parametro", alert.parameter_name);
    field("Valor medido", alert.measured_value);
    field("Valor de referencia (criterio)", alert.reference_value);
    field(
          "Desviacion",
          alert.deviation_pct !== null && alert.deviation_pct !== undefined ? Number(alert.deviation_pct).toFixed(2) + "%" : null
        );
    field("Mensaje del motor cientifico", alert.message);

  heading("5. CRITERIO TECNICO Y FUENTE");
    if (alert.criteria_id) {
          field("Valor del criterio", (alert.criteria_value ?? "-") + " " + (alert.criteria_unit ?? ""));
          field("Tolerancia", alert.criteria_tolerance);
          field("Limite de accion", alert.criteria_action_limit);
          field("Limite de investigacion", alert.criteria_investigation_limit);
          field("Limite critico", alert.criteria_critical_limit);
          field("Estado del criterio", alert.criteria_status);
          field("Fuente", alert.criteria_source_name || "CRITERIO PENDIENTE DE PARAMETRIZACION");
    } else {
          field("Criterio", "CRITERIO PENDIENTE DE PARAMETRIZACION");
    }

  heading("6. DOCUMENTOS ASOCIADOS");
    if (alert.document_name) {
          field("Documento", alert.document_name + (alert.criteria_document_version ? " (v" + alert.criteria_document_version + ")" : ""));
          field("Pagina / Capitulo / Seccion", [alert.criteria_page, alert.criteria_chapter, alert.criteria_section].filter(Boolean).join(" / "));
          field("Ver documento (URL)", alert.document_url);
    } else {
          field("Documento", "Sin documento de respaldo asociado al criterio");
    }

  heading("7. HISTORIAL Y TENDENCIA");
    field("Repeticiones detectadas para este parametro", repetitionCount);
    field("Tendencia", trend ? trend.direction : "Sin datos suficientes para calcular tendencia");

  if (numericHistory.length >= 2) {
        ensureSpace(150);
        doc.setFont("helvetica", "bold");
        doc.text("Grafico de evolucion del parametro (mediciones historicas)", marginX, y);
        y += 14;
        doc.setFont("helvetica", "normal");

      const chartX = marginX;
        const chartY = y;
        const chartW = contentWidth;
        const chartH = 110;
        const values = numericHistory.map((p) => p.value);
        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const range = maxV - minV || 1;

      doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.5);
        doc.line(chartX, chartY, chartX, chartY + chartH);
        doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

      doc.setDrawColor(30, 64, 175);
        doc.setLineWidth(1.2);
        const n = numericHistory.length;
        const stepX = n > 1 ? chartW / (n - 1) : 0;
        const firstVal = values[0] as number;
        let prevX = chartX;
        let prevY = chartY + chartH - ((firstVal - minV) / range) * chartH;
        doc.circle(prevX, prevY, 1.5, "F");
        for (let i = 1; i < n; i++) {
                const v = values[i] as number;
                const px = chartX + stepX * i;
                const py = chartY + chartH - ((v - minV) / range) * chartH;
                doc.line(prevX, prevY, px, py);
                doc.circle(px, py, 1.5, "F");
                prevX = px;
                prevY = py;
        }
        doc.setDrawColor(0, 0, 0);
        doc.setFontSize(7);
        doc.text("Min: " + minV, chartX, chartY + chartH + 12);
        doc.text("Max: " + maxV, chartX + chartW - 60, chartY + chartH + 12);
        doc.setFontSize(9);
        y = chartY + chartH + 26;
  }

  heading("8. ACCION / DECISION REGISTRADA");
    if (decision) {
          field("Decision", DECISION_LABELS[decision.decision] || decision.decision);
          field("Justificacion", decision.justification);
          field("Registrada por", decision.decided_by);
          field("Fecha de decision", decision.decided_at ? new Date(decision.decided_at).toLocaleString("es-CL") : "-");
    } else {
          field("Decision", "Aun no se ha registrado una decision para esta alerta.");
    }

  heading("9. CONCLUSION");
    const conclusionParts: string[] = [];
    conclusionParts.push(
          'Se ' + (alert.status === "cerrada" ? "gestiono" : "detecto") + ' una alerta de nivel "' +
            (LEVEL_LABELS[alert.level] || alert.level) + '" para el parametro "' + alert.parameter_name + '" del modulo "' + alert.module + '".'
        );
    if (alert.criteria_id) {
          conclusionParts.push(
                  'El criterio tecnico asociado se encuentra "' + alert.criteria_status + '" con fuente "' + (alert.criteria_source_name || "no especificada") + '".'
                );
    } else {
          conclusionParts.push("No existe un criterio tecnico activo asociado: CRITERIO PENDIENTE DE PARAMETRIZACION.");
    }
    conclusionParts.push(
          decision
            ? 'La accion registrada fue: "' + (DECISION_LABELS[decision.decision] || decision.decision) + '".'
            : "No se ha registrado una accion/decision formal a la fecha de este informe."
        );
    conclusionParts.push("Este informe es una herramienta de gestion y apoyo tecnico; no sustituye el juicio clinico del Fisico Medico ni del OPR.");
    paragraph(conclusionParts.join(" "));

  heading("10. TRAZABILIDAD");
    field("Informe generado el", new Date().toLocaleString("es-CL"));
    field("Generado por", actor);
    field("Sistema", "RPMS - Motor Cientifico, Normativo y Documental de Radioterapia (Fase 6)");

  await logLinacAudit("generate_linac_science_alert_report", actor, {
        alertId,
        module: alert.module,
        parameterName: alert.parameter_name,
        level: alert.level,
  });

  const arrayBuffer = doc.output("arraybuffer");
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(arrayBuffer), {
          headers: {
                  "Content-Type": "application/pdf",
                  "Content-Disposition": 'inline; filename="informe-alerta-' + alertId + '-' + stamp + '.pdf"',
          },
    });
}
