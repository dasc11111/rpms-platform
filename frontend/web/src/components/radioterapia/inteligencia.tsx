"use client";

import { useCallback, useEffect, useState } from "react";

const PERIODS = [
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "180 dias" },
  { value: 365, label: "365 dias" },
];

const TREND_ICON: Record<string, string> = {
  mejora: "📈",
  estable: "➖",
  deterioro: "📉",
  datos_insuficientes: "❔",
};

const TREND_COLOR: Record<string, string> = {
  mejora: "text-success",
  estable: "text-muted-foreground",
  deterioro: "text-danger",
  datos_insuficientes: "text-muted-foreground",
};

const SEMAFORO_DOT: Record<string, string> = { verde: "🟢", amarillo: "🟡", naranjo: "🟠", rojo: "🔴", blanco: "⚪", negro: "⚫" };

const GAP_COLOR: Record<string, string> = {
  CUMPLE: "text-success",
  BRECHA_PARCIAL: "text-warning",
  BRECHA: "text-danger",
  NO_EVALUADO: "text-muted-foreground",
  NO_APLICA: "text-foreground",
};

const SECTIONS = [
  { id: "resumen", label: "Resumen y Control Room" },
  { id: "tendencias", label: "Tendencias" },
  { id: "recurrencias", label: "Recurrencias" },
  { id: "gap", label: "Gap Analysis" },
  { id: "inspeccion", label: "Modo Inspeccion" },
];

export function InteligenciaTab({ facilityId }: { facilityId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [periodDays, setPeriodDays] = useState(90);
  const [section, setSection] = useState("resumen");

  const load = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/radioterapia/intelligence?facilityId=" + facilityId + "&periodDays=" + periodDays);
      const json = await res.json();
      if (json.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [facilityId, periodDays]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <p className="text-sm text-muted-foreground">Cargando inteligencia de radioterapia...</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Sin datos disponibles.</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Resumen ejecutivo automatico</p>
            <p className="mt-1 text-sm text-foreground">{data.resumenEjecutivo}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
            >
              {PERIODS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <button onClick={load} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted">
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-lg font-semibold text-foreground">{data.estadoActual.cumplimientoPct !== null ? data.estadoActual.cumplimientoPct + "%" : "N/D"}</p>
          <p className="text-[11px] text-muted-foreground">Cumplimiento</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-lg font-semibold text-danger">{data.estadoActual.alertasCriticas}</p>
          <p className="text-[11px] text-muted-foreground">Alertas criticas</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-lg font-semibold text-foreground">{data.estadoActual.accionesAbiertas}</p>
          <p className="text-[11px] text-muted-foreground">Acciones abiertas</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-lg font-semibold text-foreground">{data.estadoActual.riesgosActivos}</p>
          <p className="text-[11px] text-muted-foreground">Riesgos activos</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-lg font-semibold text-foreground">{data.estadoActual.incidentesAbiertos ?? "N/D"}</p>
          <p className="text-[11px] text-muted-foreground">Incidentes abiertos</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={"rounded-md border px-3 py-1.5 text-xs " + (section === s.id ? "border-accent text-accent" : "border-border text-foreground hover:bg-muted")}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "resumen" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <ControlRoomCard title="🔴 Critico" items={data.controlRoom.critico} tone="text-danger" />
          <ControlRoomCard title="🟠 Importante" items={data.controlRoom.importante} tone="text-orange-500" />
          <ControlRoomCard title="🟡 Preventivo" items={data.controlRoom.preventivo} tone="text-warning" />
          <ControlRoomCard title="🟢 Normal" items={data.controlRoom.normal} tone="text-success" />
        </div>
      )}

      {section === "tendencias" && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">
            Comparacion de periodos ({data.meta.periodoActual.desde} a {data.meta.periodoActual.hasta} vs periodo anterior)
          </p>
          <div className="space-y-2">
            {data.tendencias.map((t: any, i: number) => (
              <div key={i} className="flex flex-wrap items-center justify-between rounded-md border border-border bg-background p-2 text-xs">
                <span className="text-foreground">{t.indicador}</span>
                <span className="text-muted-foreground">Actual: {t.actual}{t.unidad === "%" ? "%" : ""} | Anterior: {t.anterior ?? "S/D"}</span>
                <span className={TREND_COLOR[t.tendencia]}>{TREND_ICON[t.tendencia]} {t.tendenciaLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "recurrencias" && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Deteccion de repeticiones</p>
          {data.recurrencias.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin recurrencias detectadas con la informacion actual.</p>
          )}
          <div className="space-y-2">
            {data.recurrencias.map((r: any, i: number) => (
              <div key={i} className="rounded-md border-l-4 border-warning border border-border bg-background p-2 text-xs">
                <p className="font-medium text-foreground">⚠ {r.mensaje} — {r.tipo} ({r.campo}): {r.clave}</p>
                <p className="text-muted-foreground">Frecuencia: {r.frecuencia} | Ultimo evento: {String(r.ultimoEvento).slice(0, 10)}</p>
                {r.verificarEficaciaAccion && <p className="mt-1 font-medium text-danger">🔁 {r.mensajeEficacia}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "gap" && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Gap Analysis</p>
          <div className="mb-2 flex flex-wrap gap-3 text-xs">
            {Object.entries(data.gapAnalysis.resumen).map(([k, v]: any) => (
              <span key={k} className={GAP_COLOR[k] || "text-foreground"}>{k}: {v}</span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1">Requisito</th>
                  <th className="p-1">Estado</th>
                  <th className="p-1">Accion</th>
                </tr>
              </thead>
              <tbody>
                {data.gapAnalysis.items.map((g: any, i: number) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="p-1 text-foreground">{g.requisito}</td>
                    <td className={"p-1 font-medium " + (GAP_COLOR[g.gap] || "text-foreground")}>{g.gap}</td>
                    <td className="p-1 text-muted-foreground">{g.accion || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "inspeccion" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Indice automatico de preparacion de inspeccion</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.inspeccion.indiceAutomatico.map((c: any) => (
                <div key={c.numero} className="rounded-md border border-border bg-background p-2 text-xs">
                  <p className="font-medium text-foreground">{c.numero}. {c.categoria}</p>
                  <p className="text-muted-foreground">{c.conEvidencia}/{c.items} con evidencia</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Checklist de inspeccion</p>
            <div className="space-y-1">
              {data.inspeccion.checklist.map((c: any, i: number) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-2 text-xs">
                  <span className="text-foreground">{SEMAFORO_DOT[c.estado] || "⚪"} {c.requisito}</span>
                  <span className="text-muted-foreground">{c.responsable || "-"} {c.fecha ? "· " + String(c.fecha).slice(0, 10) : ""}</span>
                </div>
              ))}
            </div>
          </div>
          {data.inspeccion.vencimientosResumen && (
            <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
              Vencimientos: {data.inspeccion.vencimientosResumen.vencidos} vencidos, {data.inspeccion.vencimientosResumen.criticos7} criticos (7d),{" "}
              {data.inspeccion.vencimientosResumen.proximos15} proximos (15d), {data.inspeccion.vencimientosResumen.proximos30} proximos (30d).
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-3 text-[11px] text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Alcance de este panel</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {data.notasAlcance.map((n: string, i: number) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ControlRoomCard({ title, items, tone }: { title: string; items: any[]; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className={"mb-2 text-sm font-semibold " + tone}>{title} ({items.length})</p>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {items.slice(0, 15).map((it: any, i: number) => (
          <p key={i} className="text-[11px] text-muted-foreground">{it.detalle}</p>
        ))}
        {items.length === 0 && <p className="text-[11px] text-muted-foreground">Sin elementos.</p>}
      </div>
    </div>
  );
}
