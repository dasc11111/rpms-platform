/**
 * RPMS Web Search — búsqueda web para complementar la KB local.
 * Usa DuckDuckGo Instant Answer API (sin API key, sin límites de uso).
 * Solo se activa cuando el agente local no tiene confianza alta en su respuesta.
 */

export interface WebSearchResult {
  snippet: string;
  source: string;
  title: string;
}

/**
 * Busca en DuckDuckGo Instant Answer API.
 * Retorna el snippet más relevante o null si no hay resultados.
 */
export async function searchDuckDuckGo(
  query: string
): Promise<WebSearchResult | null> {
  try {
    const url =
      "https://api.duckduckgo.com/?q=" +
      encodeURIComponent(query) +
      "&format=json&no_html=1&skip_disambig=1&kl=cl-es";

    const res = await fetch(url, {
      headers: { "User-Agent": "RPMS-Assistant/1.0 (Hospital Hernán Henríquez Aravena)" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();

    // Respuesta directa (Abstract)
    if (data?.AbstractText && data.AbstractText.length > 50) {
      return {
        snippet: data.AbstractText.slice(0, 600),
        source: data.AbstractURL || data.AbstractSource || "DuckDuckGo",
        title: data.Heading || query,
      };
    }

    // Primer resultado de la lista
    if (Array.isArray(data?.RelatedTopics) && data.RelatedTopics.length > 0) {
      const first = data.RelatedTopics[0];
      if (first?.Text && first.Text.length > 30) {
        return {
          snippet: first.Text.slice(0, 500),
          source: first.FirstURL || "DuckDuckGo",
          title: first.Text.slice(0, 60),
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Genera una respuesta enriquecida combinando resultado web con contexto RPMS.
 */
export function formatWebAnswer(
  userMessage: string,
  webResult: WebSearchResult
): string {
  return (
    `No tengo información específica sobre esto en mi base de conocimiento, ` +
    `pero encontré lo siguiente en internet:\n\n` +
    `**${webResult.title}**\n\n` +
    `${webResult.snippet}\n\n` +
    `📡 *Fuente: [${webResult.source}](${webResult.source})*\n\n` +
    `---\n` +
    `Si tu consulta es sobre el sistema RPMS específicamente, ` +
    `puedes preguntar sobre dosimetría, trabajadores POE, residuos, LINAC, ` +
    `I-131, normativa CCHEN/DS 3/1985 o cualquier módulo del sistema.`
  );
}
