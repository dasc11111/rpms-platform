"use client";
import { Command } from "cmdk";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Radio,
  User,
  AlertTriangle,
  Radiation,
  ClipboardCheck,
  Loader2,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "worker" | "instrument" | "incident" | "document" | "i131" | "compliance";
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
}

const TYPE_ICON: Record<SearchResult["type"], React.FC<{ className?: string }>> = {
  worker: User,
  instrument: Radio,
  incident: AlertTriangle,
  document: FileText,
  i131: Radiation,
  compliance: ClipboardCheck,
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  worker: "Trabajadores",
  instrument: "Instrumentos",
  incident: "Incidentes",
  document: "Documentos",
  i131: "I-131",
  compliance: "Cumplimiento",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandBar({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(Array.isArray(data.results) ? data.results : []);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  function handleSelect(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  if (!open) return null;

  // Group results by type
  const groups: Partial<Record<SearchResult["type"], SearchResult[]>> = {};
  for (const r of results) {
    if (!groups[r.type]) groups[r.type] = [];
    groups[r.type]!.push(r);
  }
  const groupKeys = Object.keys(groups) as SearchResult["type"][];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-border bg-surface-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Búsqueda universal RPMS" shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <svg
                className="h-4 w-4 shrink-0 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar trabajadores, equipos, documentos..."
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
              autoFocus
            />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {query.length < 2 && (
              <Command.Empty className="py-8 text-center text-xs text-muted-foreground">
                Escribe al menos 2 caracteres para buscar.
              </Command.Empty>
            )}
            {query.length >= 2 && !loading && results.length === 0 && (
              <Command.Empty className="py-8 text-center text-xs text-muted-foreground">
                Sin resultados para &quot;{query}&quot;.
              </Command.Empty>
            )}

            {groupKeys.map((type) => {
              const Icon = TYPE_ICON[type];
              return (
                <Command.Group key={type} heading={TYPE_LABEL[type]}>
                  {groups[type]!.map((r) => (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      onSelect={() => handleSelect(r.href)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-muted"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{r.title}</span>
                        {r.subtitle && (
                          <span className="truncate text-xs text-muted-foreground">{r.subtitle}</span>
                        )}
                      </div>
                      {r.meta && (
                        <span className="ml-auto shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {r.meta}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>

          {query.length >= 2 && (
            <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              Resultados de trabajadores, instrumentos, incidentes, documentos, I-131 y cumplimiento
            </div>
          )}
        </Command>
      </div>
    </div>
  );
}
