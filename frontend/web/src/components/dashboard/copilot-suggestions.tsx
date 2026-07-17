import Link from "next/link";
import { Sparkles } from "lucide-react";
const SUGGESTIONS = [
  { id: "s1", title: "Cerrar incidente INC-2026-014", action: "Investigación completa; plan de acción verificado.", href: "/incidents" },
  { id: "s2", title: "Reservar cupo curso OPR", action: "Quedan 2 cupos en el curso del 12/08.", href: "/workers" },
  { id: "s3", title: "Revisar 3 documentos clasificados", action: "Requieren firma OPR.", href: "/documents" },
  { id: "s4", title: "Confirmar recepción dosimétrica junio", action: "47 trabajadores conciliados; 1 anomalía.", href: "/dosimetry" },
];
export function CopilotSuggestions() {
  return (
    <div className="flex flex-col gap-2">
      {SUGGESTIONS.map((s) => (
        <Link key={s.id} href={s.href} className="group flex items-start gap-2.5 rounded-md border border-border bg-surface p-2.5 hover:border-accent">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">{s.title}</span>
            <span className="text-[11px] text-muted-foreground">{s.action}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
