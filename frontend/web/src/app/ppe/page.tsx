"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw,
  AlertTriangle, CheckCircle, ClipboardCheck, Clock
} from "lucide-react";

type Item = {
  id: number; item_code: string; item_type: string; description: string;
  brand: string; model: string; lead_mm: string; acquisition_date: string | null;
  last_check_date: string | null; next_check_date: string | null;
  assigned_to: string; service_area: string; condition: string;
  location: string; notes: string;
};

type Check = {
  id: number; item_id: number; item_code: string; description: string;
  check_date: string; checked_by: string; result: string;
  findings: string; action: string; notes: string;
};

type Stats = {
  total: string; good: string; fair: string; poor: string; condemned: string;
  overdue_checks: string; upcoming_checks: string;
};

type Data = { items: Item[]; stats: Stats; checks: Check[] };

const TYPE_CFG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  apron:    { label: "Delantal",    icon: "🧥", bg: "bg-blue-100",   text: "text-blue-800"   },
  thyroid:  { label: "Protector tiroideo", icon: "🔵", bg: "bg-cyan-100", text: "text-cyan-800" },
  gloves:   { label: "Guantes",     icon: "🧤", bg: "bg-purple-100", text: "text-purple-800" },
  glasses:  { label: "Lentes Pb",   icon: "👓", bg: "bg-teal-100",   text: "text-teal-800"   },
  screen:   { label: "Mampara",     icon: "🛡️", bg: "bg-green-100",  text: "text-green-800"  },
  collar:   { label: "Collar Pb",   icon: "🔴", bg: "bg-orange-100", text: "text-orange-800" },
  other:    { label: "Otro",        icon: "📦", bg: "bg-gray-100",   text: "text-gray-800"   },
};

const COND_CFG: Record<string, { label: string; bg: string; text: string }> = {
  good:      { label: "Bueno",       bg: "bg-green-100",  text: "text-green-800"  },
  fair:      { label: "Regular",     bg: "bg-amber-100",  text: "text-amber-800"  },
  poor:      { label: "Deficiente",  bg: "bg-red-100",    text: "text-red-800"    },
  condemned: { label: "Condenado",   bg: "bg-red-200",    text: "text-red-900"    },
};

function Badge({ val, cfg }: { val: string; cfg: Record<string, { label: string; bg: string; text: string }> }) {
  const c = cfg[val] ?? { label: val, bg: "bg-gray-100", text: "text-gray-700" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + "T12:00:00").getTime() - Date.now()) / 86400000);
}

function CheckModal({ item, onSubmit, onCancel, saving }: {
  item: Item;
  onSubmit: (f: Record<string, string>) => void;
  onCancel: () => void; saving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    check_date: today, next_check_date: nextYear,
    checked_by: "", result: "pass", new_condition: item.condition,
    findings: "", action: "", notes: "",
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-gray-900">Verificación de Integridad</h2>
          <p className="text-xs text-gray-500 mt-1">{item.item_code} — {item.description}</p>
        </div>
        <div className="p-5 space-y-3">
          {[
            ["Fecha Verificación *", "check_date", "date"],
            ["Próxima Verificación", "next_check_date", "date"],
            ["Verificado por", "checked_by", "text"],
          ].map(([label, key, type]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Resultado</label>
              <select value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="pass">Aprobado</option>
                <option value="fail">Rechazado</option>
                <option value="conditional">Condicional</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Condición</label>
              <select value={form.new_condition} onChange={e => setForm(f => ({ ...f, new_condition: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(COND_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hallazgos</label>
            <input value={form.findings} onChange={e => setForm(f => ({ ...f, findings: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Grieta en borde inferior izquierdo" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Acción tomada</label>
            <input value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onSubmit(form)} disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, onDelete, onCheck }: {
  item: Item; onDelete: () => void; onCheck: () => void;
}) {
  const [open, setOpen] = useState(false);
  const typeCfg = TYPE_CFG[item.item_type] ?? TYPE_CFG.other;
  const condCfg = COND_CFG[item.condition] ?? COND_CFG.good;
  const daysNext = daysUntil(item.next_check_date);
  const isOverdue  = daysNext !== null && daysNext < 0;
  const isUpcoming = daysNext !== null && daysNext >= 0 && daysNext <= 90;
  const borderColor = item.condition === "condemned" ? "border-red-500" :
                      item.condition === "poor"      ? "border-red-300" :
                      isOverdue                      ? "border-amber-400" : "border-gray-200";

  const nextCheckStr = item.next_check_date
    ? new Date(item.next_check_date + "T12:00:00").toLocaleDateString("es-CL", { day:"numeric",month:"short",year:"numeric" })
    : null;

  return (
    <div className={`bg-white rounded-xl border-l-4 shadow-sm ${borderColor}`}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <span className="text-2xl mt-0.5">{typeCfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm font-semibold text-gray-900">{item.item_code}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeCfg.bg} ${typeCfg.text}`}>{typeCfg.label}</span>
            <Badge val={item.condition} cfg={COND_CFG} />
            {item.lead_mm && <span className="text-xs text-gray-500">{item.lead_mm} mm Pb</span>}
          </div>
          <p className="text-xs text-gray-700">{item.description}</p>
          {item.service_area && <p className="text-xs text-gray-500 mt-0.5">{item.service_area}{item.location ? ` · ${item.location}` : ""}</p>}
          {nextCheckStr && (
            <p className={`text-xs mt-1 font-medium ${isOverdue ? "text-red-700" : isUpcoming ? "text-amber-700" : "text-gray-500"}`}>
              {isOverdue ? `⚠ Verificación vencida: ${nextCheckStr} (hace ${Math.abs(daysNext!)}d)` :
               isUpcoming ? `⚠ Verificación en ${daysNext}d: ${nextCheckStr}` :
               `Prox. verificación: ${nextCheckStr}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onCheck(); }}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Verificar">
            <ClipboardCheck className="h-4 w-4" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
            <Trash2 className="h-4 w-4" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-1 text-xs text-gray-700">
          {item.brand    && <div><span className="font-medium">Marca:</span> {item.brand}{item.model ? ` / ${item.model}` : ""}</div>}
          {item.assigned_to && <div><span className="font-medium">Asignado a:</span> {item.assigned_to}</div>}
          {item.acquisition_date && <div><span className="font-medium">Adquisición:</span> {new Date(item.acquisition_date + "T12:00:00").toLocaleDateString("es-CL", {day:"numeric",month:"short",year:"numeric"})}</div>}
          {item.last_check_date && <div><span className="font-medium">Última verificación:</span> {new Date(item.last_check_date + "T12:00:00").toLocaleDateString("es-CL", {day:"numeric",month:"short",year:"numeric"})}</div>}
          {item.notes    && <div className="col-span-2"><span className="font-medium">Notas:</span> {item.notes}</div>}
        </div>
      )}
    </div>
  );
}

type NewItemForm = {
  item_code: string; item_type: string; description: string; brand: string;
  lead_mm: string; acquisition_date: string; service_area: string; location: string; notes: string;
};
const BLANK_ITEM: NewItemForm = {
  item_code: "", item_type: "apron", description: "", brand: "",
  lead_mm: "0.50", acquisition_date: new Date().toISOString().slice(0, 10),
  service_area: "", location: "", notes: "",
};

export default function PPEPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checkTarget, setCheckTarget] = useState<Item | null>(null);
  const [form, setForm] = useState<NewItemForm>(BLANK_ITEM);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterCond, setFilterCond] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterCond) params.set("condition", filterCond);
      const d = await fetch(`/api/ppe?${params}`).then(r => r.json());
      setData(d);
    } finally { setLoading(false); }
  }, [filterType, filterCond]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.item_code || !form.item_type) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ppe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lead_mm: parseFloat(form.lead_mm) || null }),
      });
      if (res.ok) { setShowForm(false); setForm(BLANK_ITEM); load(); }
    } finally { setSaving(false); }
  };

  const handleCheck = async (f: Record<string, string>) => {
    if (!checkTarget) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ppe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ check_for: checkTarget.id, ...f }),
      });
      if (res.ok) { setCheckTarget(null); load(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Dar de baja este EPP?")) return;
    await fetch(`/api/ppe?id=${id}`, { method: "DELETE" });
    load();
  };

  const s = data?.stats;
  const hasAlerts = s && (parseInt(s.overdue_checks) > 0 || parseInt(s.condemned) > 0 || parseInt(s.poor) > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <ShieldAlert className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">EPP Radiológico</h1>
            <p className="text-sm text-gray-500">Inventario y verificación de Elementos de Protección Personal — DS 3/1985 Art. 25</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Nuevo EPP
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {hasAlerts && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">EPP requieren atención</p>
            <p className="text-xs text-red-700 mt-1">
              {parseInt(s?.condemned ?? "0") > 0 && `${s!.condemned} EPP CONDENADO(S). `}
              {parseInt(s?.poor ?? "0") > 0 && `${s!.poor} en estado DEFICIENTE. `}
              {parseInt(s?.overdue_checks ?? "0") > 0 && `${s!.overdue_checks} verificación(es) vencida(s). `}
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total activos",       value: s.total,          color: "text-gray-900" },
            { label: "Bueno estado",        value: s.good,           color: "text-green-700" },
            { label: "Verif. vencidas",     value: s.overdue_checks, color: parseInt(s.overdue_checks) > 0 ? "text-red-700"   : "text-gray-500" },
            { label: "Verif. próximas (90d)", value: s.upcoming_checks, color: parseInt(s.upcoming_checks) > 0 ? "text-amber-700" : "text-gray-500" },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters + List */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <select value={filterCond} onChange={e => setFilterCond(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Todas las condiciones</option>
            {Object.entries(COND_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-xs text-gray-500 ml-auto">{data?.items?.length ?? 0} ítem(s)</span>
        </div>
        <div className="p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Cargando…</p>
          ) : !data?.items?.length ? (
            <p className="text-sm text-gray-500 text-center py-8">Sin EPP registrado.</p>
          ) : (
            data.items.map(item => (
              <ItemCard key={item.id} item={item}
                onDelete={() => handleDelete(item.id)}
                onCheck={() => setCheckTarget(item)}
              />
            ))
          )}
        </div>
      </div>

      {/* Recent checks log */}
      {data?.checks && data.checks.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Últimas Verificaciones
          </h2>
          <div className="space-y-1">
            {data.checks.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0 text-xs">
                <span className={`w-16 text-center px-2 py-0.5 rounded-full font-semibold ${c.result === "pass" ? "bg-green-100 text-green-800" : c.result === "fail" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                  {c.result === "pass" ? "APROBADO" : c.result === "fail" ? "RECHAZADO" : "CONDICIONAL"}
                </span>
                <span className="font-mono font-semibold text-gray-900 w-16">{c.item_code}</span>
                <span className="text-gray-600 flex-1 truncate">{c.description}</span>
                <span className="text-gray-500 shrink-0">{new Date(c.check_date + "T12:00:00").toLocaleDateString("es-CL", {day:"numeric",month:"short",year:"numeric"})}</span>
                {c.checked_by && <span className="text-gray-400 shrink-0">{c.checked_by}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New item form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Registrar EPP Radiológico</h2>
              <button onClick={() => { setShowForm(false); setForm(BLANK_ITEM); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
                <input value={form.item_code} onChange={e => setForm(f => ({ ...f, item_code: e.target.value }))}
                  placeholder="AP-004" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Delantal plomado frontal 0.5 mm Pb"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Marca</label>
                <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Espesor Pb (mm)</label>
                <input type="number" step="0.01" value={form.lead_mm} onChange={e => setForm(f => ({ ...f, lead_mm: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha adquisición</label>
                <input type="date" value={form.acquisition_date} onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Servicio / Área</label>
                <input value={form.service_area} onChange={e => setForm(f => ({ ...f, service_area: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Ubicación</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setForm(BLANK_ITEM); }}
                className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Guardando…" : "Registrar EPP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkTarget && (
        <CheckModal item={checkTarget} onSubmit={handleCheck} onCancel={() => setCheckTarget(null)} saving={saving} />
      )}
    </div>
  );
}
