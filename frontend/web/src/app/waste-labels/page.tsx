"use client";


import { useEffect, useState, useCallback } from "react";
import {
  Tag, Plus, RefreshCw, ChevronDown, ChevronUp,
  FileText, Pencil, Trash2, Save, X, Clock,
  Radiation, Package, CheckCircle, AlertTriangle,
  TrendingDown, FlaskConical, Calendar, User,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type DisStateKey =
  | "pendiente"
  | "en_decaimiento"
  | "listo_para_liberar"
  | "liberado"
  | "eliminado";

interface WasteLabel {
  id: number;
  label_number: string;
  label_year: number;
  correlative: number;
  generation_date: string;
  entry_date?: string | null;
  service?: string | null;
  sala?: string | null;
  room_number?: string | null;
  paciente_nombre?: string | null;
  radionuclide_code?: string | null;
  actividad_estimada_residual?: number | null;
  unidad_actividad?: string | null;
  waste_type?: string | null;
  waste_type_other?: string | null;
  lot_number?: string | null;
  container?: string | null;
  storage_location?: string | null;
  responsible?: string | null;
  observations?: string | null;
  status: string;
  dispensa_estado?: DisStateKey | null;
  fecha_estimada_liberacion?: string | null;
  created_by?: string | null;
  created_at?: string;
}

interface StatsData {
  total: number;
  almacenados: number;
  liberados: number;
  pendientes: number;
}

const DIS_CFG: Record<DisStateKey, { label: string; cls: string; dot: string }> = {
  pendiente:            { label: "Pendiente",             cls: "bg-muted text-foreground/80 border border-border",     dot: "bg-gray-500" },
  en_decaimiento:       { label: "En decaimiento",        cls: "bg-blue-100 text-blue-700 border border-blue-200",     dot: "bg-blue-500" },
  listo_para_liberar:   { label: "Listo para liberar",    cls: "bg-green-100 text-green-700 border border-green-200",  dot: "bg-green-500" },
  liberado:             { label: "Liberado",               cls: "bg-teal-100 text-teal-700 border border-teal-200",    dot: "bg-teal-500" },
  eliminado:            { label: "Eliminado",              cls: "bg-red-100 text-red-700 border border-red-200",       dot: "bg-red-500" },
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pendiente:   { label: "Pendiente",   cls: "bg-yellow-100 text-yellow-700" },
  almacenado:  { label: "Almacenado",  cls: "bg-blue-100 text-blue-700" },
  liberado:    { label: "Liberado",    cls: "bg-green-100 text-green-700" },
  eliminado:   { label: "Eliminado",   cls: "bg-red-100 text-red-700" },
};

const DISPENSA_ESTADOS: DisStateKey[] = [
  "pendiente", "en_decaimiento", "listo_para_liberar", "liberado", "eliminado",
];

const WASTE_TYPES = [
  "capacho_i131", "generador_mo99_tc99m", "cortopunzante_tc99m",
  "ropa_cama", "basura_comun", "basura_bano", "otro",
];

const WASTE_TYPE_LABELS: Record<string, string> = {
  capacho_i131: "Capacho I-131",
  generador_mo99_tc99m: "Generador Mo-99/Tc-99m",
  cortopunzante_tc99m: "Cortopunzante Tc-99m",
  ropa_cama: "Ropa de cama",
  basura_comun: "Basura común",
  basura_bano: "Basura baño",
  otro: "Otro",
};

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { dateStyle: "short" });
}

function fmtDatetime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function dispensaCfg(label: WasteLabel): { label: string; cls: string; dot: string } {
  const k = (label.dispensa_estado ?? "pendiente") as DisStateKey;
  return DIS_CFG[k] ?? DIS_CFG.pendiente;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WasteLabelsPage() {
  const [rows, setRows] = useState<WasteLabel[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDispensa, setFilterDispensa] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterRn, setFilterRn] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // expanded cards
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // edit modal
  const [editLabel, setEditLabel] = useState<WasteLabel | null>(null);
  const [editForm, setEditForm] = useState({
    ubicacion: "", contenedor: "", observaciones: "", dispensa_estado: "pendiente" as DisStateKey,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), dir: "desc" });
      if (filterStatus) params.set("status", filterStatus);
      if (filterYear) params.set("year", filterYear);
      if (filterService) params.set("service", filterService);
      if (filterRn) params.set("radionuclide", filterRn);
      if (search) params.set("q", search);

      const [labelsRes, statsRes] = await Promise.all([
        fetch(`/api/waste-labels?${params}`),
        fetch("/api/waste-labels/stats"),
      ]);
      const labelsJson = await labelsRes.json();
      const statsJson = await statsRes.json();

      let filtered = labelsJson.rows ?? [];
      if (filterDispensa) {
        filtered = filtered.filter((r: WasteLabel) => (r.dispensa_estado ?? "pendiente") === filterDispensa);
      }
      setRows(filtered);
      setTotal(labelsJson.total ?? 0);
      setStats(statsJson.totals ?? null);
    } catch {
      setError("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterYear, filterService, filterRn, search, filterDispensa]);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const toggle = (id: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Edit ────────────────────────────────────────────────────────────────

  const openEdit = (lbl: WasteLabel) => {
    setEditLabel(lbl);
    setEditForm({
      ubicacion: lbl.storage_location ?? "",
      contenedor: lbl.container ?? "",
      observaciones: lbl.observations ?? "",
      dispensa_estado: (lbl.dispensa_estado ?? "pendiente") as DisStateKey,
    });
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editLabel) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/api/waste-labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editLabel.id,
          ubicacion: editForm.ubicacion || null,
          contenedor: editForm.contenedor || null,
          observaciones: editForm.observaciones || null,
          dispensa_estado: editForm.dispensa_estado,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        setEditError(j.error ?? "Error al actualizar.");
        return;
      }
      setEditLabel(null);
      await load();
    } catch {
      setEditError("Error de red.");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete (soft) ────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/waste-labels?id=${id}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch { /* ignore */ }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const years = Array.from(new Set(rows.map((r) => r.label_year))).sort((a, b) => b - a);
  const services = Array.from(new Set(rows.map((r) => r.service).filter(Boolean))).sort();
  const radionuclides = Array.from(new Set(rows.map((r) => r.radionuclide_code).filter(Boolean))).sort();

  return (
    <div className="min-h-screen bg-muted/50 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Tag className="h-4 w-4 text-orange-500" />
            <span>Gestión de Residuos</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Rótulos de Gestión de Residuos Radiactivos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rótulos individuales con correlativo anual, estado de decaimiento y proyección de liberación.
            DS 3/1985 · NS-06.0 §9.4 · IAEA GSG-1.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* ── Stats tiles ── */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total rótulos", value: stats.total, cls: "text-orange-700", dot: "bg-orange-500" },
            { label: "Pendientes", value: stats.pendientes, cls: "text-yellow-700", dot: "bg-yellow-500" },
            { label: "Almacenados", value: stats.almacenados, cls: "text-blue-700", dot: "bg-blue-500" },
            { label: "Liberados", value: stats.liberados, cls: "text-green-700", dot: "bg-green-500" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-full ${k.dot}`} />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <span className={`text-2xl font-bold ${k.cls}`}>{k.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar nro., sala, servicio, paciente…"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/80 min-w-[220px]"
        />
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/80">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterDispensa} onChange={(e) => { setFilterDispensa(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/80">
          <option value="">Todos los estados de dispensa</option>
          {DISPENSA_ESTADOS.map((s) => <option key={s} value={s}>{DIS_CFG[s].label}</option>)}
        </select>
        <select value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/80">
          <option value="">Todos los años</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterService} onChange={(e) => { setFilterService(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/80">
          <option value="">Todos los servicios</option>
          {services.map((s) => <option key={s!} value={s!}>{s}</option>)}
        </select>
        <select value={filterRn} onChange={(e) => { setFilterRn(e.target.value); setPage(1); }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/80">
          <option value="">Todos los radionúclidos</option>
          {radionuclides.map((r) => <option key={r!} value={r!}>{r}</option>)}
        </select>
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {rows.length} mostrados · {total} total
        </span>
      </div>

      {/* ── Content ── */}
      {loading && <div className="rounded-xl border border-border bg-background p-12 text-center text-muted-foreground">Cargando…</div>}
      {error && !loading && <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
          <Tag className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-muted-foreground text-sm">
            {total === 0 ? "No hay rótulos generados aún." : "No hay rótulos que coincidan con los filtros."}
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((lbl) => {
            const isOpen = expanded.has(lbl.id);
            const dcfg = dispensaCfg(lbl);
            const sCfg = STATUS_CFG[lbl.status] ?? STATUS_CFG.pendiente;
            return (
              <div key={lbl.id} className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
                <button onClick={() => toggle(lbl.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
                  <Tag className="h-5 w-5 text-orange-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground">{lbl.label_number}</span>
                      {lbl.radionuclide_code && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-mono text-indigo-700">{lbl.radionuclide_code}</span>
                      )}
                      {lbl.waste_type && (
                        <span className="rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700">{WASTE_TYPE_LABELS[lbl.waste_type] ?? lbl.waste_type}</span>
                      )}
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${dcfg.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dcfg.dot}`} />
                        {dcfg.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(lbl.generation_date)}</span>
                      {lbl.service && <span>{lbl.service}</span>}
                      {lbl.sala && <span>· {lbl.sala}</span>}
                      {lbl.paciente_nombre && <span className="flex items-center gap-1"><User className="h-3 w-3" />{lbl.paciente_nombre}</span>}
                      {lbl.fecha_estimada_liberacion && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <TrendingDown className="h-3 w-3" />Liberación estimada: {fmtDate(lbl.fecha_estimada_liberacion)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(lbl); }} className="rounded p-1 text-muted-foreground hover:text-orange-600 hover:bg-orange-50">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(lbl.id); }} className="rounded p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border/50 px-4 py-4 bg-muted/50">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 text-sm">
                      <Field label="Nro. rótulo" value={lbl.label_number} mono />
                      <Field label="Año" value={String(lbl.label_year)} />
                      <Field label="Correlativo" value={String(lbl.correlative)} />
                      <Field label="Generación" value={fmtDatetime(lbl.generation_date)} />
                      <Field label="Ingreso" value={fmtDate(lbl.entry_date)} />
                      <Field label="Radionúclido" value={lbl.radionuclide_code ?? "—"} />
                      <Field label="Tipo residuo" value={WASTE_TYPE_LABELS[lbl.waste_type ?? ""] ?? lbl.waste_type ?? "—"} />
                      {lbl.waste_type_other && <Field label="Tipo (otro)" value={lbl.waste_type_other} />}
                      {lbl.lot_number && <Field label="N° lote" value={lbl.lot_number} mono />}
                      <Field label="Servicio" value={lbl.service ?? "—"} />
                      <Field label="Sala" value={lbl.sala ?? "—"} />
                      {lbl.room_number && <Field label="N° habitación" value={lbl.room_number} />}
                      {lbl.paciente_nombre && <Field label="Paciente" value={lbl.paciente_nombre} />}
                      <Field label="Actividad residual" value={lbl.actividad_estimada_residual !== null && lbl.actividad_estimada_residual !== undefined ? `${lbl.actividad_estimada_residual} ${lbl.unidad_actividad ?? ""}` : "—"} />
                      <Field label="Contenedor" value={lbl.container ?? "—"} />
                      <Field label="Ubicación almacén" value={lbl.storage_location ?? "—"} />
                      <Field label="Responsable" value={lbl.responsible ?? "—"} />
                      <Field label="Estado dispensa" value={dcfg.label} />
                      {lbl.fecha_estimada_liberacion && <Field label="Fecha est. liberación" value={fmtDate(lbl.fecha_estimada_liberacion)} />}
                      {lbl.observations && <Field label="Observaciones" value={lbl.observations} className="col-span-3" />}
                    </dl>
                    <div className="mt-3 flex justify-end">
                      <a href={`/waste-labels/${lbl.id}`} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-background hover:text-orange-600">
                        <FlaskConical className="h-3 w-3" />
                        Ver mediciones y proyección
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* pagination */}
      {total > pageSize && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted/50">Anterior</button>
          <span className="text-sm text-muted-foreground">Página {page} · {Math.ceil(total / pageSize)} total</span>
          <button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted/50">Siguiente</button>
        </div>
      )}

      {/* ── Regulatory footer ── */}
      <div className="mt-8 rounded-xl border border-border bg-background p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium text-muted-foreground">Marco normativo aplicable</p>
            <p>DS 3/1985 (MINSAL) — Obligación de rótulo individualizado para residuos radiactivos generados en instalaciones médicas</p>
            <p>NS-06.0 §9.4 — Identificación, seguimiento y trazabilidad de rótulos de gestión de residuos con correlativo anual</p>
            <p>IAEA GSG-1 §4.5 — Labeling requirements for radioactive waste packages: mandatory fields and tracking</p>
            <p>OIEA SSG-45 — Waste characterization: measurement records linked to individual waste label number</p>
          </div>
        </div>
      </div>

      {/* ── Edit modal ── */}
      {editLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Actualizar rótulo</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{editLabel.label_number}</p>
              </div>
              <button onClick={() => setEditLabel(null)} className="text-muted-foreground hover:text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {editError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>}
              <FormField label="Estado de dispensa">
                <select value={editForm.dispensa_estado} onChange={(e) => setEditForm((p) => ({ ...p, dispensa_estado: e.target.value as DisStateKey }))} className={inp}>
                  {DISPENSA_ESTADOS.map((s) => <option key={s} value={s}>{DIS_CFG[s].label}</option>)}
                </select>
              </FormField>
              <FormField label="Ubicación de almacenamiento">
                <input type="text" value={editForm.ubicacion} onChange={(e) => setEditForm((p) => ({ ...p, ubicacion: e.target.value }))} placeholder="Sala, estante…" className={inp} />
              </FormField>
              <FormField label="Contenedor">
                <input type="text" value={editForm.contenedor} onChange={(e) => setEditForm((p) => ({ ...p, contenedor: e.target.value }))} placeholder="Tipo de contenedor" className={inp} />
              </FormField>
              <FormField label="Observaciones">
                <textarea rows={3} value={editForm.observaciones} onChange={(e) => setEditForm((p) => ({ ...p, observaciones: e.target.value }))} className={`${inp} resize-none`} />
              </FormField>
            </div>
            <div className="flex justify-end gap-3 border-t border-border/50 px-6 py-4">
              <button onClick={() => setEditLabel(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">Cancelar</button>
              <button onClick={handleEdit} disabled={editSaving} className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {editSaving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-full bg-red-100 p-2"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <div>
                <h3 className="font-semibold text-foreground">Eliminar rótulo</h3>
                <p className="mt-1 text-sm text-muted-foreground">El rótulo cambiará su estado de dispensa a "Eliminado" (soft delete). Se mantiene el historial para trazabilidad.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Field({ label, value, mono = false, className = "" }: { label: string; value: string | number; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
      <dd className={`text-sm text-foreground font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

// Suppress unused icon warnings
const _icons = { Package, CheckCircle, AlertTriangle, Radiation, Clock, FlaskConical };
void _icons;
