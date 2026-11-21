"use client";

import { useState, useEffect, useCallback, type ComponentType } from "react";
import {
  FlaskConical, Plus, Pencil, Trash2, X, Save, AlertTriangle,
  CheckCircle2, Clock, ShieldCheck, Beaker, type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Límites regulatorios radiofarmacia — NS-06.0 §8, USP <797>, IAEA-TECDOC-1708
const QC_LIMITS = {
  RADIONUCLIDIC_PURITY_MIN: 99.9,
  RADIOCHEMICAL_PURITY_MIN: 95.0,
  PH_MIN: 4.0,
  PH_MAX: 8.5,
};

type PrepStatus = "pending" | "in_qc" | "released" | "rejected" | "expired" | "administered";

type RadioPharm = {
  id: number;
  name: string;
  isotope: string;
  half_life_days: number;
  batch_number: string;
  supplier: string | null;
  activity_bq: number;
  calibration_datetime: string;
  expiry_datetime: string;
  volume_ml: number | null;
  concentration_bq_ml: number | null;
  status: PrepStatus;
  service: string | null;
  notes: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: ComponentType<LucideProps> }> = {
  pending:      { label: "Pendiente",   color: "text-amber-400",     icon: Clock },
  in_qc:        { label: "En CQ",       color: "text-blue-400",      icon: Beaker },
  released:     { label: "Liberado",    color: "text-emerald-400",   icon: CheckCircle2 },
  rejected:     { label: "Rechazado",   color: "text-red-400",       icon: AlertTriangle },
  expired:      { label: "Vencido",     color: "text-red-500",       icon: AlertTriangle },
  administered: { label: "Administrado",color: "text-muted-foreground",icon: ShieldCheck },
};

const ISOTOPES = ["Tc-99m", "I-131", "I-123", "Ga-67", "Tl-201", "F-18", "Lu-177", "Y-90", "Ra-223", "Sm-153"];

const EMPTY: Omit<RadioPharm, "id"> = {
  name: "", isotope: "Tc-99m", half_life_days: 0.25,
  batch_number: "", supplier: null, activity_bq: 0,
  calibration_datetime: "", expiry_datetime: "",
  volume_ml: null, concentration_bq_ml: null,
  status: "pending", service: null, notes: null,
};

function fmtBq(val: number | null): string {
  if (val == null) return "—";
  if (val >= 1e9)  return `${(val / 1e9).toFixed(2)} GBq`;
  if (val >= 1e6)  return `${(val / 1e6).toFixed(2)} MBq`;
  return `${(val / 1e3).toFixed(2)} kBq`;
}

function fmtDate(val: string | null): string {
  if (!val) return "—";
  try { return new Date(val).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }); }
  catch { return val; }
}

function isExpired(expiry: string): boolean {
  return new Date(expiry) < new Date();
}

export default function RadiopharmacyPage() {
  const [records, setRecords] = useState<RadioPharm[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RadioPharm | null>(null);
  const [form, setForm] = useState<Omit<RadioPharm, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus !== "all" ? `/api/radiopharmacy?status=${filterStatus}` : "/api/radiopharmacy";
      const r = await fetch(url);
      const data = await r.json();
      setRecords(data.radiopharmaceuticals ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, calibration_datetime: new Date().toISOString().slice(0, 16) });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(r: RadioPharm) {
    setEditing(r);
    const { id: _id, ...rest } = r;
    setForm({
      ...rest,
      calibration_datetime: rest.calibration_datetime ? rest.calibration_datetime.slice(0, 16) : "",
      expiry_datetime: rest.expiry_datetime ? rest.expiry_datetime.slice(0, 16) : "",
    });
    setError(null);
    setModalOpen(true);
  }

  function set(k: keyof typeof form, v: string | number | null) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave(ev: { preventDefault: () => void }) {
    ev.preventDefault();
    if (!form.name.trim() || !form.batch_number.trim() || !form.calibration_datetime || !form.expiry_datetime) {
      setError("Nombre, lote, calibración y vencimiento son obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const method = editing ? "PATCH" : "POST";
      const body = editing ? { id: editing.id, ...form } : form;
      const r = await fetch("/api/radiopharmacy", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error");
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Marcar como vencido este radiofármaco?")) return;
    await fetch(`/api/radiopharmacy?id=${id}`, { method: "DELETE" });
    await load();
  }

  // KPIs
  const released     = records.filter((r) => r.status === "released").length;
  const inQc         = records.filter((r) => r.status === "in_qc").length;
  const expiredCount = records.filter((r) => r.status === "expired" || (r.expiry_datetime && isExpired(r.expiry_datetime) && r.status !== "administered")).length;
  const pending      = records.filter((r) => r.status === "pending").length;

  const displayed = filterStatus === "all" ? records : records.filter((r) => r.status === filterStatus);

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Radiofarmacia</h1>
          <p className="text-xs text-muted-foreground">Gestión de radiofármacos — NS-06.0 CCHEN § 8 · USP &lt;797&gt; · IAEA-TECDOC-1708</p>
        </div>
        <button onClick={openCreate} type="button"
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground hover:opacity-90">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Registrar radiofármaco
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Liberados",    value: released,     color: released > 0 ? "text-emerald-400" : "text-muted-foreground" },
          { label: "En control QC", value: inQc,        color: inQc > 0 ? "text-blue-400" : "text-muted-foreground" },
          { label: "Pendientes",   value: pending,      color: pending > 0 ? "text-amber-400" : "text-muted-foreground" },
          { label: "Vencidos",     value: expiredCount, color: expiredCount > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alerta vencidos */}
      {expiredCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{expiredCount} radiofármaco{expiredCount > 1 ? "s" : ""} vencido{expiredCount > 1 ? "s" : ""} — retiro inmediato requerido.</span>
        </div>
      )}

      {/* Filtro */}
      <div className="mb-3 flex gap-2 flex-wrap">
        {[["all","Todos"], ...Object.entries(STATUS_CONFIG).map(([k,v]) => [k,v.label])].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilterStatus(val)} type="button"
            className={cn("rounded-full border px-3 py-1 text-xs",
              filterStatus === val ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-muted text-muted-foreground")}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nombre / Isótopo</th>
              <th className="px-3 py-2">Lote</th>
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2">Actividad</th>
              <th className="px-3 py-2">Calibración</th>
              <th className="px-3 py-2">Vencimiento</th>
              <th className="px-3 py-2">Servicio</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {loading && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Cargando…</td></tr>
            )}
            {!loading && displayed.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                <FlaskConical className="mx-auto mb-2 h-8 w-8 opacity-20" />
                No hay registros con este filtro
              </td></tr>
            )}
            {displayed.map((r) => {
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              const expired = r.expiry_datetime && isExpired(r.expiry_datetime) && r.status !== "administered";
              return (
                <tr key={r.id} className={cn("hover:bg-muted/20", expired && r.status !== "expired" ? "bg-red-500/5" : "")}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-muted-foreground font-mono">{r.isotope}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.batch_number}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.supplier ?? "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums font-medium">{fmtBq(r.activity_bq)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(r.calibration_datetime)}</td>
                  <td className={cn("px-3 py-2.5 tabular-nums", expired ? "font-semibold text-red-400" : "text-muted-foreground")}>
                    {fmtDate(r.expiry_datetime)}{expired ? " ⚠" : ""}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.service ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("inline-flex items-center gap-1 font-medium", cfg.color)}>
                      <Icon className="h-3 w-3" />{cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(r)} title="Editar"
                        className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r.id)} title="Marcar vencido"
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

      {/* Referencia regulatoria */}
      <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Límites QC aplicables:</strong>{" "}
        Pureza radionuclídica ≥ {QC_LIMITS.RADIONUCLIDIC_PURITY_MIN}% · Pureza radioquímica ≥ {QC_LIMITS.RADIOCHEMICAL_PURITY_MIN}% (Tc-99m) · pH {QC_LIMITS.PH_MIN}–{QC_LIMITS.PH_MAX}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-2xl rounded-xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">{editing ? "Editar radiofármaco" : "Registrar radiofármaco"}</h2>
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
                    <input value={form.name} onChange={(e) => set("name", e.target.value)} required
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Isótopo *</span>
                    <select value={form.isotope} onChange={(e) => set("isotope", e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent">
                      {ISOTOPES.map((i) => <option key={i}>{i}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Número de lote *</span>
                    <input value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} required
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Proveedor</span>
                    <input value={form.supplier ?? ""} onChange={(e) => set("supplier", e.target.value || null)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Vida media (días)</span>
                    <input type="number" step="any" value={form.half_life_days}
                      onChange={(e) => set("half_life_days", parseFloat(e.target.value))}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Servicio destino</span>
                    <input value={form.service ?? ""} onChange={(e) => set("service", e.target.value || null)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                </div>
              </section>

              {/* Actividad */}
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actividad y fechas</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Actividad (Bq) *</span>
                    <input type="number" step="any" value={form.activity_bq}
                      onChange={(e) => set("activity_bq", parseFloat(e.target.value))} required
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Volumen (mL)</span>
                    <input type="number" step="any" value={form.volume_ml ?? ""}
                      onChange={(e) => set("volume_ml", e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Fecha/hora calibración *</span>
                    <input type="datetime-local" value={form.calibration_datetime}
                      onChange={(e) => set("calibration_datetime", e.target.value)} required
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Fecha/hora vencimiento *</span>
                    <input type="datetime-local" value={form.expiry_datetime}
                      onChange={(e) => set("expiry_datetime", e.target.value)} required
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                </div>
              </section>

              {/* Estado */}
              <section>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Estado</span>
                    <select value={form.status} onChange={(e) => set("status", e.target.value as PrepStatus)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Observaciones</span>
                    <input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent" />
                  </label>
                </div>
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
