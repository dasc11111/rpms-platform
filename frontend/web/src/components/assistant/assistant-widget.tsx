"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Loader2,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getModuleLabel, getModuleRoot } from "@/lib/assistant/modules";
import type { ChatMessage } from "@/lib/assistant/types";

const STORAGE_KEY = "rpms-ai-chat-v2";

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function welcome(): ChatMessage {
  return {
    id: uid(),
    role: "assistant",
    content:
      "¡Hola! Soy el **Asistente IA de RPMS** ✨\n\n" +
      "Estoy especializado en protección radiológica y puedo ayudarte con:\n\n" +
      "• Dosimetría y límites normativos (DS 3/1985, NS-06.0)\n" +
      "• Residuos radiactivos (NS-04.0, IAEA GSG-1)\n" +
      "• I-131, PET/CT, LINAC y Medicina Nuclear\n" +
      "• Declaraciones e inspecciones CCHEN\n" +
      "• Cualquier módulo del sistema RPMS\n\n" +
      "¿En qué puedo ayudarte hoy?",
  };
}

/** Renderiza markdown básico (negrita, cursiva, listas, párrafos) */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("• ") || line.startsWith("- ")) {
      nodes.push(
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line === "") {
      if (i > 0 && lines[i - 1] !== "") {
        nodes.push(<div key={i} className="h-2" />);
      }
    } else {
      nodes.push(<p key={i} className="my-0.5 leading-relaxed">{renderInline(line)}</p>);
    }
  });

  return nodes;
}

function renderInline(text: string): React.ReactNode {
  // Negrita: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydrated = useRef(false);

  // Hidratación desde sessionStorage
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          hydrated.current = true;
          return;
        }
      }
    } catch {
      // ignorar
    }
    setMessages([welcome()]);
    hydrated.current = true;
  }, []);

  // Persistir en sessionStorage
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* ignorar */ }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, streaming, streamingText]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([welcome()]);
    setInput("");
    setError("");
    setStreaming(false);
    setStreamingText("");
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setStreaming(true);
    setStreamingText("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          module: getModuleRoot(pathname),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") ?? "";

      // Modo fallback (JSON simple)
      if (contentType.includes("application/json")) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: String(data?.reply ?? "") },
        ]);
        return;
      }

      // Modo streaming SSE
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Sin stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          try {
            const event = JSON.parse(raw);
            if (event.type === "delta" && event.text) {
              accumulated += event.text;
              setStreamingText(accumulated);
            }
            if (event.type === "done") {
              setMessages((prev) => [
                ...prev,
                { id: uid(), role: "assistant", content: accumulated },
              ]);
              setStreamingText("");
              return;
            }
            if (event.type === "error") {
              throw new Error(event.error ?? "Error en stream");
            }
          } catch {
            // Ignorar líneas malformadas
          }
        }
      }

      // Si llegamos aquí sin evento "done", guardar lo acumulado
      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: accumulated },
        ]);
        setStreamingText("");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Error al conectar con el asistente.");
    } finally {
      setStreaming(false);
      setStreamingText("");
    }
  }, [input, messages, streaming, pathname]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const moduleLabel = getModuleLabel(pathname) ?? "Sistema RPMS";

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente IA" : "Abrir asistente IA"}
        title={open ? "Cerrar asistente" : "Asistente IA RPMS"}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "bg-accent text-accent-foreground hover:scale-105 hover:shadow-xl",
          open && "rotate-90"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Panel de chat */}
      {open && (
        <div
          role="dialog"
          aria-label="Asistente IA RPMS"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl",
            // Móvil: pantalla completa menos el botón
            "inset-0 rounded-none",
            // Desktop: panel lateral abajo a la derecha
            "sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[560px] sm:w-[420px] sm:rounded-xl"
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
                <Bot className="h-4.5 w-4.5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Asistente IA RPMS</p>
                <p className="text-xs text-muted-foreground leading-tight truncate max-w-[200px]">{moduleLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <a
                href="/settings/assistant"
                title="Configurar asistente"
                aria-label="Configurar asistente"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Settings className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={reset}
                title="Nueva conversación"
                aria-label="Nueva conversación"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Cerrar"
                aria-label="Cerrar asistente"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-smooth"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15">
                    <Bot className="h-3.5 w-3.5 text-accent" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                    m.role === "user"
                      ? "bg-accent text-accent-foreground rounded-br-sm"
                      : "border border-border bg-muted/40 text-foreground rounded-bl-sm"
                  )}
                >
                  {m.role === "assistant"
                    ? renderMarkdown(m.content)
                    : <span className="whitespace-pre-wrap">{m.content}</span>}
                </div>
              </div>
            ))}

            {/* Streaming en progreso */}
            {streaming && (
              <div className="flex justify-start">
                <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15">
                  <Bot className="h-3.5 w-3.5 text-accent" />
                </div>
                <div className="max-w-[82%] rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-3.5 py-2.5 text-xs leading-relaxed text-foreground">
                  {streamingText ? (
                    <>
                      {renderMarkdown(streamingText)}
                      <span className="inline-block h-3 w-0.5 animate-pulse bg-accent ml-0.5" />
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Pensando…
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && !streaming && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border bg-background p-3">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 focus-within:border-accent/60 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Escribe tu consulta…"
                disabled={streaming}
                className="flex-1 resize-none bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:opacity-50"
                style={{ minHeight: "1.5rem", maxHeight: "7.5rem" }}
              />
              <div className="flex items-center gap-1 pb-0.5">
                {input.trim() && (
                  <button
                    type="button"
                    onClick={() => setInput("")}
                    title="Limpiar"
                    className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={send}
                  disabled={streaming || !input.trim()}
                  title="Enviar (Enter)"
                  aria-label="Enviar mensaje"
                  className={cn(
                    "rounded-lg p-1.5 transition-all",
                    input.trim() && !streaming
                      ? "bg-accent text-accent-foreground hover:opacity-90"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                  )}
                >
                  {streaming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
              Enter para enviar · Shift+Enter nueva línea
            </p>
          </div>
        </div>
      )}
    </>
  );
}
