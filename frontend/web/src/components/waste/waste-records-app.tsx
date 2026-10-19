"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  RADIONUCLIDES,
  WASTE_CATEGORIES,
  WASTE_CATEGORY_LABELS,
  DISPOSAL_ROUTES,
  DISPOSAL_ROUTE_LABELS,
  WASTE_STATE_LABELS,
  ORIGIN_AREA_OPTIONS,
  type WasteRecord,
  type WasteFormInput,
  type WasteDerived,
} from "@/lib/waste-records";

// ─── CPS ↔ Bq helpers ───────────────────────────────────────────────────────
const CPS_EFF_DEFAULTS: Record<string, number> = {
  "I-131": 15, "Tc-99m": 25, "I-123": 22, "Ga-67": 18,
  "Tl-201": 20, "F-18": 8, "Lu-177": 12, "Y-90": 3,
};
function cpsToMbq(cps: number, eff_pct: number): number {
  if (eff_pct <= 0) return 0;
  return cps / (eff_pct / 100) / 1_000_000;
}
function mbqToBqPerCm2(mbq: number, area_cm2: number): number {
  return (mbq * 1_000_000) / area_cm2;
}
const _wastequeryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

const wasteSchema = z.object({
  container_label: z.string().min(2, "Minimo 2 caracteres"),
  radionuclide: z.enum(RADIONUCLIDES),
  waste_category: z.enum(WASTE_CATEGORIES),
  input_mode: z.enum(["mbq", "cps"]).default("mbq"),
  cps_value: z.coerce.number().positive().optional(),
  cps_efficiency_pct: z.coerce.number().min(0.1).max(100).default(15),
  measurement_area_cm2: z.coerce.number().positive().default(100),
  initial_activity_mbq: z.coerce.number().positive("Debe ser mayor que 0").optional(),
  initial_activity_date: z.string().min(1, "Requerido"),
  mass_or_volume_kg: z.coerce.number().nullable().optional(),
  container_count: z.coerce.number().int().positive().default(1),
  origin_area: z.string().min(2, "Requerido"),
  associated_patient_id: z.string().nullable().optional(),
  generated_by: z.string().min(2, "Requerido"),
  notes: z.string().nullable().optional(),
  disposal_route: z.enum(DISPOSAL_ROUTES).nullable().optional(),
});

type WasteFormValues = z.infer<typeof wasteSchema>;

type WasteRecordEnriched = WasteRecord & { derived: WasteDerived };

const SEMAPHORE_COLORS = {
  verde: "bg-green-100 text-green-800 border-green-300",
  amarillo: "bg-yellow-100 text-yellow-800 border-yellow-300",
  rojo: "bg-red-100 text-red-800 border-red-300",
};

const SEMAPHORE_DOT = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-500",
  rojo: "bg-red-500",
};

function WasteRecordsAppInner() {
  const [showForm, setShowForm] = useState(false);
  const [filterState, setFilterState] = useState("");
  const [filterRadionuclide, setFilterRadionuclide] = useState("");
  const [releaseModal, setReleaseModal] = useState<WasteRecordEnriched | null>(null);

  const qc = useQueryClient();
  const [inputMode, setInputMode] = useState<"mbq"|"cps">("mbq");

  const params = new URLSearchParams();
  if (filterState) params.set("state", filterState);
  if (filterRadionuclide) params.set("radionuclide", filterRadionuclide);

  const { data, isLoading, error } = useQuery({
    queryKey: ["waste", filterState, filterRadionuclide],
    queryFn: async () => {
      const res = await fetch(`/api/waste-records?${params.toString()}&limit=100`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ data: WasteRecordEnriched[]; total: number }>;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WasteFormValues>({
    resolver: zodResolver(wasteSchema),
    defaultValues: {
      container_count: 1,
      initial_activity_date: new Date().toISOString().slice(0, 16),
      cps_efficiency_pct: 15,
      measurement_area_cm2: 100,
    },
  });

  // CPS preview
  const _wCps = watch("cps_value");
  const _wEff = watch("cps_efficiency_pct");
  const _wArea = watch("measurement_area_cm2");
  const _wRadio = watch("radionuclide");
  const cpsEffDefault = _wRadio ? (CPS_EFF_DEFAULTS[_wRadio] ?? 15) : 15;
  const cpsPreviewMbq = (inputMode === "cps" && _wCps && (_wEff ?? 15) > 0)
    ? cpsToMbq(Number(_wCps), Number(_wEff ?? 15))
    : null;
  const cpsPreviewBqCm2 = cpsPreviewMbq !== null
    ? mbqToBqPerCm2(cpsPreviewMbq, Number(_wArea ?? 100))
    : null;

  const createMutation = useMutation({
    mutationFn: async (data: WasteFormInput) => {
      const res = await fetch("/api/waste-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waste"] });
      reset();
      setShowForm(false);
    },
  });

  const onSubmit = (values: WasteFormValues) => {
    // Derive MBq from cps if in cps mode
    let mbq = Number(values.initial_activity_mbq ?? 0);
    if (inputMode === "cps" && values.cps_value && values.cps_efficiency_pct) {
      mbq = cpsToMbq(Number(values.cps_value), Number(values.cps_efficiency_pct));
    }
    if (mbq <= 0) return;
    createMutation.mutate({
      ...values,
      initial_activity_mbq: mbq,
      mass_or_volume_kg: values.mass_or_volume_kg ?? null,
      associated_patient_id: values.associated_patient_id ?? null,
      notes: values.notes ?? null,
      disposal_route: values.disposal_route ?? null,
    });
  };

  const releaseMutation = useMutation({
    mutationFn: async ({
      id, state, disposal_route, released_by, release_notes,
    }: {
      id: string; state: string; disposal_route?: string;
      released_by?: string; release_notes?: string;
    }) => {
      const res = await fetch("/api/waste-records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, state, disposal_route, released_by, release_notes }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waste"] });
      setReleaseModal(null);
    },
  });

  const records = data?.data ?? [];
  const readyToRelease = records.filter((r) => r.derived.can_release && r.state === "en_decaimiento");
  const inStorage = records.filter((r) => ["en_almacenamiento", "en_decaimiento"].includes(r.state));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Residuos Radiactivos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modulo D · Gestion y trazabilidad · DS 133/1984 · CCHEN
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          {showForm ? "Cancelar" : "+ Nuevo registro"}
        </button>
      </div>

      <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
        <strong>Nota OPR:</strong> Los criterios de liberacion (≥10 T½) son orientativos.
        Verificar contra la autorizacion CCHEN vigente y el procedimiento interno aprobado.
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total en almacenamiento" value={inStorage.length} color="blue" />
        <StatCard label="Listos para liberar" value={readyToRelease.length} color="green" />
        <StatCard label="Total registrados" value={data?.total ?? 0} color="gray" />
        <StatCard
          label="Liberados/descartados"
          value={records.filter((r) => ["liberado","descartado","transferido"].includes(r.state)).length}
          color="gray"
        />
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Nuevo registro de residuo</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Etiqueta contenedor *" error={errors.container_label?.message}>
                <input {...register("container_label")} placeholder="ej. BIDON-2024-001" className={inputCls(!!errors.container_label)} />
              </Field>
              <Field label="Radionuclido *" error={errors.radionuclide?.message}>
                <select {...register("radionuclide")} className={inputCls(!!errors.radionuclide)}>
                  <option value="">Seleccionar...</option>
                  {RADIONUCLIDES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Categoria de residuo *" error={errors.waste_category?.message}>
                <select {...register("waste_category")} className={inputCls(!!errors.waste_category)}>
                  <option value="">Seleccionar...</option>
                  {WASTE_CATEGORIES.map((c) => <option key={c} value={c}>{WASTE_CATEGORY_LABELS[c]}</option>)}
                </select>
              </Field>
              {/* Mode toggle */}
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">Modo entrada:</span>
                <button type="button" onClick={() => setInputMode("mbq")}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${inputMode === "mbq" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  MBq directo
                </button>
                <button type="button" onClick={() => setInputMode("cps")}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${inputMode === "cps" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  Cuentas/segundo
                </button>
              </div>
              {inputMode === "mbq" ? (
                <Field label="Actividad inicial (MBq) *" error={errors.initial_activity_mbq?.message}>
                  <input type="number" step="0.001" min="0" {...register("initial_activity_mbq")} className={inputCls(!!errors.initial_activity_mbq)} />
                </Field>
              ) : (
                <>
                  <Field label="Cuentas por segundo (cps) *" error={errors.cps_value?.message}>
                    <input type="number" step="0.1" min="0" {...register("cps_value")} className={inputCls(!!errors.cps_value)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Eficiencia detector (%) — default ${cpsEffDefault}%`} error={errors.cps_efficiency_pct?.message}>
                      <input type="number" step="0.1" min="0.1" max="100" placeholder={String(cpsEffDefault)} {...register("cps_efficiency_pct")} className={inputCls(!!errors.cps_efficiency_pct)} />
                    </Field>
                    <Field label="Area medicion (cm²)" error={errors.measurement_area_cm2?.message}>
                      <input type="number" step="1" min="1" placeholder="100" {...register("measurement_area_cm2")} className={inputCls(!!errors.measurement_area_cm2)} />
                    </Field>
                  </div>
                  {cpsPreviewMbq !== null && (
                    <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      <span className="font-semibold">Conversión: </span>
                      {Number(_wCps).toFixed(1)} cps → <strong>{cpsPreviewMbq.toExponential(3)} MBq</strong>
                      {cpsPreviewBqCm2 !== null && (
                        <> • <strong>{cpsPreviewBqCm2.toFixed(2)} Bq/cm²</strong> ({Number(_wArea || 100)} cm²)</>
                      )}
                    </div>
                  )}
                </>
              )}
              <Field label="Fecha/hora almacenamiento *" error={errors.initial_activity_date?.message}>
                <input type="datetime-local" {...register("initial_activity_date")} className={inputCls(!!errors.initial_activity_date)} />
              </Field>
              <Field label="N contenedores" error={errors.container_count?.message}>
                <input type="number" min="1" {...register("container_count")} className={inputCls(!!errors.container_count)} />
              </Field>
              <Field label="Masa o volumen (kg/L)" error={errors.mass_or_volume_kg?.message}>
                <input type="number" step="0.01" min="0" {...register("mass_or_volume_kg")} className={inputCls(!!errors.mass_or_volume_kg)} />
              </Field>
              <Field label="Area de origen *" error={errors.origin_area?.message}>
                <input list="origin-area-list" {...register("origin_area")} className={inputCls(!!errors.origin_area)} />
                <datalist id="origin-area-list">
                  {ORIGIN_AREA_OPTIONS.map((o) => <option key={o} value={o} />)}
                </datalist>
              </Field>
              <Field label="Generado por *" error={errors.generated_by?.message}>
                <input {...register("generated_by")} className={inputCls(!!errors.generated_by)} />
              </Field>
              <Field label="RUT paciente (opcional)" error={errors.associated_patient_id?.message}>
                <input {...register("associated_patient_id")} placeholder="12.345.678-9" className={inputCls(!!errors.associated_patient_id)} />
              </Field>
              <Field label="Ruta de disposicion" error={errors.disposal_route?.message}>
                <select {...register("disposal_route")} className={inputCls(!!errors.disposal_route)}>
                  <option value="">Seleccionar (opcional)...</option>
                  {DISPOSAL_ROUTES.map((r) => <option key={r} value={r}>{DISPOSAL_ROUTE_LABELS[r]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notas adicionales" error={errors.notes?.message}>
              <textarea {...register("notes")} rows={2} className={inputCls(!!errors.notes) + " resize-none"} placeholder="Observaciones, codigo de lote, etc." />
            </Field>
            {createMutation.isError && <p className="text-sm text-red-600">{String(createMutation.error)}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { reset(); setShowForm(false); }} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={isSubmitting || createMutation.isPending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50">
                {createMutation.isPending ? "Guardando..." : "Registrar residuo"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(WASTE_STATE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterRadionuclide} onChange={(e) => setFilterRadionuclide(e.target.value)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
          <option value="">Todos los radionuclidos</option>
          {RADIONUCLIDES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando registros...</p>}
      {error && <p className="text-sm text-red-600">Error: {String(error)}</p>}
      {!isLoading && records.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay registros de residuos. Usa el boton "+ Nuevo registro" para comenzar.
        </div>
      )}
      {records.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Contenedor</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Radionuclido</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Categoria</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Act. inicial (MBq)</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Act. actual (MBq)</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Bq/cm² (100cm²)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Semaforo</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Area</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r) => <WasteRow key={r.id} record={r} onRelease={() => setReleaseModal(r)} />)}
            </tbody>
          </table>
        </div>
      )}

      {releaseModal && (
        <ReleaseModal
          record={releaseModal}
          onClose={() => setReleaseModal(null)}
          onConfirm={(payload) => releaseMutation.mutate({ id: releaseModal.id, ...payload })}
          isPending={releaseMutation.isPending}
        />
      )}
    </div>
  );
}

function WasteRow({ record, onRelease }: { record: WasteRecordEnriched; onRelease: () => void }) {
  const d = record.derived;
  const isActive = ["en_almacenamiento", "en_decaimiento"].includes(record.state);
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 font-mono text-xs">{record.container_label}</td>
      <td className="px-3 py-2 font-medium">{record.radionuclide}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{WASTE_CATEGORY_LABELS[record.waste_category]}</td>
      <td className="px-3 py-2 text-right">{record.initial_activity_mbq.toFixed(2)}</td>
      <td className="px-3 py-2 text-right font-medium">{isActive ? d.current_activity_mbq.toFixed(3) : "---"}</td>
      <td className="px-3 py-2 text-right text-xs text-muted-foreground">{mbqToBqPerCm2(isActive ? d.current_activity_mbq : record.initial_activity_mbq, 100).toFixed(1)}</td>
      <td className="px-3 py-2">
        {isActive ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${SEMAPHORE_COLORS[d.semaphore]}`}>
            <span className={`h-2 w-2 rounded-full ${SEMAPHORE_DOT[d.semaphore]}`} />
            {d.semaphore_label}
          </span>
        ) : <span className="text-xs text-muted-foreground">---</span>}
      </td>
      <td className="px-3 py-2 text-xs">{WASTE_STATE_LABELS[record.state]}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{record.origin_area}</td>
      <td className="px-3 py-2">
        {isActive && (
          <button onClick={onRelease} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${d.can_release ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {d.can_release ? "Liberar" : "Ver / gestionar"}
          </button>
        )}
      </td>
    </tr>
  );
}

function ReleaseModal({ record, onClose, onConfirm, isPending }: {
  record: WasteRecordEnriched; onClose: () => void;
  onConfirm: (p: { state: string; disposal_route?: string; released_by?: string; release_notes?: string }) => void;
  isPending: boolean;
}) {
  const [state, setState] = useState(record.derived.can_release ? "liberado" : "en_decaimiento");
  const [disposal_route, setDisposalRoute] = useState(record.disposal_route ?? "");
  const [released_by, setReleasedBy] = useState("");
  const [release_notes, setReleaseNotes] = useState("");
  const d = record.derived;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-semibold">Gestionar residuo: {record.container_label}</h3>
          <p className="text-xs text-muted-foreground">{record.radionuclide} · {WASTE_CATEGORY_LABELS[record.waste_category]}</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className={`rounded-md border p-3 text-sm ${SEMAPHORE_COLORS[d.semaphore]}`}>
            <p className="font-medium">{d.semaphore_label}</p>
            <p className="mt-1 text-xs">Actividad actual: <strong>{d.current_activity_mbq.toFixed(3)} MBq</strong> ({d.activity_pct_initial.toFixed(1)}% de la inicial)</p>
            {!d.can_release && <p className="mt-0.5 text-xs">Liberacion estimada: {new Date(d.retention_deadline).toLocaleString("es-CL")}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Nuevo estado</label>
            <select value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm">
              <option value="en_decaimiento">En decaimiento activo</option>
              {d.can_release && <option value="liberado">Liberar como residuo convencional</option>}
              <option value="transferido">Transferir a CCHEN / proveedor</option>
              <option value="descartado">Descartar (confirmado)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Ruta de disposicion</label>
            <select value={disposal_route} onChange={(e) => setDisposalRoute(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm">
              <option value="">Seleccionar...</option>
              {DISPOSAL_ROUTES.map((r) => <option key={r} value={r}>{DISPOSAL_ROUTE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Responsable *</label>
            <input value={released_by} onChange={(e) => setReleasedBy(e.target.value)} placeholder="Nombre completo" className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Notas de liberacion</label>
            <textarea value={release_notes} onChange={(e) => setReleaseNotes(e.target.value)} rows={2} className="w-full resize-none rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="Numero de acta, codigo de transferencia, etc." />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
          <button disabled={isPending || !released_by} onClick={() => onConfirm({ state, disposal_route: disposal_route || undefined, released_by, release_notes })} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50">
            {isPending ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full rounded-md border bg-background px-3 py-1.5 text-sm transition-colors ${hasError ? "border-red-400 focus:ring-red-400" : "border-border focus:border-accent"} focus:outline-none focus:ring-1`;
}

function StatCard({ label, value, color }: { label: string; value: number; color: "blue" | "green" | "yellow" | "red" | "gray" }) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
    gray: "bg-muted border-border text-foreground",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}


export function WasteRecordsApp() {
  return (
    <QueryClientProvider client={_wastequeryClient}>
      <WasteRecordsAppInner />
    </QueryClientProvider>
  );
}
