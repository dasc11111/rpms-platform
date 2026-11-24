/**
 * Ruta de chat del Asistente IA de RPMS.
 * Usa la API de Anthropic con streaming SSE nativo.
 * Requiere ANTHROPIC_API_KEY como variable de entorno.
 */
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/assistant/system-prompt";
import { getModuleLabel } from "@/lib/assistant/modules";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  module?: string;
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, module: modulePath } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Se requieren mensajes" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Sin clave API: respuesta de fallback
    return fallbackResponse(messages, modulePath);
  }

  const moduleLabel = modulePath ? getModuleLabel(modulePath) : undefined;
  const systemPrompt = buildSystemPrompt(moduleLabel);

  // Construir historial (máximo últimos 20 mensajes para no sobrepasar contexto)
  const history = messages.slice(-20).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
        stream: true,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      console.error("[RPMS Assistant] Anthropic API error:", anthropicRes.status, errText);
      return fallbackResponse(messages, modulePath);
    }

    // Redirigir stream SSE directamente al cliente
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = anthropicRes.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const event = JSON.parse(data);
                if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                  const chunk = JSON.stringify({ type: "delta", text: event.delta.text });
                  controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                }
                if (event.type === "message_stop") {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                }
              } catch {
                // Ignorar líneas SSE malformadas
              }
            }
          }
        } catch (err) {
          console.error("[RPMS Assistant] Stream error:", err);
          const errMsg = JSON.stringify({ type: "error", error: "Error leyendo respuesta" });
          controller.enqueue(encoder.encode(`data: ${errMsg}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[RPMS Assistant] Fetch error:", err);
    return fallbackResponse(messages, modulePath);
  }
}

/**
 * Respuesta de fallback cuando no hay API key o falla la conexión.
 * Responde con contexto básico del módulo actual.
 */
function fallbackResponse(
  messages: Array<{ role: string; content: string }>,
  modulePath?: string
): Response {
  const moduleLabel = modulePath ? getModuleLabel(modulePath) : undefined;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  let reply = "Hola, soy el Asistente RPMS. ";

  if (moduleLabel) {
    reply += `Estás en el módulo **${moduleLabel}**. `;
  }

  if (lastUser.toLowerCase().includes("dosis") || lastUser.toLowerCase().includes("dosimetr")) {
    reply +=
      "Para consultas de dosimetría, recuerda que el límite de dosis efectiva para trabajadores POE en Chile es **20 mSv/año** según DS 3/1985 y NS-06.0 CCHEN. Para detalles específicos, configura una API key de Anthropic en Ajustes del sistema.";
  } else if (lastUser.toLowerCase().includes("residuo") || lastUser.toLowerCase().includes("waste")) {
    reply +=
      "La gestión de residuos radiactivos se rige por NS-04.0 CCHEN e IAEA GSG-1. Para asesoría específica, configura una API key de Anthropic en Ajustes del sistema.";
  } else if (lastUser.toLowerCase().includes("cchen") || lastUser.toLowerCase().includes("licencia")) {
    reply +=
      "Las declaraciones e informes CCHEN se gestionan desde los módulos correspondientes. Para ayuda detallada, configura una API key de Anthropic en Ajustes del sistema.";
  } else {
    reply +=
      "Para respuestas inteligentes y contextuales, configura una **API key de Anthropic** en Ajustes → Asistente IA. Sin la clave, solo puedo ofrecer respuestas básicas.";
  }

  return new Response(JSON.stringify({ reply, streaming: false }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
