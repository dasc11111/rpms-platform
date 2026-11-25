"use client";


// §82 — Gestión de Comunicaciones y Correspondencia Oficial con CCHEN
// NS-06.0 §8.3 — DS 3/1985 Art. 10, 15
// Trazabilidad del diálogo regulatorio con la Comisión Chilena de Energía Nuclear

import { useEffect, useState, useCallback } from "react";
import {
  Mail, ArrowUpRight, ArrowDownLeft, Building2, RefreshCw,
  Plus, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckCircle,
  FileText, Send, Archive, Edit3, XCircle, Filter, Search,
  Flame, Bell, Calendar, ExternalLink, Tag, MessageSquare, ArrowRight
} from "lucide-react";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
import { RowPdfActions } from "@/components/ui/row-pdf-actions";

const API = "/api/cchen-communications";

type Communication = {
  id: number;
  comm_code: string;
  direction: "outgoing" | "incoming" | "internal";
  comm_type: string;
  subject: string;
  reference_number: string | null;
  cchen_reference: string | null;
  sender: string | null;
  recipient: string | null;
  comm_date: string;
  received_date: string | null;
  response_due_date: string | null;
  responded_date: string | null;
  status: string;
  priority: string;
  summary: string | null;
  content: string | null;
  attachments: string | null;
  related_module: string | null;
  related_id: number | null;
  tags: string | null;
  notes: string | null;
};

type Stats = {
  total: number;
  outgoing: number;
  incoming: number;
  response_pending: number;
  drafts: number;
  urgent: number;
  overdue_responses: number;
};

// --- helpers ---
function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.round(diff / 86400000);
}

const DIRECTION_LABEL: Record<string, string> = {
  outgoing: "Enviado",
  incoming: "Recibido",
  internal: "Interno",
};

const TYPE_LABEL: Record<string, string> = {
  letter: "Oficio",
  email: "Correo",
  report: "Informe",
  request: "Solicitud",
  response: "Respuesta",
  notification: "Notificación",
  inspection_report: "Informe Inspección",
  license_response: "Respuesta Licencia",
  annual_report: "Informe Anual",
  other: "Otro",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  received: "Recibido",
  acknowledged: "Acusado",
  response_pending: "Pte. Respuesta",
  responded: "Respondido",
  archived: "Archivado",
  cancelled: "Anulado",
};

function DirectionBadge({ dir }: { dir: string }) {
  if (dir === "incoming") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
      <ArrowDownLeft size={11} /> Recibido
    </span>
  );
  if (dir === "outgoing") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      <ArrowUpRight size={11} /> Enviado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
      <Building2 size={11} /> Interno
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    sent: "bg-blue-100 text-blue-700",
    received: "bg-blue-100 text-blue-700",
    acknowledged: "bg-teal-100 text-teal-700",
    response_pending: "bg-orange-100 text-orange-700",
    responded: "bg-green-100 text-green-700",
    archived: "bg-slate-100 text-slate-500",
    cancelled: "bg-red-100 text-red-500",
  };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "urgent") return <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><Flame size={11} /> Urgente</span>;
  if (priority === "high") return <span className="text-xs font-medium text-orange-500">Alta</span>;
  if (priority === "low") return <span className="text-xs text-slate-400">Baja</span>;
  return <span className="text-xs text-slate-500">Normal</span>;
}

function DueDateChip({ due, responded }: { due: string | null; responded: string | null }) {
  if (!due) return null;
  if (responded) return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <CheckCircle size={11} /> Respondido {fmt(responded)}
    </span>
  );
  const days = daysUntil(due);
  if (days === null) return null;
  if (days < 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle size={11} /> Vencido ({Math.abs(days)}d)</span>;
  if (days <= 14) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600"><Clock size={11} /> Vence en {days}d</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Calendar size={11} /> Plazo: {fmt(due)}</span>;
}

function borderColor(c: Communication) {
  if (c.priority === "urgent") return "border-red-500";
  if (c.status === "draft") return "border-slate-300";
  if (c.status === "response_pending") {
    const days = daysUntil(c.response_due_date);
    if (days !== null && days < 0) return "border-red-500";
    if (days !== null && days <= 14) return "border-orange-500";
    return "border-orange-300";
  }
  if (c.direction === "incoming") return "border-blue-400";
  if (c.direction === "outgoing") return "border-green-400";
  return "border-purple-300";
}

// --- CommModal ---
function CommModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    direction: "outgoing", comm_type: "letter", subject: "", reference_number: "",
    cchen_reference: "", sender: "", recipient: "", comm_date: new Date().toISOString().slice(0, 10),
    response_due_date: "", status: "draft", priority: "normal", summary: "", attachments: "", tags: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.subject.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    if (!payload.response_due_date) delete payload.response_due_date;
    if (!payload.reference_number) delete payload.reference_number;
    if (!payload.cchen_reference) delete payload.cchen_reference;
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    onSave();
    onClose();
  }

  const inp = "w-full border border-slate-200 rounded px-3 py-1.5 text-sm";
  const sel = inp + " bg-white";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Nueva Comunicación CCHEN</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle size={20}/></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dirección</label>
            <select className={sel} value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}>
              <option value="outgoing">Enviado (Hospital → CCHEN)</option>
              <option value="incoming">Recibido (CCHEN → Hospital)</option>
              <option value="internal">Interno</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select className={sel} value={form.comm_type} onChange={e=>setForm(f=>({...f,comm_type:e.target.value}))}>
              {Object.entries(TYPE_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Asunto *</label>
            <input className={inp} value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="Ej: Solicitud de renovación de licencia..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">N° Referencia Interna</label>
            <input className={inp} value={form.reference_number} onChange={e=>setForm(f=>({...f,reference_number:e.target.value}))} placeholder="DECL-CCHEN-2025-01" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">N° Referencia CCHEN</label>
            <input className={inp} value={form.cchen_reference} onChange={e=>setForm(f=>({...f,cchen_reference:e.target.value}))} placeholder="CCH-INS-2025-0089" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Remitente</label>
            <input className={inp} value={form.sender} onChange={e=>setForm(f=>({...f,sender:e.target.value}))} placeholder="TM. Diego Solís C. — Encargado PR" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Destinatario</label>
            <input className={inp} value={form.recipient} onChange={e=>setForm(f=>({...f,recipient:e.target.value}))} placeholder="División de Seguridad Radiológica, CCHEN" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input type="date" className={inp} value={form.comm_date} onChange={e=>setForm(f=>({...f,comm_date:e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Plazo de Respuesta</label>
            <input type="date" className={inp} value={form.response_due_date} onChange={e=>setForm(f=>({...f,response_due_date:e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select className={sel} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
              {Object.entries(STATUS_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Prioridad</label>
            <select className={sel} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="normal">Normal</option>
              <option value="low">Baja</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Resumen</label>
            <textarea className={inp} rows={3} value={form.summary} onChange={e=>setForm(f=>({...f,summary:e.target.value}))} placeholder="Descripción breve del contenido y propósito..." />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Adjuntos</label>
            <input className={inp} value={form.attachments} onChange={e=>setForm(f=>({...f,attachments:e.target.value}))} placeholder="Informe.pdf, Anexo.xlsx (separados por coma)" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Etiquetas</label>
            <input className={inp} value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="inspección,licencia,anual (separadas por coma)" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas internas</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Observaciones privadas (no van en la comunicación oficial)..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.subject.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>} Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// --- CommCard ---
function CommCard({ comm, onRefresh }: { comm: Communication; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Communication>>({});

  function startEdit() {
    setEditForm({
      status: comm.status, priority: comm.priority, notes: comm.notes ?? "",
      responded_date: comm.responded_date ?? "", summary: comm.summary ?? "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    await fetch(API, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comm.id, ...editForm }) });
    setEditing(false);
    onRefresh();
  }

  async function quickStatus(status: string) {
    const extra: Record<string, unknown> = { status };
    if (status === "responded") extra.responded_date = new Date().toISOString().slice(0, 10);
    await fetch(API, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comm.id, ...extra }) });
    onRefresh();
  }

  async function archive() {
    await fetch(API, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comm.id }) });
    onRefresh();
  }

  const inp = "border border-slate-200 rounded px-2 py-1 text-sm";
  const sel = inp + " bg-white";

  return (
    <div className={`bg-white rounded-xl border-l-4 ${borderColor(comm)} shadow-sm border border-slate-100 overflow-hidden`}>
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <DirectionBadge dir={comm.direction} />
              <span className="text-xs text-slate-500">{TYPE_LABEL[comm.comm_type] ?? comm.comm_type}</span>
              <StatusBadge status={comm.status} />
              <PriorityBadge priority={comm.priority} />
            </div>
            <p className="font-medium text-slate-800 text-sm leading-snug">{comm.subject}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs font-mono text-slate-400">{comm.comm_code}</span>
              {comm.cchen_reference && (
                <span className="text-xs text-blue-500 font-mono">CCHEN: {comm.cchen_reference}</span>
              )}
              <span className="text-xs text-slate-400">{fmt(comm.comm_date)}</span>
              <DueDateChip due={comm.response_due_date} responded={comm.responded_date} />
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 mt-1 flex-shrink-0">
            {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>

        {/* Summary preview */}
        {!open && comm.summary && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{comm.summary}</p>
        )}

        {/* Quick actions */}
        {!open && (
          <div className="flex gap-2 mt-3 flex-wrap" onClick={e=>e.stopPropagation()}>
            {comm.status === "draft" && (
              <button onClick={()=>quickStatus("sent")} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100">
                <Send size={11}/> Marcar Enviado
              </button>
            )}
            {comm.status === "sent" && comm.direction === "outgoing" && (
              <button onClick={()=>quickStatus("acknowledged")} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100">
                <CheckCircle size={11}/> Acusar Recibo
              </button>
            )}
            {comm.status === "response_pending" && (
              <button onClick={()=>quickStatus("responded")} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100">
                <CheckCircle size={11}/> Marcar Respondido
              </button>
            )}
            {(comm.status === "responded" || comm.status === "acknowledged") && (
              <button onClick={()=>quickStatus("archived")} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100">
                <Archive size={11}/> Archivar
              </button>
            )}
            <button onClick={startEdit} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100">
              <Edit3 size={11}/> Editar
            </button>
            <RowPdfActions module="cchen-communications" ownerType="cchen_communication" ownerId={String(comm.id)} size="xs" />
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {comm.sender && (
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Remitente</span>
                <p className="text-slate-700 mt-0.5">{comm.sender}</p>
              </div>
            )}
            {comm.recipient && (
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Destinatario</span>
                <p className="text-slate-700 mt-0.5">{comm.recipient}</p>
              </div>
            )}
          </div>

          {/* Summary */}
          {comm.summary && (
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Resumen</span>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">{comm.summary}</p>
            </div>
          )}

          {/* Dates grid */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-slate-400 mb-0.5">Fecha comunicación</p>
              <p className="font-medium text-slate-700">{fmt(comm.comm_date)}</p>
            </div>
            {comm.received_date && (
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-slate-400 mb-0.5">Fecha recepción</p>
                <p className="font-medium text-slate-700">{fmt(comm.received_date)}</p>
              </div>
            )}
            {comm.response_due_date && (
              <div className={`rounded-lg p-2 ${(daysUntil(comm.response_due_date) ?? 999) < 0 ? "bg-red-50" : "bg-orange-50"}`}>
                <p className="text-slate-400 mb-0.5">Plazo respuesta</p>
                <p className="font-medium text-slate-700">{fmt(comm.response_due_date)}</p>
              </div>
            )}
            {comm.responded_date && (
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-slate-400 mb-0.5">Respondido</p>
                <p className="font-medium text-green-700">{fmt(comm.responded_date)}</p>
              </div>
            )}
          </div>

          {/* Attachments */}
          {comm.attachments && (
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                <FileText size={11}/> Adjuntos
              </span>
              <div className="flex flex-wrap gap-1.5">
                {comm.attachments.split(",").map((a, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5 font-mono">{a.trim()}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {comm.tags && (
            <div className="flex flex-wrap gap-1.5">
              {comm.tags.split(",").map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">
                  <Tag size={10}/>{t.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {comm.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-700 mb-1 flex items-center gap-1"><MessageSquare size={11}/> Notas internas</p>
              <p className="text-xs text-yellow-800">{comm.notes}</p>
            </div>
          )}

          {/* Edit form inline */}
          {editing && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3" onClick={e=>e.stopPropagation()}>
              <p className="text-xs font-semibold text-blue-700">Editar comunicación</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Estado</label>
                  <select className={sel} value={editForm.status ?? ""} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))}>
                    {Object.entries(STATUS_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Prioridad</label>
                  <select className={sel} value={editForm.priority ?? ""} onChange={e=>setEditForm(f=>({...f,priority:e.target.value}))}>
                    <option value="urgent">Urgente</option>
                    <option value="high">Alta</option>
                    <option value="normal">Normal</option>
                    <option value="low">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Fecha Respondido</label>
                  <input type="date" className={inp} value={(editForm.responded_date as string) ?? ""} onChange={e=>setEditForm(f=>({...f,responded_date:e.target.value}))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-600 block mb-1">Notas</label>
                  <textarea className={inp + " w-full"} rows={2} value={(editForm.notes as string) ?? ""} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <CheckCircle size={12}/> Guardar
                </button>
                <button onClick={()=>setEditing(false)} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white">Cancelar</button>
              </div>
            </div>
          )}

          {/* Action row */}
          {!editing && (
            <div className="flex gap-2 flex-wrap pt-1" onClick={e=>e.stopPropagation()}>
              {comm.status === "draft" && (
                <button onClick={()=>quickStatus("sent")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">
                  <Send size={12}/> Marcar Enviado
                </button>
              )}
              {comm.status === "response_pending" && (
                <button onClick={()=>quickStatus("responded")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
                  <CheckCircle size={12}/> Marcar Respondido
                </button>
              )}
              {comm.status === "sent" && comm.direction === "outgoing" && (
                <button onClick={()=>quickStatus("response_pending")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100">
                  <Bell size={12}/> Registrar plazo respuesta
                </button>
              )}
              <button onClick={startEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100">
                <Edit3 size={12}/> Editar
              </button>
              <button onClick={archive} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 ml-auto">
                <Archive size={12}/> Eliminar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main page ---
export default function CCHENCommunicationsPage() {
  const [data, setData] = useState<Communication[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dirFilter, setDirFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (dirFilter) sp.set("direction", dirFilter);
    if (statusFilter) sp.set("status", statusFilter);
    if (typeFilter) sp.set("type", typeFilter);
    if (q) sp.set("q", q);
    const res = await fetch(`${API}?${sp}`);
    const json = await res.json();
    setData(json.communications ?? []);
    setStats(json.stats ?? null);
    setLoading(false);
  }, [dirFilter, statusFilter, typeFilter, q]);

  useEffect(() => { load(); }, [load]);

  const overdue = data.filter(c => c.status === "response_pending" && (daysUntil(c.response_due_date) ?? 1) < 0);
  const urgent = data.filter(c => c.priority === "urgent" && !["archived","cancelled"].includes(c.status));
  const drafts = data.filter(c => c.status === "draft");

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail size={22} className="text-blue-600"/>
              <h1 className="text-xl font-semibold text-slate-800">Comunicaciones CCHEN</h1>
            </div>
            <p className="text-sm text-slate-500">
              Correspondencia oficial con la Comisión Chilena de Energía Nuclear — NS-06.0 §8.3
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 shadow-sm"
          >
            <Plus size={16}/> Nueva Comunicación
          </button>
        </div>

        {/* Alert banners */}
        {overdue.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-600 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="font-semibold text-red-700 text-sm">
                {overdue.length} respuesta{overdue.length>1?"s":""} vencida{overdue.length>1?"s":""}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Plazos superados: {overdue.map(c=>c.comm_code).join(", ")} — Riesgo incumplimiento regulatorio
              </p>
            </div>
          </div>
        )}
        {urgent.length > 0 && overdue.length === 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <Flame size={18} className="text-orange-600 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="font-semibold text-orange-700 text-sm">
                {urgent.length} comunicación{urgent.length>1?"es":""} urgente{urgent.length>1?"s":""}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">Requieren atención inmediata</p>
            </div>
          </div>
        )}
        {drafts.length > 0 && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <Edit3 size={18} className="text-slate-500 mt-0.5 flex-shrink-0"/>
            <div>
              <p className="font-semibold text-slate-700 text-sm">{drafts.length} borrador{drafts.length>1?"es":""} pendiente{drafts.length>1?"s":""}</p>
              <p className="text-xs text-slate-500 mt-0.5">Comunicaciones no enviadas aún</p>
            </div>
          </div>
        )}

        {/* KPI tiles */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                <span className="text-green-600">↑ {stats.outgoing} enviados</span>
                <span className="text-blue-600">↓ {stats.incoming} recibidos</span>
              </div>
            </div>
            <div className={`bg-white rounded-xl border p-4 shadow-sm ${(stats.overdue_responses > 0) ? "border-red-200" : "border-slate-100"}`}>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Pte. Respuesta</p>
              <p className={`text-3xl font-bold mt-1 ${stats.response_pending > 0 ? "text-orange-600" : "text-slate-800"}`}>{stats.response_pending}</p>
              {stats.overdue_responses > 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={10}/> {stats.overdue_responses} vencida{stats.overdue_responses>1?"s":""}</p>
              )}
            </div>
            <div className={`bg-white rounded-xl border p-4 shadow-sm ${stats.urgent > 0 ? "border-orange-200" : "border-slate-100"}`}>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Urgentes</p>
              <p className={`text-3xl font-bold mt-1 ${stats.urgent > 0 ? "text-red-600" : "text-slate-800"}`}>{stats.urgent}</p>
              <p className="text-xs text-slate-400 mt-1">Prioridad máxima</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Borradores</p>
              <p className="text-3xl font-bold text-slate-600 mt-1">{stats.drafts}</p>
              <p className="text-xs text-slate-400 mt-1">Sin enviar aún</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
              <input
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
                placeholder="Buscar asunto, referencia..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
              <select className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white appearance-none" value={dirFilter} onChange={e => setDirFilter(e.target.value)}>
                <option value="">Todas las direcciones</option>
                <option value="outgoing">Enviadas</option>
                <option value="incoming">Recibidas</option>
                <option value="internal">Internas</option>
              </select>
            </div>
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
            </select>
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_LABEL).map(([v,l])=>(<option key={v} value={v}>{l}</option>))}
            </select>
          </div>
        </div>

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="cchen-communications"
        ownerType="module"
        title="Documentos del módulo"
      />


        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-3"/> Cargando comunicaciones...
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
            <Mail size={36} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">Sin comunicaciones registradas</p>
            <p className="text-xs mt-1">Registra la correspondencia oficial con CCHEN</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(c => (
              <CommCard key={c.id} comm={c} onRefresh={load} />
            ))}
          </div>
        )}

        {/* Footer note */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <ExternalLink size={16} className="text-blue-500 mt-0.5 flex-shrink-0"/>
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">Marco regulatorio — NS-06.0 §8.3 / DS 3/1985 Art. 10 y 15</p>
            <p>Toda comunicación formal con CCHEN debe registrarse y archivarse. Los plazos de respuesta ante requerimientos de la autoridad regulatoria deben cumplirse estrictamente. Las notificaciones de incidentes deben realizarse dentro de las 24 horas conforme al Art. 15 DS 3/1985.</p>
          </div>
        </div>

      </div>

      {showModal && <CommModal onClose={() => setShowModal(false)} onSave={load} />}
    </div>
  );
}
