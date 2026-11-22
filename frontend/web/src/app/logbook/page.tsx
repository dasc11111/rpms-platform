"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, type ComponentType } from "react";
import {
  BookOpen, Plus, Pencil, Trash2, X, Save, Search, AlertTriangle,
  CheckCircle2, Clock, RefreshCw, ChevronDown, ChevronUp, Calendar,
  MessageSquare, ShieldAlert, Wrench, Users, Eye, FileText,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: number;
  entry_datetime: string;
  zone_name: string | null;
  event_type: string;
  description: string;
  reported_by: string;
  supervisor: string | null;
  corrective_action: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string;
}

interface Summary {
  total: number;
  open_count: number;
  pending_count: number;
  closed_count: number;
  follow_up_pending: number;
  follow_up_overdue: number;
  last_30_days: number;
  today_count: number;
}

const EVENT_CONFIG: Record<string, { label: string; icon: ComponentType<LucideProps>; color: string }> = {
  incidente:    { label: "Incidente",      icon: AlertTriangle, color: "bg-red-100 text-red-800" },
  anomalia:     { label: "Anomalía",       icon: ShieldAlert,   color: "bg-orange-100 text-orange-800" },
  mantenimiento:{ label: "Mantención",     icon: Wrench,        color: "bg-blue-100 text-blue-800" },
  visita:       { label: "Visita",         icon: Users,         color: "bg-purple-100 text-purple-800" },
  calibracion:  { label: "Calibración",   icon: CheckCircle2,  color: "bg-green-100 text-green-800" },
  ejercicio:    { label: "Ejercicio/Simulacro", icon: FileText, color: "bg-teal-100 text-teal-800" },
  inspeccion:   { label: "Inspección",    icon: Eye,           color: "bg-indigo-100 text-indigo-800" },
  otro:         { label: "Otro",           icon: MessageSquare, color: "bg-gray-100 text-gray-700" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:    { label: "Abierto",    color: "bg-red-100 text-red-700" },
  pending: { label: "Pendiente",  color: "bg-amber-100 text-amber-700" },
  closed:  { label: "Cerrado",    color: "bg-green-100 text-green-700" },
};

const DEFAULT_FORM = {
  entry_datetime: new Date().toISOString().slice(0, 16),
  zone_name: "", event_type: "otro", description: "",
  reported_by: "", supervisor: "", corrective_action: "",
  follow_up_required: false, follow_up_date: "",
  status: "open", closed_by: "", notes: "",
};

export default function LogbookPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [form, setForm] = useState<typeof DEFAULT_FORM>({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterType !== "all") params.set("type", filterType);
      if (filterDate) params.set("date", filterDate);
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/logbook?${params}`),
        fetch("/api/logbook?summary=1"),
      ]);
      const listData = await listRes.json();
      const sumData = await sumRes.json();
      setEntries(listData.entries ?? []);
      setSummary(sumData.stats ?? null);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [filterStatus, filterType, filterDate]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, entry_datetime: new Date().toISOString().slice(0, 16) });
    setError(null); setShowModal(true);
  };
  const openEdit = (e: LogEntry) => {
    setEditing(e);
    setForm({
      entry_datetime: e.entry_datetime.slice(0, 16),
      zone_name: e.zone_name ?? "",
      event_type: e.event_type,
      description: e.description,
      reported_by: e.reported_by,
      supervisor: e.supervisor ?? "",
      corrective_action: e.corrective_action ?? "",
      follow_up_required: e.follow_up_required,
      follow_up_date: e.follow_up_date?.slice(0, 10) ?? "",
      status: e.status,
      closed_by: e.closed_by ?? "",
      notes: e.notes ?? "",
    });
    setError(null); setShowModal(true);
  };

  const handleSave = async (ev: { preventDefault: () => void }) => {
    ev.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        entry_datetime: form.entry_datetime || undefined,
        zone_name: form.zone_name || null,
        event_type: form.event_type,
        description: form.description,
        reported_by: form.reported_by,
        supervisor: form.supervisor || null,
        corrective_action: form.corrective_action || null,
        follow_up_required: form.follow_up_required,
        follow_up_date: form.follow_up_date || null,
        status: form.status,
        closed_by: form.closed_by || null,
        notes: form.notes || null,
      };
      const res = await fetch("/api/logbook", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error"); }
      setShowModal(false); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const handleDelete = async (e: LogEntry) => {
    if (!confirm(`¿Eliminar novedad del ${new Date(e.entry_datetime).toLocaleDateString("es-CL")}?`)) return;
    await fetch(`/api/logbook?id=${e.id}`, { method: "DELETE" });
    load();
  };

  const quickClose = async (e: LogEntry) => {
    await fetch("/api/logbook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: e.id, status: "closed" }),
    });
    load();
  };

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [e.description, e.reported_by, e.zone_name, e.event_type, e.supervisor]
      .some(v => v?.toLowerCase().includes(q));
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-indigo-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Libro de Novedades</h1>
            <p className="text-sm text-muted-foreground">Bitácora operacional · DS 3/1985 MINSAL Art. 32</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background text-sm hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium">
            <Plus className="h-4 w-4" /> Nueva novedad
          </button>
        </div>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Hoy", value: summary.today_count, icon: Calendar, color: "text-blue-500" },
            { label: "Abiertas", value: summary.open_count, icon: AlertTriangle, color: summary.open_count > 0 ? "text-red-500" : "text-muted-foreground" },
            { label: "Seguimiento pendiente", value: summary.follow_up_pending, icon: Clock, color: summary.follow_up_overdue > 0 ? "text-red-500" : summary.follow_up_pending > 0 ? "text-amber-500" : "text-muted-foreground" },
            { label: "Últimos 30 días", value: summary.last_30_days, icon: BookOpen, color: "text-indigo-500" },
          ].map(k => (
            <div key={k.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
              <k.icon className={cn("h-8 w-8", k.color)} />
              <div>
                <p className="text-2xl font-bold text-foreground">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up overdue alert */}
      {summary && summary.follow_up_overdue > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            {summary.follow_up_overdue} novedad{summary.follow_up_overdue > 1 ? "es" : ""} con seguimiento vencido sin cerrar.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en descripción, zona, responsable…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm" />
        </div>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm">
          <option value="all">Todos los tipos</option>
          {Object.entries(EVENT_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm">
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No se encontraron novedades</p>
          </div>
        ) : filtered.map(entry => {
          const evCfg = EVENT_CONFIG[entry.event_type] ?? EVENT_CONFIG.otro;
          const stCfg = STATUS_CONFIG[entry.status] ?? { label: entry.status, color: "bg-gray-100 text-gray-700" };
          const isExp = expanded === entry.id;
          const followUpOverdue = entry.follow_up_required && entry.follow_up_date &&
            new Date(entry.follow_up_date) < new Date() && entry.status !== "closed";

          return (
            <div key={entry.id} className={cn("bg-card border rounded-xl overflow-hidden",
              followUpOverdue && "border-red-300")}>
              <div className="flex items-start gap-4 p-4">
                {/* Event icon */}
                <div className={cn("p-2 rounded-lg shrink-0", evCfg.color)}>
                  <evCfg.icon className="h-5 w-5" />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {new Date(entry.entry_datetime).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", evCfg.color)}>{evCfg.label}</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", stCfg.color)}>{stCfg.label}</span>
                    {entry.zone_name && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{entry.zone_name}</span>
                    )}
                    {followUpOverdue && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                        <AlertTriangle className="h-3 w-3" /> Seguimiento vencido
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{entry.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reportado por: <span className="font-medium">{entry.reported_by}</span>
                    {entry.supervisor && <> · Supervisor: <span className="font-medium">{entry.supervisor}</span></>}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {entry.status !== "closed" && (
                    <button onClick={() => quickClose(entry)}
                      className="p-1.5 rounded hover:bg-green-50 text-muted-foreground hover:text-green-700" title="Cerrar novedad">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => openEdit(entry)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(entry)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setExpanded(isExp ? null : entry.id)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                    {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div className="border-t px-4 pb-4 pt-3 bg-muted/20 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {entry.corrective_action && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">ACCIÓN CORRECTIVA</p>
                      <p className="text-foreground">{entry.corrective_action}</p>
                    </div>
                  )}
                  {entry.follow_up_required && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">SEGUIMIENTO</p>
                      <p className={cn("text-foreground", followUpOverdue && "text-red-600 font-semibold")}>
                        {entry.follow_up_date
                          ? `Fecha: ${new Date(entry.follow_up_date).toLocaleDateString("es-CL")}`
                          : "Requerido (sin fecha)"}
                        {followUpOverdue && " ⚠ Vencido"}
                      </p>
                    </div>
                  )}
                  {entry.closed_at && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">CIERRE</p>
                      <p className="text-foreground">
                        {new Date(entry.closed_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                        {entry.closed_by && ` · ${entry.closed_by}`}
                      </p>
                    </div>
                  )}
                  {entry.notes && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">NOTAS</p>
                      <p className="text-foreground">{entry.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background">
              <h2 className="text-lg font-semibold">{editing ? "Editar Novedad" : "Registrar Novedad"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha y hora *</label>
                  <input required type="datetime-local" value={form.entry_datetime}
                    onChange={e => setForm(f => ({ ...f, entry_datetime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de evento *</label>
                  <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                    {Object.entries(EVENT_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zona / Área</label>
                  <input value={form.zone_name} onChange={e => setForm(f => ({ ...f, zone_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Sala MN, PET/CT, Bodega…" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reportado por *</label>
                  <input required value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Nombre del funcionario" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Supervisor / Responsable</label>
                  <input value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Descripción de la novedad *</label>
                <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
                  placeholder="Describa el evento, anomalía o novedad operacional…" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Acción correctiva / Medidas tomadas</label>
                <textarea value={form.corrective_action} onChange={e => setForm(f => ({ ...f, corrective_action: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
              </div>

              <div className="flex items-start gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
                  <input type="checkbox" checked={form.follow_up_required}
                    onChange={e => setForm(f => ({ ...f, follow_up_required: e.target.checked }))}
                    className="rounded" />
                  Requiere seguimiento
                </label>
                {form.follow_up_required && (
                  <div className="flex-1">
                    <input type="date" value={form.follow_up_date} onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                )}
              </div>

              {form.status === "closed" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Cerrado por</label>
                  <input value={form.closed_by} onChange={e => setForm(f => ({ ...f, closed_by: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Notas adicionales</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar novedad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
