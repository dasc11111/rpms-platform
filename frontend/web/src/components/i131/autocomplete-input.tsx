"use client";

import { useEffect, useRef, useState } from "react";

// Input con autocompletado inteligente: consulta /api/i131/suggestions para el
// campo indicado y muestra los valores mas usados. Se alimenta automaticamente
// de la base de datos (ver /api/i131/suggestions), sin listas fijas.
export function AutocompleteInput({
  field,
  value,
  onChange,
  placeholder,
  className,
  required,
}: {
  field: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function fetchSuggestions(q: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/i131/suggestions?field=${encodeURIComponent(field)}&q=${encodeURIComponent(q)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setOptions(data.values ?? []);
      } catch {
        setOptions([]);
      }
    }, 150);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        value={value}
        required={required}
        placeholder={placeholder}
        className={
          className ??
          "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
        }
        onChange={(e) => {
          onChange(e.target.value);
          fetchSuggestions(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          fetchSuggestions(value);
          setOpen(true);
        }}
      />
      {open && options.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className="block w-full truncate px-2.5 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
