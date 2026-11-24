/**
 * Motor de respuestas locales del Asistente RPMS.
 * Funciona sin ninguna API externa — base de conocimiento embebida
 * sobre protección radiológica según normativa chilena.
 */

interface KnowledgeEntry {
  keywords: string[];
  answer: string;
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ── LÍMITES DE DOSIS ──────────────────────────────────────────────────────
  {
    keywords: ["límite", "limite", "dosis", "límites de dosis", "dosis límite"],
    answer: `**Límites de Dosis — DS 3/1985 Minsal (Chile)**

**Personas Ocupacionalmente Expuestas (POE):**
- Dosis efectiva: **20 mSv/año** (promedio 5 años, máx. 50 mSv en un año)
- Cristalino: **150 mSv/año**
- Extremidades (manos, pies) y piel: **500 mSv/año**

**Público general:**
- Dosis efectiva: **1 mSv/año**
- Cristalino: **15 mSv/año**
- Piel: **50 mSv/año**

**Embarazadas (una vez declarado el embarazo):**
- Dosis al embrión/feto: **1 mSv** durante todo el embarazo

Referencia: DS 3/1985 Art. 49; NS-06.0 CCHEN; ICRP 103.`,
  },

  // ── DOSIMETRÍA ───────────────────────────────────────────────────────────
  {
    keywords: ["dosimetría", "dosimetria", "dosímetro", "dosimetro", "tld", "osl", "lectura dosimétrica"],
    answer: `**Dosimetría Personal — RPMS**

**Frecuencia de lectura:**
- Dosímetros de cuerpo entero (TLD/OSL): lectura **mensual** como mínimo
- Dosímetros de extremidades: lectura **mensual**
- Lectura trimestral permitida si la dosis esperada < 1 mSv/mes

**Uso correcto:**
- Dosímetro de cuerpo entero: a la altura del tórax, exterior del delantal plomado
- Si se usa dosímetro bajo el delantal además: registrar ambas lecturas
- No exponer al calor, humedad ni campos de alta intensidad fuera del trabajo

**Registro obligatorio:**
- Libreta dosimétrica individual (Art. 54 DS 3/1985)
- Conservar registros **30 años** mínimo tras el cese de actividades

**Umbral de investigación:** Dosis mensual > 2 mSv → investigar causa (NS-06.0 CCHEN).`,
  },

  // ── RESIDUOS RADIACTIVOS ──────────────────────────────────────────────────
  {
    keywords: ["residuos", "residuo", "desecho", "desechos radiactivos", "material radiactivo", "segregación"],
    answer: `**Gestión de Residuos Radiactivos — Normativa Chilena**

**Marco legal:** NS-06.0 CCHEN; DS 3/1985 Art. 73-82

**Clasificación:**
- **Vida corta** (T½ < 100 d): almacenar hasta actividad < 10 × LAI, luego gestionar como residuo convencional
- **Vida larga**: tramitar con CCHEN para disposición final

**Obligaciones del establecimiento:**
1. Libro de registro de residuos (ingreso, almacenamiento, destino)
2. Contenedores plomados identificados con símbolo de radiación
3. Área de almacenamiento segregada, con señalización y acceso controlado
4. Plan de manejo de residuos aprobado por CCHEN

**Medicina nuclear (Tc-99m, I-131):**
- Tc-99m (T½ = 6 h): almacenar ≥ 10 semividas (~60 h) antes de disposición
- I-131 (T½ = 8 d): almacenar ≥ 80 días; pacientes internados en habitación especial

Consulte a la CCHEN para actualización de LAI y requisitos de disposición.`,
  },

  // ── CCHEN / LICENCIAS ─────────────────────────────────────────────────────
  {
    keywords: ["cchen", "licencia", "autorización", "registro", "certificado", "habilitación"],
    answer: `**CCHEN — Comisión Chilena de Energía Nuclear**

**¿Qué requiere autorización?**
- Uso de equipos generadores de radiación ionizante (rayos X, aceleradores)
- Uso, posesión o transferencia de material radiactivo
- Instalación o modificación de salas de radioterapia/medicina nuclear

**Proceso de autorización (NS-04.0 CCHEN):**
1. Solicitud formal con documentación técnica y de seguridad
2. Inspección de la instalación por parte de CCHEN
3. Emisión de Licencia de Instalación + Licencia de Operación
4. Renovación periódica (generalmente cada 2-3 años)

**Documentos requeridos habituales:**
- Planos de blindaje con cálculo dosimétrico
- Manual de Protección Radiológica de la instalación
- Calificación del Oficial de Protección Radiológica (OPR)
- Programa de control de calidad de equipos

**Contacto CCHEN:** www.cchen.cl | Mesa central: (56-2) 2270-4500

El OPR puede tramitar directamente en la plataforma digital CCHEN.`,
  },

  // ── OFICIAL DE PROTECCIÓN RADIOLÓGICA ────────────────────────────────────
  {
    keywords: ["opr", "oficial", "protección radiológica", "oficial de proteccion", "responsabilidades opr"],
    answer: `**Oficial de Protección Radiológica (OPR)**

**Requisitos (DS 3/1985 y NS-06.0):**
- Título profesional en área pertinente (Tecnólogo Médico, Físico, Ingeniero u otro aprobado por CCHEN)
- Acreditación vigente ante CCHEN (examen y curso de habilitación)
- Renovación de acreditación cada 5 años

**Responsabilidades principales:**
1. Supervisar la aplicación del Programa de Protección Radiológica
2. Mantener registros dosimétricos de todo el personal POE
3. Gestionar licencias y permisos ante CCHEN
4. Investigar sobreexposiciones e incidentes radiológicos
5. Capacitar al personal en radioprotección
6. Supervisar el uso correcto de EPP y dosímetros
7. Notificar a CCHEN eventos significativos (Art. 70 DS 3/1985)

**El RPMS facilita al OPR:**
- Registro centralizado de dosis individuales
- Alertas automáticas al acercarse a límites
- Generación de informes para CCHEN
- Gestión de inventario de equipos y fuentes`,
  },

  // ── EQUIPOS DE PROTECCIÓN PERSONAL ───────────────────────────────────────
  {
    keywords: ["epp", "delantal", "protección personal", "equipo protección", "chaleco plomado", "gafas plomadas", "protector tiroideo"],
    answer: `**Equipos de Protección Personal (EPP) Radiológico**

**Delantal plomado:**
- Equivalencia mínima: **0,25 mmPb** (uso general); 0,5 mmPb en zonas de alta dispersión
- Verificación anual con fluoroscopia para detectar grietas
- Almacenar colgado (nunca doblado) para evitar fisuras

**Otros EPP estándar:**
| Equipo | Equivalencia mínima | Obligatorio en |
|--------|-------------------|----------------|
| Protector tiroideo | 0,25 mmPb | Radiología intervencionista, fluoroscopia |
| Gafas plomadas | 0,25 mmPb | Procedimientos con exposición prolongada al cristalino |
| Guantes plomados | 0,25 mmPb | Mano en campo primario |
| Falda plomada | 0,25 mmPb | Intervencionismo, angiopacks |

**Registros obligatorios:**
- Inventario con N° de serie, fecha de adquisición, equivalencia Pb
- Registro de verificaciones anuales
- Reposición si se detectan grietas o equivalencia < especificada

RPMS → Módulo Inventario permite registrar y programar verificaciones.`,
  },

  // ── RADIOPROTECCIÓN EN EMBARAZO ───────────────────────────────────────────
  {
    keywords: ["embarazo", "embarazada", "gestante", "maternidad", "feto", "embrión"],
    answer: `**Protección Radiológica en el Embarazo**

**Obligación de la trabajadora:** Declarar el embarazo por escrito al empleador y al OPR tan pronto como sea conocido (DS 3/1985 Art. 51).

**Límite aplicable desde la declaración:**
- Dosis al embrión/feto: **≤ 1 mSv** durante todo el resto del embarazo
- Equivale a mantener la dosis mensual < 0,1 mSv

**Medidas del empleador:**
1. Reasignación temporal a zona no controlada o con baja exposición
2. Prohibición de trabajar en zonas de alta dosis
3. Dosimetría abdominal adicional (segundo dosímetro a nivel del abdomen)
4. No puede descontarse de remuneraciones por reasignación

**Registro:**
- Anotar en libreta dosimétrica la fecha de declaración
- Registrar dosis abdominal mensual hasta el término del embarazo

**Lactancia:** No hay restricción legal específica en la norma chilena, pero se recomienda minimizar la exposición durante el período de lactancia.`,
  },

  // ── INCIDENTES Y SOBREEXPOSICIONES ───────────────────────────────────────
  {
    keywords: ["incidente", "accidente", "sobreexposición", "sobreexposicion", "emergencia radiológica", "alarma", "investigación"],
    answer: `**Gestión de Incidentes Radiológicos**

**Clasificación de eventos (IAEA GSG-1):**
- **Desviación:** Dosis inesperada pero < 3× límite anual → investigar internamente
- **Sobreexposición:** Dosis > límite legal → notificación obligatoria a CCHEN
- **Emergencia:** Riesgo inmediato para personas o ambiente → activar plan de emergencia

**Protocolo ante sospecha de sobreexposición:**
1. Retirar al trabajador de la zona de forma inmediata
2. Preservar dosímetros para lectura urgente
3. Notificar al OPR en < 24 horas
4. OPR notifica a CCHEN en < 72 horas (Art. 70 DS 3/1985)
5. Iniciar investigación formal: causa, cronología, dosis recibida
6. Medidas correctivas y seguimiento médico si corresponde

**Contenido del informe a CCHEN:**
- Identificación del trabajador (anónima si es posible)
- Estimación de dosis recibida
- Circunstancias del evento
- Medidas correctivas implementadas

RPMS → Módulo Incidentes permite registrar y hacer seguimiento.`,
  },

  // ── ZONAS CONTROLADAS ────────────────────────────────────────────────────
  {
    keywords: ["zona controlada", "zona supervisada", "clasificación de zonas", "zonas de radiación", "señalización"],
    answer: `**Clasificación de Zonas Radiológicas**

**DS 3/1985 Art. 44 — Zonas en instalaciones:**

| Zona | Criterio (tasa de dosis) | Acceso |
|------|--------------------------|--------|
| **Zona Controlada** | > 3 mSv/semana o posible contaminación | Solo POE con dosímetro |
| **Zona Supervisada** | 1–3 mSv/semana | Personal autorizado |
| **Zona Libre** | < 1 mSv/semana | Sin restricciones |

**Señalización obligatoria:**
- Símbolo de radiación ionizante (trébol magenta/negro sobre fondo amarillo)
- Letrero: "PELIGRO — ZONA CONTROLADA / RADIACIÓN" con tasa de dosis máxima
- Instrucciones de acceso visibles en la entrada

**Requisitos de la zona controlada:**
- Acceso restringido y controlado
- Registro de ingreso/egreso cuando la dosis potencial > 6 mSv/mes
- Interlock o señal luminosa para equipos de rayos X
- Plan de emergencia disponible

**Monitoreo ambiental:** mediciones periódicas de tasa de dosis (mensual o tras cambios en la instalación).`,
  },

  // ── PROGRAMA DE PROTECCIÓN RADIOLÓGICA ───────────────────────────────────
  {
    keywords: ["programa de protección", "ppr", "programa radioprotección", "plan de radioprotección"],
    answer: `**Programa de Protección Radiológica (PPR)**

**Contenido mínimo exigido por NS-06.0 CCHEN:**

1. **Política y organización:** responsabilidades del OPR, estructura jerárquica
2. **Inventario de fuentes y equipos:** descripción, actividad/kV, fecha de calibración
3. **Clasificación de trabajadores:** POE vs. no-POE; zonas de trabajo
4. **Programa dosimétrico:** tipo de dosímetro, frecuencia de lectura, laboratorio acreditado
5. **Procedimientos de trabajo:** protocolos seguros para cada tipo de práctica
6. **Plan de capacitación:** inducción + actualización anual mínimo
7. **Plan de emergencias:** procedimientos ante accidentes o sobreexposiciones
8. **Gestión de residuos:** clasificación, almacenamiento, disposición
9. **Control de calidad de equipos:** frecuencia de pruebas, estándares
10. **Registros y auditorías:** dónde y por cuánto tiempo se archivan

**El RPMS centraliza** los módulos 3-8, generando los registros que el PPR requiere y facilitando auditorías de CCHEN.`,
  },

  // ── RADIOLOGÍA / RAYOS X ──────────────────────────────────────────────────
  {
    keywords: ["rayos x", "radiografía", "fluoroscopia", "tomografía", "tc", "equipo de rayos", "diagnóstico por imágenes"],
    answer: `**Protección en Radiología Diagnóstica**

**Principios ALARA:**
- **Justificación:** toda exposición médica debe tener beneficio diagnóstico claro
- **Optimización:** mínima dosis compatible con imagen diagnóstica de calidad
- **Limitación:** cumplir límites para POE y público (no aplica a pacientes)

**Control de calidad obligatorio (NS-04.0 CCHEN):**
- Pruebas de aceptación al instalar el equipo
- Pruebas periódicas: mensual (básicas), semestral (completas), anual (exhaustiva)
- Calibración por laboratorio acreditado CCHEN

**Protección en fluoroscopia/intervencionismo:**
- Distancia máxima posible del haz primario
- Colimación estricta al área de interés
- Uso obligatorio de delantal + protector tiroideo + gafas plomadas
- Monitoreo con dosímetro activo (alarma) en procedimientos prolongados

**Para técnicos en radiología:**
- No permanecer en la sala durante la exposición (usar cabina o sala de control)
- Si debe asistir al paciente: EPP completo y registrar en dosímetro

Niveles de Referencia Diagnósticos (NRD): consultar los publicados por CCHEN/Minsal.`,
  },

  // ── MEDICINA NUCLEAR ──────────────────────────────────────────────────────
  {
    keywords: ["medicina nuclear", "radiofármaco", "radiofarmaco", "gamma cámara", "pet", "spect", "tc-99", "i-131"],
    answer: `**Protección Radiológica en Medicina Nuclear**

**Autorizaciones necesarias:**
- Licencia CCHEN para posesión y uso de material radiactivo
- Autorización de la instalación (sala caliente, cámaras gamma, sala de terapia)

**Manejo de radiofármacos:**
- Preparación en campana de flujo laminar tipo L (protección contra contaminación)
- Uso de jeringa blindada para actividades > 100 MBq
- Medición de dosis administrada con calibrador de dosis (trazabilidad CCHEN)
- Registro de cada administración en libro de radiofármacos

**Protección del personal:**
- Distancia, tiempo y blindaje (regla fundamental)
- Guantes dobles para manejo de alta actividad
- Monitoreo de contaminación (detector GM) al finalizar cada jornada
- Dosímetros de cristalino si trabajo frecuente con alta actividad

**Pacientes con I-131 (terapia):**
- Hospitalizados en habitación individual con blindaje
- Alta cuando tasa de dosis a 1 m < 25 μSv/h (criterio NS-06.0)
- Instrucciones escritas al alta sobre precauciones domiciliarias

**Residuos:** ver sección de gestión de residuos.`,
  },

  // ── RADIOTERAPIA ──────────────────────────────────────────────────────────
  {
    keywords: ["radioterapia", "acelerador lineal", "braquiterapia", "cobaltoterapia", "bunker", "sala de tratamiento"],
    answer: `**Protección Radiológica en Radioterapia**

**Sala de tratamiento (bunker):**
- Cálculo de blindaje según carga de trabajo semanal (kVp, mA, dirección del haz)
- Sistemas de enclavamiento (interlock): puerta + haz automáticamente
- Sistema de vigilancia CCTV + intercomunicador
- Monitor de radiación en sala (alarma en caso de falla de interlock)

**Acelerador lineal (LINAC):**
- Revisiones diarias de seguridad antes del primer paciente
- Control de calidad mensual/anual según IAEA TRS 398 (dosimetría)
- Verificación de haces de fotones y electrones periódicamente

**Braquiterapia:**
- Plan de emergencia específico para fuentes no retraídas
- Equipo de emergencia (contenedor plomado, pinzas largas) siempre disponible
- Verificación de retracción de fuente en cada tratamiento

**Personal de radioterapia:**
- Dosímetro de cuerpo entero + dosímetro de extremidades si manipula fuentes
- Capacitación en procedimiento de emergencia de fuente atascada
- Físico médico disponible o de turno en instalaciones de alta complejidad`,
  },

  // ── CAPACITACIÓN ─────────────────────────────────────────────────────────
  {
    keywords: ["capacitación", "capacitacion", "formación", "entrenamiento", "curso", "inducción"],
    answer: `**Capacitación en Protección Radiológica**

**Obligaciones legales (DS 3/1985 Art. 56):**
- Capacitación **antes del inicio** de actividades con radiación
- Actualización anual mínima para todo el personal POE
- Registro de asistencia y contenidos (disponible para inspección CCHEN)

**Contenido mínimo de la inducción:**
1. Fundamentos de radiación ionizante y efectos biológicos
2. Límites de dosis aplicables
3. Principio ALARA
4. Uso correcto de dosímetros y EPP
5. Zonas controladas: señalización y normas de acceso
6. Procedimientos de emergencia de la instalación
7. A quién reportar incidentes (OPR, cadena de mando)

**Contenido anual recomendado:**
- Revisión de dosis recibidas del año anterior
- Resultados de auditorías y mejoras implementadas
- Actualización normativa (nuevas resoluciones CCHEN/Minsal)
- Simulacro de emergencia radiológica

**RPMS → Módulo Capacitación:** registre asistentes, contenidos y adjunte material.`,
  },

  // ── NORMATIVA GENERAL ─────────────────────────────────────────────────────
  {
    keywords: ["normativa", "decreto", "ds 3", "reglamento", "legislación", "marco legal", "cchen resolución"],
    answer: `**Marco Normativo — Protección Radiológica en Chile**

**Legislación principal:**
| Instrumento | Contenido clave |
|-------------|-----------------|
| **DS 3/1985 Minsal** | Reglamento de protección radiológica; límites de dosis, obligaciones del empleador/OPR, sanciones |
| **Ley 18.302** | Seguridad nuclear; atribuciones CCHEN; sanciones penales |
| **NS-06.0 CCHEN** | Requisitos de protección radiológica para instalaciones |
| **NS-04.0 CCHEN** | Autorización de instalaciones y equipos; control de calidad |

**Guías internacionales adoptadas:**
- **IAEA GSG-1:** Categorización y manejo de fuentes radiactivas
- **ICRP 103:** Fundamentos del sistema de protección radiológica (2007)
- **IAEA TRS 398/430:** Dosimetría en radioterapia/radiodiagnóstico

**Fiscalización:**
- **CCHEN:** instalaciones con material radiactivo y aceleradores
- **Seremi de Salud:** equipos de rayos X diagnósticos (delegación Minsal)
- **Superintendencia de Salud:** establecimientos de salud

Para resolver dudas normativas: contacte la División de Seguridad Radiológica de CCHEN o la Seremi de Salud de su región.`,
  },

  // ── RPMS GENERAL ─────────────────────────────────────────────────────────
  {
    keywords: ["rpms", "sistema de gestión", "módulo", "plataforma", "cómo usar", "funciones"],
    answer: `**Sistema RPMS — Gestión de Protección Radiológica**

El RPMS (Radiation Protection Management System) centraliza la gestión radiológica del establecimiento de salud.

**Módulos principales:**
| Módulo | Función |
|--------|---------|
| **Dosimetría** | Registro y seguimiento de dosis individuales, alertas de límites |
| **Personal POE** | Fichas de trabajadores, categorías, certificados |
| **Equipos** | Inventario de equipos de radiación, calibraciones, mantenciones |
| **Capacitación** | Registro de cursos, asistencia y certificados |
| **Incidentes** | Registro y seguimiento de eventos radiológicos |
| **Residuos** | Control de residuos radiactivos y disposición |
| **Documentos** | PPR, procedimientos, licencias CCHEN |
| **Informes** | Reportes para OPR, dirección y autoridades |

**Acceso por rol:**
- **OPR:** acceso total a todos los módulos
- **Jefatura:** reportes y estadísticas
- **Técnico:** registro de actividades propias

Para soporte técnico, contacte al administrador del sistema de su institución.`,
  },
];

// ─── Genérica de bienvenida / ayuda ──────────────────────────────────────────
const WELCOME_ANSWER = `**Asistente RPMS — Protección Radiológica**

Puedo ayudarte con información sobre:

- 📊 **Límites de dosis** (DS 3/1985, ICRP 103)
- 🔬 **Dosimetría personal** — uso, lectura y registro
- ☢️ **Gestión de residuos radiactivos**
- 📋 **Licencias y autorizaciones CCHEN** (NS-04.0)
- 👷 **Responsabilidades del OPR** y del empleador
- 🦺 **EPP radiológico** — tipos y verificación
- 🤰 **Protección en el embarazo**
- 🚨 **Incidentes y sobreexposiciones** — protocolo
- 🏭 **Zonas controladas** — clasificación y señalización
- 📚 **Programa de Protección Radiológica** (PPR)
- 🏥 **Radiología, Medicina Nuclear, Radioterapia**
- ⚖️ **Marco normativo chileno** (DS 3, NS-06.0, NS-04.0)

**¿Sobre qué tema tienes una consulta?**

> _Nota: Para acceder a respuestas más detalladas y personalizadas configure la clave de API del asistente IA._`;

// ─── Motor de búsqueda ───────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar tildes
    .replace(/[^a-z0-9\s]/g, " ");
}

function score(query: string, entry: KnowledgeEntry): number {
  const q = normalize(query);
  const words = q.split(/\s+/).filter(Boolean);
  let hits = 0;
  for (const kw of entry.keywords) {
    const nkw = normalize(kw);
    if (q.includes(nkw)) hits += 3; // frase completa
    else {
      for (const w of words) {
        if (nkw.includes(w) && w.length >= 3) hits += 1;
      }
    }
  }
  return hits;
}

export function localAnswer(userMessage: string, moduleLabel?: string): string {
  if (!userMessage.trim()) return WELCOME_ANSWER;

  // Buscar la mejor entrada
  let best: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    const s = score(userMessage, entry);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }

  // Umbral mínimo de confianza
  if (bestScore < 2 || !best) {
    return `**Consulta no reconocida localmente**

No encontré información específica sobre _"${userMessage.slice(0, 80)}"_ en mi base de conocimiento local.

**Puedo ayudarte con estos temas:**
- Límites de dosis y dosimetría
- Residuos radiactivos
- Licencias CCHEN y normativa (DS 3/1985, NS-06.0, NS-04.0)
- EPP radiológico
- Gestión de incidentes
- Programa de Protección Radiológica (PPR)
- Capacitación del personal

> Para respuestas más completas y contextualizadas, el administrador puede configurar la integración con IA en Ajustes del sistema.`;
  }

  const contextNote = moduleLabel
    ? `\n\n---\n_Consulta desde módulo: **${moduleLabel}**_`
    : "";

  return best.answer + contextNote;
}
