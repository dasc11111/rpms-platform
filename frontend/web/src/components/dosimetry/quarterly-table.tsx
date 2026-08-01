"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/csv";

type Row = {
  worker_rut: string;
  worker_name: string;
  departamento: string | null;
  period_label: string;
  dose_body: string;
  dose_lens: string;
  dose_skin: string;
  accum_60m_body: string;
  level: string;
  blob_url: string | null;
};

const LEVEL_LABEL: Record<string, { label: string; className: string }> = {
  normal: { label: "Normal", className: "text-muted-foreground" },
  registro: { label: "Nivel de registro", className: "text-warning" },
  investigacion: { label: "Nivel de investigacion", className: "text-orange-500" },
  intervencion: { label: "Nivel de intervencion", className: "text-danger" },
};

export function QuarterlyTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.worker_name, r.worker_rut, r.departamento, r.period_label]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  function exportCsv() {
    downloadCsv("dosimetria-reportes-trimestre.csv", filtered, [
      { key: "worker_name", label: "Trabajador" },
      { key: "worker_rut", label: "RUN" },
      { key: "departamento", label: "Departamento" },
      { key: "period_label", label: "Periodo" },
      { key: "dose_body", label: "Cuerpo entero (mSv)" },
      { key: "dose_lens", label: "Cristalino (mSv)" },
      { key: "dose_skin", label: "Piel (mSv)" },
      { key: "accum_60m_body", label: "Acumulado 5 anos (mSv)" },
      { key: "level", label: "Nivel" },
    ]);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por trabajador, RUN, departamento..."
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
              <th className="px-3 py-2">Trabajador</th>
              <th className="px-3 py-2">Departamento</th>
              <th className="px-3 py-2">Periodo</th>
              <th className="px-3 py-2 text-right">Cuerpo entero (mSv)</th>
              <th className="px-3 py-2 text-right">Cristalino (mSv)</th>
              <th className="px-3 py-2 text-right">Piel (mSv)</th>
              <th className="px-3 py-2 text-right">Acumulado 5 anos (mSv)</th>
              <th className="px-3 py-2">Nivel</th>
              <th className="px-3 py-2">Fuente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {filtered.map((r, i) => {
              const lv = LEVEL_LABEL[r.level] ?? { label: r.level, className: "text-muted-foreground" };
              return (
                <tr key={i} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 font-medium">{r.worker_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.departamento}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.period_label}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_body).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_lens).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.dose_skin).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(r.accum_60m_body).toFixed(2)}</td>
                  <td className={`px-3 py-2.5 ${lv.className}`}>{lv.label}</td>
                  <td className="px-3 py-2.5">
                    {r.blob_url ? (
                      <a href={r.blob_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        Ver Reporte Fuente
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No hay lecturas dosimetricas cargadas todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
