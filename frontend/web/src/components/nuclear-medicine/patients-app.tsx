"use client";

import { useEffect, useState } from "react";
import { Search, Syringe, Trash2 } from "lucide-react";

type PatientRow = {
  paciente_run: string;
  paciente_nombre: string;
  total_administraciones: number;
  total_liberaciones: number;
  ultima_actividad: string | null;
  primera_actividad: string | null;
};

type TimelineRow = {
  origen: "i131" | "room_release";
  id: number;
  event_date: string | null;
  paciente_nombre: string;
  paciente_run: string;
  detalle_principal: string | null;
  valor: string | number | null;
  unidad: string | null;
  responsable: string | null;
  contexto: string | null;
  observaciones: string | null;
};

function formatDate(d: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("es-CL");
  } catch {
    return d;
  }
}

export function PatientsApp() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/nuclear-medicine/patients?${params.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setRows(data.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [q]);

  function openPatient(run: string) {
    setSelected(run);
    setTimelineLoading(true);
    fetch(`/api/nuclear-medicine/patients/timeline?run=${encodeURIComponent(run)}`)
      .then((r) => r.json())
      .then((data) => setTimeline(data.rows ?? []))
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoading(false));
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Pacientes y Tratamientos</h1>
      </div>
      <p className="mb-4 max-w-3xl text-xs text-muted-foreground">
        Vista de trazabilidad de solo lectura (Fase 1): combina Administracion de I-131 y Liberacion de Sala
        usando el RUN del paciente como llave comun. No permite crear, editar ni eliminar registros; los datos
        se administran desde cada modulo de origen.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por RUN o nombre..."
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-xs outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
            Pacientes ({rows.length}){loading ? " — cargando..." : ""}
          </h2>
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1.5 pr-2 font-medium">Paciente</th>
                  <th className="py-1.5 pr-2 font-medium">RUN</th>
                  <th className="py-1.5 pr-2 font-medium text-center">I-131</th>
                  <th className="py-1.5 pr-2 font-medium text-center">Liberaciones</th>
                  <th className="py-1.5 pr-2 font-medium">Ultima actividad</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.paciente_run}
                    onClick={() => openPatient(r.paciente_run)}
                    className={`cursor-pointer border-t border-border/60 hover:bg-muted/40 ${
                      selected === r.paciente_run ? "bg-accent-subtle" : ""
                    }`}
                  >
                    <td className="py-1.5 pr-2">{r.paciente_nombre || "—"}</td>
                    <td className="py-1.5 pr-2">{r.paciente_run}</td>
                    <td className="py-1.5 pr-2 text-center">{r.total_administraciones}</td>
                    <td className="py-1.5 pr-2 text-center">{r.total_liberaciones}</td>
                    <td className="py-1.5 pr-2">{formatDate(r.ultima_actividad)}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      Sin pacientes con RUN registrado en I-131 o Liberacion de Sala.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
            {selected ? `Linea de tiempo — ${selected}` : "Selecciona un paciente"}
          </h2>
          {!selected && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Haz clic en un paciente de la lista para ver su trazabilidad.
            </p>
          )}
          {selected && timelineLoading && (
            <p className="py-6 text-center text-xs text-muted-foreground">Cargando...</p>
          )}
          {selected && !timelineLoading && (
            <div className="max-h-[560px] space-y-2 overflow-y-auto">
              {timeline.map((t) => (
                <div key={`${t.origen}-${t.id}`} className="flex items-start gap-2 rounded-md border border-border/60 p-2">
                  {t.origen === "i131" ? (
                    <Syringe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
                  ) : (
                    <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
                  )}
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {t.origen === "i131" ? "Administracion I-131" : "Liberacion de Sala"}
                      </span>
                      <span className="text-muted-foreground">{formatDate(t.event_date)}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      {t.detalle_principal ?? "—"}
                      {t.valor !== null && t.valor !== undefined ? ` · ${t.valor} ${t.unidad ?? ""}` : ""}
                    </p>
                    {t.contexto && <p className="text-muted-foreground">{t.contexto}</p>}
                    {t.responsable && <p className="text-muted-foreground">Responsable: {t.responsable}</p>}
                  </div>
                </div>
              ))}
              {timeline.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">Sin eventos para este paciente.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
