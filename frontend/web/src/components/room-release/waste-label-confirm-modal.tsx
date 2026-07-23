"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Tag, X } from "lucide-react";
import type { RoomReleaseRecord, WasteLabel } from "@/lib/waste";

// Automatizacion requerida: al terminar el registro de la Liberacion de Sala,
// el sistema pregunta automaticamente "¿Desea generar el rótulo del residuo
// radiactivo?". Si la respuesta es SI, se genera automaticamente el registro
// del residuo, el numero correlativo, el rotulo y se actualiza el Dashboard,
// reutilizando toda la informacion ya ingresada (sin volver a solicitarla).
export function WasteLabelConfirmModal({
  record,
  onClose,
  onGenerated,
}: {
  record: RoomReleaseRecord | null;
  onClose: () => void;
  onGenerated: (label: WasteLabel) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<WasteLabel | null>(null);

  if (!record) return null;

  async function generar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/waste-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_release_id: record!.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo generar el rótulo.");
        setLoading(false);
        return;
      }
      setCreated(data.row as WasteLabel);
      setLoading(false);
      onGenerated(data.row as WasteLabel);
    } catch {
      setError("Error de red al generar el rótulo.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Tag className="h-4 w-4" /> Gestión de Residuos Radiactivos
          </h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!created ? (
          <>
            <p className="mb-4 text-sm">
              El Acta de Liberación de Sala para <span className="font-medium">{record.paciente_nombre}</span> (
              {record.sala}) se guardó correctamente. ¿Desea generar el rótulo del residuo radiactivo ahora,
              reutilizando automáticamente estos datos?
            </p>
            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                No, más tarde
              </button>
              <button
                disabled={loading}
                onClick={generar}
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Generando..." : "Sí, generar rótulo"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Rótulo <strong>{created.label_number}</strong> generado
              correctamente.
            </div>
            <div className="flex justify-end gap-2">
              <a
                href={`/room-release/label/${created.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
              >
                Ver / imprimir rótulo
              </a>
              <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
