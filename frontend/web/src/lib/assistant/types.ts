export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  type: "delta" | "done" | "error";
  text?: string;
  error?: string;
}
