import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables } from "@/lib/radioterapia";

export const dynamic = "force-dynamic";

const ALLOWED_PERIODS = [30, 90, 180, 365];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function classifyTrend(current: number, previous: number | null, higherIsBetter: boolean): string {
  if (previous === null || previous === undefined) return "datos_insuficientes";
  if (current === previous) return "estable";
  const base = Math.abs(previous) < 0.0001 ? (current === 0 ? 0 : 100) : Math.abs(((current - previous) / previous) * 100);
  if (base < 8) return "estable";
  const improved = higherIsBetter ? current > previous : current < previous;
  return improved ? "mejora" : "deterioro";
}

const TREND_LABELS: Record<string, string> = {
  mejora: "Mejorando",
  estable: "Estable",
  deterioro: "Deteriorandose",
  datos_insuficientes: "Datos insuficientes para establecer tendencia",
};

const GAP_MAP: Record<string, string> = {
  cumple: "CUMPLE",
  proximo_a_vencer: "BRECHA_PARCIAL",
  requiere_revision: "BRECHA_PARCIAL",
  no_cumple: "BRECHA",
  no_evaluado: "NO_EVALUADO",
  sin_informacion: "NO_EVALUADO",
  no_aplica: "NO_APLICA",
};

const SEMAFORO_MAP: Record<string, string> = {
  cumple: "verde",
  proximo_a_vencer: "amarillo",
  requiere_revision: "naranjo",
  no_cumple: "rojo",
  no_evaluado: "blanco",
  sin_informacion: "blanco",
  no_aplica: "negro",
};

const INDICE_CATEGORIAS: { n: string; label: string; match: RegExp }[] = [
  { n: "01", label: "Autorizaciones", match: /autoriza/i },
  { n: "02", label: "Personal", match: /personal|desempen|capacitac|competenc/i },
  { n: "03", label: "Dosimetria", match: /dosimetr/i },
  { n: "04", label: "Control de Calidad (QC)", match: /\bqc\b|control de calidad|prueba/i },
  { n: "05", label: "Instrumentos", match: /instrumento|calibrac/i },
  { n: "06", label: "Levantamiento radiometrico", match: /levantamiento|radiometric/i },
  { n: "07", label: "Mantenimiento", match: /mantenimiento/i },
  { n: "08", label: "Emergencias", match: /emergencia/i },
  { n: "09", label: "Incidentes", match: /incidente/i },
  { n: "10", label: "Riesgos", match: /riesgo/i },
  { n: "11", label: "Procedimientos", match: /procedimiento|documento/i },
  { n: "12", label: "Auditorias", match: /auditor/i },
  { n: "13", label: "Acciones correctivas", match: /accion/i },
];

function categorize(text: string): { n: string; label: string } {
  const found = INDICE_CATEGORIAS.find((c) => c.match.test(text || ""));
  return found ? { n: found.n, label: found.label } : { n: "99", label: "Otros" };
}

async function detectRecurrence(table: string, dateCol: string, groupCol: string, tipo: string, facilityId: number) {
  const res = await sql.query(
    `SELECT ${groupCol} AS clave, count(*)::int AS n, array_agg(id ORDER BY ${dateCol} DESC) AS ids, max(${dateCol}) AS ultimo, min(${dateCol}) AS primero
     FROM ${table}
     WHERE facility_id = $1 AND ${groupCol} IS NOT NULL AND btrim(${groupCol}) <> ''
     GROUP BY ${groupCol}
     HAVING count(*) > 1
     ORDER BY n DESC`,
    [facilityId]
  );
  return res.rows.map((r: any) => ({
    tipo,
    campo: groupCol,
    clave: r.clave,
    frecuencia: r.n,
    registros: r.ids,
    primerEvento: r.primero,
    ultimoEvento: r.ultimo,
    mensaje: "EVENTO RECURRENTE DETECTADO",
  }));
}

export async function GET(request: Request) {
  await ensureRadioterapiaTables();

  const { searchParams, origin } = new URL(request.url);
  const facilityId = Number(searchParams.get("facilityId") || 0);
  let periodDays = Number(searchParams.get("periodDays") || 90);
  if (!ALLOWED_PERIODS.includes(periodDays)) periodDays = 90;

  if (!facilityId) {
    return NextResponse.json({ ok: false, error: "facilityId_required" }, { status: 400 });
  }

  const now = new Date();
  const periodStart = addDays(now, -periodDays);
  const prevStart = addDays(now, -periodDays * 2);

  const [dashRes, giRes, vencRes] = await Promise.all([
    fetch(`${origin}/api/radioterapia/dashboard?facilityId=${facilityId}`, { cache: "no-store" }),
    fetch(`${origin}/api/radioterapia/gestion-integral?facilityId=${facilityId}`, { cache: "no-store" }),
    fetch(`${origin}/api/radioterapia/vencimientos?facilityId=${facilityId}`, { cache: "no-store" }),
  ]);
  const dashboard = dashRes.ok ? await dashRes.json() : null;
  const gi = giRes.ok ? await giRes.json() : null;
  const venc = vencRes.ok ? await vencRes.json() : null;

  const [incMin, incCur, incPrev] = await Promise.all([
    sql`SELECT min(incident_date) AS d FROM rt_incidents WHERE facility_id = ${facilityId}`,
    sql`SELECT count(*)::int AS n FROM rt_incidents WHERE facility_id = ${facilityId} AND incident_date >= ${toDateStr(periodStart)}`,
    sql`SELECT count(*)::int AS n FROM rt_incidents WHERE facility_id = ${facilityId} AND incident_date >= ${toDateStr(prevStart)} AND incident_date < ${toDateStr(periodStart)}`,
  ]);
  const [accMin, accCur, accPrev] = await Promise.all([
    sql`SELECT min(created_date) AS d FROM rt_actions WHERE facility_id = ${facilityId}`,
    sql`SELECT count(*)::int AS n FROM rt_actions WHERE facility_id = ${facilityId} AND created_date >= ${toDateStr(periodStart)}`,
    sql`SELECT count(*)::int AS n FROM rt_actions WHERE facility_id = ${facilityId} AND created_date >= ${toDateStr(prevStart)} AND created_date < ${toDateStr(periodStart)}`,
  ]);
  const [riskMin, riskCur, riskPrev] = await Promise.all([
    sql`SELECT min(created_at) AS d FROM rt_risks WHERE facility_id = ${facilityId}`,
    sql`SELECT count(*)::int AS n FROM rt_risks WHERE facility_id = ${facilityId} AND created_at >= ${toDateStr(periodStart)}`,
    sql`SELECT count(*)::int AS n FROM rt_risks WHERE facility_id = ${facilityId} AND created_at >= ${toDateStr(prevStart)} AND created_at < ${toDateStr(periodStart)}`,
  ]);

  function enoughHistory(minDate: any): boolean {
    if (!minDate) return false;
    return new Date(minDate).getTime() <= prevStart.getTime();
  }

  const incHist = enoughHistory(incMin.rows[0]?.d);
  const accHist = enoughHistory(accMin.rows[0]?.d);
  const riskHist = enoughHistory(riskMin.rows[0]?.d);

  const cumplimientoActual: number | null = gi?.indiceCumplimiento?.valor ?? null;
  const todayLabel = toDateStr(now);
  if (cumplimientoActual !== null) {
    const payload = JSON.stringify({ cumplimientoPct: cumplimientoActual });
    const existing = await sql`SELECT id FROM rt_kpi_snapshots WHERE facility_id = ${facilityId} AND period_label = ${todayLabel}`;
    if (existing.rows.length === 0) {
      await sql`INSERT INTO rt_kpi_snapshots (facility_id, period_label, kpi_data) VALUES (${facilityId}, ${todayLabel}, ${payload}::jsonb)`;
    } else {
      const existingId = existing.rows[0]?.id;
      await sql`UPDATE rt_kpi_snapshots SET kpi_data = ${payload}::jsonb WHERE id = ${existingId}`;
    }
  }
  const baseline = await sql`
    SELECT kpi_data FROM rt_kpi_snapshots
    WHERE facility_id = ${facilityId} AND created_at <= ${toDateStr(periodStart)}
    ORDER BY created_at DESC LIMIT 1
  `;
  const cumplimientoAnterior: number | null = baseline.rows[0]?.kpi_data?.cumplimientoPct ?? null;

  function buildTrend(indicador: string, actual: number, anterior: number | null, unidad: string, higherIsBetter: boolean) {
    const tendencia = classifyTrend(actual, anterior, higherIsBetter);
    return {
      indicador,
      actual,
      anterior,
      unidad,
      tendencia,
      tendenciaLabel: TREND_LABELS[tendencia] ?? tendencia,
      variacionAbsoluta: anterior === null ? null : Number((actual - anterior).toFixed(2)),
      variacionPorcentual: anterior === null || anterior === 0 ? null : Number((((actual - anterior) / anterior) * 100).toFixed(1)),
    };
  }

  const cumplimientoTrendItem = buildTrend("Cumplimiento general", cumplimientoActual ?? 0, cumplimientoAnterior, "%", true);
  const incidentesTrendItem = buildTrend("Incidentes registrados", incCur.rows[0]?.n ?? 0, incHist ? incPrev.rows[0]?.n ?? 0 : null, "eventos", false);
  const accionesTrendItem = buildTrend("Acciones creadas", accCur.rows[0]?.n ?? 0, accHist ? accPrev.rows[0]?.n ?? 0 : null, "acciones", false);
  const riesgosTrendItem = buildTrend("Riesgos nuevos identificados", riskCur.rows[0]?.n ?? 0, riskHist ? riskPrev.rows[0]?.n ?? 0 : null, "riesgos", false);
  if (cumplimientoActual === null) {
    cumplimientoTrendItem.tendencia = "datos_insuficientes";
    cumplimientoTrendItem.tendenciaLabel = TREND_LABELS.datos_insuficientes ?? "datos_insuficientes";
    cumplimientoTrendItem.actual = 0;
  }
  const tendencias = [cumplimientoTrendItem, incidentesTrendItem, accionesTrendItem, riesgosTrendItem];

  const [accionesAbiertasRes, riesgosActivosRes] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM rt_actions WHERE facility_id = ${facilityId} AND status NOT IN ('completada', 'cerrada')`,
    sql`SELECT count(*)::int AS n FROM rt_risks WHERE facility_id = ${facilityId} AND status NOT IN ('cerrado', 'cerrada')`,
  ]);
  const accionesAbiertas = accionesAbiertasRes.rows[0]?.n ?? 0;
  const riesgosActivos = riesgosActivosRes.rows[0]?.n ?? 0;

  const recurrencias = (
    await Promise.all([
      detectRecurrence("rt_incidents", "incident_date", "cause", "incidente", facilityId),
      detectRecurrence("rt_actions", "created_date", "cause", "accion", facilityId),
      detectRecurrence("rt_risks", "created_at", "cause", "riesgo", facilityId),
      detectRecurrence("rt_risks", "created_at", "equipment", "riesgo_equipo", facilityId),
    ])
  ).flat();

  const accionesCerradasPorCausa = await sql`
    SELECT cause, max(closed_date) AS ultima_cierre FROM rt_actions
    WHERE facility_id = ${facilityId} AND cause IS NOT NULL AND status IN ('completada', 'cerrada')
    GROUP BY cause
  `;
  const cierreMap = new Map<string, string>();
  for (const r of accionesCerradasPorCausa.rows) {
    if (r.cause && r.ultima_cierre) cierreMap.set(String(r.cause).trim().toLowerCase(), r.ultima_cierre);
  }
  for (const rec of recurrencias) {
    if (rec.campo === "cause") {
      const cierre = cierreMap.get(String(rec.clave).trim().toLowerCase());
      if (cierre && rec.ultimoEvento && new Date(rec.ultimoEvento) > new Date(cierre)) {
        (rec as any).verificarEficaciaAccion = true;
        (rec as any).mensajeEficacia = "VERIFICAR EFICACIA DE ACCION CORRECTIVA";
      }
    }
  }

  const matriz: any[] = gi?.matrizCumplimiento || [];
  const gapItems = matriz.map((m: any) => ({
    requisito: m.requisito,
    estadoOriginal: m.estado,
    gap: GAP_MAP[m.estado] || "NO_EVALUADO",
    evidencia: m.evidencia,
    responsable: m.responsable,
    fecha: m.fecha,
    vencimiento: m.vencimiento,
    accion: m.accion,
  }));
  const gapResumen = { CUMPLE: 0, BRECHA_PARCIAL: 0, BRECHA: 0, NO_EVALUADO: 0, NO_APLICA: 0 } as Record<string, number>;
  for (const g of gapItems) gapResumen[g.gap] = (gapResumen[g.gap] || 0) + 1;

  const checklist = matriz.map((m: any) => ({
    requisito: m.requisito,
    estado: SEMAFORO_MAP[m.estado] || "blanco",
    evidencia: m.evidencia || null,
    fecha: m.fecha || null,
    responsable: m.responsable || null,
    observacion: m.detalle || null,
    categoria: categorize(m.requisito),
  }));

  const indiceAutomatico = INDICE_CATEGORIAS.map((c) => {
    const items = checklist.filter((i: any) => i.categoria.n === c.n);
    return { numero: c.n, categoria: c.label, items: items.length, conEvidencia: items.filter((i: any) => !!i.evidencia).length };
  });

  const alertasCriticasDash: any[] = dashboard?.alertasCriticas || [];
  const critico: any[] = [];
  const importante: any[] = [];
  const preventivo: any[] = [];
  const normal: any[] = [];

  for (const a of alertasCriticasDash) critico.push({ origen: "alerta", detalle: a.message, modulo: a.module });
  for (const g of gapItems) {
    if (g.gap === "BRECHA") critico.push({ origen: "cumplimiento", detalle: g.requisito, accion: g.accion });
    else if (g.gap === "BRECHA_PARCIAL") importante.push({ origen: "cumplimiento", detalle: g.requisito, accion: g.accion });
  }
  const vencItems: any[] = venc?.items || [];
  for (const v of vencItems) {
    if (v.nivel === "vencida" || v.nivel === "rojo") critico.push({ origen: "vencimiento", detalle: `${v.categoria}: ${v.descripcion}`, dias: v.dias });
    else if (v.nivel === "naranjo") importante.push({ origen: "vencimiento", detalle: `${v.categoria}: ${v.descripcion}`, dias: v.dias });
    else if (v.nivel === "amarillo") preventivo.push({ origen: "vencimiento", detalle: `${v.categoria}: ${v.descripcion}`, dias: v.dias });
    else normal.push({ origen: "vencimiento", detalle: `${v.categoria}: ${v.descripcion}`, dias: v.dias });
  }
  for (const g of gapItems) if (g.gap === "CUMPLE") normal.push({ origen: "cumplimiento", detalle: g.requisito });

  const resumenPartes: string[] = [];
  if (cumplimientoActual !== null) {
    resumenPartes.push(
      `Durante los ultimos ${periodDays} dias el indice de cumplimiento general de Radioterapia es de ${cumplimientoActual}% (calculado solo sobre requisitos evaluables).`
    );
  } else {
    resumenPartes.push("No existen suficientes requisitos evaluables para calcular un indice de cumplimiento general en este periodo.");
  }
  resumenPartes.push(
    `Se identificaron ${alertasCriticasDash.length} alerta(s) critica(s), ${accionesAbiertas} accion(es) pendiente(s) y ${riesgosActivos} riesgo(s) activo(s).`
  );
  const tCump = cumplimientoTrendItem.tendencia;
  if (tCump === "datos_insuficientes") {
    resumenPartes.push("Informacion insuficiente para establecer una tendencia de cumplimiento respecto del periodo anterior.");
  } else {
    resumenPartes.push(`El area presenta una tendencia de cumplimiento: ${(TREND_LABELS[tCump] ?? tCump).toLowerCase()}.`);
  }
  if (recurrencias.length > 0) {
    resumenPartes.push(`Se detectaron ${recurrencias.length} patron(es) de recurrencia que ameritan revision.`);
  }
  const resumenEjecutivo = resumenPartes.join(" ");

  return NextResponse.json({
    ok: true,
    meta: {
      facilityId,
      periodDays,
      generadoEn: now.toISOString(),
      periodoActual: { desde: toDateStr(periodStart), hasta: toDateStr(now) },
      periodoAnterior: { desde: toDateStr(prevStart), hasta: toDateStr(periodStart) },
    },
    resumenEjecutivo,
    estadoActual: {
      cumplimientoPct: cumplimientoActual,
      alertasCriticas: alertasCriticasDash.length,
      accionesAbiertas,
      riesgosActivos,
      incidentesAbiertos: dashboard?.kpis?.incidentsOpen ?? null,
      auditoriasAbiertas: dashboard?.kpis?.auditsOpen ?? null,
    },
    panelInteligencia: {
      cumplimiento: { valor: cumplimientoActual, texto: cumplimientoActual !== null ? `${cumplimientoActual}%` : "NO EVALUADO" },
      riesgos: { activos: riesgosActivos },
      alertas: { criticas: alertasCriticasDash.length },
      documentacion: { cumplimientoDocumental: dashboard?.kpis?.cumplimientoDocumental ?? "NO DISPONIBLE" },
      qc: { ejecutados90d: dashboard?.kpis?.qcEjecutados90d ?? 0, noCumple90d: dashboard?.kpis?.qcNoCumple90d ?? 0 },
      dosimetria: { nota: "Integracion directa por RUN con modulo Dosimetria/Trabajadores fuera de alcance de esta iteracion; ver pestanas Dosimetria y Trabajadores." },
      mantenimiento: { mantenimientos90d: dashboard?.kpis?.mantenimientos90d ?? 0, mtbfHours: dashboard?.kpis?.mtbfHours, mttrHours: dashboard?.kpis?.mttrHours },
      instrumentos: { nota: "Ver detalle de calibraciones en Vencimientos e Informacion General." },
      personal: { cumplimientoCapacitacion: dashboard?.kpis?.cumplimientoCapacitacion ?? "NO DISPONIBLE" },
      incidentes: { abiertos: dashboard?.kpis?.incidentsOpen ?? 0, nearMiss: dashboard?.kpis?.nearMiss ?? 0 },
      acciones: { abiertas: accionesAbiertas },
      auditorias: { abiertas: dashboard?.kpis?.auditsOpen ?? 0, cumplimiento: dashboard?.kpis?.cumplimientoAuditorias ?? "NO DISPONIBLE" },
    },
    tendencias,
    recurrencias,
    gapAnalysis: { items: gapItems, resumen: gapResumen },
    controlRoom: { critico, importante, preventivo, normal },
    inspeccion: {
      checklist,
      indiceAutomatico,
      vencimientosResumen: venc?.summary || null,
    },
    notasAlcance: [
      "Este panel utiliza exclusivamente datos ya registrados en Radioterapia (riesgos, incidentes, acciones, auditorias, dispositivos de seguridad, levantamientos, vencimientos) y en el modulo Acelerador Lineal vinculado por bunker.",
      "La comparacion historica de cumplimiento se basa en snapshots diarios que se comienzan a acumular desde el primer uso de este panel; la profundidad historica aumentara con el tiempo.",
      "Gestion documental con control de versiones, motor de reglas configurable con simulacion y prediccion estadistica de fallas no se implementan en esta iteracion por requerir nueva infraestructura de datos; se prioriza no inventar informacion.",
    ],
  });
}

