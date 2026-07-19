"use client";
import { Bell, Bot, Search } from "lucide-react";
import { useState } from "react";
import { CommandBar } from "@/components/search/command-bar";
import { CopilotPanel } from "@/components/layout/copilot-panel";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
        <button type="button" onClick={() => setOpen(true)} className="flex h-9 flex-1 max-w-md items-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm text-muted-foreground hover:border-accent">
          <Search className="h-4 w-4" strokeWidth={2} />
          <span>Buscar trabajadores, equipos, documentos...</span>
        </button>
        <button type="button" className="relative rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Notificaciones">
          <Bell className="h-4 w-4" strokeWidth={2} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCopilotOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:border-accent"
          >
            <Bot className="h-3.5 w-3.5" />
            Copilot
          </button>
          <CopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
        </div>
      </header>
      <CommandBar open={open} onOpenChange={setOpen} />
    </>
  );
}
