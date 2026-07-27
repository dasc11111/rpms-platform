import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS: { key: "listado" | "alertas" | "estadisticas"; label: string; href: string }[] = [
  { key: "listado", label: "Listado", href: "/dosimeters" },
  { key: "alertas", label: "Alertas", href: "/dosimeters/alerts" },
  { key: "estadisticas", label: "Estadisticas", href: "/dosimeters/stats" },
];

export function DosimetersSubnav({ active }: { active: "listado" | "alertas" | "estadisticas" }) {
  return (
    <div className="mb-4 flex items-center gap-1 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "border-b-2 px-3 py-2 text-xs font-medium",
            active === t.key
              ? "border-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
