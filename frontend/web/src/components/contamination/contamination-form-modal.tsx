"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle, Info } from "lucide-react";
import { AutocompleteInput } from "./autocomplete-input";
import {
  MESES,
  daysInMonth,
  RADIONUCLIDOS,
  SUPERFICIE_OPTIONS,
  ESTADO_OPTIONS,
  type ContaminationRecord,
} from "@/lib/contamination";

type FormState = {
  monitor_year: string;
  monitor_month: string;
  monitor_day: string;
  area: string;
  sala: string;
  dependencia: string;
  punto_medicion: string;
  equipo: string;
  superficie: string;
  radionuclido: string;
  instrumento: string;
  numero_serie_detector: string;
  factor_calibracion: string;
  factor_eficiencia: string;
  area_monitoreada_cm2: string;
  tiempo_medicion_seg: string;
  fondo_cps: string;
  conteo_bruto_cps: string;
  tasa_dosis_usv_h: string;
  conteo_post_limpieza_cps: string;
  limpieza_realizada: boolean;
  accion_correctiva: string;
  estado: string;
  motivo: string;
  responsable: string;
  observaciones: string;
};

const EMPTY: FormState = {
  monitor_year: String(new Date().getFullYear()),
  monitor_month: String(new Date().getMonth() + 1),
  monitor_day: "",
  area: "",
  sala: "",
  dependencia: "",
  punto_medicion: "",
  equipo: "",
  superficie: "",
  radionuclido: "TC-99M",
  instrumento: "",
  numero_serie_detector: "",
  factor_calibracion: "",
  factor_eficiencia: "0.15",
  area_monitoreada_cm2: "15",
  tiempo_medicion_seg: "60",
  fondo_cps: "",
  conteo_bruto_cps: "",
  tasa_dosis_usv_h: "",
  conteo_post_limpieza_cps: "",
  limpieza_realizada: false,
  accion_correctiva: "",
  estado: "ABIERTO",
  motivo: "",
  responsable: "",
  observaciones: "",
};

function recordToForm(r: ContaminationRecord): FormState {
  return {
    monitor_year: String(r.monitor_year),
    monitor_month: String(r.monitor_month),
    monitor_day: String(r.monitor_day),
    area: r.area ?? "",
    sala: r.sala ?? "",
    dependencia: r.dependencia ?? "",
    punto_medicion: r.punto_medicion ?? "",
    equipo: r.equipo ?? "",
    superficie: r.superficie ?? "",
    radionuclido: r.radionuclido ?? "TC-99M",
    instrumento: r.instrumento ?? "",
    numero_serie_detector: r.numero_serie_detector ?? "",
    factor_calibracion: r.factor_calibracion?.toString() ?? "",
    factor_eficiencia: r.factor_eficiencia?.toString() ?? "0.15",
    area_monitoreada_cm2: r.area_monitoreada_cm2?.toString() ?? "15",
    tiempo_medicion_seg: r.tiempo_medicion_seg?.toString() ?? "60",
    fondo_cps: r.fondo_cps?.toString() ?? "",
    conteo_bruto_cps: r.conteo_bruto_cps?.toString() ?? "",
    tasa_dosis_usv_h: r.tasa_dosis_usv_h?.toString() ?? "",
    conteo_post_limpieza_cps: r.conteo_post_limpieza_cps?.toString() ?? "",
    limpieza_realizada: Boolean(r.limpieza_realizada),
    accion_correctiva: r.accion_correctiva ?? "",
    estado: r.estado ?? "ABIERTO",
    motivo: r.motivo ?? "",
    responsable: r.responsable ?? "",
    observaciones: r.observaciones ?? "",
  };
}

const FIELD_LABEL = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
const INPUT_CLASS =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export function ContaminationFormModal({
  open,
  onClose,
  record,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  record?: ContaminationRecord | null;
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

  const fechaLista = Boolean(form.monitor_year && form.monitor_month && form.monitor_day);
  const maxDay = daysInMonth(Number(form.monitor_year), Number(form.monitor_month));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Vista previa en vivo de los calculos (misma formula que el backend):
  // actividad (Bq/cm2) = (conteo bruto - fondo) / (eficiencia x area)
  const bruto = Number(form.conteo_bruto_cps) || 0;
  const fondo = Number(form.fondo_cps) || 0;
  const eficiencia = Number(form.factor_eficiencia) || 0;
  const area = Number(form.area_monitoreada_cm2) || 0;
  const neto = Math.max(0, bruto - fondo);
  const actividadCm2 = eficiencia && area ? neto / (eficiencia * area) : 0;

  async function submit(force = false) {
    setError(null);
    if (!form.monitor_year || !form.monitor_month || !form.monitor_day) {
      setError("Debe indicar año, mes y día de la medición.");
      return;
    }
    if (!form.punto_medicion.trim()) {
      setError("El punto de medición es obligatorio.");
      return;
    }
    if (!form.responsable.trim()) {
      setError("El responsable es obligatorio.");
      return;
    }
    if (Number(form.conteo_bruto_cps) < 0 || Number(form.fondo_cps) < 0) {
      setError("Los valores de conteo no pueden ser negativos.");
      return;
    }

    setSaving(true);
    const payload = {
      monitor_year: Number(form.monitor_year),
      monitor_month: Number(form.monitor_month),
      monitor_day: Number(form.monitor_day),
      area: form.area || null,
      sala: form.sala || null,
      dependencia: form.dependencia || null,
      punto_medicion: form.punto_medicion.trim(),
      equipo: form.equipo || null,
      superficie: form.superficie || null,
      radionuclido: form.radionuclido || "TC-99M",
      instrumento: form.instrumento || null,
      numero_serie_detector: form.numero_serie_detector || null,
      factor_calibracion: form.factor_calibracion ? Number(form.factor_calibracion) : null,
      factor_eficiencia: form.factor_eficiencia ? Number(form.factor_eficiencia) : 0.15,
      area_monitoreada_cm2: form.area_monitoreada_cm2 ? Number(form.area_monitoreada_cm2) : 15,
      tiempo_medicion_seg: form.tiempo_medicion_seg ? Number(form.tiempo_medicion_seg) : null,
      fondo_cps: form.fondo_cps ? Number(form.fondo_cps) : 0,
      conteo_bruto_cps: form.conteo_bruto_cps ? Number(form.conteo_bruto_cps) : 0,
      tasa_dosis_usv_h: form.tasa_dosis_usv_h ? Number(form.tasa_dosis_usv_h) : null,
      conteo_post_limpieza_cps: form.conteo_post_limpieza_cps === "" ? null : Number(form.conteo_post_limpieza_cps),
      limpieza_realizada: form.limpieza_realizada,
      accion_correctiva: form.accion_correctiva || null,
      estado: form.estado || "ABIERTO",
      motivo: form.motivo || null,
      responsable: form.responsable.trim(),
      observaciones: form.observaciones || null,
      force,
    };

    try {
      const url = record ? `/api/contamination/${record.id}` : "/api/contamination";
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
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {record ? "Editar monitoreo de contaminación" : "Nuevo monitoreo de contaminación"}
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
              <AlertTriangle className="h-3.5 w-3.5" /> Ya existe un registro para este punto y radionúclido en esta
              fecha. ¿Desea guardarlo igualmente?
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

        {/* Paso 1: fecha de monitoreo, obligatoria y primero */}
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/30 p-3">
          <div>
            <label className={FIELD_LABEL}>Año *</label>
            <input
              type="number"
              className={INPUT_CLASS}
              value={form.monitor_year}
              onChange={(e) => set("monitor_year", e.target.value)}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Mes *</label>
            <select className={INPUT_CLASS} value={form.monitor_month} onChange={(e) => set("monitor_month", e.target.value)}>
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
            <select className={INPUT_CLASS} value={form.monitor_day} onChange={(e) => set("monitor_day", e.target.value)}>
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
            Ingrese año, mes y día de la medición para continuar con el resto del formulario.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <label className={FIELD_LABEL}>Área</label>
                <AutocompleteInput field="area" value={form.area} onChange={(v) => set("area", v)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Sala</label>
                <AutocompleteInput field="sala" value={form.sala} onChange={(v) => set("sala", v)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Dependencia</label>
                <AutocompleteInput field="dependencia" value={form.dependencia} onChange={(v) => set("dependencia", v)} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className={FIELD_LABEL}>Punto de medición *</label>
                <AutocompleteInput
                  field="punto_medicion"
                  value={form.punto_medicion}
                  onChange={(v) => set("punto_medicion", v)}
                  placeholder="ej. Mesón de laboratorio"
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Equipo</label>
                <AutocompleteInput field="equipo" value={form.equipo} onChange={(v) => set("equipo", v)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Superficie</label>
                <select className={INPUT_CLASS} value={form.superficie} onChange={(e) => set("superficie", e.target.value)}>
                  <option value="">—</option>
                  {SUPERFICIE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Instrumento y radionúclido</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className={FIELD_LABEL}>Radionúclido</label>
                  <select className={INPUT_CLASS} value={form.radionuclido} onChange={(e) => set("radionuclido", e.target.value)}>
                    {RADIONUCLIDOS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={FIELD_LABEL}>Instrumento</label>
                  <AutocompleteInput field="instrumento" value={form.instrumento} onChange={(v) => set("instrumento", v)} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>N° de serie del detector</label>
                  <AutocompleteInput
                    field="numero_serie_detector"
                    value={form.numero_serie_detector}
                    onChange={(v) => set("numero_serie_detector", v)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Factor de calibración</label>
                  <input
                    type="number"
                    step="0.0001"
                    className={INPUT_CLASS}
                    value={form.factor_calibracion}
                    onChange={(e) => set("factor_calibracion", e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Eficiencia del detector</label>
                  <input
                    type="number"
                    step="0.01"
                    className={INPUT_CLASS}
                    value={form.factor_eficiencia}
                    onChange={(e) => set("factor_eficiencia", e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Área monitoreada (cm²)</label>
                  <input
                    type="number"
                    step="0.1"
                    className={INPUT_CLASS}
                    value={form.area_monitoreada_cm2}
                    onChange={(e) => set("area_monitoreada_cm2", e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Tiempo de medición (seg)</label>
                  <input
                    type="number"
                    step="1"
                    className={INPUT_CLASS}
                    value={form.tiempo_medicion_seg}
                    onChange={(e) => set("tiempo_medicion_seg", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Conteos medidos</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className={FIELD_LABEL}>Fondo (cps)</label>
                  <input
                    type="number"
                    step="0.01"
                    className={INPUT_CLASS}
                    value={form.fondo_cps}
                    onChange={(e) => set("fondo_cps", e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Conteo bruto (cps) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className={INPUT_CLASS}
                    value={form.conteo_bruto_cps}
                    onChange={(e) => set("conteo_bruto_cps", e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Tasa de dosis (uSv/h)</label>
                  <input
                    type="number"
                    step="0.01"
                    className={INPUT_CLASS}
                    value={form.tasa_dosis_usv_h}
                    onChange={(e) => set("tasa_dosis_usv_h", e.target.value)}
                    placeholder="Medición independiente, opcional"
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Conteo post-limpieza (cps)</label>
                  <input
                    type="number"
                    step="0.01"
                    className={INPUT_CLASS}
                    value={form.conteo_post_limpieza_cps}
                    onChange={(e) => set("conteo_post_limpieza_cps", e.target.value)}
                    placeholder="Solo si ya se realizó descontaminación"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-md border border-accent/30 bg-accent-subtle px-3 py-2 text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p>
                    Conteo neto: <span className="font-medium">{neto.toFixed(2)} cps</span> · Actividad superficial:{" "}
                    <span className="font-medium">{actividadCm2.toFixed(3)} Bq/cm²</span>
                  </p>
                  <p className="text-muted-foreground">
                    Clasificación y semáforo se calculan automáticamente al guardar, comparando contra el límite
                    configurable del radionúclido seleccionado.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <label className={FIELD_LABEL}>Motivo del monitoreo</label>
                <AutocompleteInput field="motivo" value={form.motivo} onChange={(v) => set("motivo", v)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Estado</label>
                <select className={INPUT_CLASS} value={form.estado} onChange={(e) => set("estado", e.target.value)}>
                  {ESTADO_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Responsable *</label>
                <AutocompleteInput field="responsable" value={form.responsable} onChange={(v) => set("responsable", v)} />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={FIELD_LABEL}>Acción correctiva</label>
                <AutocompleteInput
                  field="accion_correctiva"
                  value={form.accion_correctiva}
                  onChange={(v) => set("accion_correctiva", v)}
                />
              </div>
              <div className="col-span-2 flex items-center gap-2 md:col-span-3">
                <input
                  id="limpieza_realizada"
                  type="checkbox"
                  checked={form.limpieza_realizada}
                  onChange={(e) => set("limpieza_realizada", e.target.checked)}
                />
                <label htmlFor="limpieza_realizada" className="text-xs">
                  Limpieza/descontaminación realizada
                </label>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={FIELD_LABEL}>Observaciones</label>
                <textarea
                  className={INPUT_CLASS}
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => set("observaciones", e.target.value)}
                />
              </div>
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
