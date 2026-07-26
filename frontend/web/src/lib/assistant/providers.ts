import type { AssistantMessage } from "./types";

export interface ProviderConfig {
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

export interface AssistantProvider {
  id: string;
  send(
    messages: AssistantMessage[],
    systemPrompt: string,
    config: ProviderConfig
  ): Promise<string>;
}

const mockProvider: AssistantProvider = {
  id: "mock",
  async send(messages) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const question = lastUser?.content?.trim() || "";
    return (
      "Aún no hay un proveedor de inteligencia artificial configurado. " +
      "Esta es una respuesta de demostración generada localmente.\n\n" +
      (question ? `Recibí tu mensaje: "${question.slice(0, 200)}". ` : "") +
      "Para habilitar respuestas reales, configura un proveedor de IA en Ajustes → Asistente Inteligente."
    );
  },
};

const openaiProvider: AssistantProvider = {
  id: "openai",
  async send(messages, systemPrompt, config) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI error (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
  },
};

const anthropicProvider: AssistantProvider = {
  id: "anthropic",
  async send(messages, systemPrompt, config) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model || "claude-3-5-sonnet-20241022",
        max_tokens: config.maxTokens || 1024,
        temperature: config.temperature,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic error (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() || "";
  },
};

const registry: Record<string, AssistantProvider> = {
  mock: mockProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

export function getProvider(id?: string | null): AssistantProvider {
  if (!id) return mockProvider;
  return registry[id] ?? mockProvider;
}
