/**
 * Mapa completo de rutas del sistema RPMS a etiquetas legibles.
 * Usado por el asistente para proporcionar contexto sobre el módulo actual.
 */
export const MODULE_LABELS: Record<string, string> = {
  // ── Dashboard ─────────────────────────────────────────────
  "/": "Dashboard Ejecutivo PR",
  "/dashboard": "Dashboard Ejecutivo PR",

  // ── Trabajadores ──────────────────────────────────────────
  "/workers": "Trabajadores POE",
  "/workers/new": "Nuevo Trabajador",
  "/workers/edit": "Editar Trabajador",
  "/medical-exams": "Exámenes Médicos POE",

  // ── Dosimetría ────────────────────────────────────────────
  "/dosimetry": "Dosimetría",
  "/dosimeters": "Dosímetros",
  "/dosimetry/worker-history": "Historial de Dosis Individual",
  "/dosimetry/annual-summary": "Resumen Anual de Dosis",
  "/dosimetry/stats": "Estadísticas de Dosis",
  "/dosimetry/quarterly": "Dosis Trimestral",
  "/dosimetry/import-quarterly": "Importar Planilla CCHEN",
  "/dosimetry/import-pdf": "Importar PDF de Dosis CCHEN",
  "/dosimetry/not-returned": "Dosímetros No Devueltos",
  "/dosimetry/late-returns": "Dosímetros Fuera de Plazo",
  "/dosimetry/returns": "Devolución de Dosímetros",
  "/dosimetry/manual": "Ingreso Manual de Dosis",
  "/dosimetry/export": "Exportar Dosis",
  "/internal-dosimetry": "Dosimetría Interna",

  // ── Medicina Nuclear / PET-CT ─────────────────────────────
  "/nuclear-medicine": "Medicina Nuclear",
  "/petct": "PET/CT",
  "/petct/alerts": "Alertas PET/CT",
  "/radiopharmacy": "Radiofarmacia",

  // ── I-131 ─────────────────────────────────────────────────
  "/i131": "Administración I-131",
  "/i131/stats": "Estadísticas I-131",
  "/i131/isolation": "Aislamiento I-131",
  "/i131/suggestions": "Sugerencias I-131",
  "/i131/export": "Exportar I-131",

  // ── Contaminación ─────────────────────────────────────────
  "/contamination": "Registro de Contaminación",
  "/contamination/stats": "Estadísticas Contaminación",
  "/contamination/measurement-points": "Puntos de Medición",
  "/contamination/limits": "Límites de Contaminación",
  "/contamination/export": "Exportar Contaminación",

  // ── Zonas Clasificadas / Monitoreo ────────────────────────
  "/classified-zones": "Zonas Clasificadas",
  "/zone-access": "Control de Acceso a Zonas",
  "/area-monitoring": "Monitoreo de Área",
  "/environmental-monitoring": "Monitoreo Ambiental",
  "/public-dose": "Dosis a Miembros del Público",

  // ── Liberación de Sala ────────────────────────────────────
  "/room-release": "Liberación de Sala",
  "/room-clearance": "Autorización de Sala",
  "/room-clearance/stats": "Estadísticas Liberación de Sala",

  // ── Residuos Radiactivos ──────────────────────────────────
  "/waste": "Residuos Radiactivos",
  "/waste-management": "Gestión de Residuos",
  "/waste-expert": "Sistema Experto Residuos",
  "/waste-records": "Fichas de Residuos",
  "/waste-calibration": "Calibración Detectores Residuos",
  "/waste-contamination-criteria": "Criterios de Contaminación Residuos",
  "/waste-release-criteria": "Criterios de Liberación Residuos",
  "/waste-items": "Ítems de Residuos",
  "/waste-labels": "Rótulos de Residuos",
  "/waste-labels/stats": "Estadísticas Rótulos",
  "/waste-storage": "Almacenamiento Temporal",
  "/waste-storage/dashboard": "Dashboard Almacenamiento",
  "/waste-storage/inventory": "Inventario Almacenamiento",
  "/waste-storage/locations": "Ubicaciones Almacenamiento",
  "/waste-storage/movements": "Movimientos Almacenamiento",
  "/waste-storage/export": "Exportar Almacenamiento",

  // ── Equipos e Instrumentos ────────────────────────────────
  "/equipment": "Equipos",
  "/instruments": "Instrumentos",
  "/instruments/operational-check": "Verificación Operacional",
  "/instruments/calibrations": "Calibraciones",
  "/calibrations-overview": "Resumen de Calibraciones",
  "/instruments/maintenances": "Mantenimientos",
  "/maintenances-overview": "Resumen de Mantenimientos",
  "/ppe-radiation": "EPP Radiológico",
  "/ppe": "Equipos de Protección Personal",

  // ── Fuentes Radiactivas ───────────────────────────────────
  "/sources": "Fuentes Radiactivas",
  "/sources/movements": "Movimientos IMAR",
  "/sealed-sources": "Fuentes Selladas",
  "/leak-tests": "Pruebas de Estanqueidad",

  // ── LINAC / CML ───────────────────────────────────────────
  "/linac": "LINAC / CML",
  "/linac/dashboard": "Dashboard LINAC",
  "/linac/qc": "Control de Calidad LINAC",
  "/linac/incidents": "Incidentes LINAC",
  "/linac/maintenance": "Mantenimiento LINAC",
  "/linac/trends": "Tendencias LINAC",
  "/linac/documents": "Documentos LINAC",
  "/linac/authorizations": "Autorizaciones LINAC",
  "/linac/radiation": "Protección Radiológica LINAC",
  "/linac/alerts": "Alertas LINAC",
  "/linac/records": "Registros LINAC",
  "/linac/commissioning": "Comisionamiento LINAC",
  "/linac/baseline": "Datos Baseline LINAC",
  "/linac/beamdata": "Datos de Haz LINAC",
  "/linac/criteria": "Criterios QC LINAC",
  "/linac/acceptance": "Aceptación LINAC",
  "/linac/instrument-validation": "Validación Instrumentos LINAC",
  "/linac/export": "Exportar LINAC",

  // ── Transporte ────────────────────────────────────────────
  "/transport": "Transporte Radiactivo",
  "/transport/dashboard": "Dashboard Transporte",
  "/transport/authorization": "Autorización de Transporte CCHEN",
  "/transport/drivers": "Conductores Autorizados",
  "/transport/oprs": "OPRs de Transporte",
  "/transport/dispatch-documents": "Documentos de Despacho",
  "/transport/radionuclides": "Catálogo Radionúclidos Transporte",

  // ── Incidentes / Emergencias ──────────────────────────────
  "/incidents": "Incidentes",
  "/emergency": "Plan de Contingencia",
  "/emergency-drills": "Simulacros de Emergencia",
  "/spills": "Derrames Radiactivos",

  // ── Programa ALARA / Indicadores ──────────────────────────
  "/alara": "Programa ALARA",
  "/indicators": "Indicadores de Desempeño PR",
  "/radiation-program": "Programa PR",
  "/encargado-pr": "Portal Encargado PR",

  // ── Capacitación / Comité / Logbook ───────────────────────
  "/training": "Capacitación PR",
  "/committee": "Comité PR",
  "/logbook": "Libro de Novedades",

  // ── CCHEN ─────────────────────────────────────────────────
  "/cchen-declarations": "Declaraciones CCHEN",
  "/cchen-inspections": "Inspecciones CCHEN",
  "/operating-licenses": "Licencias de Operación",
  "/cchen-communications": "Comunicaciones CCHEN",
  "/cchen-licenses": "Licencias CCHEN",
  "/licenses": "Licencias",
  "/f01-cchen": "Formulario F-01 CCHEN",
  "/inspections": "Inspecciones",

  // ── Cumplimiento / CAPA / Auditorías ──────────────────────
  "/compliance": "Cumplimiento NS-06.0",
  "/capa": "CAPA (Acción Correctiva y Preventiva)",
  "/internal-audits": "Auditorías Internas PR",
  "/audits": "Auditorías",

  // ── Informes ──────────────────────────────────────────────
  "/reports": "Reportes",
  "/management-report": "Informe de Gestión PR",
  "/annual-report": "Informe Anual Integrado",
  "/reports/annual-cchen": "Informe Anual CCHEN",

  // ── Proveedores / Contratistas ────────────────────────────
  "/vendors": "Proveedores",
  "/service-providers": "Proveedores de Servicio PR",
  "/contractors": "Contratistas POE Externos",

  // ── Catálogo Radionúclidos ────────────────────────────────
  "/radionuclides": "Catálogo de Radionúclidos",

  // ── Alertas / Vencimientos ────────────────────────────────
  "/alerts": "Alertas del Sistema",
  "/expiries": "Vencimientos",
  "/notifications": "Notificaciones",

  // ── Búsqueda ──────────────────────────────────────────────
  "/search": "Búsqueda Global",

  // ── Ajustes ───────────────────────────────────────────────
  "/settings": "Ajustes del Sistema",
  "/admin/users": "Administración de Usuarios",
};

/**
 * Obtiene la etiqueta del módulo para una ruta dada.
 * Busca coincidencia exacta primero; luego por prefijo (ruta padre).
 */
export function getModuleLabel(path?: string): string | undefined {
  if (!path) return undefined;

  // Coincidencia exacta
  if (MODULE_LABELS[path]) return MODULE_LABELS[path];

  // Buscar por prefijo más específico
  const segments = path.split("/").filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const candidate = "/" + segments.slice(0, i).join("/");
    if (MODULE_LABELS[candidate]) return MODULE_LABELS[candidate];
  }

  return undefined;
}

/**
 * Obtiene la ruta raíz del módulo (primer segmento).
 * P.ej.: "/dosimetry/import-pdf" → "/dosimetry"
 */
export function getModuleRoot(path?: string): string | undefined {
  if (!path) return undefined;
  const segments = path.split("/").filter(Boolean);
  return segments.length > 0 ? `/${segments[0]}` : path;
}
