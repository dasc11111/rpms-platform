"use client";


// §83 — Gestión de EPP Radiológico
// NS-06.0 §4.6 — DS 3/1985 Art. 12

import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, RefreshCw, Plus, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, XCircle, Clock, Calendar, User, MapPin, Filter,
  Wrench, Eye, Zap, Edit3, Archive, Tag, Info
} from "lucide-react";

const API = "/api/ppe-radiation";

type PPEItem = {
  id: number;
  ppe_code: string;
  ppe_type: string;
  description: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  lead_equivalent: string | null;
  size_category: string | null;
  location: string | null;
  status: string;
  condition: string;
  assigned_to_name: string | null;
  assigned_date: string | null;
  purchase_date: string | null;
  expected_life_years: string | null;
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  inspection_result: string | null;
  fluoroscopy_tested: boolean;
  fluoroscopy_date: string | null;
  fluoroscopy_result: string | null;
  notes: string | null;
  days_to_inspection: number | null;
  days_to_eol: number | null;
};

type Inspection = {
  id: number;
  inspection_date: string;
  inspector: string;
  method: string;
  result: string;
  findings: string | null;
  action_taken: string | null;
  next_due: string | null;
};

type Stats = {
  total: number;
  active: number;
  in_repair: number;
  decommissioned: number;
  needs_attention: number;
  inspection_overdue: number;
  inspection_due_90d: number;
  aprons: number;
  thyroid_collars: number;
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPE_LABEL: Record<string, string> = {
  apron: "Delantal Plomado", thyroid_collar: "Protector Tiroideo",
  glasses: "Lentes Plomados", gloves: "Guantes de Plomo",
  screen: "Biombo Plomado", other: "Otro EPP",
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  apron: <ShieldAlert size={14}/>, thyroid_collar: <Tag size={14}/>,
  glasses: <Eye size={14}/>, gloves: <Zap size={14}/>,
  screen: <Filter size={14}/>, other: <ShieldAlert size={14}/>,
};

const CONDITION_LABEL: Record<string, string> = {
  excellent: "Excelente", good: "Bueno", acceptable: "Aceptable",
  needs_inspection: "Requiere inspección", damaged: "Dañado",
};

function ConditionBadge({ c }: { c: string }) {
  const map: Record<string, string> = {
    excellent: "bg-emerald-100 text-emerald-700",
    good: "bg-green-100 text-green-700",
    acceptable: "bg-yellow-100 text-yellow-700",
    needs_inspection: "bg-orange-100 text-orange-700",
    damaged: "bg-red-100 text-red-700",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[c] ?? "bg-slate-100 text-slate-600"}`}>{CONDITION_LABEL[c] ?? c}</span>;
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    in_repair: "bg-orange-100 text-orange-700",
    decommissioned: "bg-slate-100 text-slate-500",
    lost: "bg-red-100 text-red-600",
  };
  const lbl: Record<string, string> = { active: "Activo", in_repair: "En Reparación", decommissioned: "Dado de Baja", lost: "Extraviado" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[s] ?? "bg-slate-100"}`}>{lbl[s] ?? s}</span>;
}

function InspBadge({ result }: { result: string | null }) {
  if (!result) return null;
  if (result === "pass") return <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle size={10}/> Aprobado</span>;
  if (result === "conditional") return <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full"><AlertTriangle size={10}/> Condicional</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle size={10}/> Reprobado</span>;
}

function InspDueChip({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle size={11}/> Insp. vencida ({Math.abs(days)}d)</span>;
  if (days <= 30) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600"><Clock size={11}/> Insp. en {days}d</span>;
  if (days <= 90) return <span className="inline-flex items-center gap-1 text-xs text-yellow-700"><Calendar size={11}/> Insp. próxima</span>;
  return null;
}

function EolChip({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0) return <span className="text-xs text-red-500 font-semibold">Vida útil vencida</span>;
  if (days <= 180) return <span className="text-xs text-orange-500">Vida útil: {Math.round(days/30)}m</span>;
  return null;
}

function borderColor(item: PPEItem): string {
  if (item.condition === "damaged") return "border-red-500";
  if (item.status === "in_repair") return "border-orange-500";
  if (item.condition === "needs_inspection") return "border-orange-400";
  if (item.days_to_inspection !== null && item.days_to_inspection < 0) return "border-red-400";
  if (item.inspection_result === "conditional") return "border-yellow-400";
  if (item.condition === "excellent") return "border-emerald-400";
  return "border-green-300";
}

// --- Inspection Panel (lazy) ---
function InspectionPanel({ itemId }: { itemId: number }) {
  const [data, setData] = useState<Inspection[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    inspection_date: new Date().toISOString().slice(0,10), inspector: "TM. Diego Solís C.",
    method: "visual", result: "pass", findings: "", action_taken: "", next_due: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}?item_id=${itemId}`).then(r=>r.json()).then(d=>setData(d.inspections ?? []));
  }, [itemId]);

  async function saveInspection() {
    setSaving(true);
    const payload: Record<string, unknown> = { _type: "inspection", item_id: itemId, ...form };
    if (!payload.next_due) delete payload.next_due;
    await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    setSaving(false);
    setShowForm(false);
    const r = await fetch(`${API}?item_id=${itemId}`);
    const d = await r.json();
    setData(d.inspections ?? []);
  }

  const inp = "w-full border border-slate-200 rounded px-2 py-1.5 text-sm";
  const sel = inp + " bg-white";

  return (
    <div className="border-t border-slate-100 p-4 bg-slate-50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Historial de Inspecciones</p>
        <button onClick={()=>setShowForm(v=>!v)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100">
          <Plus size={11}/> Registrar inspección
        </button>
      </div>

      {showForm && (
        <div className="mb-4 border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Fecha</label>
              <input type="date" className={inp} value={form.inspection_date} onChange={e=>setForm(f=>({...f,inspection_date:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Método</label>
              <select className={sel} value={form.method} onChange={e=>setForm(f=>({...f,method:e.target.value}))}>
                <option value="visual">Visual</option>
                <option value="fluoroscopy">Fluoroscopía</option>
                <option value="both">Ambos</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Resultado</label>
              <select className={sel} value={form.result} onChange={e=>setForm(f=>({...f,result:e.target.value}))}>
                <option value="pass">Aprobado</option>
                <option value="conditional">Condicional</option>
                <option value="fail">Reprobado</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Inspector</label>
              <input className={inp} value={form.inspector} onChange={e=>setForm(f=>({...f,inspector:e.target.value}))}/>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-600 block mb-1">Hallazgos</label>
              <textarea className={inp} rows={2} value={form.findings} onChange={e=>setForm(f=>({...f,findings:e.target.value}))} placeholder="Descripción de hallazgos (Si no hay: 'Sin hallazgos')"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-600 block mb-1">Acción tomada</label>
              <input className={inp} value={form.action_taken} onChange={e=>setForm(f=>({...f,action_taken:e.target.value}))} placeholder="Acción correctiva o preventiva"/>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Próxima inspección</label>
              <input type="date" className={inp} value={form.next_due} onChange={e=>setForm(f=>({...f,next_due:e.target.value}))}/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveInspection} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <RefreshCw size={12} className="animate-spin"/> : <CheckCircle size={12}/>} Guardar
            </button>
            <button onClick={()=>setShowForm(false)} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white">Cancelar</button>
          </div>
        </div>
      )}

      {data === null ? (
        <p className="text-xs text-slate-400 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Cargando...</p>
      ) : data.length === 0 ? (
        <p className="text-xs text-slate-400">Sin inspecciones registradas</p>
      ) : (
        <div className="space-y-2">
          {data.map(insp => (
            <div key={insp.id} className="bg-white rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-slate-700">{fmt(insp.inspection_date)}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">{insp.method === "visual" ? "Visual" : insp.method === "fluoroscopy" ? "Fluoroscopía" : "Visual + Fluoroscopía"}</span>
                  <InspBadge result={insp.result}/>
                </div>
              </div>
              <p className="text-xs text-slate-600">{insp.inspector}</p>
              {insp.findings && <p className="text-xs text-slate-700 mt-1 italic">"{insp.findings}"</p>}
              {insp.action_taken && <p className="text-xs text-blue-600 mt-0.5">↳ {insp.action_taken}</p>}
              {insp.next_due && <p className="text-xs text-slate-400 mt-0.5">Próxima: {fmt(insp.next_due)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- PPE Item Card ---
function PPECard({ item, onRefresh }: { item: PPEItem; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [showInsp, setShowInsp] = useState(false);

  async function quickStatus(status: string) {
    await fetch(API, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status }) });
    onRefresh();
  }

  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor(item)} shadow-sm border border-slate-100 overflow-hidden`}>
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={()=>setOpen(o=>!o)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">{TYPE_ICON[item.ppe_type]}{TYPE_LABEL[item.ppe_type] ?? item.ppe_type}</span>
              <StatusBadge s={item.status}/>
              <ConditionBadge c={item.condition}/>
              {item.fluoroscopy_tested && <span className="text-xs text-purple-600 font-medium">📡 Fluo.</span>}
            </div>
            <p className="font-medium text-slate-800 text-sm leading-snug">{item.description}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs font-mono text-slate-400">{item.ppe_code}</span>
              {item.lead_equivalent && <span className="text-xs text-slate-500">{item.lead_equivalent} mm Pb</span>}
              {item.assigned_to_name && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><User size={10}/>{item.assigned_to_name}</span>}
              {item.location && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><MapPin size={10}/>{item.location}</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <InspDueChip days={item.days_to_inspection}/>
              <EolChip days={item.days_to_eol}/>
              <InspBadge result={item.inspection_result}/>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 mt-1 flex-shrink-0">
            {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>

        {/* Quick actions (collapsed) */}
        {!open && (
          <div className="flex gap-2 mt-3 flex-wrap" onClick={e=>e.stopPropagation()}>
            {item.status === "active" && item.condition === "damaged" && (
              <button onClick={()=>quickStatus("in_repair")} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100">
                <Wrench size={11}/> Enviar a reparación
              </button>
            )}
            {item.status === "in_repair" && (
              <button onClick={()=>quickStatus("active")} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100">
                <CheckCircle size={11}/> Retorno de reparación
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100">
          <div className="p-4 space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {item.brand && (
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">Marca / Modelo</p>
                  <p className="font-medium text-slate-700">{item.brand}{item.model ? ` / ${item.model}` : ""}</p>
                </div>
              )}
              {item.serial_number && (
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">N° Serie</p>
                  <p className="font-mono font-medium text-slate-700">{item.serial_number}</p>
                </div>
              )}
              {item.size_category && (
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400 mb-0.5">Talla</p>
                  <p className="font-medium text-slate-700">{item.size_category}</p>
                </div>
              )}
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-slate-400 mb-0.5">Fecha compra</p>
                <p className="font-medium text-slate-700">{fmt(item.purchase_date)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-slate-400 mb-0.5">Vida útil esperada</p>
                <p className="font-medium text-slate-700">{item.expected_life_years ?? "—"} años</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-slate-400 mb-0.5">Asignado a</p>
                <p className="font-medium text-slate-700">{item.assigned_to_name ?? "Sin asignar"}</p>
                {item.assigned_date && <p className="text-slate-400 mt-0.5">desde {fmt(item.assigned_date)}</p>}
              </div>
            </div>

            {/* Inspection summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className={`rounded-lg p-2 ${(item.days_to_inspection ?? 999) < 0 ? "bg-red-50" : "bg-slate-50"}`}>
                <p className="text-slate-400 mb-0.5">Última inspección</p>
                <p className="font-medium text-slate-700">{fmt(item.last_inspection_date)}</p>
                <InspBadge result={item.inspection_result}/>
              </div>
              <div className={`rounded-lg p-2 ${(item.days_to_inspection ?? 999) < 0 ? "bg-red-50" : (item.days_to_inspection ?? 999) <= 90 ? "bg-orange-50" : "bg-slate-50"}`}>
                <p className="text-slate-400 mb-0.5">Próxima inspección</p>
                <p className="font-medium text-slate-700">{fmt(item.next_inspection_date)}</p>
                <InspDueChip days={item.days_to_inspection}/>
              </div>
            </div>

            {/* Fluoroscopy */}
            {item.fluoroscopy_tested && (
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                <p className="text-xs font-medium text-purple-700 mb-1">📡 Resultado Fluoroscopía ({fmt(item.fluoroscopy_date)})</p>
                <p className="text-xs text-purple-800">{item.fluoroscopy_result ?? "—"}</p>
              </div>
            )}

            {/* Notes */}
            {item.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-medium text-yellow-700 mb-1 flex items-center gap-1"><Info size={11}/> Notas</p>
                <p className="text-xs text-yellow-800">{item.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap pt-1">
              <button onClick={()=>setShowInsp(v=>!v)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">
                <Eye size={12}/> {showInsp ? "Ocultar" : "Ver"} inspecciones
              </button>
              {item.status === "active" && (
                <button onClick={()=>quickStatus("in_repair")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100">
                  <Wrench size={12}/> Enviar a reparación
                </button>
              )}
              {item.status === "in_repair" && (
                <button onClick={()=>quickStatus("active")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                  <CheckCircle size={12}/> Retorno de reparación
                </button>
              )}
              <button onClick={()=>quickStatus("decommissioned")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 ml-auto">
                <Archive size={12}/> Dar de baja
              </button>
            </div>
          </div>

          {showInsp && <InspectionPanel itemId={item.id}/>}
        </div>
      )}
    </div>
  );
}

// --- PPEModal ---
function PPEModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    ppe_type: "apron", description: "", brand: "", model: "", serial_number: "",
    lead_equivalent: "", size_category: "", location: "", status: "active", condition: "good",
    assigned_to_name: "", purchase_date: "", expected_life_years: "5", notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.description.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    if (!payload.lead_equivalent) delete payload.lead_equivalent;
    if (!payload.assigned_to_name) delete payload.assigned_to_name;
    if (!payload.purchase_date) delete payload.purchase_date;
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false); onSave(); onClose();
  }

  const inp = "w-full border border-slate-200 rounded px-3 py-1.5 text-sm";
  const sel = inp + " bg-white";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Registrar EPP Radiológico</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle size={20}/></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo EPP</label>
            <select className={sel} value={form.ppe_type} onChange={e=>setForm(f=>({...f,ppe_type:e.target.value}))}>
              {Object.entries(TYPE_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Condición inicial</label>
            <select className={sel} value={form.condition} onChange={e=>setForm(f=>({...f,condition:e.target.value}))}>
              {Object.entries(CONDITION_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción *</label>
            <input className={inp} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Ej: Delantal plomado frontal 0.5 mm Pb — Medicina Nuclear"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
            <input className={inp} value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="Infab, MAVIG, Barrier..."/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
            <input className={inp} value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">N° Serie</label>
            <input className={inp} value={form.serial_number} onChange={e=>setForm(f=>({...f,serial_number:e.target.value}))}/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Equivalente Pb (mm)</label>
            <input type="number" step="0.05" className={inp} value={form.lead_equivalent} onChange={e=>setForm(f=>({...f,lead_equivalent:e.target.value}))} placeholder="0.50"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Talla</label>
            <select className={sel} value={form.size_category} onChange={e=>setForm(f=>({...f,size_category:e.target.value}))}>
              <option value="">Sin talla</option>
              <option value="XS">XS</option><option value="S">S</option>
              <option value="M">M</option><option value="L">L</option><option value="XL">XL</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
            <input className={inp} value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Sala RX 1, Medicina Nuclear..."/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Asignado a</label>
            <input className={inp} value={form.assigned_to_name} onChange={e=>setForm(f=>({...f,assigned_to_name:e.target.value}))} placeholder="Nombre trabajador"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha compra</label>
            <input type="date" className={inp} value={form.purchase_date} onChange={e=>setForm(f=>({...f,purchase_date:e.target.value}))}/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vida útil (años)</label>
            <input type="number" className={inp} value={form.expected_life_years} onChange={e=>setForm(f=>({...f,expected_life_years:e.target.value}))}/>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.description.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>} Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main page ---
export default function PPERadiationPage() {
  const [data, setData] = useState<PPEItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [condFilter, setCondFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (typeFilter) sp.set("type", typeFilter);
    if (statusFilter) sp.set("status", statusFilter);
    if (condFilter) sp.set("condition", condFilter);
    const res = await fetch(`${API}?${sp}`);
    const json = await res.json();
    setData(json.items ?? []);
    setStats(json.stats ?? null);
    setLoading(false);
  }, [typeFilter, statusFilter, condFilter]);

  useEffect(()=>{ load(); }, [load]);

  const damaged = data.filter(i=>i.condition==="damaged"||i.status==="in_repair");
  const overdueInsp = data.filter(i=>(i.days_to_inspection??1)<0 && i.status==="active");

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={22} className="text-blue-600"/>
              <h1 className="text-xl font-semibold text-slate-800">EPP Radiológico</h1>
            </div>
            <p className="text-sm text-slate-500">Equipos de Protección Personal — NS-06.0 §4.6 / DS 3/1985 Art. 12</p>
          </div>
          <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 shadow-sm">
            <Plus size={16}/> Nuevo EPP
          </button>
        </div>

        {/* Alerts */}
        {damaged.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="font-semibold text-red-700 text-sm">{damaged.length} EPP dañado{damaged.length>1?"s":""} o en reparación</p>
              <p className="text-xs text-red-600 mt-0.5">{damaged.map(i=>i.ppe_code).join(", ")} — Verificar disponibilidad de reemplazo</p>
            </div>
          </div>
        )}
        {overdueInsp.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <Clock size={18} className="text-orange-600 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="font-semibold text-orange-700 text-sm">{overdueInsp.length} inspección{overdueInsp.length>1?"es":""} vencida{overdueInsp.length>1?"s":""}</p>
              <p className="text-xs text-orange-600 mt-0.5">{overdueInsp.map(i=>i.ppe_code).join(", ")} — NS-06.0 §4.6 requiere inspección anual</p>
            </div>
          </div>
        )}

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total EPP</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
              <p className="text-xs text-slate-400 mt-1">{stats.aprons} delantales · {stats.thyroid_collars} tiroideos</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 shadow-sm ${stats.in_repair>0?"border-orange-200":"border-slate-100"}`}>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">En reparación</p>
              <p className={`text-3xl font-bold mt-1 ${stats.in_repair>0?"text-orange-600":"text-slate-800"}`}>{stats.in_repair}</p>
              <p className="text-xs text-slate-400 mt-1">{stats.active} activos</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 shadow-sm ${stats.inspection_overdue>0?"border-red-200":stats.inspection_due_90d>0?"border-orange-200":"border-slate-100"}`}>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Inspección</p>
              <p className={`text-3xl font-bold mt-1 ${stats.inspection_overdue>0?"text-red-600":stats.inspection_due_90d>0?"text-orange-600":"text-slate-800"}`}>
                {stats.inspection_overdue > 0 ? stats.inspection_overdue : stats.inspection_due_90d}
              </p>
              <p className="text-xs text-slate-400 mt-1">{stats.inspection_overdue>0?"vencidas":"vencen en 90d"}</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 shadow-sm ${stats.needs_attention>0?"border-yellow-200":"border-slate-100"}`}>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Requieren atención</p>
              <p className={`text-3xl font-bold mt-1 ${stats.needs_attention>0?"text-yellow-600":"text-slate-800"}`}>{stats.needs_attention}</p>
              <p className="text-xs text-slate-400 mt-1">Dañados o cond. especial</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-3">
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
            </select>
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="in_repair">En Reparación</option>
              <option value="decommissioned">Dado de Baja</option>
            </select>
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" value={condFilter} onChange={e=>setCondFilter(e.target.value)}>
              <option value="">Todas las condiciones</option>
              {Object.entries(CONDITION_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
            </select>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-3"/> Cargando EPP...
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
            <ShieldAlert size={36} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">Sin equipos de protección registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(item => <PPECard key={item.id} item={item} onRefresh={load}/>)}
          </div>
        )}

        {/* Footer note */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0"/>
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">Marco regulatorio — NS-06.0 §4.6 / DS 3/1985 Art. 12</p>
            <p>Los EPP radiológicos deben inspeccionarse anualmente (visual y fluoroscópicamente para delantales). Equivalent mínimo: 0.35 mm Pb para procedimientos diagnósticos, 0.5 mm Pb para intervencionales. Los EPP dañados o con fisuras detectadas deben retirarse inmediatamente del servicio.</p>
          </div>
        </div>

      </div>

      {showModal && <PPEModal onClose={()=>setShowModal(false)} onSave={load}/>}
    </div>
  );
}
