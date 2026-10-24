"use client";

import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import {
  PetctExam,
  PetctQc,
  calcPetctDerived,
  PETCT_RADIONUCLIDES,
  PETCT_RADIOPHARMACEUTICALS,
  PETCT_EXAM_STATES,
  PETCT_EXAM_STATE_LABELS,
} from "@/lib/petct";

// ─── Schemas ────────────────────────────────────────────────────────────────

const examSchema = z.object({
  patient_id: z.string().min(1, "RUT requerido"),
  patient_name: z.string().optional(),
  radiopharmaceutical: z.string().min(1, "Radiofármaco requerido"),
  radionuclide: z.string().min(1, "Radionucleido requerido"),
  administered_mbq: z.coerce.number().positive("MBq debe ser positivo"),
  patient_weight_kg: z.coerce.number().positive().optional(),
  injection_datetime: z.string().min(1, "Fecha/hora de inyección requerida"),
  uptake_minutes: z.coerce.number().int().min(1).default(60),
  operator: z.string().min(1, "Operador requerido"),
  prescribing_physician: z.string().min(1, "Médico prescriptor requerido"),
  notes: z.string().optional(),
});

const qcSchema = z.object({
  qc_date: z.string().min(1, "Fecha requerida"),
  phantom_type: z.string().default("Ge-68/Ga-68"),
  uniformity_pass: z.boolean(),
  count_rate_mcps: z.coerce.number().optional(),
  image_quality_pass: z.boolean(),
  comments: z.string().optional(),
  performed_by: z.string().min(1, "Operador requerido"),
});

type ExamForm = z.infer<typeof examSchema>;
type QcForm = z.infer<typeof qcSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stateColor(state: string) {
  const map: Record<string, string> = {
    programado: "bg-yellow-100 text-yellow-800",
    en_espera: "bg-indigo-100 text-indigo-800",
    en_examen: "bg-teal-100 text-teal-800",
    completado: "bg-green-100 text-green-800",
    cancelado: "bg-red-100 text-red-800",
  };
  return map[state] ?? "bg-muted text-foreground";
}

function fmt(val: number | null | undefined, dec = 1): string {
  if (val == null) return "—";
  return val.toFixed(dec);
}

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

// ─── Empty form defaults ──────────────────────────────────────────────────────

function emptyExam(): ExamForm {
  const now = new Date();
  now.setSeconds(0, 0);
  return {
    patient_id: "",
    patient_name: "",
    radiopharmaceutical: "",
    radionuclide: "",
    administered_mbq: 370,
    patient_weight_kg: undefined,
    injection_datetime: now.toISOString().slice(0, 16),
    uptake_minutes: 60,
    operator: "",
    prescribing_physician: "",
    notes: "",
  };
}

function emptyQc(): QcForm {
  return {
    qc_date: new Date().toISOString().slice(0, 10),
    phantom_type: "Ge-68/Ga-68",
    uniformity_pass: true,
    count_rate_mcps: undefined,
    image_quality_pass: true,
    comments: "",
    performed_by: "",
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PetctApp() {
  const [tab, setTab] = useState<"exams" | "new-exam" | "qc" | "new-qc">("exams");
  const [filterState, setFilterState] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [examForm, setExamForm] = useState<ExamForm>(emptyExam);
  const [qcForm, setQcForm] = useState<QcForm>(emptyQc);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Exams state
  const [exams, setExams] = useState<PetctExam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [examSaving, setExamSaving] = useState(false);
  const [examSaveError, setExamSaveError] = useState<string | null>(null);

  // QC state
  const [qcList, setQcList] = useState<PetctQc[]>([]);
  const [qcLoading, setQcLoading] = useState(false);
  const [qcError, setQcError] = useState<string | null>(null);
  const [qcSaving, setQcSaving] = useState(false);
  const [qcSaveError, setQcSaveError] = useState<string | null>(null);

  const loadExams = useCallback(async () => {
    setExamsLoading(true);
    setExamsError(null);
    try {
      const params = new URLSearchParams({ type: "exams", limit: "100" });
      if (filterState) params.set("state", filterState);
      if (filterDate) params.set("date", filterDate);
      const res = await fetch(`/api/petct?${params}`);
      if (!res.ok) throw new Error("Error al cargar exámenes PET/CT");
      const json = await res.json();
      setExams(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setExamsError(err instanceof Error ? err.message : "Error al cargar exámenes");
      setExams([]);
    } finally {
      setExamsLoading(false);
    }
  }, [filterState, filterDate]);

  const loadQc = useCallback(async () => {
    setQcLoading(true);
    setQcError(null);
    try {
      const res = await fetch("/api/petct?type=qc&limit=30");
      if (!res.ok) throw new Error("Error al cargar QC");
      const json = await res.json();
      setQcList(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setQcError(err instanceof Error ? err.message : "Error al cargar QC");
      setQcList([]);
    } finally {
      setQcLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "exams") loadExams();
  }, [tab, loadExams]);

  useEffect(() => {
    if (tab === "qc") loadQc();
  }, [tab, loadQc]);

  async function handleExamSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = examSchema.safeParse(examForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach(err => { if (err.path[0]) errs[String(err.path[0])] = err.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setExamSaving(true);
    setExamSaveError(null);
    try {
      const res = await fetch("/api/petct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, type: "exam" }),
      });
      if (!res.ok) throw new Error("Error al crear examen");
      setTab("exams");
      setExamForm(emptyExam());
      await loadExams();
    } catch (err) {
      setExamSaveError(err instanceof Error ? err.message : "Error al guardar el examen");
    } finally {
      setExamSaving(false);
    }
  }

  async function handleQcSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = qcSchema.safeParse(qcForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach(err => { if (err.path[0]) errs[String(err.path[0])] = err.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setQcSaving(true);
    setQcSaveError(null);
    try {
      const res = await fetch("/api/petct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, type: "qc" }),
      });
      if (!res.ok) throw new Error("Error al guardar QC");
      setTab("qc");
      setQcForm(emptyQc());
      await loadQc();
    } catch (err) {
      setQcSaveError(err instanceof Error ? err.message : "Error al guardar el QC");
    } finally {
      setQcSaving(false);
    }
  }

  async function handlePatchExam(id: string | number, updates: Partial<PetctExam>) {
    try {
      const res = await fetch("/api/petct", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error("Error al actualizar examen");
      await loadExams();
    } catch {
      // Silent fail for state patch — user can retry
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">PET/CT — Gestión de Exámenes</h1>
          <p className="text-xs text-muted-foreground mt-1">Registro, dosimetría y control de calidad PET/CT</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/petct/export/pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            title="Descargar informe PDF de exámenes PET/CT"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Informe PDF
          </a>
          <button onClick={() => setTab("new-exam")} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90">+ Nuevo Examen</button>
          <button onClick={() => setTab("new-qc")} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">+ QC Diario</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {(["exams", "qc"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "exams" ? "Exámenes" : "Control de Calidad"}
            </button>
          ))}
        </nav>
      </div>

      {/* ── EXAM LIST ── */}
      {tab === "exams" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 items-center">
            <select value={filterState} onChange={e => setFilterState(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">Todos los estados</option>
              {PETCT_EXAM_STATES.map(s => <option key={s} value={s}>{PETCT_EXAM_STATE_LABELS[s]}</option>)}
            </select>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm" />
            {(filterState || filterDate) && <button onClick={() => { setFilterState(""); setFilterDate(""); }} className="text-sm text-muted-foreground hover:text-foreground">Limpiar</button>}
          </div>

          {examsLoading && <p className="text-muted-foreground text-sm">Cargando...</p>}
          {examsError && <p className="text-red-600 text-sm">{examsError}</p>}

          {!examsLoading && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {["Paciente", "Radiofármaco", "MBq administrados", "Inyección", "Captación (min)", "Tasa dosis 1m (µSv/h)", "Estado", "Acciones"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                  {exams.map(exam => {
                    const d = calcPetctDerived(exam);
                    return (
                      <tr key={String(exam.id)} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{exam.patient_id}</div>
                          {exam.patient_name && <div className="text-muted-foreground text-xs">{exam.patient_name}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div>{exam.radiopharmaceutical}</div>
                          <div className="text-muted-foreground text-xs">{exam.radionuclide}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">{fmt(exam.administered_mbq, 0)} MBq</td>
                        <td className="px-4 py-3">{fmtDate(exam.injection_datetime)}</td>
                        <td className="px-4 py-3 font-mono">{exam.uptake_minutes}</td>
                        <td className="px-4 py-3 font-mono text-orange-700">{fmt(d.dose_rate_1m_usvh, 2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${stateColor(String(exam.state))}`}>
                            {PETCT_EXAM_STATE_LABELS[exam.state as keyof typeof PETCT_EXAM_STATE_LABELS] ?? String(exam.state)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={String(exam.state)}
                            onChange={e => handlePatchExam(exam.id as string | number, { state: e.target.value as PetctExam["state"] })}
                            className="border border-border rounded px-2 py-1 text-xs"
                          >
                            {PETCT_EXAM_STATES.map(s => <option key={s} value={s}>{PETCT_EXAM_STATE_LABELS[s]}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                  {exams.length === 0 && !examsLoading && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No hay exámenes registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── QC LIST ── */}
      {tab === "qc" && (
        <div>
          {qcLoading && <p className="text-muted-foreground text-sm">Cargando...</p>}
          {qcError && <p className="text-red-600 text-sm">{qcError}</p>}
          {!qcLoading && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {["Fecha", "Phantom", "Uniformidad", "Count Rate (Mcps)", "Calidad imagen", "Operador", "Comentarios"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                  {qcList.map(qcRow => (
                    <tr key={String(qcRow.id)} className="hover:bg-muted/30">
                      <td className="px-4 py-3">{qcRow.qc_date}</td>
                      <td className="px-4 py-3">{qcRow.phantom_type}</td>
                      <td className="px-4 py-3"><span className={qcRow.uniformity_pass ? "text-green-700" : "text-red-700"}>{qcRow.uniformity_pass ? "✓ OK" : "✗ FALLA"}</span></td>
                      <td className="px-4 py-3 font-mono">{qcRow.count_rate_mcps != null ? Number(qcRow.count_rate_mcps).toFixed(2) : "—"}</td>
                      <td className="px-4 py-3"><span className={qcRow.image_quality_pass ? "text-green-700" : "text-red-700"}>{qcRow.image_quality_pass ? "✓ OK" : "✗ FALLA"}</span></td>
                      <td className="px-4 py-3">{qcRow.performed_by}</td>
                      <td className="px-4 py-3 text-muted-foreground">{qcRow.comments ?? "—"}</td>
                    </tr>
                  ))}
                  {qcList.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin registros de QC</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── NEW EXAM FORM ── */}
      {tab === "new-exam" && (
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Registrar Nuevo Examen PET/CT</h2>
          <form onSubmit={handleExamSubmit} className="space-y-4">
            {/* Row 1 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">RUT Paciente *</label>
                <input type="text" value={examForm.patient_id} onChange={e => setExamForm(f => ({ ...f, patient_id: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" placeholder="12.345.678-9" />
                {errors.patient_id && <p className="text-red-600 text-xs mt-1">{errors.patient_id}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium">Nombre Paciente</label>
                <input type="text" value={examForm.patient_name ?? ""} onChange={e => setExamForm(f => ({ ...f, patient_name: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Radiofármaco *</label>
                <select value={examForm.radiopharmaceutical} onChange={e => setExamForm(f => ({ ...f, radiopharmaceutical: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm">
                  <option value="">Seleccionar radiofármaco</option>
                  {(PETCT_RADIOPHARMACEUTICALS as readonly string[]).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {errors.radiopharmaceutical && <p className="text-red-600 text-xs mt-1">{errors.radiopharmaceutical}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium">Radionucleido *</label>
                <select value={examForm.radionuclide} onChange={e => setExamForm(f => ({ ...f, radionuclide: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm">
                  <option value="">Seleccionar radionucleido</option>
                  {(PETCT_RADIONUCLIDES as readonly string[]).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.radionuclide && <p className="text-red-600 text-xs mt-1">{errors.radionuclide}</p>}
              </div>
            </div>
            {/* Row 3 */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">Actividad (MBq) *</label>
                <input type="number" step="0.1" value={examForm.administered_mbq} onChange={e => setExamForm(f => ({ ...f, administered_mbq: Number(e.target.value) }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                {errors.administered_mbq && <p className="text-red-600 text-xs mt-1">{errors.administered_mbq}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium">Peso (kg)</label>
                <input type="number" step="0.1" value={examForm.patient_weight_kg ?? ""} onChange={e => setExamForm(f => ({ ...f, patient_weight_kg: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium">Captación (min) *</label>
                <input type="number" value={examForm.uptake_minutes} onChange={e => setExamForm(f => ({ ...f, uptake_minutes: Number(e.target.value) }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            {/* Row 4 */}
            <div>
              <label className="block text-sm font-medium">Fecha/Hora Inyección *</label>
              <input type="datetime-local" value={examForm.injection_datetime} onChange={e => setExamForm(f => ({ ...f, injection_datetime: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              {errors.injection_datetime && <p className="text-red-600 text-xs mt-1">{errors.injection_datetime}</p>}
            </div>
            {/* Row 5 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Operador *</label>
                <input type="text" value={examForm.operator} onChange={e => setExamForm(f => ({ ...f, operator: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                {errors.operator && <p className="text-red-600 text-xs mt-1">{errors.operator}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium">Médico Prescriptor *</label>
                <input type="text" value={examForm.prescribing_physician} onChange={e => setExamForm(f => ({ ...f, prescribing_physician: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
                {errors.prescribing_physician && <p className="text-red-600 text-xs mt-1">{errors.prescribing_physician}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Notas</label>
              <textarea value={examForm.notes ?? ""} onChange={e => setExamForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={examSaving} className="px-6 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
                {examSaving ? "Guardando..." : "Registrar Examen"}
              </button>
              <button type="button" onClick={() => setTab("exams")} className="px-6 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancelar</button>
            </div>
            {examSaveError && <p className="text-red-600 text-sm">{examSaveError}</p>}
          </form>
        </div>
      )}

      {/* ── NEW QC FORM ── */}
      {tab === "new-qc" && (
        <div className="max-w-lg">
          <h2 className="text-lg font-semibold mb-4">Registro QC Diario PET/CT</h2>
          <form onSubmit={handleQcSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Fecha *</label>
                <input type="date" value={qcForm.qc_date} onChange={e => setQcForm(f => ({ ...f, qc_date: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium">Phantom</label>
                <input type="text" value={qcForm.phantom_type} onChange={e => setQcForm(f => ({ ...f, phantom_type: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 mt-4">
                <input type="checkbox" id="uniformity" checked={qcForm.uniformity_pass} onChange={e => setQcForm(f => ({ ...f, uniformity_pass: e.target.checked }))} className="h-4 w-4 rounded border-border" />
                <label htmlFor="uniformity" className="text-sm font-medium">Uniformidad OK</label>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <input type="checkbox" id="image_quality" checked={qcForm.image_quality_pass} onChange={e => setQcForm(f => ({ ...f, image_quality_pass: e.target.checked }))} className="h-4 w-4 rounded border-border" />
                <label htmlFor="image_quality" className="text-sm font-medium">Calidad imagen OK</label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Count Rate (Mcps)</label>
              <input type="number" step="0.01" value={qcForm.count_rate_mcps ?? ""} onChange={e => setQcForm(f => ({ ...f, count_rate_mcps: e.target.value ? Number(e.target.value) : undefined }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium">Operador *</label>
              <input type="text" value={qcForm.performed_by} onChange={e => setQcForm(f => ({ ...f, performed_by: e.target.value }))} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
              {errors.performed_by && <p className="text-red-600 text-xs mt-1">{errors.performed_by}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium">Comentarios</label>
              <textarea value={qcForm.comments ?? ""} onChange={e => setQcForm(f => ({ ...f, comments: e.target.value }))} rows={2} className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={qcSaving} className="px-6 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
                {qcSaving ? "Guardando..." : "Guardar QC"}
              </button>
              <button type="button" onClick={() => setTab("qc")} className="px-6 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancelar</button>
            </div>
            {qcSaveError && <p className="text-red-600 text-sm">{qcSaveError}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
