"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { RESPONSABLE_OPR_FIJO, type RoomReleaseRecord } from "@/lib/waste";

type Radionuclide = { code: string; name: string; active: boolean };

type FormState = {
  release_date: string;
  admission_date: string;
  service: string;
  sala: string;
  room_number: string;
  paciente_nombre: string;
  paciente_run: string;
  ficha_clinica: string;
  radionuclide_code: string;
  actividad_administrada: string;
  actividad_medida_liberacion: string;
  unidad_actividad: string;
  tasa_dosis_medida: string;
  criterio_liberacion: string;
  observaciones: string;
};

const EMPTY: FormState = {
  release_date: new Date().toISOString().slice(0, 10),
  admission_date: "",
  service: "",
  sala: "",
  room_number: "",
  paciente_nombre: "",
  paciente_run: "",
  ficha_clinica: "",
  radionuclide_code: "I-131",
  actividad_administrada: "",
  actividad_medida_liberacion: "",
  unidad_actividad: "mCi",
  tasa_dosis_medida: "",
  criterio_liberacion: "",
  observaciones: "",
};

const FIELD_LABEL = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
const INPUT_CLASS =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export function RoomReleaseFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (record: RoomReleaseRecord) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [radionuclides, setRadionuclides] = useState<Radionuclide[]>([]);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
      fetch("/api/radionuclides?active=true")
        .then((res) => (res.ok ? res.json() : { rows: [] }))
        .then((data) => setRadionuclides(data.rows ?? []))
        .catch(() => setRadionuclides([]));
    }
  }, [open]);

  if (!open) return null;

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setError(null);
    if (!form.release_date || !form.service.trim() || !form.sala.trim() || !form.paciente_nombre.trim()) {
      setError("Fecha, servicio, sala y paciente son obligatorios.");
      return;
    }
    setSaving(true);
    const payload = {
      release_date: form.release_date,
      admission_date: form.admission_date || null,
      service: form.service.trim(),
      sala: form.sala.trim(),
      room_number: form.room_number || null,
      paciente_nombre: form.paciente_nombre.trim(),
      paciente_run: form.paciente_run || null,
      ficha_clinica: form.ficha_clinica || null,
      radionuclide_code: form.radionuclide_code,
      actividad_administrada: form.actividad_administrada ? Number(form.actividad_administrada) : null,
      actividad_medida_liberacion: form.actividad_medida_liberacion ? Number(form.actividad_medida_liberacion) : null,
      unidad_actividad: form.unidad_actividad || "mCi",
      tasa_dosis_medida: form.tasa_dosis_medida || null,
      criterio_liberacion: form.criterio_liberacion || null,
      responsable_opr: RESPONSABLE_OPR_FIJO,
      observaciones: form.observaciones || null,
      status: "liberado",
    };
    try {
      const res = await fetch("/api/room-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el Acta de Liberación de Sala.");
        setSaving(false);
        return;
      }
      setSaving(false);
      onSaved(data.row as RoomReleaseRecord);
    } catch {
      setError("Error de red al guardar el Acta.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nueva Acta de Liberación de Sala</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={FIELD_LABEL}>Fecha de liberación de sala *</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={form.release_date}
              onChange={(e) => set("release_date", e.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Fecha de hospitalización</label>
            <input
              type="date"
              className={INPUT_CLASS}
              value={form.admission_date}
              onChange={(e) => set("admission_date", e.target.value)}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>Servicio *</label>
            <input className={INPUT_CLASS} value={form.service} onChange={(e) => set("service", e.target.value)} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Sala *</label>
            <input className={INPUT_CLASS} value={form.sala} onChange={(e) => set("sala", e.target.value)} />
          </div>
          <div>
            <label className={FIELD_LABEL}>N° de habitación</label>
            <input
              className={INPUT_CLASS}
              value={form.room_number}
              onChange={(e) => set("room_number", e.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Radionúclido</label>
            <select
              className={INPUT_CLASS}
              value={form.radionuclide_code}
              onChange={(e) => set("radionuclide_code", e.target.value)}
            >
              {radionuclides.length === 0 && <option value="I-131">I-131</option>}
              {radionuclides.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className={FIELD_LABEL}>Paciente *</label>
            <input
              className={INPUT_CLASS}
              value={form.paciente_nombre}
              onChange={(e) => set("paciente_nombre", e.target.value)}
              placeholder="Nombre completo del paciente"
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>RUN</label>
            <input
              className={INPUT_CLASS}
              value={form.paciente_run}
              onChange={(e) => set("paciente_run", e.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Ficha clínica</label>
            <input
              className={INPUT_CLASS}
              value={form.ficha_clinica}
              onChange={(e) => set("ficha_clinica", e.target.value)}
            />
          </div>

          <div>
            <label className={FIELD_LABEL}>Actividad administrada (mCi)</label>
            <input
              type="number"
              step="0.01"
              className={INPUT_CLASS}
              value={form.actividad_administrada}
              onChange={(e) => set("actividad_administrada", e.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Actividad medida al liberar (mCi)</label>
            <input
              type="number"
              step="0.01"
              className={INPUT_CLASS}
              value={form.actividad_medida_liberacion}
              onChange={(e) => set("actividad_medida_liberacion", e.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Tasa de dosis medida</label>
            <input
              className={INPUT_CLASS}
              value={form.tasa_dosis_medida}
              onChange={(e) => set("tasa_dosis_medida", e.target.value)}
              placeholder="ej. 25 uSv/h a 1 m"
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Criterio de liberación aplicado</label>
            <input
              className={INPUT_CLASS}
              value={form.criterio_liberacion}
              onChange={(e) => set("criterio_liberacion", e.target.value)}
            />
          </div>

          <div className="col-span-2">
            <label className={FIELD_LABEL}>Observaciones</label>
            <textarea
              className={INPUT_CLASS}
              rows={2}
              value={form.observaciones}
              onChange={(e) => set("observaciones", e.target.value)}
            />
          </div>

          <div className="col-span-2 text-[11px] text-muted-foreground">
            Responsable: <span className="font-medium text-foreground">{RESPONSABLE_OPR_FIJO}</span> (fijo, no
            editable)
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Cancelar
          </button>
          <button
            disabled={saving}
            onClick={submit}
            className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Acta"}
          </button>
        </div>
      </div>
    </div>
  );
}
