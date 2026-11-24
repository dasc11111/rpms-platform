/**
 * RPMS Knowledge Base — base de conocimiento embebida.
 * Funciona completamente sin conexión a internet.
 * Cubre todos los módulos del sistema, normativa chilena (DS 3/1985, CCHEN)
 * y guías operativas del Hospital Hernán Henríquez Aravena.
 */

export interface KBEntry {
  /** Términos de búsqueda (keywords) en minúsculas */
  keywords: string[];
  /** Módulos del sistema relacionados */
  modules?: string[];
  /** Respuesta en español, lista para mostrar al usuario */
  answer: string;
}

export const KNOWLEDGE_BASE: KBEntry[] = [
  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  {
    keywords: ["dashboard", "resumen", "inicio", "score", "puntaje", "pr", "estado"],
    modules: ["/", "/dashboard"],
    answer:
      "El **Dashboard Ejecutivo PR** muestra el estado general del Programa de Protección Radiológica:\n" +
      "- **Score PR (0–100)**: puntaje de salud del programa. 100 = óptimo.\n" +
      "- **Alertas críticas**: situaciones que requieren acción inmediata (vencimientos, sobreexposición).\n" +
      "- **Advertencias**: ítems a revisar en breve.\n" +
      "- **Estado por módulo**: tarjetas con indicadores de Dosimetría, Trabajadores, Fuentes, Incidentes, Reportes, Capacitación, Instrumentos y Residuos.\n" +
      "- **Gráficos**: dosis mensuales (promedio y máximo) e incidentes últimos 6 meses.\n\n" +
      "Para actualizar los datos presiona el botón **Actualizar** en la parte superior derecha.",
  },

  // ─── TRABAJADORES ─────────────────────────────────────────────────────────
  {
    keywords: [
      "trabajador", "trabajadores", "oer", "operativamente expuesto", "poe", "personal",
      "funcionario", "registrar trabajador", "nuevo trabajador", "agregar trabajador",
    ],
    modules: ["/workers"],
    answer:
      "El módulo **Trabajadores** gestiona al Personal Ocupacionalmente Expuesto a Radiación (POE / OER).\n\n" +
      "**Acciones principales:**\n" +
      "- Agregar nuevo trabajador con RUT, nombre, cargo, servicio y fecha de ingreso.\n" +
      "- Asignar categoría A (exposición directa) o B (exposición indirecta).\n" +
      "- Ver historial de dosis, exámenes médicos y dosímetros asignados.\n" +
      "- Marcar trabajadores como inactivos.\n\n" +
      "**Alertas automáticas:**\n" +
      "- Examen médico POE vencido o próximo a vencer (90 días).\n" +
      "- Dosis sobre el límite anual (20 mSv categoría A, 6 mSv categoría B).",
  },

  // ─── EXÁMENES MÉDICOS POE ─────────────────────────────────────────────────
  {
    keywords: ["examen", "exámenes", "médico", "poe", "médicos poe", "salud ocupacional", "salud"],
    modules: ["/medical-exams"],
    answer:
      "El módulo **Exámenes Médicos POE** registra los controles de salud obligatorios del DS 3/1985.\n\n" +
      "- **Frecuencia mínima**: anual para categoría A, cada 2 años para categoría B.\n" +
      "- **Datos registrados**: fecha, resultado (apto/apto con restricción/no apto), médico, institución.\n" +
      "- El sistema alerta cuando un examen está próximo a vencer (90 días) o ya vencido.\n" +
      "- Para registrar un examen: vaya al perfil del trabajador → pestaña Exámenes → Nuevo Examen.",
  },

  // ─── DOSIMETRÍA ───────────────────────────────────────────────────────────
  {
    keywords: [
      "dosimetría", "dosis", "dosímetro", "dosimetro", "tld", "osl", "irm",
      "dosis efectiva", "miliSievert", "msv", "cuatrimestre", "trimestre",
      "lectura", "importar", "planilla cchen", "importar pdf",
    ],
    modules: [
      "/dosimetry", "/dosimeters", "/dosimetry/worker-history",
      "/dosimetry/annual-summary", "/dosimetry/stats", "/dosimetry/quarterly",
      "/dosimetry/import-quarterly", "/dosimetry/import-pdf",
      "/dosimetry/not-returned", "/dosimetry/late-returns",
      "/dosimetry/returns", "/dosimetry/manual", "/dosimetry/export",
    ],
    answer:
      "El módulo **Dosimetría** gestiona la exposición a radiación del personal POE.\n\n" +
      "**Límites DS 3/1985 (CCHEN):**\n" +
      "- Categoría A: ≤ 20 mSv/año promedio 5 años, máx 50 mSv en un año.\n" +
      "- Categoría B: ≤ 6 mSv/año.\n" +
      "- Extremidades: ≤ 500 mSv/año.\n" +
      "- Cristalino: ≤ 150 mSv/año.\n\n" +
      "**Submódulos clave:**\n" +
      "- **Importar Planilla CCHEN**: sube la planilla trimestral Excel entregada por CCHEN.\n" +
      "- **Importar PDF Dosis**: extrae dosis desde el PDF oficial de CCHEN.\n" +
      "- **Ingreso Manual**: registra dosis individuales directamente.\n" +
      "- **Dosis Individual**: historial completo por trabajador.\n" +
      "- **Resumen Anual**: acumulado anual de todo el personal POE.\n" +
      "- **Estadísticas Dosis**: gráficos y análisis de tendencias.\n" +
      "- **Dosímetros No Devueltos / Fuera de Plazo**: control de retiro y entrega de dosímetros.",
  },

  // ─── DOSIMETRÍA INTERNA ───────────────────────────────────────────────────
  {
    keywords: ["dosimetría interna", "interna", "contaminación interna", "corporal"],
    modules: ["/internal-dosimetry"],
    answer:
      "**Dosimetría Interna** registra la exposición por incorporación de radionúclidos.\n" +
      "- Aplica principalmente al personal de Medicina Nuclear y Radiofarmacia.\n" +
      "- Se registra la dosis efectiva comprometida por inhalación o ingestión.\n" +
      "- El límite anual es parte del límite de 20 mSv/año de dosis efectiva total.",
  },

  // ─── MEDICINA NUCLEAR ─────────────────────────────────────────────────────
  {
    keywords: ["medicina nuclear", "pet", "ct", "petct", "scanner", "gammacámara", "galio", "tc99m", "tecnecio"],
    modules: ["/nuclear-medicine", "/petct", "/petct/alerts"],
    answer:
      "El módulo **Medicina Nuclear** gestiona los procedimientos diagnósticos con radionúclidos.\n\n" +
      "**PET/CT:**\n" +
      "- Registro de exámenes con F-18 FDG u otros radiofármacos.\n" +
      "- Control de alertas: dosis a pacientes, gestión de residuos, mantenimiento de equipos.\n" +
      "- Verificación de protocolos de administración y sala de espera post-dosis.\n\n" +
      "**Otros procedimientos**: gammagrafías con Tc-99m (ósea, renal, tiroidea, etc.).",
  },

  // ─── I-131 ────────────────────────────────────────────────────────────────
  {
    keywords: [
      "i131", "i-131", "yodo", "yodo 131", "radioyodo", "tiroidea", "tiroides",
      "aislamiento", "sugerencias i131", "estadísticas i131",
    ],
    modules: ["/i131", "/i131/stats", "/i131/isolation", "/i131/suggestions", "/i131/export"],
    answer:
      "El módulo **I-131** gestiona la administración de yodo radiactivo.\n\n" +
      "**Submódulos:**\n" +
      "- **Administración**: registro de cada dosis administrada (actividad en MBq/mCi, indicación, médico).\n" +
      "- **Aislamiento**: control de pacientes en habitación de aislamiento según criterios de alta.\n" +
      "- **Sugerencias**: recomendaciones automáticas de criterios de alta y restricciones post-terapia.\n" +
      "- **Estadísticas**: gráficos de pacientes tratados y actividades administradas.\n" +
      "- **Exportar**: generación de informes para CCHEN.\n\n" +
      "**Criterio de alta**: tasa de dosis ≤ 25 μSv/h a 1 metro o actividad calculada ≤ 1,11 GBq (guías IAEA).",
  },

  // ─── RADIOFARMACIA ────────────────────────────────────────────────────────
  {
    keywords: ["radiofarmacia", "radiofármaco", "kit", "eluato", "elución", "generador", "Mo-99", "Tc-99m", "radiofármacos"],
    modules: ["/radiopharmacy"],
    answer:
      "El módulo **Radiofarmacia** gestiona la preparación y control de radiofármacos.\n\n" +
      "- Registro de eluciones del generador Mo-99/Tc-99m (actividad, pureza radionuclídica).\n" +
      "- Control de kits preparados y validación de pureza radioquímica.\n" +
      "- Registro de radiofármacos recibidos de proveedores externos.\n" +
      "- Trazabilidad desde la preparación hasta la administración al paciente.",
  },

  // ─── CONTAMINACIÓN ────────────────────────────────────────────────────────
  {
    keywords: [
      "contaminación", "contaminacion", "monitor", "monitoreo contaminación",
      "límites contaminación", "puntos medición", "superficies",
    ],
    modules: [
      "/contamination", "/contamination/stats", "/contamination/measurement-points",
      "/contamination/limits", "/contamination/export",
    ],
    answer:
      "El módulo **Contaminación** registra el monitoreo de superficies y ambiente.\n\n" +
      "**Límites típicos (IAEA/CCHEN):**\n" +
      "- Zonas supervisadas: ≤ 0,4 Bq/cm² (emisores beta/gamma de baja toxicidad).\n" +
      "- Zonas controladas: valores más restrictivos según el radionúclido.\n\n" +
      "**Flujo de trabajo:**\n" +
      "1. Definir puntos de medición en el módulo → Puntos de Medición.\n" +
      "2. Registrar mediciones con instrumento y resultado.\n" +
      "3. El sistema compara con límites configurados y genera alertas.\n" +
      "4. Exportar informes periódicos para CCHEN.",
  },

  // ─── ZONAS CLASIFICADAS ───────────────────────────────────────────────────
  {
    keywords: ["zona", "zonas", "clasificada", "clasificadas", "zona controlada", "zona supervisada", "acceso"],
    modules: ["/classified-zones", "/zone-access"],
    answer:
      "**Zonas Clasificadas** define y gestiona las áreas radiológicas del establecimiento.\n\n" +
      "**Clasificación DS 3/1985:**\n" +
      "- **Zona Controlada**: tasa de dosis > 6 mSv/año. Acceso restringido a personal categoría A.\n" +
      "- **Zona Supervisada**: tasa de dosis 1–6 mSv/año. Personal categoría A y B.\n" +
      "- **Área Libre**: < 1 mSv/año para público general.\n\n" +
      "**Control de Acceso**: registro de autorizaciones por zona, fecha de vigencia y trabajadores autorizados.",
  },

  // ─── MONITOREO DE ÁREA ────────────────────────────────────────────────────
  {
    keywords: ["monitoreo", "area", "monitoreo de área", "tasa de dosis", "levantamiento radiológico"],
    modules: ["/area-monitoring"],
    answer:
      "**Monitoreo de Área** registra las mediciones de tasa de dosis en zonas clasificadas.\n\n" +
      "- Registre mediciones periódicas (semanal, mensual o según procedimiento interno).\n" +
      "- Incluya instrumento utilizado, número de serie y fecha de calibración vigente.\n" +
      "- El sistema genera tendencias y alerta si la tasa supera los límites de zona.",
  },

  // ─── LIBERACIÓN DE SALA ───────────────────────────────────────────────────
  {
    keywords: ["liberación", "liberacion", "sala", "room release", "alta radiológica", "liberación sala"],
    modules: ["/room-release", "/room-clearance", "/room-clearance/stats"],
    answer:
      "**Liberación de Sala** gestiona el proceso de liberación radiológica de habitaciones post-I131 o post-procedimiento.\n\n" +
      "**Criterios de liberación:**\n" +
      "- Tasa de dosis ≤ 25 μSv/h a 1 m de las paredes.\n" +
      "- Contaminación de superficies dentro de límites.\n\n" +
      "**Flujo:**\n" +
      "1. Registrar paciente o procedimiento.\n" +
      "2. Ingresar mediciones de tasa de dosis y contaminación.\n" +
      "3. El sistema indica si la sala cumple los criterios.\n" +
      "4. Firmar autorización de liberación.",
  },

  // ─── RESIDUOS RADIACTIVOS ─────────────────────────────────────────────────
  {
    keywords: [
      "residuo", "residuos", "desecho", "decay", "decaimiento", "almacenamiento",
      "fichas residuos", "rótulos", "iaea gsg-1", "gsg1", "inventario",
      "sistema experto residuos",
    ],
    modules: [
      "/waste", "/waste-management", "/waste-expert", "/waste-records",
      "/waste-calibration", "/waste-contamination-criteria", "/waste-release-criteria",
      "/waste-items", "/waste-labels", "/waste-labels/stats",
      "/waste-storage", "/waste-storage/dashboard", "/waste-storage/inventory",
      "/waste-storage/locations", "/waste-storage/movements", "/waste-storage/export",
    ],
    answer:
      "El módulo **Residuos Radiactivos** implementa la clasificación IAEA GSG-1.\n\n" +
      "**Clasificación por radionúclido:**\n" +
      "- **Vida corta** (T½ < 100 días): almacenar hasta ≥ 10 semividas (actividad no detectable).\n" +
      "- **Vida larga**: gestión especial con CCHEN.\n\n" +
      "**Submódulos:**\n" +
      "- **Sistema Experto**: recomendación automática de categoría y tiempo de decay.\n" +
      "- **Fichas de Residuos**: registro detallado por bolsa/contenedor.\n" +
      "- **Rótulos**: generación de etiquetas con radionúclido, actividad y fecha.\n" +
      "- **Almacenamiento Temporal**: inventario y ubicaciones del almacén.\n" +
      "- **Criterios de Liberación/Contaminación**: valores de referencia CCHEN.\n" +
      "- **Calibración Detectores**: registro de verificación de instrumentos usados en residuos.",
  },

  // ─── EQUIPOS E INSTRUMENTOS ───────────────────────────────────────────────
  {
    keywords: [
      "equipo", "equipos", "instrumento", "instrumentos", "calibración", "calibracion",
      "mantenimiento", "verificación operacional", "estado", "fuera servicio",
    ],
    modules: [
      "/equipment", "/instruments", "/instruments/operational-check",
      "/instruments/calibrations", "/calibrations-overview",
      "/instruments/maintenances", "/maintenances-overview",
    ],
    answer:
      "Los módulos **Equipos** e **Instrumentos** controlan el inventario y estado técnico.\n\n" +
      "**Acciones disponibles:**\n" +
      "- Registrar nuevos equipos/instrumentos con modelo, serie y fecha de adquisición.\n" +
      "- Programar y registrar calibraciones periódicas (exigidas por CCHEN).\n" +
      "- Registrar mantenimientos preventivos y correctivos.\n" +
      "- Realizar verificación operacional diaria/semanal.\n" +
      "- Marcar equipos como fuera de servicio.\n\n" +
      "**Alertas automáticas:**\n" +
      "- Calibración vencida o próxima a vencer (30/60 días).\n" +
      "- Mantenimiento atrasado.",
  },

  // ─── FUENTES RADIACTIVAS ──────────────────────────────────────────────────
  {
    keywords: [
      "fuente", "fuentes", "sellada", "selladas", "radiactiva", "imar",
      "movimiento imar", "estanqueidad", "prueba estanqueidad", "leak test",
    ],
    modules: ["/sources", "/sources/movements", "/sealed-sources", "/leak-tests"],
    answer:
      "El módulo **Fuentes Radiactivas** gestiona el inventario de fuentes selladas y no selladas.\n\n" +
      "**Obligaciones CCHEN:**\n" +
      "- Prueba de estanqueidad cada 2 años (IAEA Safety Guide).\n" +
      "- Registro de movimientos IMAR (Inventario, Movimiento, Adquisición, Rechazo).\n" +
      "- Autorización de uso vigente en licencia CCHEN.\n\n" +
      "**Alertas:**\n" +
      "- Prueba de estanqueidad vencida o fallida.\n" +
      "- Autorización CCHEN próxima a vencer.",
  },

  // ─── LINAC / CML ──────────────────────────────────────────────────────────
  {
    keywords: [
      "linac", "cml", "acelerador", "radioterapia", "control calidad linac",
      "qc linac", "comisionamiento", "baseline", "datos haz", "beamdata",
      "incidentes linac", "mantenimiento linac",
    ],
    modules: [
      "/linac", "/linac/dashboard", "/linac/qc", "/linac/incidents",
      "/linac/maintenance", "/linac/trends", "/linac/documents",
      "/linac/authorizations", "/linac/radiation", "/linac/alerts",
      "/linac/records", "/linac/commissioning", "/linac/baseline",
      "/linac/beamdata", "/linac/criteria", "/linac/acceptance",
      "/linac/instrument-validation", "/linac/export",
    ],
    answer:
      "El módulo **LINAC / CML** gestiona integralmente el acelerador lineal médico.\n\n" +
      "**Control de Calidad:**\n" +
      "- Pruebas diarias, semanales, mensuales y anuales según AAPM TG-142.\n" +
      "- Registro de resultados con comparación automática con valores baseline.\n" +
      "- Tendencias de parámetros críticos (dosis/MU, perfiles de haz, isocentro).\n\n" +
      "**Otros submódulos:**\n" +
      "- **Comisionamiento**: datos de aceptación y puesta en marcha.\n" +
      "- **Protección Radiológica LINAC**: monitoreo de sala y accesos.\n" +
      "- **Incidentes**: registro según IAEA ROSIS / IAEA Safety Reports.\n" +
      "- **Autorizaciones**: documentación regulatoria CCHEN para operación del LINAC.",
  },

  // ─── TRANSPORTE RADIACTIVO ────────────────────────────────────────────────
  {
    keywords: [
      "transporte", "transportar", "opr", "conductor", "despacho", "bulto",
      "paquete", "tipo a", "tipo b", "excepto", "actividad límite",
    ],
    modules: [
      "/transport", "/transport/dashboard", "/transport/authorization",
      "/transport/drivers", "/transport/oprs", "/transport/dispatch-documents",
      "/transport/radionuclides",
    ],
    answer:
      "El módulo **Transporte Radiactivo** gestiona el transporte de material radiactivo.\n\n" +
      "**Marco regulatorio:** DS 12/1985 y IAEA SSR-6.\n\n" +
      "**Submódulos:**\n" +
      "- **Autorización CCHEN**: registro de la autorización vigente para transporte.\n" +
      "- **Conductores Autorizados**: lista y vigencia de licencias de conductores OPR.\n" +
      "- **OPRs de Transporte**: personas responsables de operaciones de transporte.\n" +
      "- **Documentos de Despacho**: generación de documentación de envío.\n" +
      "- **Catálogo Radionúclidos Transporte**: límites de actividad por categoría de bulto.",
  },

  // ─── PROGRAMA ALARA ───────────────────────────────────────────────────────
  {
    keywords: ["alara", "programa alara", "optimización", "optimizacion", "reducción dosis"],
    modules: ["/alara"],
    answer:
      "El módulo **Programa ALARA** gestiona las iniciativas de optimización de dosis.\n\n" +
      "ALARA = *As Low As Reasonably Achievable* (tan bajo como sea razonablemente alcanzable).\n\n" +
      "- Registro de objetivos de reducción de dosis por servicio.\n" +
      "- Seguimiento de medidas implementadas (blindajes, distancia, tiempo).\n" +
      "- Comparación de dosis antes/después de las medidas.\n" +
      "- Vinculación con el programa de indicadores de desempeño PR.",
  },

  // ─── PLAN DE CONTINGENCIA / EMERGENCIAS ───────────────────────────────────
  {
    keywords: ["emergencia", "contingencia", "plan", "accidente", "simulacro", "derrame"],
    modules: ["/emergency", "/emergency-drills", "/spills"],
    answer:
      "El módulo **Plan de Contingencia** gestiona las emergencias radiológicas.\n\n" +
      "**Submódulos:**\n" +
      "- **Plan de Contingencia**: documentación del plan institucional.\n" +
      "- **Simulacros de Emergencia**: registro de ejercicios y evaluaciones.\n" +
      "- **Derrames Radiactivos**: registro de incidentes de derrame con protocolos de acción.\n\n" +
      "**Ante un derrame:**\n" +
      "1. Evacuar el área.\n" +
      "2. Delimitar y señalizar.\n" +
      "3. Notificar al Encargado PR.\n" +
      "4. Seguir protocolo de descontaminación.\n" +
      "5. Registrar en el módulo con causa, magnitud y acciones tomadas.",
  },

  // ─── INCIDENTES ───────────────────────────────────────────────────────────
  {
    keywords: [
      "incidente", "incidentes", "accidente", "radiológico", "ines",
      "escala ines", "notificación cchen", "reportar",
    ],
    modules: ["/incidents"],
    answer:
      "El módulo **Incidentes** registra eventos radiológicos adversos.\n\n" +
      "**Escala INES (IAEA):**\n" +
      "- Nivel 0: desviación sin importancia.\n" +
      "- Nivel 1: anomalía.\n" +
      "- Nivel 2: incidente.\n" +
      "- Nivel 3: incidente grave.\n" +
      "- Niveles 4–7: accidentes (escalonado a catástrofe).\n\n" +
      "**Notificación CCHEN:** los incidentes INES ≥ 1 deben notificarse a CCHEN dentro de 24 horas.\n\n" +
      "Para registrar: Incidentes → Nuevo Incidente → completar descripción, escala INES, causa raíz y acciones correctivas.",
  },

  // ─── LIBRO DE NOVEDADES ───────────────────────────────────────────────────
  {
    keywords: ["libro", "novedades", "logbook", "bitácora", "registro diario"],
    modules: ["/logbook"],
    answer:
      "El **Libro de Novedades** es el registro cronológico de eventos y actividades diarias del Programa PR.\n\n" +
      "- Registre cualquier novedad relevante: visitas, incidencias menores, actividades no rutinarias.\n" +
      "- Cada entrada queda firmada con usuario y fecha/hora automáticamente.\n" +
      "- Sirve como evidencia para inspecciones CCHEN.",
  },

  // ─── CUMPLIMIENTO NS-06.0 ─────────────────────────────────────────────────
  {
    keywords: ["cumplimiento", "ns-06", "ns06", "ns-06.0", "norma seguridad", "requisitos"],
    modules: ["/compliance"],
    answer:
      "El módulo **Cumplimiento NS-06.0** verifica el cumplimiento de la norma CCHEN de Seguridad Radiológica.\n\n" +
      "- Lista de requisitos normativos con estado (cumple / no cumple / en proceso).\n" +
      "- Vinculación a evidencias documentales del sistema.\n" +
      "- Porcentaje de cumplimiento global y por sección.\n" +
      "- Exportación de informe de cumplimiento para inspecciones.",
  },

  // ─── CAPA ─────────────────────────────────────────────────────────────────
  {
    keywords: ["capa", "no conformidad", "no conformidades", "acción correctiva", "acción preventiva"],
    modules: ["/capa"],
    answer:
      "El módulo **CAPA** (Acción Correctiva y Preventiva) gestiona las no conformidades del sistema.\n\n" +
      "- Registre la no conformidad con descripción, origen y responsable.\n" +
      "- Defina la causa raíz y el plan de acción.\n" +
      "- Haga seguimiento de tareas y fechas comprometidas.\n" +
      "- Cierre la CAPA con evidencia de efectividad.",
  },

  // ─── INDICADORES ──────────────────────────────────────────────────────────
  {
    keywords: ["indicador", "indicadores", "kpi", "desempeño", "métricas"],
    modules: ["/indicators"],
    answer:
      "El módulo **Indicadores de Desempeño PR** mide la efectividad del programa.\n\n" +
      "Indicadores típicos:\n" +
      "- % personal con examen médico vigente.\n" +
      "- % dosímetros devueltos a tiempo.\n" +
      "- N° de incidentes por período.\n" +
      "- % de calibraciones al día.\n" +
      "- Dosis colectiva trimestral.\n" +
      "- Tasa de cumplimiento de capacitaciones.",
  },

  // ─── CAPACITACIÓN ────────────────────────────────────────────────────────
  {
    keywords: ["capacitación", "capacitacion", "training", "entrenamiento", "curso", "charla"],
    modules: ["/training"],
    answer:
      "El módulo **Capacitación** gestiona la formación radiológica del personal.\n\n" +
      "**Obligaciones DS 3/1985:** todo el personal POE debe recibir capacitación básica en PR al ingresar y anualmente.\n\n" +
      "- Registre sesiones con tema, fecha, relator y lista de asistentes.\n" +
      "- Adjunte material de la capacitación.\n" +
      "- El sistema alerta si un trabajador no ha sido capacitado en el período vigente.",
  },

  // ─── CCHEN: DECLARACIONES, INSPECCIONES, LICENCIAS ───────────────────────
  {
    keywords: [
      "cchen", "declaración", "declaracion", "declaración anual", "inspección",
      "inspeccion", "licencia", "operación", "autorización", "formulario f-01",
    ],
    modules: [
      "/cchen-declarations", "/cchen-inspections", "/operating-licenses",
      "/cchen-communications", "/cchen-licenses", "/licenses",
      "/f01-cchen", "/inspections",
    ],
    answer:
      "Los módulos **CCHEN** gestionan la relación regulatoria con la Comisión Chilena de Energía Nuclear.\n\n" +
      "**Declaración Anual de Dosis:** obligatoria antes del 31 de marzo de cada año.\n" +
      "- Incluye dosis de todo el personal POE del año anterior.\n" +
      "- Se genera desde Dosimetría → Declaración Anual Dosis CCHEN.\n\n" +
      "**Licencias de Operación:** registro de licencias vigentes por instalación/equipo.\n" +
      "- Alerta de vencimiento con 90 días de anticipación.\n\n" +
      "**Inspecciones CCHEN:** registro de visitas con hallazgos y compromisos.\n\n" +
      "**Formulario F-01:** declaración de inicio/modificación/cese de práctica.",
  },

  // ─── PROGRAMA PR (PPR) ────────────────────────────────────────────────────
  {
    keywords: ["programa pr", "ppr", "protección radiológica", "encargado pr", "programa"],
    modules: ["/radiation-program", "/encargado-pr"],
    answer:
      "El módulo **Programa PR** documenta el Programa de Protección Radiológica institucional.\n\n" +
      "- Política de PR y objetivos del período.\n" +
      "- Estructura organizacional PR.\n" +
      "- Plan anual de actividades.\n" +
      "- Vinculación con indicadores, CAPA, ALARA y capacitación.\n\n" +
      "**Portal Encargado PR:** vista consolidada para el Encargado con todas las alertas y pendientes.",
  },

  // ─── INFORME DE GESTIÓN ───────────────────────────────────────────────────
  {
    keywords: ["informe", "informe gestión", "informe anual", "reporte", "annual report"],
    modules: ["/management-report", "/annual-report", "/reports/annual-cchen"],
    answer:
      "Los módulos de **Informes** generan reportes ejecutivos del programa.\n\n" +
      "- **Informe de Gestión**: reporte periódico (mensual/trimestral) del estado del programa PR.\n" +
      "- **Informe Anual Integrado**: resumen anual completo de todas las actividades PR.\n" +
      "- **Informe Anual CCHEN**: formato oficial para presentar a CCHEN.\n\n" +
      "Para generar: seleccione el período, verifique que todos los datos estén completos y descargue en PDF o Excel.",
  },

  // ─── PROVEEDORES ──────────────────────────────────────────────────────────
  {
    keywords: ["proveedor", "proveedores", "servicio externo", "contratista", "contractor"],
    modules: ["/vendors", "/service-providers", "/contractors"],
    answer:
      "Los módulos de **Proveedores** gestionan entidades externas relacionadas con el programa PR.\n\n" +
      "- **Proveedores de Servicio PR**: empresas que realizan calibraciones, mantenimientos o dosimetría externa.\n" +
      "- **Contratistas POE Externos**: personal externo que trabaja en zonas clasificadas (requiere dosimetría y capacitación).\n" +
      "- **Proveedores**: catálogo general de proveedores del sistema.",
  },

  // ─── EPP RADIOLÓGICO ──────────────────────────────────────────────────────
  {
    keywords: ["epp", "equipo protección personal", "delantal", "plomado", "protector tiroides", "gafas plomadas"],
    modules: ["/ppe-radiation", "/ppe"],
    answer:
      "El módulo **EPP Radiológico** gestiona el equipamiento de protección personal para radiaciones.\n\n" +
      "- Inventario de delantales plomados, protectores tiroideos y gafas plomadas.\n" +
      "- Control de estado (bueno, con defectos, fuera de servicio).\n" +
      "- Registro de verificaciones periódicas (fluoroscopia o inspección visual).\n" +
      "- Asignación por servicio y usuario.",
  },

  // ─── DOCUMENTOS Y PROCEDIMIENTOS ──────────────────────────────────────────
  {
    keywords: ["documento", "documentos", "procedimiento", "procedimientos", "instructivo", "protocolo"],
    modules: ["/documents", "/procedures"],
    answer:
      "Los módulos **Documentos** y **Procedimientos** centralizan la gestión documental del programa PR.\n\n" +
      "- Suba documentos en PDF, Word u otros formatos.\n" +
      "- Categorice por tipo: procedimiento, instructivo, formulario, registro, manual.\n" +
      "- Control de versiones y fechas de revisión.\n" +
      "- Búsqueda por nombre, categoría o palabra clave.",
  },

  // ─── COMITÉ PR ────────────────────────────────────────────────────────────
  {
    keywords: ["comité", "comite", "sesión", "sesiones", "reunión comité pr"],
    modules: ["/committee"],
    answer:
      "El módulo **Comité PR** registra las sesiones del Comité de Protección Radiológica.\n\n" +
      "- Fecha, asistentes y quórum de cada sesión.\n" +
      "- Actas y acuerdos.\n" +
      "- Seguimiento de compromisos de sesiones anteriores.",
  },

  // ─── AUDITORÍAS INTERNAS ──────────────────────────────────────────────────
  {
    keywords: ["auditoría", "auditoria", "auditorías internas", "auditoria interna"],
    modules: ["/internal-audits", "/audits"],
    answer:
      "El módulo **Auditorías Internas PR** gestiona el programa de auditorías del sistema.\n\n" +
      "- Planificación anual de auditorías.\n" +
      "- Registro de hallazgos con clasificación (mayor/menor/observación).\n" +
      "- Plan de acción para cierre de hallazgos.\n" +
      "- Vinculación con módulo CAPA.",
  },

  // ─── MONITOREO AMBIENTAL ──────────────────────────────────────────────────
  {
    keywords: ["ambiental", "monitoreo ambiental", "ambiente", "entorno"],
    modules: ["/environmental-monitoring"],
    answer:
      "**Monitoreo Ambiental** registra mediciones radiológicas del entorno del establecimiento.\n\n" +
      "- Mediciones de tasa de dosis en áreas públicas limítrofes.\n" +
      "- Control de dosis a miembros del público (límite: 1 mSv/año).\n" +
      "- Muestras de agua, aire u otras matrices si aplica.",
  },

  // ─── DOSIS A MIEMBROS DEL PÚBLICO ────────────────────────────────────────
  {
    keywords: ["público", "miembro público", "dosis público", "1 msv"],
    modules: ["/public-dose"],
    answer:
      "**Dosis a Miembros del Público** controla que la exposición a público no supere el límite.\n\n" +
      "- Límite DS 3/1985: 1 mSv/año para miembros del público (efectiva).\n" +
      "- Se estima a partir de mediciones en zonas accesibles al público y modelos de dispersión.\n" +
      "- Reporte anual incluido en Declaración CCHEN.",
  },

  // ─── AJUSTES ──────────────────────────────────────────────────────────────
  {
    keywords: ["ajustes", "settings", "configurar", "configuración", "usuario", "cuenta", "api key"],
    modules: ["/settings"],
    answer:
      "El módulo **Ajustes** permite configurar el sistema.\n\n" +
      "- **Perfil**: datos del establecimiento, encargado PR y unidad de radiología.\n" +
      "- **Usuarios**: gestión de accesos y roles (super admin, administrador, usuario).\n" +
      "- **Asistente Inteligente**: configurar proveedor de IA (OpenAI, Anthropic) y API key.\n" +
      "- **Notificaciones**: preferencias de alertas por módulo.",
  },

  // ─── ADMINISTRACIÓN DE USUARIOS ───────────────────────────────────────────
  {
    keywords: ["usuario", "usuarios", "rol", "roles", "admin", "super admin", "acceso", "permisos"],
    modules: ["/admin/users"],
    answer:
      "**Administración de Usuarios** gestiona el acceso al sistema.\n\n" +
      "**Roles disponibles:**\n" +
      "- **Super Admin**: acceso total al sistema y configuración.\n" +
      "- **Administrador**: gestión de datos sin configuración avanzada.\n" +
      "- **Usuario**: lectura y registro de datos según módulos asignados.\n\n" +
      "Para crear usuario: Admin → Usuarios → Nuevo Usuario → asignar rol y módulos.",
  },

  // ─── ALERTAS Y VENCIMIENTOS ───────────────────────────────────────────────
  {
    keywords: ["alerta", "alertas", "vencimiento", "vencimientos", "próximo", "proximo", "urgente"],
    modules: ["/alerts", "/expiries", "/notifications"],
    answer:
      "El sistema genera alertas automáticas en varios módulos:\n\n" +
      "**Alertas críticas (rojo):** requieren acción inmediata.\n" +
      "- Dosis sobre límite anual.\n" +
      "- Calibración de instrumento vencida.\n" +
      "- Prueba de estanqueidad fallida.\n" +
      "- Incidente INES ≥ 1 sin notificar.\n\n" +
      "**Advertencias (amarillo):** revisar en breve.\n" +
      "- Examen médico POE próximo a vencer.\n" +
      "- Licencia CCHEN próxima a vencer.\n" +
      "- Dosímetros no devueltos.\n\n" +
      "**Vencimientos**: vista centralizada de todos los ítems con fecha de vencimiento próxima.",
  },

  // ─── BÚSQUEDA GLOBAL ──────────────────────────────────────────────────────
  {
    keywords: ["buscar", "búsqueda", "search", "encontrar", "busqueda global"],
    modules: ["/search"],
    answer:
      "La **Búsqueda Global** permite encontrar cualquier registro del sistema:\n\n" +
      "- Trabajadores por nombre, RUT o servicio.\n" +
      "- Equipos/instrumentos por nombre o número de serie.\n" +
      "- Documentos por título o categoría.\n" +
      "- Incidentes, registros de dosimetría, fuentes radiactivas.\n\n" +
      "Atajo: haga clic en la barra de búsqueda en la parte superior (⌘K / Ctrl+K).",
  },

  // ─── CATÁLOGO DE RADIONÚCLIDOS ────────────────────────────────────────────
  {
    keywords: ["radionúclido", "radionuclido", "catálogo", "catalogo", "isótopo", "isotopo", "vida media"],
    modules: ["/radionuclides"],
    answer:
      "El **Catálogo de Radionúclidos** es una referencia embebida con datos físicos de los principales radionúclidos usados en medicina nuclear y radiofarmacia:\n\n" +
      "- Tc-99m: T½ = 6,02 h, emisor gamma 140 keV.\n" +
      "- I-131: T½ = 8,02 d, emisor beta y gamma 364 keV.\n" +
      "- F-18: T½ = 109,8 min, emisor β+ (511 keV).\n" +
      "- Ga-67: T½ = 3,26 d, emisor gamma múltiple.\n" +
      "- In-111: T½ = 2,80 d, emisor gamma 171/245 keV.\n" +
      "- Tl-201: T½ = 73,1 h, emisor gamma 68–80 keV.\n" +
      "- Mo-99: T½ = 65,9 h, precursor Tc-99m.",
  },

  // ─── NORMATIVA GENERAL ────────────────────────────────────────────────────
  {
    keywords: [
      "normativa", "decreto", "ds3", "ds 3", "reglamento", "cchen", "iaea",
      "límite anual", "limite anual", "legislación", "obligación legal",
    ],
    answer:
      "**Marco normativo aplicable en Chile:**\n\n" +
      "- **DS 3/1985 Minsal**: Reglamento de Protección Radiológica de Instalaciones Radiactivas (el principal).\n" +
      "- **DS 133/1984 Minsal**: Reglamento Sanitario sobre Manejo de Residuos Peligrosos (complementario).\n" +
      "- **Ley 18.302**: Ley de Seguridad Nuclear.\n" +
      "- **IAEA GSR Part 3 (2014)**: Requisitos Generales de Seguridad Radiológica (referencia internacional).\n" +
      "- **IAEA GSG-1**: Clasificación de residuos radiactivos.\n" +
      "- **IAEA Safety Reports Series**: guías de control de calidad (LINAC, medicina nuclear, etc.).\n\n" +
      "**Límites de dosis DS 3/1985:**\n" +
      "- POE Categoría A: 20 mSv/año (promedio 5 años), máx 50 mSv/año.\n" +
      "- POE Categoría B: 6 mSv/año.\n" +
      "- Público general: 1 mSv/año.\n" +
      "- Extremidades (manos/pies): 500 mSv/año.\n" +
      "- Cristalino: 150 mSv/año.",
  },

  // ─── AYUDA GENERAL ────────────────────────────────────────────────────────
  {
    keywords: ["ayuda", "help", "cómo", "como", "qué puedes", "que puedes", "capacidades", "funciones"],
    answer:
      "Soy el **Asistente Inteligente de RPMS** y puedo ayudarte con:\n\n" +
      "✅ **Navegación**: cómo usar cada módulo del sistema.\n" +
      "✅ **Normativa**: límites de dosis, obligaciones CCHEN, DS 3/1985.\n" +
      "✅ **Procedimientos**: flujos de trabajo para dosimetría, residuos, I-131, LINAC, etc.\n" +
      "✅ **Alertas**: qué significan y cómo resolverlas.\n" +
      "✅ **Radionúclidos**: datos físicos básicos.\n\n" +
      "⚠️ No tengo acceso directo a los datos de tu base de datos (no puedo ver registros específicos).\n\n" +
      "¿En qué módulo estás trabajando hoy?",
  },

  // ─── SALUDO / INICIO ──────────────────────────────────────────────────────
  {
    keywords: ["hola", "buenos días", "buenas", "buen día", "buenas tardes", "buenas noches", "saludos"],
    answer:
      "¡Hola! Soy el Asistente Inteligente de RPMS.\n\n" +
      "Puedo ayudarte con cualquier consulta sobre el uso del sistema: módulos, normativa radiológica, procedimientos y alertas. ¿En qué puedo ayudarte hoy?",
  },

  // ─── GRACIAS ──────────────────────────────────────────────────────────────
  {
    keywords: ["gracias", "muchas gracias", "perfecto", "excelente", "ok gracias"],
    answer:
      "¡Con mucho gusto! Si tienes otra consulta sobre RPMS no dudes en escribir. 🟢",
  },
];
