/**
 * RPMS Local Agent — motor de respuesta offline.
 * Busca en la base de conocimiento embebida y genera respuestas contextuales.
 * No requiere conexión a internet ni APIs externas.
 */

import { KNOWLEDGE_BASE, type KBEntry } from "./knowledge-base";

/** Normaliza texto para comparación: minúsculas, sin tildes, sin puntuación. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar tildes
    .replace(/[^a-z0-9\s]/g, " ")   // quitar puntuación
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokeniza el texto normalizado en palabras de ≥ 2 caracteres. */
function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter((w) => w.length >= 2);
}

/** Stop-words: palabras comunes sin valor semántico para el scoring */
const STOP_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  "es", "son", "se", "de", "del", "al", "en", "con", "por",
  "para", "que", "cual", "como", "cuando", "donde", "quien",
  "qué", "cómo", "cuál", "cuándo", "dónde", "quién",
  "mi", "tu", "su", "nos", "yo", "me", "te", "le",
  "no", "si", "ya", "más", "muy", "tan", "cada",
  "hay", "puede", "puedo", "hacer", "ver", "usar",
]);

/** Calcula puntuación de coincidencia entre la consulta y una entrada KB. */
function score(queryTokens: string[], entry: KBEntry): number {
  let hits = 0;
  // Filtrar stop-words antes de comparar
  const meaningfulTokens = queryTokens.filter((t) => !STOP_WORDS.has(t) && t.length >= 3);

  for (const qt of meaningfulTokens) {
    for (const kw of entry.keywords) {
      const kwNorm = normalize(kw);
      if (kwNorm === qt) {
        // Match exacto: máxima puntuación
        hits += 3;
      } else if (kwNorm.length >= 4 && qt.length >= 4 && (kwNorm.includes(qt) || qt.includes(kwNorm))) {
        // Match parcial solo si ambos tienen ≥ 4 chars (evita falsos positivos)
        hits += 1;
      }
    }
  }
  return hits;
}

/** Opciones de búsqueda en la KB */
export interface LocalAgentOptions {
  /** Ruta del módulo actual (p.ej. "/dosimetry") */
  currentModule?: string;
}

/** Resultado de búsqueda en la KB */
export interface LocalAgentResult {
  answer: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Busca la mejor respuesta en la base de conocimiento para la consulta dada.
 * Si no hay coincidencias suficientes, retorna una respuesta de ayuda general.
 */
export function queryKnowledgeBase(
  userMessage: string,
  options: LocalAgentOptions = {}
): LocalAgentResult {
  const tokens = tokenize(userMessage);

  if (tokens.length === 0) {
    return {
      answer:
        "Por favor escribe tu consulta sobre RPMS y te ayudaré de inmediato.",
      confidence: "low",
    };
  }

  // Puntuar cada entrada
  const scored = KNOWLEDGE_BASE.map((entry) => ({
    entry,
    pts: score(tokens, entry),
    moduleBonus:
      options.currentModule &&
      entry.modules?.some(
        (m) =>
          options.currentModule === m ||
          options.currentModule?.startsWith(m + "/")
      )
        ? 3
        : 0,
  }));

  // Ordenar por puntuación total (keyword hits + bonus de módulo)
  scored.sort((a, b) => b.pts + b.moduleBonus - (a.pts + a.moduleBonus));

  const best = scored[0];
  const totalScore = best.pts + best.moduleBonus;

  if (totalScore >= 3) {
    return { answer: best.entry.answer, confidence: "high" };
  }
  if (totalScore >= 1) {
    return { answer: best.entry.answer, confidence: "medium" };
  }

  // Sin coincidencias: respuesta de orientación general
  return {
    answer: generalHelp(options.currentModule),
    confidence: "low",
  };
}

/** Respuesta cuando no hay coincidencias claras */
function generalHelp(currentModule?: string): string {
  const moduleHint = currentModule
    ? `Estás en el módulo **${currentModule}**. `
    : "";

  return (
    `${moduleHint}No encontré información específica para tu consulta en mi base de conocimiento.\n\n` +
    "Puedo ayudarte con:\n" +
    "- **Navegación** de cualquier módulo del sistema RPMS\n" +
    "- **Dosimetría** (límites, importación planillas CCHEN, historial)\n" +
    "- **Trabajadores POE** (registro, exámenes médicos, categorías)\n" +
    "- **Residuos Radiactivos** (clasificación IAEA GSG-1, decay, fichas)\n" +
    "- **I-131** (administración, aislamiento, criterios de alta)\n" +
    "- **LINAC** (control de calidad TG-142, incidentes, mantenimientos)\n" +
    "- **Normativa** (DS 3/1985, CCHEN, IAEA GSR Part 3)\n" +
    "- **Alertas y vencimientos** del programa PR\n\n" +
    "Escribe tu pregunta con más detalle o menciona el módulo en el que necesitas ayuda."
  );
}

/**
 * Genera una respuesta completa para el asistente a partir del historial de mensajes.
 * Usa el último mensaje del usuario para buscar en la KB.
 */
export function generateLocalResponse(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  currentModule?: string
): string {
  // Tomar el último mensaje del usuario
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const userText = lastUser?.content?.trim() ?? "";

  if (!userText) {
    return "¿En qué puedo ayudarte con RPMS hoy?";
  }

  const result = queryKnowledgeBase(userText, { currentModule });
  return result.answer;
}
