"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock,
  Edit3, FileText, Loader2, Plus, Shield, Trash2, Users, X, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Meeting {
  id: number;
  meeting_number: number;
  meeting_date: string;
  meeting_type: "ordinary" | "extraordinary" | "urgent";
  location: string | null;
  chair: string | null;
  secretary: string | null;
  attendees: string | null;
  quorum: boolean;
  agenda: string | null;
  resolutions: string | null;
  next_meeting: string | null;
  status: "draft" | "approved" | "cancelled";
  document_ref: string | null;
  notes: string | null;
  created_at: string;
}

interface Stats {
  total: string;
  approved: string;
  draft: string;
  ordinary: string;
  extraordinary: string;
  this_year: string;
  last_meeting: string | null;
  next_scheduled: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TYPE_CFG = {
  ordinary:      { label: "Ordinaria",     bg: "bg-blue-100",   text: "text-blue-800"   },
  extraordinary: { label: "Extraordinaria", bg: "bg-purple-100", text: "text-purple-800" },
  urgent:        { label: "Urgente",        bg: "bg-red-100",    text: "text-red-800"    },
} as const;

const STATUS_CFG = {
  draft:     { label: "Borrador",  bg: "bg-amber-100",  text: "text-amber-800",  icon: Clock        },
  approved:  { label: "Aprobada",  bg: "bg-green-100",  text: "text-green-800",  icon: CheckCircle2 },
  cancelled: { label: "Cancelada", bg: "bg-gray-100",   text: "text-gray-600",   icon: X            },
} as const;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Form Component ───────────────────────────────────────────────────────────
function MeetingForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<Meeting>;
  onSave: (data: Partial<Meeting>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<Meeting>>({
    meeting_date: new Date().toISOString().slice(0, 10),
    meeting_type: "ordinary",
    quorum: true,
    status: "draft",
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Meeting, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Fecha de reunión *</label>
          <input type="date" required
            value={form.meeting_date?.slice(0, 10) ?? ""}
            onChange={e => set("meeting_date", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <select
            value={form.meeting_type ?? "ordinary"}
            onChange={e => set("meeting_type", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="ordinary">Ordinaria</option>
            <option value="extraordinary">Extraordinaria</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Lugar</label>
          <input type="text"
            value={form.location ?? ""}
            onChange={e => set("location", e.target.value)}
            placeholder="Sala de reuniones Radiofísica"
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Presidente/a</label>
          <input type="text"
            value={form.chair ?? ""}
            onChange={e => set("chair", e.target.value)}
            placeholder="Jefe Radiofísica"
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Secretario/a</label>
          <input type="text"
            value={form.secretary ?? ""}
            onChange={e => set("secretary", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Próxima reunión</label>
          <input type="date"
            value={form.next_meeting?.slice(0, 10) ?? ""}
            onChange={e => set("next_meeting", e.target.value || null)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Asistentes</label>
          <input type="text"
            value={form.attendees ?? ""}
            onChange={e => set("attendees", e.target.value)}
            placeholder="Nombres y cargos separados por punto y coma"
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Tabla de materias (orden del día)</label>
          <textarea rows={3}
            value={form.agenda ?? ""}
            onChange={e => set("agenda", e.target.value)}
            placeholder="1. Revisión dosis periodo; 2. Incidentes; 3. Vencimientos próximos..."
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Acuerdos y resoluciones</label>
          <textarea rows={3}
            value={form.resolutions ?? ""}
            onChange={e => set("resolutions", e.target.value)}
            placeholder="Acuerdo 1: ...; Acuerdo 2: ..."
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">N° documento / referencia</label>
          <input type="text"
            value={form.document_ref ?? ""}
            onChange={e => set("document_ref", e.target.value)}
            placeholder="Acta CPR-2024-001"
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Estado</label>
          <select
            value={form.status ?? "draft"}
            onChange={e => set("status", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="draft">Borrador</option>
            <option value="approved">Aprobada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input type="checkbox"
            id="quorum-chk"
            checked={form.quorum ?? true}
            onChange={e => set("quorum", e.target.checked)}
            className="rounded"
          />
          <label htmlFor="quorum-chk" className="text-sm">Quórum alcanzado</label>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Observaciones</label>
          <textarea rows={2}
            value={form.notes ?? ""}
            onChange={e => set("notes", e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {initial?.id ? "Actualizar" : "Crear acta"}
        </button>
      </div>
    </form>
  );
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────
function MeetingCard({
  meeting, onEdit, onDelete,
}: {
  meeting: Meeting;
  onEdit: (m: Meeting) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeCfg = TYPE_CFG[meeting.meeting_type] ?? TYPE_CFG.ordinary;
  const statusCfg = STATUS_CFG[meeting.status] ?? STATUS_CFG.draft;
  const StatusIcon = statusCfg.icon;

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden",
      meeting.status === "approved" ? "border-green-200" :
      meeting.status === "cancelled" ? "border-gray-200 opacity-70" : "border-border"
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-blue-700">
            {meeting.meeting_number ?? "—"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              Acta N°{meeting.meeting_number ?? "?"} · {fmtDate(meeting.meeting_date)}
            </span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded", typeCfg.bg, typeCfg.text)}>
              {typeCfg.label}
            </span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded flex items-center gap-1", statusCfg.bg, statusCfg.text)}>
              <StatusIcon className="w-3 h-3" /> {statusCfg.label}
            </span>
            {!meeting.quorum && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Sin quórum
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {meeting.location && <span>{meeting.location} · </span>}
            {meeting.chair && <span>Preside: {meeting.chair}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit(meeting); }}
            className="p-1.5 hover:bg-muted rounded-lg"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); if (confirm("¿Eliminar esta acta?")) onDelete(meeting.id); }}
            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" /> :
                      <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 text-sm bg-muted/20">
          {meeting.attendees && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                <Users className="w-3.5 h-3.5" /> ASISTENTES
              </div>
              <p className="text-xs text-foreground">{meeting.attendees}</p>
            </div>
          )}
          {meeting.agenda && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                <BookOpen className="w-3.5 h-3.5" /> TABLA DE MATERIAS
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap">{meeting.agenda}</p>
            </div>
          )}
          {meeting.resolutions && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> ACUERDOS Y RESOLUCIONES
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap">{meeting.resolutions}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1 border-t">
            {meeting.next_meeting && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Próxima: {fmtDate(meeting.next_meeting)}
              </span>
            )}
            {meeting.document_ref && (
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Ref: {meeting.document_ref}
              </span>
            )}
          </div>
          {meeting.notes && (
            <p className="text-xs text-muted-foreground italic">{meeting.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommitteeMeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Meeting | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterYear)   params.set("year",   filterYear);
      if (filterStatus) params.set("status", filterStatus);
      if (filterType)   params.set("type",   filterType);
      const res = await fetch(`/api/committee-meetings?${params}`);
      const data = await res.json();
      setMeetings(data.meetings ?? []);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterStatus, filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: Partial<Meeting>) => {
    await fetch("/api/committee-meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    fetchData();
  };

  const handleUpdate = async (data: Partial<Meeting>) => {
    if (!editTarget) return;
    await fetch("/api/committee-meetings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editTarget.id, ...data }),
    });
    setEditTarget(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/committee-meetings?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const approvedThisYear = parseInt(stats?.approved ?? "0");
  const totalThisYear    = parseInt(stats?.this_year ?? "0");

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Comité de Protección Radiológica
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registro de actas y resoluciones · Art. 23 DS 3/1985
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nueva acta
        </button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total reuniones", value: stats.total, icon: BookOpen, color: "text-blue-600" },
            { label: "Este año", value: stats.this_year, icon: Calendar, color: "text-purple-600" },
            { label: "Aprobadas", value: stats.approved, icon: CheckCircle2, color: "text-green-600" },
            { label: "Borradores", value: stats.draft, icon: Clock, color: "text-amber-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="border rounded-xl p-3 flex items-center gap-3">
              <Icon className={cn("w-5 h-5 shrink-0", color)} />
              <div>
                <div className="text-lg font-bold leading-none">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compliance bar */}
      {stats && (
        <div className="rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Sesiones {currentYear}:</span>
            <span className={cn("font-semibold", totalThisYear >= 4 ? "text-green-700" : "text-amber-700")}>
              {totalThisYear} sesión{totalThisYear !== 1 ? "es" : ""}
            </span>
            {totalThisYear < 4 && (
              <span className="text-xs text-amber-600">(mínimo recomendado: 4 anuales)</span>
            )}
          </div>
          {stats.last_meeting && (
            <span className="text-xs text-muted-foreground">
              Última: {fmtDate(stats.last_meeting)}
            </span>
          )}
          {stats.next_scheduled && (
            <span className="text-xs text-blue-600 font-medium">
              Próxima: {fmtDate(stats.next_scheduled)}
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los años</option>
          {years.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="approved">Aprobada</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="ordinary">Ordinaria</option>
          <option value="extraordinary">Extraordinaria</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>

      {/* New/Edit form modal overlay */}
      {(showForm || editTarget) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-background border rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">
                {editTarget ? "Editar acta" : "Nueva acta CPR"}
              </h2>
              <button onClick={() => { setShowForm(false); setEditTarget(null); }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <MeetingForm
                initial={editTarget ?? undefined}
                onSave={editTarget ? handleUpdate : handleCreate}
                onCancel={() => { setShowForm(false); setEditTarget(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Meetings list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando actas…
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <BookOpen className="w-10 h-10 opacity-30" />
          <p className="text-sm">No hay actas registradas con los filtros actuales.</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            Crear primera acta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => (
            <MeetingCard
              key={m.id}
              meeting={m}
              onEdit={m => { setEditTarget(m); setShowForm(false); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center border-t pt-4">
        Comité de Protección Radiológica (CPR) · Art. 23 DS 3/1985 · Encargado de Protección Radiológica
      </p>
    </div>
  );
}
