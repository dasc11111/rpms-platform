"use client";

import { useEffect, useState } from "react";
import { Plus, Tag, RefreshCw } from "lucide-react";
import type { RoomReleaseRecord } from "@/lib/waste";

export function RoomReleaseRecordsTable({
  version,
  onNew,
  onGenerateLabel,
}: {
  version: number;
  onNew: () => void;
  onGenerateLabel: (record: RoomReleaseRecord) => void;
}) {
  const [rows, setRows] = useState<RoomReleaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/room-release?pageSize=100&sort=release_date&dir=desc")
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
          Actas de Liberación de Sala <span className="text-muted-foreground">({total})</span>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nueva Acta
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Sala</th>
              <th className="px-3 py-2">Paciente</th>
              <th className="px-3 py-2">Radionúclido</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Rótulo</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">{r.release_date}</td>
                <td className="px-3 py-2">{r.service}</td>
                <td className="px-3 py-2">{r.sala}</td>
                <td className="px-3 py-2">{r.paciente_nombre}</td>
                <td className="px-3 py-2">{r.radionuclide_code}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">
                  {r.waste_label_generated ? (
                    <span className="text-xs text-success">Generado</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pendiente</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {!r.waste_label_generated && (
                    <button
                      onClick={() => onGenerateLabel(r)}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Tag className="h-3.5 w-3.5" /> Generar rótulo
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No hay Actas de Liberación de Sala registradas.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
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
