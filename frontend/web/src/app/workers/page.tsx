"use client";


import { useState, useEffect, useCallback, type ComponentType } from "react";
import {
  Users, Plus, Pencil, Trash2, X, Save, Search, RefreshCw,
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, FileText,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SendEmailModal } from "@/components/workers/send-email-modal";
import { ModulePdfPanel } from "@/components/ui/module-pdf-panel";
import { RowPdfActions } from "@/components/ui/row-pdf-actions";

interface Worker {
  rut: string;
  name: string;
  last_name_1: string | null;
  last_name_2: string | null;
  first_names: string | null;
  role: string | null;
  service: string | null;
  category: string | null;
  status: string;
  annual_dose: number;
  sex: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  estamento: string | null;
  contract_type: string | null;
  unit: string | null;
  course_pr_completed: boolean;
  course_pr_date: string | null;
  authorization_number: string | null;
  authorization_issue_date: string | null;
  authorization_expiry_date: string | null;
  notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: ComponentType<LucideProps> }> = {
  active:     { label: "Activo",     color: "bg-green-100 text-green-800",  icon: CheckCircle2 },
  suspended:  { label: "Suspendido", color: "bg-amber-100 text-amber-800",  icon: Clock },
  inactive:   { label: "Inactivo",   color: "bg-muted text-muted-foreground",    icon: X },
};

const CATEGORY_OPTIONS = ["A", "B"];
const STATUS_OPTIONS = ["active", "suspended", "inactive"];

const DEFAULT_FORM = {
  rut: "", name: "", last_name_1: "", last_name_2: "", first_names: "",
  role: "", service: "", category: "B", status: "active",
  sex: "", address: "", phone: "", email: "", birth_date: "",
  estamento: "", contract_type: "", unit: "",
  course_pr_completed: false, course_pr_date: "",
  authorization_number: "", authorization_issue_date: "", authorization_expiry_date: "",
  notes: "",
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState<typeof DEFAULT_FORM>({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      else params.set("all", "1");
      const res = await fetch(`/api/workers?${params}`);
      const data = await res.json();
      setWorkers(data.workers ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...DEFAULT_FORM });
    setError(null); setShowModal(true);
  };
  const openEdit = (w: Worker) => {
    setEditing(w);
    setForm({
      rut: w.rut,
      name: w.name,
      last_name_1: w.last_name_1 ?? "",
      last_name_2: w.last_name_2 ?? "",
      first_names: w.first_names ?? "",
      role: w.role ?? "",
      service: w.service ?? "",
      category: w.category ?? "B",
      status: w.status,
      sex: w.sex ?? "",
      address: w.address ?? "",
      phone: w.phone ?? "",
      email: w.email ?? "",
      birth_date: w.birth_date?.slice(0, 10) ?? "",
      estamento: w.estamento ?? "",
      contract_type: w.contract_type ?? "",
      unit: w.unit ?? "",
      course_pr_completed: w.course_pr_completed ?? false,
      course_pr_date: w.course_pr_date?.slice(0, 10) ?? "",
      authorization_number: w.authorization_number ?? "",
      authorization_issue_date: w.authorization_issue_date?.slice(0, 10) ?? "",
      authorization_expiry_date: w.authorization_expiry_date?.slice(0, 10) ?? "",
      notes: w.notes ?? "",
    });
    setError(null); setShowModal(true);
  };

  const handleSave = async (ev: { preventDefault: () => void }) => {
    ev.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        rut: form.rut,
        name: [form.last_name_1, form.last_name_2, form.first_names].filter(Boolean).join(" ") || form.name,
        last_name_1: form.last_name_1 || null,
        last_name_2: form.last_name_2 || null,
        first_names: form.first_names || null,
        role: form.role || null,
        service: form.service || null,
        category: form.category || null,
        status: form.status,
        sex: form.sex || null,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        birth_date: form.birth_date || null,
        estamento: form.estamento || null,
        contract_type: form.contract_type || null,
        unit: form.unit || null,
        course_pr_completed: form.course_pr_completed,
        course_pr_date: form.course_pr_date || null,
        authorization_number: form.authorization_number || null,
        authorization_issue_date: form.authorization_issue_date || null,
        authorization_expiry_date: form.authorization_expiry_date || null,
        notes: form.notes || null,
      };
      let res: Response;
      if (editing) {
        res = await fetch("/api/workers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/workers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: [{ ...payload, annual_dose: 0 }] }),
        });
      }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error"); }
      setShowModal(false); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (w: Worker) => {
    if (!confirm(`¿Dar de baja a ${w.name}? Se marcará como inactivo.`)) return;
    await fetch(`/api/workers?rut=${encodeURIComponent(w.rut)}`, { method: "DELETE" });
    load();
  };

  // KPIs
  const active = workers.filter(w => w.status === "active").length;
  const catA = workers.filter(w => w.category === "A" && w.status === "active").length;
  const authExpiring = workers.filter(w => {
    if (!w.authorization_expiry_date || w.status !== "active") return false;
    const days = (new Date(w.authorization_expiry_date).getTime() - Date.now()) / 86400000;
    return days <= 30;
  }).length;
  const courseNeeded = workers.filter(w => w.status === "active" && !w.course_pr_completed).length;

  const filtered = workers.filter(w => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [w.name, w.rut, w.role, w.service, w.unit].some(v => v?.toLowerCase().includes(q));
  });

  const authExpiry = (d: string | null) => {
    if (!d) return null;
    const days = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
    return days;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trabajadores Ocupacionalmente Expuestos</h1>
            <p className="text-sm text-muted-foreground">Registro TOE · DS 3/1985 MINSAL Art. 7 · NS-04 CCHEN</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background text-sm hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
          <SendEmailModal />
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
            <Plus className="h-4 w-4" /> Nuevo trabajador
          </button>
        </div>
      </div>

      {/* Panel de documentos del módulo */}
      <ModulePdfPanel
        module="workers"
        ownerType="module"
        title="Documentos del módulo Trabajadores"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Activos", value: active, icon: Users, color: "text-blue-500" },
          { label: "Categoría A", value: catA, icon: ShieldCheck, color: "text-purple-500" },
          { label: "Autorización vencida/próxima", value: authExpiring, icon: AlertTriangle, color: authExpiring > 0 ? "text-red-500" : "text-muted-foreground" },
          { label: "Sin curso PR", value: courseNeeded, icon: FileText, color: courseNeeded > 0 ? "text-amber-500" : "text-muted-foreground" },
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RUT, cargo, servicio…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm">
          <option value="active">Activos</option>
          <option value="suspended">Suspendidos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">RUT</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cargo / Servicio</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cat.</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Autorización</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Curso PR</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">Cargando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">No se encontraron trabajadores</td></tr>
            ) : filtered.map(w => {
              const stCfg = STATUS_CONFIG[w.status] ?? STATUS_CONFIG.inactive;
              const StIcon = stCfg.icon;
              const expDays = authExpiry(w.authorization_expiry_date);
              const authColor = expDays === null ? "" : expDays < 0 ? "text-red-600 font-semibold" : expDays <= 30 ? "text-amber-600 font-semibold" : "text-green-700";
              return (
                <tr key={w.rut} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{w.rut}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.role && <div>{w.role}</div>}
                    {w.service && <div className="text-xs">{w.service}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {w.category && (
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold",
                        w.category === "A" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800")}>
                        Cat. {w.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit", stCfg.color)}>
                      <StIcon className="h-3 w-3" />{stCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {w.authorization_number && (
                      <div className="text-xs font-mono">{w.authorization_number}</div>
                    )}
                    {w.authorization_expiry_date && (
                      <div className={cn("text-xs", authColor)}>
                        Vence: {new Date(w.authorization_expiry_date).toLocaleDateString("es-CL")}
                        {expDays !== null && expDays < 0 && " ⚠ VENCIDA"}
                        {expDays !== null && expDays >= 0 && expDays <= 30 && ` (${expDays}d)`}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {w.course_pr_completed
                      ? <span className="flex items-center gap-1 text-green-700 text-xs"><CheckCircle2 className="h-3 w-3" /> Completado</span>
                      : <span className="flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle className="h-3 w-3" /> Pendiente</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {w.email && (
                        <SendEmailModal
                          worker={{ rut: w.rut, displayName: w.name, email: w.email }}
                        />
                      )}
                      <RowPdfActions module="workers" ownerType="worker" ownerId={w.rut} />
                      <button onClick={() => openEdit(w)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {w.status !== "inactive" && (
                        <button onClick={() => handleDeactivate(w)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background">
              <h2 className="text-lg font-semibold">{editing ? "Editar Trabajador" : "Nuevo Trabajador"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

              {/* Identificación */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Identificación</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">RUT *</label>
                    <input required value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))}
                      disabled={!!editing}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm disabled:opacity-60" placeholder="12.345.678-9" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Apellido paterno</label>
                    <input value={form.last_name_1} onChange={e => setForm(f => ({ ...f, last_name_1: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Apellido materno</label>
                    <input value={form.last_name_2} onChange={e => setForm(f => ({ ...f, last_name_2: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombres</label>
                    <input value={form.first_names} onChange={e => setForm(f => ({ ...f, first_names: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Sexo</label>
                    <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                      <option value="">—</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha nacimiento</label>
                    <input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                </div>
              </div>

              {/* Cargo */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Cargo y clasificación</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Cargo / Rol</label>
                    <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Tecnólogo Médico, Médico Nuclear…" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Servicio / Área</label>
                    <input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Medicina Nuclear, Radioterapia…" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Unidad</label>
                    <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Estamento</label>
                    <input value={form.estamento} onChange={e => setForm(f => ({ ...f, estamento: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Profesional, Técnico, Administrativo…" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Categoría TOE</label>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                      {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>Categoría {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Estado</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm">
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Calidad contractual</label>
                    <input value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" placeholder="Planta, Contrata, Honorarios…" />
                  </div>
                </div>
              </div>

              {/* Autorización CCHEN */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Autorización CCHEN (Desempeño PR)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">N° Autorización</label>
                    <input value={form.authorization_number} onChange={e => setForm(f => ({ ...f, authorization_number: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha emisión</label>
                    <input type="date" value={form.authorization_issue_date} onChange={e => setForm(f => ({ ...f, authorization_issue_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha vencimiento</label>
                    <input type="date" value={form.authorization_expiry_date} onChange={e => setForm(f => ({ ...f, authorization_expiry_date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                </div>
              </div>

              {/* Curso PR */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Capacitación en Protección Radiológica</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.course_pr_completed}
                      onChange={e => setForm(f => ({ ...f, course_pr_completed: e.target.checked }))}
                      className="rounded" />
                    Curso PR completado
                  </label>
                  {form.course_pr_completed && (
                    <div className="flex-1">
                      <input type="date" value={form.course_pr_date} onChange={e => setForm(f => ({ ...f, course_pr_date: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                    </div>
                  )}
                </div>
              </div>

              {/* Contacto */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Datos de contacto</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Teléfono</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar trabajador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
