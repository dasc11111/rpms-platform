"use client";

import { Search, X } from "lucide-react";
import { MESES } from "@/lib/i131";

export type I131Filters = {
  q: string;
  paciente: string;
  run: string;
  radiofarmaco: string;
  medico_solicitante: string;
  procedencia: string;
  diagnostico: string;
  tipo_examen: string;
  equipo: string;
  prevision: string;
  ficha_clinica: string;
  partida: string;
  pedido_numero: string;
  year: string;
  month: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_FILTERS: I131Filters = {
  q: "",
  paciente: "",
  run: "",
  radiofarmaco: "",
  medico_solicitante: "",
  procedencia: "",
  diagnostico: "",
  tipo_examen: "",
  equipo: "",
  prevision: "",
  ficha_clinica: "",
  partida: "",
  pedido_numero: "",
  year: "",
  month: "",
  dateFrom: "",
  dateTo: "",
};

const LABEL = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
const INPUT =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

// Busqueda avanzada: permite combinar cualquiera de los campos existentes en
// la base de datos como criterio (fecha, paciente, RUN, radiofarmaco,
// medico solicitante, procedencia, diagnostico, tipo de examen, equipo,
// prevision, ficha, partida, pedido). Los resultados se filtran de forma
// dinamica en el componente padre en cada cambio.
export function I131SearchPanel({
  open,
  filters,
  onChange,
  onClear,
}: {
  open: boolean;
  filters: I131Filters;
  onChange: (filters: I131Filters) => void;
  onClear: () => void;
}) {
  if (!open) return null;

  function set<K extends keyof I131Filters>(key: K, value: string) {
    onChange({ ...filters, [key]: value });
  }

  const activeCount = Object.values(filters).filter((v) => v).length;

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Search className="h-4 w-4" /> Búsqueda avanzada
          {activeCount > 0 && (
            <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] text-foreground">
              {activeCount} filtro{activeCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            <X className="h-3 w-3" /> Limpiar filtros
          </button>
        )}
      </div>

      <div className="mb-3">
        <label className={LABEL}>Búsqueda rápida (paciente, RUN, ficha, partida, pedido)</label>
        <input
          className={INPUT}
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Escriba para buscar..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className={LABEL}>Año</label>
          <input className={INPUT} value={filters.year} onChange={(e) => set("year", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Mes</label>
          <select className={INPUT} value={filters.month} onChange={(e) => set("month", e.target.value)}>
            <option value="">Todos</option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Desde</label>
          <input
            type="date"
            className={INPUT}
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>Hasta</label>
          <input
            type="date"
            className={INPUT}
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL}>Paciente</label>
          <input className={INPUT} value={filters.paciente} onChange={(e) => set("paciente", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>RUN</label>
          <input className={INPUT} value={filters.run} onChange={(e) => set("run", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Radiofármaco</label>
          <input
            className={INPUT}
            value={filters.radiofarmaco}
            onChange={(e) => set("radiofarmaco", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>Ficha clínica</label>
          <input
            className={INPUT}
            value={filters.ficha_clinica}
            onChange={(e) => set("ficha_clinica", e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL}>Médico Nuclear</label>
          <input
            className={INPUT}
            value={filters.medico_solicitante}
            onChange={(e) => set("medico_solicitante", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>Procedencia</label>
          <input
            className={INPUT}
            value={filters.procedencia}
            onChange={(e) => set("procedencia", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>Diagnóstico</label>
          <input
            className={INPUT}
            value={filters.diagnostico}
            onChange={(e) => set("diagnostico", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>Tipo de examen</label>
          <input
            className={INPUT}
            value={filters.tipo_examen}
            onChange={(e) => set("tipo_examen", e.target.value)}
          />
        </div>

        <div>
          <label className={LABEL}>Equipo</label>
          <input className={INPUT} value={filters.equipo} onChange={(e) => set("equipo", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Previsión</label>
          <input className={INPUT} value={filters.prevision} onChange={(e) => set("prevision", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Partida</label>
          <input className={INPUT} value={filters.partida} onChange={(e) => set("partida", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>N° Pedido</label>
          <input
            className={INPUT}
            value={filters.pedido_numero}
            onChange={(e) => set("pedido_numero", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
