"use client";

import { useState, useEffect } from "react";

/**
 * MODULO 2 - SPECT - ARQUITECTURA
 * Gestion de evidencia grafica y documental por equipo / prueba.
 * Solo almacena referencias (URL); no sube archivos directamente.
 */

type Equipment = {
  id: number;
  manufacturer: string | null;
  model: string | null;
  internal_code: string | null;
};

type TestRow = {
  id: number;
  test_type: string;
  test_date: string;
};

type EvidenceRecord = {
  id: number;
  equipment_id: number | null;
  test_id: number | null;
  evidence_type: string;
  file_name: string | null;
  file_url: string;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

const EVIDENCE_TYPES: { value: string; label: string }[] = [
  { value: "foto_equipo", label: "Foto del equipo" },
  { value: "captura_pantalla", label: "Captura de pantalla" },
  { value: "certificado_fuente", label: "Certificado de fuente" },
  { value: "informe_calibracion", label: "Informe de calibración" },
  { value: "orden_trabajo", label: "Orden de trabajo" },
  { value: "otro", label: "Otro" },
];

function eqLabel(eq: Equipment): string {
  return `${eq.manufacturer ?? ""} ${eq.model ?? ""} (${eq.internal_code ?? "s/código"})`.trim();
}

const emptyForm = {
  evidence_type: "foto_equipo",
  file_url: "",
  file_name: "",
  description: "",
  uploaded_by: "",
};

export default function SpectEvidenceApp({
  equipment,
}: {
  equipment: Equipment[];
}) {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [testId, setTestId] = useState<number | "">("");
  const [tests, setTests] = useState<TestRow[]>([]);
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load tests for selected equipment
  useEffect(() => {
    if (!equipmentId) { setTests([]); setTestId(""); return; }
    fetch(`/api/quality-control/spect/tests?equipmentId=${equipmentId}`)
      .then(r => r.json())
      .then(d => setTests(Array.isArray(d) ? d : []))
      .catch(() => setTests([]));
  }, [equipmentId]);

  async function loadEvidence() {
    setLoading(true);
    setMessage(null);
    try {
      const qs = new URLSearchParams();
      if (equipmentId) qs.set("equipmentId", String(equipmentId));
      if (testId) qs.set("testId", String(testId));
      const res = await fetch("/api/quality-control/spect/evidence?" + qs);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Error al cargar evidencia.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.file_url.trim()) {
      setMessage("La URL del archivo es obligatoria.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/quality-control/spect/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipmentId || null,
          test_id: testId || null,
          evidence_type: form.evidence_type,
          file_url: form.file_url.trim(),
          file_name: form.file_name.trim() || null,
          description: form.description.trim() || null,
          uploaded_by: form.uploaded_by.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("Evidencia registrada correctamente.");
      setForm(emptyForm);
      setShowForm(false);
      await loadEvidence();
    } catch (err) {
      setMessage(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  function upd<K extends keyof typeof emptyForm>(key: K, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  const inputCls = "w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-0.5";

  return (
    <div className="mx-auto max-w-[1400px] p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Evidencia Gráfica y Documental — SPECT</h1>
        <p className="text-xs text-muted-foreground">
          Registro de referencias a archivos de evidencia (fotos, capturas, certificados, informes).
          El sistema almacena la URL de acceso; los archivos deben estar en el repositorio documental del servicio.
        </p>
      </div>

      {/* Filter panel */}
      <div className="rounded-lg border border-border p-4 space-y-3 bg-surface">
        <h2 className="text-sm font-semibold">Filtrar evidencia</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Equipo</label>
            <select
              className={inputCls}
              value={equipmentId}
              onChange={e => { setEquipmentId(e.target.value ? Number(e.target.value) : ""); setTestId(""); }}
            >
              <option value="">Todos los equipos</option>
              {equipment.map(eq => <option key={eq.id} value={eq.id}>{eqLabel(eq)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Prueba asociada</label>
            <select
              className={inputCls}
              value={testId}
              onChange={e => setTestId(e.target.value ? Number(e.target.value) : "")}
              disabled={!equipmentId}
            >
              <option value="">Todas las pruebas</option>
              {tests.map(t => (
                <option key={t.id} value={t.id}>
                  {t.test_date?.slice(0, 10)} — {t.test_type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={loadEvidence}
              disabled={loading}
              className="w-full rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? "Cargando..." : "Consultar evidencia"}
            </button>
          </div>
        </div>
        {message && (
          <span className={`text-xs ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {message}
          </span>
        )}
      </div>

      {/* Register button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="rounded border border-border px-4 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          {showForm ? "Cancelar" : "Registrar nueva evidencia"}
        </button>
      </div>

      {/* New evidence form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 space-y-3 bg-surface">
          <h2 className="text-sm font-semibold">Registrar evidencia</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelCls}>Equipo</label>
              <select
                className={inputCls}
                value={equipmentId}
                onChange={e => { setEquipmentId(e.target.value ? Number(e.target.value) : ""); setTestId(""); }}
              >
                <option value="">Sin equipo específico</option>
                {equipment.map(eq => <option key={eq.id} value={eq.id}>{eqLabel(eq)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Prueba asociada (opcional)</label>
              <select
                className={inputCls}
                value={testId}
                onChange={e => setTestId(e.target.value ? Number(e.target.value) : "")}
                disabled={!equipmentId}
              >
                <option value="">Sin prueba específica</option>
                {tests.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.test_date?.slice(0, 10)} — {t.test_type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tipo de evidencia</label>
              <select className={inputCls} value={form.evidence_type} onChange={e => upd("evidence_type", e.target.value)}>
                {EVIDENCE_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>URL del archivo <span className="text-red-500">*</span></label>
              <input
                className={inputCls}
                placeholder="https://docs.example.com/evidencia/spect-001.jpg"
                value={form.file_url}
                onChange={e => upd("file_url", e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Nombre del archivo</label>
              <input
                className={inputCls}
                placeholder="spect-uniformidad-001.jpg"
                value={form.file_name}
                onChange={e => upd("file_name", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Descripción</label>
              <input
                className={inputCls}
                placeholder="ej. Imagen de reconstrucción SPECT phantom Jaszczak"
                value={form.description}
                onChange={e => upd("description", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Subido por</label>
              <input
                className={inputCls}
                value={form.uploaded_by}
                onChange={e => upd("uploaded_by", e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar evidencia"}
          </button>
        </form>
      )}

      {/* Records list */}
      <div className="rounded-lg border border-border p-4 bg-surface">
        <h2 className="text-sm font-semibold mb-3">Evidencia registrada</h2>
        {records.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin registros. Use los filtros y "Consultar evidencia" para cargar, o registre nueva evidencia.
          </p>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <div key={r.id} className="rounded border border-border p-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    {EVIDENCE_TYPES.find(et => et.value === r.evidence_type)?.label ?? r.evidence_type}
                  </span>
                  <a
                    href={r.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline underline-offset-2 hover:opacity-80"
                  >
                    {r.file_name ?? r.file_url}
                  </a>
                  <span className="text-muted-foreground ml-auto">{r.uploaded_at?.slice(0, 10)}</span>
                </div>
                {r.description && <p className="text-muted-foreground">{r.description}</p>}
                {r.uploaded_by && <p className="text-muted-foreground">Subido por: {r.uploaded_by}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
