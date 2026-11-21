"use client";

import { useState } from "react";

type NotReturnedRow = {
  dosimetro: string;
  institucion: string | null;
  unidad: string | null;
  nombrepart: string | null;
  dcto: string | null;
  tipod: string | null;
  trimestre_d: string | null;
  extraviado: boolean;
};

// Hoja 'No devueltos' de la planilla oficial. El listado se calcula en vivo
// en el servidor; el unico estado que se persiste desde aqui es el flag
// 'extraviado' de cada fila, via PATCH a /api/dosimetry/not-returned.
export function NotReturnedTable({ initialRows }: { initialRows: NotReturnedRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function toggle(row: NotReturnedRow) {
    const key = `${row.dosimetro}__${row.trimestre_d}`;
    const next = !row.extraviado;
    setSavingKey(key);
    setRows((prev) => prev.map((r) => (r.dosimetro === row.dosimetro && r.trimestre_d === row.trimestre_d ? { ...r, extraviado: next } : r)));
    try {
      await fetch("/api/dosimetry/not-returned", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dosimetro: row.dosimetro, trimestre_d: row.trimestre_d, extraviado: next }),
      });
    } catch {
      setRows((prev) => prev.map((r) => (r.dosimetro === row.dosimetro && r.trimestre_d === row.trimestre_d ? { ...r, extraviado: !next } : r)));
    } finally {
      setSavingKey(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No hay dosímetros pendientes de devolución.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/40 text-left text-xs">
          <tr>
            <th className="px-3 py-2">Dosímetro</th>
            <th className="px-3 py-2">Institución</th>
            <th className="px-3 py-2">Unidad</th>
            <th className="px-3 py-2">Trabajador</th>
            <th className="px-3 py-2">RUN</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Trimestre</th>
            <th className="px-3 py-2">¿Extraviado?</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {rows.map((r, i) => {
            const key = `${r.dosimetro}__${r.trimestre_d}`;
            return (
              <tr key={i} className="hover:bg-muted/40">
                <td className="px-3 py-2.5 font-medium">{r.dosimetro}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.institucion || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.unidad || "—"}</td>
                <td className="px-3 py-2.5">{r.nombrepart || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.dcto || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.tipod || "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.trimestre_d || "—"}</td>
                <td className="px-3 py-2.5">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={r.extraviado}
                      disabled={savingKey === key}
                      onChange={() => toggle(r)}
                    />
                    {r.extraviado ? "Sí" : "No"}
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
