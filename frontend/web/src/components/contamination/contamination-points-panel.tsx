"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Settings2 } from "lucide-react";
import {
  CONTAMINATION_POINT_CATEGORIES,
  CONTAMINATION_POINT_CATEGORY_LABELS,
  type ContaminationMeasurementPoint,
  type ContaminationPointCategory,
} from "@/lib/contamination-points-db";

const INPUT = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

// Panel de administracion de "Puntos de medicion" configurables del modulo
// general de Contaminacion (Seccion 12 del PROMPT MAESTRO CLAUDE CHROME -
// MEDICINA NUCLEAR: "Crear una lista editable"). Complementa el
// autocompletado por historial ya existente (ver ContaminationFormModal),
// sin reemplazarlo: los puntos aqui definidos aparecen como botones de
// seleccion rapida en el formulario, y el campo sigue aceptando texto libre
// para casos no cubiertos por la lista.
//
// No modifica el modulo "Liberacion de Sala" (room-clearance.ts), que ya
// tiene su propia lista fija equivalente y funciona correctamente.
export function ContaminationPointsPanel({ open }: { open: boolean }) {
  const [points, setPoints] = useState<ContaminationMeasurementPoint[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCategoria, setNewCategoria] = useState<ContaminationPointCategory>("LABORATORIO");
  const [newNombre, setNewNombre] = useState("");
  const [adding, setAdding] = useState(false);

  function load() {
    fetch("/api/contamination/measurement-points?activo=false")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPoints(data.rows ?? []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  async function save(point: ContaminationMeasurementPoint) {
    setSavingId(point.id);
    setMessage(null);
    try {
      const res = await fetch("/api/contamination/measurement-points", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(point),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "No se pudo guardar el punto.");
      } else {
        setMessage(`Punto "${point.nombre}" actualizado.`);
        load();
      }
    } catch {
      setMessage("Error de red al guardar el punto.");
    } finally {
      setSavingId(null);
    }
  }

  function update(id: number, patch: Partial<ContaminationMeasurementPoint>) {
    setPoints((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function addPoint() {
    if (!newNombre.trim()) {
      setMessage("Indique el nombre del nuevo punto.");
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contamination/measurement-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria: newCategoria, nombre: newNombre.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "No se pudo agregar el punto.");
      } else {
        setMessage(`Punto "${newNombre.trim()}" agregado.`);
        setNewNombre("");
        load();
      }
    } catch {
      setMessage("Error de red al agregar el punto.");
    } finally {
      setAdding(false);
    }
  }

  const grouped = CONTAMINATION_POINT_CATEGORIES.map((cat) => ({
    categoria: cat,
    items: points.filter((p) => p.categoria === cat).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
  }));

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Settings2 className="h-4 w-4" /> Puntos de medición configurables (lista editable, Sección 12)
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Estos puntos aparecen como botones de selección rápida en el formulario de registro. Puede desactivar
        (sin borrar) los que ya no se usen, renombrarlos o agregar nuevos. El campo del formulario sigue
        aceptando texto libre para casos no cubiertos por esta lista.
      </p>
      {message && <div className="mb-3 rounded-md border border-accent/30 bg-accent-subtle px-3 py-2 text-xs">{message}</div>}

      <div className="space-y-4">
        {grouped.map((g) => (
          <div key={g.categoria}>
            <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
              {CONTAMINATION_POINT_CATEGORY_LABELS[g.categoria]}
            </p>
            <div className="space-y-2">
              {g.items.map((p) => (
                <div key={p.id} className="grid grid-cols-2 items-end gap-2 rounded-md border border-border p-2 md:grid-cols-6">
                  <div className="col-span-2 md:col-span-2">
                    <input className={INPUT} value={p.nombre} onChange={(e) => update(p.id, { nombre: e.target.value })} />
                  </div>
                  <div>
                    <input
                      type="number"
                      className={INPUT}
                      value={p.orden}
                      onChange={(e) => update(p.id, { orden: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1 flex items-center gap-1.5 text-xs">
                    <input
                      id={`activo-${p.id}`}
                      type="checkbox"
                      checked={p.activo}
                      onChange={(e) => update(p.id, { activo: e.target.checked })}
                    />
                    <label htmlFor={`activo-${p.id}`}>Activo</label>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <button
                      onClick={() => save(p)}
                      disabled={savingId === p.id}
                      className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" /> {savingId === p.id ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                  {p.notas && (
                    <div className="col-span-2 text-[11px] text-muted-foreground md:col-span-6">{p.notas}</div>
                  )}
                </div>
              ))}
              {g.items.length === 0 && <p className="text-xs text-muted-foreground">Sin puntos en esta categoría.</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground">Categoría</label>
          <select
            className={INPUT}
            value={newCategoria}
            onChange={(e) => setNewCategoria(e.target.value as ContaminationPointCategory)}
          >
            {CONTAMINATION_POINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CONTAMINATION_POINT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground">Nuevo punto</label>
          <input
            className={INPUT}
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            placeholder="ej. Sala de espera"
          />
        </div>
        <button
          onClick={addPoint}
          disabled={adding}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> {adding ? "Agregando..." : "Agregar punto"}
        </button>
      </div>
    </div>
  );
}
