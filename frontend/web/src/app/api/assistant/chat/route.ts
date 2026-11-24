/**
 * Ruta de chat del Asistente IA de RPMS.
 * Cascada de proveedores: Anthropic → Google Gemini → Fallback local
 *
 * Variables de entorno opcionales:
 *   ANTHROPIC_API_KEY  — sk-ant-...
 *   GEMINI_API_KEY     — AIza...
 *
 * Sin ninguna clave funciona con respuestas locales basadas en
 * la base de conocimiento RPMS embebida.
 */
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/assistant/system-prompt";
import { getModuleLabel } from "@/lib/assistant/modules";
import { localAnswer } from "@/lib/assistant/local-knowledge";

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

  const moduleLabel = modulePath ? getModuleLabel(modulePath) : undefined;
  const systemPrompt = buildSystemPrompt(moduleLabel);
  const history = messages.slice(-20).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // ── 1. Intentar Anthropic ─────────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
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

      if (res.ok) {
        return buildAnthropicStream(res);
      }
      console.warn("[RPMS] Anthropic falló:", res.status, "→ intentando Gemini");
    } catch (err) {
      console.warn("[RPMS] Anthropic error de red:", err, "→ intentando Gemini");
    }
  }

  // ── 2. Intentar Google Gemini ─────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const geminiRes = await callGemini(geminiKey, systemPrompt, history);
      if (geminiRes) {
        return new Response(
          JSON.stringify({ reply: geminiRes, streaming: false, provider: "gemini" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      console.warn("[RPMS] Gemini falló → usando fallback local");
    } catch (err) {
      console.warn("[RPMS] Gemini error:", err, "→ usando fallback local");
    }
  }

  // ── 3. Fallback local inteligente ─────────────────────────────────────────
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const reply = localAnswer(lastUser, moduleLabel);
  return new Response(
    JSON.stringify({ reply, streaming: false, provider: "local" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAnthropicStream(anthropicRes: Response): Response {
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
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta"
              ) {
                const chunk = JSON.stringify({ type: "delta", text: event.delta.text });
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              }
              if (event.type === "message_stop") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
                );
              }
            } catch {
              // ignorar líneas SSE malformadas
            }
          }
        }
      } catch (err) {
        console.error("[RPMS] Stream error:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: "Error leyendo respuesta" })}\n\n`
          )
        );
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
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>
): Promise<string | null> {
  // Gemini 1.5 Flash — gratuito con límites generosos
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Convertir historial al formato Gemini
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : null;
}
