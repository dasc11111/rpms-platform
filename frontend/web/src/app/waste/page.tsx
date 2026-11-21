"use client";

import { useState, useEffect, useCallback } from "react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import {
  AlertTriangle, CheckCircle2, Trash2, Package, Clock,
  ShieldAlert, Plus, Pencil, X, Loader2, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── types ───────────────────────────────────────────────────────────────────
type WasteCategory = "exempt" | "llw" | "ilw" | "hlw";
type WasteStatus   = "storage" | "decay_waiting" | "ready_release" | "transferred" | "disposed";
type WasteState    = "solid" | "liquid" | "gas";

interface WasteRow {
  id: number;
  container_code: string;
  nuclide: string;
  category: WasteCategory;
  physical_state: WasteState;
  activity_bq_initial: number;
  activity_reference_date: string;
  half_life_days: number | null;
  volume_liters: number | null;
  mass_kg: number | null;
  location: string | null;
  status: WasteStatus;
  estimated_release_date: string | null;
  generated_by: string | null;
  notes: string | null;
}

// ─── constants ───────────────────────────────────────────────────────────────
const NUCLIDE_HALF_LIFE: Record<string, number> = {
  "I-131":   8.02,
  "Tc-99m":  0.251,
  "F-18":    0.077,
  "Ga-67":   3.26,
  "In-111":  2.80,
  "Tl-201":  3.05,
  "Lu-177":  6.65,
  "Y-90":    2.67,
  "Sr-89":   50.5,
  "P-32":    14.3,
  "Co-57":   272,
  "Ra-223":  11.4,
};

const NUCLIDES = Object.keys(NUCLIDE_HALF_LIFE);

const CAT_CONFIG: Record<WasteCategory, { label: string; cls: string; desc: string }> = {
  exempt:  { label: "Exento",  cls: "text-green-700 bg-green-50 border-green-200",   desc: "< 10× Bq exento" },
  llw:     { label: "BBNA",   cls: "text-blue-700 bg-blue-50 border-blue-200",       desc: "Baja actividad" },
  ilw:     { label: "MBNA",   cls: "text-amber-700 bg-amber-50 border-amber-200",    desc: "Media actividad" },
  hlw:     { label: "ABNA",   cls: "text-red-700 bg-red-50 border-red-200",          desc: "Alta actividad" },
};

const STATUS_CONFIG: Record<WasteStatus, { label: string; cls: string; icon: ComponentType<LucideProps> }> = {
  storage:        { label: "En almacén",      cls: "text-blue-700 bg-blue-50",    icon: Package },
  decay_waiting:  { label: "En decaimiento",  cls: "text-amber-700 bg-amber-50",  icon: Clock },
  ready_release:  { label: "Listo liberar",   cls: "text-green-700 bg-green-50",  icon: CheckCircle2 },
  transferred:    { label: "Transferido",     cls: "text-purple-700 bg-purple-50", icon: Archive },
  disposed:       { label: "Eliminado",       cls: "text-gray-500 bg-gray-100",   icon: Trash2 },
};

const PHYSICAL_STATES: { value: WasteState; label: string }[] = [
  { value: "solid",  label: "Sólido" },
  { value: "liquid", label: "Líquido" },
  { value: "gas",    label: "Gaseoso" },
];

const CATEGORIES: { value: WasteCategory; label: string }[] = [
  { value: "exempt", label: "Exento" },
  { value: "llw",    label: "BBNA — Baja actividad" },
  { value: "ilw",    label: "MBNA — Media actividad" },
  { value: "hlw",    label: "ABNA — Alta actividad" },
];

const STATUSES: { value: WasteStatus; label: string }[] = [
  { value: "storage",       label: "En almacén" },
  { value: "decay_waiting", label: "En decaimiento" },
  { value: "ready_release", label: "Listo para liberar" },
  { value: "transferred",   label: "Transferido" },
  { value: "disposed",      label: "Eliminado" },
];

const EXEMPT_LIMIT_BQ = 37000; // 37 kBq ~ límite exención típico

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtBq(bq: number): string {
  if (bq >= 1e12) return `${(bq / 1e12).toFixed(2)} TBq`;
  if (bq >= 1e9)  return `${(bq / 1e9).toFixed(2)} GBq`;
  if (bq >= 1e6)  return `${(bq / 1e6).toFixed(2)} MBq`;
  if (bq >= 1e3)  return `${(bq / 1e3).toFixed(1)} kBq`;
  return `${bq.toFixed(0)} Bq`;
}

function calcCurrentBq(initialBq: number, refDate: string, halfLifeDays: number): number {
  if (halfLifeDays <= 0) return initialBq;
  const elapsed = (Date.now() - new Date(refDate).getTime()) / 86400000;
  return initialBq * Math.pow(0.5, elapsed / halfLifeDays);
}

function daysUntilExempt(initialBq: number, refDate: string, halfLifeDays: number): number | null {
  if (!halfLifeDays || halfLifeDays <= 0) return null;
  if (initialBq <= EXEMPT_LIMIT_BQ) return 0;
  const elapsed = (Date.now() - new Date(refDate).getTime()) / 86400000;
  const tHalf = halfLifeDays * Math.log2(initialBq / EXEMPT_LIMIT_BQ);
  return Math.max(0, Math.ceil(tHalf - elapsed));
}

function halfLife(row: WasteRow): number {
  return row.half_life_days ?? NUCLIDE_HALF_LIFE[row.nuclide] ?? 10;
}

// ─── blank form ──────────────────────────────────────────────────────────────
function blankForm() {
  return {
    container_code: "",
    nuclide: "I-131",
    category: "llw" as WasteCategory,
    physical_state: "solid" as WasteState,
    activity_bq_initial: "",
    activity_reference_date: new Date().toISOString().slice(0, 16),
    half_life_days: "",
    volume_liters: "",
    mass_kg: "",
    location: "",
    status: "decay_waiting" as WasteStatus,
    estimated_release_date: "",
    generated_by: "",
    notes: "",
  };
}

// ─── KPI card ────────────────────────────────────────────────────────────────
function KPI({ label, value, icon: Icon, tone }: {
  label: string; value: number;
  icon: ComponentType<LucideProps>;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  const colors = {
    default: "text-foreground",
    warning: "text-amber-600",
    success: "text-green-600",
    danger:  "text-red-600",
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={cn("text-2xl font-bold", colors[tone ?? "default"])}>{value}</div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────
export default function WastePage() {
  const [containers, setContainers] = useState<WasteRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilter]   = useState<WasteStatus | "all">("all");
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<WasteRow | null>(null);
  const [form, setForm]             = useState(blankForm());
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/radioactive-waste");
      const data = await res.json();
      setContainers(data.containers ?? []);
    } catch {
      setError("Error cargando residuos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm(blankForm());
    setError(null);
    setShowModal(true);
  }

  function openEdit(row: WasteRow) {
    setEditing(row);
    setForm({
      container_code:         row.container_code,
      nuclide:                row.nuclide,
      category:               row.category,
      physical_state:         row.physical_state,
      activity_bq_initial:    String(row.activity_bq_initial),
      activity_reference_date: row.activity_reference_date?.slice(0, 16) ?? "",
      half_life_days:         row.half_life_days != null ? String(row.half_life_days) : "",
      volume_liters:          row.volume_liters != null ? String(row.volume_liters) : "",
      mass_kg:                row.mass_kg != null ? String(row.mass_kg) : "",
      location:               row.location ?? "",
      status:                 row.status,
      estimated_release_date: row.estimated_release_date?.slice(0, 16) ?? "",
      generated_by:           row.generated_by ?? "",
      notes:                  row.notes ?? "",
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSave(ev: { preventDefault: () => void }) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        activity_bq_initial:    form.activity_bq_initial    ? Number(form.activity_bq_initial) : undefined,
        half_life_days:         form.half_life_days          ? Number(form.half_life_days) : undefined,
        volume_liters:          form.volume_liters           ? Number(form.volume_liters) : undefined,
        mass_kg:                form.mass_kg                 ? Number(form.mass_kg) : undefined,
        activity_reference_date: form.activity_reference_date || undefined,
        estimated_release_date:  form.estimated_release_date  || undefined,
        ...(editing ? { id: editing.id } : {}),
      };
      const method = editing ? "PATCH" : "POST";
      const res = await fetch("/api/radioactive-waste", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Error guardando");
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDispose(id: number) {
    if (!confirm("¿Marcar este contenedor como eliminado (disposed)?")) return;
    await fetch(`/api/radioactive-waste?id=${id}`, { method: "DELETE" });
    load();
  }

  // filter
  const filtered = filterStatus === "all"
    ? containers
    : containers.filter(r => r.status === filterStatus);

  // KPIs
  const totalStorage      = containers.filter(r => r.status === "storage").length;
  const totalDecaying     = containers.filter(r => r.status === "decay_waiting").length;
  const totalReady        = containers.filter(r => r.status === "ready_release").length;
  const totalHlw          = containers.filter(r => r.category === "hlw").length;
  const readyForRelease   = containers.filter(r => {
    const hl = halfLife(r);
    const days = daysUntilExempt(r.activity_bq_initial, r.activity_reference_date, hl);
    return days === 0 && r.status !== "disposed";
  }).length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Residuos Radiactivos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inventario, seguimiento de decaimiento y gestión de residuos radiactivos hospitalarios
          </p>
          <p className="text-xs text-muted-foreground">
            NS-06.0 §9 CCHEN · DS 133/1984 · IAEA GSG-1 · IAEA GSR Part 5
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nuevo contenedor
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KPI label="Total activos"      value={containers.length}  icon={Package}      />
        <KPI label="En almacén"         value={totalStorage}       icon={Package}      tone="warning" />
        <KPI label="En decaimiento"     value={totalDecaying}      icon={Clock}        />
        <KPI label="Listos liberar"     value={totalReady}         icon={CheckCircle2} tone={totalReady > 0 ? "success" : "default"} />
        <KPI label="Listos (cálculo)"   value={readyForRelease}    icon={CheckCircle2} tone={readyForRelease > 0 ? "success" : "default"} />
        <KPI label="ABNA"               value={totalHlw}           icon={ShieldAlert}  tone={totalHlw > 0 ? "danger" : "default"} />
      </div>

      {/* Alert: containers ready */}
      {readyForRelease > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="inline h-4 w-4 mr-1" />
          <strong>{readyForRelease}</strong> contenedor{readyForRelease > 1 ? "es" : ""} ha alcanzado nivel exento y puede ser liberado.
        </div>
      )}

      {/* Category guide */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold mb-3">Clasificación IAEA GSG-1 / NS-06.0 §9</h2>
        <div className="grid gap-3 text-xs md:grid-cols-4">
          {(Object.entries(CAT_CONFIG) as [WasteCategory, (typeof CAT_CONFIG)[WasteCategory]][]).map(([cat, info]) => (
            <div key={cat} className={cn("rounded-lg border p-3", info.cls)}>
              <span className="font-bold">{info.label}</span>
              <div className="mt-1 font-medium">{info.desc}</div>
              <div className="mt-0.5 text-current/60">
                {cat === "exempt" && "Libre de gestión especial"}
                {cat === "llw"    && "Almacen. temporal + decaimiento"}
                {cat === "ilw"    && "Gestión especializada CCHEN"}
                {cat === "hlw"    && "Almacen. seguro a largo plazo"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {([["all", "Todos"] as const, ...STATUSES.map(s => [s.value, s.label] as const)]).map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setFilter(val as WasteStatus | "all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              filterStatus === val
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Inventario de Contenedores</h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} contenedor{filtered.length !== 1 ? "es" : ""}
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Sin contenedores. Haga clic en <strong>Nuevo contenedor</strong> para registrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Nuclido</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 font-medium">Estado físico</th>
                  <th className="px-3 py-2 font-medium text-right">Act. inicial</th>
                  <th className="px-3 py-2 font-medium text-right">Act. actual</th>
                  <th className="px-3 py-2 font-medium">T½ (días)</th>
                  <th className="px-3 py-2 font-medium">Días p/ liberar</th>
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((r) => {
                  const hl   = halfLife(r);
                  const curr = calcCurrentBq(r.activity_bq_initial, r.activity_reference_date, hl);
                  const days = daysUntilExempt(r.activity_bq_initial, r.activity_reference_date, hl);
                  const cat  = CAT_CONFIG[r.category] ?? CAT_CONFIG.llw;
                  const st   = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.storage;
                  return (
                    <tr key={r.id} className={cn(
                      r.category === "hlw"            ? "bg-red-50/20"   :
                      r.status === "ready_release"    ? "bg-green-50/20" :
                      "hover:bg-muted/30 transition-colors"
                    )}>
                      <td className="px-4 py-1.5 font-mono font-medium">{r.container_code}</td>
                      <td className="px-3 py-1.5 font-mono">{r.nuclide}</td>
                      <td className="px-3 py-1.5">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", cat.cls)}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 capitalize">{r.physical_state}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtBq(r.activity_bq_initial)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-blue-600">{fmtBq(curr)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{hl.toFixed(2)}</td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {days === null ? "—" :
                         days === 0   ? <span className="text-green-600 font-semibold">✓ Listo</span> :
                                        `${days} días`}
                      </td>
                      <td className="px-3 py-1.5 max-w-[160px] truncate text-muted-foreground" title={r.location ?? ""}>
                        {r.location ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", st.cls)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)}
                            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDispose(r.id)}
                            className="rounded p-1 hover:bg-red-50 text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-background shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
              <h2 className="font-semibold text-lg">
                {editing ? "Editar contenedor" : "Nuevo contenedor de residuos"}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Identificación */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Identificación del contenedor
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Código contenedor *</label>
                    <input required value={form.container_code} onChange={e => setForm(f => ({ ...f, container_code: e.target.value }))}
                      placeholder="RW-001"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Responsable</label>
                    <input value={form.generated_by} onChange={e => setForm(f => ({ ...f, generated_by: e.target.value }))}
                      placeholder="TM Diego Solís Catalán"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Categoría IAEA *</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as WasteCategory }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Estado físico</label>
                    <select value={form.physical_state} onChange={e => setForm(f => ({ ...f, physical_state: e.target.value as WasteState }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {PHYSICAL_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">Ubicación</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="Bodega residuos Sala I-131"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
              </section>

              {/* Radiactividad */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Radiactividad y nuclido
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Nuclido *</label>
                    <select value={form.nuclide} onChange={e => {
                      const hl = NUCLIDE_HALF_LIFE[e.target.value];
                      setForm(f => ({ ...f, nuclide: e.target.value, half_life_days: hl ? String(hl) : f.half_life_days }));
                    }}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {NUCLIDES.map(n => <option key={n} value={n}>{n}</option>)}
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Vida media (días)</label>
                    <input type="number" step="0.001" min="0" value={form.half_life_days}
                      onChange={e => setForm(f => ({ ...f, half_life_days: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Actividad inicial (Bq) *</label>
                    <input required type="number" step="any" min="0" value={form.activity_bq_initial}
                      onChange={e => setForm(f => ({ ...f, activity_bq_initial: e.target.value }))}
                      placeholder="3700000000"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Fecha referencia actividad</label>
                    <input type="datetime-local" value={form.activity_reference_date}
                      onChange={e => setForm(f => ({ ...f, activity_reference_date: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Volumen (L)</label>
                    <input type="number" step="0.001" min="0" value={form.volume_liters}
                      onChange={e => setForm(f => ({ ...f, volume_liters: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Masa (kg)</label>
                    <input type="number" step="0.001" min="0" value={form.mass_kg}
                      onChange={e => setForm(f => ({ ...f, mass_kg: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
              </section>

              {/* Estado y fechas */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Estado y gestión
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Estado</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as WasteStatus }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Fecha estimada liberación</label>
                    <input type="datetime-local" value={form.estimated_release_date}
                      onChange={e => setForm(f => ({ ...f, estimated_release_date: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">Observaciones</label>
                    <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>
                </div>
              </section>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editing ? "Guardar cambios" : "Registrar contenedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
