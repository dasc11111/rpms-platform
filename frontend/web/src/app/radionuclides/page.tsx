"use client";

// §92 — Catálogo de Radionúclidos y Parámetros de Protección Radiológica
// Parámetros de vida media, criterios de liberación de pacientes y límites
// operacionales para cada radionúclido habilitado en el sistema RPMS-HHHA.
// Normativa: DS 3/1985 · NS-06.0 §5 · IAEA Safety Reports No. 63
// ICRP Publication 94 · DS396 (Radiation Protection and Safety in Medical Uses)

import { useState, useEffect, useCallback } from "react";
import {
  Atom,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Edit2,
  Save,
  X,
  Info,
  FileText,
  Zap,
  Clock,
  AlertTriangle,
} from "lucide-react";

// ─────────────── Types ───────────────────────────────────────────────────────

interface Radionuclide {
  code: string;
  name: string;
  half_life_days: number;
  unit: string;
  release_criteria_activity: number | null;
  release_criteria_dose_rate_usvh: number | null;
  active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────── Scientific Reference Data ───────────────────────────────────
// Datos de referencia para cada radionúclido según ICRP 94 / IAEA SRS-63

const RC_REF: Record<string, {
  t_half: string;
  emision: string;
  energia_kev: string;
  uso_clinico: string;
  dosis_tipica_gbq: string;
}> = {
  "I-131": {
    t_half: "8.02 d",
    emision: "β⁻ + γ (364 keV)",
    energia_kev: "364",
    uso_clinico: "Terapia hipertiroidismo, Ca tiroideo",
    dosis_tipica_gbq: "0.185–7.4 GBq",
  },
  "TC-99M": {
    t_half: "6.01 h",
    emision: "γ (140 keV)",
    energia_kev: "140",
    uso_clinico: "Gamma cámara — centellografía diagnóstica",
    dosis_tipica_gbq: "0.185–1.1 GBq",
  },
  "F-18": {
    t_half: "109.8 min",
    emision: "β⁺ → 2γ (511 keV)",
    energia_kev: "511",
    uso_clinico: "PET/CT oncológico (FDG)",
    dosis_tipica_gbq: "0.185–0.37 GBq",
  },
  "GA-68": {
    t_half: "67.7 min",
    emision: "β⁺ → 2γ (511 keV)",
    energia_kev: "511",
    uso_clinico: "PET/CT PSMA, receptor somatostatina",
    dosis_tipica_gbq: "0.1–0.25 GBq",
  },
  "LU-177": {
    t_half: "6.65 d",
    emision: "β⁻ + γ (113, 208 keV)",
    energia_kev: "113 / 208",
    uso_clinico: "Terapia PSMA, PRRT",
    dosis_tipica_gbq: "3.7–7.4 GBq",
  },
  "Y-90": {
    t_half: "64.1 h",
    emision: "β⁻ puro",
    energia_kev: "—",
    uso_clinico: "Radioembolización hepática",
    dosis_tipica_gbq: "1–3 GBq",
  },
  "RA-223": {
    t_half: "11.43 d",
    emision: "α + γ",
    energia_kev: "variable",
    uso_clinico: "Terapia metástasis óseas (Ca próstata)",
    dosis_tipica_gbq: "0.055 GBq × 6 ciclos",
  },
  "SM-153": {
    t_half: "46.3 h",
    emision: "β⁻ + γ (103 keV)",
    energia_kev: "103",
    uso_clinico: "Paliación dolor óseo",
    dosis_tipica_gbq: "2.6 GBq",
  },
  "I-123": {
    t_half: "13.2 h",
    emision: "γ (159 keV)",
    energia_kev: "159",
    uso_clinico: "Centellografía tiroidea diagnóstica, DAT",
    dosis_tipica_gbq: "0.3–0.4 GBq",
  },
};

// ─────────────── Helpers ─────────────────────────────────────────────────────

function fmtHalfLife(days: number): string {
  if (days >= 1) return `${days.toFixed(2)} d`;
  const hours = days * 24;
  if (hours >= 1) return `${hours.toFixed(1)} h`;
  return `${(hours * 60).toFixed(0)} min`;
}

// ─────────────── Edit Modal ───────────────────────────────────────────────────

function EditModal({
  rn,
  onClose,
  onSaved,
}: {
  rn: Radionuclide;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [criteria, setCriteria] = useState(String(rn.release_criteria_activity ?? ""));
  const [dose, setDose]         = useState(String(rn.release_criteria_dose_rate_usvh ?? ""));
  const [active, setActive]     = useState(rn.active);
  const [notes, setNotes]       = useState(rn.notes ?? "");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/radionuclides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: rn.code,
          active,
          release_criteria_activity: criteria !== "" ? parseFloat(criteria) : null,
          release_criteria_dose_rate_usvh: dose !== "" ? parseFloat(dose) : null,
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-xl border w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Atom className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-lg">Editar — {rn.code}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{rn.name}</p>
            <p className="text-xs text-muted-foreground">T½ = {fmtHalfLife(rn.half_life_days)}</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium">Radionúclido activo en el sistema</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Criterio liberación — Actividad (MBq)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={criteria}
              onChange={e => setCriteria(e.target.value)}
              placeholder="ej. 400 MBq (I-131 según IAEA SRS-63)"
              step="0.1"
              min="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              IAEA SRS-63: I-131 = 400 MBq · Lu-177 = 7400 MBq · Y-90 = 1110 MBq
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Criterio liberación — Tasa de dosis (µSv/h a 1 m)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={dose}
              onChange={e => setDose(e.target.value)}
              placeholder="ej. 25 µSv/h (DS 3/1985 Art. 36)"
              step="0.1"
              min="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              DS 3/1985: ≤ 25 µSv/h a 1 metro del paciente para alta hospitalaria.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notas técnicas</label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {err && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{err}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────── Radionuclide Row ────────────────────────────────────────────

function RnCard({ rn, onEdit }: { rn: Radionuclide; onEdit: (rn: Radionuclide) => void }) {
  const [open, setOpen] = useState(false);
  const ref = RC_REF[rn.code];

  return (
    <div className={`rounded-xl border bg-card shadow-sm transition-all ${!rn.active ? "opacity-70" : ""}`}>
      <div
        className="flex items-center justify-between gap-3 p-4 cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${rn.active ? "bg-blue-100" : "bg-gray-100"}`}>
            <Atom className={`w-5 h-5 ${rn.active ? "text-blue-600" : "text-gray-400"}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm font-mono">{rn.code}</span>
              <span className="text-sm text-muted-foreground">{rn.name}</span>
              {rn.active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="w-3 h-3" /> Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-gray-100 text-gray-600 border-gray-300">
                  <XCircle className="w-3 h-3" /> Inactivo
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> T½ = {fmtHalfLife(rn.half_life_days)}
              </span>
              {ref && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {ref.emision}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit(rn); }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Editar parámetros"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {open ? (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          ) : (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Vida media</p>
            <p className="font-semibold">{fmtHalfLife(rn.half_life_days)}</p>
            <p className="text-xs text-muted-foreground">({rn.half_life_days} días)</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Criterio liberación — Actividad</p>
            <p className="font-semibold">
              {rn.release_criteria_activity !== null
                ? `${rn.release_criteria_activity} MBq`
                : <span className="text-orange-600 italic text-xs">No configurado</span>
              }
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Criterio liberación — Tasa dosis</p>
            <p className="font-semibold">
              {rn.release_criteria_dose_rate_usvh !== null
                ? `${rn.release_criteria_dose_rate_usvh} µSv/h @ 1m`
                : <span className="text-orange-600 italic text-xs">No configurado</span>
              }
            </p>
          </div>

          {ref && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de emisión</p>
                <p className="font-medium">{ref.emision}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Energía principal (keV)</p>
                <p className="font-medium">{ref.energia_kev}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Uso clínico</p>
                <p className="font-medium">{ref.uso_clinico}</p>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-muted-foreground">Dosis típica administrada</p>
                <p className="font-medium">{ref.dosis_tipica_gbq}</p>
              </div>
            </>
          )}

          {rn.notes && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg bg-muted/40 border p-3">
              <p className="text-xs text-muted-foreground font-medium mb-1">Notas técnicas</p>
              <p className="text-sm">{rn.notes}</p>
            </div>
          )}

          {(!rn.release_criteria_activity || !rn.release_criteria_dose_rate_usvh) && rn.active && (
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-800">
                Criterios de liberación incompletos. Configure los valores de actividad y tasa de dosis para que
                el módulo de liberación de pacientes pueda validar automáticamente el alta.
                <button
                  onClick={() => onEdit(rn)}
                  className="ml-1 underline font-medium hover:no-underline"
                >
                  Configurar ahora
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────── Main Page ───────────────────────────────────────────────────

export default function RadionuclidesPage() {
  const [radionuclides, setRadionuclides] = useState<Radionuclide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);
  const [editing, setEditing] = useState<Radionuclide | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (onlyActive) params.set("active", "true");
      const res = await fetch(`/api/radionuclides?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRadionuclides(data.rows ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeCount   = radionuclides.filter(r => r.active).length;
  const inactiveCount = radionuclides.filter(r => !r.active).length;
  const missingConfig = radionuclides.filter(r =>
    r.active && (!r.release_criteria_activity || !r.release_criteria_dose_rate_usvh)
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Atom className="w-6 h-6 text-blue-600" />
            Catálogo de Radionúclidos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            §92 — Parámetros técnicos y criterios de protección radiológica por radionúclido
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* ── Alert ────────────────────────────────────────────────────────── */}
      {missingConfig > 0 && (
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">
              {missingConfig} radionúclido(s) activo(s) sin criterios de liberación configurados
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              Configure los criterios de actividad (MBq) y tasa de dosis (µSv/h) para que el
              módulo de liberación de pacientes funcione correctamente.
            </p>
          </div>
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-4 flex items-start gap-3 bg-muted/40">
          <Atom className="w-5 h-5 mt-0.5 opacity-70" />
          <div>
            <p className="text-xs font-medium opacity-70">Total</p>
            <p className="text-xl font-bold">{radionuclides.length}</p>
          </div>
        </div>
        <div className="rounded-xl border p-4 flex items-start gap-3 bg-green-50 text-green-900 border-green-200">
          <CheckCircle2 className="w-5 h-5 mt-0.5 opacity-70" />
          <div>
            <p className="text-xs font-medium opacity-70">Activos</p>
            <p className="text-xl font-bold">{activeCount}</p>
          </div>
        </div>
        <div className="rounded-xl border p-4 flex items-start gap-3 bg-gray-50 text-gray-700 border-gray-200">
          <XCircle className="w-5 h-5 mt-0.5 opacity-70" />
          <div>
            <p className="text-xs font-medium opacity-70">Inactivos</p>
            <p className="text-xl font-bold">{inactiveCount}</p>
          </div>
        </div>
      </div>

      {/* ── Filter toggle ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={e => setOnlyActive(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Mostrar solo radionúclidos activos
        </label>
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Cargando catálogo…
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      ) : (
        <div className="space-y-3">
          {radionuclides.map((rn) => (
            <RnCard key={rn.code} rn={rn} onEdit={setEditing} />
          ))}
        </div>
      )}

      {/* ── Info Box ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-blue-50/60 p-4 text-xs text-blue-900 space-y-1.5">
        <p className="font-semibold flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Criterios de Liberación — Referencia IAEA SRS-63 / DS 3/1985
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-200">
                <th className="py-1 pr-4 font-medium">Radionúclido</th>
                <th className="py-1 pr-4 font-medium text-right">Actividad (MBq)</th>
                <th className="py-1 pr-4 font-medium text-right">Tasa dosis µSv/h@1m</th>
                <th className="py-1 font-medium">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {[
                { code: "I-131",  act: "400",  dose: "25",  ref: "IAEA SRS-63 / DS 3/1985 Art. 36" },
                { code: "LU-177", act: "7400", dose: "25",  ref: "IAEA SRS-63 §5.2" },
                { code: "Y-90",   act: "1110", dose: "25",  ref: "IAEA SRS-63 §5.2" },
                { code: "RA-223", act: "—",    dose: "25",  ref: "IAEA Radiation Protection in Nuclear Medicine" },
                { code: "GA-68",  act: "—",    dose: "25",  ref: "IAEA SRS-63 (diagnóstico)" },
                { code: "F-18",   act: "—",    dose: "25",  ref: "IAEA SRS-63 (diagnóstico)" },
              ].map(r => (
                <tr key={r.code} className="border-b border-blue-100 last:border-0">
                  <td className="py-1 pr-4 font-mono font-medium">{r.code}</td>
                  <td className="py-1 pr-4 text-right">{r.act}</td>
                  <td className="py-1 pr-4 text-right">{r.dose}</td>
                  <td className="py-1 text-blue-700">{r.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Regulatory Footer ────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold flex items-center gap-1.5 text-foreground">
          <FileText className="w-3.5 h-3.5" />
          Marco Normativo — Criterios de Liberación de Pacientes Tratados con RFN
        </p>
        <p>• <strong>DS 3/1985 Art. 36:</strong> Condiciones para alta hospitalaria de pacientes tratados con radiofármacos — tasa de dosis ≤ 25 µSv/h a 1 metro.</p>
        <p>• <strong>NS-06.0 §5:</strong> Restricciones de dosis y criterios de liberación de personas que reciben radiofármacos terapéuticos.</p>
        <p>• <strong>IAEA Safety Reports No. 63 (SRS-63):</strong> Release of Patients after Radionuclide Therapy — criterios de actividad residual y tasa de dosis por radionúclido.</p>
        <p>• <strong>ICRP Publication 94:</strong> Release of Patients after Unseal Source Radiotherapy — fundamentos dosimétricos y justificación de criterios.</p>
        <p>• <strong>IAEA DS396:</strong> Radiation Protection and Safety in Medical Uses of Ionizing Radiation — requisitos de protección en Medicina Nuclear terapéutica.</p>
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editing && (
        <EditModal
          rn={editing}
          onClose={() => setEditing(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
