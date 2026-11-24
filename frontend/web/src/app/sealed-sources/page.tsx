"use client";
export const dynamic = "force-dynamic";

// §157 — Gestión de Fuentes Radiactivas Selladas
// DS 3/1985 Arts. 55-62 · CCHEN NS-05.0 §5 · IAEA SSG-32
// Inventario, actividad decaída, pruebas de fuga, control de retiro

import { useEffect, useState, useCallback } from "react";
import {
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
  RadioTower, AlertTriangle, CheckCircle, Clock, Package,
  Zap, FlaskConical, Calendar, FileText, ChevronDown, ChevronUp,
  Plus, X, Atom
} from "lucide-react";

interface SealedSource {
  id: number;
  source_id_cchen: string;
  serial_number: string;
  radionuclide: string;
  half_life_days: number;
  reference_activity_GBq: number;
  reference_date: string;
  current_activity_GBq: string;
  iaea_category: number;
  manufacturer: string;
  model: string;
  encapsulation_type: string;
  location: string;
  equipment_associated: string;
  purpose: string;
  acquisition_date: string;
  license_expiry: string;
  last_leak_test_date: string;
  next_leak_test_date: string;
  status: string;
  condition: string;
  notes: string;
  last_leak_test_result: string;
  leak_test_overdue: boolean;
  license_expired: boolean;
}

interface SourceEvent {
  id: number;
  event_type: string;
  event_date: string;
  result: string;
  measured_by: string;
  notes: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:          { label: "Activa",           color: "text-green-700",  bg: "bg-green-100" },
  in_use:          { label: "En uso",           color: "text-blue-700",   bg: "bg-blue-100" },
  stored:          { label: "Almacenada",       color: "text-gray-700",   bg: "bg-gray-100" },
  withdrawn:       { label: "Retirada",         color: "text-orange-700", bg: "bg-orange-100" },
  returned_cchen:  { label: "Dev. CCHEN",       color: "text-purple-700", bg: "bg-purple-100" },
  lost:            { label: "Extraviada",       color: "text-red-700",    bg: "bg-red-100" },
};

const CONDITION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  good:         { label: "Buena",          icon: <CheckCircle className="w-4 h-4" />, color: "text-green-600" },
  damaged:      { label: "Dañada",         icon: <AlertTriangle className="w-4 h-4" />, color: "text-orange-600" },
  suspect_leak: { label: "Fuga sospechosa",icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-600" },
  decommissioned:{ label: "Dada de baja", icon: <X className="w-4 h-4" />, color: "text-gray-500" },
};

const IAEA_CATEGORY: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Cat. 1 — Extremadamente peligrosa", color: "text-red-800",    bg: "bg-red-100 border-red-300" },
  2: { label: "Cat. 2 — Muy peligrosa",            color: "text-orange-800", bg: "bg-orange-100 border-orange-300" },
  3: { label: "Cat. 3 — Peligrosa",                color: "text-yellow-800", bg: "bg-yellow-100 border-yellow-300" },
  4: { label: "Cat. 4 — Poco peligrosa",           color: "text-blue-800",   bg: "bg-blue-100 border-blue-300" },
  5: { label: "Cat. 5 — Riesgo mínimo",            color: "text-green-800",  bg: "bg-green-100 border-green-300" },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  leak_test:       "Prueba de fuga",
  inventory_check: "Verificación inventario",
  transfer:        "Traslado",
  condition_change:"Cambio de condición",
  return_cchen:    "Devolución CCHEN",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function ActivityBar({ current, reference }: { current: number; reference: number }) {
  const pct = Math.min((current / reference) * 100, 100);
  const color = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-orange-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function SourceCard({ source, onAddEvent }: {
  source: SealedSource;
  onAddEvent: (sourceId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<SourceEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const st = STATUS_CONFIG[source.status] ?? STATUS_CONFIG.stored;
  const cond = CONDITION_CONFIG[source.condition] ?? CONDITION_CONFIG.good;
  const cat = source.iaea_category ? IAEA_CATEGORY[source.iaea_category] : null;
  const licDays = source.license_expiry ? daysUntil(source.license_expiry) : null;

  const isCritical = source.condition === "suspect_leak" || source.condition === "damaged"
    || source.status === "lost" || source.leak_test_overdue || source.license_expired;

  async function loadEvents() {
    if (events.length) return;
    setLoadingEvents(true);
    try {
      const r = await fetch(`/api/sealed-sources?id=${source.id}`);
      const d = await r.json();
      setEvents(d.events ?? []);
    } finally {
      setLoadingEvents(false);
    }
  }

  function toggleExpand() {
    if (!expanded) loadEvents();
    setExpanded(x => !x);
  }

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm ${isCritical ? "border-red-300" : "border-gray-200"}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${isCritical ? "bg-red-100" : "bg-blue-50"}`}>
              <Atom className={`w-5 h-5 ${isCritical ? "text-red-600" : "text-blue-600"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-sm">{source.radionuclide}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                {cat && (
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cat.bg} ${cat.color}`}>
                    Cat. {source.iaea_category}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{source.purpose}</p>
            </div>
          </div>
          <button onClick={toggleExpand} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>


      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="sealed-sources"
        ownerType="module"
        title="Documentos del módulo"
      />

        {/* Alerts */}
        {(isCritical) && (
          <div className="mt-3 space-y-1">
            {source.condition === "suspect_leak" && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Fuga sospechosa — requiere acción inmediata
              </div>
            )}
            {source.leak_test_overdue && (
              <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" /> Prueba de fuga vencida
              </div>
            )}
            {source.license_expired && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Licencia CCHEN vencida
              </div>
            )}
          </div>
        )}

        {/* Activity bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Actividad actual: <strong className="text-gray-800">{Number(source.current_activity_GBq).toFixed(3)} GBq</strong></span>
            <span>Ref: {Number(source.reference_activity_GBq).toFixed(3)} GBq</span>
          </div>
          <ActivityBar current={Number(source.current_activity_GBq)} reference={Number(source.reference_activity_GBq)} />
        </div>

        {/* Key stats row */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-400 block">Ubicación</span>
            <span className="text-gray-700 font-medium">{source.location ?? "—"}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Próx. prueba fuga</span>
            <span className={`font-medium ${source.leak_test_overdue ? "text-red-600" : "text-gray-700"}`}>
              {formatDate(source.next_leak_test_date)}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Licencia CCHEN</span>
            <span className={`font-medium ${source.license_expired ? "text-red-600" : licDays !== null && licDays < 60 ? "text-orange-600" : "text-gray-700"}`}>
              {formatDate(source.license_expiry)}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {[
              ["ID CCHEN", source.source_id_cchen],
              ["N° Serie", source.serial_number],
              ["Fabricante", source.manufacturer],
              ["Modelo", source.model],
              ["Encapsulado", source.encapsulation_type],
              ["Equipo asociado", source.equipment_associated],
              ["T½", source.half_life_days ? `${source.half_life_days} días` : "Estable"],
              ["Fecha ref. actividad", formatDate(source.reference_date)],
              ["Adquisición", formatDate(source.acquisition_date)],
              ["Condición", (
                <span key="cond" className={`flex items-center gap-1 ${cond.color}`}>{cond.icon}{cond.label}</span>
              )],
              ["Última prueba fuga", `${formatDate(source.last_leak_test_date)} — ${source.last_leak_test_result ?? "—"}`],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span className="text-gray-400 block">{label}</span>
                <span className="text-gray-800 font-medium">{value ?? "—"}</span>
              </div>
            ))}
          </div>

          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700">Historial de eventos</h4>
              <button
                onClick={() => onAddEvent(source.id)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar evento
              </button>
            </div>
            {loadingEvents ? (
              <p className="text-xs text-gray-400">Cargando...</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-gray-400">Sin eventos registrados</p>
            ) : (
              <div className="space-y-1.5">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-start gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-400 w-20 flex-shrink-0">{formatDate(ev.event_date)}</span>
                    <span className="font-medium text-gray-700">{EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}</span>
                    {ev.result && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        ev.result === "pass" ? "bg-green-100 text-green-700" :
                        ev.result === "fail" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                      }`}>{ev.result}</span>
                    )}
                    <span className="text-gray-500 flex-1">{ev.notes}</span>
                    <span className="text-gray-400">{ev.measured_by}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddEventModal({ sourceId, onClose, onSaved }: {
  sourceId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    event_type: "leak_test",
    event_date: new Date().toISOString().split("T")[0],
    result: "pass",
    measured_by: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/sealed-sources?id=${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Registrar evento</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de evento</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.event_type}
              onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
            >
              {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} required />
            </div>
            {(form.event_type === "leak_test" || form.event_type === "inventory_check") && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Resultado</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
                  <option value="pass">Pasa</option>
                  <option value="fail">Falla</option>
                  <option value="suspect">Sospechoso</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Realizado por</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del profesional" value={form.measured_by}
              onChange={e => setForm(f => ({ ...f, measured_by: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3}
              placeholder="Resultados, mediciones, observaciones..." value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SealedSourcesPage() {
  const [sources, setSources] = useState<SealedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [addEventFor, setAddEventFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sealed-sources");
      const d = await r.json();
      setSources(d.sources ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = sources.filter(s => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterCat !== "all" && String(s.iaea_category) !== filterCat) return false;
    return true;
  });

  const stats = {
    active: sources.filter(s => s.status === "active" || s.status === "in_use").length,
    critical: sources.filter(s => s.condition === "suspect_leak" || s.status === "lost").length,
    leakOverdue: sources.filter(s => s.leak_test_overdue).length,
    licExpired: sources.filter(s => s.license_expired).length,
    highCat: sources.filter(s => s.iaea_category && s.iaea_category <= 2).length,
  };

  const hasCritical = stats.critical > 0 || stats.leakOverdue > 0 || stats.licExpired > 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Atom className="w-7 h-7 text-blue-600" />
          Gestión de Fuentes Selladas
        </h1>
        <p className="text-sm text-gray-500 mt-1">DS 3/1985 Arts. 55–62 · CCHEN NS-05.0 §5 · IAEA SSG-32</p>
      </div>

      {/* Critical banner */}
      {hasCritical && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Alertas críticas en inventario</p>
            <ul className="text-xs text-red-700 mt-1 space-y-0.5">
              {stats.critical > 0 && <li>• {stats.critical} fuente(s) con condición crítica (fuga/extraviada)</li>}
              {stats.leakOverdue > 0 && <li>• {stats.leakOverdue} fuente(s) con prueba de fuga vencida</li>}
              {stats.licExpired > 0 && <li>• {stats.licExpired} fuente(s) con licencia CCHEN vencida</li>}
            </ul>
          </div>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Fuentes activas", value: stats.active, icon: <RadioTower className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Alto riesgo (Cat.1-2)", value: stats.highCat, icon: <Zap className="w-5 h-5" />, color: "text-red-600", bg: "bg-red-50" },
          { label: "Fuga sospechosa", value: stats.critical, icon: <AlertTriangle className="w-5 h-5" />, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Pruebas vencidas", value: stats.leakOverdue, icon: <Clock className="w-5 h-5" />, color: "text-yellow-700", bg: "bg-yellow-50" },
          { label: "Licencias vencidas", value: stats.licExpired, icon: <FileText className="w-5 h-5" />, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(t => (
          <div key={t.label} className={`${t.bg} rounded-xl p-3`}>
            <div className={`${t.color} mb-1`}>{t.icon}</div>
            <div className={`text-2xl font-bold ${t.color}`}>{t.value}</div>
            <div className="text-xs text-gray-600">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="all">Todas las categorías IAEA</option>
          {[1, 2, 3, 4, 5].map(c => (
            <option key={c} value={String(c)}>Categoría {c}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} fuente(s)</span>
      </div>

      {/* Source cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando inventario...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No hay fuentes con estos filtros</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(s => (
            <SourceCard key={s.id} source={s} onAddEvent={setAddEventFor} />
          ))}
        </div>
      )}

      {/* Regulatory framework */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <FlaskConical className="w-4 h-4" /> Marco regulatorio aplicable
        </p>
        <p>• <strong>DS 3/1985 Arts. 55–62:</strong> Requisitos de registro, control y devolución de fuentes a CCHEN</p>
        <p>• <strong>CCHEN NS-05.0 §5:</strong> Gestión del inventario de fuentes radiactivas selladas</p>
        <p>• <strong>IAEA SSG-32:</strong> Gestión segura de fuentes radiactivas selladas de alta actividad</p>
        <p>• <strong>IAEA RS-G-1.9:</strong> Categorización de fuentes radiactivas (Categorías 1 a 5)</p>
        <p>• <strong>Circular CCHEN N°08:</strong> Procedimiento de devolución de fuentes en desuso</p>
        <p className="text-orange-700 mt-2">⚠ Fuentes Categoría 1 y 2 requieren notificación inmediata a CCHEN ante cualquier incidente (Tel: 600 600 2436)</p>
      </div>

      {/* Event modal */}
      {addEventFor !== null && (
        <AddEventModal
          sourceId={addEventFor}
          onClose={() => setAddEventFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
