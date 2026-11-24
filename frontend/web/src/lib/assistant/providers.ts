import { generateLocalResponse } from "./local-agent";
import type { AssistantMessage } from "./types";

export interface ProviderConfig {
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  /** Ruta del módulo actual para contexto en respuestas locales */
  currentModule?: string;
}

export interface AssistantProvider {
  id: string;
  send(
    messages: AssistantMessage[],
    systemPrompt: string,
    config: ProviderConfig
  ): Promise<string>;
}

/**
 * Proveedor local — base de conocimiento embebida de RPMS.
 * Funciona completamente sin internet ni API keys externas.
 * Es el fallback automático cuando no hay proveedor externo configurado.
 */
const localProvider: AssistantProvider = {
  id: "local",
  async send(messages, _systemPrompt, config) {
    return generateLocalResponse(messages, config.currentModule);
  },
};

/**
 * Proveedor mock — solo para retrocompatibilidad.
 * En la práctica el sistema usa localProvider como fallback real.
 */
const mockProvider: AssistantProvider = {
  id: "mock",
  async send(messages, _systemPrompt, config) {
    // Usar el agente local en lugar de respuesta genérica
    return generateLocalResponse(messages, config.currentModule);
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
  local: localProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

/**
 * Retorna el proveedor solicitado.
 * Si no se especifica o no existe, retorna el agente local (funciona offline).
 */
export function getProvider(id?: string | null): AssistantProvider {
  if (!id) return localProvider;
  return registry[id] ?? localProvider;
}
