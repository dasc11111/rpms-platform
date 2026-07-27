"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import { AutocompleteInput } from "./autocomplete-input";
import { CLASIFICACION_LABELS } from "@/lib/contamination";
import {
  RC_RADIONUCLIDOS,
  RC_LABORATORIO_PUNTOS,
  RC_SALA_PACIENTES_PUNTOS,
  RC_ESTADO_GENERAL_LABELS,
  evaluarPuntoRoomClearance,
  calcularResumenArea,
  recomendacionDescontaminacion,
  type RcAreaTipo,
  type RcLimite,
  type RcPointInput,
} from "@/lib/room-clearance";

type RowState = {
  punto: string;
  cps_medida: string;
  cps_fondo: string;
  tasa_dosis_usv_h: string;
};

function emptyRows(puntos: readonly string[]): RowState[] {
  return puntos.map((punto) => ({ punto, cps_medida: "", cps_fondo: "", tasa_dosis_usv_h: "" }));
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function toInput(r: RowState): RcPointInput {
  return {
    punto: r.punto,
    cps_medida: Number(r.cps_medida) || 0,
    cps_fondo: Number(r.cps_fondo) || 0,
    tasa_dosis_usv_h: r.tasa_dosis_usv_h !== "" ? Number(r.tasa_dosis_usv_h) : null,
  };
}

const SEMAFORO_DOT: Record<string, string> = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-500",
  rojo: "bg-red-500",
};

const SEMAFORO_BG: Record<string, string> = {
  verde: "",
  amarillo: "bg-yellow-500/10",
  rojo: "bg-red-500/10",
};

const ESTADO_DOT: Record<string, string> = {
  liberado: "bg-green-500",
  conforme: "bg-green-500",
  requiere_descontaminacion: "bg-yellow-500",
  no_liberado: "bg-red-500",
};

// Formulario de ingreso rapido para la evaluacion diaria de "Liberacion de
// Sala" (Laboratorio + Sala de Pacientes). Disenado para minimizar clics y
// escritura: valores por defecto, calculo y clasificacion en vivo mientras se
// escribe, y navegacion con ENTER entre campos ademas del TAB nativo del
// navegador. No reemplaza ni modifica el modulo de "Registro de
// Contaminacion" existente (Dashboard/Registros/Limites/Buscar): se agrega
// como una pestana nueva e independiente en ContaminationApp.
export function RoomClearanceForm({ onSaved }: { onSaved?: () => void }) {
  const [evalDate, setEvalDate] = useState(todayISO());
  const [responsable, setResponsable] = useState("");
  const [radionuclido, setRadionuclido] = useState<string>("TC-99M");
  const [instrumento, setInstrumento] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [laboratorio, setLaboratorio] = useState<RowState[]>(() => emptyRows(RC_LABORATORIO_PUNTOS));
  const [sala, setSala] = useState<RowState[]>(() => emptyRows(RC_SALA_PACIENTES_PUNTOS));

  const [limites, setLimites] = useState<Record<string, RcLimite>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch("/api/contamination/limits")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.rows) return;
        const map: Record<string, RcLimite> = {};
        for (const r of data.rows) {
          map[r.radionuclido] = {
            limite_bq_m2: Number(r.limite_bq_m2),
            pct_registro: Number(r.pct_registro),
            pct_investigacion: Number(r.pct_investigacion),
            pct_intervencion: Number(r.pct_intervencion),
          };
        }
        setLimites(map);
      })
      .catch(() => {});
  }, []);

  // Prefill del responsable/instrumento con la ultima evaluacion guardada,
  // para evitar el ingreso repetitivo de datos (habitualmente el mismo
  // tecnologo y el mismo instrumento se usan dia a dia).
  useEffect(() => {
    fetch("/api/room-clearance?page=1&pageSize=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const last = data?.rows?.[0];
        if (last) {
          setResponsable((v) => v || last.responsable || "");
          setInstrumento((v) => v || last.instrumento_utilizado || "");
        }
      })
      .catch(() => {});
  }, []);

  const limite = limites[radionuclido] ?? limites["GENERICO"] ?? null;

  const laboratorioResultados = useMemo(
    () => laboratorio.map((r) => evaluarPuntoRoomClearance(toInput(r), limite)),
    [laboratorio, limite]
  );
  const salaResultados = useMemo(
    () => sala.map((r) => evaluarPuntoRoomClearance(toInput(r), limite)),
    [sala, limite]
  );

  const resumenLaboratorio = useMemo(() => calcularResumenArea(laboratorioResultados), [laboratorioResultados]);
  const resumenSala = useMemo(() => calcularResumenArea(salaResultados), [salaResultados]);

  function updateRow(area: RcAreaTipo, index: number, field: keyof RowState, value: string) {
    const setter = area === "laboratorio" ? setLaboratorio : setSala;
    setter((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  // Orden plano de todos los campos, para permitir avanzar con ENTER (ademas
  // del TAB nativo del navegador), segun requisito de "ingreso rapido".
  const flatOrder = useMemo(() => {
    const order: string[] = [];
    RC_LABORATORIO_PUNTOS.forEach((_, i) => {
      order.push(`laboratorio-${i}-cps_medida`, `laboratorio-${i}-cps_fondo`, `laboratorio-${i}-tasa_dosis_usv_h`);
    });
    RC_SALA_PACIENTES_PUNTOS.forEach((_, i) => {
      order.push(`sala_pacientes-${i}-cps_medida`, `sala_pacientes-${i}-cps_fondo`, `sala_pacientes-${i}-tasa_dosis_usv_h`);
    });
    return order;
  }, []);

  function handleEnter(key: string, e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const idx = flatOrder.indexOf(key);
    const nextKey = flatOrder[idx + 1] ?? flatOrder[0];
    if (nextKey) inputRefs.current[nextKey]?.focus();
  }

  function resetForm() {
    setLaboratorio(emptyRows(RC_LABORATORIO_PUNTOS));
    setSala(emptyRows(RC_SALA_PACIENTES_PUNTOS));
    setObservaciones("");
    setEvalDate(todayISO());
    setError(null);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (!evalDate) {
      setError("La fecha es obligatoria");
      return;
    }
    if (!responsable.trim()) {
      setError("El responsable de la medición es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/room-clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eval_date: evalDate,
          responsable,
          radionuclido,
          instrumento_utilizado: instrumento,
          observaciones_generales: observaciones,
          laboratorio: laboratorio.map(toInput),
          sala_pacientes: sala.map(toInput),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "No se pudo guardar la evaluación");
        return;
      }
      setSuccess(`Evaluación guardada correctamente (#${data.row.id}).`);
      resetForm();
      onSaved?.();
    } catch {
      setError("Error de red al guardar la evaluación");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fecha">
            <input
              type="date"
              value={evalDate}
              onChange={(e) => setEvalDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Responsable de la medición">
            <AutocompleteInput field="responsable" value={responsable} onChange={setResponsable} placeholder="Nombre del responsable" />
          </Field>
          <Field label="Radioisótopo evaluado">
            <select
              value={radionuclido}
              onChange={(e) => setRadionuclido(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            >
              {RC_RADIONUCLIDOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Instrumento utilizado">
            <AutocompleteInput field="instrumento" value={instrumento} onChange={setInstrumento} placeholder="Ej: Detector GM-1" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Observaciones generales (opcional)">
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
          </Field>
        </div>
      </div>

      {(error || success) && (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            error ? "border-red-500/40 bg-red-500/10 text-red-600" : "border-green-500/40 bg-green-500/10 text-green-600"
          }`}
        >
          {error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {error ?? success}
        </div>
      )}

      <AreaSection
        title="Laboratorio"
        area="laboratorio"
        rows={laboratorio}
        resultados={laboratorioResultados}
        resumen={resumenLaboratorio}
        onChange={updateRow}
        onEnter={handleEnter}
        inputRefs={inputRefs}
      />

      <AreaSection
        title="Sala de Pacientes"
        area="sala_pacientes"
        rows={sala}
        resultados={salaResultados}
        resumen={resumenSala}
        onChange={updateRow}
        onEnter={handleEnter}
        inputRefs={inputRefs}
      />

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={resetForm}
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" /> Limpiar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          type="button"
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar evaluación
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function AreaSection({
  title,
  area,
  rows,
  resultados,
  resumen,
  onChange,
  onEnter,
  inputRefs,
}: {
  title: string;
  area: RcAreaTipo;
  rows: RowState[];
  resultados: ReturnType<typeof evaluarPuntoRoomClearance>[];
  resumen: ReturnType<typeof calcularResumenArea>;
  onChange: (area: RcAreaTipo, index: number, field: keyof RowState, value: string) => void;
  onEnter: (key: string, e: React.KeyboardEvent) => void;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}) {
  const estadoDot = ESTADO_DOT[resumen.estado_general] ?? "bg-muted";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${estadoDot}`} />
            {RC_ESTADO_GENERAL_LABELS[resumen.estado_general]}
          </span>
          <span>
            {resumen.puntos_contaminados}/{resumen.total_puntos} puntos con contaminación
          </span>
          {resumen.punto_mayor_contaminacion && (
            <span>
              Mayor: {resumen.punto_mayor_contaminacion} ({resumen.max_bq_cm2.toFixed(2)} Bq/cm²)
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5">Punto</th>
              <th className="px-2 py-1.5">CPS Medida</th>
              <th className="px-2 py-1.5">CPS Fondo</th>
              <th className="px-2 py-1.5">µSv/h</th>
              <th className="px-2 py-1.5">CPS Neto</th>
              <th className="px-2 py-1.5">Bq/cm²</th>
              <th className="px-2 py-1.5">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => {
              const res = resultados[i]!;
              const rowBg = row.cps_medida !== "" ? SEMAFORO_BG[res.semaforo] : "";
              return (
                <tr key={row.punto} className={rowBg}>
                  <td className="whitespace-nowrap px-2 py-1.5 font-medium">{row.punto}</td>
                  <td className="px-2 py-1.5">
                    <NumInput
                      refKey={`${area}-${i}-cps_medida`}
                      value={row.cps_medida}
                      onChange={(v) => onChange(area, i, "cps_medida", v)}
                      onEnter={onEnter}
                      inputRefs={inputRefs}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput
                      refKey={`${area}-${i}-cps_fondo`}
                      value={row.cps_fondo}
                      onChange={(v) => onChange(area, i, "cps_fondo", v)}
                      onEnter={onEnter}
                      inputRefs={inputRefs}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <NumInput
                      refKey={`${area}-${i}-tasa_dosis_usv_h`}
                      value={row.tasa_dosis_usv_h}
                      onChange={(v) => onChange(area, i, "tasa_dosis_usv_h", v)}
                      onEnter={onEnter}
                      inputRefs={inputRefs}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{res.cps_neto.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{res.bq_cm2.toFixed(2)}</td>
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${SEMAFORO_DOT[res.semaforo]}`} />
                      {CLASIFICACION_LABELS[res.clasificacion]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resumen.estado_general === "no_liberado" && resumen.punto_mayor_contaminacion && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {recomendacionDescontaminacion(resumen.punto_mayor_contaminacion, area)}
        </div>
      )}
    </div>
  );
}

function NumInput({
  refKey,
  value,
  onChange,
  onEnter,
  inputRefs,
}: {
  refKey: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: (key: string, e: React.KeyboardEvent) => void;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}) {
  return (
    <input
      ref={(el) => {
        inputRefs.current[refKey] = el;
      }}
      type="number"
      inputMode="decimal"
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => onEnter(refKey, e)}
      onFocus={(e) => e.target.select()}
      className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
    />
  );
}
