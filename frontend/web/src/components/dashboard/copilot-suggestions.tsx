import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

interface Suggestion {
  id: string;
  title: string;
  action: string;
  href: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: "s1",
    title: "Cerrar incidente INC-2026-014",
    action: "Investigación completa; plan de acción verificado.",
    href: "/incidents/INC-2026-014",
  },
  {
    id: "s2",
    title: "Reservar cupo curso OPR",
    action: "Quedan 2 cupos en el curso del 12/08 — 40 h obligatorias.",
    href: "/workers/authorizations/renewals",
  },
  {
    id: "s3",
    title: "Revisar 3 documentos clasificados",
    action: "Landauer detectó anomalía en Hp(10); requiere firma OPR.",
    href: "/documents?status=pending_review",
  },
  {
    id: "s4",
    title: "Confirmar recepción dosimétrica junio",
    action: "47 de 47 trabajadores conciliados; 1 anomalía por revisar.",
    href: "/dosimetry/imports/2026-06",
  },
];

export function CopilotSuggestions() {
  return (
    <div className="flex flex-col gap-2">
      {SUGGESTIONS.map((s) => (
        <Link
          key={s.id}
          href={s.href}
          className="group flex items-start gap-2.5 rounded-md border border-border bg-surface p-2.5 transition-all hover:border-accent hover:shadow-subtle"
        >
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium text-foreground">{s.title}</span>
            <span className="text-[11px] text-muted-foreground">{s.action}</span>
          </div>
          <ArrowRight
            className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </Link>
      ))}
    </div>
  );
}
