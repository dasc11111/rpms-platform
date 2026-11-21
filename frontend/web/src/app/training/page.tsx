"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, Plus, Trash2, RefreshCw, CheckCircle2,
  Clock, AlertTriangle, BookOpen, Award, Users, Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Course {
  id: number;
  course_code: string;
  course_name: string;
  category: string;
  instructor: string | null;
  scheduled_date: string;
  duration_hours: number;
  status: string;
  participants_registered: number;
  participants_attended: number;
  participants_passed: number;
  regulatory_basis: string | null;
  certificate_valid_months: number;
  notes: string | null;
}

interface Stats {
  total: number;
  completed: number;
  scheduled: number;
  in_progress: number;
  total_hours_delivered: number;
  total_passed: number;
  total_attended: number;
}

const CAT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  basic_rp:    { label: "PR Básica",           color: "text-blue-700",   bg: "bg-blue-100" },
  advanced_rp: { label: "PR Avanzada",          color: "text-purple-700", bg: "bg-purple-100" },
  emergency:   { label: "Emergencias",          color: "text-red-700",    bg: "bg-red-100" },
  equipment:   { label: "Equipamiento",         color: "text-amber-700",  bg: "bg-amber-100" },
  regulatory:  { label: "Marco regulatorio",    color: "text-green-700",  bg: "bg-green-100" },
  clinical:    { label: "Procedimientos clín.", color: "text-cyan-700",   bg: "bg-cyan-100" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  scheduled:   { label: "Programado",   color: "text-blue-700",  bg: "bg-blue-100",  icon: Clock },
  in_progress: { label: "En curso",     color: "text-amber-700", bg: "bg-amber-100", icon: AlertTriangle },
  completed:   { label: "Completado",   color: "text-green-700", bg: "bg-green-100", icon: CheckCircle2 },
  failed:      { label: "Reprobado",    color: "text-red-700",   bg: "bg-red-100",   icon: AlertTriangle },
  cancelled:   { label: "Cancelado",    color: "text-gray-500",  bg: "bg-gray-100",  icon: Clock },
};

const CATEGORIES = Object.entries(CAT_CONFIG).map(([k, v]) => ({ value: k, label: v.label }));
const STATUSES = Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }));

const REG_OPTIONS = [
  "NS-06.0 §16 — CCHEN",
  "DS 133/1984 Art. 23 — MINSAL",
  "IAEA Safety Series No. 38",
  "IAEA-TECDOC-1683",
  "IAEA EPR-2016",
  "DS 3/1985 — MINSAL",
  "NS-04 CCHEN",
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-600", bg: "bg-gray-100", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function CatBadge({ cat }: { cat: string }) {
  const cfg = CAT_CONFIG[cat] ?? { label: cat, color: "text-gray-700", bg: "bg-gray-100" };
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}

function PassRate({ attended, passed }: { attended: number; passed: number }) {
  if (!attended) return <span className="text-gray-400 text-xs">—</span>;
  const pct = Math.round((passed / attended) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={cn("h-full rounded-full", pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600">{pct}%</span>
    </div>
  );
}

const DEFAULT_FORM = {
  course_code: "",
  course_name: "",
  category: "basic_rp",
  instructor: "",
  scheduled_date: new Date().toISOString().slice(0, 10),
  duration_hours: "8",
  status: "scheduled",
  participants_registered: "0",
  participants_attended: "0",
  participants_passed: "0",
  regulatory_basis: "NS-06.0 §16 — CCHEN",
  certificate_valid_months: "12",
  notes: "",
};

export default function TrainingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCat) params.set("category", filterCat);
      const res = await fetch(`/api/training?${params}`);
      const json = await res.json();
      setCourses(json.courses ?? []);
      setStats(json.stats ?? null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filterStatus, filterCat]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => { setEditId(null); setForm({ ...DEFAULT_FORM }); setShowModal(true); };
  const openEdit = (c: Course) => {
    setEditId(c.id);
    setForm({
      course_code: c.course_code,
      course_name: c.course_name,
      category: c.category,
      instructor: c.instructor ?? "",
      scheduled_date: c.scheduled_date.slice(0, 10),
      duration_hours: String(c.duration_hours),
      status: c.status,
      participants_registered: String(c.participants_registered),
      participants_attended: String(c.participants_attended),
      participants_passed: String(c.participants_passed),
      regulatory_basis: c.regulatory_basis ?? "",
      certificate_valid_months: String(c.certificate_valid_months),
      notes: c.notes ?? "",
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditId(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      course_code: form.course_code,
      course_name: form.course_name,
      category: form.category,
      instructor: form.instructor || null,
      scheduled_date: form.scheduled_date,
      duration_hours: parseFloat(form.duration_hours) || 1,
      status: form.status,
      participants_registered: parseInt(form.participants_registered) || 0,
      participants_attended: parseInt(form.participants_attended) || 0,
      participants_passed: parseInt(form.participants_passed) || 0,
      regulatory_basis: form.regulatory_basis || null,
      certificate_valid_months: parseInt(form.certificate_valid_months) || 12,
      notes: form.notes || null,
    };
    try {
      if (editId !== null) {
        await fetch(`/api/training?id=${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      closeModal();
      fetchData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este curso?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/training?id=${id}`, { method: "DELETE" });
      fetchData();
    } finally { setDeleting(null); }
  };

  const kpiCards = [
    { label: "Total cursos", value: stats?.total ?? 0, icon: BookOpen, color: "text-blue-600" },
    { label: "Completados", value: stats?.completed ?? 0, icon: CheckCircle2, color: "text-green-600" },
    { label: "Programados", value: stats?.scheduled ?? 0, icon: Clock, color: "text-blue-500" },
    { label: "Horas impartidas", value: `${Math.round(stats?.total_hours_delivered ?? 0)}h`, icon: Award, color: "text-purple-600" },
    { label: "Participantes", value: stats?.total_attended ?? 0, icon: Users, color: "text-cyan-600" },
    { label: "Aprobados", value: stats?.total_passed ?? 0, icon: GraduationCap, color: "text-emerald-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-blue-600" />
            Capacitación en Protección Radiológica
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Registro y seguimiento de formación del personal TOE · NS-06.0 §16 / DS 133/1984 Art. 23
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Registrar Curso
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {kpiCards.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white border rounded-xl p-4 shadow-sm">
              <Icon className={cn("w-5 h-5 mb-2", k.color)} />
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className={cn("text-2xl font-bold", k.color)}>{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {(filterStatus || filterCat) && (
          <button onClick={() => { setFilterStatus(""); setFilterCat(""); }}
            className="text-xs text-blue-600 hover:underline">Limpiar filtros</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Registro de cursos de capacitación</h2>
          {courses.length > 0 && <span className="ml-auto text-xs text-gray-400">{courses.length} registros</span>}
        </div>
        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando cursos…</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Sin cursos registrados.</p>
            <button onClick={openNew} className="mt-3 text-blue-600 hover:underline text-sm">Registrar primer curso</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Código</th>
                  <th className="text-left px-4 py-3">Curso</th>
                  <th className="text-left px-4 py-3">Categoría</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Duración</th>
                  <th className="text-left px-4 py-3">Instructor</th>
                  <th className="text-left px-4 py-3">Participantes</th>
                  <th className="text-left px-4 py-3">Aprobación</th>
                  <th className="text-left px-4 py-3">Vigencia cert.</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {courses.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{c.course_code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.course_name}</p>
                      {c.regulatory_basis && <p className="text-xs text-gray-400">{c.regulatory_basis}</p>}
                    </td>
                    <td className="px-4 py-3"><CatBadge cat={c.category} /></td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(c.scheduled_date).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.duration_hours}h</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.instructor ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {c.participants_attended}/{c.participants_registered} asist.
                    </td>
                    <td className="px-4 py-3">
                      <PassRate attended={c.participants_attended} passed={c.participants_passed} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.certificate_valid_months} meses</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                          className="text-gray-400 hover:text-red-600 p-1 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Regulatory note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Fundamento normativo:</strong> NS-06.0 §16 (CCHEN) y DS 133/1984 Art. 23 (MINSAL) establecen
        la obligación de capacitación anual mínima de 8 horas para todo trabajador ocupacionalmente expuesto (TOE).
        Los simulacros de emergencia radiológica son anuales (DS 133/1984 Art. 47). Se recomienda certificar
        mediante evaluación escrita con tasa de aprobación ≥ 80%.
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editId ? "Editar curso" : "Registrar curso de capacitación"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                  <input required value={form.course_code}
                    onChange={e => setForm(f => ({ ...f, course_code: e.target.value }))}
                    placeholder="CAP-RP-001"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del curso *</label>
                  <input required value={form.course_name}
                    onChange={e => setForm(f => ({ ...f, course_name: e.target.value }))}
                    placeholder="Protección Radiológica Básica NS-06.0"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                  <input required type="date" value={form.scheduled_date}
                    onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración (h)</label>
                  <input type="number" step="0.5" min="0.5" value={form.duration_hours}
                    onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vigencia cert. (meses)</label>
                  <input type="number" value={form.certificate_valid_months}
                    onChange={e => setForm(f => ({ ...f, certificate_valid_months: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
                  <input value={form.instructor}
                    onChange={e => setForm(f => ({ ...f, instructor: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base regulatoria</label>
                  <select value={form.regulatory_basis}
                    onChange={e => setForm(f => ({ ...f, regulatory_basis: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {REG_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registrados</label>
                  <input type="number" value={form.participants_registered}
                    onChange={e => setForm(f => ({ ...f, participants_registered: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asistentes</label>
                  <input type="number" value={form.participants_attended}
                    onChange={e => setForm(f => ({ ...f, participants_attended: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aprobados</label>
                  <input type="number" value={form.participants_passed}
                    onChange={e => setForm(f => ({ ...f, participants_passed: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea value={form.notes} rows={2}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Guardando…" : editId ? "Actualizar" : "Guardar Curso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
