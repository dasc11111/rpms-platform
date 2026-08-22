"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, RefreshCcw, X, BookOpen } from "lucide-react";
import {
  NM_REFERENCE_TYPES,
  NM_REFERENCE_ORGANIZATIONS,
  NM_REFERENCE_VERIFICATION_STATUSES,
  type NmReferenceRecord,
} from "@/lib/nm-references";

const FIELD_LABEL = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
const INPUT_CLASS =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

type FormState = {
  recordType: string;
  organization: string;
  documentTitle: string;
  documentCode: string;
  year: string;
  version: string;
  chapter: string;
  sectionRef: string;
  tableRef: string;
  radionuclide: string;
  criterionType: string;
  variableName: string;
  valueText: string;
  unit: string;
  context: string;
  officialUrl: string;
  verificationDate: string;
  verificationStatus: string;
  notes: string;
};

const EMPTY: FormState = {
  recordType: "referencia_tecnica",
  organization: "arpansa",
  documentTitle: "",
  documentCode: "",
  year: "",
  version: "",
  chapter: "",
  sectionRef: "",
  tableRef: "",
  radionuclide: "",
  criterionType: "",
  variableName: "",
  valueText: "",
  unit: "",
  context: "",
  officialUrl: "",
  verificationDate: "",
  verificationStatus: "pendiente_verificacion",
  notes: "",
};

function verificationBadge(status: string) {
  const isVerified = status === "verificado";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        isVerified ? "bg-accent-subtle text-foreground" : "bg-warning/10 text-warning"
      }`}
    >
      {isVerified ? "Verificado" : "Pendiente de verificacion"}
    </span>
  );
}

export function NmReferencesApp() {
  const [items, setItems] = useState<NmReferenceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [recordTypeFilter, setRecordTypeFilter] = useState<"todos" | "criterio_radiologico" | "referencia_tecnica">(
    "todos"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordTypeFilter, version]);

  async function load() {
    setLoading(true);
    try {
      const url =
        recordTypeFilter === "todos"
          ? "/api/nuclear-medicine/references"
          : `/api/nuclear-medicine/references?recordType=${recordTypeFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.references ?? []);
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  }

  async function submit() {
    setError(null);
    if (!form.documentTitle.trim()) {
      setError("El documento/titulo es obligatorio.");
      return;
    }
    if (!form.organization || !form.recordType) {
      setError("El tipo de registro y la organizacion son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/nuclear-medicine/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, year: form.year ? Number(form.year) : null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar el registro.");
        setSaving(false);
        return;
      }
      setSaving(false);
      setModalOpen(false);
      setVersion((v) => v + 1);
    } catch {
      setError("Error de red al guardar el registro.");
      setSaving(false);
    }
  }

  async function toggleVerification(record: NmReferenceRecord) {
    const newStatus = record.verification_status === "verificado" ? "pendiente_verificacion" : "verificado";
    await fetch(`/api/nuclear-medicine/references/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationStatus: newStatus }),
    });
    setVersion((v) => v + 1);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Referencias Tecnicas y Criterios Radiologicos (MN)</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Catalogo trazable de referencias tecnicas (ARPANSA, IAEA, ICRP) y criterios radiologicos citados por
            normativa chilena o procedimientos internos. Ningun valor es calculado ni aplicado automaticamente por
            el sistema; cada registro debe citar su fuente oficial y puede marcarse como verificado o pendiente
            de verificacion (Fase 0, reglas 17-19 y 28).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVersion((v) => v + 1)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <RefreshCcw className="h-4 w-4" /> Actualizar
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nuevo registro
          </button>
        </div>
      </div>
      <div className="mb-4 mt-4 flex gap-1 rounded-md border border-border bg-surface p-1 text-sm">
        <button
          onClick={() => setRecordTypeFilter("todos")}
          className={`flex flex-1 items-center justify-center rounded px-3 py-1.5 ${
            recordTypeFilter === "todos" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setRecordTypeFilter("criterio_radiologico")}
          className={`flex flex-1 items-center justify-center rounded px-3 py-1.5 ${
            recordTypeFilter === "criterio_radiologico" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          Criterios radiologicos
        </button>
        <button
          onClick={() => setRecordTypeFilter("referencia_tecnica")}
          className={`flex flex-1 items-center justify-center rounded px-3 py-1.5 ${
            recordTypeFilter === "referencia_tecnica" ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          Referencias tecnicas
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Organizacion</th>
              <th className="px-3 py-2">Documento</th>
              <th className="px-3 py-2">Radionuclido</th>
              <th className="px-3 py-2">Variable / Criterio</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Cargando...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Sin registros para el filtro seleccionado.
                </td>
              </tr>
            ) : (
              items.map((ref) => (
                <tr key={ref.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs">
                    {NM_REFERENCE_TYPES.find((t) => t.value === ref.record_type)?.label ?? ref.record_type}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {NM_REFERENCE_ORGANIZATIONS.find((o) => o.value === ref.organization)?.label ?? ref.organization}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-xs" title={ref.document_title}>
                    {ref.document_title}
                    {ref.document_code ? ` (${ref.document_code})` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs">{ref.radionuclide || "-"}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-xs">
                    {ref.criterion_type || ref.variable_name || "-"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {ref.value_text ? `${ref.value_text}${ref.unit ? " " + ref.unit : ""}` : "-"}
                  </td>
                  <td className="px-3 py-2">{verificationBadge(ref.verification_status)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggleVerification(ref)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      {ref.verification_status === "verificado" ? "Marcar pendiente" : "Marcar verificado"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Nuevo registro de referencia / criterio</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </div>
            )}

            <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> Registra unicamente valores ya verificados en la fuente oficial citada. No se inventan ni calculan valores en este modulo.
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={FIELD_LABEL}>Tipo de registro *</label>
                <select className={INPUT_CLASS} value={form.recordType} onChange={(e) => set("recordType", e.target.value)}>
                  {NM_REFERENCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Organizacion *</label>
                <select className={INPUT_CLASS} value={form.organization} onChange={(e) => set("organization", e.target.value)}>
                  {NM_REFERENCE_ORGANIZATIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Documento *</label>
                <input
                  className={INPUT_CLASS}
                  placeholder="Ej: ARPANSA RPS 14.2 - Radiation Protection in Nuclear Medicine"
                  value={form.documentTitle}
                  onChange={(e) => set("documentTitle", e.target.value)}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Codigo del documento</label>
                <input className={INPUT_CLASS} value={form.documentCode} onChange={(e) => set("documentCode", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Ano</label>
                <input className={INPUT_CLASS} value={form.year} onChange={(e) => set("year", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Version</label>
                <input className={INPUT_CLASS} value={form.version} onChange={(e) => set("version", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Capitulo</label>
                <input className={INPUT_CLASS} value={form.chapter} onChange={(e) => set("chapter", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Seccion</label>
                <input className={INPUT_CLASS} value={form.sectionRef} onChange={(e) => set("sectionRef", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Tabla</label>
                <input className={INPUT_CLASS} value={form.tableRef} onChange={(e) => set("tableRef", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Radionuclido (opcional)</label>
                <input className={INPUT_CLASS} value={form.radionuclide} onChange={(e) => set("radionuclide", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Tipo de criterio (si aplica)</label>
                <input
                  className={INPUT_CLASS}
                  placeholder="Ej: liberacion de sala, contaminacion superficial"
                  value={form.criterionType}
                  onChange={(e) => set("criterionType", e.target.value)}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Variable (si aplica)</label>
                <input className={INPUT_CLASS} value={form.variableName} onChange={(e) => set("variableName", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Valor citado en la fuente</label>
                <input className={INPUT_CLASS} value={form.valueText} onChange={(e) => set("valueText", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Unidad</label>
                <input className={INPUT_CLASS} value={form.unit} onChange={(e) => set("unit", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Contexto de aplicacion</label>
                <textarea
                  className={INPUT_CLASS}
                  rows={2}
                  value={form.context}
                  onChange={(e) => set("context", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>URL oficial</label>
                <input className={INPUT_CLASS} value={form.officialUrl} onChange={(e) => set("officialUrl", e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Fecha de verificacion</label>
                <input
                  type="date"
                  className={INPUT_CLASS}
                  value={form.verificationDate}
                  onChange={(e) => set("verificationDate", e.target.value)}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Estado de verificacion</label>
                <select
                  className={INPUT_CLASS}
                  value={form.verificationStatus}
                  onChange={(e) => set("verificationStatus", e.target.value)}
                >
                  {NM_REFERENCE_VERIFICATION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL}>Notas</label>
                <textarea className={INPUT_CLASS} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar registro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
