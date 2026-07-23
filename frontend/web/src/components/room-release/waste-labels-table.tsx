"use client";

import { useEffect, useState } from "react";
import { Download, Eye, RefreshCw } from "lucide-react";
import type { WasteLabel } from "@/lib/waste";

export function WasteLabelsTable({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [rows, setRows] = useState<WasteLabel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/waste-labels?pageSize=100&sort=generation_date&dir=desc")
      .then((res) => (res.ok ? res.json() : { rows: [], total: 0 }))
      .then((data) => {
        if (!active) return;
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [version]);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="text-sm font-medium">
          Rótulos de Residuos Radiactivos <span className="text-muted-foreground">({total})</span>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/waste-labels/export?format=csv"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a
            href="/api/waste-labels/export?format=xlsx"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">N° Rótulo</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Sala</th>
              <th className="px-3 py-2">Radionúclido</th>
              <th className="px-3 py-2">Actividad est.</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Impresiones</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{r.label_number}</td>
                <td className="px-3 py-2">{r.generation_date}</td>
                <td className="px-3 py-2">{r.service}</td>
                <td className="px-3 py-2">{r.sala}</td>
                <td className="px-3 py-2">{r.radionuclide_code}</td>
                <td className="px-3 py-2">
                  {r.actividad_estimada_residual !== null ? Number(r.actividad_estimada_residual).toFixed(2) : "—"}{" "}
                  {r.unidad_actividad}
                </td>
                <td className="px-3 py-2 capitalize">{r.status}</td>
                <td className="px-3 py-2">{r.print_count}</td>
                <td className="px-3 py-2">
                  <a
                    href={`/room-release/label/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    <Eye className="h-3.5 w-3.5" /> Ver / Imprimir
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No hay rótulos generados todavía.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  <RefreshCw className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
