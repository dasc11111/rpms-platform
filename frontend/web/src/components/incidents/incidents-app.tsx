"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  NM_INCIDENT_CATEGORIES,
  NM_INCIDENT_SEVERITIES,
  NM_NOTIFICATION_STATUSES,
  NM_INVESTIGATION_STATUSES,
  NM_INCIDENT_STATUSES,
  type NmIncidentRecord,
} from "@/lib/nm-incidents";

// ─── Schema ────────────────────────────────────────────────────────────────────

const incidentSchema = z.object({
  event_date: z.string().min(1, "Fecha requerida"),
  event_time: z.string().nullable().optional(),
  category: z.enum(["derrame", "perdida_material", "exposicion", "contaminacion", "equipo", "otro"]),
  severity: z.enum(["leve", "moderado", "grave"]),
  is_near_miss: z.boolean().optional(),
  location: z.string().nullable().optional(),
  person_involved: z.string().nullable().optional(),
  description: z.string().min(5, "Descripción requerida"),
  immediate_actions: z.string().nullable().optional(),
  notification_status: z.enum(["pendiente", "notificado", "no_aplica"]),
  notified_to: z.string().nullable().optional(),
  investigation_status: z.enum(["abierto", "en_investigacion", "cerrado"]),
  corrective_actions: z.string().nullable().optional(),
  responsible: z.string().nullable().optional(),
  status: z.enum(["abierto", "cerrado"]),
});

type IncidentFormValues = z.infer<typeof incidentSchema>;

// ─── Style helpers ─────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  leve: "bg-blue-100 text-blue-800 border-blue-300",
  moderado: "bg-yellow-100 text-yellow-800 border-yellow-300",
  grave: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_STYLES: Record<string, string> = {
  abierto: "bg-red-100 text-red-800 border-red-300",
  cerrado: "bg-green-100 text-green-800 border-green-300",
};

const INV_STYLES: Record<string, string> = {
  abierto: "bg-red-50 text-red-700 border-red-200",
  en_investigacion: "bg-yellow-50 text-yellow-700 border-yellow-200",
  cerrado: "bg-green-50 text-green-700 border-green-200",
};

const _qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: "green" | "yellow" | "red" | "blue" | "gray" }) {
  const MAP = {
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    gray: "bg-muted border-border text-foreground",
  };
  return (
    <div className={`rounded-lg border p-4 ${MAP[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(hasError = false) {
  return `w-full rounded-md border bg-background px-3 py-1.5 text-sm transition-colors ${
    hasError ? "border-red-400" : "border-border focus:border-accent"
  } focus:outline-none focus:ring-1 focus:ring-accent/40`;
}

// ─── Form Modal ────────────────────────────────────────────────────────────────

function IncidentFormModal({
  onClose,
  onSaved,
  editing,
}: {
  onClose: () => void;
  onSaved: () => void;
  editing: NmIncidentRecord | null;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: editing
      ? {
          event_date: editing.event_date?.slice(0, 10) ?? "",
          event_time: editing.event_time ?? "",
          category: editing.category as IncidentFormValues["category"],
          severity: editing.severity as IncidentFormValues["severity"],
          is_near_miss: editing.is_near_miss ?? false,
          location: editing.location ?? "",
          person_involved: editing.person_involved ?? "",
          description: editing.description,
          immediate_actions: editing.immediate_actions ?? "",
          notification_status: editing.notification_status as IncidentFormValues["notification_status"],
          notified_to: editing.notified_to ?? "",
          investigation_status: editing.investigation_status as IncidentFormValues["investigation_status"],
          corrective_actions: editing.corrective_actions ?? "",
          responsible: editing.responsible ?? "",
          status: editing.status as IncidentFormValues["status"],
        }
      : {
          event_date: new Date().toISOString().slice(0, 10),
          category: "otro",
          severity: "leve",
          is_near_miss: false,
          notification_status: "pendiente",
          investigation_status: "abierto",
          status: "abierto",
        },
  });

  async function onSubmit(values: IncidentFormValues) {
    const url = editing ? `/api/incidents` : `/api/incidents`;
    const method = editing ? "PATCH" : "POST";
    const body = editing ? { id: editing.id, ...values } : values;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    await qc.invalidateQueries({ queryKey: ["incidents"] });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">
            {editing ? "Editar Incidente" : "Registrar Incidente"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha del evento *" error={errors.event_date?.message}>
              <input type="date" {...register("event_date")} className={inputCls(!!errors.event_date)} />
            </Field>
            <Field label="Hora">
              <input type="time" {...register("event_time")} className={inputCls()} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoría *" error={errors.category?.message}>
              <select {...register("category")} className={inputCls(!!errors.category)}>
                {NM_INCIDENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Severidad *" error={errors.severity?.message}>
              <select {...register("severity")} className={inputCls(!!errors.severity)}>
                {NM_INCIDENT_SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Descripción *" error={errors.description?.message}>
            <textarea
              {...register("description")}
              rows={3}
              className={inputCls(!!errors.description)}
              placeholder="Describa el incidente detalladamente..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ubicación">
              <input {...register("location")} className={inputCls()} placeholder="Sala, área..." />
            </Field>
            <Field label="Persona involucrada">
              <input {...register("person_involved")} className={inputCls()} placeholder="Nombre..." />
            </Field>
          </div>
          <Field label="Acciones inmediatas">
            <textarea
              {...register("immediate_actions")}
              rows={2}
              className={inputCls()}
              placeholder="Acciones tomadas inmediatamente..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Notificación" error={errors.notification_status?.message}>
              <select {...register("notification_status")} className={inputCls(!!errors.notification_status)}>
                {NM_NOTIFICATION_STATUSES.map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Notificado a">
              <input {...register("notified_to")} className={inputCls()} placeholder="CCHEN, MINSAL, dirección..." />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Estado investigación" error={errors.investigation_status?.message}>
              <select {...register("investigation_status")} className={inputCls(!!errors.investigation_status)}>
                {NM_INVESTIGATION_STATUSES.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Responsable">
              <input {...register("responsible")} className={inputCls()} placeholder="Nombre o cargo..." />
            </Field>
          </div>
          <Field label="Acciones correctivas">
            <textarea
              {...register("corrective_actions")}
              rows={2}
              className={inputCls()}
              placeholder="Medidas correctivas implementadas o planificadas..."
            />
          </Field>
          <div className="flex items-center gap-3">
            <Field label="Estado del incidente" error={errors.status?.message}>
              <select {...register("status")} className={inputCls(!!errors.status)}>
                {NM_INCIDENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm mt-4">
              <input type="checkbox" {...register("is_near_miss")} className="h-4 w-4" />
              Cuasi-accidente (near miss)
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Guardando..." : editing ? "Actualizar" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function IncidentsAppInner() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NmIncidentRecord | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterInv, setFilterInv] = useState("");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  if (filterCategory) params.set("category", filterCategory);
  if (filterSeverity) params.set("severity", filterSeverity);
  if (filterStatus) params.set("status", filterStatus);
  if (filterInv) params.set("investigation_status", filterInv);
  if (search) params.set("q", search);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["incidents", filterCategory, filterSeverity, filterStatus, filterInv, search],
    queryFn: async () => {
      const res = await fetch(`/api/incidents?${params}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: NmIncidentRecord[]; stats: Record<string, number> }>;
    },
  });

  function refresh() { refetch(); }
  const stats = data?.stats ?? { total: 0, abiertos: 0, en_investigacion: 0, cerrados: 0, graves: 0 };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Incidentes Radiológicos</h1>
          <p className="text-xs text-muted-foreground">
            Registro y seguimiento de incidentes y cuasi-accidentes radiológicos. DS 133/1984, Ley 18.302, CCHEN.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          + Registrar incidente
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total" value={stats.total} color="gray" />
        <StatCard label="Abiertos" value={stats.abiertos} color="red" />
        <StatCard label="En investigación" value={stats.en_investigacion} color="yellow" />
        <StatCard label="Cerrados" value={stats.cerrados} color="green" />
        <StatCard label="Graves" value={stats.graves} color="red" />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en descripción, lugar..."
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs w-56 focus:outline-none focus:border-accent"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="">Todas las categorías</option>
          {NM_INCIDENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="">Todas las severidades</option>
          {NM_INCIDENT_SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="">Todos los estados</option>
          {NM_INCIDENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterInv}
          onChange={(e) => setFilterInv(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="">Investigación: todos</option>
          {NM_INVESTIGATION_STATUSES.map((i) => (
            <option key={i.value} value={i.value}>{i.label}</option>
          ))}
        </select>
        {(filterCategory || filterSeverity || filterStatus || filterInv || search) && (
          <button
            onClick={() => { setFilterCategory(""); setFilterSeverity(""); setFilterStatus(""); setFilterInv(""); setSearch(""); }}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-500">Error: {String(error)}</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 max-w-[240px]">Descripción</th>
                <th className="px-3 py-2">Ubicación</th>
                <th className="px-3 py-2">Severidad</th>
                <th className="px-3 py-2">Investigación</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {(data?.data ?? []).map((inc) => {
                const catLabel = NM_INCIDENT_CATEGORIES.find((c) => c.value === inc.category)?.label ?? inc.category;
                return (
                  <tr key={inc.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                      <p>{new Date(inc.event_date).toLocaleDateString("es-CL")}</p>
                      {inc.event_time && <p className="text-muted-foreground/60">{inc.event_time}</p>}
                      {inc.is_near_miss && <span className="text-orange-500 text-xs font-medium">Near miss</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{catLabel}</td>
                    <td className="px-3 py-2.5 max-w-[240px]">
                      <p className="line-clamp-2 text-xs">{inc.description}</p>
                      {inc.person_involved && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">Involucrado: {inc.person_involved}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{inc.location ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[inc.severity] ?? "bg-muted text-foreground border-border"}`}>
                        {NM_INCIDENT_SEVERITIES.find((s) => s.value === inc.severity)?.label ?? inc.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${INV_STYLES[inc.investigation_status] ?? "bg-muted text-foreground border-border"}`}>
                        {NM_INVESTIGATION_STATUSES.find((i) => i.value === inc.investigation_status)?.label ?? inc.investigation_status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inc.status] ?? "bg-muted text-foreground border-border"}`}>
                        {NM_INCIDENT_STATUSES.find((s) => s.value === inc.status)?.label ?? inc.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => { setEditing(inc); setShowForm(true); }}
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {(data?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No se encontraron incidentes con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <IncidentFormModal
          onClose={() => setShowForm(false)}
          editing={editing}
          onSaved={() => { setShowForm(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function IncidentsApp() {
  return (
    <QueryClientProvider client={_qc}>
      <IncidentsAppInner />
    </QueryClientProvider>
  );
}
