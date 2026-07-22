"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { AutocompleteInput } from "./autocomplete-input";
import { MESES, daysInMonth, runValido, RESPONSABLE_FIJO, type I131Record } from "@/lib/i131";

type FormState = {
  admin_year: string;
  admin_month: string;
  admin_day: string;
  partida: string;
  pedido_numero: string;
  radiofarmaco: string;
  cantidad_solicitada: string;
  paciente_nombre: string;
  paciente_run: string;
  ficha_clinica: string;
  prevision: string;
  diagnostico: string;
  medico_solicitante: string;
  procedencia: string;
  tipo_examen: string;
  equipo: string;
  motivo: string;
  protocolo: string;
  tasa_dosis: string;
  dosis_administrada: string;
  notas: string;
};

const EMPTY: FormState = {
  admin_year: String(new Date().getFullYear()),
  admin_month: String(new Date().getMonth() + 1),
  admin_day: "",
  partida: "",
  pedido_numero: "",
  radiofarmaco: "I-131",
  cantidad_solicitada: "",
  paciente_nombre: "",
  paciente_run: "",
  ficha_clinica: "",
  prevision: "",
  diagnostico: "",
  medico_solicitante: "",
  procedencia: "",
  tipo_examen: "",
  equipo: "",
  motivo: "",
  protocolo: "",
  tasa_dosis: "",
  dosis_administrada: "",
  notas: "",
};

function recordToForm(r: I131Record): FormState {
  return {
    admin_year: String(r.admin_year),
    admin_month: String(r.admin_month),
    admin_day: String(r.admin_day),
    partida: r.partida ?? "",
    pedido_numero: r.pedido_numero ?? "",
    radiofarmaco: r.radiofarmaco ?? "I-131",
    cantidad_solicitada: r.cantidad_solicitada?.toString() ?? "",
    paciente_nombre: r.paciente_nombre ?? "",
    paciente_run: r.paciente_run ?? "",
    ficha_clinica: r.ficha_clinica ?? "",
    prevision: r.prevision ?? "",
    diagnostico: r.diagnostico ?? "",
    medico_solicitante: r.medico_solicitante ?? "",
    procedencia: r.procedencia ?? "",
    tipo_examen: r.tipo_examen ?? "",
    equipo: r.equipo ?? "",
    motivo: r.motivo ?? "",
    protocolo: r.protocolo ?? "",
    tasa_dosis: r.tasa_dosis ?? "",
    dosis_administrada: r.dosis_administrada?.toString() ?? "",
    notas: r.notas ?? "",
  };
}

const FIELD_LABEL = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
const INPUT_CLASS =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export function I131FormModal({
  open,
  onClose,
  record,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  record?: I131Record | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<unknown[] | null>(null);

  useEffect(() => {
    if (open) {
      setForm(record ? recordToForm(record) : EMPTY);
      setError(null);
      setDuplicateInfo(null);
    }
  }, [open, record]);

  if (!open) return null;

  const fechaLista = Boolean(form.admin_year && form.admin_month && form.admin_day);
  const maxDay = daysInMonth(Number(form.admin_year), Number(form.admin_month));

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(force = false) {
    setError(null);
    if (!form.admin_year || !form.admin_month || !form.admin_day) {
      setError("Debe indicar año, mes y día de administración.");
      return;
    }
    if (!form.paciente_nombre.trim()) {
      setError("El nombre del paciente es obligatorio.");
      return;
    }
    if (form.paciente_run && !runValido(form.paciente_run)) {
      setError("El RUN ingresado no es válido.");
      return;
    }

    setSaving(true);
    const payload = {
      admin_year: Number(form.admin_year),
      admin_month: Number(form.admin_month),
      admin_day: Number(form.admin_day),
      partida: form.partida || null,
      pedido_numero: form.pedido_numero || null,
      radiofarmaco: form.radiofarmaco || "I-131",
      cantidad_solicitada: form.cantidad_solicitada ? Number(form.cantidad_solicitada) : null,
      paciente_nombre: form.paciente_nombre.trim(),
      paciente_run: form.paciente_run || null,
      ficha_clinica: form.ficha_clinica || null,
      prevision: form.prevision || null,
      diagnostico: form.diagnostico || null,
      medico_solicitante: form.medico_solicitante || null,
      procedencia: form.procedencia || null,
      tipo_examen: form.tipo_examen || null,
      equipo: form.equipo || null,
      motivo: form.motivo || null,
      protocolo: form.protocolo || null,
      tasa_dosis: form.tasa_dosis || null,
      dosis_administrada: form.dosis_administrada ? Number(form.dosis_administrada) : null,
      notas: form.notas || null,
      force,
    };

    try {
      const url = record ? `/api/i131/${record.id}` : "/api/i131";
      const method = record ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = await res.json();
        setDuplicateInfo(data.existing ?? []);
        setSaving(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar el registro.");
        setSaving(false);
        return;
      }
      setSaving(false);
      onSaved();
      onClose();
    } catch {
      setError("Error de red al guardar el registro.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {record ? "Editar administración de I-131" : "Nueva administración de I-131"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        {duplicateInfo && (
          <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
            <p className="mb-2 flex items-center gap-2 font-medium text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Ya existe un registro para este paciente en esta fecha.
              ¿Desea guardarlo igualmente?
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-border px-2.5 py-1 hover:bg-muted"
                onClick={() => setDuplicateInfo(null)}
              >
                Cancelar
              </button>
              <button
                className="rounded-md bg-accent px-2.5 py-1 text-accent-foreground hover:opacity-90"
                onClick={() => {
                  setDuplicateInfo(null);
                  submit(true);
                }}
              >
                Guardar igualmente
              </button>
            </div>
          </div>
        )}

        {/* Paso 1: fecha de administracion, obligatoria y primero */}
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/30 p-3">
          <div>
            <label className={FIELD_LABEL}>Año *</label>
            <input
              type="number"
              className={INPUT_CLASS}
              value={form.admin_year}
              onChange={(e) => set("admin_year", e.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Mes *</label>
            <select
              className={INPUT_CLASS}
              value={form.admin_month}
              onChange={(e) => set("admin_month", e.target.value)}
            >
              <option value="">—</option>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL}>Día *</label>
            <select
              className={INPUT_CLASS}
              value={form.admin_day}
              onChange={(e) => set("admin_day", e.target.value)}
            >
              <option value="">—</option>
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!fechaLista ? (
          <p className="text-xs text-muted-foreground">
            Ingrese año, mes y día de administración para continuar con el resto del formulario.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={FIELD_LABEL}>Paciente *</label>
              <AutocompleteInput
                field="paciente_nombre"
                value={form.paciente_nombre}
                onChange={(v) => set("paciente_nombre", v)}
                placeholder="Nombre completo del paciente"
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>RUN</label>
              <input
                className={INPUT_CLASS}
                value={form.paciente_run}
                onChange={(e) => set("paciente_run", e.target.value)}
                placeholder="12.345.678-9"
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
              <label className={FIELD_LABEL}>Radiofármaco</label>
              <AutocompleteInput
                field="radiofarmaco"
                value={form.radiofarmaco}
                onChange={(v) => set("radiofarmaco", v)}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Cantidad solicitada (mCi)</label>
              <input
                type="number"
                step="0.01"
                className={INPUT_CLASS}
                value={form.cantidad_solicitada}
                onChange={(e) => set("cantidad_solicitada", e.target.value)}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Dosis administrada (mCi)</label>
              <input
                type="number"
                step="0.01"
                className={INPUT_CLASS}
                value={form.dosis_administrada}
                onChange={(e) => set("dosis_administrada", e.target.value)}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Tasa de dosis</label>
              <input
                className={INPUT_CLASS}
                value={form.tasa_dosis}
                onChange={(e) => set("tasa_dosis", e.target.value)}
                placeholder="ej. alta con 30 uSv/h"
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>Partida</label>
              <input className={INPUT_CLASS} value={form.partida} onChange={(e) => set("partida", e.target.value)} />
            </div>
            <div>
              <label className={FIELD_LABEL}>N° Pedido</label>
              <input
                className={INPUT_CLASS}
                value={form.pedido_numero}
                onChange={(e) => set("pedido_numero", e.target.value)}
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>Previsión</label>
              <AutocompleteInput field="prevision" value={form.prevision} onChange={(v) => set("prevision", v)} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Diagnóstico</label>
              <AutocompleteInput
                field="diagnostico"
                value={form.diagnostico}
                onChange={(v) => set("diagnostico", v)}
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>Médico solicitante</label>
              <AutocompleteInput
                field="medico_solicitante"
                value={form.medico_solicitante}
                onChange={(v) => set("medico_solicitante", v)}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Procedencia</label>
              <AutocompleteInput
                field="procedencia"
                value={form.procedencia}
                onChange={(v) => set("procedencia", v)}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Tipo de examen</label>
              <AutocompleteInput
                field="tipo_examen"
                value={form.tipo_examen}
                onChange={(v) => set("tipo_examen", v)}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Equipo</label>
              <AutocompleteInput field="equipo" value={form.equipo} onChange={(v) => set("equipo", v)} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Motivo</label>
              <AutocompleteInput field="motivo" value={form.motivo} onChange={(v) => set("motivo", v)} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Protocolo</label>
              <AutocompleteInput field="protocolo" value={form.protocolo} onChange={(v) => set("protocolo", v)} />
            </div>

            <div className="col-span-2">
              <label className={FIELD_LABEL}>Notas</label>
              <textarea
                className={INPUT_CLASS}
                rows={2}
                value={form.notas}
                onChange={(e) => set("notas", e.target.value)}
              />
            </div>

            <div className="col-span-2 text-[11px] text-muted-foreground">
              Responsable: <span className="font-medium text-foreground">{RESPONSABLE_FIJO}</span> (fijo, no editable)
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Cancelar
          </button>
          <button
            disabled={!fechaLista || saving}
            onClick={() => submit(false)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
