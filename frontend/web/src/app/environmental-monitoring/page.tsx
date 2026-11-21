"use client";
import { useEffect, useState, useCallback } from "react";
import {
  MapPin, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw,
  AlertTriangle, CheckCircle, Activity, TrendingUp, Calendar
} from "lucide-react";

type Point = {
  id: number; point_code: string; point_name: string;
  location: string; area_type: string; reference_level_usvh: number;
  active: boolean; notes: string;
};

type Record_ = {
  id: number; point_id: number; point_code: string; point_name: string;
  measurement_date: string; measured_by: string; instrument_id: string;
  dose_rate_usvh: string; background_usvh: string; net_rate_usvh: string;
  conditions: string; status: string; area_type: string;
  reference_level_usvh: string; notes: string;
};

type Stats = {
  total_records: string; points_measured: string;
  critical: string; high: string; elevated: string; normal: string;
  avg_rate: string; max_rate: string; last_survey: string;
};

type Data = { records: Record_[]; stats: Stats; latest_by_point: Record_[] };

const AREA_CFG: Record<string, { label: string; bg: string; text: string }> = {
  controlled: { label: "Área Controlada",   bg: "bg-red-100",    text: "text-red-800"    },
  supervised: { label: "Área Supervisada",  bg: "bg-amber-100",  text: "text-amber-800"  },
  public:     { label: "Área Pública",       bg: "bg-blue-100",   text: "text-blue-800"   },
};

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  critical: { label: "CRÍTICO",  bg: "bg-red-100",    text: "text-red-800",    icon: <AlertTriangle className="h-3 w-3" /> },
  high:     { label: "ALTO",     bg: "bg-orange-100", text: "text-orange-800", icon: <TrendingUp    className="h-3 w-3" /> },
  elevated: { label: "ELEVADO",  bg: "bg-amber-100",  text: "text-amber-800",  icon: <Activity      className="h-3 w-3" /> },
  normal:   { label: "NORMAL",   bg: "bg-green-100",  text: "text-green-800",  icon: <CheckCircle   className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.normal;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function AreaBadge({ area }: { area: string }) {
  const cfg = AREA_CFG[area] ?? { label: area, bg: "bg-gray-100", text: "text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

type FormState = {
  point_code: string; measurement_date: string; measured_by: string;
  instrument_id: string; dose_rate_usvh: string; background_usvh: string;
  conditions: string; notes: string;
};

const BLANK: FormState = {
  point_code: "", measurement_date: new Date().toISOString().slice(0, 10),
  measured_by: "", instrument_id: "", dose_rate_usvh: "", background_usvh: "0.100",
  conditions: "", notes: "",
};

function RecordForm({
  form, points, onChange, onSubmit, onCancel, saving,
}: {
  form: FormState; points: Point[];
  onChange: (k: keyof FormState, v: string) => void;
  onSubmit: () => void; onCancel: () => void; saving: boolean;
}) {
  const F = (label: string, key: keyof FormState, type = "text", opts?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type} value={form[key]}
        onChange={e => onChange(key, e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        {...opts}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Nueva Medición Ambiental</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Punto de Medición *</label>
            <select
              value={form.point_code} onChange={e => onChange("point_code", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccione punto…</option>
              {points.map(p => (
                <option key={p.id} value={p.point_code}>
                  {p.point_code} — {p.point_name}
                </option>
              ))}
            </select>
          </div>
          {F("Fecha *", "measurement_date", "date")}
          {F("Responsable Medición", "measured_by")}
          {F("Tasa de Dosis (µSv/h) *", "dose_rate_usvh", "number", { step: "0.001", min: "0", placeholder: "0.000" })}
          {F("Fondo (µSv/h)", "background_usvh", "number", { step: "0.001", min: "0", placeholder: "0.100" })}
          {F("ID Instrumento / Ref. Calibración", "instrument_id")}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Condiciones durante la medición</label>
            <input
              value={form.conditions} onChange={e => onChange("conditions", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Normal, fuentes en posición de almacenamiento"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={form.notes} onChange={e => onChange("notes", e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={onSubmit} disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Registrar Medición"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordCard({ rec, onDelete }: { rec: Record_; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CFG[rec.status] ?? STATUS_CFG.normal;
  const refLvl = parseFloat(rec.reference_level_usvh ?? "0");
  const measured = parseFloat(rec.dose_rate_usvh);
  const pct = refLvl > 0 ? Math.min((measured / refLvl) * 100, 999) : 0;
  const barColor = rec.status === "critical" ? "bg-red-500" :
                   rec.status === "high"     ? "bg-orange-500" :
                   rec.status === "elevated" ? "bg-amber-500" : "bg-green-500";
  const dateStr = new Date(rec.measurement_date + "T12:00:00").toLocaleDateString("es-CL", {
    day: "numeric", month: "short", year: "numeric"
  });

  return (
    <div className={`bg-white rounded-xl border-l-4 shadow-sm ${cfg.bg.replace("bg-", "border-").replace("-100", "-400")}`}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm font-semibold text-gray-900">{rec.point_code}</span>
            <AreaBadge area={rec.area_type} />
            <StatusBadge status={rec.status} />
          </div>
          <p className="text-xs text-gray-500 truncate">{rec.point_name}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
            <span><Calendar className="inline h-3 w-3 mr-1" />{dateStr}</span>
            <span className={`font-bold text-sm ${cfg.text}`}>
              {parseFloat(rec.dose_rate_usvh).toFixed(3)} µSv/h
            </span>
            {rec.measured_by && <span>por {rec.measured_by}</span>}
          </div>
          {refLvl > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>vs límite {refLvl} µSv/h</span>
                <span>{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-2 text-xs text-gray-700">
          <div><span className="font-medium">Fondo:</span> {parseFloat(rec.background_usvh).toFixed(3)} µSv/h</div>
          <div><span className="font-medium">Neta:</span> {parseFloat(rec.net_rate_usvh ?? "0").toFixed(3)} µSv/h</div>
          {rec.instrument_id && <div className="col-span-2"><span className="font-medium">Instrumento:</span> {rec.instrument_id}</div>}
          {rec.conditions && <div className="col-span-2"><span className="font-medium">Condiciones:</span> {rec.conditions}</div>}
          {rec.notes && <div className="col-span-2"><span className="font-medium">Notas:</span> {rec.notes}</div>}
        </div>
      )}
    </div>
  );
}

export default function EnvironmentalMonitoringPage() {
  const [data, setData] = useState<Data | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"records" | "latest">("latest");

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year, month });
      if (status) params.set("status", status);
      const [d, p] = await Promise.all([
        fetch(`/api/environmental-monitoring?${params}`).then(r => r.json()),
        fetch("/api/environmental-monitoring?view=points").then(r => r.json()),
      ]);
      setData(d);
      setPoints(p.points ?? []);
    } finally { setLoading(false); }
  }, [year, month, status]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.point_code || !form.measurement_date || !form.dose_rate_usvh) return;
    setSaving(true);
    try {
      const res = await fetch("/api/environmental-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dose_rate_usvh: parseFloat(form.dose_rate_usvh),
          background_usvh: parseFloat(form.background_usvh || "0.1"),
        }),
      });
      if (res.ok) { setShowForm(false); setForm(BLANK); load(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta medición?")) return;
    await fetch(`/api/environmental-monitoring?id=${id}`, { method: "DELETE" });
    load();
  };

  const s = data?.stats;
  const hasAlerts = s && (parseInt(s.critical) > 0 || parseInt(s.high) > 0);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));
  const months = [
    ["1","Enero"],["2","Febrero"],["3","Marzo"],["4","Abril"],["5","Mayo"],["6","Junio"],
    ["7","Julio"],["8","Agosto"],["9","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"],
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-xl">
            <MapPin className="h-6 w-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Monitoreo Ambiental</h1>
            <p className="text-sm text-gray-500">Programa de vigilancia de tasa de dosis ambiental — DS 3/1985 Art. 32</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" /> Nueva Medición
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {hasAlerts && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              ⚠ Mediciones con niveles elevados detectadas
            </p>
            <p className="text-xs text-red-700 mt-1">
              {parseInt(s?.critical ?? "0") > 0 && `${s!.critical} medición(es) CRÍTICA(S) `}
              {parseInt(s?.high ?? "0") > 0 && `${s!.high} medición(es) ALTA(S) `}
              — Revisar y tomar acciones correctivas según DS 3/1985.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total registros", value: s.total_records, color: "text-gray-900" },
            { label: "Crítico / Alto", value: `${s.critical} / ${s.high}`, color: parseInt(s.critical)+parseInt(s.high) > 0 ? "text-red-700" : "text-green-700" },
            { label: "Tasa promedio", value: `${parseFloat(s.avg_rate ?? "0").toFixed(3)} µSv/h`, color: "text-blue-700" },
            { label: "Tasa máxima", value: `${parseFloat(s.max_rate ?? "0").toFixed(3)} µSv/h`, color: "text-purple-700" },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Latest per point summary */}
      {data?.latest_by_point && data.latest_by_point.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Estado Actual por Punto de Monitoreo
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Código</th>
                  <th className="pb-2 font-medium">Nombre</th>
                  <th className="pb-2 font-medium">Área</th>
                  <th className="pb-2 font-medium text-right">Tasa (µSv/h)</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.latest_by_point.map(r => {
                  const dateStr = new Date(r.measurement_date + "T12:00:00").toLocaleDateString("es-CL", {
                    day: "numeric", month: "short", year: "numeric"
                  });
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-mono font-semibold text-gray-900">{r.point_code}</td>
                      <td className="py-2 text-gray-700 max-w-[160px] truncate">{r.point_name}</td>
                      <td className="py-2"><AreaBadge area={r.area_type} /></td>
                      <td className="py-2 text-right font-semibold">{parseFloat(r.dose_rate_usvh).toFixed(3)}</td>
                      <td className="py-2"><StatusBadge status={r.status} /></td>
                      <td className="py-2 text-gray-500">{dateStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters + Records */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <select value={year} onChange={e => setYear(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            {months.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500 ml-auto">
            {data?.records?.length ?? 0} registro(s)
          </span>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Cargando…</p>
          ) : !data?.records?.length ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No hay mediciones para el período seleccionado.
            </p>
          ) : (
            data.records.map(r => (
              <RecordCard key={r.id} rec={r} onDelete={() => handleDelete(r.id)} />
            ))
          )}
        </div>
      </div>

      {showForm && (
        <RecordForm
          form={form} points={points}
          onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
          onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setForm(BLANK); }}
          saving={saving}
        />
      )}
    </div>
  );
}
