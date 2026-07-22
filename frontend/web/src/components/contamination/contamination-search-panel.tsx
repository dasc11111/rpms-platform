"use client";

import { Search, X } from "lucide-react";
import { MESES, ESTADO_OPTIONS, CLASIFICACION_LABELS } from "@/lib/contamination";

export type ContaminationFilters = {
  q: string;
  area: string;
  sala: string;
  dependencia: string;
  punto_medicion: string;
  equipo: string;
  superficie: string;
  radionuclido: string;
  instrumento: string;
  responsable: string;
  motivo: string;
  accion_correctiva: string;
  observaciones: string;
  estado: string;
  clasificacion: string;
  year: string;
  month: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_FILTERS: ContaminationFilters = {
  q: "",
  area: "",
  sala: "",
  dependencia: "",
  punto_medicion: "",
  equipo: "",
  superficie: "",
  radionuclido: "",
  instrumento: "",
  responsable: "",
  motivo: "",
  accion_correctiva: "",
  observaciones: "",
  estado: "",
  clasificacion: "",
  year: "",
  month: "",
  dateFrom: "",
  dateTo: "",
};

const LABEL = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
const INPUT =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

// Busqueda avanzada: permite combinar cualquiera de los campos existentes en
// la base de datos como criterio (fecha, area, sala, equipo, radionuclido,
// detector, responsable, resultado, estado, actividad, observaciones, accion
// correctiva). Los resultados se filtran de forma dinamica en el componente
// padre en cada cambio.
export function ContaminationSearchPanel({
  open,
  filters,
  onChange,
  onClear,
}: {
  open: boolean;
  filters: ContaminationFilters;
  onChange: (filters: ContaminationFilters) => void;
  onClear: () => void;
}) {
  if (!open) return null;

  function set<K extends keyof ContaminationFilters>(key: K, value: string) {
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
        <label className={LABEL}>Búsqueda rápida (punto, área, sala, responsable, observaciones)</label>
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
          <input type="date" className={INPUT} value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Hasta</label>
          <input type="date" className={INPUT} value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
        </div>

        <div>
          <label className={LABEL}>Área</label>
          <input className={INPUT} value={filters.area} onChange={(e) => set("area", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Sala</label>
          <input className={INPUT} value={filters.sala} onChange={(e) => set("sala", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Dependencia</label>
          <input className={INPUT} value={filters.dependencia} onChange={(e) => set("dependencia", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Punto de medición</label>
          <input className={INPUT} value={filters.punto_medicion} onChange={(e) => set("punto_medicion", e.target.value)} />
        </div>

        <div>
          <label className={LABEL}>Equipo</label>
          <input className={INPUT} value={filters.equipo} onChange={(e) => set("equipo", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Radionúclido</label>
          <input className={INPUT} value={filters.radionuclido} onChange={(e) => set("radionuclido", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Instrumento (detector)</label>
          <input className={INPUT} value={filters.instrumento} onChange={(e) => set("instrumento", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Responsable</label>
          <input className={INPUT} value={filters.responsable} onChange={(e) => set("responsable", e.target.value)} />
        </div>

        <div>
          <label className={LABEL}>Estado</label>
          <select className={INPUT} value={filters.estado} onChange={(e) => set("estado", e.target.value)}>
            <option value="">Todos</option>
            {ESTADO_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Resultado</label>
          <select className={INPUT} value={filters.clasificacion} onChange={(e) => set("clasificacion", e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(CLASIFICACION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Acción correctiva</label>
          <input
            className={INPUT}
            value={filters.accion_correctiva}
            onChange={(e) => set("accion_correctiva", e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL}>Observaciones</label>
          <input className={INPUT} value={filters.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
