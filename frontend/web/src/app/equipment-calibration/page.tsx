"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wrench, ChevronDown, ChevronUp, Plus, X, AlertTriangle,
  CheckCircle, Clock, FileText, Activity, Calendar, Shield
} from "lucide-react";

type EquipmentType = "detector" | "dose_calibrator" | "gamma_camera" | "ionization_chamber" | "electrometer" | "contamination_monitor" | "area_monitor" | "phantom" | "other";
type EquipmentStatus = "active" | "overdue" | "out_of_service" | "decommissioned";

interface Equipment {
  id: number;
  equipment_code: string;
  name: string;
  model: string;
  manufacturer: string;
  serial_number: string;
  equipment_type: EquipmentType;
  service: string;
  location: string;
  status: EquipmentStatus;
  last_calibration_date: string;
  next_calibration_date: string;
  calibration_interval_days: number;
  last_qc_date: string;
  next_qc_date: string;
  qc_interval_days: number;
  cchen_registration: string;
  authorized_user: string;
  notes: string;
  calibration_overdue: boolean;
  qc_overdue: boolean;
  days_since_calibration: number;
  days_to_calibration: number;
  days_since_qc: number;
  days_to_qc: number;
}

interface CalRecord {
  id: number;
  record_type: string;
  record_date: string;
  performed_by: string;
  lab_or_entity: string;
  result: string;
  measured_value: number;
  expected_value: number;
  deviation_pct: number;
  calibration_factor: number;
  certificate_number: string;
  comments: string;
}

interface Stats {
  total: number;
  active: number;
  overdue_calibration: number;
  overdue_qc: number;
  calibration_due_30d: number;
  qc_due_today: number;
}

function StatusBadge({ eq }: { eq: Equipment }) {
  if (eq.status === "out_of_service") return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200">Fuera de servicio</span>;
  if (eq.status === "decommissioned") return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">Dado de baja</span>;
  if (eq.calibration_overdue) return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200">Cal. vencida</span>;
  if (eq.qc_overdue) return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">QC vencido</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-200">Activo</span>;
}

function TypeBadge({ type }: { type: EquipmentType }) {
  const cfg: Record<EquipmentType, { cls: string; label: string }> = {
    detector: { cls: "bg-blue-100 text-blue-700", label: "Detector" },
    dose_calibrator: { cls: "bg-purple-100 text-purple-700", label: "Dosis-calibrador" },
    gamma_camera: { cls: "bg-teal-100 text-teal-700", label: "Gammacámara" },
    ionization_chamber: { cls: "bg-indigo-100 text-indigo-700", label: "Cámara ioniz." },
    electrometer: { cls: "bg-cyan-100 text-cyan-700", label: "Electrómetro" },
    contamination_monitor: { cls: "bg-orange-100 text-orange-700", label: "Monitor contam." },
    area_monitor: { cls: "bg-yellow-100 text-yellow-800", label: "Monitor área" },
    phantom: { cls: "bg-gray-100 text-gray-700", label: "Fantoma" },
    other: { cls: "bg-gray-100 text-gray-700", label: "Otro" },
  };
  const c = cfg[type] || cfg.other;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.cls}`}>{c.label}</span>;
}

function ResultBadge({ result }: { result: string }) {
  if (result === "pass") return <span className="text-xs font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">✓ Aprobado</span>;
  if (result === "fail") return <span className="text-xs font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">✗ Rechazado</span>;
  if (result === "conditional") return <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">⚠ Condicional</span>;
  return <span className="text-xs text-gray-500">{result}</span>;
}

function CalibrationBar({ days, interval }: { days: number; interval: number }) {
  const pct = Math.min((days / interval) * 100, 100);
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-400" : pct >= 60 ? "bg-yellow-400" : "bg-green-500";
  return (
    <div className="mb-1">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-500">Ciclo calibración ({interval}d)</span>
        <span className={`font-mono ${pct >= 100 ? "text-red-600 font-bold" : pct >= 80 ? "text-orange-600" : "text-gray-600"}`}>{days}d / {interval}d</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function borderColor(eq: Equipment) {
  if (eq.calibration_overdue) return "border-l-red-500";
  if (eq.qc_overdue) return "border-l-orange-400";
  if (eq.days_to_calibration <= 30) return "border-l-yellow-400";
  if (eq.status === "out_of_service") return "border-l-gray-400";
  return "border-l-green-500";
}

function EquipmentCard({ eq, onEdit }: { eq: Equipment; onEdit: (eq: Equipment) => void }) {
  const [open, setOpen] = useState(eq.calibration_overdue || eq.qc_overdue);
  const [records, setRecords] = useState<CalRecord[]>([]);
  const [showRecords, setShowRecords] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recForm, setRecForm] = useState({ record_type: "daily_qc", record_date: new Date().toISOString().split("T")[0], performed_by: "", lab_or_entity: "", result: "pass", measured_value: "", expected_value: "", deviation_pct: "", calibration_factor: "", certificate_number: "", comments: "" });

  const loadRecords = useCallback(async () => {
    const r = await fetch(`/api/equipment-calibration?equipment_id=${eq.id}`);
    const data = await r.json();
    setRecords(data.records || []);
  }, [eq.id]);

  const saveRecord = async () => {
    await fetch("/api/equipment-calibration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "record", equipment_id: eq.id, ...recForm, measured_value: recForm.measured_value ? parseFloat(recForm.measured_value) : null, expected_value: recForm.expected_value ? parseFloat(recForm.expected_value) : null, deviation_pct: recForm.deviation_pct ? parseFloat(recForm.deviation_pct) : null, calibration_factor: recForm.calibration_factor ? parseFloat(recForm.calibration_factor) : null }),
    });
    setShowRecordForm(false);
    await loadRecords();
  };

  const recordTypeLabel: Record<string, string> = {
    calibration: "Calibración LMRI/CCHEN", daily_qc: "QC Diario", weekly_qc: "QC Semanal", monthly_qc: "QC Mensual",
    constancy: "Verificación constancia", acceptance: "Prueba aceptación", maintenance: "Mantenimiento", other: "Otro"
  };

  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor(eq)} shadow-sm mb-3 overflow-hidden`}>
      <div className="px-4 py-3 flex items-start justify-between cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{eq.equipment_code}</span>
            <span className="font-semibold text-gray-900 text-sm">{eq.name}</span>
            <StatusBadge eq={eq} />
            <TypeBadge type={eq.equipment_type} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
            {eq.manufacturer && <span className="text-gray-600">{eq.manufacturer} {eq.model}</span>}
            {eq.service && <><span className="text-gray-300">|</span><span>{eq.service}</span></>}
            {eq.location && <><span className="text-gray-300">|</span><span>{eq.location}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-3 ml-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-gray-500">Próx. calibración</div>
            <div className={`text-sm font-bold ${eq.calibration_overdue ? "text-red-600" : eq.days_to_calibration <= 30 ? "text-orange-600" : "text-gray-800"}`}>
              {eq.calibration_overdue ? `Vencida ${-eq.days_to_calibration}d` : `${eq.days_to_calibration}d`}
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 space-y-1">
            <CalibrationBar days={eq.days_since_calibration} interval={eq.calibration_interval_days} />
            {eq.qc_interval_days < 30 && (
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="text-gray-500">QC {eq.qc_interval_days === 1 ? "diario" : eq.qc_interval_days === 7 ? "semanal" : `cada ${eq.qc_interval_days}d`}:</span>
                <span className={`font-medium ${eq.qc_overdue ? "text-orange-600" : "text-green-600"}`}>
                  {eq.qc_overdue ? `Vencido hace ${-eq.days_to_qc}d` : `Al día · próximo en ${eq.days_to_qc}d`}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">N° serie</div>
              <div className="font-mono font-semibold text-xs">{eq.serial_number || "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Reg. CCHEN</div>
              <div className="font-mono font-semibold text-xs">{eq.cchen_registration || "N/A"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Última calibración</div>
              <div className="font-semibold">{eq.last_calibration_date ? new Date(eq.last_calibration_date).toLocaleDateString("es-CL") : "—"}</div>
            </div>
            <div className={`rounded p-2 ${eq.calibration_overdue ? "bg-red-50" : "bg-green-50"}`}>
              <div className="text-gray-500">Próxima calibración</div>
              <div className={`font-semibold ${eq.calibration_overdue ? "text-red-700" : eq.days_to_calibration <= 30 ? "text-orange-600" : "text-green-700"}`}>
                {eq.next_calibration_date ? new Date(eq.next_calibration_date).toLocaleDateString("es-CL") : "—"}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-500">Último QC</div>
              <div className="font-semibold">{eq.last_qc_date ? new Date(eq.last_qc_date).toLocaleDateString("es-CL") : "—"}</div>
            </div>
            <div className={`rounded p-2 ${eq.qc_overdue ? "bg-orange-50" : "bg-green-50"}`}>
              <div className="text-gray-500">Próximo QC</div>
              <div className={`font-semibold ${eq.qc_overdue ? "text-orange-700" : "text-green-700"}`}>
                {eq.next_qc_date ? new Date(eq.next_qc_date).toLocaleDateString("es-CL") : "—"}
              </div>
            </div>
            {eq.authorized_user && (
              <div className="col-span-2 bg-gray-50 rounded p-2">
                <div className="text-gray-500">Usuario autorizado</div>
                <div className="font-semibold">{eq.authorized_user}</div>
              </div>
            )}
          </div>

          {eq.notes && <div className="mt-2 bg-yellow-50 border border-yellow-100 rounded p-2 text-xs text-yellow-800">{eq.notes}</div>}

          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={async () => { if (!showRecords && records.length === 0) await loadRecords(); setShowRecords(v => !v); }} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 font-medium">
              {showRecords ? "Ocultar registros" : "Ver registros"}
            </button>
            <button onClick={() => setShowRecordForm(v => !v)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Registrar QC / calibración
            </button>
          </div>

          {showRecordForm && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-blue-800 mb-2">Registrar QC / calibración</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-gray-600">Tipo</label>
                  <select className="w-full border rounded p-1 mt-0.5" value={recForm.record_type} onChange={e => setRecForm(f => ({ ...f, record_type: e.target.value }))}>
                    <option value="daily_qc">QC Diario</option>
                    <option value="weekly_qc">QC Semanal</option>
                    <option value="monthly_qc">QC Mensual</option>
                    <option value="constancy">Verificación constancia</option>
                    <option value="calibration">Calibración LMRI/CCHEN</option>
                    <option value="acceptance">Prueba aceptación</option>
                    <option value="maintenance">Mantenimiento</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-600">Fecha</label>
                  <input type="date" className="w-full border rounded p-1 mt-0.5" value={recForm.record_date} onChange={e => setRecForm(f => ({ ...f, record_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Realizado por</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={recForm.performed_by} onChange={e => setRecForm(f => ({ ...f, performed_by: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Resultado</label>
                  <select className="w-full border rounded p-1 mt-0.5" value={recForm.result} onChange={e => setRecForm(f => ({ ...f, result: e.target.value }))}>
                    <option value="pass">Aprobado</option>
                    <option value="conditional">Condicional</option>
                    <option value="fail">Rechazado</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-600">Valor medido</label>
                  <input type="number" step="any" className="w-full border rounded p-1 mt-0.5 font-mono" value={recForm.measured_value} onChange={e => setRecForm(f => ({ ...f, measured_value: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Valor esperado</label>
                  <input type="number" step="any" className="w-full border rounded p-1 mt-0.5 font-mono" value={recForm.expected_value} onChange={e => setRecForm(f => ({ ...f, expected_value: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Desviación (%)</label>
                  <input type="number" step="0.01" className="w-full border rounded p-1 mt-0.5 font-mono" value={recForm.deviation_pct} onChange={e => setRecForm(f => ({ ...f, deviation_pct: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Factor calibración</label>
                  <input type="number" step="0.000001" className="w-full border rounded p-1 mt-0.5 font-mono" value={recForm.calibration_factor} onChange={e => setRecForm(f => ({ ...f, calibration_factor: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">N° Certificado</label>
                  <input className="w-full border rounded p-1 mt-0.5 font-mono" value={recForm.certificate_number} onChange={e => setRecForm(f => ({ ...f, certificate_number: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Laboratorio / Entidad</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={recForm.lab_or_entity} onChange={e => setRecForm(f => ({ ...f, lab_or_entity: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-600">Comentarios / observaciones</label>
                  <input className="w-full border rounded p-1 mt-0.5" value={recForm.comments} onChange={e => setRecForm(f => ({ ...f, comments: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={saveRecord} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Guardar</button>
                <button onClick={() => setShowRecordForm(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded">Cancelar</button>
              </div>
            </div>
          )}

          {showRecords && (
            <div className="mt-3">
              {records.length === 0 ? (
                <div className="text-xs text-gray-400 italic">Sin registros</div>
              ) : (
                <div className="space-y-1">
                  {records.map(r => (
                    <div key={r.id} className="flex flex-wrap items-start gap-2 text-xs py-1.5 border-b border-gray-100">
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">{recordTypeLabel[r.record_type] || r.record_type}</span>
                      <span className="text-gray-500">{new Date(r.record_date).toLocaleDateString("es-CL")}</span>
                      <ResultBadge result={r.result} />
                      {r.deviation_pct !== null && <span className={`font-mono ${Math.abs(parseFloat(String(r.deviation_pct))) > 2 ? "text-orange-600" : "text-gray-600"}`}>Δ {parseFloat(String(r.deviation_pct)) > 0 ? "+" : ""}{parseFloat(String(r.deviation_pct)).toFixed(2)}%</span>}
                      {r.calibration_factor && <span className="font-mono text-purple-700">kQ={parseFloat(String(r.calibration_factor)).toFixed(4)}</span>}
                      {r.certificate_number && <span className="font-mono text-xs text-blue-600">{r.certificate_number}</span>}
                      {r.performed_by && <span className="text-gray-500">({r.performed_by})</span>}
                      {r.comments && <span className="text-gray-600 italic">{r.comments}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EquipmentModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: "", model: "", manufacturer: "", serial_number: "", equipment_type: "detector", service: "", location: "", calibration_interval_days: "365", qc_interval_days: "1", cchen_registration: "", authorized_user: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/equipment-calibration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Registrar equipo de medición</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <label className="block text-gray-600 font-medium mb-1">Nombre del equipo *</label>
            <input className="w-full border rounded-lg p-2" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 font-medium mb-1">Tipo de equipo</label>
              <select className="w-full border rounded-lg p-2" value={form.equipment_type} onChange={e => setForm(f => ({ ...f, equipment_type: e.target.value }))}>
                <option value="detector">Detector GM / centellador</option>
                <option value="dose_calibrator">Dosis-calibrador</option>
                <option value="gamma_camera">Gammacámara / SPECT</option>
                <option value="ionization_chamber">Cámara de ionización</option>
                <option value="electrometer">Electrómetro</option>
                <option value="contamination_monitor">Monitor contaminación</option>
                <option value="area_monitor">Monitor de área</option>
                <option value="phantom">Fantoma / material dosimétrico</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Fabricante</label>
              <input className="w-full border rounded-lg p-2" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Modelo</label>
              <input className="w-full border rounded-lg p-2" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">N° serie</label>
              <input className="w-full border rounded-lg p-2 font-mono" value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Servicio</label>
              <input className="w-full border rounded-lg p-2" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Ubicación</label>
              <input className="w-full border rounded-lg p-2" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Intervalo calibración (días)</label>
              <input type="number" className="w-full border rounded-lg p-2 font-mono" value={form.calibration_interval_days} onChange={e => setForm(f => ({ ...f, calibration_interval_days: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Intervalo QC (días)</label>
              <input type="number" className="w-full border rounded-lg p-2 font-mono" value={form.qc_interval_days} onChange={e => setForm(f => ({ ...f, qc_interval_days: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Registro CCHEN</label>
              <input className="w-full border rounded-lg p-2 font-mono" value={form.cchen_registration} onChange={e => setForm(f => ({ ...f, cchen_registration: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Usuario autorizado</label>
              <input className="w-full border rounded-lg p-2" value={form.authorized_user} onChange={e => setForm(f => ({ ...f, authorized_user: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-gray-600 font-medium mb-1">Notas</label>
              <textarea className="w-full border rounded-lg p-2" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button onClick={save} disabled={saving || !form.name} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Guardando..." : "Registrar equipo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EquipmentCalibrationPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("equipment_type", filterType);
    const r = await fetch(`/api/equipment-calibration?${params}`);
    const data = await r.json();
    setEquipment(data.equipment || []);
    setStats(data.stats || null);
    setLoading(false);
  }, [search, filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const overdueCalibration = equipment.filter(e => e.calibration_overdue);
  const overdueQC = equipment.filter(e => e.qc_overdue && !e.calibration_overdue);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Calibración y Control de Calidad</h1>
          </div>
          <p className="text-sm text-gray-500">Equipos de medición radiológica · NS-06.0 §8 · DS 3/1985 Art. 28 · IAEA Safety Reports 16</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo equipo
        </button>
      </div>

      {/* Alert banners */}
      {overdueCalibration.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-red-800">Calibración vencida: </span>
            <span className="text-red-700">{overdueCalibration.map(e => `${e.equipment_code} ${e.name}`).join(", ")}. Equipo NO DEBE USARSE hasta recalibración per NS-06.0 §8.3.</span>
          </div>
        </div>
      )}
      {overdueQC.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <Clock className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-orange-800">QC vencido: </span>
            <span className="text-orange-700">{overdueQC.map(e => e.equipment_code).join(", ")}. Realizar prueba de control antes de usar en mediciones reguladas.</span>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-blue-500" /><span className="text-xs text-gray-500 font-medium uppercase">Total equipos</span></div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-400">{stats.active} activos</div>
          </div>
          <div className={`bg-white rounded-xl border p-3 shadow-sm ${Number(stats.overdue_calibration) > 0 ? "border-red-300" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1"><Calendar className={`w-4 h-4 ${Number(stats.overdue_calibration) > 0 ? "text-red-500" : "text-gray-400"}`} /><span className="text-xs text-gray-500 font-medium uppercase">Cal. vencida</span></div>
            <div className={`text-2xl font-bold ${Number(stats.overdue_calibration) > 0 ? "text-red-600" : "text-gray-900"}`}>{stats.overdue_calibration}</div>
            <div className="text-xs text-gray-400">{stats.calibration_due_30d} vencen en 30d</div>
          </div>
          <div className={`bg-white rounded-xl border p-3 shadow-sm ${Number(stats.overdue_qc) > 0 ? "border-orange-300" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1"><Clock className={`w-4 h-4 ${Number(stats.overdue_qc) > 0 ? "text-orange-500" : "text-gray-400"}`} /><span className="text-xs text-gray-500 font-medium uppercase">QC vencido</span></div>
            <div className={`text-2xl font-bold ${Number(stats.overdue_qc) > 0 ? "text-orange-600" : "text-gray-900"}`}>{stats.overdue_qc}</div>
            <div className="text-xs text-gray-400">{stats.qc_due_today} pendientes hoy</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-green-500" /><span className="text-xs text-gray-500 font-medium uppercase">Al día</span></div>
            <div className="text-2xl font-bold text-green-700">{Number(stats.total) - Number(stats.overdue_calibration) - Number(stats.overdue_qc)}</div>
            <div className="text-xs text-gray-400">calibración y QC vigentes</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="Buscar equipo..." className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="detector">Detector</option>
          <option value="dose_calibrator">Dosis-calibrador</option>
          <option value="gamma_camera">Gammacámara</option>
          <option value="ionization_chamber">Cámara ioniz.</option>
          <option value="electrometer">Electrómetro</option>
          <option value="contamination_monitor">Monitor contam.</option>
          <option value="area_monitor">Monitor área</option>
          <option value="phantom">Fantoma</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando equipos...</div>
      ) : equipment.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No se encontraron equipos</div>
      ) : (
        <div>{equipment.map(eq => <EquipmentCard key={eq.id} eq={eq} onEdit={() => {}} />)}</div>
      )}

      {/* Regulatory footer */}
      <div className="mt-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        <div className="flex items-center gap-1 font-semibold mb-1">
          <FileText className="w-3.5 h-3.5" />
          NS-06.0 §8 · DS N°3/1985 Art. 28 · IAEA Safety Reports No. 16 (1999) · ARCAL XLIX
        </div>
        <div className="space-y-0.5 text-blue-600">
          <div>• Calibración trazable LMRI/CCHEN obligatoria para todos los detectores utilizados en radioprotección (NS-06.0 §8.2)</div>
          <div>• Dosis-calibrador: constancia diaria ≤±2%, linealidad mensual ≤±5%, exactitud semestral ≤±5% (IAEA-TECDOC-602)</div>
          <div>• Gammacámara: QC diario sensibilidad + energía; uniformidad semanal; resolución mensual (IAEA Safety Reports 16)</div>
          <div>• Detectores área Rp: calibración anual LMRI mínimo; verificación constancia semanal con fuente de referencia</div>
          <div>• Equipo con calibración vencida NO PUEDE usarse en mediciones reguladas (NS-06.0 §8.3)</div>
          <div>• Factor corrección cámara ionización RT: actualizar con cada calibración LMRI (IAEA TRS-398 §4)</div>
        </div>
      </div>

      {showModal && <EquipmentModal onClose={() => setShowModal(false)} onSave={load} />}
    </div>
  );
}
