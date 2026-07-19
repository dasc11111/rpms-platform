"use client";
import Link from "next/link";
import { Bot, Sparkles, X } from "lucide-react";

const SUGGESTIONS = [
  { id: "c1", title: "Cerrar incidente INC-2026-014", detail: "Investigación completa; plan de acción verificado.", href: "/incidents" },
  { id: "c2", title: "Confirmar recepción dosimétrica de junio", detail: "47 trabajadores conciliados; 1 anomalía por revisar.", href: "/dosimetry" },
  { id: "c3", title: "Revisar 3 documentos clasificados", detail: "Requieren firma del Oficial de Protección Radiológica.", href: "/documents" },
  { id: "c4", title: "Calibraciones próximas a vencer", detail: "2 instrumentos con calibración dentro de 30 días.", href: "/instruments" },
  { id: "c5", title: "Requerimiento de cumplimiento pendiente", detail: "1 requerimiento normativo requiere evidencia.", href: "/compliance" },
];

export function CopilotPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="absolute right-0 top-11 z-40 w-80 rounded-lg border border-border bg-surface p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-accent" strokeWidth={2} />
          <span className="text-sm font-semibold">Copilot RPMS</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Sugerencias basadas en el estado actual del sistema.
      </p>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            onClick={onClose}
            className="group flex items-start gap-2.5 rounded-md border border-border bg-background p-2.5 hover:border-accent"
          >
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{s.title}</span>
              <span className="text-[11px] text-muted-foreground">{s.detail}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
