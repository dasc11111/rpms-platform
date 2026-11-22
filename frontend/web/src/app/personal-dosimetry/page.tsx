"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, ChevronDown, ChevronUp, Plus, X, AlertTriangle,
  Users, TrendingUp, Shield, Calendar, FileText, Radiation
} from "lucide-react";

type AlertLevel = "normal" | "caution" | "warning" | "exceeded";

interface Worker {
  id: number;
  worker_code: string;
  full_name: string;
  rut: string;
  role: string;
  service: string;
  category: string;
  dosimeter_type: string;
  dosimeter_number: string;
  year: number;
  total_hp10_msv: number;
  total_hp007_msv: number;
  total_effective_msv: number;
  limit_hp10_msv: number;
  limit_hp007_msv: number;
  limit_effective_msv: number;
  percent_hp10: number;
  percent_hp007: number;
  percent_effective: number;
  alert_level: AlertLevel;
  record_count: number;
  last_read_date: string;
}

interface DoseRecord {
  id: number;
  worker_id: number;
  period_year: number;
  period_month: number;
  period_type: string;
  hp10_msv: number;
  hp007_msv: number;
  effective_dose_msv: number;
  read_date: string;
  read_by: string;
  dosimeter_id: string;
  status: string;
  anomaly: string;
  notes: string;
}

interface Stats {
  total_workers: number;
  warning_count: number;
  caution_count: number;
  exceeded_count: number;
  normal_count: number;
  avg_hp10: number;
  max_hp10: number;
  near_limit: number;
}

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function AlertBadge({ level }: { level: AlertLevel }) {
  const cfg = {
    normal: { cls: "bg-green-100 text-green-800 border border-green-200", label: "Normal" },
    caution: { cls: "bg-yellow-100 text-yellow-800 border border-yellow-200", label: "Precaución" },
    warning: { cls: "bg-orange-100 text-orange-800 border border-orange-200", label: "Alerta" },
    exceeded: { cls: "bg-red-100 text-red-800 border border-red-200", label: "Excedido" },
  }[level] || { cls: "bg-gray-100 text-gray-700 border border-gray-200", label: "Sin datos" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
  );
}

function DoseBar({ value, limit, label }: { value: number; limit: number; label: string }) {
  const pct = Math.min((value / limit) * 100, 100);
  const color = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-orange-500" : pct >= 50 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono font-semibold text-gray-800">{(value || 0).toFixed(2)} / {limit} mSv</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-xs text-gray-500 mt-0.5">{pct.toFixed(1)}% del límite</div>
    </div>
  );
}

function borderColor(level: AlertLevel) {
  if (level === "exceeded") return "border-l-red-500";
  if (level === "warning") return "border-l-orange-500";
  if (level === "caution") return "border-l-yellow-400";
  return "border-l-green-400";
}

function WorkerCard({ w, onEdit }: { w: Worker; onEdit: (w: Worker) => void }) {
  const [open, setOpen] = useState(w.alert_level === "warning" || w.alert_level === "exceeded");
  const [records, setRecords] = useState<DoseRecord[]>([]);
  const [showRecords, setShowRecords] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recForm, setRecForm] = useState({ period_month: "", hp10_msv: "", hp007_msv: "", effective_dose_msv: "", read_date: "", read_by: "", dosimeter_id: w.dosimeter_number || "", status: "validated", anomaly: "", notes: "" });

  const loadRecords = useCallback(async () => {
    const r = await fetch(`/api/personal-dosimetry?worker_id=${w.id}&year=${w.year || 2024}`);
    const data = await r.json();
    setRecords(data.records || []);
  }, [w.id, w.year]);

  const toggleRecords = async () => {
    if (!showRecords && records.length === 0) await loadRecords();
    setShowRecords(v => !v);
  };

  const saveRecord = async () => {
    await fetch("/api/personal-dosimetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _type: "record", worker_id: w.id, period_year: w.year || 2024, period_month: parseInt(recForm.period_month), period_type: "monthly", hp10_msv: parseFloat(recForm.hp10_msv) || null, hp007_msv: parseFloat(recForm.hp007_msv) || null, effective_dose_msv: parseFloat(recForm.effective_dose_msv) || null, read_date: recForm.read_date, read_by: recForm.read_by, dosimeter_id: recForm.dosimeter_id, status: recForm.status, anomaly: recForm.anomaly, notes: recForm.notes }),
    });
    setShowAddRecord(false);
    setRecForm(f => ({ ...f, period_month: "", hp10_msv: "", hp007_msv: "", effective_dose_msv: "" }));
    await loadRecords();
  };

  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor(w.alert_level)} shadow-sm mb-3 overflow-hidden`}>
      <div className="px-4 py-3 flex items-start justify-between cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{w.full_name}</span>
            <AlertBadge level={w.alert_level} />
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono">Cat.{w.category}</span>
            <span className="text-xs text-gray-400 uppercase">{w.dosimeter_type}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span>{w.role}</span>
            <span className="text-gray-300">|</span>
            <span>{w.service}</span>
            <span className="text-gray-300">|</span>
            <span className="font-mono">{w.worker_code}</span>
            {w.last_read_date && (
              <>
                <span className="text-gray-300">|</span>
                <span>Última lectura: {new Date(w.last_read_date).toLocaleDateString("es-CL")}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <div className="text-right">
            <div className="text-xs text-gray-500">Hp(10)</div>
            <div className={`text-sm font-bold font-mono ${(w.percent_hp10 || 0) >= 75 ? "text-orange-600" : "text-gray-800"}`}>
              {(w.total_hp10_msv || 0).toFixed(2)} mSv
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 space-y-1">
            <DoseBar value={w.total_hp10_msv} limit={w.limit_hp10_msv || 20} label="Hp(10) — Dosis efectiva cuerpo entero" />
            <DoseBar value={w.total_hp007_msv} limit={w.limit_hp007_msv || 500} label="Hp(0.07) — Dosis equivalente piel/extremidades" />
            {w.total_effective_msv !== w.total_hp10_msv && (
              <DoseBar value={w.total_effective_msv} limit={w.limit_effective_msv || 20} label="Dosis efectiva (calculada)" />
            )}
          </div>

          {/* ICRP limits reminder */}
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
            Límites ICRP 103 · DS N°3/1985 Art. 25: Hp(10) ≤ 20 mSv/año promedio 5 años | Hp(0.07) ≤ 500 mSv/año
          </div>

          {/* Dosimeter info */}
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <span className="text-gray-500">Dosímetro</span>
              <div className="font-mono font-semibold text-gray-800">{w.dosimeter_number || "—"}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <span className="text-gray-500">Registros {w.year || 2024}</span>
              <div className="font-semibold text-gray-800">{w.record_count || 0} lecturas</div>
            </div>
          </div>

          {/* Monthly records */}
          <div className="mt-3 flex gap-2">
            <button onClick={toggleRecords} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 font-medium">
              {showRecords ? "Ocultar lecturas" : "Ver lecturas mensuales"}
            </button>
            <button onClick={() => setShowAddRecord(v => !v)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Registrar lectura
            </button>
            <button onClick={() => onEdit(w)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 font-medium">
              Editar trabajador
            </button>
          </div>

          {showAddRecord && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-green-800 mb-2">Nueva lectura dosimétrica</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-gray-600">Mes</label>
                  <select className="w-full border rounded p-1 mt-0.5" value={recForm.period_month} onChange={e => setRecForm(f => ({ ...f, period_month: e.target.value }))}>
                    <option value="">Seleccionar</option>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-600">Fecha lectura</label>
                  <input type="date" className="w-full border rounded p-1 mt-0.5" value={recForm.read_date} onChange={e => setRecForm(f => ({ ...f, read_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Hp(10) mSv</label>
                  <input type="number" step="0.001" className="w-full border rounded p-1 mt-0.5 font-mono" placeholder="0.000" value={recForm.hp10_msv} onChange={e => setRecForm(f => ({ ...f, hp10_msv: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Hp(0.07) mSv</label>
                  <input type="number" step="0.001" className="w-full border rounded p-1 mt-0.5 font-mono" placeholder="0.000" value={recForm.hp007_msv} onChange={e => setRecForm(f => ({ ...f, hp007_msv: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Leído por</label>
                  <input className="w-full border rounded p-1 mt-0.5" placeholder="Lab / Institución" value={recForm.read_by} onChange={e => setRecForm(f => ({ ...f, read_by: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600">Estado</label>
                  <select className="w-full border rounded p-1 mt-0.5" value={recForm.status} onChange={e => setRecForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pending">Pendiente</option>
                    <option value="read">Leído</option>
                    <option value="validated">Validado</option>
                    <option value="reported">Reportado</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-gray-600">Anomalía / Nota</label>
                  <input className="w-full border rounded p-1 mt-0.5" placeholder="Observaciones..." value={recForm.anomaly} onChange={e => setRecForm(f => ({ ...f, anomaly: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={saveRecord} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 font-medium">Guardar</button>
                <button onClick={() => setShowAddRecord(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300">Cancelar</button>
              </div>
            </div>
          )}

          {showRecords && (
            <div className="mt-3">
              {records.length === 0 ? (
                <div className="text-xs text-gray-400 italic">Sin lecturas registradas para {w.year || 2024}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1 text-gray-500 font-medium">Mes</th>
                        <th className="text-right py-1 text-gray-500 font-medium">Hp(10) mSv</th>
                        <th className="text-right py-1 text-gray-500 font-medium">Hp(0.07) mSv</th>
                        <th className="text-left py-1 text-gray-500 font-medium">Leído</th>
                        <th className="text-left py-1 text-gray-500 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(r => (
                        <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-1 font-medium">{MONTHS[(r.period_month || 1) - 1]}</td>
                          <td className="py-1 text-right font-mono">{r.hp10_msv ? parseFloat(String(r.hp10_msv)).toFixed(3) : "—"}</td>
                          <td className="py-1 text-right font-mono">{r.hp007_msv ? parseFloat(String(r.hp007_msv)).toFixed(3) : "—"}</td>
                          <td className="py-1 text-gray-500">{r.read_date ? new Date(r.read_date).toLocaleDateString("es-CL") : "—"}</td>
                          <td className="py-1">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${r.status === "validated" ? "bg-green-100 text-green-700" : r.status === "reported" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                              {r.status === "validated" ? "Validado" : r.status === "reported" ? "Reportado" : r.status === "read" ? "Leído" : "Pendiente"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkerModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ full_name: "", rut: "", role: "", service: "", category: "A", dosimeter_type: "tld", dosimeter_number: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/personal-dosimetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Registrar trabajador expuesto</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <label className="block text-gray-600 font-medium mb-1">Nombre completo *</label>
            <input className="w-full border rounded-lg p-2" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 font-medium mb-1">RUT</label>
              <input className="w-full border rounded-lg p-2 font-mono" placeholder="12.345.678-9" value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Categoría CCHEN</label>
              <select className="w-full border rounded-lg p-2" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="A">Categoría A (&gt;6 mSv/año)</option>
                <option value="B">Categoría B (≤6 mSv/año)</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Cargo</label>
              <input className="w-full border rounded-lg p-2" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Servicio</label>
              <input className="w-full border rounded-lg p-2" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">Tipo dosímetro</label>
              <select className="w-full border rounded-lg p-2" value={form.dosimeter_type} onChange={e => setForm(f => ({ ...f, dosimeter_type: e.target.value }))}>
                <option value="tld">TLD (Termoluminiscente)</option>
                <option value="osl">OSL (Luminiscencia óptica)</option>
                <option value="film">Film badge</option>
                <option value="electronic">Dosímetro electrónico</option>
                <option value="ring">Dosímetro anular</option>
                <option value="neutron">Dosímetro neutrones</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-1">N° dosímetro</label>
              <input className="w-full border rounded-lg p-2 font-mono" placeholder="TLD-2024-XXX" value={form.dosimeter_number} onChange={e => setForm(f => ({ ...f, dosimeter_number: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-1">Notas</label>
            <textarea className="w-full border rounded-lg p-2" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
          <button onClick={save} disabled={saving || !form.full_name} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Guardando..." : "Registrar trabajador"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PersonalDosimetryPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [year, setYear] = useState(2024);
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterAlert, setFilterAlert] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (search) params.set("search", search);
    if (filterService) params.set("service", filterService);
    if (filterAlert) params.set("alert_level", filterAlert);
    const r = await fetch(`/api/personal-dosimetry?${params}`);
    const data = await r.json();
    setWorkers(data.workers || []);
    setStats(data.stats || null);
    setLoading(false);
  }, [year, search, filterService, filterAlert]);

  useEffect(() => { load(); }, [load]);

  const services = Array.from(new Set(workers.map(w => w.service).filter(Boolean)));

  const exceeded = workers.filter(w => w.alert_level === "exceeded");
  const warning = workers.filter(w => w.alert_level === "warning");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Dosimetría Personal</h1>
          </div>
          <p className="text-sm text-gray-500">Monitoreo de dosis individuales · NS-06.0 §4.4 · DS 3/1985 Art. 25 · ICRP 103</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="border rounded-lg px-3 py-2 text-sm" value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2022, 2023, 2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo trabajador
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {exceeded.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-red-800">Límite excedido: </span>
            <span className="text-red-700">{exceeded.map(w => w.full_name).join(", ")} superaron el límite anual de 20 mSv. Notificar CCHEN y suspender actividades con radiación.</span>
          </div>
        </div>
      )}
      {warning.length > 0 && exceeded.length === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-orange-800">Alerta dosis: </span>
            <span className="text-orange-700">{warning.map(w => w.full_name).join(", ")} — dosis acumulada ≥ 75% del límite anual. Revisar prácticas de trabajo y protección.</span>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500 font-medium uppercase">Trabajadores</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_workers}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stats.normal_count} dentro del límite</div>
          </div>
          <div className={`bg-white rounded-xl border p-3 shadow-sm ${stats.exceeded_count > 0 ? "border-red-300" : stats.warning_count > 0 ? "border-orange-300" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-4 h-4 ${stats.exceeded_count > 0 ? "text-red-500" : stats.warning_count > 0 ? "text-orange-500" : "text-gray-400"}`} />
              <span className="text-xs text-gray-500 font-medium uppercase">Alertas</span>
            </div>
            <div className={`text-2xl font-bold ${stats.exceeded_count > 0 ? "text-red-600" : stats.warning_count > 0 ? "text-orange-600" : "text-gray-900"}`}>
              {stats.exceeded_count + stats.warning_count}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{stats.exceeded_count} excedidos · {stats.warning_count} en alerta</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-500 font-medium uppercase">Dosis máx.</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">{parseFloat(String(stats.max_hp10 || 0)).toFixed(2)}</div>
            <div className="text-xs text-gray-400 mt-0.5">mSv Hp(10) acumulado</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-teal-500" />
              <span className="text-xs text-gray-500 font-medium uppercase">Cercanos límite</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.near_limit}</div>
            <div className="text-xs text-gray-400 mt-0.5">≥75% del límite anual</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Buscar trabajador..."
          className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterService} onChange={e => setFilterService(e.target.value)}>
          <option value="">Todos los servicios</option>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterAlert} onChange={e => setFilterAlert(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="normal">Normal</option>
          <option value="caution">Precaución (50–75%)</option>
          <option value="warning">Alerta (75–100%)</option>
          <option value="exceeded">Excedido (&gt;100%)</option>
        </select>
      </div>

      {/* Workers list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando dosimetrías...</div>
      ) : workers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No se encontraron trabajadores expuestos</div>
      ) : (
        <div>
          {workers.map(w => (
            <WorkerCard key={w.id} w={w} onEdit={() => {}} />
          ))}
        </div>
      )}

      {/* Regulatory footer */}
      <div className="mt-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        <div className="flex items-center gap-1 font-semibold mb-1">
          <FileText className="w-3.5 h-3.5" />
          Marco regulatorio ICRP 103 · DS N°3/1985 Art. 25 · NS-06.0 §4.4
        </div>
        <div className="space-y-0.5 text-blue-600">
          <div>• Categoría A: Hp(10) ≤ 20 mSv/año promedio 5 años (máx. 50 mSv en 1 año) · Hp(0.07) ≤ 500 mSv/año · Cristalino ≤ 20 mSv/año</div>
          <div>• Categoría B: trabajadores cuya dosis efectiva no excede 6 mSv/año — control dosimétrico simplificado</div>
          <div>• Situación de emergencia: notificar CCHEN si dosis efectiva &gt; 20 mSv en período único</div>
        </div>
      </div>

      {showModal && <WorkerModal onClose={() => setShowModal(false)} onSave={load} />}
    </div>
  );
}
