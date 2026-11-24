"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, type ComponentType } from "react";
import {
  Shield, Plus, Pencil, Trash2, X, Save, AlertCircle,
  CheckCircle2, AlertTriangle, Clock, type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

type ShieldingRecord = {
  id: number;
  name: string;
  room: string;
  service: string | null;
  material: string;
  thickness_mm: string | null;
  lead_equivalent_mm: string | null;
  design_dose_rate_usv_h: string | null;
  measured_dose_rate_usv_h: string | null;
  last_measurement_date: string | null;
  next_measurement_date: string | null;
  status: string;
  notes: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: ComponentType<LucideProps> }> = {
  ok:      { label: "Conforme",    color: "text-emerald-400", icon: CheckCircle2 },
  review:  { label: "Revisar",     color: "text-amber-400",   icon: AlertTriangle },
  failed:  { label: "Falla",       color: "text-red-400",     icon: AlertCircle },
};

const MATERIALS = ["Plomo", "Concreto", "Hormigón baritado", "Acero", "Polietileno", "Vidrio plomado", "Otro"];

const EMPTY: Omit<ShieldingRecord, "id"> = {
  name: "", room: "", service: null, material: "Plomo",
  thickness_mm: null, lead_equivalent_mm: null,
  design_dose_rate_usv_h: null, measured_dose_rate_usv_h: null,
  last_measurement_date: null, next_measurement_date: null,
  status: "ok", notes: null,
};

export default function ShieldingPage() {
  const [records, setRecords] = useState<ShieldingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShieldingRecord | null>(null);
  const [form, setForm] = useState<Omit<ShieldingRecord, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/shielding");
      const data = await r.json();
      setRecords(data.shielding ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(rec: ShieldingRecord) {
    setEditing(rec);
    const { id: _id, ...rest } = rec;
    setForm(rest);
    setError(null);
    setModalOpen(true);
  }

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v === "" ? null : v }));
  }

  async function handleSave(ev: { preventDefault: () => void }) {
    ev.preventDefault();
    if (!form.name.trim() || !form.room.trim() || !form.material.trim()) {
      setError("Nombre, sala y material son obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const method = editing ? "PATCH" : "POST";
      const body = editing ? { id: editing.id, ...form } : form;
      const r = await fetch("/api/shielding", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este blindaje?")) return;
    await fetch(`/api/shielding?id=${id}`, { method: "DELETE" });
    await load();
  }

  const total  = records.length;
  const ok     = records.filter((s) => s.status === "ok").length;
  const review = records.filter((s) => s.status === "review").length;
  const overdue = records.filter((s) => s.next_measurement_date && new Date(s.next_measurement_date) < new Date()).length;
  const failed = records.filter((s) => s.status === "failed").length;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Blindajes</h1>
          <p className="text-xs text-muted-foreground">Control de blindajes — DS 3/1985 MINSAL · NS-06.0 CCHEN</p>
        </div>
        <button onClick={openCreate} type="button"
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground hover:opacity-90">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Registrar blindaje
        </button>
      </div>

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="shielding"
        ownerType="module"
        title="Documentos del módulo"
      />


      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total blindajes",   value: total,   color: "text-foreground" },
          { label: "Conformes",         value: ok,      color: ok > 0 ? "text-emerald-400" : "text-muted-foreground" },
          { label: "En revisión",       value: review,  color: review > 0 ? "text-amber-400" : "text-muted-foreground" },
          { label: "Medición vencida",  value: overdue, color: overdue > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {failed > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{failed} blindaje{failed > 1 ? "s" : ""} en falla — requiere acción inmediata.</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nombre / Ubicación</th>
              <th className="px-3 py-2">Sala</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2">Espesor</th>
              <th className="px-3 py-2">Pb equiv.</th>
              <th className="px-3 py-2">Tasa diseño</th>
              <th className="px-3 py-2">Tasa medida</th>
              <th className="px-3 py-2">Próx. medición</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {loading && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Cargando…</td></tr>
            )}
            {!loading && records.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                <Shield className="mx-auto mb-2 h-8 w-8 opacity-20" />
                No hay blindajes registrados
              </td></tr>
            )}
            {records.map((s) => {
              const isOverdue = s.next_measurement_date && new Date(s.next_measurement_date) < new Date();
              const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.review;
              const Icon = cfg.icon;
              return (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.room}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.service ?? "—"}</td>
                  <td className="px-3 py-2">{s.material}</td>
                  <td className="px-3 py-2 tabular-nums">{s.thickness_mm ? `${parseFloat(s.thickness_mm).toFixed(0)} mm` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{s.lead_equivalent_mm ? `${parseFloat(s.lead_equivalent_mm).toFixed(1)} mmPb` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{s.design_dose_rate_usv_h ? `${parseFloat(s.design_dose_rate_usv_h).toFixed(2)} µSv/h` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{s.measured_dose_rate_usv_h ? `${parseFloat(s.measured_dose_rate_usv_h).toFixed(2)} µSv/h` : "—"}</td>
                  <td className={cn("px-3 py-2 tabular-nums", isOverdue ? "font-semibold text-red-400" : "text-muted-foreground")}>
                    {s.next_measurement_date ?? "—"}{isOverdue && " ⚠"}
                  </td>
                  <td className={cn("px-3 py-2 font-semibold flex items-center gap-1", cfg.color)}>
                    <Icon className="h-3 w-3" />{cfg.label}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(s)} title="Editar"
                        className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} title="Eliminar"
                        className="rounded p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">{editing ? "Editar blindaje" : "Registrar blindaje"}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 overflow-y-auto max-h-[70vh] px-5 py-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
              )}

              {/* Identificación */}
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Identificación</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Nombre *</span>
                    <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} required
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Sala *</span>
                    <input value={form.room ?? ""} onChange={(e) => set("room", e.target.value)} required
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Servicio</span>
                    <input value={form.service ?? ""} onChange={(e) => set("service", e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Material *</span>
                    <select value={form.material ?? ""} onChange={(e) => set("material", e.target.value)} required
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent">
                      {MATERIALS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
              </section>

              {/* Parámetros técnicos */}
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Parámetros técnicos</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "thickness_mm" as const, label: "Espesor (mm)" },
                    { key: "lead_equivalent_mm" as const, label: "Equiv. plomo (mmPb)" },
                    { key: "design_dose_rate_usv_h" as const, label: "Tasa diseño (µSv/h)" },
                    { key: "measured_dose_rate_usv_h" as const, label: "Tasa medida (µSv/h)" },
                  ].map(({ key, label }) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
                      <input type="number" step="any" value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                    </label>
                  ))}
                </div>
              </section>

              {/* Mediciones y estado */}
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mediciones y estado</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Última medición</span>
                    <input type="date" value={form.last_measurement_date ?? ""} onChange={(e) => set("last_measurement_date", e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Próxima medición</span>
                    <input type="date" value={form.next_measurement_date ?? ""} onChange={(e) => set("next_measurement_date", e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Estado</span>
                    <select value={form.status ?? "ok"} onChange={(e) => set("status", e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent">
                      <option value="ok">Conforme</option>
                      <option value="review">En revisión</option>
                      <option value="failed">Falla</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs text-muted-foreground">Observaciones</span>
                  <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                </label>
              </section>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="rounded-md border border-border px-4 py-1.5 text-xs hover:bg-muted">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60">
                  <Save className="h-3.5 w-3.5" />{saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
