"use client";


import { useEffect, useState } from "react";
import { RefreshCw, Radiation, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";

interface RadRecord { id: number; linac_id: number; category: string; measurement_type: string | null; measurement_date: string; measurement_time: string | null; location: string | null; value: string | null; unit: string | null; limit_value: string | null; semaphore: string | null; status: string; frequency: string | null; next_due_date: string | null; worker_name: string | null; instrument_name: string | null; notes: string | null; }

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
const CATS = ["ambiental", "personal", "equipo", "verificacion", "general"];
const SEM: Record<string, string> = { verde: "bg-green-100 text-green-700", amarillo: "bg-yellow-100 text-yellow-700", naranja: "bg-orange-100 text-orange-700", rojo: "bg-red-100 text-red-700" };

function fmtDate(d: string) { return new Date(d).toLocaleDateString("es-CL"); }

export default function LinacRadiationPage() {
  const [records, setRecords] = useState<RadRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [linacId, setLinacId] = useState("1");
  const [catFilter, setCatFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "ambiental", measurementType: "", measurementDate: "", location: "", value: "", unit: "µSv/h", limitValue: "", status: "conforme", notes: "" });

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams({ linacId });
    if (catFilter) p.set("category", catFilter);
    if (semFilter) p.set("semaphore", semFilter);
    fetch(`/api/linac/radiation?${p}`)
      .then(r => r.json())
      .then(d => setRecords(d.records ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [linacId, catFilter, semFilter]);

  const save = async () => {
    if (!form.measurementDate || !form.category) { setMsg("Fecha y categoría son obligatorias."); return; }
    setSaving(true); setMsg("");
    const fd = new FormData();
    Object.entries({ linacId, ...form }).forEach(([k, v]) => fd.append(k, v));
    const r = await fetch("/api/linac/radiation", { method: "POST", body: fd });
    const d = await r.json();
    setSaving(false);
    if (d.ok) { setMsg("Registro guardado."); setShowForm(false); load(); }
    else setMsg(d.error ?? "Error");
  };

  const noConformes = records.filter(r => r.semaphore === "rojo" || r.semaphore === "naranja").length;

  return (
    <div className="min-h-screen bg-muted/50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100"><Radiation className="h-6 w-6 text-yellow-700" /></div>
            <div><h1 className="text-2xl font-bold text-foreground">Protección Radiológica LINAC</h1><p className="text-sm text-muted-foreground">Monitoreo ambiental, personal y de equipos</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}><RefreshCw className={`h-5 w-5 text-muted-foreground ${loading ? "animate-spin" : ""}`} /></button>
            <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm px-3 py-2 rounded-lg"><PlusCircle className="h-4 w-4" /> Nuevo</button>
          </div>
        </div>

        {noConformes > 0 && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700 font-medium">{noConformes} medición{noConformes > 1 ? "es" : ""} fuera de límites (naranja/rojo)</div>}
        {msg && <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">{msg}</div>}

        {showForm && (
          <div className="bg-background rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-foreground">Nuevo registro</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Categoría</label>
                <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Tipo medición</label><input className={inp} value={form.measurementType} onChange={e => setForm(f => ({ ...f, measurementType: e.target.value }))} placeholder="Ej: dosis ambiental" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Fecha *</label><input className={inp} type="date" value={form.measurementDate} onChange={e => setForm(f => ({ ...f, measurementDate: e.target.value }))} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Ubicación</label><input className={inp} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Sala de tratamiento" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Valor medido</label><input className={inp} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0.5" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Unidad</label><input className={inp} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="µSv/h" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Límite</label><input className={inp} value={form.limitValue} onChange={e => setForm(f => ({ ...f, limitValue: e.target.value }))} placeholder="1.0" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Estado</label>
                <select className={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="conforme">Conforme</option>
                  <option value="no_conforme">No conforme</option>
                  <option value="observado">Observado</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Notas</label><input className={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">{saving ? "Guardando…" : "Guardar"}</button>
              <button onClick={() => setShowForm(false)} className="text-sm text-muted-foreground px-3 py-2">Cancelar</button>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", value: records.length },
            { label: "Conformes", value: records.filter(r => r.semaphore === "verde" || r.status === "conforme").length },
            { label: "Alertas", value: noConformes, color: noConformes > 0 ? "text-red-600" : "text-foreground/80" },
            { label: "Ambientales", value: records.filter(r => r.category === "ambiental").length },
          ].map(t => (
            <div key={t.label} className="bg-background rounded-xl border border-border shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${t.color ?? "text-foreground/80"}`}>{t.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <select className="rounded-lg border border-border px-3 py-2 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Todas categorías</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="rounded-lg border border-border px-3 py-2 text-sm" value={semFilter} onChange={e => setSemFilter(e.target.value)}>
            <option value="">Todos estados</option>
            {Object.keys(SEM).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="rounded-lg border border-border px-3 py-2 text-sm w-24" type="number" min="1" placeholder="LINAC ID" value={linacId} onChange={e => setLinacId(e.target.value)} />
        </div>

        {/* Table */}
        <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border/50">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-5 py-3">Fecha</th>
                <th className="text-left px-5 py-3">Categoría</th>
                <th className="text-left px-5 py-3">Ubicación</th>
                <th className="text-right px-5 py-3">Valor</th>
                <th className="text-right px-5 py-3">Límite</th>
                <th className="text-right px-5 py-3">Estado</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.slice(0, 50).map(rec => (
                <>
                  <tr key={rec.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(rec.measurement_date)}</td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{rec.category}</td>
                    <td className="px-5 py-3 text-muted-foreground">{rec.location ?? "—"}</td>
                    <td className="px-5 py-3 text-right font-mono">{rec.value ?? "—"} {rec.unit ?? ""}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{rec.limit_value ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      {rec.semaphore ? <span className={`text-xs px-2 py-0.5 rounded-full ${SEM[rec.semaphore] ?? ""}`}>{rec.semaphore}</span> : <span className="text-xs text-muted-foreground">{rec.status}</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-300">{expanded === rec.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</td>
                  </tr>
                  {expanded === rec.id && (
                    <tr key={`exp-${rec.id}`}><td colSpan={7} className="px-5 py-3 bg-muted/50 text-xs text-muted-foreground">
                      <div className="grid grid-cols-2 gap-2">
                        <span>Tipo: {rec.measurement_type ?? "—"}</span>
                        <span>Próx. vencimiento: {rec.next_due_date ? fmtDate(rec.next_due_date) : "—"}</span>
                        <span>Instrumento: {rec.instrument_name ?? "—"}</span>
                        <span>Trabajador: {rec.worker_name ?? "—"}</span>
                        {rec.notes && <span className="col-span-2">Notas: {rec.notes}</span>}
                      </div>
                    </td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {records.length === 0 && !loading && <div className="text-center py-12 text-muted-foreground">Sin registros de medición</div>}
        </div>

        <div className="rounded-xl border border-border bg-background px-5 py-4 text-xs text-muted-foreground">
          <p className="font-semibold text-muted-foreground mb-1">Marco normativo</p>
          <p>IAEA Safety Reports Series No. 47 — Monitoreo de radiación en instalaciones médicas. DS N°12/2010 MINSAL — Límites de tasas de dosis en zonas clasificadas. ICRP Publication 103 — Límites de dosis ocupacional y pública. CCHEN ORD sobre vigilancia radiológica en radioterapia.</p>
        </div>
      </div>
    </div>
  );
}
