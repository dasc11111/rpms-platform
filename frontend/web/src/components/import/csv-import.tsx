"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  const headerLine = lines[0];
  if (!headerLine) return [];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

export function CsvImport({ endpoint, label, hint }: { endpoint: string; label: string; hint: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function handleFile(file: File) {
    setState("loading");
    setMessage("");
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error("Error al importar");
      const data = await res.json();
      setState("done");
      setMessage(`${data.inserted ?? rows.length} registros importados.`);
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage("No se pudo importar el archivo. Verifica el formato CSV.");
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-3">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === "loading"}
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-60"
      >
        {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {label}
      </button>
      <div className="flex flex-1 items-center gap-1.5 text-[11px] text-muted-foreground">
        {state === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
        {state === "error" && <XCircle className="h-3.5 w-3.5 text-danger" />}
        <span>{message || hint}</span>
      </div>
    </div>
  );
}
