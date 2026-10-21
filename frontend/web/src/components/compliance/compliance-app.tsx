"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_STATUSES,
  COMPLIANCE_STATUS_LABELS,
  COMPLIANCE_PRIORITIES,
  COMPLIANCE_PRIORITY_LABELS,
  REVIEW_FREQUENCIES,
  REVIEW_FREQUENCY_LABELS,
  calcComplianceDerived,
  type ComplianceRequirement,
  type ComplianceFormInput,
} from "@/lib/compliance";

// ─── Schema Zod ─────────────────────────────────────────────────────────────

const complianceSchema = z.object({
  code: z.string().min(2, "Mínimo 2 caracteres"),
  requirement: z.string().min(5, "Descripción requerida"),
  regulation: z.string().min(2, "Reglamento requerido"),
  article_ref: z.string().nullable().optional(),
  category: z.enum(COMPLIANCE_CATEGORIES),
  priority: z.enum(COMPLIANCE_PRIORITIES),
  owner: z.string().min(2, "Responsable requerido"),
  review_frequency: z.enum(REVIEW_FREQUENCIES),
  last_review_date: z.string().nullable().optional(),
  next_review_date: z.string().nullable().optional(),
  status: z.enum(COMPLIANCE_STATUSES),
  evidence_description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type ComplianceFormValues = z.infer<typeof complianceSchema>;

// ─── Helpers de estilos ───────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  ok: "bg-green-100 text-green-800 border-green-300",
  pendiente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  vencido: "bg-red-100 text-red-800 border-red-300",
  programado: "bg-blue-100 text-blue-800 border-blue-300",
  no_aplica: "bg-gray-100 text-gray-600 border-gray-300",
};

const PRIORITY_DOT: Record<string, string> = {
  critica: "bg-red-500",
  alta: "bg-orange-400",
  media: "bg-yellow-400",
  baja: "bg-green-400",
};

const URGENCY_BADGE: Record<string, string> = {
  critica: "text-red-600 font-semibold",
  alta: "text-orange-500 font-medium",
  normal: "text-blue-600",
  ok: "text-green-600",
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
  return `w-full rounded-md border bg-background px-3 py-1.5 text-sm transition-colors ${hasError ? "border-red-400" : "border-border focus:border-accent"} focus:outline-none focus:ring-1 focus:ring-accent/40`;
}

// ─── Modal: Nuevo/Editar Requisito ────────────────────────────────────────────

function ComplianceFormModal({
  onClose,
  onSaved,
  editing,
}: {
  onClose: () => void;
  onSaved: () => void;
  editing: ComplianceRequirement | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ComplianceFormValues>({
    resolver: zodResolver(complianceSchema),
    defaultValues: editing
      ? {
          code: editing.code,
          requirement: editing.requirement,
          regulation: editing.regulation,
          article_ref: editing.article_ref ?? "",
          category: editing.category as ComplianceFormValues["category"],
          priority: editing.priority as ComplianceFormValues["priority"],
          owner: editing.owner,
          review_frequency: editing.review_frequency as ComplianceFormValues["review_frequency"],
          last_review_date: editing.last_review_date?.slice(0, 10) ?? "",
          next_review_date: editing.next_review_date?.slice(0, 10) ?? "",
          status: editing.status as ComplianceFormValues["status"],
          evidence_description: editing.evidence_description ?? "",
          notes: editing.notes ?? "",
        }
      : {
          category: "procedimientos",
          priority: "media",
          review_frequency: "anual",
          status: "pendiente",
        },
  });

  const onSubmit = async (values: ComplianceFormValues) => {
    const payload: ComplianceFormInput = {
      code: values.code,
      requirement: values.requirement,
      regulation: values.regulation,
      article_ref: values.article_ref || null,
      category: values.category,
      priority: values.priority,
      owner: values.owner,
      review_frequency: values.review_frequency,
      last_review_date: values.last_review_date || null,
      next_review_date: values.next_review_date || null,
      status: values.status,
      evidence_description: values.evidence_description || null,
      notes: values.notes || null,
    };

    const url = editing ? `/api/compliance?id=${editing.id}` : "/api/compliance";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{editing ? "Editar Requisito" : "Nuevo Requisito"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[80vh] overflow-y-auto px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código *" error={errors.code?.message}>
              <input {...register("code")} placeholder="COMP-021" className={inputCls(!!errors.code)} />
            </Field>
            <Field label="Categoría *" error={errors.category?.message}>
              <select {...register("category")} className={inputCls(!!errors.category)}>
                {COMPLIANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{COMPLIANCE_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Requisito *" error={errors.requirement?.message}>
            <textarea {...register("requirement")} rows={2} className={inputCls(!!errors.requirement)} placeholder="Descripción del requisito normativo..." />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reglamento *" error={errors.regulation?.message}>
              <input {...register("regulation")} placeholder="DS 133/1984" className={inputCls(!!errors.regulation)} />
            </Field>
            <Field label="Artículo / Sección" error={errors.article_ref?.message}>
              <input {...register("article_ref")} placeholder="Art. 62" className={inputCls(!!errors.article_ref)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Prioridad *" error={errors.priority?.message}>
              <select {...register("priority")} className={inputCls(!!errors.priority)}>
                {COMPLIANCE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{COMPLIANCE_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </Field>
            <Field label="Estado *" error={errors.status?.message}>
              <select {...register("status")} className={inputCls(!!errors.status)}>
                {COMPLIANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>{COMPLIANCE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Frecuencia revisión *" error={errors.review_frequency?.message}>
              <select {...register("review_frequency")} className={inputCls(!!errors.review_frequency)}>
                {REVIEW_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{REVIEW_FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Responsable *" error={errors.owner?.message}>
            <input {...register("owner")} placeholder="OPR / Jefe Unidad / TM Senior" className={inputCls(!!errors.owner)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Última revisión" error={errors.last_review_date?.message}>
              <input type="date" {...register("last_review_date")} className={inputCls(!!errors.last_review_date)} />
            </Field>
            <Field label="Próxima revisión" error={errors.next_review_date?.message}>
              <input type="date" {...register("next_review_date")} className={inputCls(!!errors.next_review_date)} />
            </Field>
          </div>

          <Field label="Evidencia / Documentación" error={errors.evidence_description?.message}>
            <input {...register("evidence_description")} placeholder="N° acta, código documento, plataforma..." className={inputCls(!!errors.evidence_description)} />
          </Field>

          <Field label="Notas" error={errors.notes?.message}>
            <textarea {...register("notes")} rows={2} className={inputCls(!!errors.notes)} placeholder="Observaciones adicionales..." />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-border mt-4">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
            >
              {isSubmitting ? "Guardando..." : editing ? "Actualizar" : "Crear Requisito"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Actualizar Estado ─────────────────────────────────────────────────

function StatusUpdateModal({
  req,
  onClose,
  onSaved,
}: {
  req: ComplianceRequirement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(req.status);
  const [lastDate, setLastDate] = useState(req.last_review_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [evidence, setEvidence] = useState(req.evidence_description ?? "");
  const [notes, setNotes] = useState(req.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/compliance?id=${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          last_review_date: lastDate || null,
          evidence_description: evidence || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <p className="text-xs text-muted-foreground">{req.code}</p>
            <h3 className="text-sm font-semibold line-clamp-1">{req.requirement}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ComplianceRequirement["status"])}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              {COMPLIANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{COMPLIANCE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Fecha última revisión</label>
            <input
              type="date"
              value={lastDate}
              onChange={(e) => setLastDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Evidencia / Documentación</label>
            <input
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="N° acta, referencia documental..."
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
            Cancelar
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Actualizar Estado"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App Inner ────────────────────────────────────────────────────────────────

type StatsRow = { status: string; n: string };

function ComplianceAppInner() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ComplianceRequirement | null>(null);
  const [statusModal, setStatusModal] = useState<ComplianceRequirement | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (filterCategory) params.set("category", filterCategory);
  if (filterStatus) params.set("status", filterStatus);
  if (filterPriority) params.set("priority", filterPriority);

  const { data, isLoading, error } = useQuery({
    queryKey: ["compliance", filterCategory, filterStatus, filterPriority],
    queryFn: async () => {
      const res = await fetch(`/api/compliance?${params.toString()}&limit=200`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        data: ComplianceRequirement[];
        stats: StatsRow[];
        total: number;
      }>;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["compliance"] });

  const statCount = (status: string) =>
    Number(data?.stats.find((s) => s.status === status)?.n ?? 0);

  const totalOk = statCount("ok");
  const totalPendiente = statCount("pendiente");
  const totalVencido = statCount("vencido");
  const totalProgramado = statCount("programado");

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Cumplimiento Normativo</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            DS 133/1984 · DS 3/1985 MINSAL · Ley 18.302 · NCh 2764 · CCHEN
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          + Nuevo Requisito
        </button>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Al día" value={totalOk} color="green" />
        <StatCard label="Pendientes" value={totalPendiente} color="yellow" />
        <StatCard label="Vencidos" value={totalVencido} color="red" />
        <StatCard label="Programados" value={totalProgramado} color="blue" />
      </div>

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="">Todas las categorías</option>
          {COMPLIANCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{COMPLIANCE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="">Todos los estados</option>
          {COMPLIANCE_STATUSES.map((s) => (
            <option key={s} value={s}>{COMPLIANCE_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="">Todas las prioridades</option>
          {COMPLIANCE_PRIORITIES.map((p) => (
            <option key={p} value={p}>{COMPLIANCE_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        {(filterCategory || filterStatus || filterPriority) && (
          <button
            onClick={() => { setFilterCategory(""); setFilterStatus(""); setFilterPriority(""); }}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-500">Error: {String(error)}</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Requisito</th>
                <th className="px-3 py-2">Reglamento</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Prioridad</th>
                <th className="px-3 py-2">Responsable</th>
                <th className="px-3 py-2">Próxima revisión</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {(data?.data ?? []).map((req) => {
                const derived = calcComplianceDerived(req);
                return (
                  <tr key={req.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-mono text-xs">{req.code}</td>
                    <td className="px-3 py-2.5 max-wl[260px]">
                      <p className="font-medium line-clamp-2">{req.requirement}</p>
                      {req.evidence_description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Evidencia: {req.evidence_description}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {req.regulation}
                      {req.article_ref && <span className="ml-1 text-muted-foreground/60">{req.article_ref}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {COMPLIANCE_CATEGORY_LABELS[req.category as keyof typeof COMPLIANCE_CATEGORY_LABELS] ?? req.category}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[req.priority] ?? "bg-gray-300"}`} />
                        <span className="text-xs">{COMPLIANCE_PRIORITY_LABELS[req.priority as keyof typeof COMPLIANCE_PRIORITY_LABELS] ?? req.priority}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{req.owner}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {req.next_review_date ? (
                        <>
                          <p>{new Date(req.next_review_date).toLocaleDateString("es-CL")}</p>
                          {derived.days_until_review !== null && (
                            <p className={`text-xs ${URGENCY_BADGE[derived.urgency]}`}>
                              {derived.urgency_label}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status] ?? "bg-muted text-foreground border-border"}`}>
                        {COMPLIANCE_STATUS_LABELS[req.status as keyof typeof COMPLIANCE_STATUS_LABELS] ?? req.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setStatusModal(req)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Estado
                        </button>
                        <button
                          onClick={() => { setEditing(req); setShowForm(true); }}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(data?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No se encontraron requisitos con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modales */}
      {showForm && (
        <ComplianceFormModal
          onClose={() => setShowForm(false)}
          editing={editing}
          onSaved={() => { setShowForm(false); setEditing(null); refresh(); }}
        />
      )}
      {statusModal && (
        <StatusUpdateModal
          req={statusModal}
          onClose={() => setStatusModal(null)}
          onSaved={() => { setStatusModal(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function ComplianceApp() {
  return (
    <QueryClientProvider client={_qc}>
      <ComplianceAppInner />
    </QueryClientProvider>
  );
}
