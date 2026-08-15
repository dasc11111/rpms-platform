import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureRadioterapiaTables } from "@/lib/radioterapia";
import { ensureLinacTables, LINAC_QC_PERIODICITIES } from "@/lib/linac";
import { getCalibrationAlertLevel } from "@/lib/instruments";
import { getAuthStatus, daysRemaining } from "@/lib/authorization";

export const dynamic = "force-dynamic";

function daysUntil(dateValue: any): number | null {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

function addInterval(dateValue: any, periodicity: string): Date | null {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  switch (periodicity) {
    case "diario": d.setDate(d.getDate() + 1); break;
    case "semanal": d.setDate(d.getDate() + 7); break;
    case "mensual": d.setMonth(d.getMonth() + 1); break;
    case "trimestral": d.setMonth(d.getMonth() + 3); break;
    case "semestral": d.setMonth(d.getMonth() + 6); break;
    case "anual": d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
    }
  return d;
  }

type Estado = "cumple" | "proximo_a_vencer" | "requiere_revision" | "no_cumple" | "no_evaluado" | "no_aplica";

const ESTADO_COLOR: Record<Estado, string> = {
  cumple: "verde",
  proximo_a_vencer: "amarillo",
  requiere_revision: "naranjo",
  no_cumple: "rojo",
  no_evaluado: "blanco",
  no_aplica: "negro",
  };

const ESTADO_SCORE: Record<Estado, number | null> = {
  cumple: 100,
  proximo_a_vencer: 90,
  requiere_revision: 70,
  no_cumple: 0,
  no_evaluado: null,
  no_aplica: null,
  };

type Requisito = {
  id: string;
  pregunta: string;
  requisito: string;
  fuente: string;
  estado: Estado;
  color: string;
  evaluable: boolean;
  detalle: string;
  evidencia: string | null;
  responsable: string | null;
  fecha: string | null;
  vencimiento: string | null;
  accion: string | null;
  };

function mkReq(
  id: string,
  pregunta: string,
  requisito: string,
  fuente: string,
  estado: Estado,
  detalle: string,
  evidencia: string | null = null,
  responsable: string | null = null,
  fecha: string | null = null,
  vencimiento: string | null = null,
  accion: string | null = null
  ): Requisito {
  return {
    id,
    pregunta,
    requisito,
    fuente,
    estado,
    color: ESTADO_COLOR[estado],
    evaluable: estado !== "no_evaluado" && estado !== "no_aplica",
    detalle,
    evidencia,
    responsable,
    fecha,
    vencimiento,
    accion,
    };
  }

export async function GET(request: Request) {
  await ensureRadioterapiaTables();
  await ensureLinacTables();

  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");

  const facilitiesRes = facilityId
  ? await sql`SELECT * FROM rt_facilities WHERE id = ${facilityId}`
  : await sql`SELECT * FROM rt_facilities ORDER BY id ASC`;
  const facilities = facilitiesRes.rows;
  const facilityIds: number[] = facilityId ? [Number(facilityId)] : facilities.map((f: any) => f.id);

  const bunkersRes = facilityIds.length
  ? await sql`SELECT * FROM rt_bunkers WHERE facility_id = ANY(${facilityIds}::int[])`
  : { rows: [] as any[] };
  const bunkers = bunkersRes.rows;
  const bunkerIds: number[] = bunkers.map((b: any) => b.id);
  const linacIds: number[] = Array.from(
    new Set(bunkers.map((b: any) => b.linac_id).filter((v: any) => v !== null && v !== undefined))
    );

  const linacsRes = linacIds.length
  ? await sql`SELECT * FROM linac_units WHERE id = ANY(${linacIds}::int[])`
  : { rows: [] as any[] };
  const linacs = linacsRes.rows;
  const hasLinac = linacs.length > 0;

  const authsRes = linacIds.length
  ? await sql`SELECT * FROM linac_authorizations WHERE linac_id = ANY(${linacIds}::int[]) AND is_current = true`
  : { rows: [] as any[] };
  const authorizations = authsRes.rows;

  const docsRes = linacIds.length
  ? await sql`SELECT * FROM linac_documents WHERE linac_id = ANY(${linacIds}::int[])`
  : { rows: [] as any[] };
  const documents = docsRes.rows;

  const qcRes = linacIds.length
  ? await sql`SELECT * FROM linac_qc_tests WHERE linac_id = ANY(${linacIds}::int[]) ORDER BY test_date DESC`
  : { rows: [] as any[] };
  const qcTests = qcRes.rows;

  const maintenanceRes = linacIds.length
  ? await sql`SELECT * FROM linac_maintenance WHERE linac_id = ANY(${linacIds}::int[]) ORDER BY maintenance_date DESC`
  : { rows: [] as any[] };
  const maintenance = maintenanceRes.rows;

  const linacIncidentsRes = linacIds.length
  ? await sql`SELECT * FROM linac_incidents WHERE linac_id = ANY(${linacIds}::int[]) ORDER BY incident_date DESC`
  : { rows: [] as any[] };
  const linacIncidents = linacIncidentsRes.rows;

  const rtIncidentsRes = facilityIds.length
  ? await sql`SELECT * FROM rt_incidents WHERE facility_id = ANY(${facilityIds}::int[]) ORDER BY incident_date DESC`
  : { rows: [] as any[] };
  const rtIncidents = rtIncidentsRes.rows;

  const surveysRes = bunkerIds.length
  ? await sql`SELECT * FROM rt_radiation_surveys WHERE bunker_id = ANY(${bunkerIds}::int[]) ORDER BY survey_date DESC`
  : { rows: [] as any[] };
  const surveys = surveysRes.rows;

  const shieldingRes = bunkerIds.length
  ? await sql`SELECT * FROM rt_shielding WHERE bunker_id = ANY(${bunkerIds}::int[])`
  : { rows: [] as any[] };
  const shielding = shieldingRes.rows;

  const devicesRes = bunkerIds.length
  ? await sql`SELECT * FROM rt_safety_devices WHERE bunker_id = ANY(${bunkerIds}::int[])`
  : { rows: [] as any[] };
  const devices = devicesRes.rows;

  const trainingsRes = facilityIds.length
  ? await sql`SELECT * FROM rt_trainings WHERE facility_id = ANY(${facilityIds}::int[])`
  : { rows: [] as any[] };
  const trainings = trainingsRes.rows;

  const workersRes = await sql`
  SELECT rut, name, status, service, category, authorization_expiry_date
  FROM workers
  WHERE status <> 'inactive'
  `;
  const workers = workersRes.rows;

  const instrumentsRes = await sql`
  SELECT i.id, i.name, i.code, i.status,
  lc.expiry_date AS last_calibration_expiry
  FROM instruments i
  LEFT JOIN LATERAL (
    SELECT expiry_date FROM calibrations c WHERE c.instrument_id = i.id ORDER BY c.calibration_date DESC, c.id DESC LIMIT 1
    ) lc ON true
  WHERE i.status <> 'dado_de_baja'
  `;
  const instruments = instrumentsRes.rows;

  const dosimetryRes = await sql`
  SELECT DISTINCT ON (worker_rut) worker_rut, worker_name, year, quarter, level
  FROM dosimetry_quarterly
  ORDER BY worker_rut, year DESC, quarter DESC
  `;
  const dosimetry = dosimetryRes.rows;

  const requisitos: Requisito[] = [];

  // 1. Autorizacion del acelerador
  if (!hasLinac || authorizations.length === 0) {
    requisitos.push(mkReq("q1_autorizacion_acelerador", "Esta el acelerador autorizado?",
                          "Autorizacion vigente (SEREMI/CCHEN) por acelerador", "linac_authorizations", "no_evaluado",
                          "Sin autorizaciones registradas para el/los acelerador(es) de esta instalacion.", null, null, null, null,
                          "Registrar la autorizacion vigente en el modulo Acelerador."));
    } else {
    const vencidas = authorizations.filter((a: any) => { const d = daysUntil(a.expiry_date); return d !== null && d < 0; });
    const proximas = authorizations.filter((a: any) => { const d = daysUntil(a.expiry_date); return d !== null && d >= 0 && d <= 90; });
    const peor = vencidas[0] || proximas[0] || authorizations[0];
    const estado: Estado = vencidas.length ? "no_cumple" : proximas.length ? "proximo_a_vencer" : "cumple";
    requisitos.push(mkReq("q1_autorizacion_acelerador", "Esta el acelerador autorizado?",
                          "Autorizacion vigente (SEREMI/CCHEN) por acelerador", "linac_authorizations", estado,
                          vencidas.length ? `${vencidas.length} autorizacion(es) vencida(s)` :
                          proximas.length ? `${proximas.length} autorizacion(es) vencen en 90 dias o menos` : "Todas las autorizaciones vigentes",
                          peor?.blob_url ?? null, null, peor?.issue_date ?? null, peor?.expiry_date ?? null,
                          vencidas.length || proximas.length ? "Renovar/actualizar la autorizacion antes del vencimiento." : null));
    }

  // 2. Documentacion vigente
  if (documents.length === 0) {
    requisitos.push(mkReq("q2_documentacion_vigente", "Esta la documentacion vigente?",
                          "Documentos del acelerador con version vigente", "linac_documents", "no_evaluado",
                          "No hay documentos registrados en el modulo Acelerador para esta instalacion.", null, null, null, null,
                          "Cargar la documentacion tecnica y administrativa del acelerador."));
    } else {
    const current = documents.filter((d: any) => d.is_current);
    const estado: Estado = current.length > 0 ? "cumple" : "requiere_revision";
    requisitos.push(mkReq("q2_documentacion_vigente", "Esta la documentacion vigente?",
                          "Documentos del acelerador con version vigente", "linac_documents", estado,
                          `${current.length} de ${documents.length} documento(s) con version vigente marcada.`,
                          null, null, null, null,
                          estado !== "cumple" ? "Marcar/cargar la version vigente de la documentacion." : null));
    }

  // 3. Personal autorizado
  const workersWithAuth = workers.filter((w: any) => w.authorization_expiry_date);
  if (workersWithAuth.length === 0) {
    requisitos.push(mkReq("q3_personal_autorizado", "Esta el personal autorizado?",
                          "Autorizacion de desempeno vigente por trabajador", "workers", "no_evaluado",
                          "No hay trabajadores con fecha de vencimiento de autorizacion registrada.", null, null, null, null,
                          "Registrar la fecha de vencimiento de autorizacion de cada trabajador en el modulo Trabajadores."));
    } else {
    const vencidos = workersWithAuth.filter((w: any) => getAuthStatus(daysRemaining(w.authorization_expiry_date)) === "vencida");
    const proximos = workersWithAuth.filter((w: any) => getAuthStatus(daysRemaining(w.authorization_expiry_date)) === "proxima_vencer");
    const estado: Estado = vencidos.length ? "no_cumple" : proximos.length ? "proximo_a_vencer" : "cumple";
    requisitos.push(mkReq("q3_personal_autorizado", "Esta el personal autorizado?",
                          "Autorizacion de desempeno vigente por trabajador", "workers", estado,
                          vencidos.length ? `${vencidos.length} trabajador(es) con autorizacion vencida` :
                          proximos.length ? `${proximos.length} trabajador(es) con autorizacion por vencer (<=120 dias)` :
                          `${workersWithAuth.length} trabajador(es) con autorizacion vigente`,
                          null, null, null, null,
                          vencidos.length || proximos.length ? "Gestionar la renovacion de autorizacion de desempeno." : null));
    }

  // 4. Dosimetria controlada
  if (dosimetry.length === 0) {
    requisitos.push(mkReq("q4_dosimetria_controlada", "Esta la dosimetria controlada?",
                          "Nivel de dosis trimestral por trabajador (normal/registro/investigacion/intervencion)",
                          "dosimetry_quarterly", "no_evaluado", "No hay lecturas de dosimetria registradas.", null, null, null, null,
                          "Cargar los reportes trimestrales de dosimetria."));
    } else {
    const intervencion = dosimetry.filter((d: any) => d.level === "intervencion");
    const investigacion = dosimetry.filter((d: any) => d.level === "investigacion");
    const registro = dosimetry.filter((d: any) => d.level === "registro");
    const estado: Estado = intervencion.length ? "no_cumple" : investigacion.length ? "requiere_revision" : registro.length ? "proximo_a_vencer" : "cumple";
    requisitos.push(mkReq("q4_dosimetria_controlada", "Esta la dosimetria controlada?",
                          "Nivel de dosis trimestral por trabajador (normal/registro/investigacion/intervencion)",
                          "dosimetry_quarterly", estado,
                          intervencion.length ? `${intervencion.length} trabajador(es) en nivel de intervencion` :
                          investigacion.length ? `${investigacion.length} trabajador(es) en nivel de investigacion` :
                          registro.length ? `${registro.length} trabajador(es) en nivel de registro` :
                          "Todos los trabajadores en nivel normal (ultimo trimestre informado)",
                          null, null, null, null,
                          intervencion.length || investigacion.length ? "Evaluar causa de la dosis segun procedimiento de radioproteccion." : null));
    }

  // 5. Instrumentos vigentes
  if (instruments.length === 0) {
    requisitos.push(mkReq("q5_instrumentos_vigentes", "Estan vigentes los instrumentos?",
                          "Calibracion vigente por instrumento", "instruments/calibrations", "no_evaluado",
                          "No hay instrumentos registrados.", null, null, null, null, "Registrar los instrumentos de medicion en el modulo Instrumentos."));
    } else {
    const levels = instruments.map((i: any) => getCalibrationAlertLevel(i.last_calibration_expiry).level);
    const vencidas2 = levels.filter((l) => l === "vencida").length;
    const rojo = levels.filter((l) => l === "rojo").length;
    const amarillo = levels.filter((l) => l === "amarillo").length;
    const sinCal = levels.filter((l) => l === "sin_calibracion").length;
    const estado: Estado = vencidas2 ? "no_cumple" : rojo ? "requiere_revision" : amarillo ? "proximo_a_vencer" : sinCal === instruments.length ? "no_evaluado" : "cumple";
    requisitos.push(mkReq("q5_instrumentos_vigentes", "Estan vigentes los instrumentos?",
                          "Calibracion vigente por instrumento", "instruments/calibrations", estado,
                          `${vencidas2} vencida(s), ${rojo} por vencer <=30d, ${amarillo} por vencer <=180d, ${sinCal} sin calibracion registrada (de ${instruments.length}).`,
                          null, null, null, null,
                          vencidas2 || rojo ? "Enviar instrumento(s) a calibracion." : null));
    }

  // 6. Levantamiento radiometrico vigente
  if (bunkers.length === 0) {
    requisitos.push(mkReq("q6_levantamiento_radiometrico", "Esta vigente el levantamiento radiometrico?",
                          "Levantamiento radiometrico por bunker (<=180 dias)", "rt_radiation_surveys", "no_evaluado",
                          "No hay bunker/sala registrada para esta instalacion.", null, null, null, null,
                          "Registrar el/los bunker(s) y su levantamiento radiometrico."));
    } else {
    let sinLevantamiento = 0;
    let desactualizado = 0;
    let ultimaFecha: string | null = null;
    for (const b of bunkers) {
      const last = surveys.find((s: any) => s.bunker_id === b.id);
      if (!last) { sinLevantamiento++; continue; }
      if (!ultimaFecha || new Date(last.survey_date) > new Date(ultimaFecha)) ultimaFecha = last.survey_date;
      const d = daysUntil(last.survey_date);
      if (d !== null && Math.abs(d) > 180) desactualizado++;
      }
    const estado: Estado = sinLevantamiento ? "no_cumple" : desactualizado ? "requiere_revision" : "cumple";
    requisitos.push(mkReq("q6_levantamiento_radiometrico", "Esta vigente el levantamiento radiometrico?",
                          "Levantamiento radiometrico por bunker (<=180 dias)", "rt_radiation_surveys", estado,
                          `${sinLevantamiento} bunker(s) sin levantamiento, ${desactualizado} desactualizado(s) (de ${bunkers.length}).`,
                          null, null, ultimaFecha, null,
                          sinLevantamiento || desactualizado ? "Ejecutar levantamiento radiometrico del bunker." : null));
    }

  // 7. QC al dia
  const qcPeriodStatus = LINAC_QC_PERIODICITIES.map((p: any) => {
    const testsForP = qcTests.filter((q: any) => q.periodicity === p.value);
    const last = testsForP[0] || null;
    const nextDue = last ? addInterval(last.test_date, p.value) : null;
    const days = nextDue ? daysUntil(nextDue) : null;
    return { periodicity: p.value, label: p.label, last, nextDue, days };
    }).filter((p) => p.last !== null);

  if (qcTests.length === 0) {
    requisitos.push(mkReq("q7_qc_al_dia", "Esta al dia el QC?",
                          "Control de calidad ejecutado segun periodicidad definida", "linac_qc_tests", "no_evaluado",
                          "No hay pruebas de control de calidad registradas.", null, null, null, null,
                          "Registrar las pruebas de QC segun periodicidad."));
    } else {
    const vencidos = qcPeriodStatus.filter((p) => p.days !== null && p.days < 0);
    const proximos = qcPeriodStatus.filter((p) => p.days !== null && p.days >= 0 && p.days <= 7);
    const estado: Estado = vencidos.length ? "no_cumple" : proximos.length ? "proximo_a_vencer" : "cumple";
    requisitos.push(mkReq("q7_qc_al_dia", "Esta al dia el QC?",
                          "Control de calidad ejecutado segun periodicidad definida", "linac_qc_tests", estado,
                          `${vencidos.length} periodicidad(es) de QC vencida(s), ${proximos.length} por vencer en 7 dias (de ${qcPeriodStatus.length} periodicidades con historial).`,
                          null, null, null, null,
                          vencidos.length ? "Ejecutar el/los QC pendiente(s)." : null));
    }

  // 8. Pruebas pendientes
  {
    const pendientes = qcPeriodStatus.filter((p) => p.days !== null && p.days < 0);
    const estado: Estado = qcPeriodStatus.length === 0 ? "no_evaluado" : pendientes.length ? "no_cumple" : "cumple";
    requisitos.push(mkReq("q8_pruebas_pendientes", "Existen pruebas pendientes?",
                          "Pruebas de QC cuya proxima fecha ya paso", "linac_qc_tests", estado,
                          estado === "no_evaluado" ? "Sin historial de QC para evaluar pendientes." :
                          pendientes.length ? `${pendientes.length} prueba(s) de QC pendiente(s): ${pendientes.map((p) => p.label).join(", ")}` : "Sin pruebas de QC pendientes.",
                          null, null, null, null, pendientes.length ? "Ejecutar y registrar la(s) prueba(s) pendiente(s)." : null));
    }

  // 9. Desviaciones
  {
    const qcDesv = qcTests.filter((q: any) => q.status && q.status !== "cumple").slice(0, 50);
    const shieldingDesv = shielding.filter((s: any) => s.status !== "conforme");
    const devicesDesv = devices.filter((d: any) => d.status !== "operativo");
    const total = qcDesv.length + shieldingDesv.length + devicesDesv.length;
    const sinDatos = qcTests.length === 0 && shielding.length === 0 && devices.length === 0;
    const estado: Estado = sinDatos ? "no_evaluado" : total > 0 ? "requiere_revision" : "cumple";
    requisitos.push(mkReq("q9_desviaciones", "Existen desviaciones?",
                          "QC fuera de tolerancia, blindaje no conforme o dispositivos de seguridad no operativos",
                          "linac_qc_tests / rt_shielding / rt_safety_devices", estado,
                          sinDatos ? "Sin datos de QC, blindaje o dispositivos de seguridad para evaluar." :
                          `${qcDesv.length} QC no conforme(s), ${shieldingDesv.length} blindaje(s) no conforme(s), ${devicesDesv.length} dispositivo(s) de seguridad no operativo(s).`,
                          null, null, null, null, total > 0 ? "Investigar y corregir la(s) desviacion(es) detectada(s)." : null));
    }

  // 10. Incidentes
  {
    const abiertosLinac = linacIncidents.filter((i: any) => i.status === "abierto");
    const abiertosRt = rtIncidents.filter((i: any) => i.status === "abierto");
    const total = abiertosLinac.length + abiertosRt.length;
    const sinDatos = linacIncidents.length === 0 && rtIncidents.length === 0;
    const estado: Estado = sinDatos ? "no_evaluado" : total > 0 ? "no_cumple" : "cumple";
    requisitos.push(mkReq("q10_incidentes", "Existen incidentes?",
                          "Incidentes/eventos abiertos del acelerador o de la instalacion", "linac_incidents / rt_incidents", estado,
                          sinDatos ? "Sin incidentes registrados." : `${total} incidente(s) abierto(s) (${abiertosLinac.length} acelerador, ${abiertosRt.length} instalacion).`,
                          null, null, null, null, total > 0 ? "Dar seguimiento y cierre a los incidentes abiertos." : null));
    }

  // 11. Acciones correctivas pendientes (sin modulo dedicado aun - bloque futuro de Fase 7)
  requisitos.push(mkReq("q11_acciones_correctivas_pendientes", "Existen acciones correctivas pendientes?",
                        "Registro de acciones correctivas con estado y fecha compromiso", "pendiente_de_implementacion", "no_evaluado",
                        "Aun no existe un modulo dedicado de acciones correctivas/preventivas en la plataforma; se implementara en un bloque posterior de la Fase 7 (Secciones 14 a 18).",
                        null, null, null, null, "Implementar el modulo de Acciones Correctivas/Preventivas."));

  // 12. Mantenimiento pendiente
  if (!hasLinac) {
    requisitos.push(mkReq("q12_mantenimiento_pendiente", "Existe mantenimiento pendiente?",
                          "Mantenimiento programado vs. ejecutado", "linac_maintenance", "no_evaluado",
                          "No hay acelerador asociado a esta instalacion.", null, null, null, null, null));
    } else if (maintenance.length === 0) {
    requisitos.push(mkReq("q12_mantenimiento_pendiente", "Existe mantenimiento pendiente?",
                          "Mantenimiento programado vs. ejecutado", "linac_maintenance", "requiere_revision",
                          "No hay mantenimientos registrados para el/los acelerador(es).", null, null, null, null,
                          "Registrar el plan y la ejecucion de mantenimiento."));
    } else {
    requisitos.push(mkReq("q12_mantenimiento_pendiente", "Existe mantenimiento pendiente?",
                          "Mantenimiento programado vs. ejecutado", "linac_maintenance", "no_evaluado",
                          `${maintenance.length} mantenimiento(s) registrado(s), ultimo: ${String(maintenance[0]?.maintenance_date ?? "").slice(0, 10)}. La plataforma aun no tiene definida una periodicidad/umbral de mantenimiento por equipo, por lo que no se puede calcular "pendiente" de forma objetiva.`,
                          null, null, maintenance[0]?.maintenance_date ?? null, null,
                          "Definir periodicidad de mantenimiento preventivo por equipo para habilitar esta alerta."));
    }

  // 13. Documentos que requieren actualizacion
  {
    const authsProx = authorizations.filter((a: any) => { const d = daysUntil(a.expiry_date); return d !== null && d <= 90; });
    const trainingsProx = trainings.filter((t: any) => { const d = daysUntil(t.expiry_date); return d !== null && d <= 60; });
    const total = authsProx.length + trainingsProx.length;
    const sinDatos = authorizations.length === 0 && trainings.length === 0;
    const estado: Estado = sinDatos ? "no_evaluado" : total > 0 ? "requiere_revision" : "cumple";
    requisitos.push(mkReq("q13_documentos_actualizacion", "Que documentos requieren actualizacion?",
                          "Autorizaciones y capacitaciones proximas a vencer", "linac_authorizations / rt_trainings", estado,
                          sinDatos ? "Sin autorizaciones ni capacitaciones registradas." :
                          `${authsProx.length} autorizacion(es) proxima(s) a vencer (<=90d), ${trainingsProx.length} capacitacion(es) proxima(s) a vencer (<=60d).`,
                          null, null, null, null, total > 0 ? "Actualizar/renovar la documentacion proxima a vencer." : null));
    }

  // 14. Sintesis: elementos que podrian generar un incumplimiento
  {
    const evaluables = requisitos.filter((r) => r.evaluable);
    const criticos = evaluables.filter((r) => r.estado === "no_cumple");
    const advertencias = evaluables.filter((r) => r.estado === "requiere_revision" || r.estado === "proximo_a_vencer");
    const estado: Estado = evaluables.length === 0 ? "no_evaluado" : criticos.length ? "no_cumple" : advertencias.length ? "requiere_revision" : "cumple";
    requisitos.push(mkReq("q14_elementos_incumplimiento", "Que elementos podrian generar un incumplimiento?",
                          "Sintesis de los requisitos evaluados en rojo/naranjo/amarillo", "gestion-integral (sintesis)", estado,
                          evaluables.length === 0 ? "Aun no hay suficiente informacion evaluable para esta sintesis." :
                          (criticos.length || advertencias.length)
                          ? `${criticos.length} elemento(s) critico(s): ${criticos.map((r) => r.pregunta).join("; ") || "ninguno"}. ${advertencias.length} elemento(s) en advertencia: ${advertencias.map((r) => r.pregunta).join("; ") || "ninguno"}.`
                          : "No se detectan elementos que puedan generar incumplimiento con la informacion evaluable actual.",
                          null, null, null, null,
                          (criticos.length || advertencias.length) ? "Priorizar la revision de los elementos criticos y en advertencia listados." : null));
    }

  const scored = requisitos.filter((r) => r.evaluable && r.id !== "q14_elementos_incumplimiento");
  const scores = scored.map((r) => ESTADO_SCORE[r.estado]).filter((v): v is number => v !== null);
  const indiceCumplimiento = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : null;

  const conteoPorColor: Record<string, number> = { verde: 0, amarillo: 0, naranjo: 0, rojo: 0, blanco: 0, negro: 0 };
  requisitos.forEach((r) => { conteoPorColor[r.color] = (conteoPorColor[r.color] || 0) + 1; });

  const matrizCumplimiento = requisitos.map((r) => ({
    requisito: r.requisito,
    pregunta: r.pregunta,
    fuente: r.fuente,
    estado: r.estado,
    color: r.color,
    evidencia: r.evidencia,
    responsable: r.responsable,
    fecha: r.fecha,
    vencimiento: r.vencimiento,
    accion: r.accion,
    detalle: r.detalle,
    }));

  return NextResponse.json({
    ok: true,
    meta: {
      facilityId: facilityId ? Number(facilityId) : null,
      facilitiesCount: facilities.length,
      linacCount: linacs.length,
      bunkersCount: bunkers.length,
      generatedAt: new Date().toISOString(),
      },
    preguntasClave: requisitos,
    matrizCumplimiento,
    indiceCumplimiento: {
      valor: indiceCumplimiento,
      escala: "0-100, calculado solo con requisitos evaluables (con criterio definido). Los requisitos no_evaluado o no_aplica no afectan este indice.",
      requisitosEvaluados: scored.length,
      requisitosTotales: requisitos.length,
      bandasSugeridas_configurables: [
        { min: 95, max: 100, color: "verde" },
        { min: 90, max: 94.9, color: "amarillo" },
        { min: 80, max: 89.9, color: "naranjo" },
        { min: 0, max: 79.9, color: "rojo" },
        ],
      },
    conteoPorColor,
    });
  }
