"use client";


import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, ChevronDown, ChevronUp, Plus, X, AlertTriangle,
  CheckCircle2, XCircle, Clock, RefreshCw, FileText, AlertCircle,
  Calendar, Beaker, Radiation, Info,
} from "lucide-react";

type LeakTestRecord = {
  id: number;
  source_code: string;
  radionuclide: string;
  source_description: string;
  equipment_name: string;
  service_area: string;
  test_date: string;
  next_test_date: string;
  test_method: string;
  wipe_location: string;
  activity_bq: number | null;
  activity_limit_bq: number;
  result: "pass" | "fail" | "inconclusive";
  performed_by: string;
  lab_name: string;
  lab_certificate_no: string;
  detector_used: string;
  background_cps: number | null;
  wipe_cps: number | null;
  notes: string;
  corrective_action: string;
  source_removed: boolean;
  cchen_notified: boolean;
  cchen_notification_date: string | null;
  schedule_status: "overdue" | "due_soon" | "ok";
  days_overdue: number | null;
  days_to_next: number | null;
};

type Stats = {
  total: number;
  failed: number;
  overdue: number;
  due_soon: number;
  compliant: number;
};

const RESULT_COLORS: Record<string, string> = {
  pass: "bg-green-100 text-green-800",
  fail: "bg-red-100 text-red-800",
  inconclusive: "bg-yellow-100 text-yellow-800",
};

const RESULT_LABELS: Record<string, string> = {
  pass: "Conforme",
  fail: "No Conforme",
  inconclusive: "Inconcluso",
};

const METHOD_LABELS: Record<string, string> = {
  wipe_test: "Wipe Test",
  immersion: "Inmersión",
  emanation: "Emanación de gas",
  direct_measurement: "Medición directa",
};

function ResultBadge({ result }: { result: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[result] || "bg-muted text-foreground/80"}`}>
      {result === "pass" && <CheckCircle2 className="w-3 h-3" />}
      {result === "fail" && <XCircle className="w-3 h-3" />}
      {result === "inconclusive" && <AlertCircle className="w-3 h-3" />}
      {RESULT_LABELS[result] || result}
    </span>
  );
}

function ScheduleBadge({ status, daysOverdue, daysToNext }: {
  status: string; daysOverdue: number | null; daysToNext: number | null;
}) {
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
        <AlertTriangle className="w-3 h-3" />
        Vencida ({Math.abs(daysOverdue ?? 0)}d atrás)
      </span>
    );
  }
  if (status === "due_soon") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
        <Clock className="w-3 h-3" />
        Próxima en {daysToNext}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
      <CheckCircle2 className="w-3 h-3" />
      Vigente ({daysToNext}d)
    </span>
  );
}

function KPITile({ label, value, sub, color }: {
  label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-background rounded-xl border p-4 flex flex-col gap-1">
      <div className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

type FormState = {
  source_code: string; radionuclide: string; source_description: string;
  equipment_name: string; service_area: string; test_date: string;
  next_test_date: string; test_method: string; wipe_location: string;
  activity_bq: string; activity_limit_bq: string; result: string;
  performed_by: string; lab_name: string; lab_certificate_no: string;
  detector_used: string; background_cps: string; wipe_cps: string;
  notes: string; corrective_action: string; source_removed: boolean;
  cchen_notified: boolean; cchen_notification_date: string;
};

const emptyForm: FormState = {
  source_code: "", radionuclide: "", source_description: "", equipment_name: "",
  service_area: "", test_date: new Date().toISOString().slice(0, 10),
  next_test_date: "", test_method: "wipe_test", wipe_location: "",
  activity_bq: "", activity_limit_bq: "185", result: "pass",
  performed_by: "", lab_name: "", lab_certificate_no: "", detector_used: "",
  background_cps: "", wipe_cps: "", notes: "", corrective_action: "",
  source_removed: false, cchen_notified: false, cchen_notification_date: "",
};

function NewTestModal({ onClose, onSave }: {
  onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.source_code || !form.radionuclide || !form.test_date || !form.result) {
      setError("Código fuente, radionúclido, fecha y resultado son requeridos.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/leak-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          activity_bq: form.activity_bq ? parseFloat(form.activity_bq) : null,
          activity_limit_bq: parseFloat(form.activity_limit_bq) || 185,
          background_cps: form.background_cps ? parseFloat(form.background_cps) : null,
          wipe_cps: form.wipe_cps ? parseFloat(form.wipe_cps) : null,
          next_test_date: form.next_test_date || null,
          cchen_notification_date: form.cchen_notification_date || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        setError(e.error || "Error al guardar");
        return;
      }
      onSave();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Beaker className="w-5 h-5 text-blue-600" /> Nueva Prueba de Estanqueidad
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {/* Identificación de la fuente */}
          <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">
            Identificación de la Fuente
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Código Fuente *</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.source_code}
              onChange={e => set("source_code", e.target.value)} placeholder="SN-001" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Radionúclido *</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.radionuclide}
              onChange={e => set("radionuclide", e.target.value)} placeholder="Co-57, Cs-137, Am-241…" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Descripción de la Fuente</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.source_description}
              onChange={e => set("source_description", e.target.value)} placeholder="Fuente sellada para calibración…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Equipo / Dispositivo</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.equipment_name}
              onChange={e => set("equipment_name", e.target.value)} placeholder="Gamma Camera, Dose Calibrator…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Servicio / Área</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.service_area}
              onChange={e => set("service_area", e.target.value)} placeholder="Medicina Nuclear, Radioterapia…" />
          </div>

          {/* Datos de la prueba */}
          <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">
            Datos de la Prueba
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fecha Prueba *</label>
            <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.test_date} onChange={e => set("test_date", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Próxima Prueba</label>
            <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.next_test_date} onChange={e => set("next_test_date", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-0.5">Auto: 6 meses si se deja en blanco</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Método</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.test_method} onChange={e => set("test_method", e.target.value)}>
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ubicación del Paño</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.wipe_location}
              onChange={e => set("wipe_location", e.target.value)} placeholder="Superficie del colimador…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Actividad Medida (Bq)</label>
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.activity_bq} onChange={e => set("activity_bq", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Límite de Acción (Bq)</label>
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.activity_limit_bq} onChange={e => set("activity_limit_bq", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-0.5">Default 185 Bq (IAEA RS-G-1.5)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fondo / Background (cps)</label>
            <input type="number" step="0.1" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.background_cps} onChange={e => set("background_cps", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Lectura Paño (cps)</label>
            <input type="number" step="0.1" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.wipe_cps} onChange={e => set("wipe_cps", e.target.value)} />
          </div>

          {/* Resultado */}
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Resultado *</label>
            <div className="mt-1 flex gap-3">
              {Object.entries(RESULT_LABELS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="result" value={k} checked={form.result === k}
                    onChange={() => set("result", k)} />
                  <span className="text-sm">{v}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Personal y laboratorio */}
          <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">
            Personal y Laboratorio
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Realizado por</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.performed_by}
              onChange={e => set("performed_by", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Detector utilizado</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.detector_used}
              onChange={e => set("detector_used", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Laboratorio externo</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.lab_name}
              onChange={e => set("lab_name", e.target.value)} placeholder="Lab. CCHEN, LNMRI…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">N° Certificado Lab.</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={form.lab_certificate_no}
              onChange={e => set("lab_certificate_no", e.target.value)} />
          </div>

          {/* Observaciones y acciones */}
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Observaciones</label>
            <textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" rows={2}
              value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
          {form.result === "fail" && (
            <>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Acción Correctiva</label>
                <textarea className="mt-1 w-full border rounded-lg px-3 py-2 text-sm border-red-300" rows={2}
                  value={form.corrective_action} onChange={e => set("corrective_action", e.target.value)}
                  placeholder="Retirar fuente de uso, descontaminación, notificación a CCHEN…" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="source_removed" checked={form.source_removed}
                  onChange={e => set("source_removed", e.target.checked)} />
                <label htmlFor="source_removed" className="text-sm">Fuente retirada de uso</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cchen_notified" checked={form.cchen_notified}
                  onChange={e => set("cchen_notified", e.target.checked)} />
                <label htmlFor="cchen_notified" className="text-sm">CCHEN notificada</label>
              </div>
              {form.cchen_notified && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Fecha Notificación CCHEN</label>
                  <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.cchen_notification_date}
                    onChange={e => set("cchen_notification_date", e.target.value)} />
                </div>
              )}
            </>
          )}

          {error && (
            <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="col-span-2 flex gap-3 justify-end pt-2 border-t">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted/50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {saving ? "Guardando…" : "Registrar Prueba"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestCard({ record, onUpdate }: { record: LeakTestRecord; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(
    record.result === "fail" || record.schedule_status === "overdue"
  );

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar registro de prueba ${record.source_code} (${record.test_date})?`)) return;
    await fetch("/api/leak-tests", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: record.id }),
    });
    onUpdate();
  };

  const fmtDate = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-CL") : "—";

  return (
    <div className={`bg-background rounded-xl border shadow-sm overflow-hidden ${
      record.result === "fail" ? "border-red-300" :
      record.schedule_status === "overdue" ? "border-orange-300" : ""
    }`}>
      {/* Header */}
      <button className="w-full px-5 py-4 flex items-center gap-3 hover:bg-muted/50 text-left"
        onClick={() => setExpanded(p => !p)}>
        <Radiation className="w-5 h-5 text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{record.source_code}</span>
            <span className="text-sm text-muted-foreground">{record.radionuclide}</span>
            <ResultBadge result={record.result} />
            <ScheduleBadge
              status={record.schedule_status}
              daysOverdue={record.days_overdue}
              daysToNext={record.days_to_next}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {record.equipment_name || record.source_description || "Sin descripción"}
            {record.service_area ? ` · ${record.service_area}` : ""}
          </div>
        </div>
        <div className="text-xs text-muted-foreground shrink-0 text-right">
          <div>Prueba: {fmtDate(record.test_date)}</div>
          <div>Próxima: {fmtDate(record.next_test_date)}</div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-5 py-4 bg-muted/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            <div><span className="text-muted-foreground">Método:</span> {METHOD_LABELS[record.test_method] || record.test_method}</div>
            <div><span className="text-muted-foreground">Ubicación paño:</span> {record.wipe_location || "—"}</div>
            <div><span className="text-muted-foreground">Actividad medida:</span> {record.activity_bq != null ? `${record.activity_bq.toLocaleString("es-CL")} Bq` : "—"}</div>
            <div><span className="text-muted-foreground">Límite de acción:</span> {record.activity_limit_bq} Bq</div>
            {record.background_cps != null && (
              <div><span className="text-muted-foreground">Fondo:</span> {record.background_cps} cps</div>
            )}
            {record.wipe_cps != null && (
              <div><span className="text-muted-foreground">Lectura paño:</span> {record.wipe_cps} cps</div>
            )}
            <div><span className="text-muted-foreground">Realizado por:</span> {record.performed_by || "—"}</div>
            <div><span className="text-muted-foreground">Detector:</span> {record.detector_used || "—"}</div>
            {record.lab_name && (
              <div><span className="text-muted-foreground">Laboratorio:</span> {record.lab_name}</div>
            )}
            {record.lab_certificate_no && (
              <div><span className="text-muted-foreground">Certificado:</span> {record.lab_certificate_no}</div>
            )}
          </div>

          {record.notes && (
            <div className="text-sm mb-3 p-3 bg-blue-50 rounded-lg text-blue-800">
              <span className="font-medium">Observaciones: </span>{record.notes}
            </div>
          )}

          {record.result === "fail" && (
            <div className="text-sm mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="font-medium text-red-700 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Resultado No Conforme — Acciones Requeridas
              </div>
              {record.corrective_action && (
                <div className="text-red-600"><span className="font-medium">Acción: </span>{record.corrective_action}</div>
              )}
              <div className="mt-1 flex gap-4 text-xs text-red-600">
                <span>Fuente retirada: {record.source_removed ? "✅ Sí" : "❌ No"}</span>
                <span>CCHEN notificada: {record.cchen_notified ? "✅ Sí" : "❌ No"}</span>
                {record.cchen_notification_date && (
                  <span>Fecha notif.: {fmtDate(record.cchen_notification_date)}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleDelete}
              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
              Eliminar registro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeakTestsPage() {
  const [records, setRecords] = useState<LeakTestRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, failed: 0, overdue: 0, due_soon: 0, compliant: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterResult, setFilterResult] = useState("");
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (filterResult) params.set("result", filterResult);
      const res = await fetch(`/api/leak-tests?${params}`);
      const data = await res.json();
      setRecords(data.records || []);
      setStats(data.stats || { total: 0, failed: 0, overdue: 0, due_soon: 0, compliant: 0 });
    } finally {
      setLoading(false);
    }
  }, [q, filterResult]);

  useEffect(() => { load(); }, [load]);

  const failedRecords = records.filter(r => r.result === "fail");
  const overdueRecords = records.filter(r => r.schedule_status === "overdue");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Beaker className="w-6 h-6 text-blue-600" />
            Pruebas de Estanqueidad
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Leak test de fuentes radiactivas selladas · DS 3/1985 Art. 36 · IAEA RS-G-1.5
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nueva Prueba
        </button>
      </div>

      {/* Alertas */}
      {failedRecords.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-xl flex gap-3">
          <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-red-800">
              {failedRecords.length} fuente{failedRecords.length > 1 ? "s" : ""} con resultado NO CONFORME
            </div>
            <div className="text-sm text-red-700 mt-0.5">
              Las fuentes no conformes deben retirarse de uso inmediatamente y notificarse a CCHEN.
              DS 3/1985 Art. 36 · NS-06.0 §5.3.3.
            </div>
            <div className="text-xs text-red-600 mt-1">
              {failedRecords.map(r => r.source_code).join(", ")}
            </div>
          </div>
        </div>
      )}

      {overdueRecords.length > 0 && (
        <div className="p-4 bg-orange-50 border border-orange-300 rounded-xl flex gap-3">
          <Clock className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-orange-800">
              {overdueRecords.length} prueba{overdueRecords.length > 1 ? "s" : ""} de estanqueidad VENCIDA{overdueRecords.length > 1 ? "S" : ""}
            </div>
            <div className="text-sm text-orange-700 mt-0.5">
              La periodicidad máxima es 6 meses para fuentes en uso activo (IAEA RS-G-1.5).
              Programar con urgencia.
            </div>
            <div className="text-xs text-orange-600 mt-1">
              {overdueRecords.map(r => r.source_code).join(", ")}
            </div>
          </div>
        </div>
      )}

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KPITile label="Total fuentes" value={stats.total} />
        <KPITile label="No Conformes" value={stats.failed}
          color={stats.failed > 0 ? "text-red-600" : "text-foreground"} sub="Resultado FAIL" />
        <KPITile label="Pruebas vencidas" value={stats.overdue}
          color={stats.overdue > 0 ? "text-red-600" : "text-foreground"} />
        <KPITile label="Próximas 30d" value={stats.due_soon}
          color={stats.due_soon > 0 ? "text-orange-600" : "text-foreground"} />
        <KPITile label="Conformes vigentes" value={stats.compliant}
          color={stats.compliant > 0 ? "text-green-600" : "text-foreground"} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          className="flex-1 min-w-48 border rounded-lg px-4 py-2 text-sm"
          placeholder="Buscar por código, radionúclido, equipo…"
          value={q} onChange={e => setQ(e.target.value)}
        />
        <select className="border rounded-lg px-3 py-2 text-sm bg-background"
          value={filterResult} onChange={e => setFilterResult(e.target.value)}>
          <option value="">Todos los resultados</option>
          <option value="pass">Conformes</option>
          <option value="fail">No Conformes</option>
          <option value="inconclusive">Inconclusos</option>
        </select>
        <button onClick={load} className="p-2 border rounded-lg hover:bg-muted/50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-500" : "text-muted-foreground"}`} />
        </button>
      </div>

      {/* Info box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
        <span>
          <strong>Límite de acción:</strong> 185 Bq (5 nCi) según IAEA Safety Guide RS-G-1.5 y DS 3/1985 Art. 36.
          Una lectura superior indica pérdida de sellado — retirar fuente de uso.
        </span>
      </div>

      {/* Lista de registros */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Sin registros de pruebas de estanqueidad</p>
          <p className="text-sm mt-1">Agregue la primera prueba con el botón superior</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <TestCard key={r.id} record={r} onUpdate={load} />
          ))}
        </div>
      )}

      {/* Footer regulatorio */}
      <div className="pt-4 border-t text-xs text-muted-foreground flex flex-wrap gap-2">
        <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> DS 3/1985 Art. 36</span>
        <span>·</span>
        <span>NS-06.0 §5.3.3</span>
        <span>·</span>
        <span>IAEA Safety Guide RS-G-1.5</span>
        <span>·</span>
        <span>IAEA Safety Reports Series No. 62</span>
        <span>·</span>
        <span>Límite: 185 Bq (5 nCi)</span>
      </div>

      {showModal && (
        <NewTestModal onClose={() => setShowModal(false)} onSave={load} />
      )}
    </div>
  );
}
