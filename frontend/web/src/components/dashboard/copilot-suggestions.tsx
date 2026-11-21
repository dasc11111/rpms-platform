import Link from "next/link";
import { Sparkles } from "lucide-react";

export interface CopilotSuggestion {
  id: string;
  title: string;
  action: string;
  href: string;
}

interface Props {
  suggestions?: CopilotSuggestion[];
}

export function CopilotSuggestions({ suggestions }: Props) {
  const items = suggestions ?? [];

  if (items.length === 0) {
    return (
      <div className="py-3 text-center text-xs text-muted-foreground">
        Sin acciones recomendadas en este momento.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((s) => (
        <Link
          key={s.id}
          href={s.href}
          className="group flex items-start gap-2.5 rounded-md border border-border bg-surface p-2.5 hover:border-accent"
        >
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
