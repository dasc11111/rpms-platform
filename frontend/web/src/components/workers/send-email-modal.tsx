"use client";

import { useState, useRef } from "react";
import { Mail, X, Paperclip, Send, Loader2 } from "lucide-react";

interface SendEmailModalProps {
  /** Si se pasa, el modal se abre en modo "trabajador específico" */
  worker?: {
    rut: string;
    displayName: string;
    email: string | null;
  };
  /** Trigger externo: botón "Generar" en la página de trabajadores */
  trigger?: React.ReactNode;
  /** Clase adicional para el botón por defecto */
  className?: string;
}

const DEFAULT_SUBJECT = "Comunicado – Protección Radiológica";

const DEFAULT_BODY = `Estimado/a trabajador/a,

Por medio del presente, el Oficial de Protección Radiológica del Hospital Dr. Hernán Henríquez Aravena le informa lo siguiente:

[Escriba el mensaje aquí]

Atentamente,
Diego Solís · Oficial de Protección Radiológica
Hospital Dr. Hernán Henríquez Aravena`;

export function SendEmailModal({ worker, trigger, className }: SendEmailModalProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(worker?.email ?? "");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setTo(worker?.email ?? "");
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setFile(null);
    setResult(null);
    setOpen(true);
  }

  function closeModal() {
    if (sending) return;
    setOpen(false);
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("to", to.trim());
      fd.append("subject", subject.trim());
      // Convertir texto plano a HTML simple
      const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#222;">${body
        .split("\n")
        .map((l) => `<p style="margin:0 0 8px">${l || "&nbsp;"}</p>`)
        .join("")}</div>`;
      fd.append("html", html);
      fd.append("text", body.trim());
      if (file) fd.append("attachment", file);

      const res = await fetch("/api/email/send", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        setResult({ ok: true, message: `Correo enviado a ${to}` });
      } else {
        setResult({ ok: false, message: json.error ?? "Error desconocido" });
      }
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    } finally {
      setSending(false);
    }
  }

  const defaultTrigger = worker ? (
    <button
      onClick={openModal}
      title={`Enviar correo a ${worker.displayName}`}
      className={`inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${className ?? ""}`}
    >
      <Mail className="h-4 w-4" />
    </button>
  ) : (
    <button
      onClick={openModal}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-background text-sm hover:bg-muted transition-colors ${className ?? ""}`}
    >
      <Mail className="h-4 w-4" />
      Generar correo
    </button>
  );

  return (
    <>
      {trigger ? <span onClick={openModal}>{trigger}</span> : defaultTrigger}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-background rounded-xl shadow-2xl border flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <h2 className="font-semibold text-sm">
                  {worker
                    ? `Enviar correo a ${worker.displayName}`
                    : "Generar correo"}
                </h2>
              </div>
              <button
                onClick={closeModal}
                disabled={sending}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Destinatario */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Destinatario
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  disabled={sending}
                  className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Asunto
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                  className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Mensaje
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  disabled={sending}
                  className="w-full text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 resize-none font-mono"
                />
              </div>

              {/* Adjunto */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Adjunto (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    disabled={sending}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={sending}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors disabled:opacity-60"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {file ? "Cambiar archivo" : "Adjuntar archivo"}
                  </button>
                  {file && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {file.name}
                    </span>
                  )}
                  {file && (
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Resultado */}
              {result && (
                <div
                  className={`text-xs rounded-md px-3 py-2 ${
                    result.ok
                      ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                      : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                  }`}
                >
                  {result.message}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={sending}
                className="text-sm px-4 py-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-60"
              >
                {result?.ok ? "Cerrar" : "Cancelar"}
              </button>
              {!result?.ok && (
                <button
                  onClick={handleSend}
                  disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
