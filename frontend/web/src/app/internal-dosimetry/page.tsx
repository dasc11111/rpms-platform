"use client";


import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Plus, X, AlertTriangle, Atom } from "lucide-react";

// DS 3/1985 — Monitoreo de Incorporación Radiactiva (Dosimetría Interna)
// ICRP 103: límite dosis efectiva comprometida = 20 mSv/año trabajador ocupacional
// Métodos: bioassay urinario, conteo tiroideo (I-131), espectrometría de cuerpo entero

const LIMIT_MSV = 20; // mSv/año — DS 3/1985 / ICRP 103

type InternalRecord = {
  id: number;
  worker_rut?: string;
  worker_name?: string;
  service?: string;
  measurement_date: string;
  radionuclide: string;
  pathway: string;
  method: string;
  measured_value?: number;
  measured_unit?: string;
  intake_bq?: number;
  committed_dose_msv?: number;
  dcf_sv_bq?: number;
  fraction_alimit?: number;
  annual_limit_bq?: number;
  notes?: string;
  performed_by?: string;
  status: string;
};

type WorkerSummary = {
  worker_rut?: string;
  worker_name?: string;
  service?: string;
  annual_committed_msv: number;
  measurements: string;
  last_measurement?: string;
};

type Stats = {
  total: string; workers_tested: string; total_committed_msv: string;
  max_single_msv: string; max_fraction: string; above_10pct: string; this_year: string;
};

const PATHWAY_LABELS: Record<string, string> = {
  inhalation: "Inhalación", ingestion: "Ingestión", skin: "Absorción cutánea", wound: "Herida",
};
const METHOD_LABELS: Record<string, string> = {
  bioassay: "Bioassay urinario", thyroid_counting: "Conteo tiroideo", wbc: "Esp. cuerpo entero",
  blood: "Muestra sangre", nasal_swab: "Hisopo nasal", air_sampling: "Muestreo aire", other: "Otro",
};

function fDate(d?: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
function pct(v?: number) {
  if (v == null) return null;
  return Math.round(v * 100);
}
function barColor(f?: number) {
  if (!f) return "bg-green-400";
  if (f > 0.5) return "bg-red-500";
  if (f > 0.1) return "bg-orange-400";
  return "bg-green-400";
}

function RecordCard({ rec, onEdit }: { rec: InternalRecord; onEdit: (r: InternalRecord) => void }) {
  const [open, setOpen] = useState(false);
  const pctVal = pct(rec.fraction_alimit);
  const high = (rec.fraction_alimit ?? 0) > 0.1;

  return (
    <div className={`rounded-xl border ${high ? "border-orange-300" : "border-gray-200"} bg-white shadow-sm mb-2`}>
      <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setOpen(o => !o)}>
        <Atom className={`w-5 h-5 mt-0.5 flex-shrink-0 ${high ? "text-orange-500" : "text-blue-400"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-sm font-bold text-gray-800">{rec.radionuclide}</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {PATHWAY_LABELS[rec.pathway] ?? rec.pathway}
            </span>
            <span className="text-xs text-gray-400">{METHOD_LABELS[rec.method] ?? rec.method}</span>
          </div>
          <div className="text-sm font-medium text-gray-700">{rec.worker_name ?? "—"}</div>
          <div className="text-xs text-gray-500">{rec.service ?? ""} · {fDate(rec.measurement_date)}</div>
          {rec.committed_dose_msv != null && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span>Dosis comprometida</span>
                <span className={`font-semibold ${high ? "text-orange-700" : "text-green-700"}`}>
                  {Number(rec.committed_dose_msv).toFixed(4)} mSv
                  {pctVal != null ? ` (${pctVal}% del límite)` : ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor(rec.fraction_alimit)}`}
                  style={{ width: `${Math.min(100, (rec.fraction_alimit ?? 0) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="ml-2 flex-shrink-0 text-gray-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {rec.measured_value != null && (
              <div><span className="text-gray-500">Medición:</span> <span className="font-medium">{rec.measured_value} {rec.measured_unit ?? "Bq"}</span></div>
            )}
            {rec.intake_bq != null && (
              <div><span className="text-gray-500">Incorporación:</span> <span className="font-medium">{Number(rec.intake_bq).toFixed(1)} Bq</span></div>
            )}
            {rec.dcf_sv_bq != null && (
              <div><span className="text-gray-500">DCF:</span> <span className="font-mono">{Number(rec.dcf_sv_bq).toExponential(2)} Sv/Bq</span></div>
            )}
            {rec.annual_limit_bq != null && (
              <div><span className="text-gray-500">ALI:</span> <span className="font-medium">{Number(rec.annual_limit_bq).toLocaleString("es-CL")} Bq</span></div>
            )}
            {rec.performed_by && (
              <div><span className="text-gray-500">Realizado por:</span> <span>{rec.performed_by}</span></div>
            )}
          </div>
          {rec.notes && <div className="text-xs italic text-gray-500">{rec.notes}</div>}
          <button onClick={() => onEdit(rec)} className="text-xs text-blue-600 hover:text-blue-800 underline">Editar</button>
        </div>
      )}
    </div>
  );
}

function WorkerCard({ w }: { w: WorkerSummary }) {
  const fraction = Number(w.annual_committed_msv) / LIMIT_MSV;
  const p = Math.min(100, Math.round(fraction * 100));
  const high = fraction > 0.1;
  return (
    <div className={`rounded-xl border ${high ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"} p-4 shadow-sm`}>
      <div className="flex justify-between items-start mb-1">
        <div>
          <div className="font-semibold text-sm text-gray-800">{w.worker_name ?? w.worker_rut ?? "—"}</div>
          <div className="text-xs text-gray-500">{w.service ?? ""}</div>
        </div>
        <div className={`text-sm font-bold ${high ? "text-orange-700" : "text-green-700"}`}>
          {Number(w.annual_committed_msv).toFixed(4)} mSv
        </div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor(fraction)}`} style={{ width: `${p}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{w.measurements} medición{Number(w.measurements) > 1 ? "es" : ""}</span>
        <span>{p}% de {LIMIT_MSV} mSv</span>
      </div>
    </div>
  );
}

const EMPTY = {
  worker_rut: "", worker_name: "", service: "", measurement_date: "",
  radionuclide: "", pathway: "inhalation", method: "bioassay",
  measured_value: "", measured_unit: "Bq", intake_bq: "", committed_dose_msv: "",
  dcf_sv_bq: "", fraction_alimit: "", annual_limit_bq: "", notes: "", performed_by: "", status: "final",
};

function RecordForm({
  initial, onClose, onSaved,
}: {
  initial?: InternalRecord; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(
    initial
      ? {
          worker_rut: initial.worker_rut ?? "",
          worker_name: initial.worker_name ?? "",
          service: initial.service ?? "",
          measurement_date: initial.measurement_date ?? "",
          radionuclide: initial.radionuclide ?? "",
          pathway: initial.pathway ?? "inhalation",
          method: initial.method ?? "bioassay",
          measured_value: initial.measured_value != null ? String(initial.measured_value) : "",
          measured_unit: initial.measured_unit ?? "Bq",
          intake_bq: initial.intake_bq != null ? String(initial.intake_bq) : "",
          committed_dose_msv: initial.committed_dose_msv != null ? String(initial.committed_dose_msv) : "",
          dcf_sv_bq: initial.dcf_sv_bq != null ? String(initial.dcf_sv_bq) : "",
          annual_limit_bq: initial.annual_limit_bq != null ? String(initial.annual_limit_bq) : "",
          notes: initial.notes ?? "",
          performed_by: initial.performed_by ?? "",
          status: initial.status ?? "final",
        }
      : { ...EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.measurement_date || !form.radionuclide) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    ["measured_value","intake_bq","committed_dose_msv","dcf_sv_bq","annual_limit_bq"].forEach(k => {
      payload[k] = form[k] ? parseFloat(form[k]) : null;
    });
    if (initial) {
      await fetch("/api/internal-dosimetry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial.id, ...payload }),
      });
    } else {
      await fetch("/api/internal-dosimetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSaved();
  }

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
  const lbl = "block text-xs font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">
            {initial ? "Editar medición" : "Registrar medición dosimetría interna"}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-700" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Nombre trabajador</label>
              <input className={inp} value={form.worker_name} onChange={set("worker_name")} />
            </div>
            <div>
              <label className={lbl}>RUT</label>
              <input className={inp} placeholder="12.345.678-9" value={form.worker_rut} onChange={set("worker_rut")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Servicio</label>
              <input className={inp} value={form.service} onChange={set("service")} />
            </div>
            <div>
              <label className={lbl}>Fecha medición *</label>
              <input type="date" className={inp} value={form.measurement_date} onChange={set("measurement_date")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Radionúclido *</label>
              <input className={inp} placeholder="I-131, Tc-99m…" value={form.radionuclide} onChange={set("radionuclide")} />
            </div>
            <div>
              <label className={lbl}>Vía</label>
              <select className={inp} value={form.pathway} onChange={set("pathway")}>
                <option value="inhalation">Inhalación</option>
                <option value="ingestion">Ingestión</option>
                <option value="skin">Absorción cutánea</option>
                <option value="wound">Herida</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Método</label>
              <select className={inp} value={form.method} onChange={set("method")}>
                <option value="bioassay">Bioassay urinario</option>
                <option value="thyroid_counting">Conteo tiroideo</option>
                <option value="wbc">Esp. cuerpo entero</option>
                <option value="blood">Muestra sangre</option>
                <option value="nasal_swab">Hisopo nasal</option>
                <option value="air_sampling">Muestreo aire</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Valor medido</label>
              <input type="number" step="any" className={inp} value={form.measured_value} onChange={set("measured_value")} />
            </div>
            <div>
              <label className={lbl}>Unidad</label>
              <select className={inp} value={form.measured_unit} onChange={set("measured_unit")}>
                <option value="Bq">Bq</option>
                <option value="kBq">kBq</option>
                <option value="Bq/L">Bq/L</option>
                <option value="Bq/sample">Bq/muestra</option>
                <option value="cps">cps</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Incorporación (Bq)</label>
              <input type="number" step="any" className={inp} value={form.intake_bq} onChange={set("intake_bq")} />
            </div>
            <div>
              <label className={lbl}>DCF (Sv/Bq)</label>
              <input type="number" step="any" className={inp} placeholder="ej: 7.4e-9" value={form.dcf_sv_bq} onChange={set("dcf_sv_bq")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Dosis comprometida (mSv)</label>
              <input type="number" step="any" className={inp} value={form.committed_dose_msv} onChange={set("committed_dose_msv")} />
            </div>
            <div>
              <label className={lbl}>ALI (Bq)</label>
              <input type="number" step="any" className={inp} value={form.annual_limit_bq} onChange={set("annual_limit_bq")} />
            </div>
          </div>
          <div>
            <label className={lbl}>Realizado por</label>
            <input className={inp} value={form.performed_by} onChange={set("performed_by")} />
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={set("notes")} />
          </div>
          <div>
            <label className={lbl}>Estado</label>
            <select className={inp} value={form.status} onChange={set("status")}>
              <option value="preliminary">Preliminar</option>
              <option value="final">Final</option>
              <option value="voided">Anulado</option>
            </select>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex gap-3 justify-end rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button
            onClick={save}
            disabled={saving || !form.measurement_date || !form.radionuclide}
            className="px-5 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Registrar medición"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InternalDosimetryPage() {
  const [records, setRecords]     = useState<InternalRecord[]>([]);
  const [byWorker, setByWorker]   = useState<WorkerSummary[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [years, setYears]         = useState<number[]>([]);
  const [nuclides, setNuclides]   = useState<string[]>([]);
  const [year, setYear]           = useState("");
  const [nuclide, setNuclide]     = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<InternalRecord | undefined>(undefined);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"records" | "summary">("summary");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (nuclide) params.set("nuclide", nuclide);
    const r = await fetch(`/api/internal-dosimetry?${params}`);
    const d = await r.json();
    setRecords(d.records ?? []);
    setByWorker(d.byWorker ?? []);
    setStats(d.stats ?? null);
    setYears(d.years ?? []);
    setNuclides(d.nuclides ?? []);
    setLoading(false);
  }, [year, nuclide]);

  useEffect(() => { load(); }, [load]);

  const above10 = parseInt(stats?.above_10pct ?? "0");

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dosimetría Interna</h1>
          <p className="text-sm text-gray-500 mt-1">Monitoreo de incorporación radiactiva · ICRP 103 · DS 3/1985</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow hover:bg-blue-800"
        >
          <Plus className="w-4 h-4" /> Nueva medición
        </button>
      </div>

      {above10 > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-700">
            <span className="font-semibold">{above10} medición{above10 > 1 ? "es" : ""}</span> supera el 10% del límite anual (2 mSv).
            Se recomienda revisión del protocolo ALARA.
          </div>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total mediciones", val: stats.total, sub: `Año actual: ${stats.this_year}` },
            { label: "Trabajadores monitoreados", val: stats.workers_tested, sub: "este año" },
            { label: "Dosis comprometida total", val: `${Number(stats.total_committed_msv).toFixed(3)} mSv`, sub: `Máx: ${Number(stats.max_single_msv).toFixed(4)} mSv` },
            { label: ">10% límite anual", val: stats.above_10pct, sub: `Máx: ${Math.round(Number(stats.max_fraction) * 100)}%` },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">{k.label}</div>
              <div className="text-xl font-bold text-gray-900">{k.val}</div>
              <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {(["summary", "records"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "summary" ? "Resumen por trabajador" : "Registros individuales"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={year} onChange={e => setYear(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={nuclide} onChange={e => setNuclide(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">Todos los radionúclidos</option>
          {nuclides.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando…</div>
      ) : tab === "summary" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {byWorker.length === 0
            ? <div className="col-span-2 text-center py-10 text-gray-400">Sin datos para el año seleccionado</div>
            : byWorker.map((w, i) => <WorkerCard key={i} w={w} />)}
        </div>
      ) : (
        <div>
          {records.length === 0
            ? <div className="text-center py-10 text-gray-400">
                <Atom className="w-10 h-10 mx-auto mb-3 opacity-30" />
                Sin registros
              </div>
            : records.map(r => (
                <RecordCard key={r.id} rec={r} onEdit={e => { setEditing(e); setShowForm(true); }} />
              ))}
        </div>
      )}

      {showForm && (
        <RecordForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSaved={() => { setShowForm(false); setEditing(undefined); load(); }}
        />
      )}
    </div>
  );
}
