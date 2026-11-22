"use client";

export const dynamic = "force-dynamic";

// §84 — Monitoreo de Contaminación Personal
// NS-06.0 §4.5 — DS 3/1985 Art. 12

import { useEffect, useState, useCallback } from "react";
import {
  Biohazard, RefreshCw, Plus, AlertTriangle, CheckCircle, XCircle,
  Clock, User, MapPin, Filter, ChevronDown, ChevronUp, Calendar,
  TrendingUp, Info, Search, Shield
} from "lucide-react";

const API = "/api/personal-contamination";

type Check = {
  id: number;
  check_date: string;
  check_time: string | null;
  worker_name: string;
  worker_role: string | null;
  area_origin: string | null;
  instrument_used: string | null;
  hands_result: string | null;
  feet_result: string | null;
  clothing_result: string | null;
  body_result: string | null;
  unit: string;
  background_level: string | null;
  result: string;
  action_taken: string | null;
  decontamination: string | null;
  follow_up: string | null;
  notes: string | null;
  inspector: string | null;
};

type WorkerStat = {
  worker_name: string;
  total: number;
  clear: number;
  elevated: number;
  contaminated: number;
  last_check: string;
  avg_max_reading: string;
};

type Stats = {
  total: number;
  clear: number;
  elevated: number;
  contaminated: number;
  decontaminated: number;
  today: number;
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function ResultBadge({ r }: { r: string }) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    clear: { cls: "bg-green-100 text-green-700", label: "Normal", icon: <CheckCircle size={10}/> },
    elevated: { cls: "bg-yellow-100 text-yellow-700", label: "Elevado", icon: <AlertTriangle size={10}/> },
    contaminated: { cls: "bg-red-100 text-red-700", label: "CONTAMINADO", icon: <Biohazard size={10}/> },
    decontaminated: { cls: "bg-teal-100 text-teal-700", label: "Descontaminado", icon: <Shield size={10}/> },
  };
  const v = map[r] ?? { cls: "bg-slate-100 text-slate-600", label: r, icon: null };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${v.cls}`}>
      {v.icon} {v.label}
    </span>
  );
}

function ReadingChip({ label, val, bg, unit }: { label: string; val: string | null; bg: string; unit: string }) {
  if (!val) return null;
  return (
    <div className={`rounded-lg p-2 text-center ${bg}`}>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="font-bold text-slate-800 text-sm">{parseFloat(val).toFixed(0)}</p>
      <p className="text-xs text-slate-400">{unit}</p>
    </div>
  );
}

function borderColor(r: string) {
  if (r === "contaminated") return "border-red-500";
  if (r === "elevated") return "border-yellow-400";
  if (r === "decontaminated") return "border-teal-400";
  return "border-green-400";
}

function CheckCard({ check }: { check: Check }) {
  const [open, setOpen] = useState(check.result !== "clear");

  const maxReading = Math.max(
    parseFloat(check.hands_result ?? "0"),
    parseFloat(check.feet_result ?? "0"),
    parseFloat(check.clothing_result ?? "0"),
    parseFloat(check.body_result ?? "0"),
  );
  const bg = check.background_level ? parseFloat(check.background_level) : 0;
  const ratio = bg > 0 ? (maxReading / bg).toFixed(1) : null;

  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor(check.result)} shadow-sm border border-slate-100 overflow-hidden`}>
      <div className="p-4 cursor-pointer" onClick={()=>setOpen(o=>!o)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <ResultBadge r={check.result}/>
              <span className="text-xs text-slate-500">{fmt(check.check_date)}{check.check_time ? ` ${check.check_time.slice(0,5)}` : ""}</span>
            </div>
            <p className="font-medium text-slate-800 text-sm">{check.worker_name}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {check.worker_role && <span className="text-xs text-slate-400">{check.worker_role}</span>}
              {check.area_origin && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><MapPin size={10}/>{check.area_origin}</span>}
            </div>
            {/* Quick readings inline */}
            <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
              {check.hands_result && <span className="text-slate-600">Manos: <strong>{parseFloat(check.hands_result).toFixed(0)}</strong> {check.unit}</span>}
              {check.feet_result && <span className="text-slate-600">Pies: <strong>{parseFloat(check.feet_result).toFixed(0)}</strong> {check.unit}</span>}
              {check.clothing_result && <span className="text-slate-600">Ropa: <strong>{parseFloat(check.clothing_result).toFixed(0)}</strong> {check.unit}</span>}
              {ratio && <span className={`font-medium ${parseFloat(ratio) > 2 ? "text-red-600" : parseFloat(ratio) > 1.5 ? "text-yellow-600" : "text-green-600"}`}>×{ratio} fondo</span>}
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 mt-1 flex-shrink-0">
            {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Reading chips */}
          <div className="grid grid-cols-5 gap-2">
            <ReadingChip label="Manos" val={check.hands_result} bg="bg-slate-50" unit={check.unit}/>
            <ReadingChip label="Pies" val={check.feet_result} bg="bg-slate-50" unit={check.unit}/>
            <ReadingChip label="Ropa" val={check.clothing_result} bg="bg-slate-50" unit={check.unit}/>
            <ReadingChip label="Cuerpo" val={check.body_result} bg="bg-slate-50" unit={check.unit}/>
            <ReadingChip label="Fondo" val={check.background_level} bg="bg-slate-100" unit={check.unit}/>
          </div>

          {check.instrument_used && (
            <p className="text-xs text-slate-400 flex items-center gap-1"><TrendingUp size={11}/>Instrumento: {check.instrument_used}</p>
          )}

          {/* Action sections */}
          {check.action_taken && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Acción tomada</p>
              <p className="text-xs text-orange-800">{check.action_taken}</p>
            </div>
          )}
          {check.decontamination && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1"><Biohazard size={11}/> Protocolo descontaminación</p>
              <p className="text-xs text-red-800">{check.decontamination}</p>
            </div>
          )}
          {check.follow_up && (
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-teal-700 mb-1 flex items-center gap-1"><CheckCircle size={11}/> Seguimiento</p>
              <p className="text-xs text-teal-800">{check.follow_up}</p>
            </div>
          )}
          {check.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-700 mb-1">Notas</p>
              <p className="text-xs text-yellow-800">{check.notes}</p>
            </div>
          )}

          {check.inspector && (
            <p className="text-xs text-slate-400">Inspector: {check.inspector}</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Worker stats card ---
function WorkerStatCard({ ws }: { ws: WorkerStat }) {
  const pct = ws.total > 0 ? Math.round((ws.clear / ws.total) * 100) : 0;
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">{ws.worker_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">Último: {fmt(ws.last_check)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-700">{ws.total}</p>
          <p className="text-xs text-slate-400">mediciones</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-green-600">{ws.clear} normales</span>
          {ws.elevated > 0 && <span className="text-yellow-600">{ws.elevated} elevados</span>}
          {ws.contaminated > 0 && <span className="text-red-600 font-bold">{ws.contaminated} contaminados</span>}
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-400 rounded-full" style={{ width: `${pct}%` }}/>
        </div>
        <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
          <span>{pct}% normal</span>
          <span>Prom. max: {parseFloat(ws.avg_max_reading).toFixed(0)} cpm</span>
        </div>
      </div>
    </div>
  );
}

// --- New check form ---
function CheckModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    check_date: new Date().toISOString().slice(0,10), check_time: new Date().toTimeString().slice(0,5),
    worker_name: "", worker_role: "", area_origin: "", instrument_used: "Ludlum 3 (detector pancake GM)",
    hands_result: "", feet_result: "", clothing_result: "", body_result: "",
    background_level: "35", unit: "cpm", result: "clear",
    action_taken: "", decontamination: "", follow_up: "", notes: "",
    inspector: "TM. Diego Solís C.",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.worker_name.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    if (!payload.hands_result) delete payload.hands_result;
    if (!payload.feet_result) delete payload.feet_result;
    if (!payload.clothing_result) delete payload.clothing_result;
    if (!payload.body_result) delete payload.body_result;
    if (!payload.action_taken) delete payload.action_taken;
    if (!payload.decontamination) delete payload.decontamination;
    if (!payload.follow_up) delete payload.follow_up;
    if (!payload.check_time) delete payload.check_time;
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false); onSave(); onClose();
  }

  const inp = "w-full border border-slate-200 rounded px-3 py-1.5 text-sm";
  const sel = inp + " bg-white";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Biohazard size={18}/> Nueva Medición de Contaminación Personal</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle size={20}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input type="date" className={inp} value={form.check_date} onChange={e=>setForm(f=>({...f,check_date:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hora</label>
              <input type="time" className={inp} value={form.check_time} onChange={e=>setForm(f=>({...f,check_time:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Trabajador *</label>
              <input className={inp} value={form.worker_name} onChange={e=>setForm(f=>({...f,worker_name:e.target.value}))} placeholder="Nombre completo"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cargo</label>
              <input className={inp} value={form.worker_role} onChange={e=>setForm(f=>({...f,worker_role:e.target.value}))} placeholder="TM, Dr., TENS..."/>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Área de procedencia</label>
              <input className={inp} value={form.area_origin} onChange={e=>setForm(f=>({...f,area_origin:e.target.value}))} placeholder="Sala MN, Radiofarmacia, Sala I-131..."/>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Instrumento utilizado</label>
              <input className={inp} value={form.instrument_used} onChange={e=>setForm(f=>({...f,instrument_used:e.target.value}))}/>
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Lecturas (cpm)</p>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Manos</label>
              <input type="number" className={inp} value={form.hands_result} onChange={e=>setForm(f=>({...f,hands_result:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Pies</label>
              <input type="number" className={inp} value={form.feet_result} onChange={e=>setForm(f=>({...f,feet_result:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Ropa</label>
              <input type="number" className={inp} value={form.clothing_result} onChange={e=>setForm(f=>({...f,clothing_result:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cuerpo</label>
              <input type="number" className={inp} value={form.body_result} onChange={e=>setForm(f=>({...f,body_result:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fondo</label>
              <input type="number" className={inp} value={form.background_level} onChange={e=>setForm(f=>({...f,background_level:e.target.value}))}/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Resultado</label>
              <select className={sel} value={form.result} onChange={e=>setForm(f=>({...f,result:e.target.value}))}>
                <option value="clear">Normal</option>
                <option value="elevated">Elevado — requirió acción</option>
                <option value="contaminated">Contaminado — protocolo activado</option>
                <option value="decontaminated">Descontaminado exitosamente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Inspector</label>
              <input className={inp} value={form.inspector} onChange={e=>setForm(f=>({...f,inspector:e.target.value}))}/>
            </div>
          </div>

          {form.result !== "clear" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Acción tomada</label>
                <textarea className={inp} rows={2} value={form.action_taken} onChange={e=>setForm(f=>({...f,action_taken:e.target.value}))} placeholder="Pasos inmediatos realizados..."/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Protocolo descontaminación</label>
                <textarea className={inp} rows={2} value={form.decontamination} onChange={e=>setForm(f=>({...f,decontamination:e.target.value}))} placeholder="Procedimiento de descontaminación aplicado..."/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Seguimiento / Resultado post-descontaminación</label>
                <textarea className={inp} rows={2} value={form.follow_up} onChange={e=>setForm(f=>({...f,follow_up:e.target.value}))} placeholder="Lecturas post-descontaminación, acciones adicionales..."/>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas adicionales</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.worker_name.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>} Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main page ---
export default function PersonalContaminationPage() {
  const [data, setData] = useState<Check[]>([]);
  const [workerStats, setWorkerStats] = useState<WorkerStat[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [resultFilter, setResultFilter] = useState("");
  const [workerFilter, setWorkerFilter] = useState("");
  const [daysFilter, setDaysFilter] = useState("90");
  const [view, setView] = useState<"list"|"workers">("list");

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (resultFilter) sp.set("result", resultFilter);
    if (workerFilter) sp.set("worker", workerFilter);
    sp.set("days", daysFilter);
    const res = await fetch(`${API}?${sp}`);
    const json = await res.json();
    setData(json.checks ?? []);
    setWorkerStats(json.workerStats ?? []);
    setStats(json.stats ?? null);
    setLoading(false);
  }, [resultFilter, workerFilter, daysFilter]);

  useEffect(()=>{ load(); }, [load]);

  const contaminated = data.filter(c=>c.result==="contaminated");

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Biohazard size={22} className="text-orange-600"/>
              <h1 className="text-xl font-semibold text-slate-800">Contaminación Personal</h1>
            </div>
            <p className="text-sm text-slate-500">Monitoreo de contaminación corporal POE — NS-06.0 §4.5 / DS 3/1985 Art. 12</p>
          </div>
          <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 shadow-sm">
            <Plus size={16}/> Nueva medición
          </button>
        </div>

        {/* Alert */}
        {contaminated.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
            <Biohazard size={20} className="text-red-600 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="font-bold text-red-700 text-sm">⚠ {contaminated.length} evento{contaminated.length>1?"s":""} de CONTAMINACIÓN en el período</p>
              <p className="text-xs text-red-600 mt-0.5">
                {contaminated.map(c=>`${c.worker_name} (${fmt(c.check_date)})`).join("; ")}
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
              <p className="text-xs text-slate-400 mt-1">mediciones</p>
            </div>
            <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Normales</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.clear}</p>
              <p className="text-xs text-slate-400 mt-1">{stats.total>0?Math.round(stats.clear/stats.total*100):0}%</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 shadow-sm ${stats.elevated>0?"border-yellow-100":"border-slate-100"}`}>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Elevados</p>
              <p className={`text-3xl font-bold mt-1 ${stats.elevated>0?"text-yellow-600":"text-slate-800"}`}>{stats.elevated}</p>
              <p className="text-xs text-slate-400 mt-1">c/ acción</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 shadow-sm ${stats.contaminated>0?"border-red-200":"border-slate-100"}`}>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Contaminados</p>
              <p className={`text-3xl font-bold mt-1 ${stats.contaminated>0?"text-red-600":"text-slate-800"}`}>{stats.contaminated}</p>
              <p className="text-xs text-slate-400 mt-1">protocolo</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Hoy</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{stats.today}</p>
              <p className="text-xs text-slate-400 mt-1">mediciones</p>
            </div>
          </div>
        )}

        {/* View toggle + Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button onClick={()=>setView("list")} className={`px-3 py-1.5 text-sm ${view==="list"?"bg-blue-600 text-white":"text-slate-600 hover:bg-slate-50"}`}>Mediciones</button>
              <button onClick={()=>setView("workers")} className={`px-3 py-1.5 text-sm ${view==="workers"?"bg-blue-600 text-white":"text-slate-600 hover:bg-slate-50"}`}>Por Trabajador</button>
            </div>
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" value={daysFilter} onChange={e=>setDaysFilter(e.target.value)}>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="180">Últimos 6 meses</option>
              <option value="365">Último año</option>
            </select>
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" value={resultFilter} onChange={e=>setResultFilter(e.target.value)}>
              <option value="">Todos los resultados</option>
              <option value="clear">Normales</option>
              <option value="elevated">Elevados</option>
              <option value="contaminated">Contaminados</option>
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
              <input className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Nombre trabajador..." value={workerFilter} onChange={e=>setWorkerFilter(e.target.value)}/>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-3"/> Cargando mediciones...
          </div>
        ) : view === "workers" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workerStats.map(ws=><WorkerStatCard key={ws.worker_name} ws={ws}/>)}
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
            <Biohazard size={36} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">Sin mediciones registradas en el período</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(c=><CheckCard key={c.id} check={c}/>)}
          </div>
        )}

        {/* Footer */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-start gap-3">
          <Info size={16} className="text-orange-500 mt-0.5 flex-shrink-0"/>
          <div className="text-xs text-orange-700">
            <p className="font-medium mb-1">Límites de referencia — NS-06.0 §4.5 / IAEA Safety Standards</p>
            <p>Nivel de referencia para beta/gamma: 0.4 Bq/cm² (zona supervisada). En cpm: lecturas {">"} 2× fondo requieren acción. Contaminación significativa activa protocolo de descontaminación y notificación. Los eventos de contaminación deben registrarse como incidentes conforme DS 3/1985 Art. 15.</p>
          </div>
        </div>

      </div>

      {showModal && <CheckModal onClose={()=>setShowModal(false)} onSave={load}/>}
    </div>
  );
}

function XCircle({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  );
}
