"use client";

import { useCallback, useEffect, useState } from "react";

const COLOR_STYLES: Record<string, { text: string; border: string; label: string }> = {
  verde: { text: "text-success", border: "border-success", label: "Cumple" },
  amarillo: { text: "text-warning", border: "border-warning", label: "Proximo a vencer" },
  naranjo: { text: "text-orange-500", border: "border-orange-500", label: "Requiere revision" },
  rojo: { text: "text-danger", border: "border-danger", label: "No cumple" },
  blanco: { text: "text-muted-foreground", border: "border-border", label: "No evaluado" },
  negro: { text: "text-foreground", border: "border-border", label: "No aplica" },
};

const COLOR_DOT: Record<string, string> = { verde: "🟢", amarillo: "🟡", naranjo: "🟠", rojo: "🔴", blanco: "⚪", negro: "⚫" };

const FILTERS = [
  { color: "verde", label: "Cumple" },
  { color: "amarillo", label: "Proximo a vencer" },
  { color: "naranjo", label: "Requiere revision" },
  { color: "rojo", label: "No cumple" },
  { color: "blanco", label: "No evaluado" },
  { color: "negro", label: "No aplica" },
];

export function GestionIntegralTab({ facilityId }: { facilityId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/radioterapia/gestion-integral?facilityId=" + facilityId);
      const json = await res.json();
      if (json.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <p className="text-sm text-muted-foreground">Cargando gestion integral...</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Sin datos disponibles.</p>;

  const idx = data.indiceCumplimiento || {};
  const idxColor = idx.valor === null || idx.valor === undefined ? "blanco" :
    idx.valor >= 95 ? "verde" : idx.valor >= 90 ? "amarillo" : idx.valor >= 80 ? "naranjo" : "rojo";

  const conteo = data.conteoPorColor || {};
  const preguntas = filter ? data.preguntasClave.filter((r: any) => r.color === filter) : data.preguntasClave;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Indice de cumplimiento (Radioterapia)</p>
            <p className={"text-3xl font-semibold " + (COLOR_STYLES[idxColor]?.text || "text-foreground")}>
              {idx.valor !== null && idx.valor !== undefined ? idx.valor + "%" : "Sin indice"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Calculado con {idx.requisitosEvaluados} de {idx.requisitosTotales} requisitos (solo elementos con criterio definido).
            </p>
          </div>
          <button onClick={load} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted">
            Actualizar
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Escala: {idx.escala}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {FILTERS.map((c) => (
          <button
            key={c.color}
            onClick={() => setFilter(filter === c.color ? null : c.color)}
            className={
              "rounded-lg border p-3 text-left transition bg-surface hover:bg-muted " +
              (filter === c.color ? "border-accent" : "border-border")
            }
          >
            <p className="text-lg">{COLOR_DOT[c.color]} {conteo[c.color] ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">
          Las 14 preguntas clave{filter ? " (filtrado)" : ""}
        </p>
        <div className="space-y-2">
          {preguntas.map((r: any) => (
            <div key={r.id} className={"rounded-md border-l-4 border border-border bg-background p-3 " + (COLOR_STYLES[r.color]?.border || "")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {COLOR_DOT[r.color]} {r.pregunta}
                </p>
                <span className={"text-[11px] font-medium " + (COLOR_STYLES[r.color]?.text || "text-muted-foreground")}>
                  {COLOR_STYLES[r.color]?.label || r.estado}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.requisito} - fuente: {r.fuente}</p>
              <p className="mt-1 text-xs text-foreground">{r.detalle}</p>
              {r.accion && (
                <p className="mt-1 text-xs font-medium text-accent">Accion sugerida: {r.accion}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {r.fecha && <span>Fecha: {String(r.fecha).slice(0, 10)}</span>}
                {r.vencimiento && <span>Vencimiento: {String(r.vencimiento).slice(0, 10)}</span>}
                {r.evidencia && <a href={r.evidencia} target="_blank" rel="noreferrer" className="underline">Ver evidencia</a>}
              </div>
            </div>
          ))}
          {preguntas.length === 0 && <p className="text-xs text-muted-foreground">Sin elementos para este filtro.</p>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-2 text-sm font-semibold text-foreground">Matriz de cumplimiento</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="p-1">Requisito</th>
                <th className="p-1">Fuente</th>
                <th className="p-1">Estado</th>
                <th className="p-1">Responsable</th>
                <th className="p-1">Fecha</th>
                <th className="p-1">Vencimiento</th>
                <th className="p-1">Evidencia</th>
                <th className="p-1">Accion</th>
              </tr>
            </thead>
            <tbody>
              {data.matrizCumplimiento.map((m: any, i2: number) => (
                <tr key={i2} className="border-t border-border align-top">
                  <td className="p-1 text-foreground">{m.requisito}</td>
                  <td className="p-1 text-muted-foreground">{m.fuente}</td>
                  <td className={"p-1 font-medium " + (COLOR_STYLES[m.color]?.text || "text-foreground")}>
                    {COLOR_DOT[m.color]} {COLOR_STYLES[m.color]?.label || m.estado}
                  </td>
                  <td className="p-1 text-foreground">{m.responsable || "-"}</td>
                  <td className="p-1 text-foreground">{m.fecha ? String(m.fecha).slice(0, 10) : "-"}</td>
                  <td className="p-1 text-foreground">{m.vencimiento ? String(m.vencimiento).slice(0, 10) : "-"}</td>
                  <td className="p-1">
                    {m.evidencia ? <a href={m.evidencia} target="_blank" rel="noreferrer" className="text-accent underline">Ver</a> : "-"}
                  </td>
                  <td className="p-1 text-muted-foreground">{m.accion || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Generado: {new Date(data.meta.generatedAt).toLocaleString()} - Instalaciones: {data.meta.facilitiesCount} - Aceleradores: {data.meta.linacCount} - Bunkers: {data.meta.bunkersCount}
      </p>
    </div>
  );
}
