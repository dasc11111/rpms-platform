"use client";


import { useState, useEffect, useCallback } from "react";
import { ArrowRightLeft, Plus, Trash2, Pencil, RefreshCw, Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

interface Movement {
  id: number;
  source_id: number;
  source_name: string;
  isotope: string | null;
  serial_number: string | null;
  movement_type: string;
  movement_date: string;
  origin_location: string | null;
  destination_location: string | null;
  responsible: string | null;
  authorized_by: string | null;
  document_ref: string | null;
  expected_return_date: string | null;
  activity_gbq: number | null;
  notes: string | null;
}

interface SummaryResponse {
  by_type: { movement_type: string; count: number }[];
  on_loan: Movement[];
  on_loan_count: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; dir?: string }> = {
  alta:          { label: "Alta",          color: "text-green-700",  bg: "bg-green-100",  icon: ArrowUpCircle,   dir: "Ingreso" },
  baja:          { label: "Baja",          color: "text-red-700",    bg: "bg-red-100",    icon: ArrowDownCircle, dir: "Egreso definitivo" },
  prestamo:      { label: "Préstamo",      color: "text-amber-700",  bg: "bg-amber-100",  icon: ArrowRightLeft,  dir: "Salida temporal" },
  devolucion:    { label: "Devolución",    color: "text-blue-700",   bg: "bg-blue-100",   icon: Repeat,          dir: "Retorno" },
  traslado:      { label: "Traslado",      color: "text-purple-700", bg: "bg-purple-100", icon: ArrowRightLeft,  dir: "Cambio ubicación" },
  transferencia: { label: "Transferencia", color: "text-orange-700", bg: "bg-orange-100", icon: ArrowRightLeft,  dir: "Traspaso" },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, color: "text-foreground/80", bg: "bg-muted", icon: ArrowRightLeft };
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

const MOVEMENT_TYPES = ["alta", "baja", "prestamo", "devolucion", "traslado", "transferencia"];

export default function SourceMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm] = useState({
    source_id: "",
    source_name: "",
    isotope: "",
    serial_number: "",
    movement_type: "prestamo",
    movement_date: new Date().toISOString().slice(0, 10),
    origin_location: "",
    destination_location: "",
    responsible: "",
    authorized_by: "",
    document_ref: "",
    expected_return_date: "",
    activity_gbq: "",
    notes: "",
  });

  const closeModal = () => { setShowModal(false); setEditing(null); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [movRes, sumRes] = await Promise.all([
        fetch(`/api/sources/movements${filterType ? `?type=${filterType}` : ""}`),
        fetch("/api/sources/movements?summary=1"),
      ]);
      const movJson = await movRes.json();
      const sumJson = await sumRes.json();
      setMovements(movJson.movements ?? []);
      setSummary(sumJson);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const EMPTY_FORM = {
    source_id: "",
    source_name: "",
    isotope: "",
    serial_number: "",
    movement_type: "prestamo",
    movement_date: new Date().toISOString().slice(0, 10),
    origin_location: "",
    destination_location: "",
    responsible: "",
    authorized_by: "",
    document_ref: "",
    expected_return_date: "",
    activity_gbq: "",
    notes: "",
  };

  const openEdit = (m: Movement) => {
    setEditing(m);
    setForm({
      source_id: String(m.source_id ?? ""),
      source_name: m.source_name ?? "",
      isotope: m.isotope ?? "",
      serial_number: m.serial_number ?? "",
      movement_type: m.movement_type ?? "prestamo",
      movement_date: m.movement_date ? m.movement_date.slice(0, 10) : "",
      origin_location: m.origin_location ?? "",
      destination_location: m.destination_location ?? "",
      responsible: m.responsible ?? "",
      authorized_by: m.authorized_by ?? "",
      document_ref: m.document_ref ?? "",
      expected_return_date: m.expected_return_date ? m.expected_return_date.slice(0, 10) : "",
      activity_gbq: m.activity_gbq != null ? String(m.activity_gbq) : "",
      notes: m.notes ?? "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        source_id: parseInt(form.source_id) || 0,
        source_name: form.source_name,
        isotope: form.isotope || null,
        serial_number: form.serial_number || null,
        movement_type: form.movement_type,
        movement_date: form.movement_date,
        origin_location: form.origin_location || null,
        destination_location: form.destination_location || null,
        responsible: form.responsible || null,
        authorized_by: form.authorized_by || null,
        document_ref: form.document_ref || null,
        expected_return_date: form.expected_return_date || null,
        activity_gbq: form.activity_gbq ? parseFloat(form.activity_gbq) : null,
        notes: form.notes || null,
      };
      if (editing) {
        await fetch(`/api/sources/movements?id=${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/sources/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      fetchData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este movimiento IMAR?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/sources/movements?id=${id}`, { method: "DELETE" });
      fetchData();
    } finally { setDeleting(null); }
  };

  const countByType = (type: string) => summary?.by_type?.find(b => b.movement_type === type)?.count ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-blue-600" />
            Movimientos IMAR — Fuentes Radiactivas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro de altas, bajas y traslados de fuentes · NS-04 / NS-06.0 — CCHEN
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-muted/50">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditing(null); setForm(f => ({ ...f, source_id: "", source_name: "", isotope: "", serial_number: "", origin_location: "", destination_location: "", responsible: "", authorized_by: "", document_ref: "", expected_return_date: "", activity_gbq: "", notes: "", movement_date: new Date().toISOString().slice(0, 10) })); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Registrar Movimiento
          </button>
        </div>
      </div>

      {/* On loan alert */}
      {(summary?.on_loan_count ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">{summary?.on_loan_count} fuente(s) actualmente en préstamo</p>
            <div className="mt-1 space-y-0.5">
              {summary?.on_loan.slice(0, 3).map(m => (
                <p key={m.id} className="text-sm text-amber-700">
                  {m.source_name} {m.isotope ? `(${m.isotope})` : ""} → {m.destination_location ?? "destino s/d"}
                  {m.expected_return_date ? ` · retorno esperado: ${new Date(m.expected_return_date).toLocaleDateString("es-CL")}` : ""}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {MOVEMENT_TYPES.map(type => {
          const cfg = TYPE_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? "" : type)}
              className={cn(
                "border rounded-xl p-3 text-left transition-all shadow-sm",
                filterType === type ? `${cfg.bg} border-current` : "bg-background hover:bg-muted/50"
              )}
            >
              <Icon className={cn("w-4 h-4 mb-1", cfg.color)} />
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
              <p className={cn("text-2xl font-bold", cfg.color)}>{countByType(type)}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-background border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">
              {filterType ? `Movimientos: ${TYPE_CONFIG[filterType]?.label ?? filterType}` : "Todos los movimientos IMAR"}
            </h2>
          </div>
          {filterType && (
            <button onClick={() => setFilterType("")} className="text-xs text-blue-600 hover:underline">Ver todos</button>
          )}
        </div>
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando movimientos…</div>
        ) : movements.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Sin movimientos registrados{filterType ? ` del tipo "${TYPE_CONFIG[filterType]?.label}"` : ""}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Fuente</th>
                  <th className="text-left px-4 py-3">Origen → Destino</th>
                  <th className="text-left px-4 py-3">Actividad (GBq)</th>
                  <th className="text-left px-4 py-3">Responsable</th>
                  <th className="text-left px-4 py-3">Documento</th>
                  <th className="text-left px-4 py-3">Retorno esp.</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3 text-foreground/80 text-xs whitespace-nowrap">
                      {new Date(m.movement_date).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-4 py-3"><TypeBadge type={m.movement_type} /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{m.source_name}</p>
                      <p className="text-xs text-muted-foreground">{[m.isotope, m.serial_number].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.origin_location && <span>{m.origin_location}</span>}
                      {m.origin_location && m.destination_location && <span className="mx-1">→</span>}
                      {m.destination_location && <span className="font-medium">{m.destination_location}</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground/80">
                      {m.activity_gbq != null ? `${Number(m.activity_gbq).toFixed(3)} GBq` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <p>{m.responsible ?? "—"}</p>
                      {m.authorized_by && <p className="text-muted-foreground">Aut: {m.authorized_by}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.document_ref ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {m.expected_return_date ? (
                        <span className={cn(
                          new Date(m.expected_return_date) < new Date() && m.movement_type === "prestamo"
                            ? "text-red-600 font-medium"
                            : "text-muted-foreground"
                        )}>
                          {new Date(m.expected_return_date).toLocaleDateString("es-CL")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-muted-foreground hover:text-blue-600 p-1 rounded"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          disabled={deleting === m.id}
                          className="text-muted-foreground hover:text-red-600 p-1 rounded"
                          title="Eliminar"
                        >
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
        <strong>Fundamento normativo:</strong> NS-04 CCHEN — Todo movimiento de material radiactivo (fuentes selladas y no selladas)
        debe quedar registrado en el IMAR (Inventario de Material Radiactivo). Los préstamos requieren autorización escrita
        y devolución en el plazo establecido. Las bajas y transferencias deben reportarse a CCHEN.
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{editing ? "Editar Movimiento IMAR" : "Registrar Movimiento IMAR"}</h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-muted-foreground text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Tipo de movimiento *</label>
                  <select required value={form.movement_type}
                    onChange={e => setForm(f => ({ ...f, movement_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {MOVEMENT_TYPES.map(t => (
                      <option key={t} value={t}>{TYPE_CONFIG[t]?.label ?? t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Fecha *</label>
                  <input required type="date" value={form.movement_date}
                    onChange={e => setForm(f => ({ ...f, movement_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Nombre de la fuente *</label>
                  <input required value={form.source_name}
                    onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))}
                    placeholder="Ej: Fuente sellada Ir-192 HDR"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Isótopo</label>
                  <input value={form.isotope}
                    onChange={e => setForm(f => ({ ...f, isotope: e.target.value }))}
                    placeholder="Ej: Ir-192, Tc-99m"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">N° serie</label>
                  <input value={form.serial_number}
                    onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Ubicación origen</label>
                  <input value={form.origin_location}
                    onChange={e => setForm(f => ({ ...f, origin_location: e.target.value }))}
                    placeholder="Bodega Radiofarmacia"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Ubicación destino</label>
                  <input value={form.destination_location}
                    onChange={e => setForm(f => ({ ...f, destination_location: e.target.value }))}
                    placeholder="Sala de Braquiterapia"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Actividad (GBq)</label>
                  <input type="number" step="0.001" value={form.activity_gbq}
                    onChange={e => setForm(f => ({ ...f, activity_gbq: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                {form.movement_type === "prestamo" && (
                  <div>
                    <label className="block text-sm font-medium text-foreground/80 mb-1">Fecha retorno esperada</label>
                    <input type="date" value={form.expected_return_date}
                      onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Responsable</label>
                  <input value={form.responsible}
                    onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Autorizado por</label>
                  <input value={form.authorized_by}
                    onChange={e => setForm(f => ({ ...f, authorized_by: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Referencia documental</label>
                  <input value={form.document_ref}
                    onChange={e => setForm(f => ({ ...f, document_ref: e.target.value }))}
                    placeholder="N° acta, resolución, guía despacho..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground/80 mb-1">ID fuente (radioactive_sources)</label>
                  <input type="number" value={form.source_id}
                    onChange={e => setForm(f => ({ ...f, source_id: e.target.value }))}
                    placeholder="ID interno"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground/80 mb-1">Notas</label>
                  <textarea value={form.notes} rows={2}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-muted/50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Guardando…" : editing ? "Actualizar Movimiento" : "Guardar Movimiento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
