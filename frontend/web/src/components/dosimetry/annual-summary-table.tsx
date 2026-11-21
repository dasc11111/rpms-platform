"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/csv";

type AnnualSummaryRow = {
  institucion: string | null;
  departamento: string | null;
  nombre: string | null;
  run: string;
  estado: string;
  tipod: string;
  anio: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  total: number;
};

export function AnnualSummaryTable({ rows }: { rows: AnnualSummaryRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.institucion, r.departamento, r.nombre, r.run, r.estado, r.tipod, String(r.anio)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  function exportCsv() {
    downloadCsv("dosimetria-resumen-anual.csv", filtered, [
      { key: "institucion", label: "Institucion" },
      { key: "departamento", label: "Departamento" },
      { key: "nombre", label: "Nombre" },
      { key: "run", label: "RUN" },
      { key: "estado", label: "Estado" },
      { key: "tipod", label: "Tipo" },
      { key: "anio", label: "Ano" },
      { key: "t1", label: "T1" },
      { key: "t2", label: "T2" },
      { key: "t3", label: "T3" },
      { key: "t4", label: "T4" },
      { key: "total", label: "Total anual" },
    ]);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, RUN, departamento..."
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
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2 text-right">Ano</th>
              <th className="px-3 py-2 text-right">T1</th>
              <th className="px-3 py-2 text-right">T2</th>
              <th className="px-3 py-2 text-right">T3</th>
              <th className="px-3 py-2 text-right">T4</th>
              <th className="px-3 py-2 text-right">Total anual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {filtered.map((r, i) => (
              <tr key={i} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 text-muted-foreground">{r.institucion || "-"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.departamento || "-"}</td>
                <td className="px-3 py-2.5 font-medium">{r.nombre}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.run}</td>
                <td className="px-3 py-2.5">{r.estado}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.tipod}</td>
                <td className="px-3 py-2.5 text-right">{r.anio}</td>
                <td className="px-3 py-2.5 text-right">{r.t1.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right">{r.t2.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right">{r.t3.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right">{r.t4.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-medium">{r.total.toFixed(2)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">
                  Sin datos para el resumen anual todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
