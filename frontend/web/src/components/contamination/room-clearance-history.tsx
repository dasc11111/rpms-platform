"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Search, X } from "lucide-react";
import { CLASIFICACION_LABELS } from "@/lib/contamination";
import {
  RC_RADIONUCLIDOS,
  RC_ESTADO_GENERAL_LABELS,
  RC_AREA_LABELS,
  type RcEstadoGeneral,
  type RcResumenArea,
  type RcAreaTipo,
} from "@/lib/room-clearance";

type EvalRow = {
  id: number;
  eval_date: string;
  responsable: string;
  radionuclido: string;
  instrumento_utilizado: string | null;
  observaciones_generales: string | null;
  estado_general_laboratorio: RcEstadoGeneral;
  resumen_laboratorio: RcResumenArea;
  estado_general_sala: RcEstadoGeneral;
  resumen_sala: RcResumenArea;
  usuario: string | null;
  version_formulario: string;
  created_at: string;
};

type PointRow = {
  id: number;
  area_tipo: RcAreaTipo;
  punto: string;
  cps_medida: string | number;
  cps_fondo: string | number;
  tasa_dosis_usv_h: string | number | null;
  cps_neto: string | number;
  bq_cm2: string | number;
  bq_m2: string | number;
  pct_limite: string | number | null;
  clasificacion: string;
  semaforo: string;
  cumple: boolean;
};

const ESTADO_DOT: Record<string, string> = {
  liberado: "bg-green-500",
  conforme: "bg-green-500",
  requiere_descontaminacion: "bg-yellow-500",
  no_liberado: "bg-red-500",
};

const SEMAFORO_DOT: Record<string, string> = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-500",
  rojo: "bg-red-500",
};

function fmtNum(v: string | number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function EstadoBadge({ estado }: { estado: RcEstadoGeneral }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span className={`h-2 w-2 rounded-full ${ESTADO_DOT[estado] ?? "bg-muted"}`} />
      {RC_ESTADO_GENERAL_LABELS[estado]}
    </span>
  );
}

// Historial de evaluaciones de "Liberacion de Sala" con busqueda por fecha,
// responsable, radioisotopo, estado de Laboratorio y estado de Sala de
// Pacientes. Cada fila puede expandirse para ver el detalle punto por punto
// (consulta bajo demanda a /api/room-clearance/detail?id=...).
export function RoomClearanceHistory() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [responsable, setResponsable] = useState("");
  const [radionuclido, setRadionuclido] = useState("");
  const [estadoLaboratorio, setEstadoLaboratorio] = useState("");
  const [estadoSala, setEstadoSala] = useState("");
  const [q, setQ] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [rows, setRows] = useState<EvalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [detailPoints, setDetailPoints] = useState<PointRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (responsable) params.set("responsable", responsable);
    if (radionuclido) params.set("radionuclido", radionuclido);
    if (estadoLaboratorio) params.set("estadoLaboratorio", estadoLaboratorio);
    if (estadoSala) params.set("estadoSala", estadoSala);
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return params.toString();
  }, [dateFrom, dateTo, responsable, radionuclido, estadoLaboratorio, estadoSala, q, page]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/room-clearance?${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setError("No se pudo cargar el historial"))
      .finally(() => setLoading(false));
  }, [query]);

  function toggleExpand(id: number) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setDetailLoading(true);
    setDetailPoints([]);
    fetch(`/api/room-clearance/detail?id=${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setDetailPoints(data.points ?? []))
      .catch(() => setDetailPoints([]))
      .finally(() => setDetailLoading(false));
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setResponsable("");
    setRadionuclido("");
    setEstadoLaboratorio("");
    setEstadoSala("");
    setQ("");
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Desde">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Responsable">
            <input
              type="text"
              value={responsable}
              onChange={(e) => {
                setResponsable(e.target.value);
                setPage(1);
              }}
              placeholder="Nombre del responsable"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Radioisótopo">
            <select
              value={radionuclido}
              onChange={(e) => {
                setRadionuclido(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {RC_RADIONUCLIDOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado Laboratorio">
            <select
              value={estadoLaboratorio}
              onChange={(e) => {
                setEstadoLaboratorio(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {(Object.keys(RC_ESTADO_GENERAL_LABELS) as RcEstadoGeneral[]).map((k) => (
                <option key={k} value={k}>
                  {RC_ESTADO_GENERAL_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado Sala">
            <select
              value={estadoSala}
              onChange={(e) => {
                setEstadoSala(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {(Object.keys(RC_ESTADO_GENERAL_LABELS) as RcEstadoGeneral[]).map((k) => (
                <option key={k} value={k}>
                  {RC_ESTADO_GENERAL_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Búsqueda libre (responsable / observaciones)">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar..."
                className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
          </Field>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-2 py-2">Fecha</th>
              <th className="px-2 py-2">Responsable</th>
              <th className="px-2 py-2">Radioisótopo</th>
              <th className="px-2 py-2">Laboratorio</th>
              <th className="px-2 py-2">Sala de Pacientes</th>
              <th className="px-2 py-2">Instrumento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                  No hay evaluaciones registradas con estos filtros.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <>
                  <tr
                    key={row.id}
                    onClick={() => toggleExpand(row.id)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <td className="px-2 py-2 text-muted-foreground">
                      {expanded === row.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">{row.eval_date?.slice(0, 10)}</td>
                    <td className="px-2 py-2">{row.responsable}</td>
                    <td className="px-2 py-2">{row.radionuclido}</td>
                    <td className="px-2 py-2">
                      <EstadoBadge estado={row.estado_general_laboratorio} />
                    </td>
                    <td className="px-2 py-2">
                      <EstadoBadge estado={row.estado_general_sala} />
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{row.instrumento_utilizado ?? "—"}</td>
                  </tr>
                  {expanded === row.id && (
                    <tr>
                      <td colSpan={7} className="bg-background/40 px-4 py-3">
                        {detailLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <div className="space-y-4">
                            {row.observaciones_generales && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Observaciones:</span> {row.observaciones_generales}
                              </p>
                            )}
                            <DetailArea title="Laboratorio" area="laboratorio" resumen={row.resumen_laboratorio} points={detailPoints} />
                            <DetailArea title="Sala de Pacientes" area="sala_pacientes" resumen={row.resumen_sala} points={detailPoints} />
                            <p className="text-xs text-muted-foreground">
                              Registrado por {row.usuario ?? row.responsable} · versión de formulario {row.version_formulario} ·{" "}
                              {new Date(row.created_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} evaluación{total === 1 ? "" : "es"} encontrada{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            type="button"
            className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            type="button"
            className="rounded-md border border-border px-2.5 py-1 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DetailArea({
  title,
  area,
  resumen,
  points,
}: {
  title: string;
  area: RcAreaTipo;
  resumen: RcResumenArea;
  points: PointRow[];
}) {
  const areaPoints = points.filter((p) => p.area_tipo === area);
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">
          {resumen.puntos_contaminados}/{resumen.total_puntos} puntos con contaminación
          {resumen.punto_mayor_contaminacion && (
            <> · Mayor: {resumen.punto_mayor_contaminacion} ({fmtNum(resumen.max_bq_cm2)} Bq/cm²)</>
          )}
        </span>
      </div>
      {areaPoints.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1">Punto</th>
                <th className="px-2 py-1">CPS Medida</th>
                <th className="px-2 py-1">CPS Fondo</th>
                <th className="px-2 py-1">µSv/h</th>
                <th className="px-2 py-1">CPS Neto</th>
                <th className="px-2 py-1">Bq/cm²</th>
                <th className="px-2 py-1">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {areaPoints.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-2 py-1 font-medium">{p.punto}</td>
                  <td className="px-2 py-1">{fmtNum(p.cps_medida, 1)}</td>
                  <td className="px-2 py-1">{fmtNum(p.cps_fondo, 1)}</td>
                  <td className="px-2 py-1">{p.tasa_dosis_usv_h !== null ? fmtNum(p.tasa_dosis_usv_h) : "—"}</td>
                  <td className="px-2 py-1">{fmtNum(p.cps_neto, 1)}</td>
                  <td className="px-2 py-1">{fmtNum(p.bq_cm2)}</td>
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${SEMAFORO_DOT[p.semaforo] ?? "bg-muted"}`} />
                      {CLASIFICACION_LABELS[p.clasificacion as keyof typeof CLASIFICACION_LABELS] ?? p.clasificacion}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
