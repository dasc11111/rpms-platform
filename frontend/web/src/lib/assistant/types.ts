export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
}

export type AssistantProviderId = "mock" | "openai" | "anthropic";

export interface AssistantChatRequest {
  messages: AssistantMessage[];
  module?: string;
}

export interface AssistantChatResponse {
  reply: string;
  provider: string;
}

export interface AssistantSettings {
  provider: AssistantProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  hasApiKey: boolean;
}

export interface AssistantSettingsInput {
  provider: AssistantProviderId;
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
}
