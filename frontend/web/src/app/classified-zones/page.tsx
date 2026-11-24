"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  ShieldAlert,
  ShieldCheck,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";

interface ClassifiedZone {
  id: number;
  name: string;
  zone_type: "controlada" | "supervisada" | "libre";
  location: string;
  service: string | null;
  dose_limit_msv: number | null;
  monitoring_frequency: string | null;
  last_survey_date: string | null;
  next_survey_date: string | null;
  responsible: string | null;
  notes: string | null;
  status: "active" | "inactive";
  created_at: string;
}

const ZONE_CONFIG = {
  controlada: {
    label: "Controlada",
    description: ">6 mSv/año",
    icon: ShieldAlert,
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-300 dark:border-red-700",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    dot: "bg-red-500",
  },
  supervisada: {
    label: "Supervisada",
    description: "1–6 mSv/año",
    icon: ShieldCheck,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-700",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  libre: {
    label: "Libre",
    description: "<1 mSv/año",
    icon: Shield,
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-300 dark:border-green-700",
    badge: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    dot: "bg-green-500",
  },
};

const FREQUENCIES = ["diario", "semanal", "quincenal", "mensual", "trimestral", "semestral", "anual"];

const emptyForm = {
  name: "",
  zone_type: "supervisada" as "controlada" | "supervisada" | "libre",
  location: "",
  service: "",
  dose_limit_msv: "",
  monitoring_frequency: "mensual",
  last_survey_date: "",
  next_survey_date: "",
  responsible: "",
  notes: "",
};

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function ClassifiedZonesPage() {
  const [zones, setZones] = useState<ClassifiedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function loadZones() {
    setLoading(true);
    try {
      const res = await fetch("/api/classified-zones", { cache: "no-store" });
      if (res.ok) setZones(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadZones(); }, []);

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyForm });
    setError(null);
    setShowModal(true);
  }

  function openEdit(z: ClassifiedZone) {
    setEditId(z.id);
    setForm({
      name: z.name,
      zone_type: z.zone_type,
      location: z.location,
      service: z.service ?? "",
      dose_limit_msv: z.dose_limit_msv?.toString() ?? "",
      monitoring_frequency: z.monitoring_frequency ?? "mensual",
      last_survey_date: z.last_survey_date?.split("T")[0] ?? "",
      next_survey_date: z.next_survey_date?.split("T")[0] ?? "",
      responsible: z.responsible ?? "",
      notes: z.notes ?? "",
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.location.trim()) {
      setError("Nombre y ubicación son obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        dose_limit_msv: form.dose_limit_msv ? parseFloat(form.dose_limit_msv) : null,
        last_survey_date: form.last_survey_date || null,
        next_survey_date: form.next_survey_date || null,
        service: form.service || null,
        responsible: form.responsible || null,
        notes: form.notes || null,
      };

      const url = "/api/classified-zones";
      const method = editId ? "PATCH" : "POST";
      const body = editId ? { id: editId, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al guardar");
        return;
      }

      setShowModal(false);
      await loadZones();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/classified-zones?id=${id}`, { method: "DELETE" });
    setDeleteId(null);
    await loadZones();
  }

  const controlled = zones.filter((z) => z.zone_type === "controlada" && z.status === "active");
  const supervised = zones.filter((z) => z.zone_type === "supervisada" && z.status === "active");
  const free = zones.filter((z) => z.zone_type === "libre" && z.status === "active");
  const overdueZones = zones.filter((z) => z.status === "active" && isOverdue(z.next_survey_date));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MapPin className="h-4 w-4" />
            <span>Protección Radiológica</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Zonas Clasificadas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Clasificación y control de zonas según DS 3/1985 Art. 15 — MINSAL
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Zona
        </button>
      </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="classified-zones"
        ownerType="module"
        title="Documentos del módulo"
      />

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Controladas", value: controlled.length, cfg: ZONE_CONFIG.controlada },
          { label: "Supervisadas", value: supervised.length, cfg: ZONE_CONFIG.supervisada },
          { label: "Libres", value: free.length, cfg: ZONE_CONFIG.libre },
          {
            label: "Vencidas",
            value: overdueZones.length,
            cfg: {
              badge: overdueZones.length > 0
                ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                : "bg-muted text-muted-foreground",
              dot: overdueZones.length > 0 ? "bg-red-500" : "bg-muted-foreground",
            },
            icon: overdueZones.length > 0 ? AlertTriangle : CheckCircle2,
          },
        ].map((item, i) => {
          const Icon = "cfg" in item && "icon" in item.cfg
            ? item.cfg.icon as React.ComponentType<{ className?: string }>
            : (("icon" in item ? item.icon : null) as React.ComponentType<{ className?: string }> | null);
          return (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{item.value}</span>
                {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alerta vencidas */}
      {overdueZones.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-xl text-sm text-red-800 dark:text-red-300">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Monitoreo vencido en {overdueZones.length} zona(s)</p>
            <p className="text-xs mt-1 opacity-80">
              {overdueZones.map((z) => z.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Zone cards by type */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Cargando zonas…</div>
      ) : zones.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">No hay zonas registradas</p>
          <button onClick={openCreate} className="text-sm text-primary underline">
            Registrar primera zona
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {(["controlada", "supervisada", "libre"] as const).map((type) => {
            const typeZones = zones.filter((z) => z.zone_type === type);
            if (typeZones.length === 0) return null;
            const cfg = ZONE_CONFIG[type];
            const TypeIcon = cfg.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    Zona {cfg.label} — {cfg.description}
                  </h2>
                  <span className="text-xs text-muted-foreground">({typeZones.length})</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {typeZones.map((zone) => {
                    const overdue = isOverdue(zone.next_survey_date);
                    return (
                      <div
                        key={zone.id}
                        className={cn(
                          "rounded-xl border p-4 space-y-3",
                          cfg.bg,
                          cfg.border,
                          zone.status === "inactive" && "opacity-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm truncate">{zone.name}</span>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.badge)}>
                                {cfg.label}
                              </span>
                              {zone.status === "inactive" && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  Inactiva
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{zone.location}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => openEdit(zone)}
                              className="p-1.5 rounded-lg hover:bg-background/60 transition-colors text-muted-foreground hover:text-foreground"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteId(zone.id)}
                              className="p-1.5 rounded-lg hover:bg-background/60 transition-colors text-muted-foreground hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {zone.service && (
                            <div>
                              <span className="text-muted-foreground">Servicio: </span>
                              <span>{zone.service}</span>
                            </div>
                          )}
                          {zone.dose_limit_msv && (
                            <div>
                              <span className="text-muted-foreground">Límite: </span>
                              <span className="font-mono">{zone.dose_limit_msv} mSv/año</span>
                            </div>
                          )}
                          {zone.monitoring_frequency && (
                            <div>
                              <span className="text-muted-foreground">Monitoreo: </span>
                              <span className="capitalize">{zone.monitoring_frequency}</span>
                            </div>
                          )}
                          {zone.responsible && (
                            <div>
                              <span className="text-muted-foreground">Responsable: </span>
                              <span>{zone.responsible}</span>
                            </div>
                          )}
                        </div>

                        {/* Survey dates */}
                        <div className="flex items-center gap-4 text-xs">
                          {zone.last_survey_date && (
                            <div>
                              <span className="text-muted-foreground">Último: </span>
                              <span>{zone.last_survey_date.split("T")[0]}</span>
                            </div>
                          )}
                          {zone.next_survey_date && (
                            <div className={cn(overdue && "text-red-600 dark:text-red-400 font-medium")}>
                              <span className={cn(!overdue && "text-muted-foreground")}>Próximo: </span>
                              <span>{zone.next_survey_date.split("T")[0]}</span>
                              {overdue && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                            </div>
                          )}
                        </div>

                        {zone.notes && (
                          <p className="text-xs text-muted-foreground italic border-t border-border/50 pt-2">
                            {zone.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Regulatory note */}
      <div className="text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
        <p>
          <strong>Base normativa:</strong> DS 3/1985 (MINSAL) Art. 15 — Clasificación de zonas de trabajo con radiaciones ionizantes
        </p>
        <p>Zona controlada: dosis efectiva probable &gt;6 mSv/año · Zona supervisada: 1–6 mSv/año · Zona libre: &lt;1 mSv/año</p>
      </div>

      {/* Modal create/edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold">
                {editId ? "Editar Zona Clasificada" : "Nueva Zona Clasificada"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                  <input
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Sala de Medicina Nuclear"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo de Zona *</label>
                  <select
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={form.zone_type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        zone_type: e.target.value as "controlada" | "supervisada" | "libre",
                      }))
                    }
                  >
                    <option value="controlada">Controlada (&gt;6 mSv/año)</option>
                    <option value="supervisada">Supervisada (1–6 mSv/año)</option>
                    <option value="libre">Libre (&lt;1 mSv/año)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ubicación *</label>
                  <input
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Ej: Pabellón B, Piso 2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Servicio</label>
                    <input
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={form.service}
                      onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                      placeholder="Ej: Medicina Nuclear"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Límite dosis (mSv/año)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={form.dose_limit_msv}
                      onChange={(e) => setForm((f) => ({ ...f, dose_limit_msv: e.target.value }))}
                      placeholder="20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Frecuencia de monitoreo</label>
                  <select
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={form.monitoring_frequency}
                    onChange={(e) => setForm((f) => ({ ...f, monitoring_frequency: e.target.value }))}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Último monitoreo</label>
                    <input
                      type="date"
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={form.last_survey_date}
                      onChange={(e) => setForm((f) => ({ ...f, last_survey_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Próximo monitoreo</label>
                    <input
                      type="date"
                      className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={form.next_survey_date}
                      onChange={(e) => setForm((f) => ({ ...f, next_survey_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Responsable</label>
                  <input
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={form.responsible}
                    onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value }))}
                    placeholder="Nombre del responsable"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Notas</label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Observaciones adicionales…"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold">¿Eliminar zona?</h3>
            <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
