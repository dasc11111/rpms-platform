"use client";

import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { downloadCsv } from "@/lib/csv";

type LateReturnRow = {
  institucion: string | null;
  departamento: string | null;
  nombre: string | null;
  run: string;
  period_label: string;
  dosimetro: string | null;
  fecha_lectura: string | null;
  alerta_dosis: boolean;
};

export function LateReturnsTable({ rows }: { rows: LateReturnRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.institucion, r.departamento, r.nombre, r.run, r.period_label, r.dosimetro]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  function exportCsv() {
    downloadCsv("dosimetria-fuera-de-plazo.csv", filtered, [
      { key: "institucion", label: "Institucion" },
      { key: "departamento", label: "Departamento" },
      { key: "nombre", label: "Nombre" },
      { key: "run", label: "RUN" },
      { key: "period_label", label: "Periodo" },
      { key: "dosimetro", label: "Dosimetro" },
      { key: "fecha_lectura", label: "Fecha de lectura" },
      { key: "alerta_dosis", label: "Alerta de dosis" },
    ]);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, RUN, dosimetro..."
          className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted/40"
        >
          Exportar CSV
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-xs">
            <tr>
              <th className="px-3 py-2">Institucion</th>
              <th className="px-3 py-2">Departamento</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">RUN</th>
              <th className="px-3 py-2">Periodo</th>
              <th className="px-3 py-2">Dosimetro</th>
              <th className="px-3 py-2">Fecha de lectura</th>
              <th className="px-3 py-2">Es alerta de dosis?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {filtered.map((r, i) => (
              <tr key={i} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 text-muted-foreground">{r.institucion || "-"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.departamento || "-"}</td>
                <td className="px-3 py-2.5 font-medium">{r.nombre}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.run}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.period_label}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.dosimetro || "-"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.fecha_lectura}</td>
                <td className="px-3 py-2.5">{r.alerta_dosis ? "Si" : "No"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Sin devoluciones fuera de plazo detectadas.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
