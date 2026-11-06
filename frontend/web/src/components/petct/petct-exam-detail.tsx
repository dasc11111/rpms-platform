"use client";

// Fase 23B — Ficha individual de examen PET/CT
// Dosimetría en vivo, cronología de workflow, criterios de alta.
// Referencias: DS 133/1984 MINSAL, IAEA HHS No. 1, IAEA SRS-58.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  PetctExam,
  PetctExamState,
  PETCT_EXAM_STATES,
  PETCT_EXAM_STATE_LABELS,
  calcPetctDerived,
  DOSE_RELEASE_THRESHOLD_USVH,
  HALF_LIFE_MINUTES,
} from "@/lib/petct";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function fmtMins(mins: number): string {
  if (!isFinite(mins) || mins <= 0) return "0 min";
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function fmt(val: number | null | undefined, dec = 1): string {
  if (val == null) return "—";
  return val.toFixed(dec);
}

function stateColor(state: string): string {
  const map: Record<string, string> = {
    programado: "bg-yellow-100 text-yellow-800 border-yellow-200",
    en_espera: "bg-indigo-100 text-indigo-800 border-indigo-200",
    en_examen: "bg-teal-100 text-teal-800 border-teal-200",
    completado: "bg-green-100 text-green-800 border-green-200",
    cancelado: "bg-red-100 text-red-800 border-red-200",
  };
  return map[state] ?? "bg-muted text-foreground border-border";
}

// ─── DosimetryPanel ───────────────────────────────────────────────────────────

function DosimetryPanel({ exam }: { exam: PetctExam }) {
  const [derived, setDerived] = useState(() => calcPetctDerived(exam));

  useEffect(() => {
    const timer = setInterval(() => setDerived(calcPetctDerived(exam)), 15_000);
    return () => clearInterval(timer);
  }, [exam]);

  const halfLifeMin = HALF_LIFE_MINUTES[exam.radionuclide] ?? 110;
  const actPct = Math.min(100, (derived.current_activity_mbq / exam.administered_mbq) * 100);
  const doseOk = derived.dose_rate_1m_usvh <= DOSE_RELEASE_THRESHOLD_USVH;
  const releaseDate = new Date(derived.release_datetime);
  const releasePast = derived.minutes_to_release <= 0;

  return (
    <div className="space-y-3">
      {/* Activity + Dose Rate */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Actividad actual
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground font-mono">
            {fmt(derived.current_activity_mbq, 1)} <span className="text-sm font-normal">MBq</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {fmt(actPct, 0)}% de {fmt(exam.administered_mbq, 0)} MBq administrados
          </p>
          {/* Decay bar */}
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500"
              style={{ width: `${actPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            T½ ({exam.radionuclide}) = {halfLifeMin < 120 ? `${halfLifeMin.toFixed(1)} min` : `${(halfLifeMin / 60).toFixed(1)} h`}
          </p>
        </div>

        <div className={`rounded-lg border p-3 ${doseOk ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Tasa de dosis a 1 m
          </p>
          <p className={`mt-1 text-2xl font-bold font-mono ${doseOk ? "text-green-700" : "text-orange-700"}`}>
            {fmt(derived.dose_rate_1m_usvh, 2)} <span className="text-sm font-normal">µSv/h</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Umbral de alta: {DOSE_RELEASE_THRESHOLD_USVH} µSv/h
          </p>
          <p className={`mt-1 text-xs font-medium ${doseOk ? "text-green-700" : "text-orange-700"}`}>
            {doseOk ? "✓ Criterio de alta cumplido" : "⚠ Por encima del umbral de alta"}
          </p>
        </div>
      </div>

      {/* Uptake + Release */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg border p-3 ${derived.uptake_complete ? "border-green-200 bg-green-50" : "border-indigo-200 bg-indigo-50"}`}>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Captación ({exam.uptake_minutes} min)
          </p>
          {derived.uptake_complete ? (
            <p className="mt-1 text-sm font-semibold text-green-700">✓ Captación completada</p>
          ) : (
            <>
              <p className="mt-1 text-xl font-bold font-mono text-indigo-700">
                {fmtMins(derived.uptake_remaining_min)}
              </p>
              <p className="text-xs text-muted-foreground">restantes</p>
            </>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground">
            {fmtMins(derived.elapsed_minutes)} desde inyección
          </p>
        </div>

        <div className={`rounded-lg border p-3 ${releasePast ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Alta paciente estimada
          </p>
          {releasePast ? (
            <p className="mt-1 text-sm font-semibold text-green-700">✓ Criterio cumplido</p>
          ) : (
            <>
              <p className="mt-1 text-xl font-bold font-mono text-yellow-700">
                {fmtMins(derived.minutes_to_release)}
              </p>
              <p className="text-xs text-muted-foreground">hasta cumplir criterio</p>
            </>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground">
            {releasePast ? "Ya pasó el umbral de alta" : fmtDate(releaseDate.toISOString())}
          </p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Γ(β⁺) = 0,143 µSv·m²/(MBq·h) · IAEA SRS-58 Tabla 2 · Umbral alta 25 µSv/h (DS 133/1984)
        {" · "}Actualización cada 15 s
      </p>
    </div>
  );
}

// ─── WorkflowTimeline ─────────────────────────────────────────────────────────

function WorkflowTimeline({ exam }: { exam: PetctExam }) {
  const steps: { key: string; label: string; time: string | null; done: boolean }[] = [
    { key: "scheduled", label: "Programado", time: fmtDate(exam.created_at), done: true },
    { key: "injected", label: "Inyección", time: fmtDate(exam.injection_datetime), done: true },
    {
      key: "uptake",
      label: `Captación (${exam.uptake_minutes} min)`,
      time: exam.injection_datetime
        ? fmtDate(new Date(new Date(exam.injection_datetime).getTime() + exam.uptake_minutes * 60_000).toISOString())
        : null,
      done: calcPetctDerived(exam).uptake_complete,
    },
    { key: "exam_start", label: "Inicio examen", time: fmtDate(exam.exam_start), done: !!exam.exam_start },
    { key: "exam_end", label: "Fin examen", time: fmtDate(exam.exam_end), done: !!exam.exam_end },
    {
      key: "completed",
      label: "Alta paciente",
      time: exam.state === "completado" ? fmtDate(exam.updated_at) : null,
      done: exam.state === "completado",
    },
  ];

  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {steps.map((step) => (
        <li key={step.key} className="ml-4">
          <span
            className={`absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
              step.done
                ? "border-green-500 bg-green-500"
                : "border-border bg-surface"
            }`}
          >
            {step.done && (
              <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                <path d="M3.5 7.5L2 6l-1 1 2.5 2.5 6-6-1-1z" />
              </svg>
            )}
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
              {step.label}
            </span>
            {step.time && (
              <span className="text-xs text-muted-foreground">{step.time}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  exam: PetctExam;
}

export function PetctExamDetail({ exam: initialExam }: Props) {
  const [exam, setExam] = useState<PetctExam>(initialExam);
  const [patching, setPatching] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [notes, setNotes] = useState(exam.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll exam state every 30s when active
  const isActive = exam.state === "en_espera" || exam.state === "en_examen";
  useEffect(() => {
    if (!isActive) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/petct?id=${exam.id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) setExam(json.data as PetctExam);
        }
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(poll);
  }, [isActive, exam.id]);

  const patchExam = useCallback(async (updates: Partial<PetctExam>) => {
    setPatching(true);
    setPatchError(null);
    try {
      const res = await fetch("/api/petct", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: exam.id, ...updates }),
      });
      if (!res.ok) throw new Error("Error al actualizar examen");
      const json = await res.json();
      if (json.data) setExam(json.data as PetctExam);
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setPatching(false);
    }
  }, [exam.id]);

  function handleStateChange(newState: PetctExamState) {
    const updates: Partial<PetctExam> = { state: newState };
    const now = new Date().toISOString();
    if (newState === "en_examen" && !exam.exam_start) updates.exam_start = now;
    if ((newState === "completado" || newState === "cancelado") && !exam.exam_end) updates.exam_end = now;
    patchExam(updates);
  }

  function handleNotesChange(val: string) {
    setNotes(val);
    setNotesSaved(false);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      setSavingNotes(true);
      try {
        const res = await fetch("/api/petct", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: exam.id, notes: val }),
        });
        if (res.ok) setNotesSaved(true);
      } catch { /* silent */ } finally {
        setSavingNotes(false);
      }
    }, 1500);
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href="/petct" className="text-muted-foreground hover:text-foreground text-sm">
              ← PET/CT Exámenes
            </a>
          </div>
          <h1 className="text-lg font-semibold">
            Examen PET/CT — {exam.patient_name ?? exam.patient_id}
          </h1>
          <p className="text-xs text-muted-foreground">
            ID: {exam.patient_id} · {exam.radiopharmaceutical} · Inyección: {fmtDate(exam.injection_datetime)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${stateColor(exam.state)}`}>
            {PETCT_EXAM_STATE_LABELS[exam.state] ?? exam.state}
          </span>
          <a
            href={`/api/petct/export/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Informe PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Dosimetry + Workflow */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dosimetry */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold mb-3">Dosimetría en tiempo real</h2>
            <DosimetryPanel exam={exam} />
          </section>

          {/* State management */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold mb-3">Gestión de estado</h2>
            <div className="flex flex-wrap gap-2">
              {PETCT_EXAM_STATES.filter(s => s !== exam.state).map(s => (
                <button
                  key={s}
                  onClick={() => handleStateChange(s)}
                  disabled={patching}
                  className="px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  → {PETCT_EXAM_STATE_LABELS[s]}
                </button>
              ))}
            </div>
            {patchError && <p className="mt-2 text-sm text-red-600">{patchError}</p>}
            {patching && <p className="mt-2 text-sm text-muted-foreground">Guardando...</p>}
          </section>

          {/* Timestamps */}
          {(exam.exam_start || exam.exam_end) && (
            <section className="rounded-lg border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold mb-3">Tiempos de examen</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inicio examen</p>
                  <p className="mt-0.5 font-mono">{fmtDate(exam.exam_start)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Fin examen</p>
                  <p className="mt-0.5 font-mono">{fmtDate(exam.exam_end)}</p>
                </div>
              </div>
            </section>
          )}

          {/* Notes */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Observaciones clínicas</h2>
              <span className="text-xs text-muted-foreground">
                {savingNotes ? "Guardando..." : notesSaved ? "✓ Guardado" : ""}
              </span>
            </div>
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              rows={4}
              placeholder="Notas clínicas, incidencias durante el examen, instrucciones al paciente..."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </section>
        </div>

        {/* Right: Metadata + Timeline */}
        <div className="space-y-6">
          {/* Exam details */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold mb-3">Datos del examen</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Paciente</dt>
                <dd className="font-medium">{exam.patient_name ?? "—"}</dd>
                <dd className="text-xs text-muted-foreground font-mono">{exam.patient_id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Radiofármaco</dt>
                <dd>{exam.radiopharmaceutical}</dd>
                <dd className="text-xs text-muted-foreground">{exam.radionuclide}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Actividad administrada</dt>
                <dd className="font-mono">{fmt(exam.administered_mbq, 1)} MBq</dd>
                {exam.patient_weight_kg && (
                  <dd className="text-xs text-muted-foreground">
                    {fmt(exam.administered_mbq / exam.patient_weight_kg, 2)} MBq/kg
                    ({fmt(exam.patient_weight_kg, 1)} kg)
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Captación programada</dt>
                <dd>{exam.uptake_minutes} min</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Fecha/Hora inyección</dt>
                <dd className="font-mono text-xs">{fmtDate(exam.injection_datetime)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Operador</dt>
                <dd>{exam.operator}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground font-medium">Médico prescriptor</dt>
                <dd>{exam.prescribing_physician}</dd>
              </div>
            </dl>
          </section>

          {/* Workflow timeline */}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold mb-3">Cronología</h2>
            <WorkflowTimeline exam={exam} />
          </section>

          {/* Regulatory note */}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Criterio de alta: tasa de dosis ≤ {DOSE_RELEASE_THRESHOLD_USVH} µSv/h a 1 m (DS 133/1984 Art. 22-26, DS 3/1985 Art. 5, IAEA HHS No. 1). El OPR debe confirmar que este umbral coincide con la autorización CCHEN vigente del HHHA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
