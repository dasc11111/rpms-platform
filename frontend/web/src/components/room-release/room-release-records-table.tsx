"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Tag, RefreshCw, FileText, MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import type { RoomReleaseRecord } from "@/lib/waste";

export function RoomReleaseRecordsTable({
  version,
  onNew,
  onGenerateLabel,
  onEdit,
}: {
  version: number;
  onNew: () => void;
  onGenerateLabel: (record: RoomReleaseRecord) => void;
  onEdit: (record: RoomReleaseRecord) => void;
}) {
  const [rows, setRows] = useState<RoomReleaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  // Elimina un Acta de Liberacion de Sala, previa confirmacion explicita del
  // usuario. Si el Acta ya tiene un rotulo de residuo generado, el servidor
  // rechaza el borrado (409) para evitar dejar referencias huerfanas.
  async function handleDelete(r: RoomReleaseRecord) {
    const ok = window.confirm(
      `¿Eliminar el Acta de Liberación de Sala de ${r.paciente_nombre} (Sala ${r.sala}, ${r.release_date})? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setDeletingId(r.id);
    try {
      const res = await fetch(`/api/room-release/${r.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "No se pudo eliminar el Acta.");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== r.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch {
      alert("Error de red al eliminar el Acta.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="text-sm font-medium">
          Actas de Liberación de Sala <span className="text-muted-foreground">({total})</span>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/waste-labels/export?dataset=room-release&format=csv"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a
            href="/api/waste-labels/export?dataset=room-release&format=xlsx"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </a>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nueva Acta
          </button>
        </div>
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
                  <div className="relative flex flex-wrap items-center gap-1.5">
                    <a
                      href={`/api/room-release/${r.id}/acta`}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      title="Generar Acta Entrega de Sala (I-131) en PDF"
                    >
                      <FileText className="h-3.5 w-3.5" /> Generar Acta
                    </a>
                    {!r.waste_label_generated && (
                      <button
                        onClick={() => onGenerateLabel(r)}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Tag className="h-3.5 w-3.5" /> Generar rótulo
                      </button>
                    )}
                    <button
                      onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                      className="flex items-center rounded-md border border-border p-1.5 text-xs hover:bg-muted"
                      title="Más acciones"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                    {openMenuId === r.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
                          <a
                            href={`/api/room-release/${r.id}/acta?preview=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenMenuId(null)}
                            className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted"
                          >
                            <Eye className="h-3.5 w-3.5" /> Vista previa
                          </a>
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              onEdit(r);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            disabled={deletingId === r.id}
                            onClick={() => {
                              setOpenMenuId(null);
                              handleDelete(r);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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
