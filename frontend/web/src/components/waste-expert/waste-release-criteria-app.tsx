"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Plus, RefreshCcw, X } from "lucide-react";

// Sección 27-28 del Prompt Maestro Definitivo: Criterios de liberación/dispensa
// de residuos radiactivos. Distintos de los criterios de control de contaminación.
// Nunca se codifican valores directamente; se consultan desde esta tabla.

const FIELD = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
const INPUT = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

type Criterion = {
  id: number;
  jurisdiccion: string;
  documento_fuente: string;
  version: string | null;
  fecha_vigencia_desde: string | null;
  fecha_vigencia_hasta: string | null;
  radionuclide_code: string | null;
  tipo_residuo: string | null;
  via_eliminacion: string | null;
  parametro: string;
  valor: number;
  unidad: string;
  autoridad: string | null;
  condicion_aplicacion: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
};

type FormState = {
  jurisdiccion: string;
  documento_fuente: string;
  version: string;
  fecha_vigencia_desde: string;
  fecha_vigencia_hasta: string;
  radionuclide_code: string;
  tipo_residuo: string;
  via_eliminacion: string;
  parametro: string;
  valor: string;
  unidad: string;
  autoridad: string;
  condicion_aplicacion: string;
  notes: string;
};

const EMPTY: FormState = {
  jurisdiccion: "Chile",
  documento_fuente: "",
  version: "",
  fecha_vigencia_desde: "",
  fecha_vigencia_hasta: "",
  radionuclide_code: "",
  tipo_residuo: "",
  via_eliminacion: "",
  parametro: "",
  valor: "",
  unidad: "",
  autoridad: "CCHEN",
  condicion_aplicacion: "",
  notes: "",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("es-CL"); } catch { return d; }
}

export function WasteReleaseCriteriaApp() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(false);
  const [soloActivos, setSoloActivos] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setLoading(true);
    const url = `/api/waste-release-criteria?active=${soloActivos}`;
    fetch(url)
      .then(r => r.json())
      .then(data => setCriteria(data.criteria ?? []))
      .catch(() => setCriteria([]))
      .finally(() => setLoading(false));
  }, [soloActivos, version]);

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  }

  async function save() {
    setError(null);
    if (!form.documento_fuente.trim() || !form.parametro.trim() || !form.valor || !form.unidad.trim()) {
      setError("Documento fuente, parámetro, valor y unidad son obligatorios.");
      return;
    }
    const valorNum = Number(form.valor);
    if (!Number.isFinite(valorNum)) {
      setError("El valor debe ser un número válido.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/waste-release-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jurisdiccion: form.jurisdiccion || "Chile",
          documento_fuente: form.documento_fuente.trim(),
          version: form.version || null,
          fecha_vigencia_desde: form.fecha_vigencia_desde || null,
          fecha_vigencia_hasta: form.fecha_vigencia_hasta || null,
          radionuclide_code: form.radionuclide_code || null,
          tipo_residuo: form.tipo_residuo || null,
          via_eliminacion: form.via_eliminacion || null,
          parametro: form.parametro.trim(),
          valor: valorNum,
          unidad: form.unidad.trim(),
          autoridad: form.autoridad || null,
          condicion_aplicacion: form.condicion_aplicacion || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al guardar."); setSaving(false); return; }
      setModalOpen(false);
      setSaving(false);
      setVersion(v => v + 1);
    } catch {
      setError("Error de red al guardar.");
      setSaving(false);
    }
  }

  async function toggleActive(c: Criterion) {
    await fetch("/api/waste-release-criteria", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    });
    setVersion(v => v + 1);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Criterios de Liberación / Dispensa de Residuos Radiactivos
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Catálogo configurable de umbrales de liberación (dispensa) de residuos radiactivos al ambiente,
            organizado por jurisdicción, documento normativo, radionúclido y vía de eliminación.{" "}
            <strong>Distintos de los criterios de control de contaminación superficial.</strong>{" "}
            Ningún valor se codifica en fórmulas; todos provienen de este catálogo. (Secciones 27-28 SPRM).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoloActivos(a => !a)}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {soloActivos ? "Ver todos" : "Solo activos"}
          </button>
          <button
            onClick={() => setVersion(v => v + 1)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <RefreshCcw className="h-4 w-4" /> Actualizar
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nuevo criterio
          </button>
        </div>
      </div>

      {/* Normative alert */}
      <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span>
          Estos criterios corresponden a los límites bajo los cuales un residuo radiactivo puede{" "}
          <strong>liberarse al ambiente sin restricción radiológica</strong> (dispensa). No confundir con
          los criterios de control de contaminación superficial (tabla separada). Fuentes principales: IAEA
          GSR Part 5, IAEA SSG-45, DS 133/1984 MINSAL y guías CCHEN vigentes.
        </span>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-muted/40">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Documento fuente</th>
              <th className="px-3 py-2 font-medium">Versión</th>
              <th className="px-3 py-2 font-medium">Jurisdicción</th>
              <th className="px-3 py-2 font-medium">Radionúclido</th>
              <th className="px-3 py-2 font-medium">Tipo residuo</th>
              <th className="px-3 py-2 font-medium">Vía eliminación</th>
              <th className="px-3 py-2 font-medium">Parámetro</th>
              <th className="px-3 py-2 font-medium text-right">Valor</th>
              <th className="px-3 py-2 font-medium">Unidad</th>
              <th className="px-3 py-2 font-medium">Autoridad</th>
              <th className="px-3 py-2 font-medium">Vigencia</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-xs text-muted-foreground">Cargando...</td>
              </tr>
            ) : criteria.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Sin criterios registrados. Agregue los valores de la normativa vigente (IAEA GSR Part 5, DS 133/1984).
                </td>
              </tr>
            ) : (
              criteria.map(c => (
                <tr key={c.id} className={`border-t border-border ${!c.active ? "opacity-50" : ""}`}>
                  <td className="max-w-[180px] truncate px-3 py-2" title={c.documento_fuente}>{c.documento_fuente}</td>
                  <td className="px-3 py-2">{c.version ?? "—"}</td>
                  <td className="px-3 py-2">{c.jurisdiccion}</td>
                  <td className="px-3 py-2 font-mono">{c.radionuclide_code ?? "Todos"}</td>
                  <td className="px-3 py-2">{c.tipo_residuo ?? "Todos"}</td>
                  <td className="px-3 py-2">{c.via_eliminacion ?? "—"}</td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-medium" title={c.parametro}>{c.parametro}</td>
                  <td className="px-3 py-2 text-right font-mono">{c.valor}</td>
                  <td className="px-3 py-2">{c.unidad}</td>
                  <td className="px-3 py-2">{c.autoridad ?? "—"}</td>
                  <td className="px-3 py-2 text-[10px]">
                    {c.fecha_vigencia_desde ? fmtDate(c.fecha_vigencia_desde) : "—"}
                    {c.fecha_vigencia_hasta ? ` → ${fmtDate(c.fecha_vigencia_hasta)}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${c.active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500"}`}>
                      {c.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleActive(c)}
                      className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
                    >
                      {c.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New criterion modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Nuevo criterio de liberación / dispensa</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </div>
            )}

            <div className="mb-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Registra únicamente valores ya publicados en la fuente oficial citada. No calcule ni estime valores.
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={FIELD}>Documento fuente *</label>
                <input className={INPUT} placeholder="Ej: IAEA GSR Part 5, DS 133/1984" value={form.documento_fuente} onChange={e => set("documento_fuente", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Versión / Edición</label>
                <input className={INPUT} placeholder="Ej: 2014, Rev.1" value={form.version} onChange={e => set("version", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Jurisdicción</label>
                <input className={INPUT} placeholder="Chile" value={form.jurisdiccion} onChange={e => set("jurisdiccion", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Autoridad reguladora</label>
                <input className={INPUT} placeholder="CCHEN, MINSAL, IAEA..." value={form.autoridad} onChange={e => set("autoridad", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Radionúclido (vacío = todos)</label>
                <input className={INPUT} placeholder="Ej: I-131, Tc-99m" value={form.radionuclide_code} onChange={e => set("radionuclide_code", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Tipo de residuo (vacío = todos)</label>
                <input className={INPUT} placeholder="liquido, solido, gaseoso..." value={form.tipo_residuo} onChange={e => set("tipo_residuo", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Vía de eliminación</label>
                <input className={INPUT} placeholder="alcantarillado, incineración, DF..." value={form.via_eliminacion} onChange={e => set("via_eliminacion", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Parámetro *</label>
                <input className={INPUT} placeholder="Ej: actividad_total_MBq, actividad_bq_por_g" value={form.parametro} onChange={e => set("parametro", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Valor * (numérico)</label>
                <input className={INPUT} type="number" step="any" placeholder="Ej: 400" value={form.valor} onChange={e => set("valor", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Unidad *</label>
                <input className={INPUT} placeholder="MBq, Bq/g, µSv/h, etc." value={form.unidad} onChange={e => set("unidad", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Vigencia desde</label>
                <input className={INPUT} type="date" value={form.fecha_vigencia_desde} onChange={e => set("fecha_vigencia_desde", e.target.value)} />
              </div>
              <div>
                <label className={FIELD}>Vigencia hasta (vacío = sin vencimiento)</label>
                <input className={INPUT} type="date" value={form.fecha_vigencia_hasta} onChange={e => set("fecha_vigencia_hasta", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD}>Condición de aplicación</label>
                <input className={INPUT} placeholder="Ej: Solo si no hay otra patología concomitante, en ausencia de tratamiento crónico..." value={form.condicion_aplicacion} onChange={e => set("condicion_aplicacion", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD}>Notas</label>
                <textarea rows={2} className={INPUT} placeholder="Contexto adicional, referencia a artículo específico, etc." value={form.notes} onChange={e => set("notes", e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-accent px-4 py-1.5 text-sm text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar criterio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
