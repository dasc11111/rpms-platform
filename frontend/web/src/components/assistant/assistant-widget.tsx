"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, RotateCcw, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getModuleLabel, getModuleRoot } from "@/lib/assistant/modules";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "rpms-assistant-history-v1";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now() + "-" + Math.random().toString(36).slice(2);
}

function welcomeMessage(): ChatMessage {
  return {
    id: newId(),
    role: "assistant",
    content:
      "¡Hola! Soy el Asistente Inteligente de RPMS. Puedo ayudarte a resolver dudas sobre el uso de la plataforma sin que tengas que salir de ella. ¿En qué te puedo ayudar?",
  };
}

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hydrated = useRef(false);

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
      // ignore malformed storage
    }
    setMessages([welcomeMessage()]);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage may be unavailable (private mode, quota, etc.)
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, loading]);

  function resetConversation() {
    setMessages([welcomeMessage()]);
    setInput("");
    setError("");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          module: getModuleRoot(pathname),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo obtener una respuesta del asistente.");
      }
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: String(data?.reply || "") },
      ]);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al conectar con el asistente.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const moduleLabel = getModuleLabel(pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente inteligente" : "Abrir asistente inteligente"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Asistente Inteligente"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-border bg-surface shadow-2xl",
            "inset-0 rounded-none",
            "sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[500px] sm:w-[400px] sm:min-h-[380px] sm:min-w-[320px] sm:max-h-[85vh] sm:max-w-[95vw] sm:resize sm:rounded-lg"
          )}
        >
          <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">¿Necesitas ayuda?</h2>
              <p className="text-xs text-muted-foreground">{moduleLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetConversation}
                title="Nueva conversación"
                aria-label="Nueva conversación"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent-subtle hover:text-accent"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Cerrar"
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent-subtle hover:text-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed",
                    m.role === "user"
                      ? "bg-accent text-accent-foreground"
                      : "border border-border bg-background text-foreground"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Escribiendo...
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-border bg-background p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Escribe tu pregunta..."
              className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={resetConversation}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent-subtle hover:text-accent"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar conversación
              </button>
              <button
                type="button"
                onClick={send}
                disabled={loading || !input.trim()}
                className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
